import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  X,
  Eye,
  Truck,
  Clock,
  Package,
  RefreshCw,
  AlertCircle,
  FileText,
  Filter,
  Layers,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./Dispatch.css";

const API_BASE = "/erp/material";
const GENERIC_ERROR = "Something went wrong. Please try again.";

/* =========================================================================
   Helpers
   ========================================================================= */
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

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const parseISO = (iso) => new Date(`${iso}T00:00:00`);

const formatDate = (iso) => {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysBetween = (fromIso, toIso) => {
  const MS_DAY = 1000 * 60 * 60 * 24;
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / MS_DAY);
};

const dispatchDiffLabel = (dispatchIso, endIso) => {
  if (!dispatchIso || !endIso) return "—";
  const n = daysBetween(endIso, dispatchIso);
  if (n === 0) return "Same Day · 0 Days";
  if (n > 0) return `${n} Day${n === 1 ? "" : "s"} After Production`;
  return `${Math.abs(n)} Day${
    Math.abs(n) === 1 ? "" : "s"
  } Before Production Completion`;
};

/* =========================================================================
   Modal shell — inline styles (immune to CSS cascade issues)
   ========================================================================= */
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "90px 24px 32px",
  overflowY: "auto",
  zIndex: 99999,
};

const modalBoxStyle = {
  background: "#ffffff",
  borderRadius: 12,
  width: "100%",
  maxWidth: 900,
  maxHeight: "calc(100vh - 120px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.3)",
};

/* =========================================================================
   Filter config — ready-list tab
   ========================================================================= */
const READY_FILTER_FIELDS = [
  { key: "assemblyId", label: "Assembly", type: "text" },
  { key: "project", label: "Project", type: "select" },
  { key: "dwgText", label: "DWG", type: "text" },
  { key: "revision", label: "Revision", type: "select" },
  { key: "dcText", label: "DC Ref", type: "text" },
  { key: "dispatchStatus", label: "Dispatch Status", type: "select" },
  { key: "completionStatus", label: "Completion Status", type: "select" },
];

/* =========================================================================
   Filter config — history tab
   ========================================================================= */
const HISTORY_DEBOUNCE_MS = 350;
const EMPTY_HISTORY_FILTERS = {
  assembly: "",
  project: "",
  dc: "",
  driver: "",
  vehicle: "",
  from: "",
  to: "",
};

// Route opened by "Open DC-xxx" in the history detail drawer.
// Change this to match the Delivery Challan route in your router.
const dcPath = (deliveryChallanId) => `/delivery-challan/${deliveryChallanId}`;

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
    return f.type === "select"
      ? rowVal === val.toLowerCase()
      : rowVal.includes(val.toLowerCase());
  });

const withinDateRange = (iso, from, to) => {
  if (!iso) return !from && !to;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
};

/* =========================================================================
   History helpers
   ========================================================================= */
const norm = (v) => String(v ?? "").toLowerCase();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const monthKey = (iso) => (iso || "").slice(0, 7); // "2026-10"
const monthLabel = (key) =>
  key
    ? parseISO(`${key}-01`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : "Undated";

const formatStamp = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/* Newest first: dispatch date desc, then createdAt desc as tiebreaker.
   ISO strings sort correctly as plain strings, so no Date parsing needed. */
const byNewest = (a, b) =>
  (b.date || "").localeCompare(a.date || "") ||
  (b.createdAt || "").localeCompare(a.createdAt || "");

/* Client-side search covers every field visible in the row or drawer. */
const HISTORY_SEARCH_FIELDS = [
  "dispatchId",
  "dcChallanNumber",
  "assemblyId",
  "project",
  "dwgDescription",
  "dispatchTo",
  "location",
  "vehicleNumber",
  "transporter",
  "driverName",
  "driverContact",
  "remarks",
];

const matchesHistoryRow = (row, q, f) => {
  if (q && !HISTORY_SEARCH_FIELDS.some((k) => norm(row[k]).includes(q)))
    return false;
  if (f.assembly && !norm(row.assemblyId).includes(norm(f.assembly)))
    return false;
  if (f.project && norm(row.project) !== norm(f.project)) return false;
  if (f.dc && !norm(row.dcChallanNumber).includes(norm(f.dc))) return false;
  if (f.driver && !norm(row.driverName).includes(norm(f.driver))) return false;
  if (f.vehicle && !norm(row.vehicleNumber).includes(norm(f.vehicle)))
    return false;
  return withinDateRange(row.date, f.from, f.to);
};

/* Grouping: rows arrive already sorted newest-first. One pass buckets them
   into a Map (insertion-ordered), so groups come out in the order their
   first row appears — months newest-first, or assemblies by latest shipment. */
const groupHistoryRows = (rows, mode) => {
  const map = new Map();
  for (const r of rows) {
    const key = mode === "assembly" ? r.assemblyId || "—" : monthKey(r.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map].map(([key, items]) => ({
    key,
    title: mode === "assembly" ? key : monthLabel(key),
    count: items.length,
    qty: items.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    items,
  }));
};

/* =========================================================================
   Dispatch form defaults
   ========================================================================= */
const emptyDispatchForm = () => ({
  date: today(),
  time: nowTime(),
  dispatchTo: "",
  location: "",
  vehicleNumber: "",
  transporter: "",
  driverName: "",
  driverContact: "",
  qty: "",
  remarks: "",
  dcChallanNumber: "",
});

/* =========================================================================
   Main component
   ========================================================================= */
export default function Dispatch() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [activeTab, setActiveTab] = useState("ready"); // "ready" | "history"

  /* ---------- ready list state ---------- */
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProject, setSelectedProject] = useState("All Projects");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [dateFilters, setDateFilters] = useState({
    endFrom: "",
    endTo: "",
    plannedFrom: "",
    plannedTo: "",
    actualFrom: "",
    actualTo: "",
    dispatchFrom: "",
    dispatchTo: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ---------- history state ---------- */
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilters, setHistoryFilters] = useState(EMPTY_HISTORY_FILTERS);
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [historyGroupMode, setHistoryGroupMode] = useState("month"); // "month" | "assembly"
  const [historySelected, setHistorySelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------- modals ---------- */
  const [viewAssemblyId, setViewAssemblyId] = useState(null);
  const [dispatchAssemblyId, setDispatchAssemblyId] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* ============================================================
     Fetch ready list
     ============================================================ */
  const fetchReady = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const params = {};
        if (filters.project) params.project = filters.project;

        const res = await api.get(`${API_BASE}/dispatch/ready/`, {
          headers: authHeaders(),
          params,
        });
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setAssemblies(rows);
      } catch (err) {
        console.error(err);
        setError(getApiError(err, "Failed to load dispatch data."));
        setAssemblies([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders, filters.project]
  );

  /* ============================================================
     Fetch history
     Only the params the backend understands are sent. Project, driver and
     vehicle are filtered client-side only.
     ============================================================ */
  const historyParams = useMemo(() => {
    const p = {};
    if (historySearch.trim()) p.search = historySearch.trim();
    if (historyFilters.assembly.trim())
      p.assemblyId = historyFilters.assembly.trim();
    if (historyFilters.dc.trim()) p.dcChallanNumber = historyFilters.dc.trim();
    if (historyFilters.from) p.dateFrom = historyFilters.from;
    if (historyFilters.to) p.dateTo = historyFilters.to;
    return p;
  }, [
    historySearch,
    historyFilters.assembly,
    historyFilters.dc,
    historyFilters.from,
    historyFilters.to,
  ]);

  // Guards against out-of-order responses: only the latest request may
  // write to state.
  const historyRequestId = useRef(0);

  const fetchHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      const id = ++historyRequestId.current;
      if (!silent) setHistoryLoading(true);
      setHistoryError("");
      try {
        const res = await api.get(`${API_BASE}/dispatch/history/`, {
          headers: authHeaders(),
          params: historyParams,
        });
        if (id !== historyRequestId.current) return;
        setHistory(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        if (id !== historyRequestId.current) return;
        console.error(err);
        setHistoryError(getApiError(err, "Failed to load dispatch history."));
        setHistory([]);
      } finally {
        if (id === historyRequestId.current) setHistoryLoading(false);
      }
    },
    [accessToken, authHeaders, historyParams]
  );

  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setLoading(false);
      return;
    }
    fetchReady();
  }, [accessToken, fetchReady]);

  /* Debounced background refetch for the history tab.
     - First visit fetches immediately and shows skeleton rows.
     - Afterwards every search/filter change waits HISTORY_DEBOUNCE_MS after
       the last keystroke, then refetches "silently": the list stays on
       screen (already filtered client-side) and the server result just
       keeps counts accurate. The cleanup cancels a pending timer whenever
       the params change again. */
  const historyLoadedOnce = useRef(false);
  useEffect(() => {
    if (activeTab !== "history" || !accessToken) return undefined;
    if (!historyLoadedOnce.current) {
      historyLoadedOnce.current = true;
      fetchHistory();
      return undefined;
    }
    const t = setTimeout(
      () => fetchHistory({ silent: true }),
      HISTORY_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [activeTab, accessToken, fetchHistory]);

  /* ============================================================
     Derived lists
     ============================================================ */
  const rows = useMemo(
    () =>
      assemblies.map((a) => ({
        ...a,
        dwgText: a.dwgText || (a.dwgs || []).join(" + "),
        dcText: (a.dcReferences || []).join(" "),
      })),
    [assemblies]
  );

  const projectOptions = useMemo(
    () =>
      ["All Projects", ...new Set(rows.map((r) => r.project))].sort((a, b) =>
        a === "All Projects"
          ? -1
          : b === "All Projects"
          ? 1
          : a.localeCompare(b)
      ),
    [rows]
  );

  const projectRows = useMemo(
    () =>
      selectedProject === "All Projects"
        ? rows
        : rows.filter((r) => r.project === selectedProject),
    [rows, selectedProject]
  );

  const filteredRows = useMemo(
    () =>
      projectRows.filter((r) => {
        if (!matchesFilters(r, filters, READY_FILTER_FIELDS)) return false;

        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const haystack = [
            r.assemblyId,
            r.project,
            r.dwgText,
            r.description,
            r.dispatchStatus,
            r.completionStatus,
            (r.dcReferences || []).join(" "),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        if (
          !withinDateRange(
            r.productionEndDate,
            dateFilters.endFrom,
            dateFilters.endTo
          )
        )
          return false;
        if (
          !withinDateRange(
            r.plannedEndDate,
            dateFilters.plannedFrom,
            dateFilters.plannedTo
          )
        )
          return false;
        if (
          !withinDateRange(
            r.actualEndDate,
            dateFilters.actualFrom,
            dateFilters.actualTo
          )
        )
          return false;
        if (
          (dateFilters.dispatchFrom || dateFilters.dispatchTo) &&
          !withinDateRange(
            r.lastDispatchDate || "",
            dateFilters.dispatchFrom,
            dateFilters.dispatchTo
          )
        )
          return false;

        return true;
      }),
    [projectRows, filters, search, dateFilters]
  );

  const filterOptions = useMemo(
    () => buildOptionsMap(projectRows, READY_FILTER_FIELDS),
    [projectRows]
  );

  /* ============================================================
     History derived
     ============================================================ */
  const historyProjectOptions = useMemo(
    () => [...new Set(history.map((h) => h.project))].filter(Boolean).sort(),
    [history]
  );

  const filteredHistory = useMemo(() => {
    const q = norm(historySearch.trim());
    return history
      .filter((h) => matchesHistoryRow(h, q, historyFilters))
      .sort(byNewest);
  }, [history, historySearch, historyFilters]);

  const historyGroups = useMemo(
    () => groupHistoryRows(filteredHistory, historyGroupMode),
    [filteredHistory, historyGroupMode]
  );

  // Summary cards reflect the currently filtered rows.
  const historySummary = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      shipments: filteredHistory.length,
      qty: filteredHistory.reduce((s, r) => s + (Number(r.qty) || 0), 0),
      month: filteredHistory.filter((r) => monthKey(r.date) === thisMonth)
        .length,
      dcs: new Set(
        filteredHistory.map((r) => r.dcChallanNumber).filter(Boolean)
      ).size,
    };
  }, [filteredHistory]);

  const historyActiveFilterCount = Object.values(historyFilters).filter(
    Boolean
  ).length;

  /* ============================================================
     Modal targets
     ============================================================ */
  const viewAssembly = viewAssemblyId
    ? rows.find((a) => a.assemblyId === viewAssemblyId)
    : null;

  const dispatchAssembly = dispatchAssemblyId
    ? rows.find((a) => a.assemblyId === dispatchAssemblyId)
    : null;

  /* ============================================================
     Handlers
     ============================================================ */
  const handleProjectChange = (value) => {
    setSelectedProject(value);
    setFilters({});
    setSearch("");
    setFiltersOpen(false);
  };

  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const handleDateFilterChange = (key, value) =>
    setDateFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => {
    setFilters({});
    setSearch("");
    setDateFilters({
      endFrom: "",
      endTo: "",
      plannedFrom: "",
      plannedTo: "",
      actualFrom: "",
      actualTo: "",
      dispatchFrom: "",
      dispatchTo: "",
    });
  };

  const handleHistoryFilterChange = (key, value) =>
    setHistoryFilters((f) => ({ ...f, [key]: value }));

  const clearHistoryFilters = () => {
    setHistoryFilters(EMPTY_HISTORY_FILTERS);
    setHistorySearch("");
  };

  const openView = (assemblyId) => setViewAssemblyId(assemblyId);
  const closeView = () => setViewAssemblyId(null);

  const openDispatch = (assemblyId) => {
    setDispatchAssemblyId(assemblyId);
    setForm(emptyDispatchForm());
    setFormError("");
    setFormWarning("");
  };

  const closeDispatch = () => {
    setDispatchAssemblyId(null);
    setForm({});
    setFormError("");
    setFormWarning("");
  };

  const updateForm = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormWarning("");
  };

  const handleSaveDispatch = async () => {
    if (!form.date) return setFormError("Dispatch Date is required.");
    if (!form.dispatchTo.trim())
      return setFormError("Dispatch destination is required.");
    const qty = Number(form.qty);
    if (!form.qty || qty <= 0)
      return setFormError("Dispatch Quantity is required.");
    if (qty > dispatchAssembly.balanceQty) {
      return setFormError(
        "Dispatch quantity cannot exceed finished quantity."
      );
    }

    setSaving(true);
    setFormError("");
    try {
      await api.post(
        `${API_BASE}/dispatch/create/${dispatchAssembly.assemblyId}/`,
        {
          date: form.date,
          time: form.time,
          dispatchTo: form.dispatchTo.trim(),
          location: form.location.trim(),
          vehicleNumber: form.vehicleNumber.trim(),
          transporter: form.transporter.trim(),
          driverName: form.driverName.trim(),
          driverContact: form.driverContact.trim(),
          qty,
          remarks: form.remarks.trim(),
          dcChallanNumber: (form.dcChallanNumber || "").trim(),
        },
        { headers: authHeaders() }
      );
      await fetchReady({ silent: true });
      closeDispatch();
    } catch (err) {
      setFormError(getApiError(err, "Failed to save dispatch."));
    } finally {
      setSaving(false);
    }
  };

  const handleDateBlurCheck = () => {
    if (!form.date || !dispatchAssembly) return;
    if (
      dispatchAssembly.productionEndDate &&
      form.date < dispatchAssembly.productionEndDate
    ) {
      setFormWarning("Dispatch date is before production completion date.");
    } else {
      setFormWarning("");
    }
  };

  const handleBack = () => navigate("/inventory/material");

  /* ============================================================
     Render
     ============================================================ */
  return (
    <>
      <Header />
      <div className="material-page">
        <div className="material-content">
          {/* PAGE HEADER */}
          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>
              <div className="page-header-title-group">
                <h1 className="page-header-title">Dispatch</h1>
                <p className="page-header-subtitle">
                  Completed assemblies ready for dispatch. Planned End is
                  the project target; Actual End is the last QC-accepted
                  process date.
                </p>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                activeTab === "ready"
                  ? fetchReady({ silent: true })
                  : fetchHistory({ silent: true })
              }
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw size={14} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* TABS */}
          <div className="dsp-tabs">
            <button
              type="button"
              className={`dsp-tab ${
                activeTab === "ready" ? "dsp-tab-active" : ""
              }`}
              onClick={() => setActiveTab("ready")}
            >
              <Package size={14} />
              Ready for Dispatch
              <span className="dsp-tab-count">{rows.length}</span>
            </button>
            <button
              type="button"
              className={`dsp-tab ${
                activeTab === "history" ? "dsp-tab-active" : ""
              }`}
              onClick={() => setActiveTab("history")}
            >
              <Clock size={14} />
              Dispatch History
              <span className="dsp-tab-count">{history.length}</span>
            </button>
          </div>

          {/* READY TAB */}
          {activeTab === "ready" && (
            <>
              <div className="project-bar">
                <label htmlFor="project-select" className="project-label">
                  Project
                </label>
                <select
                  id="project-select"
                  className="project-select"
                  value={selectedProject}
                  onChange={(e) => handleProjectChange(e.target.value)}
                >
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <span className="project-hint">
                  Showing completed assemblies under{" "}
                  <strong>{selectedProject}</strong>
                </span>
              </div>

              {loading && (
                <div className="grn-state-block">
                  <Loading />
                </div>
              )}

              {!loading && error && (
                <div className="grn-state-block">
                  <Error onRetry={fetchReady} />
                </div>
              )}

              {!loading && !error && (
                <div className="panel">
                  <Toolbar
                    search={search}
                    onSearchChange={setSearch}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    dateFilters={dateFilters}
                    onDateFilterChange={handleDateFilterChange}
                    options={filterOptions}
                    onClear={clearFilters}
                    open={filtersOpen}
                    onToggleOpen={() => setFiltersOpen((o) => !o)}
                    fields={READY_FILTER_FIELDS}
                    resultCount={filteredRows.length}
                    searchPlaceholder="Search Assembly, Project, DWG, DC, Vehicle..."
                  />

                  <div className="table-scroll-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Assembly ID</th>
                          <th>Project</th>
                          <th>DWG / Description</th>
                          <th>Revision</th>
                          <th>Production</th>
                          <th>Planned End</th>
                          <th>Actual End</th>
                          <th>Completion</th>
                          <th>Quantity</th>
                          <th>DC Ref</th>
                          <th>Dispatch Status</th>
                          <th className="cell-action">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 && (
                          <tr>
                            <td colSpan={12}>
                              <div className="empty-state">
                                <div className="empty-state-icon">
                                  🚚
                                </div>
                                <p className="empty-state-title">
                                  No Assemblies Ready For Dispatch
                                </p>
                                <p className="empty-state-desc">
                                  Nothing matches the current project /
                                  search / filters.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {filteredRows.map((row) => {
                          const lastDc =
                            row.dispatches && row.dispatches.length
                              ? row.dispatches[
                                  row.dispatches.length - 1
                                ].dcChallanNumber
                              : "";

                          return (
                            <tr key={row.assemblyId}>
                              <td className="cell-id">
                                {row.assemblyId}
                              </td>
                              <td>
                                <span className="project-chip-sm">
                                  {row.project}
                                </span>
                              </td>
                              <td>
                                <div className="dwg-cell">
                                  {row.dwgText}
                                </div>
                                <div className="desc-cell">
                                  {row.description}
                                </div>
                              </td>
                              <td>{row.revision}</td>
                              <td>
                                <div className="prod-dates">
                                  {formatDate(row.productionStartDate)}{" "}
                                  → {formatDate(row.productionEndDate)}
                                </div>
                                <div className="prod-duration">
                                  {row.duration}
                                </div>
                              </td>
                              <td>
                                <div className="prod-dates">
                                  {formatDate(row.plannedEndDate)}
                                </div>
                              </td>
                              <td>
                                <div className="prod-dates">
                                  {formatDate(row.actualEndDate)}
                                </div>
                              </td>
                              <td>
                                <CompletionBadge
                                  status={row.completionStatus}
                                  planned={row.plannedEndDate}
                                  actual={row.actualEndDate}
                                  variance={row.completionDaysVariance}
                                />
                              </td>
                              <td>
                                <div className="qty-cell">
                                  <span className="qty-total">
                                    {row.plannedQty} Total
                                  </span>
                                  <span className="qty-sub">
                                    {row.dispatchedQty} Dispatched ·{" "}
                                    {row.balanceQty} Balance
                                  </span>
                                </div>
                              </td>
                              <td>
                                {lastDc ? (
                                  <span className="dc-ref">{lastDc}</span>
                                ) : (
                                  <span className="dc-ref-empty">
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <DispatchStatusBadge
                                  status={row.dispatchStatus}
                                />
                              </td>
                              <td>
                                <div className="action-cell">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openView(row.assemblyId)
                                    }
                                    className="icon-btn"
                                    title="View Details"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  {row.balanceQty > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDispatch(row.assemblyId)
                                      }
                                      className="btn btn-primary btn-sm"
                                    >
                                      <Truck size={13} />
                                      Dispatch
                                    </button>
                                  ) : (
                                    <span className="locked-pill">
                                      Dispatched
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="dsp-history-root">
              {/* Toolbar */}
              <div className="dsp-history-toolbar">
                <div className="dsp-history-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search Dispatch ID, DC, Assembly, Vehicle, Driver..."
                    aria-label="Search dispatch history"
                  />
                </div>

                <button
                  type="button"
                  className={`dsp-history-btn ${
                    historyFiltersOpen ? "is-active" : ""
                  }`}
                  onClick={() => setHistoryFiltersOpen((o) => !o)}
                  aria-expanded={historyFiltersOpen}
                  aria-controls="dsp-history-filter-panel"
                  title="Toggle filters"
                >
                  <Filter size={15} aria-hidden="true" />
                  Filters
                  {historyActiveFilterCount > 0 && (
                    <span className="dsp-history-badge">
                      {historyActiveFilterCount}
                    </span>
                  )}
                </button>

                <div
                  className="dsp-history-seg"
                  role="group"
                  aria-label="Group by"
                >
                  <Layers size={14} aria-hidden="true" />
                  {[
                    ["month", "Month"],
                    ["assembly", "Assembly"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={historyGroupMode === val ? "is-on" : ""}
                      aria-pressed={historyGroupMode === val}
                      onClick={() => setHistoryGroupMode(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="dsp-history-btn dsp-history-btn-quiet"
                  onClick={clearHistoryFilters}
                  disabled={
                    historyActiveFilterCount === 0 && !historySearch.trim()
                  }
                  title="Clear search and filters"
                >
                  <X size={15} aria-hidden="true" />
                  Clear
                </button>
              </div>

              {/* Collapsible filter panel */}
              {historyFiltersOpen && (
                <div
                  id="dsp-history-filter-panel"
                  className="dsp-history-filters"
                  role="region"
                  aria-label="Filters"
                >
                  <label className="dsp-history-field">
                    <span>Assembly</span>
                    <input
                      value={historyFilters.assembly}
                      onChange={(e) =>
                        handleHistoryFilterChange("assembly", e.target.value)
                      }
                    />
                  </label>
                  <label className="dsp-history-field">
                    <span>Project</span>
                    <select
                      value={historyFilters.project}
                      onChange={(e) =>
                        handleHistoryFilterChange("project", e.target.value)
                      }
                    >
                      <option value="">All projects</option>
                      {historyProjectOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dsp-history-field">
                    <span>DC Number</span>
                    <input
                      value={historyFilters.dc}
                      onChange={(e) =>
                        handleHistoryFilterChange("dc", e.target.value)
                      }
                    />
                  </label>
                  <label className="dsp-history-field">
                    <span>Driver</span>
                    <input
                      value={historyFilters.driver}
                      onChange={(e) =>
                        handleHistoryFilterChange("driver", e.target.value)
                      }
                    />
                  </label>
                  <label className="dsp-history-field">
                    <span>Vehicle</span>
                    <input
                      value={historyFilters.vehicle}
                      onChange={(e) =>
                        handleHistoryFilterChange("vehicle", e.target.value)
                      }
                    />
                  </label>
                  <fieldset className="dsp-history-field dsp-history-range">
                    <legend>Dispatch Date</legend>
                    <input
                      type="date"
                      value={historyFilters.from}
                      max={historyFilters.to || undefined}
                      onChange={(e) =>
                        handleHistoryFilterChange("from", e.target.value)
                      }
                      aria-label="Dispatch date from"
                    />
                    <span aria-hidden="true">to</span>
                    <input
                      type="date"
                      value={historyFilters.to}
                      min={historyFilters.from || undefined}
                      onChange={(e) =>
                        handleHistoryFilterChange("to", e.target.value)
                      }
                      aria-label="Dispatch date to"
                    />
                  </fieldset>
                </div>
              )}

              {/* Summary strip */}
              <div className="dsp-history-summary">
                <HistoryMetric
                  value={historySummary.shipments}
                  label="Total Shipments"
                />
                <HistoryMetric
                  value={historySummary.qty}
                  label="Total Quantity Dispatched"
                />
                <HistoryMetric
                  value={historySummary.month}
                  label="Shipments This Month"
                />
                <HistoryMetric
                  value={historySummary.dcs}
                  label="DCs Attached"
                />
              </div>

              {/* Inline error banner */}
              {historyError && (
                <div className="dsp-history-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{historyError}</span>
                  <button type="button" onClick={() => fetchHistory()}>
                    Retry
                  </button>
                </div>
              )}

              {/* History table */}
              <div className="dsp-history-scroll">
                <table className="dsp-history-table" role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col">Dispatch ID</th>
                      <th scope="col">Date &amp; Time</th>
                      <th scope="col">Assembly &amp; Project</th>
                      <th scope="col">DC Number</th>
                      <th scope="col">Destination</th>
                      <th scope="col">Vehicle &amp; Driver</th>
                      <th scope="col" className="is-num">
                        Quantity
                      </th>
                      <th scope="col" className="is-act">
                        <span className="dsp-history-sr">Actions</span>
                      </th>
                    </tr>
                  </thead>

                  {historyLoading ? (
                    <tbody role="rowgroup" aria-busy="true">
                      {[0, 1, 2].map((i) => (
                        <tr key={i} role="row" className="dsp-history-skel">
                          {Array.from({ length: 8 }).map((_, c) => (
                            <td key={c} role="cell">
                              <span className="dsp-history-bar" />
                              {c < 6 && (
                                <span className="dsp-history-bar is-short" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  ) : (
                    historyGroups.map((g) => (
                      <tbody key={g.key} role="rowgroup">
                        {/* Sticky group sub-header: one full-width cell keeps
                            it a valid table row that sticks under <thead>. */}
                        <tr role="row" className="dsp-history-group">
                          <th scope="colgroup" colSpan={8}>
                            {g.title}
                            <span>
                              {plural(g.count, "shipment")} ·{" "}
                              {plural(g.qty, "unit")}
                            </span>
                          </th>
                        </tr>
                        {g.items.map((r) => (
                          <HistoryRow
                            key={r.id ?? r.dispatchId}
                            row={r}
                            onOpen={setHistorySelected}
                          />
                        ))}
                      </tbody>
                    ))
                  )}
                </table>

                {!historyLoading &&
                  !historyError &&
                  filteredHistory.length === 0 && (
                    <div className="dsp-history-empty">
                      <Truck size={36} aria-hidden="true" />
                      <h3>No Dispatch Records</h3>
                      <p>
                        Nothing matches the current search or filters. Try
                        clearing filters or pick a different project.
                      </p>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EYE VIEW MODAL */}
      {viewAssembly && (
        <div onClick={closeView} style={overlayStyle}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={modalBoxStyle}
          >
            <div className="modal-head">
              <div>
                <h2 className="modal-title">
                  {viewAssembly.assemblyId}
                </h2>
                <p className="modal-subtitle">
                  Project : <strong>{viewAssembly.project}</strong> ·
                  DWG(s) : <strong>{viewAssembly.dwgText}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeView}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <EyeViewBody assembly={viewAssembly} />
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

      {/* DISPATCH FORM MODAL */}
      {dispatchAssembly && (
        <div style={overlayStyle}>
          <div style={modalBoxStyle}>
            <div className="modal-head">
              <div>
                <h2 className="modal-title">Dispatch Assembly</h2>
                <p className="modal-subtitle">
                  Assembly :{" "}
                  <strong>{dispatchAssembly.assemblyId}</strong> ·
                  Balance : <strong>{dispatchAssembly.balanceQty}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeDispatch}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <DispatchFormBody
                assembly={dispatchAssembly}
                form={form}
                setForm={updateForm}
                onDateBlur={handleDateBlurCheck}
              />
              {formWarning && (
                <div className="warning-box">{formWarning}</div>
              )}
              {formError && <div className="error-box">{formError}</div>}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={closeDispatch}
                className="btn btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDispatch}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY DETAIL DRAWER */}
      {historySelected && (
        <HistoryDetailModal
          row={historySelected}
          onClose={() => setHistorySelected(null)}
          onOpenDc={(r) => navigate(dcPath(r.deliveryChallanId))}
        />
      )}
    </>
  );
}

/* =========================================================================
   Toolbar (search + filters + date ranges) — reused by both tabs
   ========================================================================= */
function Toolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  dateFilters,
  onDateFilterChange,
  options,
  onClear,
  open,
  onToggleOpen,
  fields,
  resultCount,
  searchPlaceholder,
  extraFilter,
}) {
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    Object.values(dateFilters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder={searchPlaceholder || "Search..."}
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
                  onChange={(e) =>
                    onFilterChange(f.key, e.target.value)
                  }
                >
                  <option value="">All</option>
                  {(options[f.key] || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filters[f.key] || ""}
                  placeholder={`Filter by ${f.label}`}
                  onChange={(e) =>
                    onFilterChange(f.key, e.target.value)
                  }
                />
              )}
            </div>
          ))}

          {extraFilter}

          <div className="form-field">
            <label>Production End Date</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFilters.endFrom ?? ""}
                onChange={(e) =>
                  onDateFilterChange("endFrom", e.target.value)
                }
              />
              <span>to</span>
              <input
                type="date"
                value={dateFilters.endTo ?? ""}
                onChange={(e) =>
                  onDateFilterChange("endTo", e.target.value)
                }
              />
            </div>
          </div>

          <div className="form-field">
            <label>Planned End Date</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFilters.plannedFrom ?? ""}
                onChange={(e) =>
                  onDateFilterChange("plannedFrom", e.target.value)
                }
              />
              <span>to</span>
              <input
                type="date"
                value={dateFilters.plannedTo ?? ""}
                onChange={(e) =>
                  onDateFilterChange("plannedTo", e.target.value)
                }
              />
            </div>
          </div>

          <div className="form-field">
            <label>Actual End Date</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFilters.actualFrom ?? ""}
                onChange={(e) =>
                  onDateFilterChange("actualFrom", e.target.value)
                }
              />
              <span>to</span>
              <input
                type="date"
                value={dateFilters.actualTo ?? ""}
                onChange={(e) =>
                  onDateFilterChange("actualTo", e.target.value)
                }
              />
            </div>
          </div>

          <div className="form-field">
            <label>Dispatch Date</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFilters.dispatchFrom ?? dateFilters.from ?? ""}
                onChange={(e) =>
                  onDateFilterChange(
                    dateFilters.dispatchFrom !== undefined
                      ? "dispatchFrom"
                      : "from",
                    e.target.value
                  )
                }
              />
              <span>to</span>
              <input
                type="date"
                value={dateFilters.dispatchTo ?? dateFilters.to ?? ""}
                onChange={(e) =>
                  onDateFilterChange(
                    dateFilters.dispatchTo !== undefined
                      ? "dispatchTo"
                      : "to",
                    e.target.value
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      <p className="result-count">
        {resultCount} record{resultCount !== 1 ? "s" : ""} found
      </p>
    </div>
  );
}

/* =========================================================================
   Dispatch form body
   ========================================================================= */
function DispatchFormBody({ assembly, form, setForm, onDateBlur }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Assembly Information</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Assembly ID"
            value={assembly.assemblyId}
            emphasize
          />
          <ReadonlyField label="Project" value={assembly.project} />
          <ReadonlyField label="DWG" value={assembly.dwgText} />
          <ReadonlyField label="Revision" value={assembly.revision} />
          <ReadonlyField
            label="Quantity"
            value={`${assembly.plannedQty} (Balance ${assembly.balanceQty})`}
          />
          <ReadonlyField
            label="Production Start Date"
            value={formatDate(assembly.productionStartDate)}
          />
          <ReadonlyField
            label="Production End Date"
            value={formatDate(assembly.productionEndDate)}
          />
          <ReadonlyField
            label="Planned End Date"
            value={formatDate(assembly.plannedEndDate)}
          />
          <ReadonlyField
            label="Actual End Date"
            value={formatDate(assembly.actualEndDate)}
          />
          <ReadonlyField
            label="Completion Status"
            value={assembly.completionStatus || "—"}
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">Dispatch Information</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Dispatch Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm("date", e.target.value)}
              onBlur={onDateBlur}
            />
          </div>
          <div className="form-field">
            <label>Dispatch Time</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm("time", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Dispatch To / Destination</label>
            <input
              type="text"
              placeholder="e.g. BHEL"
              value={form.dispatchTo}
              onChange={(e) => setForm("dispatchTo", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Dispatch Location</label>
            <input
              type="text"
              placeholder="e.g. Chennai Plant"
              value={form.location}
              onChange={(e) => setForm("location", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Vehicle Number</label>
            <input
              type="text"
              placeholder="e.g. TN01AB1234"
              value={form.vehicleNumber}
              onChange={(e) => setForm("vehicleNumber", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Transporter</label>
            <input
              type="text"
              value={form.transporter}
              onChange={(e) => setForm("transporter", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Driver Name</label>
            <input
              type="text"
              value={form.driverName}
              onChange={(e) => setForm("driverName", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Driver Contact Number</label>
            <input
              type="tel"
              value={form.driverContact}
              onChange={(e) => setForm("driverContact", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Dispatch Quantity</label>
            <input
              type="number"
              min="0"
              max={assembly.balanceQty}
              value={form.qty}
              onChange={(e) => setForm("qty", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Delivery Challan Number</label>
            <input
              type="text"
              placeholder="e.g. DC-014 (optional)"
              value={form.dcChallanNumber || ""}
              onChange={(e) =>
                setForm("dcChallanNumber", e.target.value)
              }
            />
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 12 }}>
          <label>Remarks</label>
          <textarea
            rows={3}
            placeholder="Optional notes..."
            value={form.remarks}
            onChange={(e) => setForm("remarks", e.target.value)}
          />
        </div>
        {form.date && assembly.productionEndDate && (
          <p className="modal-card-footnote">
            Dispatch Difference:{" "}
            <strong>
              {dispatchDiffLabel(form.date, assembly.productionEndDate)}
            </strong>
          </p>
        )}
      </div>
    </>
  );
}

/* =========================================================================
   Eye view body
   ========================================================================= */
function EyeViewBody({ assembly }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">1. Assembly Information</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Assembly ID"
            value={assembly.assemblyId}
            emphasize
          />
          <ReadonlyField label="Project" value={assembly.project} />
          <ReadonlyField label="DWG" value={assembly.dwgText} />
          <ReadonlyField label="Revision" value={assembly.revision} />
          <ReadonlyField label="Description" value={assembly.description} />
          <ReadonlyField label="Total Quantity" value={assembly.plannedQty} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">
          2. Timeline — Planned vs Actual
        </h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Production Start"
            value={formatDate(assembly.productionStartDate)}
          />
          <ReadonlyField
            label="Production End"
            value={formatDate(assembly.productionEndDate)}
          />
          <ReadonlyField
            label="Production Duration"
            value={assembly.duration}
            emphasize
          />
          <ReadonlyField
            label="Planned End Date"
            value={formatDate(assembly.plannedEndDate)}
            emphasize
          />
          <ReadonlyField
            label="Actual End Date"
            value={formatDate(assembly.actualEndDate)}
            emphasize
          />
          <ReadonlyField
            label="Completion Status"
            value={assembly.completionStatus || "—"}
          />
          <ReadonlyField
            label="Days Variance"
            value={
              assembly.completionDaysVariance != null
                ? assembly.completionDaysVariance > 0
                  ? `${assembly.completionDaysVariance} Days Late`
                  : assembly.completionDaysVariance < 0
                  ? `${Math.abs(
                      assembly.completionDaysVariance
                    )} Days Early`
                  : "On Time"
                : "—"
            }
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">3. Process Completion</h3>
        <ol className="process-chain">
          {(assembly.processChain || []).map((s, idx) => (
            <li
              key={idx}
              className="process-chain-step process-chain-done"
            >
              <span className="process-chain-icon">✓</span>
              <span className="process-chain-name">{s.name}</span>
              {s.qcRequired ? (
                <span className="process-chain-tag process-chain-tag-qc">
                  QC Approved
                </span>
              ) : (
                <span className="process-chain-tag process-chain-tag-noqc">
                  QC not required
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">4. Quantity Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Total Quantity" value={assembly.plannedQty} />
          <ReadonlyField label="Dispatched" value={assembly.dispatchedQty} />
          <ReadonlyField
            label="Balance"
            value={assembly.balanceQty}
            emphasize
          />
          <ReadonlyField
            label="Dispatch Status"
            value={assembly.dispatchStatus}
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">5. Dispatch History</h3>
        <DispatchTimeline assembly={assembly} />

        {(assembly.dispatches || []).length > 0 && (
          <div
            className="table-scroll-wrapper"
            style={{ marginTop: 14, borderRadius: 8 }}
          >
            <table className="data-table data-table-sub">
              <thead>
                <tr>
                  <th>Dispatch ID</th>
                  <th>DC Number</th>
                  <th>Date</th>
                  <th>Destination</th>
                  <th>Vehicle</th>
                  <th>Qty</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {assembly.dispatches.map((d) => (
                  <tr key={d.dispatchId}>
                    <td className="cell-id">{d.dispatchId}</td>
                    <td>
                      {d.dcChallanNumber ? (
                        <span className="dc-ref">
                          {d.dcChallanNumber}
                        </span>
                      ) : (
                        <span className="dc-ref-empty">—</span>
                      )}
                    </td>
                    <td>{formatDate(d.date)}</td>
                    <td>
                      {d.dispatchTo} — {d.location}
                    </td>
                    <td>{d.vehicleNumber}</td>
                    <td className="cell-num">{d.qty}</td>
                    <td>
                      {assembly.productionEndDate
                        ? dispatchDiffLabel(
                            d.date,
                            assembly.productionEndDate
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="modal-card-footnote">
          {assembly.dispatchedQty} / {assembly.plannedQty} Dispatched —
          Status: <strong>{assembly.dispatchStatus}</strong>
        </p>
      </div>
    </>
  );
}

/* =========================================================================
   Timeline
   ========================================================================= */
function DispatchTimeline({ assembly }) {
  const steps = [
    { label: "Production Started", date: assembly.productionStartDate },
    { label: "Production Completed", date: assembly.productionEndDate },
    { label: "Planned End", date: assembly.plannedEndDate },
    { label: "Actual End", date: assembly.actualEndDate },
    ...(assembly.dispatches || []).map((d) => ({
      label: `Dispatched — ${d.dispatchId}`,
      date: d.date,
      note: `${d.qty} Qty · ${d.dispatchTo}${
        d.location ? ` (${d.location})` : ""
      }${d.dcChallanNumber ? ` · DC ${d.dcChallanNumber}` : ""}`,
      diff: assembly.productionEndDate
        ? dispatchDiffLabel(d.date, assembly.productionEndDate)
        : null,
    })),
  ];

  return (
    <ol className="dsp-timeline">
      {steps.map((s, idx) => (
        <li key={idx} className="dsp-timeline-step">
          <span className="dsp-timeline-dot" />
          <div className="dsp-timeline-body">
            <span className="dsp-timeline-label">{s.label}</span>
            <span className="dsp-timeline-date">{formatDate(s.date)}</span>
            {s.note && <span className="dsp-timeline-note">{s.note}</span>}
            {s.diff && <span className="dsp-timeline-diff">{s.diff}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* =========================================================================
   Small shared bits
   ========================================================================= */
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

function DispatchStatusBadge({ status }) {
  const map = {
    "Ready for Dispatch": "status-badge-ready",
    "Partially Dispatched": "status-badge-partial",
    Dispatched: "status-badge-done",
  };
  return (
    <span className={`status-badge ${map[status] || ""}`}>
      {status}
    </span>
  );
}

function CompletionBadge({ status, planned, actual, variance }) {
  if (!planned) {
    return (
      <span className="status-badge status-badge-muted">No Plan</span>
    );
  }
  if (!actual) {
    return (
      <span className="status-badge status-badge-muted">
        {status || "In Progress"}
      </span>
    );
  }

  let toneClass = "status-badge-info";
  let label = status || "—";

  if (status === "On Time") {
    toneClass = "status-badge-success";
    label = "On Time";
  } else if (status === "Early") {
    toneClass = "status-badge-info";
    label = variance != null
      ? `${Math.abs(variance)} Day${Math.abs(variance) === 1 ? "" : "s"} Early`
      : "Early";
  } else if (status === "Late") {
    toneClass = "status-badge-danger";
    label = variance != null
      ? `${variance} Day${variance === 1 ? "" : "s"} Late`
      : "Late";
  }

  return (
    <span
      className={`status-badge ${toneClass}`}
      title={`Planned ${planned} · Actual ${actual}`}
    >
      {label}
    </span>
  );
}

/* =========================================================================
   History tab components
   ========================================================================= */
function HistoryMetric({ value, label }) {
  return (
    <div className="dsp-history-metric">
      <strong>{Number(value).toLocaleString("en-IN")}</strong>
      <span>{label}</span>
    </div>
  );
}

function HistoryRow({ row: r, onOpen }) {
  const open = () => onOpen(r);
  return (
    <tr
      role="row"
      className="dsp-history-row"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        // Only react to keys pressed on the row itself, not the eye button.
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          open();
        }
      }}
    >
      <td role="cell">
        <span className="dsp-history-id">{r.dispatchId}</span>
      </td>
      <td role="cell">
        <div>{formatDate(r.date)}</div>
        <div className="dsp-history-muted">{r.time || "—"}</div>
      </td>
      <td role="cell">
        <div className="dsp-history-strong">{r.assemblyId}</div>
        {r.project && <span className="dsp-history-chip">{r.project}</span>}
      </td>
      <td role="cell">
        {r.dcChallanNumber ? (
          <span className="dsp-history-dc">{r.dcChallanNumber}</span>
        ) : (
          <span className="dsp-history-muted">—</span>
        )}
      </td>
      <td role="cell">
        <div className="dsp-history-strong">{r.dispatchTo || "—"}</div>
        <div className="dsp-history-muted">{r.location || "—"}</div>
      </td>
      <td role="cell">
        <div>{r.vehicleNumber || "—"}</div>
        <div className="dsp-history-muted">
          {[r.driverName, r.driverContact].filter(Boolean).join(" · ") || "—"}
        </div>
      </td>
      <td role="cell" className="is-num">
        {r.qty}
      </td>
      <td role="cell" className="is-act">
        <button
          type="button"
          className="dsp-history-icon-btn"
          title={`View ${r.dispatchId}`}
          aria-label={`View details for ${r.dispatchId}`}
          onClick={(e) => {
            e.stopPropagation(); // don't also trigger the row click
            open();
          }}
        >
          <Eye size={16} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function HistoryItem({ label, children, wide }) {
  return (
    <div className={`dsp-history-item ${wide ? "is-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children || <span className="dsp-history-muted">—</span>}</dd>
    </div>
  );
}

function HistoryDetailModal({ row: r, onClose, onOpenDc }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  /* Focus management + Escape + focus trap.
     1. Remember what had focus so we can hand it back on close.
     2. Move focus into the dialog.
     3. On Tab / Shift+Tab, wrap inside the dialog's focusable elements so
        keyboard users cannot tab into the page behind the overlay. */
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    // Overlay: fixed, 90px top padding so it clears the app header.
    // Only a mousedown that starts on the overlay itself closes it.
    <div
      className="dsp-history-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        ref={panelRef}
        className="dsp-history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsp-history-dlg-title"
      >
        <header className="dsp-history-drawer-head">
          <div>
            <h2 id="dsp-history-dlg-title" className="dsp-history-id">
              {r.dispatchId}
            </h2>
            <p className="dsp-history-muted">
              {formatDate(r.date)}
              {r.time ? ` · ${r.time}` : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dsp-history-icon-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="dsp-history-drawer-body">
          <section>
            <h3>Shipment</h3>
            <dl>
              <HistoryItem label="DC Number">
                {r.dcChallanNumber && (
                  <span className="dsp-history-dc">{r.dcChallanNumber}</span>
                )}
              </HistoryItem>
              <HistoryItem label="Date">{formatDate(r.date)}</HistoryItem>
              <HistoryItem label="Time">{r.time}</HistoryItem>
              <HistoryItem label="Quantity">{r.qty}</HistoryItem>
            </dl>
          </section>

          <section>
            <h3>Destination</h3>
            <dl>
              <HistoryItem label="Dispatch To">{r.dispatchTo}</HistoryItem>
              <HistoryItem label="Location">{r.location}</HistoryItem>
              <HistoryItem label="Remarks" wide>
                {r.remarks}
              </HistoryItem>
            </dl>
          </section>

          <section>
            <h3>Transport</h3>
            <dl>
              <HistoryItem label="Vehicle">{r.vehicleNumber}</HistoryItem>
              <HistoryItem label="Transporter">{r.transporter}</HistoryItem>
              <HistoryItem label="Driver Name">{r.driverName}</HistoryItem>
              <HistoryItem label="Driver Contact">
                {r.driverContact}
              </HistoryItem>
            </dl>
          </section>

          <section>
            <h3>Assembly</h3>
            <dl>
              <HistoryItem label="Assembly ID">{r.assemblyId}</HistoryItem>
              <HistoryItem label="Project">{r.project}</HistoryItem>
              <HistoryItem label="DWG Description">
                {r.dwgDescription}
              </HistoryItem>
              <HistoryItem label="Revision">{r.revision}</HistoryItem>
            </dl>
          </section>

          <section>
            <h3>Traceability</h3>
            <dl>
              <HistoryItem label="Delivery Challan">
                {r.deliveryChallanId && r.dcChallanNumber ? (
                  <button
                    type="button"
                    className="dsp-history-link-btn"
                    onClick={() => onOpenDc(r)}
                  >
                    <FileText size={14} aria-hidden="true" />
                    Open {r.dcChallanNumber}
                  </button>
                ) : null}
              </HistoryItem>
              <HistoryItem label="Created">{formatStamp(r.createdAt)}</HistoryItem>
            </dl>
          </section>
        </div>
      </aside>
    </div>
  );
}