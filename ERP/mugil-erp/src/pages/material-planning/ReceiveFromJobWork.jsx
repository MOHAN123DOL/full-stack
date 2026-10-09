import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  PackageCheck,
  PackageX,
  Hourglass,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import useFilterOptions from "../../hooks/useFilterOptions";

import "./ReceiveFromJobWork.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const API_BASE = "/erp/material";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const RECEIVE_STATUS_OPTIONS = [
  "Not Received",
  "Partially Received",
  "Fully Received",
  "Rework Pending",
];

/* ============================================================
   HELPERS
   ============================================================ */

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const first = Object.values(data)
      .flat()
      .find((v) => typeof v === "string");
    if (first) return first;
  }
  if (error?.message) return error.message;
  return fallback;
}

function fmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/* ============================================================
   PL NUMBERING — per-kind counters
   ============================================================ */

const PL_PATTERN = /^PL(\d+)(RT)?$/i;

function nextPlNumber(existingStrings, kind = "output") {
  let highest = 0;

  for (const s of existingStrings) {
    if (!s) continue;
    const text = String(s).trim();
    const hasRT = /RT$/i.test(text);

    if (kind === "output" && hasRT) continue;
    if (kind === "remaining" && !hasRT) continue;

    const match = text.match(/^PL(\d+)/i);
    if (!match) continue;

    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n) && n > highest) highest = n;
  }

  return highest + 1;
}

function formatOutputPl(n) {
  return `PL${String(n).padStart(3, "0")}`;
}

function formatRemainingPl(n) {
  return `PL${String(n).padStart(3, "0")}RT`;
}

/* ============================================================
   STATUS HELPERS
   ============================================================ */

function statusOf(job) {
  if (job.reworkPending) return "Rework Pending";
  if (job.previouslyReceived <= 0) return "Not Received";
  if (job.previouslyReceived < job.issuedQty) return "Partially Received";
  return "Fully Received";
}

function statusToneClass(status) {
  switch (status) {
    case "Fully Received":
      return "status-tone-success";
    case "Partially Received":
      return "status-tone-warning";
    case "Rework Pending":
      return "status-tone-danger";
    default:
      return "status-tone-neutral";
  }
}

/* ============================================================
   OUTPUT CONFIG (per process)
   ============================================================ */

const processOutputConfig = {
  CUT01: {
    label: "Cutting Output",
    fields: [
      { key: "pieceNo", label: "Piece No", type: "text" },
      { key: "length", label: "Length", type: "number" },
      { key: "width", label: "Width", type: "number" },
      { key: "qty", label: "Quantity", type: "number" },
      { key: "weight", label: "Weight", type: "number" },
      { key: "remarks", label: "Remarks", type: "text" },
    ],
  },
};

const defaultOutputConfig = {
  label: "Process Output",
  fields: [
    { key: "pieceNo", label: "Piece No", type: "text" },
    { key: "qty", label: "Quantity", type: "number" },
    { key: "weight", label: "Weight", type: "number" },
    { key: "remarks", label: "Remarks", type: "text" },
  ],
};

/* ============================================================
   ROW FACTORIES
   ============================================================ */

let outputRowId = 1;
let remainingRowId = 1;

const newOutputRow = (fields, plNumber) =>
  fields.reduce(
    (row, f) => ({
      ...row,
      [f.key]: f.key === "pieceNo" ? plNumber : "",
    }),
    { rowId: outputRowId++ },
  );

const newRemainingRow = (plNumber) => ({
  rowId: remainingRowId++,
  plateNo: plNumber,
  length: "",
  width: "",
  weight: "",
  remarks: "",
  reworkRequired: "No",
});

const emptyForm = (outputFields) => ({
  completedInputQty: "",
  outputPieces: [newOutputRow(outputFields, formatOutputPl(1))],
  remainingPieces: [],
  receivedBy: "",
  remarks: "",
});

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function ReceiveFromJobWork() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    thickness: "All",
    size: "All",
    poNumber: "All",
    project: "All",
    unit: "All",
    jobWorkType: "All",
    process: "All",
    status: "All",
  });

  const [activeJob, setActiveJob] = useState(null);
  const [form, setForm] = useState(() => emptyForm(defaultOutputConfig.fields));
  const [modalError, setModalError] = useState("");
  const [savingReceive, setSavingReceive] = useState(false);

  const { options: filterOptions, refresh: refreshFilterOptions } =
    useFilterOptions("job-work-receive", { enabled: !!accessToken });

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  /* ============================================================
     FETCH JOBS
     ============================================================ */

  const fetchJobs = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        setError("");

        const res = await api.get(`${API_BASE}/job-work/receive/`, {
          headers: authHeaders(),
        });

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setJobs(list);
      } catch (err) {
        console.error("Failed to load job work:", err);
        setError(getApiError(err, "Failed to load job work."));
        setJobs([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders],
  );

  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setIsLoading(false);
      return;
    }
    fetchJobs();
  }, [accessToken, fetchJobs]);

  /* ============================================================
     FILTERS
     ============================================================ */

  const updateFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => {
    setFilters({
      thickness: "All",
      size: "All",
      poNumber: "All",
      project: "All",
      unit: "All",
      jobWorkType: "All",
      process: "All",
      status: "All",
    });
    setSearch("");
  };

  const hasActiveFilters =
    search.trim() !== "" || Object.values(filters).some((v) => v !== "All");

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const status = statusOf(job);

      const matchesSearch =
        !q ||
        [
          job.id,
          job.issueNumber,
          job.poType,
          job.poNumber,
          job.supplier,
          job.description,
          job.project,
          job.materialSpec,
          job.process,
          job.processId,
          job.unit,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesFilter = (key, field) =>
        filters[key] === "All" || job[field ?? key] === filters[key];

      return (
        matchesSearch &&
        matchesFilter("thickness") &&
        matchesFilter("size") &&
        matchesFilter("poNumber") &&
        matchesFilter("project") &&
        matchesFilter("unit") &&
        matchesFilter("jobWorkType") &&
        matchesFilter("process") &&
        (filters.status === "All" || status === filters.status)
      );
    });
  }, [jobs, search, filters]);

  /* ============================================================
     SUMMARY
     ============================================================ */

  const summary = useMemo(() => {
    const total = jobs.length;
    const notReceived = jobs.filter(
      (j) => statusOf(j) === "Not Received",
    ).length;
    const partial = jobs.filter(
      (j) => statusOf(j) === "Partially Received",
    ).length;
    const full = jobs.filter((j) => statusOf(j) === "Fully Received").length;

    return { total, notReceived, partial, full };
  }, [jobs]);

  /* ============================================================
     MODAL STATE
     ============================================================ */

  const outputConfig = activeJob
    ? processOutputConfig[activeJob.processId] || defaultOutputConfig
    : defaultOutputConfig;

  const balanceToReceive = activeJob
    ? Math.max(activeJob.issuedQty - activeJob.previouslyReceived, 0)
    : 0;

  const completedInputQty = Number(form.completedInputQty) || 0;
  const inputEntered = form.completedInputQty !== "" && completedInputQty > 0;
  const remainingInputQty = inputEntered
    ? Math.max(balanceToReceive - completedInputQty, 0)
    : null;

  const totalOutputQty = useMemo(
    () => form.outputPieces.reduce((sum, p) => sum + (Number(p.qty) || 0), 0),
    [form.outputPieces],
  );

  const totalOutputWeight = useMemo(
    () =>
      form.outputPieces.reduce((sum, p) => sum + (Number(p.weight) || 0), 0),
    [form.outputPieces],
  );

  const totalRemainingWeight = useMemo(
    () =>
      form.remainingPieces.reduce((sum, p) => sum + (Number(p.weight) || 0), 0),
    [form.remainingPieces],
  );

  const openModal = (job) => {
    const cfg = processOutputConfig[job.processId] || defaultOutputConfig;
    setActiveJob(job);
    setForm(emptyForm(cfg.fields));
    setModalError("");
  };

  const closeModal = () => {
    setActiveJob(null);
    setModalError("");
  };

  /* ============================================================
     FORM HANDLERS
     ============================================================ */

  const handleCompletedInputChange = (raw) => {
    const clamped =
      raw === "" ? "" : Math.max(0, Math.min(Number(raw), balanceToReceive));

    setForm((f) => ({
      ...f,
      completedInputQty: clamped,
    }));
  };

  /* ---- Output rows ---- */

  const updateOutputPiece = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      outputPieces: f.outputPieces.map((p) =>
        p.rowId === rowId ? { ...p, [field]: value } : p,
      ),
    }));

  const addOutputPiece = () =>
    setForm((f) => {
      const nextN = nextPlNumber(
        f.outputPieces.map((p) => p.pieceNo),
        "output",
      );
      return {
        ...f,
        outputPieces: [
          ...f.outputPieces,
          newOutputRow(outputConfig.fields, formatOutputPl(nextN)),
        ],
      };
    });

  const removeOutputPiece = (rowId) =>
    setForm((f) => ({
      ...f,
      outputPieces:
        f.outputPieces.length > 1
          ? f.outputPieces.filter((p) => p.rowId !== rowId)
          : f.outputPieces,
    }));

  /* ---- Remaining rows ---- */

  const updateRemainingPiece = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      remainingPieces: f.remainingPieces.map((p) =>
        p.rowId === rowId ? { ...p, [field]: value } : p,
      ),
    }));

  const addRemainingPiece = () =>
    setForm((f) => {
      const nextN = nextPlNumber(
        f.remainingPieces.map((p) => p.plateNo),
        "remaining",
      );
      return {
        ...f,
        remainingPieces: [
          ...f.remainingPieces,
          newRemainingRow(formatRemainingPl(nextN)),
        ],
      };
    });

  const removeRemainingPiece = (rowId) =>
    setForm((f) => ({
      ...f,
      remainingPieces: f.remainingPieces.filter((p) => p.rowId !== rowId),
    }));

  /* ============================================================
     VALIDATION
     ============================================================ */

  const validate = () => {
    if (form.completedInputQty === "" || completedInputQty <= 0) {
      return "Enter a Completed Input Quantity greater than 0.";
    }
    if (completedInputQty > balanceToReceive) {
      return `Completed Input Quantity can't exceed the Balance to Receive (${balanceToReceive}).`;
    }

    const validOutputPieces = form.outputPieces.filter(
      (p) => (p.pieceNo || "").toString().trim() && Number(p.qty) > 0,
    );
    if (validOutputPieces.length === 0) {
      return "Add at least one process output piece with a Piece No and Quantity.";
    }

    for (const piece of form.remainingPieces) {
      if (!piece.plateNo.trim()) {
        return "Enter a Plate / Material No for every remaining piece.";
      }
    }

    if (!form.receivedBy.trim()) {
      return "Enter who received this material.";
    }

    return "";
  };

  /* ============================================================
     SUBMIT RECEIVE
     ============================================================ */

  const handleReceive = async () => {
    if (!activeJob) return;

    // Prevent double-click firing two requests
    if (savingReceive) return;

    const validationError = validate();
    if (validationError) {
      setModalError(validationError);
      return;
    }

    const outputPieces = form.outputPieces
      .filter((p) => (p.pieceNo || "").toString().trim() && Number(p.qty) > 0)
      .map((p) => ({
        pieceNo: p.pieceNo.trim(),
        length: p.length?.toString().trim() || "",
        width: p.width?.toString().trim() || "",
        qty: Number(p.qty),
        weight: p.weight === "" || p.weight == null ? 0 : Number(p.weight),
        remarks: p.remarks?.toString().trim() || "",
      }));

    const remainingPieces = form.remainingPieces.map((p) => ({
      plateNo: p.plateNo.trim(),
      length: p.length?.toString().trim() || "",
      width: p.width?.toString().trim() || "",
      qty: 1, // Every remaining piece represents one piece
      weight: p.weight === "" || p.weight == null ? 0 : Number(p.weight),
      remarks: p.remarks?.toString().trim() || "",
      reworkRequired: p.reworkRequired === "Yes" ? "Yes" : "No",
    }));

    const payload = {
      completedInputQty: Number(form.completedInputQty),
      receivedBy: form.receivedBy.trim(),
      remarks: form.remarks.trim(),
      outputPieces,
      remainingPieces,
    };

    try {
      setSavingReceive(true);

      await api.post(`${API_BASE}/job-work/receive/${activeJob.id}/`, payload, {
        headers: authHeaders(),
      });

      closeModal();

      await Promise.all([fetchJobs({ silent: true }), refreshFilterOptions()]);
    } catch (err) {
      console.error("Receive failed:", err);
      setModalError(getApiError(err, "Failed to receive job work."));
    } finally {
      setSavingReceive(false);
    }
  };

  /* ============================================================
     REFRESH / BACK
     ============================================================ */

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchJobs({ silent: true }), refreshFilterOptions()]);
    setRefreshing(false);
  };

  const handleBack = () => navigate("/inventory/material");

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <>
      <Header />

      <div className="material-page">
        <div className="material-content">
          {/* HEADER */}
          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>
              <div className="page-header-title-group">
                <h1 className="page-header-title">Receive From Job Work</h1>
                <p className="page-header-subtitle">
                  Record completed input quantity, process output and any
                  remaining input material against each issued job work ticket.
                </p>
              </div>
            </div>

            <div className="page-header-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRefresh}
                disabled={refreshing || isLoading}
              >
                <RefreshCw size={14} className={refreshing ? "spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {!isLoading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchJobs()} />
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* SUMMARY CARDS */}
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-neutral">
                    <Layers size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.total}</span>
                    <span className="summary-card-label">Total Records</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-neutral">
                    <PackageX size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.notReceived}
                    </span>
                    <span className="summary-card-label">Not Received</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-warning">
                    <Hourglass size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.partial}
                    </span>
                    <span className="summary-card-label">
                      Partially Received
                    </span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-success">
                    <PackageCheck size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.full}</span>
                    <span className="summary-card-label">Fully Received</span>
                  </div>
                </div>
              </div>

              {/* SEARCH + FILTERS */}
              <div className="panel">
                <div className="panel-toolbar">
                  <div className="panel-toolbar-search">
                    <Search size={14} />
                    <input
                      placeholder="Search job work ID, PO, project, process..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={clearFilters}
                    >
                      <X size={14} /> Clear Filters
                    </button>
                  )}
                </div>

                <div className="filters-grid">
                  <FilterSelect
                    label="Thickness"
                    value={filters.thickness}
                    options={filterOptions.thickness || []}
                    onChange={(v) => updateFilter("thickness", v)}
                  />
                  <FilterSelect
                    label="Size"
                    value={filters.size}
                    options={filterOptions.size || []}
                    onChange={(v) => updateFilter("size", v)}
                  />
                  <FilterSelect
                    label="PO Number"
                    value={filters.poNumber}
                    options={filterOptions.poNumber || []}
                    onChange={(v) => updateFilter("poNumber", v)}
                  />
                  <FilterSelect
                    label="Project"
                    value={filters.project}
                    options={filterOptions.project || []}
                    onChange={(v) => updateFilter("project", v)}
                  />
                  <FilterSelect
                    label="Unit"
                    value={filters.unit}
                    options={filterOptions.unit || []}
                    onChange={(v) => updateFilter("unit", v)}
                  />
                  <FilterSelect
                    label="Job Work Type"
                    value={filters.jobWorkType}
                    options={filterOptions.jobWorkType || []}
                    onChange={(v) => updateFilter("jobWorkType", v)}
                  />
                  <FilterSelect
                    label="Process"
                    value={filters.process}
                    options={filterOptions.process || []}
                    onChange={(v) => updateFilter("process", v)}
                  />
                  <FilterSelect
                    label="Status"
                    value={filters.status}
                    options={RECEIVE_STATUS_OPTIONS}
                    onChange={(v) => updateFilter("status", v)}
                  />
                </div>
              </div>

              {/* JOB LIST */}
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-head-title">Job Work Records</div>
                    <p className="panel-head-subtitle">
                      {filteredJobs.length} of {jobs.length} record
                      {jobs.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="table-scroll-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Job Work ID</th>
                        <th>PO Type</th>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>PO Description</th>
                        <th>Project</th>
                        <th>Specification</th>
                        <th>Thickness</th>
                        <th>Size</th>
                        <th>Unit</th>
                        <th>Job Work Type</th>
                        <th>Job Work Unit</th>
                        <th>Process</th>
                        <th>Process ID</th>
                        <th>Issued Qty</th>
                        <th>Received Qty</th>
                        <th>Balance</th>
                        <th>Output Qty</th>
                        <th>Status</th>
                        <th className="cell-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.length === 0 && (
                        <tr>
                          <td colSpan={20}>
                            <div className="empty-state">
                              <div className="empty-state-icon">📋</div>
                              <p className="empty-state-title">
                                No Matching Job Work
                              </p>
                              <p className="empty-state-desc">
                                Try adjusting or clearing the filters.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}

                      {filteredJobs.map((job) => {
                        const balance = job.issuedQty - job.previouslyReceived;
                        const status = statusOf(job);
                        const canReceive = balance > 0;

                        return (
                          <tr key={job.id}>
                            <td className="cell-mono">{job.issueNumber}</td>
                            <td>{job.poType}</td>
                            <td className="cell-mono">{job.poNumber}</td>
                            <td>{job.supplier}</td>
                            <td>{job.description}</td>
                            <td>{job.project}</td>
                            <td>{job.materialSpec}</td>
                            <td>{job.thickness}</td>
                            <td>{job.size}</td>
                            <td>{job.unit}</td>
                            <td>
                              <span
                                className={`type-badge ${
                                  job.jobWorkType === "Outsourcing"
                                    ? "type-badge-outsourcing"
                                    : "type-badge-inhouse"
                                }`}
                              >
                                {job.jobWorkType}
                              </span>
                            </td>
                            <td>{job.jobWorkUnit}</td>
                            <td>{job.process}</td>
                            <td className="cell-mono">{job.processId}</td>
                            <td className="cell-num">
                              {fmt(job.issuedQty)} {job.uom}
                            </td>
                            <td className="cell-num">
                              {fmt(job.previouslyReceived)} {job.uom}
                            </td>
                            <td className="cell-num cell-balance">
                              {fmt(balance)} {job.uom}
                            </td>
                            <td className="cell-num">{fmt(job.outputQty)}</td>
                            <td>
                              <span
                                className={`status-badge ${statusToneClass(
                                  status,
                                )}`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="cell-action">
                              <button
                                type="button"
                                onClick={() => openModal(job)}
                                disabled={!canReceive}
                                className="btn btn-primary btn-sm"
                              >
                                Receive
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* RECEIVE MODAL */}
          {activeJob && (
            <div className="modal-overlay">
              <div className="modal-box modal-box-wide">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">Receive From Job Work</h2>
                    <p className="modal-subtitle">
                      Job Work ID : <strong>{activeJob.issueNumber}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="modal-close-btn"
                    aria-label="Close"
                    disabled={savingReceive}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  {/* Integrated Requirement */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Integrated Requirement</h3>
                    <div className="readonly-grid">
                      <ReadonlyField
                        label="Project"
                        value={activeJob.project}
                      />
                      <ReadonlyField
                        label="DWG"
                        value={activeJob.dwgDescription}
                      />
                      <ReadonlyField
                        label="Description"
                        value={activeJob.description}
                      />
                      <ReadonlyField
                        label="Material"
                        value={activeJob.material}
                      />
                      <ReadonlyField
                        label="Thickness"
                        value={activeJob.thickness}
                      />
                      <ReadonlyField
                        label="Required Qty"
                        value={`${fmt(activeJob.requiredQty)} ${activeJob.uom}`}
                      />
                      <ReadonlyField
                        label="Original Size"
                        value={activeJob.size}
                      />
                    </div>
                  </div>

                  {/* Job Work Details */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Job Work Details</h3>
                    <div className="readonly-grid">
                      <ReadonlyField
                        label="Job Work Type"
                        value={activeJob.jobWorkType}
                      />
                      <ReadonlyField
                        label={
                          activeJob.jobWorkType === "Outsourcing"
                            ? "Vendor"
                            : "Unit"
                        }
                        value={
                          activeJob.jobWorkType === "Outsourcing"
                            ? activeJob.supplier
                            : activeJob.jobWorkUnit
                        }
                      />
                      <ReadonlyField
                        label="Process"
                        value={`${activeJob.process} - ${activeJob.processId}`}
                      />
                      <ReadonlyField
                        label="Issued Quantity"
                        value={`${fmt(activeJob.issuedQty)} ${activeJob.uom}`}
                      />
                      <ReadonlyField
                        label="Previously Received"
                        value={`${fmt(
                          activeJob.previouslyReceived,
                        )} ${activeJob.uom}`}
                      />
                      <ReadonlyField
                        label="Balance to Receive"
                        value={`${fmt(balanceToReceive)} ${activeJob.uom}`}
                        emphasize
                      />
                    </div>
                  </div>

                  {/* Input Material Receipt */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Input Material Receipt</h3>
                    <p className="modal-card-subtitle">
                      How many of the original{" "}
                      {activeJob.material.toLowerCase()} units were processed /
                      consumed?
                    </p>
                    <div className="receive-input-row">
                      <div className="form-field">
                        <label htmlFor="completed-input-qty">
                          Completed Input Quantity
                        </label>
                        <input
                          id="completed-input-qty"
                          type="number"
                          min="0"
                          max={balanceToReceive}
                          placeholder={`e.g. ${balanceToReceive}`}
                          value={form.completedInputQty}
                          onChange={(e) =>
                            handleCompletedInputChange(e.target.value)
                          }
                          disabled={savingReceive}
                        />
                      </div>
                      <div className="remaining-preview">
                        <span className="readonly-label">
                          Remaining Input Quantity
                        </span>
                        <strong>
                          {inputEntered ? remainingInputQty : "—"}{" "}
                          {inputEntered ? activeJob.uom : ""}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* PIECES TABLE */}
                  {inputEntered && (
                    <div className="modal-card">
                      <div className="modal-card-header-row">
                        <h3 className="modal-card-title">
                          Pieces — Output & Remaining
                        </h3>
                        <div className="btn-row">
                          <button
                            type="button"
                            onClick={addOutputPiece}
                            className="btn-link"
                            disabled={savingReceive}
                          >
                            <Plus size={14} /> Add Output
                          </button>
                          <button
                            type="button"
                            onClick={addRemainingPiece}
                            className="btn-link"
                            disabled={savingReceive}
                          >
                            <Plus size={14} /> Add Remaining
                          </button>
                        </div>
                      </div>

                      <div className="pieces-table-wrap">
                        <table className="pieces-table pieces-table-bordered">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              <th style={{ width: 100 }}>Kind</th>
                              <th style={{ width: 120 }}>Ref No</th>
                              <th style={{ width: 90 }}>Length</th>
                              <th style={{ width: 90 }}>Width</th>
                              <th style={{ width: 90 }}>Thickness</th>
                              <th style={{ width: 70 }}>Qty</th>
                              <th style={{ width: 90 }}>Weight</th>
                              <th style={{ minWidth: 160 }}>Remarks</th>
                              <th style={{ width: 150 }}>Rework</th>
                              <th style={{ width: 40 }} aria-label="Remove" />
                            </tr>
                          </thead>

                          <tbody>
                            {/* OUTPUT ROWS */}
                            {form.outputPieces.map((piece, idx) => (
                              <tr key={piece.rowId} className="row-output">
                                <td className="cell-num">{idx + 1}</td>
                                <td>
                                  <span className="type-badge type-badge-inhouse">
                                    Output
                                  </span>
                                </td>
                                <td>
                                  <input
                                    value={piece.pieceNo}
                                    onChange={(e) =>
                                      updateOutputPiece(
                                        piece.rowId,
                                        "pieceNo",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.length}
                                    onChange={(e) =>
                                      updateOutputPiece(
                                        piece.rowId,
                                        "length",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.width}
                                    onChange={(e) =>
                                      updateOutputPiece(
                                        piece.rowId,
                                        "width",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={activeJob.thickness}
                                    disabled
                                    className="inline-input"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.qty}
                                    onChange={(e) =>
                                      updateOutputPiece(
                                        piece.rowId,
                                        "qty",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.weight}
                                    onChange={(e) =>
                                      updateOutputPiece(
                                        piece.rowId,
                                        "weight",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={piece.remarks}
                                    onChange={(e) =>
                                      updateOutputPiece(
                                        piece.rowId,
                                        "remarks",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td className="cell-muted">—</td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeOutputPiece(piece.rowId)
                                    }
                                    disabled={
                                      form.outputPieces.length === 1 ||
                                      savingReceive
                                    }
                                    className="btn-icon-ghost"
                                    title="Remove"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {/* DIVIDER */}
                            {form.remainingPieces.length > 0 && (
                              <tr className="row-divider">
                                <td colSpan={11}>
                                  <strong>Remaining Input Material</strong>
                                  <span className="divider-note">
                                    {form.remainingPieces.length} piece
                                    {form.remainingPieces.length !== 1
                                      ? "s"
                                      : ""}
                                    {inputEntered && remainingInputQty > 0
                                      ? ` · expected ${remainingInputQty}`
                                      : ""}
                                  </span>
                                </td>
                              </tr>
                            )}

                            {/* REMAINING ROWS */}
                            {form.remainingPieces.map((piece, idx) => (
                              <tr key={piece.rowId} className="row-remaining">
                                <td className="cell-num">
                                  {form.outputPieces.length + idx + 1}
                                </td>
                                <td>
                                  <span className="type-badge type-badge-outsourcing">
                                    Remaining
                                  </span>
                                </td>
                                <td>
                                  <input
                                    value={piece.plateNo}
                                    onChange={(e) =>
                                      updateRemainingPiece(
                                        piece.rowId,
                                        "plateNo",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.length}
                                    onChange={(e) =>
                                      updateRemainingPiece(
                                        piece.rowId,
                                        "length",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.width}
                                    onChange={(e) =>
                                      updateRemainingPiece(
                                        piece.rowId,
                                        "width",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={activeJob.thickness}
                                    disabled
                                    className="inline-input"
                                  />
                                </td>
                                <td className="cell-muted">—</td>
                                <td>
                                  <input
                                    type="number"
                                    value={piece.weight}
                                    onChange={(e) =>
                                      updateRemainingPiece(
                                        piece.rowId,
                                        "weight",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={piece.remarks}
                                    onChange={(e) =>
                                      updateRemainingPiece(
                                        piece.rowId,
                                        "remarks",
                                        e.target.value,
                                      )
                                    }
                                    className="inline-input"
                                    disabled={savingReceive}
                                  />
                                </td>
                                <td>
                                  <div className="inline-radio">
                                    <label>
                                      <input
                                        type="radio"
                                        name={`rework-${piece.rowId}`}
                                        checked={piece.reworkRequired === "No"}
                                        onChange={() =>
                                          updateRemainingPiece(
                                            piece.rowId,
                                            "reworkRequired",
                                            "No",
                                          )
                                        }
                                        disabled={savingReceive}
                                      />
                                      No
                                    </label>
                                    <label>
                                      <input
                                        type="radio"
                                        name={`rework-${piece.rowId}`}
                                        checked={piece.reworkRequired === "Yes"}
                                        onChange={() =>
                                          updateRemainingPiece(
                                            piece.rowId,
                                            "reworkRequired",
                                            "Yes",
                                          )
                                        }
                                        disabled={savingReceive}
                                      />
                                      Yes
                                    </label>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeRemainingPiece(piece.rowId)
                                    }
                                    className="btn-icon-ghost"
                                    title="Remove"
                                    disabled={savingReceive}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>

                          <tfoot>
                            <tr className="table-total-row">
                              <td colSpan={6}>
                                <strong>Totals</strong>
                              </td>
                              <td className="cell-num">
                                <strong>{totalOutputQty}</strong>
                              </td>
                              <td className="cell-num cell-muted">
                                <strong>{totalOutputWeight}</strong>
                              </td>
                              <td
                                colSpan={3}
                                className="cell-muted"
                                style={{ textAlign: "left" }}
                              >
                                Output: {form.outputPieces.length} · Remaining:{" "}
                                {form.remainingPieces.length} · Weight:{" "}
                                {totalRemainingWeight}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="pieces-summary">
                        <span>
                          Output quantity is independent of input quantity — one
                          input unit can yield many output pieces. Add remaining
                          rows manually as needed.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Received By + Remarks */}
                  <div className="form-field">
                    <label htmlFor="received-by">Received By</label>
                    <input
                      id="received-by"
                      type="text"
                      placeholder="Enter name"
                      value={form.receivedBy}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          receivedBy: e.target.value,
                        }))
                      }
                      disabled={savingReceive}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="receive-remarks">Remarks (optional)</label>
                    <textarea
                      id="receive-remarks"
                      rows={2}
                      value={form.remarks}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          remarks: e.target.value,
                        }))
                      }
                      disabled={savingReceive}
                    />
                  </div>

                  {modalError && <div className="error-box">{modalError}</div>}

                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-secondary"
                      disabled={savingReceive}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReceive}
                      className="btn btn-primary"
                      disabled={savingReceive}
                    >
                      {savingReceive ? "Saving..." : "Receive Job Work"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   HELPER COMPONENTS
   ============================================================ */

function ReadonlyField({ label, value, emphasize }) {
  return (
    <div className="readonly-field">
      <label className="readonly-label">{label}</label>
      <div
        className={`readonly-value ${
          emphasize ? "readonly-value-emphasis" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="All">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
