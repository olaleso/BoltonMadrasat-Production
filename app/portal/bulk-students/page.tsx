"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  UserRoundPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";

import "./bulk-students.css";

type Mode =
  | "standard_students"
  | "legacy_students"
  | "guardian_updates";

type PreviewRow = {
  rowNumber: number;
  status: "valid" | "warning" | "error";
  action: "create" | "link" | "update" | "skip";
  studentNumber: string;
  studentName: string;
  className: string;
  messages: string[];
  normalized: Record<string, unknown>;
};

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    total: number;
    valid: number;
    warning: number;
    error: number;
    create: number;
    link: number;
    skip: number;
  };
  rows?: PreviewRow[];
  result?: Record<string, unknown>;
};

type MissingGuardian = {
  id?: string;
  student_number?: string;
  student_name?: string;
  gender?: string;
  class_name?: string;
};

type Metadata = {
  missingGuardianCount: number;
  missingGuardians: MissingGuardian[];
};

type SuccessMetricTone = "success" | "warning" | "danger" | "neutral";

type SuccessMetric = {
  label: string;
  value: number;
  tone: SuccessMetricTone;
};

type SuccessSummary = {
  title: string;
  description: string;
  primaryCount: number;
  primaryLabel: string;
  metrics: SuccessMetric[];
  nextSteps: string[];
};

const config: Record<
  Mode,
  {
    label: string;
    description: string;
    sheetName: string;
    template: string;
    templateLabel: string;
  }
> = {
  standard_students: {
    label: "Standard students",
    description:
      "Use when student and parent/guardian details are already available.",
    sheetName: "Students",
    template:
      "/templates/BNMC-Standard-Student-Import-Template.xlsx",
    templateLabel: "Download standard template",
  },
  legacy_students: {
    label: "Legacy students",
    description:
      "Import older BNMC student records even when guardian details have not yet been collected.",
    sheetName: "Students",
    template:
      "/templates/BNMC-Legacy-Student-Import-Template.xlsx",
    templateLabel: "Download legacy template",
  },
  guardian_updates: {
    label: "Guardian updates",
    description:
      "Add parent/guardian details later by matching each row to an existing student registration number.",
    sheetName: "Guardians",
    template:
      "/templates/BNMC-Guardian-Update-Template.xlsx",
    templateLabel: "Download guardian template",
  },
};

function statusLabel(value: PreviewRow["status"]) {
  if (value === "valid") return "Ready";
  if (value === "warning") return "Review";
  return "Error";
}

function actionLabel(value: PreviewRow["action"]) {
  if (value === "create") return "Create student";
  if (value === "link") return "Add guardian";
  if (value === "update") return "Update guardian";
  return "Skip";
}

function isBlankRow(row: Record<string, unknown>) {
  return Object.values(row).every(
    (value) => String(value ?? "").trim() === "",
  );
}

function buildSuccessSummary(
  currentMode: Mode,
  result: Record<string, unknown> | undefined,
  currentSummary: PreviewResponse["summary"],
): SuccessSummary {
  if (currentMode === "guardian_updates") {
    const linked = Number(result?.linked ?? 0);
    const updated = Number(result?.updated ?? 0);
    const skipped = Number(result?.skipped ?? 0);
    const failed = Number(result?.failed ?? 0);

    return {
      title: "Guardian update completed",
      description:
        "The selected guardian rows have been processed. Existing student profiles have now been updated where matching records were found.",
      primaryCount: linked + updated,
      primaryLabel: "Guardian records processed",
      metrics: [
        { label: "Linked", value: linked, tone: "success" },
        { label: "Updated", value: updated, tone: "success" },
        { label: "Skipped", value: skipped, tone: "warning" },
        { label: "Failed", value: failed, tone: "danger" },
      ],
      nextSteps: [
        "Refresh the page to confirm the remaining students who still need guardian details.",
        "If any rows were skipped or failed, review the spreadsheet and retry only those rows.",
      ],
    };
  }

  const created = Number(result?.created ?? 0);
  const skipped = Number(result?.skipped ?? 0);
  const failed = Number(result?.failed ?? 0);
  const followUp = Number(currentSummary?.warning ?? 0);

  return {
    title:
      currentMode === "legacy_students"
        ? "Legacy student import completed"
        : "Student import completed",
    description:
      currentMode === "legacy_students"
        ? "Legacy student records were created successfully. Any fields flagged during preview can be completed later from the portal."
        : "The selected student rows have been processed and new student records have been created where appropriate.",
    primaryCount: created,
    primaryLabel: "Students created",
    metrics: [
      { label: "Created", value: created, tone: "success" },
      { label: "Needs follow-up", value: followUp, tone: "warning" },
      { label: "Skipped", value: skipped, tone: "neutral" },
      { label: "Failed", value: failed, tone: "danger" },
    ],
    nextSteps:
      currentMode === "legacy_students"
        ? [
            "Use the Guardian Update template later to add parent or guardian details for legacy students.",
            "Open any student profile to complete missing items such as surname or date of birth where needed.",
          ]
        : [
            "Review any skipped or failed rows and re-import only those rows if needed.",
            "Open the Students section to confirm the newly created records and assigned classes.",
          ],
  };
}

export default function BulkStudentsPage() {
  const [mode, setMode] = useState<Mode>("legacy_students");
  const [metadata, setMetadata] = useState<Metadata>({
    missingGuardianCount: 0,
    missingGuardians: [],
  });
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewResponse["summary"]>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);

  async function loadMetadata() {
    setMetadataLoading(true);
    try {
      const response = await fetch("/api/v1/bulk-students", {
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      if (response.status === 403) {
        window.location.assign("/portal");
        return;
      }

      const result = (await response.json()) as {
        error?: string;
        missingGuardianCount?: number;
        missingGuardians?: MissingGuardian[];
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load bulk import information.");
      }

      setMetadata({
        missingGuardianCount: Number(result.missingGuardianCount ?? 0),
        missingGuardians: result.missingGuardians ?? [],
      });
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load bulk import information.",
      );
    } finally {
      setMetadataLoading(false);
    }
  }

  useEffect(() => {
    const requested =
      new URLSearchParams(
        window.location.search,
      ).get("mode") as Mode | null;

    if (
      requested &&
      Object.prototype.hasOwnProperty.call(
        config,
        requested,
      )
    ) {
      setMode(requested);
    }

    loadMetadata();
  }, []);

  useEffect(() => {
    if (!showConfirmModal && !showSuccessModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      if (showSuccessModal) {
        setShowSuccessModal(false);
        return;
      }
      if (showConfirmModal) {
        setShowConfirmModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showConfirmModal, showSuccessModal, busy]);

  function resetImport(nextMode?: Mode) {
    if (nextMode) setMode(nextMode);
    setFileName("");
    setRawRows([]);
    setPreviewRows([]);
    setSummary(undefined);
    setMessage("");
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setSuccessSummary(null);
  }

  async function readFile(file: File) {
    setMessage("");
    setPreviewRows([]);
    setSummary(undefined);
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setSuccessSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const preferred = config[mode].sheetName;
      const sheetName = workbook.SheetNames.find(
        (name) => name.toLowerCase() === preferred.toLowerCase(),
      ) ?? workbook.SheetNames.find(
        (name) => name.toLowerCase() !== "instructions",
      );

      if (!sheetName) {
        throw new Error(`The workbook does not contain a ${preferred} sheet.`);
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd",
      }).filter((row) => !isBlankRow(row));

      if (!rows.length) {
        throw new Error("The spreadsheet does not contain any data rows.");
      }

      setFileName(file.name);
      setRawRows(rows);
      setMessageType("info");
      setMessage(`${rows.length} spreadsheet row${rows.length === 1 ? "" : "s"} loaded. Select Preview import to validate them.`);
    } catch (error) {
      setFileName("");
      setRawRows([]);
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to read this spreadsheet.",
      );
    }
  }

  async function previewImport() {
    if (!rawRows.length) return;

    setBusy(true);
    setMessage("");
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setSuccessSummary(null);

    try {
      const response = await fetch("/api/v1/bulk-students", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode,
          action: "preview",
          rows: rawRows,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as PreviewResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to validate this import.");
      }

      setPreviewRows(result.rows ?? []);
      setSummary(result.summary);
      setMessageType((result.summary?.error ?? 0) > 0 ? "error" : "success");
      setMessage(
        (result.summary?.error ?? 0) > 0
          ? "Preview complete. Correct the rows marked Error before importing."
          : "Preview complete. Review any warnings, then import when ready.",
      );
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to validate this import.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runCommitImport() {
    if (!rawRows.length || (summary?.error ?? 0) > 0) return;

    const summarySnapshot = summary;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/v1/bulk-students", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode,
          action: "commit",
          rows: rawRows,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as PreviewResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to complete this import.");
      }

      setShowConfirmModal(false);
      setSuccessSummary(buildSuccessSummary(mode, result.result, summarySnapshot));
      setShowSuccessModal(true);
      setRawRows([]);
      setFileName("");
      setPreviewRows([]);
      setSummary(undefined);
      await loadMetadata();
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete this import.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openCommitConfirm() {
    if (!rawRows.length || (summary?.error ?? 0) > 0 || !summary || busy) return;
    setShowConfirmModal(true);
  }

  function downloadProblemRows() {
    const problems = previewRows.filter(
      (row) => row.status === "error" || row.status === "warning",
    );

    if (!problems.length) return;

    const exportRows = problems.map((row) => ({
      "Spreadsheet row": row.rowNumber,
      "Student number": row.studentNumber,
      Student: row.studentName,
      Class: row.className,
      Status: statusLabel(row.status),
      Action: actionLabel(row.action),
      Details: row.messages.join(" | "),
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Review");
    XLSX.writeFile(workbook, "BNMC-bulk-import-review.xlsx");
  }

  const canCommit = Boolean(
    summary &&
      summary.total > 0 &&
      summary.error === 0 &&
      !busy,
  );

  const previewTitle = useMemo(() => {
    if (mode === "guardian_updates") return "Guardian update preview";
    if (mode === "legacy_students") return "Legacy student preview";
    return "Standard student preview";
  }, [mode]);

  const commitTitle = mode === "guardian_updates"
    ? "Confirm guardian update"
    : "Confirm student import";

  const commitButtonLabel = mode === "guardian_updates"
    ? "Apply guardian updates"
    : "Import selected students";

  const reviewMeaningLabel = mode === "guardian_updates"
    ? "Review rows will be processed, but you may still want to double-check the warning notes afterwards."
    : "Review rows will still be imported, but some student details may need to be completed later from the portal.";

  return (
    <main className="bulk-page">
      <header className="bulk-topbar">
        <button
          type="button"
          className="bulk-back"
          onClick={() => window.location.assign("/portal")}
        >
          <ArrowLeft />
          Back to portal
        </button>

        <div>
          <strong>BNMC Madrasah</strong>
          <span>Bulk student administration</span>
        </div>
      </header>

      <section className="bulk-shell">
        <div className="bulk-heading">
          <div>
            <small>STUDENTS</small>
            <h1>Bulk register & guardian updates</h1>
            <p>
              Import historical records safely without inventing parent details, then add guardian information later when BNMC receives it.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadMetadata}
            disabled={metadataLoading}
          >
            <RefreshCw />
            Refresh
          </button>
        </div>

        <div className="bulk-metrics">
          <article>
            <Users />
            <div>
              <strong>{metadataLoading ? "…" : metadata.missingGuardianCount}</strong>
              <span>students need guardian details</span>
            </div>
          </article>

          <article>
            <FileSpreadsheet />
            <div>
              <strong>3</strong>
              <span>safe import workflows</span>
            </div>
          </article>

          <article>
            <CheckCircle2 />
            <div>
              <strong>Preview first</strong>
              <span>nothing is imported before validation</span>
            </div>
          </article>
        </div>

        <nav className="bulk-tabs" aria-label="Bulk import type">
          {(Object.keys(config) as Mode[]).map((item) => (
            <button
              type="button"
              key={item}
              className={item === mode ? "active" : ""}
              onClick={() => resetImport(item)}
            >
              {item === "guardian_updates" ? <UserRoundPlus /> : <Users />}
              <span>
                <b>{config[item].label}</b>
                <small>{config[item].description}</small>
              </span>
            </button>
          ))}
        </nav>

        <section className="bulk-card import-card">
          <div className="import-intro">
            <div>
              <h2>{config[mode].label}</h2>
              <p>{config[mode].description}</p>
            </div>

            <a
              className="template-link"
              href={config[mode].template}
              download
            >
              <Download />
              {config[mode].templateLabel}
            </a>
          </div>

          {mode === "legacy_students" && (
            <div className="bulk-info">
              <AlertTriangle />
              <div>
                <strong>Guardian details are not required for this import.</strong>
                <p>
                  Students are created and enrolled in the correct class. Their profile is marked as requiring guardian information until it is supplied later.
                </p>
              </div>
            </div>
          )}

          {mode === "guardian_updates" && (
            <div className="bulk-info guardian-info">
              <UserRoundPlus />
              <div>
                <strong>Student number is the matching key.</strong>
                <p>
                  The importer updates the existing student relationship only. It will not create another copy of the student.
                </p>
              </div>
            </div>
          )}

          <label className="upload-zone">
            <Upload />
            <div>
              <strong>{fileName || "Choose an Excel workbook"}</strong>
              <span>.xlsx or .xls • maximum 1,000 rows per import</span>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <div className="import-actions">
            <button
              type="button"
              className="primary-button"
              onClick={previewImport}
              disabled={!rawRows.length || busy}
            >
              <FileSpreadsheet />
              {busy ? "Checking…" : "Preview import"}
            </button>

            {previewRows.length > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={downloadProblemRows}
                disabled={!previewRows.some((row) => row.status !== "valid")}
              >
                <Download />
                Download review rows
              </button>
            )}

            {summary && (
              <button
                type="button"
                className="primary-button success-button"
                onClick={openCommitConfirm}
                disabled={!canCommit}
              >
                <CheckCircle2 />
                {mode === "guardian_updates" ? "Apply guardian updates" : "Import students"}
              </button>
            )}
          </div>

          {message && (
            <div className={`bulk-message ${messageType}`} role="status">
              {messageType === "success" ? <CheckCircle2 /> : messageType === "error" ? <XCircle /> : <AlertTriangle />}
              <span>{message}</span>
            </div>
          )}
        </section>

        {summary && (
          <section className="preview-section">
            <div className="preview-head">
              <div>
                <h2>{previewTitle}</h2>
                <p>Rows marked Error must be corrected. Review rows may be imported after checking the warning.</p>
              </div>
            </div>

            <div className="preview-metrics">
              <span><b>{summary.total}</b>Total rows</span>
              <span className="good"><b>{summary.valid}</b>Ready</span>
              <span className="warn"><b>{summary.warning}</b>Review</span>
              <span className="bad"><b>{summary.error}</b>Errors</span>
              <span><b>{summary.skip}</b>Skipped</span>
            </div>

            <div className="preview-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Student</th>
                    <th>Reg. no.</th>
                    {mode !== "guardian_updates" && <th>Class</th>}
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.studentNumber}`}>
                      <td>{row.rowNumber}</td>
                      <td>
                        <span className={`preview-status ${row.status}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.studentName || "—"}</td>
                      <td>{row.studentNumber || "—"}</td>
                      {mode !== "guardian_updates" && <td>{row.className || "—"}</td>}
                      <td>{actionLabel(row.action)}</td>
                      <td className="preview-details">
                        {row.messages.length
                          ? row.messages.map((item, index) => <p key={index}>{item}</p>)
                          : "Ready to process."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {mode === "guardian_updates" && metadata.missingGuardians.length > 0 && (
          <section className="bulk-card missing-card">
            <div className="import-intro">
              <div>
                <h2>Students awaiting guardian details</h2>
                <p>
                  Use these registration numbers in the Guardian Update template. This list disappears automatically as guardian records are linked.
                </p>
              </div>
            </div>

            <div className="preview-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Registration number</th>
                    <th>Student</th>
                    <th>Gender</th>
                    <th>Current class</th>
                  </tr>
                </thead>
                <tbody>
                  {metadata.missingGuardians.map((row) => (
                    <tr key={String(row.id ?? row.student_number)}>
                      <td><b>{row.student_number ?? "—"}</b></td>
                      <td>{row.student_name ?? "—"}</td>
                      <td>{row.gender ?? "—"}</td>
                      <td>{row.class_name ?? "No active class"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      {showConfirmModal && summary && (
        <div
          className="bulk-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!busy) setShowConfirmModal(false);
          }}
        >
          <div
            className="bulk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bulk-modal-header">
              <div>
                <span className="bulk-modal-kicker">BULK IMPORT</span>
                <h3 id="bulk-confirm-title">{commitTitle}</h3>
                <p>
                  You are about to process the reviewed rows in this workbook.
                </p>
              </div>

              <button
                type="button"
                className="bulk-modal-close"
                aria-label="Close confirmation"
                onClick={() => setShowConfirmModal(false)}
                disabled={busy}
              >
                <X />
              </button>
            </div>

            <div className="bulk-modal-body">
              <div className="bulk-modal-summary-grid">
                <article>
                  <strong>{summary.valid}</strong>
                  <span>Ready</span>
                </article>
                <article>
                  <strong>{summary.warning}</strong>
                  <span>Review</span>
                </article>
                <article>
                  <strong>{summary.skip}</strong>
                  <span>Skip</span>
                </article>
              </div>

              <div className="bulk-modal-list">
                <div className="bulk-modal-list-item">
                  <CheckCircle2 />
                  <div>
                    <strong>Ready rows</strong>
                    <p>These rows will be processed immediately.</p>
                  </div>
                </div>

                <div className="bulk-modal-list-item warning">
                  <AlertTriangle />
                  <div>
                    <strong>Review rows</strong>
                    <p>{reviewMeaningLabel}</p>
                  </div>
                </div>

                <div className="bulk-modal-list-item muted">
                  <XCircle />
                  <div>
                    <strong>Skip rows</strong>
                    <p>These rows will not be imported in this run.</p>
                  </div>
                </div>
              </div>

              <div className="bulk-modal-note">
                <strong>Import summary</strong>
                <p>
                  {summary.total} total row{summary.total === 1 ? "" : "s"} reviewed. Please confirm that you want to continue.
                </p>
              </div>
            </div>

            <div className="bulk-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowConfirmModal(false)}
                disabled={busy}
              >
                Go back and review
              </button>

              <button
                type="button"
                className="primary-button success-button"
                onClick={runCommitImport}
                disabled={busy}
              >
                <CheckCircle2 />
                {busy ? "Processing…" : commitButtonLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && successSummary && (
        <div
          className="bulk-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!busy) setShowSuccessModal(false);
          }}
        >
          <div
            className="bulk-modal success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-success-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bulk-modal-header success-header">
              <div className="success-header-copy">
                <span className="bulk-modal-kicker success-kicker">IMPORT COMPLETED</span>
                <h3 id="bulk-success-title">{successSummary.title}</h3>
                <p>{successSummary.description}</p>
              </div>

              <button
                type="button"
                className="bulk-modal-close"
                aria-label="Close success summary"
                onClick={() => setShowSuccessModal(false)}
                disabled={busy}
              >
                <X />
              </button>
            </div>

            <div className="bulk-modal-body success-body">
              <section className="success-hero-card">
                <div className="success-hero-icon">
                  <CheckCircle2 />
                </div>
                <div className="success-hero-copy">
                  <strong>{successSummary.primaryCount}</strong>
                  <span>{successSummary.primaryLabel}</span>
                </div>
              </section>

              <section className="success-metrics-grid">
                {successSummary.metrics.map((metric) => (
                  <article key={metric.label} className={`tone-${metric.tone}`}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </article>
                ))}
              </section>

              <section className="bulk-modal-note success-note">
                <strong>Recommended next steps</strong>
                <ul className="success-next-steps">
                  {successSummary.nextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="bulk-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessSummary(null);
                }}
                disabled={busy}
              >
                Close summary
              </button>

              <button
                type="button"
                className="primary-button success-button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessSummary(null);
                  resetImport(mode);
                }}
                disabled={busy}
              >
                Import another file
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
