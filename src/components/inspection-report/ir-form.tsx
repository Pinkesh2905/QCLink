'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSection } from '@/components/shared/form-section';
import { ItemCombobox } from '@/components/shared/item-combobox';
import { FileUpload } from '@/components/shared/file-upload';
import { HistoryModal } from '@/components/shared/history-modal';
import { ResultGrid } from './result-grid';
import { useLookup } from '@/hooks/use-lookup';
import { useSession } from '@/hooks/use-session';
import { useFieldPermissions } from '@/hooks/use-field-permissions';
import {
  createInspectionReportSchema,
  updateInspectionReportSchema,
  reviewReportSchema,
  REVIEW_STATUSES,
  type InspectionResultInputSchema,
} from '@/validators/inspection-report';
import { Loader2, History, ArrowLeft, Save, Printer, FileDown, Mail, Lock, ShieldCheck } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/datetime';
import type { InspectionReportDetailResponse, QCMasterDetailResponse } from '@/types/api';
import type { QCMasterWithLookups } from '@/types/db';

interface ReviewerOption {
  EmployeeUID: string;
  EmployeeName: string;
  Email: string;
  IsActive: number;
}

function reviewBadgeClass(status: string | null | undefined): string {
  if (status === 'Review Done') return 'bg-emerald-50 text-emerald-700 border-emerald-300';
  if (status === 'Review Rejected') return 'bg-red-50 text-red-700 border-red-300';
  return 'bg-amber-50 text-amber-700 border-amber-300';
}

interface IRFormProps {
  initialData?: InspectionReportDetailResponse;
  isEdit?: boolean;
}

export function IRForm({ initialData, isEdit = false }: IRFormProps) {
  const router = useRouter();
  const { user } = useSession();
  const { isFieldDisabled } = useFieldPermissions();
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Lookups
  const { options: resultStatuses } = useLookup('result-status');
  const { options: criteriaList } = useLookup('specification-criteria', true);

  // Form State
  const defaultDate = initialData?.InspectionDate
    ? new Date(initialData.InspectionDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const [inspectionDate, setInspectionDate] = useState(defaultDate);
  const [itemUID, setItemUID] = useState(initialData?.ItemUID || '');
  const [itemName, setItemName] = useState(initialData?.ItemName || '');
  const [qcUID, setQCUID] = useState(initialData?.QCUID || '');
  const [grnNo, setGrnNo] = useState(initialData?.GRNNo || '');
  const [invoicePath, setInvoicePath] = useState<string | null>(initialData?.InvoicePath || null);
  const [inspectionStatusID, setInspectionStatusID] = useState(
    initialData?.InspectionStatusID ? String(initialData.InspectionStatusID) : ''
  );
  const [inspectionRemark, setInspectionRemark] = useState(initialData?.InspectionRemark || '');
  const [reviewerUID, setReviewerUID] = useState(initialData?.ReviewerEmployeeUID || '');

  // Reviewer choices come from the Employee Master (active people only; the saved reviewer is always listed)
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [reviewersLoading, setReviewersLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/employees?active=true&pageSize=200&sortBy=EmployeeName&sortOrder=asc');
        if (res.ok && !cancelled) {
          const json = await res.json();
          setReviewers(json.data);
        }
      } catch {
        // the select stays empty; creating a report will say a reviewer is required
      } finally {
        if (!cancelled) setReviewersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Review state (edit mode): the status badge is for everyone, the controls only for the reviewer
  const isReviewer = !!initialData?.IsReviewer;
  const [reviewStatus, setReviewStatus] = useState<string>(initialData?.ReviewStatus || 'Review Pending');
  const [reviewerRemark, setReviewerRemark] = useState(initialData?.ReviewerRemark || '');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const savedReviewStatus = initialData?.ReviewStatus ?? null;
  // A reviewed ("Done") report is locked until the reviewer reopens it
  const locked = isEdit && savedReviewStatus === 'Review Done';

  // Available QC templates for selected item
  const [availableQCs, setAvailableQCs] = useState<QCMasterWithLookups[]>([]);
  const [loadingQCs, setLoadingQCs] = useState(false);

  // Results state
  const initialResults: InspectionResultInputSchema[] = initialData?.Results?.map((r) => ({
    SrNo: r.SrNo,
    Parameter: r.Parameter,
    CriteriaID: r.CriteriaID,
    MinVal: r.MinVal,
    MaxVal: r.MaxVal,
    OtherValue: r.OtherValue,
    MethodID: r.MethodID,
    FrequencyID: r.FrequencyID,
    ResponsibilityID: r.ResponsibilityID,
    ReactionPlanID: r.ReactionPlanID,
    Specification: r.Specification,
    Actual: r.Actual,
    ResultStatusID: r.ResultStatusID,
    ObservedRemark: r.ObservedRemark ?? null,
  })) || [];

  const [results, setResults] = useState<InspectionResultInputSchema[]>(initialResults);

  // Guards against out-of-order async responses: bumped on every itemUID
  // change and every QC selection, so a slow response from a superseded
  // request can be detected and dropped instead of overwriting state set by
  // a later request (e.g. user picks Item A, then Item B before A's QC
  // template lookup resolves — without this, A's QC/specs could land after
  // B's and get saved as B's item with A's QC template attached).
  const requestIdRef = useRef(0);

  // When itemUID changes in create mode, fetch available QC templates for this item
  useEffect(() => {
    if (!itemUID || isEdit) return;

    const requestId = ++requestIdRef.current;

    const fetchQCTemplates = async () => {
      setLoadingQCs(true);
      try {
        const res = await fetch(`/api/qc-master?itemUID=${encodeURIComponent(itemUID)}&pageSize=50`);
        if (requestIdRef.current !== requestId) return; // superseded by a newer item selection
        if (res.ok) {
          const json = await res.json();
          if (requestIdRef.current !== requestId) return;
          setAvailableQCs(json.data);
          // If only 1 template available, auto-select it
          if (json.data.length === 1) {
            handleQCSelect(json.data[0].QCUID, requestId);
          }
        }
      } catch {
        // Ignore
      } finally {
        if (requestIdRef.current === requestId) setLoadingQCs(false);
      }
    };

    fetchQCTemplates();
  }, [itemUID, isEdit]);

  // When a QC template is selected in create mode, snapshot its specs into results.
  // `requestId` is passed only by the auto-select effect above; a manual user
  // selection (onValueChange) omits it and mints its own, which also
  // invalidates any still-in-flight auto-select for the same item.
  const handleQCSelect = async (selectedQCUID: string, requestId?: number) => {
    const myRequestId = requestId ?? ++requestIdRef.current;

    setQCUID(selectedQCUID);
    if (!selectedQCUID) {
      setResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/qc-master/${encodeURIComponent(selectedQCUID)}`);
      if (requestIdRef.current !== myRequestId) return; // superseded
      if (res.ok) {
        const qcDetail: QCMasterDetailResponse = await res.json();
        if (requestIdRef.current !== myRequestId) return; // superseded
        // Snapshot copy: SrNo, Parameter, CriteriaID, MinVal, MaxVal, OtherValue, MethodID, FrequencyID, ResponsibilityID, ReactionPlanID, Specification
        const snapshotResults: InspectionResultInputSchema[] = qcDetail.Specifications.map((s) => ({
          SrNo: Number(s.SrNo),
          Parameter: s.Parameter,
          CriteriaID: Number(s.CriteriaID),
          MinVal: s.MinVal != null ? Number(s.MinVal) : null,
          MaxVal: s.MaxVal != null ? Number(s.MaxVal) : null,
          OtherValue: s.OtherValue,
          MethodID: Number(s.MethodID),
          FrequencyID: Number(s.FrequencyID),
          ResponsibilityID: Number(s.ResponsibilityID),
          ReactionPlanID: Number(s.ReactionPlanID),
          Specification: s.Specification,
          Actual: null,
          ResultStatusID: null,
          ObservedRemark: null,
        }));

        setResults(snapshotResults);
        toast.info(`Snapshotted ${snapshotResults.length} specification rows from ${selectedQCUID}`);
      }
    } catch {
      if (requestIdRef.current === myRequestId) {
        toast.error('Failed to load QC specifications for snapshot');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneralError(null);

    if (!itemUID || !itemName) {
      const err = 'Please select an item for inspection';
      setGeneralError(err);
      toast.error(err);
      setLoading(false);
      return;
    }

    if (!qcUID) {
      const err = 'Please select an Incoming Inspection Specification template';
      setGeneralError(err);
      toast.error(err);
      setLoading(false);
      return;
    }

    if (!grnNo.trim()) {
      const err = 'GRN No is required';
      setGeneralError(err);
      toast.error(err);
      setLoading(false);
      return;
    }

    if (!isEdit && !reviewerUID) {
      const err = 'Please select the reviewer who should review this report';
      setGeneralError(err);
      toast.error(err);
      setLoading(false);
      return;
    }

    if (!inspectionStatusID) {
      const err = 'Overall Inspection Status is required';
      setGeneralError(err);
      toast.error(err);
      setLoading(false);
      return;
    }

    if (results.length === 0) {
      const err = 'At least one specification test result is required';
      setGeneralError(err);
      toast.error(err);
      setLoading(false);
      return;
    }

    const payload = {
      InspectionDate: inspectionDate,
      ItemUID: itemUID,
      ItemName: itemName,
      QCUID: qcUID,
      GRNNo: grnNo.trim(),
      InvoicePath: invoicePath,
      InspectionRemark: inspectionRemark,
      ...(reviewerUID ? { ReviewerEmployeeUID: reviewerUID } : {}),
      InspectionStatusID: Number(inspectionStatusID),
      Results: results.map((r) => ({
        ...r,
        SrNo: Number(r.SrNo),
        CriteriaID: Number(r.CriteriaID),
        MinVal: r.MinVal != null ? Number(r.MinVal) : null,
        MaxVal: r.MaxVal != null ? Number(r.MaxVal) : null,
        MethodID: Number(r.MethodID),
        FrequencyID: Number(r.FrequencyID),
        ResponsibilityID: Number(r.ResponsibilityID),
        ReactionPlanID: Number(r.ReactionPlanID),
        Actual: r.Actual != null ? Number(r.Actual) : null,
        ResultStatusID: r.ResultStatusID ? Number(r.ResultStatusID) : null,
        ObservedRemark: r.ObservedRemark ?? null,
      })),
    };

    const schema = isEdit ? updateInspectionReportSchema : createInspectionReportSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const fieldPath = firstIssue?.path?.map(String).join('.') || 'Form';
      const msg = `${fieldPath}: ${firstIssue?.message || 'Validation failed'}`;
      setGeneralError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/inspection-reports/${initialData?.IIRUID}` : '/api/inspection-reports';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json();

      if (!res.ok) {
        const err = json.error || 'Failed to save Inspection Report';
        setGeneralError(err);
        toast.error(err);
        return;
      }

      toast.success(
        isEdit
          ? json.message || 'Inspection Report updated successfully'
          : 'Inspection Report recorded — the reviewer is being emailed'
      );
      router.push('/app/inspection-report');
      router.refresh();
    } catch {
      const err = 'A network error occurred. Please try again.';
      setGeneralError(err);
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!initialData) return;
    setReviewError(null);
    const parsed = reviewReportSchema.safeParse({ ReviewStatus: reviewStatus, ReviewerRemark: reviewerRemark });
    if (!parsed.success) {
      setReviewError(parsed.error.issues[0]?.message || 'Please check the review');
      return;
    }
    setReviewSaving(true);
    try {
      const res = await fetch(`/api/inspection-reports/${initialData.IIRUID}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) {
        setReviewError(json.error || 'Failed to save the review');
        return;
      }
      toast.success(json.message || 'Review saved');
      router.refresh();
    } catch {
      setReviewError('A network error occurred. Please try again.');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleResendReview = async () => {
    if (!initialData) return;
    setResending(true);
    try {
      const res = await fetch(`/api/inspection-reports/${initialData.IIRUID}/resend-review`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not resend the email');
        return;
      }
      toast.success(json.message || 'Review request emailed');
      router.refresh();
    } catch {
      toast.error('A network error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/app/inspection-report')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
              {isEdit ? `Report: ${initialData?.IIRUID}` : 'New Incoming Inspection Report'}
              {isEdit && savedReviewStatus && (
                <Badge variant="outline" className={reviewBadgeClass(savedReviewStatus)}>
                  {savedReviewStatus}
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Record testing results and disposition' : 'Perform incoming inspection against QC specifications'}
            </p>
          </div>
        </div>

        {isEdit && initialData && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`/print/inspection-report/${initialData.IIRUID}`, '_blank')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/api/inspection-reports/${initialData.IIRUID}/pdf`, '_blank')}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          </div>
        )}
      </div>

      {generalError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {generalError}
        </div>
      )}

      {locked && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This report has been reviewed and is locked. {isReviewer
              ? 'Set the review back to Pending below if it needs to be changed.'
              : 'Ask the reviewer to reopen the review if it needs a change.'}
          </span>
        </div>
      )}

      {isEdit && savedReviewStatus === 'Review Rejected' && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <span>
            The reviewer rejected this report. Saving a change sends it back to the reviewer for a new review.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 rounded-lg border bg-card p-4 sm:p-6 shadow-sm min-w-0 max-w-full">
        {/* System Locked Fields (edit mode) */}
        {isEdit && initialData && (
          <FormSection
            title="System Information"
            description="System-managed identifiers and ownership information (read-only)"
          >
            <div className="space-y-2">
              <Label className="text-muted-foreground">Report UID</Label>
              <Input value={initialData.IIRUID} disabled className="bg-muted text-muted-foreground font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Submission ID</Label>
              <Input value={initialData.SubmissionID || '—'} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Owner</Label>
              <Input value={initialData.OwnerName || `User #${initialData.OwnerUserID}`} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Created At</Label>
              <Input
                value={formatDateTimeIST(initialData.CreatedAt, { second: '2-digit' })}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Updated At</Label>
              <Input
                value={formatDateTimeIST(initialData.UpdatedAt, { second: '2-digit' })}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          </FormSection>
        )}

        {/* Inspection Header */}
        <FormSection
          title="Inspection Information"
          description="Consignment identification, GRN and reference QC specification details"
        >
          <div className="space-y-2">
            <Label htmlFor="InspectionDate">
              Inspection Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="InspectionDate"
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              required
              disabled={locked || isFieldDisabled('InspectionReports', 'InspectionDate', isEdit, user?.Role)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="item-select">
              Select Item <span className="text-destructive">*</span>
            </Label>
            <ItemCombobox
              value={itemUID}
              onSelect={(selected) => {
                setItemUID(selected.ItemUID);
                setItemName(selected.ItemName);
                setQCUID('');
                setResults([]);
              }}
              disabled={isEdit}
              placeholder="Search and select an item..."
            />
          </div>

          <div className="space-y-2">
            <Label>Item UID</Label>
            <Input value={itemUID || '—'} disabled className="bg-muted font-mono" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="qc-select">
              Incoming Inspection Specifications <span className="text-destructive">*</span>
            </Label>
            {isEdit ? (
              <Input value={qcUID} disabled className="bg-muted font-mono" />
            ) : (
              <Select
                value={qcUID}
                onValueChange={handleQCSelect}
                disabled={!itemUID || loadingQCs}
              >
                <SelectTrigger id="qc-select">
                  <SelectValue
                    placeholder={
                      !itemUID
                        ? 'Select an item first'
                        : loadingQCs
                        ? 'Loading QC templates...'
                        : availableQCs.length === 0
                        ? 'No QC templates found for this item'
                        : 'Select QC Specification Template'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableQCs.map((qc) => (
                    <SelectItem key={qc.QCUID} value={qc.QCUID}>
                      {qc.QCUID} — {qc.ItemName}{qc.MasterAlias ? ` · ${qc.MasterAlias}` : ''} ({qc.SpecCount || 0} specs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="GRNNo">
              GRN No <span className="text-destructive">*</span>
            </Label>
            <Input
              id="GRNNo"
              value={grnNo}
              onChange={(e) => setGrnNo(e.target.value)}
              placeholder="e.g. GRN-2026-0891"
              required
              disabled={locked || isFieldDisabled('InspectionReports', 'GRNNo', isEdit, user?.Role)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="InspectionStatusID">
              Inspection Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={inspectionStatusID}
              onValueChange={setInspectionStatusID}
              disabled={locked || isFieldDisabled('InspectionReports', 'InspectionStatusID', isEdit, user?.Role)}
            >
              <SelectTrigger id="InspectionStatusID">
                <SelectValue placeholder="Select verdict" />
              </SelectTrigger>
              <SelectContent>
                {resultStatuses.map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ReviewerEmployeeUID">
              Reviewer <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reviewerUID}
              onValueChange={setReviewerUID}
              disabled={reviewersLoading || locked || isFieldDisabled('InspectionReports', 'ReviewerEmployeeUID', isEdit, user?.Role)}
            >
              <SelectTrigger id="ReviewerEmployeeUID">
                <SelectValue
                  placeholder={
                    reviewersLoading
                      ? 'Loading employees...'
                      : reviewers.length === 0
                      ? 'No employees yet — add one in Employee Master'
                      : 'Select who should review this report'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {/* a saved reviewer who is inactive now still shows, so the report keeps displaying them */}
                {initialData?.ReviewerEmployeeUID &&
                  !reviewers.some((r) => r.EmployeeUID === initialData.ReviewerEmployeeUID) && (
                    <SelectItem value={initialData.ReviewerEmployeeUID}>
                      {initialData.ReviewerName} ({initialData.ReviewerEmail}) — inactive
                    </SelectItem>
                  )}
                {reviewers.map((r) => (
                  <SelectItem key={r.EmployeeUID} value={r.EmployeeUID}>
                    {r.EmployeeName} ({r.Email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The reviewer is emailed the report (as a PDF) when it is submitted.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="InspectionRemark">Inspection Remark</Label>
            <Textarea
              id="InspectionRemark"
              value={inspectionRemark}
              onChange={(e) => setInspectionRemark(e.target.value)}
              placeholder="Optional — overall remarks about this inspection"
              rows={3}
              maxLength={2000}
              disabled={locked || isFieldDisabled('InspectionReports', 'InspectionRemark', isEdit, user?.Role)}
            />
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label>Invoice Document (optional)</Label>
            <FileUpload
              value={invoicePath}
              onChange={setInvoicePath}
              uploadType="invoices"
              accept=".pdf,image/*"
              label="Upload Supplier Invoice / Delivery Challan"
              disabled={locked || isFieldDisabled('InspectionReports', 'InvoicePath', isEdit, user?.Role)}
            />
          </div>
        </FormSection>

        {/* Snapshotted Results Grid */}
        <div className="border-t pt-6">
          <ResultGrid
            results={results}
            criteriaList={criteriaList}
            resultStatuses={resultStatuses}
            onChange={setResults}
            disabled={locked}
            isFieldDisabled={isFieldDisabled}
            isEdit={isEdit}
            userRole={user?.Role}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-4 border-t">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/app/inspection-report')}>
            Cancel
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={loading || locked || !!user?.ReadOnly}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Submit Inspection Report'}
          </Button>
        </div>
      </form>

      {isEdit && initialData && savedReviewStatus && (
        <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Review
              </h3>
              <p className="text-xs text-muted-foreground">
                Reviewer: {initialData.ReviewerName} ({initialData.ReviewerEmail})
              </p>
            </div>
            <Badge variant="outline" className={reviewBadgeClass(savedReviewStatus)}>
              {savedReviewStatus}
            </Badge>
          </div>

          {!isReviewer && savedReviewStatus === 'Review Pending' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                {initialData.ReviewEmailSentAt
                  ? `Review request emailed on ${formatDateTimeIST(initialData.ReviewEmailSentAt)}`
                  : 'The review request email has not been sent yet'}
              </span>
              {!user?.ReadOnly && (
                <Button type="button" variant="outline" size="sm" onClick={handleResendReview} disabled={resending}>
                  {resending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-2 h-3.5 w-3.5" />}
                  Resend email
                </Button>
              )}
            </div>
          )}

          {isReviewer && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                You are the reviewer of this report. Only you can see these review controls and your remark.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ReviewStatus">Review Status</Label>
                  <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger id="ReviewStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ReviewerRemark">
                    Reviewer Remark{reviewStatus === 'Review Rejected' && <span className="text-destructive"> *</span>}
                  </Label>
                  <Textarea
                    id="ReviewerRemark"
                    value={reviewerRemark}
                    onChange={(e) => setReviewerRemark(e.target.value)}
                    placeholder={reviewStatus === 'Review Rejected' ? 'Say what needs to be corrected' : 'Optional'}
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>
              {reviewError && (
                <p role="alert" className="text-sm font-medium text-destructive">{reviewError}</p>
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveReview} disabled={reviewSaving || !!user?.ReadOnly}>
                  {reviewSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Review
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {isEdit && initialData && (
        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          tableName="InspectionReports"
          childTables="InspectionResults"
          recordId={initialData.IIRUID}
          title={`History — Inspection Report ${initialData.IIRUID}`}
        />
      )}
    </div>
  );
}
