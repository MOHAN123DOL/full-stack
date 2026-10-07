import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  X,
  Eye,
  History,
  RefreshCw,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./Rework.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const API_BASE = "/erp/material";
const GENERIC_ERROR = "Something went wrong. Please try again.";

const STATUS = {
  REQUIRED: "Rework Required",
  IN_PROGRESS: "Rework In Progress",
  PARTIAL: "Partially Completed",
  QC_PENDING: "QC Pending",
  READY_NEXT: "Ready for Next Process",
  AVAILABLE_STOCK: "Available in Material Stock",
};

const ACTIVE_STATUSES = [
  STATUS.REQUIRED,
  STATUS.IN_PROGRESS,
  STATUS.PARTIAL,
  STATUS.QC_PENDING,
];

const SOURCE_JOB_WORK = "job-work-receive";
const SOURCE_PRODUCTION = "production";

/* ============================================================
   HELPERS
   ============================================================ */

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat().find((v) => typeof v === "string");
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ============================================================
   BACKEND ROW → FRONTEND ROW
   ============================================================ */

function buildRowFromApi(rec) {
  const isRjw = rec.sourceType === SOURCE_JOB_WORK;

  const requiredQty = Number(rec.requiredQty) || 0;
  const completedQty = Number(rec.completedQty) || 0;
  const balanceQty = Math.max(requiredQty - completedQty, 0);

  const start = rec.startedAt
    ? {
        by: rec.reworkBy || "—",
        supervisor: rec.supervisor || "—",
        date: rec.startedAt.slice(0, 10),
        time: rec.startedAt.slice(11, 16),
        remarks: rec.startRemarks || "",
      }
    : null;

  const completions = (rec.completions || []).map((c) => ({
    by: c.completedBy || "—",
    date: c.date,
    time: c.time,
    qty: Number(c.qty) || 0,
    remarks: c.remarks || "",
  }));

  const qc = rec.qcVerifiedBy
    ? {
        verifiedBy: rec.qcVerifiedBy,
        result: rec.qcResult,
        date: rec.qcAt ? rec.qcAt.slice(0, 10) : "",
        time: rec.qcAt ? rec.qcAt.slice(11, 16) : "",
        remarks: rec.qcRemarks || "",
      }
    : null;

  const base = {
    id: rec.id,
    reworkId: rec.reworkId,
    sourceType: rec.sourceType,
    sourceLabel: rec.sourceLabel,
    isRjw,

    status: rec.status,
    requiredQty,
    completedQty,
    balanceQty,
    durationMinutes: rec.durationMinutes,
    durationLabel: rec.durationLabel,

    createdDate: rec.createdDate,
    createdTime: rec.createdTime,
    startedAt: rec.startedAt,
    completedAt: rec.completedAt,

    project: rec.project,
    dwg: rec.dwgDescription,
    dwgDescription: rec.dwgDescription,
    revision: rec.revision,
    material: rec.material,
    materialCode: rec.materialCode,
    materialSpec: rec.materialSpec,
    thickness: rec.thickness,
    length: rec.length,
    width: rec.width,
    size: rec.size,
    unit: rec.unit,
    reason: rec.reason,
    flaggedBy: rec.flaggedBy,

    start,
    completions,
    qc,
    history: (rec.history || []).map((h) => ({
      date: h.date,
      time: h.time,
      event: h.event,
    })),
  };

  if (isRjw) {
    return {
      ...base,
      poId: rec.poNumber || "",
      poNumber: rec.poNumber || "",
      poDescription: rec.poDescription || "",
      supplier: rec.flaggedBy || "—",
      pieceNo: rec.jobWorkPieceNo || "",
    };
  }

  return {
    ...base,
    assemblyId: rec.assemblyCode || "",
    description: rec.reason || "",
    process: rec.process || "",
    processId: rec.processId || "",
    totalQty: requiredQty,
    qcAcceptedQty: 0,
    rejectedQty: requiredQty,
    qcRequired: !!rec.qcRequired,
  };
}

/* ============================================================
   FILTERS
   ============================================================ */

const RJW_FILTER_FIELDS = [
  { key: "project", label: "Project", type: "select" },
  { key: "poNumber", label: "PO Number", type: "select" },
  { key: "poDescription", label: "PO Description", type: "select" },
  { key: "dwg", label: "DWG", type: "select" },
  { key: "revision", label: "Revision", type: "select" },
  { key: "material", label: "Material", type: "select" },
  { key: "materialCode", label: "Material Code", type: "select" },
  { key: "thickness", label: "Thickness", type: "select" },
  { key: "size", label: "Size", type: "select" },
  { key: "unit", label: "Unit", type: "select" },
  { key: "status", label: "Rework Status", type: "select" },
];
const RJW_SEARCH_FIELDS = [
  "reworkId",
  "poNumber",
  "poDescription",
  "project",
  "dwg",
  "material",
  "pieceNo",
];

const PO_FILTER_FIELDS = [
  { key: "project", label: "Project", type: "select" },
  { key: "dwg", label: "DWG", type: "select" },
  { key: "assemblyId", label: "Assembly", type: "select" },
  { key: "material", label: "Material", type: "select" },
  { key: "process", label: "Process", type: "select" },
  { key: "status", label: "Rework Status", type: "select" },
];
const PO_SEARCH_FIELDS = [
  "reworkId",
  "project",
  "dwg",
  "assemblyId",
  "material",
  "process",
];

const HISTORY_EXTRA_FIELD = { key: "createdDate", label: "Date", type: "date" };

const buildOptionsMap = (rows, fields) => {
  const map = {};
  fields.forEach((f) => {
    if (f.type === "select") {
      map[f.key] = [
        ...new Set(rows.map((r) => r[f.key]).filter(Boolean)),
      ].sort();
    }
  });
  return map;
};

const matchesFilters = (row, filters, fields) =>
  fields.every((f) => {
    const val = filters[f.key];
    if (!val) return true;
    const rowVal = String(row[f.key] ?? "").toLowerCase();
    if (f.type === "date") return rowVal === val.toLowerCase();
    return f.type === "select"
      ? rowVal === val.toLowerCase()
      : rowVal.includes(val.toLowerCase());
  });

const matchesSearch = (row, search, fields) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  return fields.some((k) =>
    String(row[k] ?? "")
      .toLowerCase()
      .includes(term)
  );
};

/* ============================================================
   FORMS
   ============================================================ */

const emptyStartForm = () => ({
  by: "",
  supervisor: "",
  date: today(),
  time: nowTime(),
  remarks: "",
});
const emptyCompleteForm = () => ({
  qty: "",
  by: "",
  date: today(),
  time: nowTime(),
  remarks: "",
});
const emptyQcForm = () => ({
  verifiedBy: "",
  result: "Approved",
  date: today(),
  time: nowTime(),
  remarks: "",
});

const ACTION_TITLES = {
  start: "Start Rework",
  complete: "Complete Rework",
  qc: "QC Verification",
};
const ACTION_SAVE_LABELS = {
  start: "Save & Start",
  complete: "Save Completion",
  qc: "Save QC Result",
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function Rework() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [rjwItems, setRjwItems] = useState([]);
  const [poItems, setPoItems] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("rjw");
  const [viewMode, setViewMode] = useState("active");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewId, setViewId] = useState(null);
  const [actionState, setActionState] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const isRjw = activeTab === "rjw";

  const filterFields = isRjw ? RJW_FILTER_FIELDS : PO_FILTER_FIELDS;
  const searchFields = isRjw ? RJW_SEARCH_FIELDS : PO_SEARCH_FIELDS;
  const effectiveFilterFields =
    viewMode === "history"
      ? [...filterFields, HISTORY_EXTRA_FIELD]
      : filterFields;

  /* ============================================================
     AUTH HEADERS
     ============================================================ */

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* ============================================================
     FETCH
     ============================================================ */

  const fetchAll = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        setError("");

        const res = await api.get(`${API_BASE}/rework/`, {
          headers: authHeaders(),
        });

        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const rows = list.map(buildRowFromApi);

        setRjwItems(rows.filter((r) => r.isRjw));
        setPoItems(rows.filter((r) => !r.isRjw));
      } catch (err) {
        console.error("Failed to load rework records:", err);
        setError(getApiError(err, "Failed to load rework records."));
        setRjwItems([]);
        setPoItems([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders]
  );

  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setIsLoading(false);
      return;
    }
    fetchAll();
  }, [accessToken, fetchAll]);

  /* ============================================================
     DERIVED
     ============================================================ */

  const allRows = isRjw ? rjwItems : poItems;

  const scopedRows = useMemo(
    () =>
      viewMode === "active"
        ? allRows.filter((r) => ACTIVE_STATUSES.includes(r.status))
        : allRows,
    [allRows, viewMode]
  );

  const filteredRows = useMemo(
    () =>
      scopedRows.filter(
        (r) =>
          matchesFilters(r, filters, effectiveFilterFields) &&
          matchesSearch(r, search, searchFields)
      ),
    [scopedRows, filters, effectiveFilterFields, search, searchFields]
  );

  const filterOptions = useMemo(
    () => buildOptionsMap(scopedRows, effectiveFilterFields),
    [scopedRows, effectiveFilterFields]
  );

  const viewRow = viewId
    ? allRows.find((r) => r.reworkId === viewId)
    : null;

  const actionRow = actionState
    ? allRows.find((r) => r.reworkId === actionState.id)
    : null;

  /* ============================================================
     HANDLERS
     ============================================================ */

  const switchTab = (tab) => {
    setActiveTab(tab);
    setViewMode("active");
    setFilters({});
    setSearch("");
    setFiltersOpen(false);
  };
  const switchViewMode = (mode) => {
    setViewMode(mode);
    setFilters({});
    setSearch("");
  };
  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const openView = (id) => setViewId(id);
  const closeView = () => setViewId(null);

  const openAction = (id, mode) => {
    setActionState({ id, mode });
    setFormError("");
    if (mode === "start") setForm(emptyStartForm());
    else if (mode === "complete") setForm(emptyCompleteForm());
    else setForm(emptyQcForm());
  };
  const closeAction = () => {
    if (saving) return;
    setActionState(null);
    setForm({});
    setFormError("");
  };

  /* ============================================================
     SAVE — START
     ============================================================ */

  const handleSaveStart = async () => {
    if (!form.by.trim()) return setFormError("Please enter Rework Done By.");
    if (!form.supervisor.trim())
      return setFormError("Please enter Supervisor.");

    setSaving(true);
    setFormError("");
    try {
      await api.post(
        `${API_BASE}/rework/${actionRow.id}/start/`,
        {
          by: form.by.trim(),
          supervisor: form.supervisor.trim(),
          remarks: form.remarks.trim(),
        },
        { headers: authHeaders() }
      );
      closeAction();
      await fetchAll({ silent: true });
    } catch (err) {
      setFormError(getApiError(err, "Failed to start rework."));
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     SAVE — COMPLETE
     ============================================================ */

  const handleSaveComplete = async () => {
    const qty = Number(form.qty) || 0;
    if (!form.by.trim()) return setFormError("Please enter Completed By.");
    if (qty <= 0)
      return setFormError("Enter a Completed Quantity greater than 0.");
    if (qty > actionRow.balanceQty) {
      return setFormError(
        `Completed Quantity cannot exceed the balance rework quantity (${actionRow.balanceQty}).`
      );
    }

    setSaving(true);
    setFormError("");
    try {
      await api.post(
        `${API_BASE}/rework/${actionRow.id}/complete/`,
        {
          qty,
          by: form.by.trim(),
          remarks: form.remarks.trim(),
        },
        { headers: authHeaders() }
      );
      closeAction();
      await fetchAll({ silent: true });
    } catch (err) {
      setFormError(getApiError(err, "Failed to save completion."));
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     SAVE — QC
     ============================================================ */

  const handleSaveQc = async () => {
    if (!form.verifiedBy.trim())
      return setFormError("Please enter QC Verified By.");

    setSaving(true);
    setFormError("");
    try {
      await api.post(
        `${API_BASE}/rework/${actionRow.id}/qc/`,
        {
          verifiedBy: form.verifiedBy.trim(),
          result: form.result,
          remarks: form.remarks.trim(),
        },
        { headers: authHeaders() }
      );
      closeAction();
      await fetchAll({ silent: true });
    } catch (err) {
      setFormError(getApiError(err, "Failed to save QC result."));
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     REFRESH / BACK
     ============================================================ */

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll({ silent: true });
    setRefreshing(false);
  };

  function handleBack() {
    navigate("/inventory/material");
  }

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
                <h1 className="page-header-title">Rework</h1>
                <p className="page-header-subtitle">
                  The central place for every material or quantity that needs
                  rework. Items arrive here automatically from Receive From Job
                  Work and Production Operation — nothing is entered twice.
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

          {/* LOADING / ERROR */}
          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {!isLoading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchAll()} />
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* TABS */}
              <div className="tabs">
                <button
                  type="button"
                  className={`tab ${isRjw ? "tab-active" : ""}`}
                  onClick={() => switchTab("rjw")}
                >
                  Receive From Job Work
                  <span className="tab-count">
                    {
                      rjwItems.filter((r) =>
                        ACTIVE_STATUSES.includes(r.status)
                      ).length
                    }
                  </span>
                </button>
                <button
                  type="button"
                  className={`tab ${!isRjw ? "tab-active" : ""}`}
                  onClick={() => switchTab("po")}
                >
                  Production Operation
                  <span className="tab-count">
                    {
                      poItems.filter((r) =>
                        ACTIVE_STATUSES.includes(r.status)
                      ).length
                    }
                  </span>
                </button>
              </div>

              {/* VIEW MODE */}
              <div className="viewmode-row">
                <div className="viewmode-toggle">
                  <button
                    type="button"
                    className={`viewmode-btn ${
                      viewMode === "active" ? "viewmode-btn-active" : ""
                    }`}
                    onClick={() => switchViewMode("active")}
                  >
                    Active Rework
                  </button>
                  <button
                    type="button"
                    className={`viewmode-btn ${
                      viewMode === "history" ? "viewmode-btn-active" : ""
                    }`}
                    onClick={() => switchViewMode("history")}
                  >
                    <History size={14} />
                    History
                  </button>
                </div>
                <p className="viewmode-hint">
                  {viewMode === "active"
                    ? "Showing rework that still needs action."
                    : "Showing every rework transaction, completed and in progress."}
                </p>
              </div>

              {/* TABLE */}
              <div className="panel">
                <FilterPanel
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  fields={effectiveFilterFields}
                  options={filterOptions}
                  onClear={clearFilters}
                  open={filtersOpen}
                  onToggleOpen={() => setFiltersOpen((o) => !o)}
                  resultCount={filteredRows.length}
                  placeholder={
                    isRjw
                      ? "Search Rework ID, PO Number, PO Description, Project, DWG, Material, Piece Number..."
                      : "Search Rework ID, Project, DWG, Assembly ID, Material, Process..."
                  }
                />

                <div className="table-scroll-wrapper">
                  {isRjw ? (
                    <RjwTable
                      rows={filteredRows}
                      onView={openView}
                      onOpen={openAction}
                    />
                  ) : (
                    <PoTable
                      rows={filteredRows}
                      onView={openView}
                      onOpen={openAction}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* EYE VIEW MODAL */}
          {viewRow && (
            <div className="modal-overlay" onClick={closeView}>
              <div
                className="modal-box modal-box-wide"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">{viewRow.reworkId}</h2>
                    <p className="modal-subtitle">
                      Source :{" "}
                      <strong>
                        {isRjw ? "Receive From Job Work" : "Production Operation"}
                      </strong>{" "}
                      · Status : <strong>{viewRow.status}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeView}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  {isRjw ? (
                    <EyeViewRjw row={viewRow} />
                  ) : (
                    <EyeViewPo row={viewRow} />
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeView}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACTION MODAL */}
          {actionState && actionRow && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {ACTION_TITLES[actionState.mode]}
                    </h2>
                    <p className="modal-subtitle">
                      Rework ID : <strong>{actionRow.reworkId}</strong> ·{" "}
                      {isRjw ? "Piece" : "Assembly"} :{" "}
                      <strong>
                        {isRjw ? actionRow.pieceNo : actionRow.assemblyId}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeAction}
                    className="modal-close-btn"
                    aria-label="Close"
                    disabled={saving}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  <ActionModalBody
                    row={actionRow}
                    isRjw={isRjw}
                    mode={actionState.mode}
                    form={form}
                    setForm={setForm}
                  />
                  {formError && <div className="error-box">{formError}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeAction}
                    className="btn btn-secondary"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={
                      {
                        start: handleSaveStart,
                        complete: handleSaveComplete,
                        qc: handleSaveQc,
                      }[actionState.mode]
                    }
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : ACTION_SAVE_LABELS[actionState.mode]}
                  </button>
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
   FILTER PANEL
   ============================================================ */

function FilterPanel({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  fields,
  options,
  onClear,
  open,
  onToggleOpen,
  resultCount,
  placeholder,
}) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder={placeholder}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={onToggleOpen}
        className={`btn btn-secondary btn-sm ${
          open ? "btn-outline-active" : ""
        }`}
      >
        Filters
        {activeFilterCount > 0 && (
          <span
            style={{
              background: "var(--primary)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "0 6px",
              borderRadius: 999,
            }}
          >
            {activeFilterCount}
          </span>
        )}
      </button>
      <button type="button" onClick={onClear} className="btn-link">
        Clear Filters
      </button>

      {open && (
        <div className="filters-grid">
          {fields.map((f) => (
            <div className="form-field" key={f.key}>
              <label>{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={filters[f.key] || ""}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                >
                  <option value="">All</option>
                  {(options[f.key] || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : f.type === "date" ? (
                <input
                  type="date"
                  value={filters[f.key] || ""}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={filters[f.key] || ""}
                  placeholder={`Filter by ${f.label}`}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          margin: "12px 2px 0",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        {resultCount} record{resultCount !== 1 ? "s" : ""} found
      </p>
    </div>
  );
}

/* ============================================================
   STATUS BADGE
   ============================================================ */

function StatusBadge({ status }) {
  const map = {
    [STATUS.REQUIRED]: { cls: "status-badge-danger", icon: "⚠" },
    [STATUS.IN_PROGRESS]: { cls: "status-badge-info", icon: "●" },
    [STATUS.PARTIAL]: { cls: "status-badge-warning", icon: "◐" },
    [STATUS.QC_PENDING]: { cls: "status-badge-purple", icon: "◐" },
    [STATUS.READY_NEXT]: { cls: "status-badge-success", icon: "✓" },
    [STATUS.AVAILABLE_STOCK]: { cls: "status-badge-success", icon: "✓" },
  };
  const m = map[status] || { cls: "", icon: "" };
  return (
    <span className={`status-badge ${m.cls}`}>
      {m.icon} {status}
    </span>
  );
}

/* ============================================================
   ACTION BUTTONS
   ============================================================ */

function ActionButtons({ row, onOpen }) {
  if (
    row.status === STATUS.READY_NEXT ||
    row.status === STATUS.AVAILABLE_STOCK
  ) {
    return <span className="locked-pill">Completed</span>;
  }
  if (row.status === STATUS.REQUIRED) {
    return (
      <button
        type="button"
        onClick={() => onOpen(row.reworkId, "start")}
        className="btn btn-primary btn-sm"
      >
        Start Rework
      </button>
    );
  }
  if (row.status === STATUS.IN_PROGRESS || row.status === STATUS.PARTIAL) {
    return (
      <button
        type="button"
        onClick={() => onOpen(row.reworkId, "complete")}
        className="btn btn-primary btn-sm"
      >
        Complete Rework
      </button>
    );
  }
  if (row.status === STATUS.QC_PENDING) {
    return (
      <button
        type="button"
        onClick={() => onOpen(row.reworkId, "qc")}
        className="btn btn-qc btn-sm"
      >
        QC Verify
      </button>
    );
  }
  return null;
}

/* ============================================================
   TABLES
   ============================================================ */

function RjwTable({ rows, onView, onOpen }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Rework ID</th>
          <th>PO Number</th>
          <th>PO Description</th>
          <th>Supplier</th>
          <th>Project</th>
          <th>DWG / Description</th>
          <th>Revision</th>
          <th>Material</th>
          <th>Material Code</th>
          <th>Material Specification</th>
          <th>Thickness</th>
          <th>Size</th>
          <th>Piece Number</th>
          <th>Unit</th>
          <th>Quantity</th>
          <th>Rework Status</th>
          <th>Created Date</th>
          <th className="cell-action">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={18}>
              <EmptyState />
            </td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={row.reworkId}>
            <td className="cell-id">{row.reworkId}</td>
            <td>{row.poNumber || "-"}</td>
            <td>{row.poDescription || "-"}</td>
            <td>{row.supplier || "-"}</td>
            <td>{row.project || "-"}</td>
            <td>{row.dwgDescription || row.dwg || "-"}</td>
            <td>{row.revision || "-"}</td>
            <td>{row.material || "-"}</td>
            <td className="cell-mono">{row.materialCode || "-"}</td>
            <td>{row.materialSpec || "-"}</td>
            <td>{row.thickness || "-"}</td>
            <td>{row.size || "-"}</td>
            <td>{row.pieceNo || "-"}</td>
            <td>{row.unit || "-"}</td>
            <td className="cell-num">
              {fmt(row.completedQty)}/{fmt(row.requiredQty)}
              {row.balanceQty > 0 && (
                <span className="balance-pill">
                  bal {fmt(row.balanceQty)}
                </span>
              )}
            </td>
            <td>
              <StatusBadge status={row.status} />
            </td>
            <td>{row.createdDate}</td>
            <td>
              <div className="action-cell">
                <button
                  type="button"
                  onClick={() => onView(row.reworkId)}
                  className="icon-btn"
                  title="View Details"
                  aria-label="View Details"
                >
                  <Eye size={15} />
                </button>
                <ActionButtons row={row} onOpen={onOpen} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PoTable({ rows, onView, onOpen }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Rework ID</th>
          <th>Project</th>
          <th>DWG</th>
          <th>Assembly ID</th>
          <th>Material</th>
          <th>Description</th>
          <th>Process</th>
          <th>Total Quantity</th>
          <th>Rejected Quantity</th>
          <th>Rework Completed Quantity</th>
          <th>Balance Rework Quantity</th>
          <th>Rework Status</th>
          <th>Created Date</th>
          <th className="cell-action">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={14}>
              <EmptyState />
            </td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={row.reworkId}>
            <td className="cell-id">{row.reworkId}</td>
            <td>{row.project || "-"}</td>
            <td>{row.dwg || "-"}</td>
            <td>{row.assemblyId || "-"}</td>
            <td>{row.material || "-"}</td>
            <td>{row.description || "-"}</td>
            <td>{row.process || "-"}</td>
            <td className="cell-num">{fmt(row.totalQty)}</td>
            <td className="cell-num">{fmt(row.rejectedQty)}</td>
            <td className="cell-num">{fmt(row.completedQty)}</td>
            <td className="cell-num">
              {row.balanceQty > 0 ? (
                <span className="balance-pill">{fmt(row.balanceQty)}</span>
              ) : (
                0
              )}
            </td>
            <td>
              <StatusBadge status={row.status} />
            </td>
            <td>{row.createdDate}</td>
            <td>
              <div className="action-cell">
                <button
                  type="button"
                  onClick={() => onView(row.reworkId)}
                  className="icon-btn"
                  title="View Details"
                  aria-label="View Details"
                >
                  <Eye size={15} />
                </button>
                <ActionButtons row={row} onOpen={onOpen} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🔧</div>
      <p className="empty-state-title">No Rework Found</p>
      <p className="empty-state-desc">
        No rework record matches the current view / search / filters.
      </p>
    </div>
  );
}

/* ============================================================
   ACTION MODAL BODY
   ============================================================ */

function ActionModalBody({ row, isRjw, mode, form, setForm }) {
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Rework Details</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Rework ID" value={row.reworkId} emphasize />
          <ReadonlyField
            label="Source"
            value={isRjw ? "Receive From Job Work" : "Production Operation"}
          />
          {isRjw ? (
            <>
              <ReadonlyField label="PO" value={row.poNumber} />
              <ReadonlyField label="PO Description" value={row.poDescription} />
              <ReadonlyField label="Project" value={row.project} />
              <ReadonlyField label="DWG" value={row.dwg} />
              <ReadonlyField label="Material" value={row.material} />
              <ReadonlyField label="Piece" value={row.pieceNo} />
              <ReadonlyField label="Thickness" value={row.thickness} />
              <ReadonlyField label="Size" value={row.size} />
              <ReadonlyField
                label="Quantity"
                value={`${fmt(row.requiredQty)} ${row.unit}`}
              />
            </>
          ) : (
            <>
              <ReadonlyField label="Project" value={row.project} />
              <ReadonlyField label="Assembly" value={row.assemblyId} />
              <ReadonlyField label="DWG" value={row.dwg} />
              <ReadonlyField label="Process" value={row.process} />
              <ReadonlyField label="Total" value={fmt(row.totalQty)} />
              <ReadonlyField label="QC Accepted" value={fmt(row.qcAcceptedQty)} />
              <ReadonlyField label="QC Rejected" value={fmt(row.rejectedQty)} />
              <ReadonlyField
                label="Rework Quantity"
                value={fmt(row.requiredQty)}
              />
            </>
          )}
          <ReadonlyField
            label="Balance To Rework"
            value={fmt(row.balanceQty)}
            emphasize
          />
        </div>
      </div>

      {mode === "start" && (
        <div className="modal-card">
          <h3 className="modal-card-title">Start Rework</h3>
          <div className="modal-form-grid">
            <div className="modal-form-field">
              <label>Rework Done By</label>
              <input
                type="text"
                placeholder="Enter name"
                value={form.by || ""}
                onChange={(e) => update("by", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>Supervisor</label>
              <input
                type="text"
                placeholder="Enter name"
                value={form.supervisor || ""}
                onChange={(e) => update("supervisor", e.target.value)}
              />
            </div>
            <div className="modal-form-field modal-form-field-wide">
              <label>Start Remarks</label>
              <textarea
                rows={3}
                value={form.remarks || ""}
                placeholder="What needs correcting and how it will be corrected..."
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "complete" && (
        <div className="modal-card">
          <h3 className="modal-card-title">Complete Rework</h3>
          <p className="modal-card-subtitle">
            Balance rework quantity: <strong>{fmt(row.balanceQty)}</strong>.
            Enter less than the balance to record a partial completion — the
            remainder stays in this list.
          </p>
          <div className="modal-form-grid">
            <div className="modal-form-field">
              <label>Completed Quantity</label>
              <input
                type="number"
                min="1"
                max={row.balanceQty}
                value={form.qty || ""}
                onChange={(e) => update("qty", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>Completed By</label>
              <input
                type="text"
                placeholder="Enter name"
                value={form.by || ""}
                onChange={(e) => update("by", e.target.value)}
              />
            </div>
            <div className="modal-form-field modal-form-field-wide">
              <label>Completion Remarks</label>
              <textarea
                rows={3}
                value={form.remarks || ""}
                placeholder="What was done to correct it..."
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "qc" && (
        <div className="modal-card">
          <h3 className="modal-card-title">QC Verification</h3>
          <div className="modal-form-grid">
            <div className="modal-form-field">
              <label>QC Verified By</label>
              <input
                type="text"
                placeholder="Enter name"
                value={form.verifiedBy || ""}
                onChange={(e) => update("verifiedBy", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>Result</label>
              <div className="radio-row">
                <label className="radio">
                  <input
                    type="radio"
                    name="qcResult"
                    checked={form.result === "Approved"}
                    onChange={() => update("result", "Approved")}
                  />
                  Approved
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="qcResult"
                    checked={form.result === "Rejected"}
                    onChange={() => update("result", "Rejected")}
                  />
                  Rejected
                </label>
              </div>
            </div>
            <div className="modal-form-field modal-form-field-wide">
              <label>QC Remarks</label>
              <textarea
                rows={3}
                value={form.remarks || ""}
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>
          {form.result === "Rejected" && (
            <p className="modal-card-footnote">
              Rejecting sends this Rework ID back to{" "}
              <strong>Rework Required</strong> for a new rework cycle. The
              existing history is preserved, not deleted.
            </p>
          )}
        </div>
      )}
    </>
  );
}

/* ============================================================
   EYE VIEW — RECEIVE FROM JOB WORK
   ============================================================ */

function EyeViewRjw({ row }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">1. Rework Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Rework ID" value={row.reworkId} emphasize />
          <ReadonlyField label="Source" value="Receive From Job Work" />
          <ReadonlyField label="Status" value={row.status} />
          <ReadonlyField label="Created Date" value={row.createdDate} />
          {row.durationLabel && row.durationLabel !== "—" && (
            <ReadonlyField
              label="Duration"
              value={row.durationLabel}
              emphasize
            />
          )}
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">2. Original PO Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="PO Number" value={row.poNumber} />
          <ReadonlyField label="PO Description" value={row.poDescription} />
          <ReadonlyField label="Project" value={row.project} />
          <ReadonlyField label="DWG" value={row.dwg} />
          <ReadonlyField label="DWG Description" value={row.dwgDescription} />
          <ReadonlyField label="Revision" value={row.revision} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">3. Material &amp; Piece Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Material" value={row.material} />
          <ReadonlyField label="Material Code" value={row.materialCode} />
          <ReadonlyField
            label="Material Specification"
            value={row.materialSpec}
          />
          <ReadonlyField label="Piece Number" value={row.pieceNo} />
          <ReadonlyField label="Thickness" value={row.thickness} />
          <ReadonlyField label="Length" value={row.length} />
          <ReadonlyField label="Width" value={row.width} />
          <ReadonlyField label="Size" value={row.size} />
          <ReadonlyField label="Required Qty" value={fmt(row.requiredQty)} />
          <ReadonlyField label="Completed Qty" value={fmt(row.completedQty)} />
          <ReadonlyField
            label="Balance Qty"
            value={fmt(row.balanceQty)}
            emphasize
          />
          <ReadonlyField label="Unit" value={row.unit} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">4. Original Flow</h3>
        <FlowDiagram
          steps={[
            row.poNumber,
            row.poDescription,
            "GRN",
            "Material Stock",
            "Issue To Job Work",
            "Receive From Job Work",
            "Remaining Piece",
            "Rework Required",
          ]}
        />
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">5. Start Information</h3>
        {row.start ? (
          <div className="readonly-grid">
            <ReadonlyField label="Rework Done By" value={row.start.by} />
            <ReadonlyField label="Supervisor" value={row.start.supervisor} />
            <ReadonlyField label="Start Date" value={row.start.date} />
            <ReadonlyField label="Start Time" value={row.start.time} />
            <ReadonlyField label="Remarks" value={row.start.remarks || "—"} />
          </div>
        ) : (
          <p className="modal-card-subtitle">Rework has not started yet.</p>
        )}
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">6. Completion Information</h3>
        {row.completions.length === 0 ? (
          <p className="modal-card-subtitle">No completion recorded yet.</p>
        ) : (
          row.completions.map((c, idx) => (
            <div className="readonly-grid completion-block" key={idx}>
              <ReadonlyField label="Completed By" value={c.by} />
              <ReadonlyField label="Completed Date" value={c.date} />
              <ReadonlyField label="Completed Time" value={c.time} />
              <ReadonlyField label="Completed Qty" value={fmt(c.qty)} />
              <ReadonlyField label="Remarks" value={c.remarks || "—"} />
            </div>
          ))
        )}
      </div>

      {row.status === STATUS.AVAILABLE_STOCK && (
        <div className="modal-card modal-card-final">
          <h3 className="modal-card-title">7. Material Stock</h3>
          <p className="modal-card-subtitle">
            Piece <strong>{row.pieceNo}</strong> is now Available in Material
            Stock. The original PO / GRN / Job Work linkage is preserved, and
            Rework ID <strong>{row.reworkId}</strong> is kept for traceability.
          </p>
        </div>
      )}

      <div className="modal-card">
        <h3 className="modal-card-title">8. Status History</h3>
        <HistoryTimeline history={row.history} />
      </div>
    </>
  );
}

/* ============================================================
   EYE VIEW — PRODUCTION OPERATION
   ============================================================ */

function EyeViewPo({ row }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">1. Rework Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Rework ID" value={row.reworkId} emphasize />
          <ReadonlyField label="Source" value="Production Operation" />
          <ReadonlyField label="Status" value={row.status} />
          <ReadonlyField label="Created Date" value={row.createdDate} />
          {row.durationLabel && row.durationLabel !== "—" && (
            <ReadonlyField
              label="Duration"
              value={row.durationLabel}
              emphasize
            />
          )}
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">2. Assembly Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Assembly" value={row.assemblyId} />
          <ReadonlyField label="Project" value={row.project} />
          <ReadonlyField label="DWG(s)" value={row.dwg} />
          <ReadonlyField label="Material" value={row.material} />
          <ReadonlyField label="Description" value={row.description} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">
          3. Process &amp; Quantity Information
        </h3>
        <div className="readonly-grid">
          <ReadonlyField label="Process" value={row.process} />
          <ReadonlyField label="Process ID" value={row.processId} />
          <ReadonlyField label="Rework Quantity" value={fmt(row.requiredQty)} />
          <ReadonlyField label="Rework Completed" value={fmt(row.completedQty)} />
          <ReadonlyField
            label="Balance Rework"
            value={fmt(row.balanceQty)}
            emphasize
          />
          <ReadonlyField label="Unit" value={row.unit} />
          <ReadonlyField
            label="QC Required"
            value={row.qcRequired ? "Yes" : "No"}
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">4. Flow</h3>
        <FlowDiagram
          steps={[
            "PO",
            "GRN",
            "Material Stock",
            "Issue To Production",
            `Assembly (${row.assemblyId})`,
            row.process,
            "QC Rejected",
            "Rework Required",
          ]}
        />
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">5. Start Information</h3>
        {row.start ? (
          <div className="readonly-grid">
            <ReadonlyField label="Rework Done By" value={row.start.by} />
            <ReadonlyField label="Supervisor" value={row.start.supervisor} />
            <ReadonlyField label="Start Date" value={row.start.date} />
            <ReadonlyField label="Start Time" value={row.start.time} />
            <ReadonlyField label="Remarks" value={row.start.remarks || "—"} />
          </div>
        ) : (
          <p className="modal-card-subtitle">Rework has not started yet.</p>
        )}
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">6. Completion Information</h3>
        {row.completions.length === 0 ? (
          <p className="modal-card-subtitle">No completion recorded yet.</p>
        ) : (
          row.completions.map((c, idx) => (
            <div className="readonly-grid completion-block" key={idx}>
              <ReadonlyField label="Completed By" value={c.by} />
              <ReadonlyField label="Completed Date" value={c.date} />
              <ReadonlyField label="Completed Time" value={c.time} />
              <ReadonlyField label="Completed Qty" value={fmt(c.qty)} />
              <ReadonlyField label="Remarks" value={c.remarks || "—"} />
            </div>
          ))
        )}
      </div>

      {row.qcRequired && (
        <div className="modal-card">
          <h3 className="modal-card-title">7. QC Verification</h3>
          {row.qc ? (
            <div className="readonly-grid">
              <ReadonlyField label="Verified By" value={row.qc.verifiedBy} />
              <ReadonlyField label="Result" value={row.qc.result} />
              <ReadonlyField label="QC Date" value={row.qc.date} />
              <ReadonlyField label="QC Time" value={row.qc.time} />
              <ReadonlyField label="Remarks" value={row.qc.remarks || "—"} />
            </div>
          ) : (
            <p className="modal-card-subtitle">
              QC verification not recorded yet.
            </p>
          )}
        </div>
      )}

      {row.status === STATUS.READY_NEXT && (
        <div className="modal-card modal-card-final">
          <h3 className="modal-card-title">8. Next Process</h3>
          <p className="modal-card-subtitle">
            The reworked quantity has been released back into the{" "}
            <strong>{row.assemblyId}</strong> process chain. The next process
            can now receive it.
          </p>
        </div>
      )}

      <div className="modal-card">
        <h3 className="modal-card-title">9. Status History</h3>
        <HistoryTimeline history={row.history} />
      </div>
    </>
  );
}

/* ============================================================
   SMALL SHARED BITS
   ============================================================ */

function FlowDiagram({ steps }) {
  return (
    <div className="flow">
      {steps.map((step, idx) => (
        <div className="flow-row" key={idx}>
          <span
            className={`flow-step ${
              idx === steps.length - 1 ? "flow-step-final" : ""
            }`}
          >
            {step}
          </span>
          {idx < steps.length - 1 && <span className="flow-arrow">↓</span>}
        </div>
      ))}
    </div>
  );
}

function HistoryTimeline({ history }) {
  if (history.length === 0) {
    return <p className="modal-card-subtitle">No history recorded yet.</p>;
  }
  return (
    <ol className="timeline">
      {history.map((h, idx) => (
        <li className="timeline-item" key={idx}>
          <span className="timeline-dot" />
          <div className="timeline-content">
            <div className="timeline-date">
              {h.date} · {h.time}
            </div>
            <div className="timeline-event">{h.event}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReadonlyField({ label, value, emphasize }) {
  return (
    <div className="readonly-field">
      <label className="readonly-label">{label}</label>
      <div
        className={`readonly-value ${
          emphasize ? "readonly-value-emphasis" : ""
        }`}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}