// ============================================================================
// GET /api/field-permissions
// Returns field permissions grouped by module for client-side disabled state checks.
// Accessible by all authenticated users.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { getAllFieldPermissions } from '@/lib/field-permissions';
import { errorResponse } from '@/lib/errors';
import type { FieldPermissionsResponse } from '@/types/api';

export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const rows = await getAllFieldPermissions();

    const result: FieldPermissionsResponse = {
      Items: {},
      QCMaster: {},
      QCSpecifications: {},
      InspectionReports: {},
      InspectionResults: {},
    };

    for (const row of rows) {
      if (!result[row.ModuleName]) {
        result[row.ModuleName] = {};
      }
      result[row.ModuleName][row.FieldName] = row.MinimumRole;
    }

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
});
