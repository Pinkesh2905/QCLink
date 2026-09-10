// ============================================================================
// GET /api/qc-master/[qcUID] — detail of QC Master + all child specifications
// PUT /api/qc-master/[qcUID] — update QC Master + child specifications
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { query, withTransaction } from '@/lib/db';
import { diffFields, writeAuditDiffs, writeAuditLog } from '@/lib/audit';
import { syncQCMasterToSheet, appendAuditLogToSheet, type SheetAuditEntry } from '@/lib/sheets-sync';
import { enforceFieldPermissions } from '@/lib/field-permissions';
import { updateQCMasterSchema, computeSpecification } from '@/validators/qc-master';
import { errorResponse, validationErrorResponse, AppError } from '@/lib/errors';
import type {
  QCMaster,
  QCMasterWithLookups,
  QCSpecification,
  QCSpecificationWithLookups,
  SpecificationCriteria,
} from '@/types/db';

// ---------------------------------------------------------------------------
// GET — QC Master Detail
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const qcUID = params.qcUID;

    const headers = await query<QCMasterWithLookups>(
      `SELECT q.*, usr.Name AS OwnerName,
              (SELECT COUNT(*) FROM QCSpecifications s WHERE s.QCUID = q.QCUID) AS SpecCount
       FROM QCMaster q
       LEFT JOIN Users usr ON q.OwnerUserID = usr.UserID
       WHERE q.QCUID = ?`,
      [qcUID]
    );

    if (headers.length === 0) {
      throw new AppError('QC Master not found', 404);
    }

    const specs = await query<QCSpecificationWithLookups>(
      `SELECT s.*,
              c.CriteriaName,
              m.MethodName,
              f.FrequencyName,
              r.ResponsibilityName,
              rp.ReactionPlanName
       FROM QCSpecifications s
       LEFT JOIN SpecificationCriteria c ON s.CriteriaID = c.CriteriaID
       LEFT JOIN MethodOfInspection m ON s.MethodID = m.MethodID
       LEFT JOIN InspectionFrequency f ON s.FrequencyID = f.FrequencyID
       LEFT JOIN Responsibility r ON s.ResponsibilityID = r.ResponsibilityID
       LEFT JOIN ReactionPlan rp ON s.ReactionPlanID = rp.ReactionPlanID
       WHERE s.QCUID = ?
       ORDER BY s.SrNo ASC`,
      [qcUID]
    );

    return NextResponse.json({
      ...headers[0],
      Specifications: specs,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// PUT — Update QC Master
// ---------------------------------------------------------------------------
export const PUT = withAuth(async (req: NextRequest, ctx) => {
  try {
    const params = await ctx.params;
    const qcUID = params.qcUID;

    const body = await req.json();
    const parsed = updateQCMasterSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues);
    }

    const data = parsed.data;

    const [currentQC] = await query<QCMaster>(
      'SELECT * FROM QCMaster WHERE QCUID = ?',
      [qcUID]
    );

    if (!currentQC) {
      throw new AppError('QC Master not found', 404);
    }

    // Structural lock: ItemUID cannot be changed post-creation
    if (body.ItemUID && body.ItemUID !== currentQC.ItemUID) {
      throw new AppError(
        "QC Master's linked item cannot be changed after creation.",
        400,
        'ItemUID'
      );
    }

    // 1. Header Diff & Permission Check
    const headerFields = ['ImagePath'];
    const newHeaderRow: Record<string, unknown> = { ...currentQC };

    if ('ImagePath' in data) {
      newHeaderRow.ImagePath = data.ImagePath ?? null;
    }

    const headerDiffs = diffFields(
      currentQC as unknown as Record<string, unknown>,
      newHeaderRow,
      headerFields
    );

    if (headerDiffs.length > 0) {
      const changedHeaderFields = headerDiffs.map((d) => d.field);
      await enforceFieldPermissions('QCMaster', changedHeaderFields, ctx.user.role);
    }

    // 2. Specifications Diff & Permission Check
    let specsChanged = false;
    if (data.Specifications) {
      const existingSpecs = await query<QCSpecification>(
        'SELECT * FROM QCSpecifications WHERE QCUID = ? ORDER BY SrNo ASC',
        [qcUID]
      );

      const specFields = [
        'Parameter',
        'CriteriaID',
        'MinVal',
        'MaxVal',
        'OtherValue',
        'MethodID',
        'FrequencyID',
        'ResponsibilityID',
        'ReactionPlanID',
      ];

      const changedSpecFields = new Set<string>();

      if (existingSpecs.length !== data.Specifications.length) {
        specsChanged = true;
        // All fields considered touched if row count changed
        specFields.forEach((f) => changedSpecFields.add(f));
      } else {
        for (let i = 0; i < existingSpecs.length; i++) {
          const oldRow = existingSpecs[i] as unknown as Record<string, unknown>;
          const newRow = data.Specifications[i] as unknown as Record<string, unknown>;
          const rowDiffs = diffFields(oldRow, newRow, specFields);
          if (rowDiffs.length > 0) {
            specsChanged = true;
            rowDiffs.forEach((d) => changedSpecFields.add(d.field));
          }
        }
      }

      if (specsChanged && changedSpecFields.size > 0) {
        await enforceFieldPermissions(
          'QCSpecifications',
          Array.from(changedSpecFields),
          ctx.user.role
        );
      }
    }

    if (headerDiffs.length === 0 && !specsChanged) {
      return NextResponse.json({ message: 'No changes detected' });
    }

    // Load criteria map for computing Specification
    const criteriaRows = await query<SpecificationCriteria>(
      'SELECT CriteriaID, CriteriaName FROM SpecificationCriteria'
    );
    const criteriaMap = new Map<number, string>();
    for (const c of criteriaRows) {
      criteriaMap.set(c.CriteriaID, c.CriteriaName);
    }

    await withTransaction(async (conn) => {
      // 1. Apply header updates if any
      if (headerDiffs.length > 0) {
        await conn.execute(
          'UPDATE QCMaster SET ImagePath = ?, UpdatedAt = NOW() WHERE QCUID = ?',
          [newHeaderRow.ImagePath, qcUID] as any
        );
        await writeAuditDiffs(conn, 'QCMaster', qcUID, headerDiffs, ctx.user.userId);
      }

      // 2. Specifications update if provided
      if (data.Specifications && specsChanged) {
        // Delete existing specifications and re-insert
        await conn.execute('DELETE FROM QCSpecifications WHERE QCUID = ?', [qcUID]);

        for (let i = 0; i < data.Specifications.length; i++) {
          const spec = data.Specifications[i];
          const srNo = i + 1;
          const criteriaName = criteriaMap.get(spec.CriteriaID) || '';
          const computedSpec = computeSpecification(
            criteriaName,
            spec.MinVal,
            spec.MaxVal,
            spec.OtherValue
          );

          await conn.execute(
            `INSERT INTO QCSpecifications (
              QCUID, SrNo, Parameter, CriteriaID, MinVal, MaxVal, OtherValue,
              MethodID, FrequencyID, ResponsibilityID, ReactionPlanID,
              Specification, CreatedAt, UpdatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              qcUID,
              srNo,
              spec.Parameter,
              spec.CriteriaID,
              spec.MinVal ?? null,
              spec.MaxVal ?? null,
              spec.OtherValue ?? null,
              spec.MethodID,
              spec.FrequencyID,
              spec.ResponsibilityID,
              spec.ReactionPlanID,
              computedSpec,
            ]
          );
        }

        // Record audit entry for specs update
        await writeAuditLog(conn, [
          {
            tableName: 'QCSpecifications',
            recordId: qcUID,
            actionType: 'UPDATE',
            fieldName: 'Specifications',
            oldValue: 'Previous specifications',
            newValue: `${data.Specifications.length} specification rows`,
            changedByUserID: ctx.user.userId,
          },
        ]);
      }
    });

    await syncQCMasterToSheet(qcUID);

    const sheetAuditEntries: SheetAuditEntry[] = headerDiffs.map((d) => ({
      tableName: 'QCMaster',
      recordId: qcUID,
      actionType: 'UPDATE',
      fieldName: d.field,
      oldValue: d.oldValue,
      newValue: d.newValue,
      changedByUserID: ctx.user.userId,
    }));

    if (data.Specifications && specsChanged) {
      sheetAuditEntries.push({
        tableName: 'QCSpecifications',
        recordId: qcUID,
        actionType: 'UPDATE',
        fieldName: 'Specifications',
        oldValue: 'Previous specifications',
        newValue: `${data.Specifications.length} specification rows`,
        changedByUserID: ctx.user.userId,
      });
    }

    await appendAuditLogToSheet(sheetAuditEntries);

    return NextResponse.json({ message: 'QC Master updated successfully' });
  } catch (error) {
    return errorResponse(error);
  }
});
