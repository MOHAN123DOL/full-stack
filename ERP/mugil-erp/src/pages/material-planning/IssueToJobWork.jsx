import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  AlertTriangle,
  PackageSearch,
  Building2,
  Warehouse,
  CheckCircle2,
  ArrowRight,
  Plus,
  Truck,
  RefreshCw,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import useFilterOptions from "../../hooks/useFilterOptions";

import "./IssueToJobWork.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const API_BASE = "/erp/material";

const UNITS = ["Unit 1", "Unit 2"];

const SOURCE_TYPES = [
  "PO",
  "Dummy PO",
  "Job Remaining",
  "Cutting Remaining",
  "Rework",
  "Other",
];

const GENERIC_ERROR = "Something went wrong. Please try again.";

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

/**
 * A lot flagged for rework cannot be issued. It stays visible on the
 * page so the user can see it, but the Issue button is disabled with
 * a tooltip until Rework marks it Done.
 */
function isReworkLocked(row) {
  return String(row?.reworkRequired ?? "").toLowerCase() === "yes";
}

/**
 * A lot is issuable when it has a linked project. No DWG/BOM check.
 * The only blocker is: no project at all.
 */
function hasLinkedProject(row) {
  if (!row) return false;
  const p = row.project;
  if (p === undefined || p === null) return false;
  const s = String(p).trim();
  if (s === "" || s === "—" || s === "-") return false;
  return true;
}

const REWORK_LOCK_TITLE =
  "Rework not completed — cannot issue until Rework marks it Done.";

const NO_PROJECT_TITLE =
  "This material is not linked to any project yet. Please integrate it with a project first.";

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    Available: "success",
    Remaining: "warning",
    "Cutting Remaining": "info",
    PO: "info",
    "Dummy PO": "amber-outline",
    "Job Remaining": "warning",
    Rework: "info",
    Other: "neutral",
    Yes: "warning",
    No: "neutral",
    "In-House": "info",
    Outsourcing: "amber-outline",
    Issued: "success",
    "Partially Returned": "warning",
    "Fully Returned": "success",
    Cancelled: "danger",
  };
  const resolvedTone = tone || STATUS_STYLES[status] || "neutral";
  return (
    <span className={`status-badge status-badge-${resolvedTone}`}>
      {status}
    </span>
  );
}

function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY FILTERS / FORM
   ============================================================ */

const emptyFilters = {
  material: "All",
  thickness: "All",
  length: "All",
  width: "All",
  poNumber: "",
  project: "All",
  sourceType: "All",
  reworkRequired: "All",
};

const emptyIssueForm = {
  jobWorkType: null,
  jobWorkUnit: "Unit 1",
  process: "",
  issueQty: "",
  issuedBy: "",
  remarks: "",
  vendor: "",
  vendorContact: "",
  jobWorkLocation: "",
  expectedReturnDate: "",
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function IssueToJobWork() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();

  /* -------------------- data -------------------- */
  const [stock, setStock] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [history, setHistory] = useState([]);

  /* -------------------- ui state -------------------- */
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  /* -------------------- filters -------------------- */
  const [search, setSearch] = useState("");
  const [unitTab, setUnitTab] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);

  /* -------------------- issue modal -------------------- */
  const [issueTargetId, setIssueTargetId] = useState(null);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
  const [formError, setFormError] = useState("");
  const [savingIssue, setSavingIssue] = useState(false);

  /* -------------------- create process -------------------- */
  const [showCreateProcess, setShowCreateProcess] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [newProcessId, setNewProcessId] = useState("");
  const [processError, setProcessError] = useState("");

  /* -------------------- filter options -------------------- */
  const { options: filterOptions, refresh: refreshFilterOptions } =
    useFilterOptions("material-job-work", { enabled: !!accessToken });

  /* ============================================================
     AUTH HEADERS
     ============================================================ */

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* ============================================================
     FETCHERS
     ============================================================ */

  const fetchStock = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        setError("");

        const res = await api.get(`${API_BASE}/job-work/stock/`, {
          headers: authHeaders(),
        });

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setStock(list);
      } catch (err) {
        console.error("Failed to load stock:", err);
        setError(getApiError(err, "Failed to load stock."));
        setStock([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders]
  );

  const fetchProcesses = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await api.get(`${API_BASE}/job-work/processes/`, {
        headers: authHeaders(),
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setProcesses(list);
    } catch (err) {
      console.error("Failed to load processes:", err);
      setProcesses([]);
    }
  }, [accessToken, authHeaders]);

  const fetchHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        const res = await api.get(`${API_BASE}/job-work/issues/`, {
          headers: authHeaders(),
        });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setHistory(list);
      } catch (err) {
        console.error("Failed to load issue history:", err);
        setHistory([]);
      }
    },
    [accessToken, authHeaders]
  );

  /* ============================================================
     INITIAL LOAD
     ============================================================ */

  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setIsLoading(false);
      return;
    }
    fetchStock();
    fetchProcesses();
    fetchHistory();
  }, [accessToken, fetchStock, fetchProcesses, fetchHistory]);

  /* ============================================================
     PICK UP STOCK ID FROM ROUTER STATE (Material Stock → Issue)
     ============================================================ */

  useEffect(() => {
    const stockId = location.state?.stockId;
    if (stockId) {
      setIssueTargetId(stockId);
    }
  }, [location.state]);

  /* ============================================================
     RESET FORM WHEN MODAL OPENS
     ============================================================ */

  useEffect(() => {
    if (issueTargetId) {
      setIssueForm(emptyIssueForm);
      setFormError("");
    }
  }, [issueTargetId]);

  /* ============================================================
     FILTER HANDLERS
     ============================================================ */

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setSearch("");
    setUnitTab("All");
    setFilters(emptyFilters);
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    unitTab !== "All" ||
    filters.material !== "All" ||
    filters.thickness !== "All" ||
    filters.length !== "All" ||
    filters.width !== "All" ||
    filters.poNumber.trim() !== "" ||
    filters.project !== "All" ||
    filters.sourceType !== "All" ||
    filters.reworkRequired !== "All";

  /* ============================================================
     DERIVED ROWS
     ============================================================ */

  const activeStock = useMemo(
    () => stock.filter((s) => Number(s.availableQty) > 0),
    [stock]
  );

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();

    return activeStock.filter((s) => {
      const matchesSearch =
        !q ||
        [
          s.stockId,
          s.poNumber,
          s.description,
          s.material,
          s.materialCode,
          s.materialSpec,
          s.thickness,
          s.length,
          s.width,
          s.heatNumber,
          s.plateNumber,
          s.project,
          s.dwgDescription,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesUnit = unitTab === "All" || s.unit === unitTab;

      const matchesMaterial =
        filters.material === "All" || s.material === filters.material;

      const matchesThickness =
        filters.thickness === "All" ||
        String(s.thickness ?? "").trim() === filters.thickness;

      const matchesLength =
        filters.length === "All" ||
        String(s.length ?? "").trim() === filters.length;

      const matchesWidth =
        filters.width === "All" ||
        String(s.width ?? "").trim() === filters.width;

      const matchesPo =
        !filters.poNumber.trim() ||
        String(s.poNumber ?? "")
          .toLowerCase()
          .includes(filters.poNumber.trim().toLowerCase());

      const matchesProject =
        filters.project === "All" || s.project === filters.project;

      const matchesSource =
        filters.sourceType === "All" || s.sourceType === filters.sourceType;

      const matchesRework =
        filters.reworkRequired === "All" ||
        s.reworkRequired === filters.reworkRequired;

      return (
        matchesSearch &&
        matchesUnit &&
        matchesMaterial &&
        matchesThickness &&
        matchesLength &&
        matchesWidth &&
        matchesPo &&
        matchesProject &&
        matchesSource &&
        matchesRework
      );
    });
  }, [activeStock, search, unitTab, filters]);

  /* ============================================================
     SUMMARY
     ============================================================ */

  const summary = useMemo(() => {
    const total = activeStock.length;
    const unit1 = activeStock.filter((s) => s.unit === "Unit 1").length;
    const unit2 = activeStock.filter((s) => s.unit === "Unit 2").length;
    const readyToIssue = activeStock.filter(
      (s) => hasLinkedProject(s) && !isReworkLocked(s)
    ).length;
    return { total, unit1, unit2, readyToIssue };
  }, [activeStock]);

  /* ============================================================
     ISSUE MODAL STATE
     ============================================================ */

  const issueStock = useMemo(
    () => stock.find((s) => String(s.id) === String(issueTargetId)) || null,
    [stock, issueTargetId]
  );

  const issueHasProject = hasLinkedProject(issueStock);
  const issueLocked = issueStock ? isReworkLocked(issueStock) : false;
  const issueBlocked = issueLocked || !issueHasProject;

  function openIssue(s) {
    if (isReworkLocked(s)) return;
    setIssueTargetId(s.id);
  }

  function closeIssue() {
    setIssueTargetId(null);
    setIssueForm(emptyIssueForm);
    setFormError("");
  }

  function setFormField(key, value) {
    setIssueForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ============================================================
     PROCESS CREATION
     ============================================================ */

  function handleProcessChange(e) {
    const val = e.target.value;
    if (val === "__create__") {
      setShowCreateProcess(true);
      return;
    }
    setFormField("process", val);
  }

  async function handleCreateProcess() {
    const name = newProcessName.trim();
    const pid = newProcessId.trim().toUpperCase();

    if (!name || !pid) {
      setProcessError("Enter both a process name and a process ID.");
      return;
    }

    try {
      const res = await api.post(
        `${API_BASE}/job-work/processes/`,
        { name, processId: pid },
        { headers: authHeaders() }
      );

      const created = res.data?.data;
      if (created) {
        setProcesses((prev) => [...prev, created]);
        setFormField("process", created.processId);
      }

      setShowCreateProcess(false);
      setNewProcessName("");
      setNewProcessId("");
      setProcessError("");
    } catch (err) {
      console.error("Failed to create process:", err);
      setProcessError(getApiError(err, "Failed to create process."));
    }
  }

  /* ============================================================
     VALIDATION
     ============================================================ */

  const liveQtyError = useMemo(() => {
    if (!issueStock || issueForm.issueQty === "") return "";
    const n = Number(issueForm.issueQty);
    if (Number.isNaN(n)) return "Enter a valid number.";
    if (n <= 0) return "Issue quantity must be greater than 0.";
    if (n > Number(issueStock.availableQty))
      return `Only ${fmt(issueStock.availableQty)} ${issueStock.uom} are available.`;
    return "";
  }, [issueForm.issueQty, issueStock]);

  function validateForm() {
    if (!issueStock) return "Select a material to issue.";
    if (issueLocked) return REWORK_LOCK_TITLE;
    if (!issueHasProject) return NO_PROJECT_TITLE;
    if (!issueForm.jobWorkType) return "Select a job work type.";
    if (!issueForm.process) return "Select a process.";

    const n = Number(issueForm.issueQty);
    if (issueForm.issueQty === "" || Number.isNaN(n) || n <= 0)
      return "Enter a valid issue quantity.";
    if (n > Number(issueStock.availableQty))
      return `Only ${fmt(issueStock.availableQty)} ${issueStock.uom} are available to issue.`;

    if (!issueForm.issuedBy.trim())
      return "Enter who is issuing this material.";

    if (issueForm.jobWorkType === "In-House" && !issueForm.jobWorkUnit)
      return "Select the job work unit.";

    if (issueForm.jobWorkType === "Outsourcing") {
      if (!issueForm.vendor.trim()) return "Enter the vendor name.";
      if (!issueForm.jobWorkLocation.trim())
        return "Enter the job work location.";
      if (!issueForm.expectedReturnDate)
        return "Enter the expected return date.";
    }

    return "";
  }

  /* ============================================================
     ISSUE MATERIAL — IN-HOUSE FLOW
     ============================================================ */

  async function handleIssueMaterial() {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    const procMeta = processes.find((p) => p.processId === issueForm.process);

    const payload = {
      stockId: issueStock.id,
      jobWorkType: "In-House",
      processId: issueForm.process,
      quantityIssued: Number(issueForm.issueQty),
      issuedBy: issueForm.issuedBy.trim(),
      remarks: issueForm.remarks.trim(),
      jobWorkUnit: issueForm.jobWorkUnit,
    };

    try {
      setSavingIssue(true);

      await api.post(`${API_BASE}/job-work/issue/`, payload, {
        headers: authHeaders(),
      });

      setSuccessMsg(
        `${issueForm.issueQty} ${issueStock.uom} of ${
          issueStock.material || issueStock.description
        } issued for ${procMeta ? procMeta.name : issueForm.process}.`
      );

      closeIssue();

      await Promise.all([
        fetchStock({ silent: true }),
        fetchHistory({ silent: true }),
        refreshFilterOptions(),
      ]);

      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Issue failed:", err);
      setFormError(getApiError(err, "Failed to issue material."));
    } finally {
      setSavingIssue(false);
    }
  }

  /* ============================================================
     ISSUE MATERIAL — OUTSOURCING FLOW → DELIVERY CHALLAN
     ============================================================ */

  async function handleContinueToChallan() {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    const procMeta = processes.find((p) => p.processId === issueForm.process);

    const dcPayload = {
      stockId: issueStock.id,
      stockCode: issueStock.stockId,

      poNumber: issueStock.poNumber,
      poDescription: issueStock.description,

      material: issueStock.material,
      materialCode: issueStock.materialCode,
      specification: issueStock.materialSpec,
      thickness: issueStock.thickness,
      length: issueStock.length,
      width: issueStock.width,
      uom: issueStock.uom,

      quantity: Number(issueForm.issueQty),

      project: issueStock.project,
      dwg: issueStock.dwgDescription,
      revision: issueStock.revision,

      process: procMeta ? procMeta.name : issueForm.process,
      processId: issueForm.process,

      jobWorkType: "Outsourcing",

      vendor: issueForm.vendor.trim(),
      vendorContact: issueForm.vendorContact.trim(),
      jobWorkLocation: issueForm.jobWorkLocation.trim(),
      expectedReturnDate: issueForm.expectedReturnDate,

      issuedBy: issueForm.issuedBy.trim(),
      remarks: issueForm.remarks.trim(),
    };

    try {
      setSavingIssue(true);

      await api.post(
        `${API_BASE}/job-work/issue/`,
        {
          stockId: issueStock.id,
          jobWorkType: "Outsourcing",
          processId: issueForm.process,
          quantityIssued: Number(issueForm.issueQty),
          issuedBy: issueForm.issuedBy.trim(),
          remarks: issueForm.remarks.trim(),
          vendor: issueForm.vendor.trim(),
          vendorContact: issueForm.vendorContact.trim(),
          jobWorkLocation: issueForm.jobWorkLocation.trim(),
          expectedReturnDate: issueForm.expectedReturnDate,
        },
        { headers: authHeaders() }
      );

      await Promise.all([
        fetchStock({ silent: true }),
        fetchHistory({ silent: true }),
        refreshFilterOptions(),
      ]);

      closeIssue();

      navigate("/accounts/DeliveryChallan", { state: dcPayload });
    } catch (err) {
      console.error("Issue failed:", err);
      setFormError(getApiError(err, "Failed to issue material."));
    } finally {
      setSavingIssue(false);
    }
  }

  /* ============================================================
     REFRESH / BACK
     ============================================================ */

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      fetchStock({ silent: true }),
      fetchProcesses(),
      fetchHistory({ silent: true }),
      refreshFilterOptions(),
    ]);
    setRefreshing(false);
  }

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
                <h1 className="page-header-title">Issue to Job Work</h1>
                <p className="page-header-subtitle">
                  Issue available material for in-house or outsourced job
                  work. Material must be linked to a project.
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

          {successMsg && (
            <div className="inline-success">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg("")} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          )}

          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {!isLoading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchStock()} />
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* SUMMARY CARDS */}
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-neutral">
                    <PackageSearch size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.total}</span>
                    <span className="summary-card-label">
                      Available Materials
                    </span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-info">
                    <Building2 size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.unit1}</span>
                    <span className="summary-card-label">Unit 1</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-info">
                    <Warehouse size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.unit2}</span>
                    <span className="summary-card-label">Unit 2</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-success">
                    <CheckCircle2 size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.readyToIssue}
                    </span>
                    <span className="summary-card-label">Ready to Issue</span>
                  </div>
                </div>
              </div>

              {/* AVAILABLE MATERIAL */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-head-title">Available Material</div>
                    <p className="panel-head-subtitle">
                      Select material to issue for in-house or outsourced job
                      work. Material must be linked to a project.
                    </p>
                  </div>

                  <div className="unit-tabs">
                    {["All", ...UNITS].map((u) => (
                      <button
                        key={u}
                        className={`unit-tab ${
                          unitTab === u ? "unit-tab-active" : ""
                        }`}
                        onClick={() => setUnitTab(u)}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panel-toolbar">
                  <div className="panel-toolbar-search">
                    <Search size={14} />
                    <input
                      placeholder="Search PO, description, material, size, project..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <button
                    className={`btn btn-secondary btn-sm ${
                      showFilters ? "btn-outline-active" : ""
                    }`}
                    onClick={() => setShowFilters((v) => !v)}
                  >
                    <Search size={14} />
                    Filters
                  </button>

                  {hasActiveFilters && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={clearFilters}
                    >
                      <X size={14} />
                      Clear Filters
                    </button>
                  )}
                </div>

                {showFilters && (
                  <div className="filters-grid">
                    <div className="form-field">
                      <label>Thickness</label>
                      <select
                        value={filters.thickness}
                        onChange={(e) =>
                          updateFilter("thickness", e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {(filterOptions.thickness || []).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Project</label>
                      <select
                        value={filters.project}
                        onChange={(e) =>
                          updateFilter("project", e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {(filterOptions.project || []).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Length</label>
                      <select
                        value={filters.length}
                        onChange={(e) => updateFilter("length", e.target.value)}
                      >
                        <option value="All">All</option>
                        {(filterOptions.length || []).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Width</label>
                      <select
                        value={filters.width}
                        onChange={(e) => updateFilter("width", e.target.value)}
                      >
                        <option value="All">All</option>
                        {(filterOptions.width || []).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Material</label>
                      <select
                        value={filters.material}
                        onChange={(e) =>
                          updateFilter("material", e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {(filterOptions.material || []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>PO Number</label>
                      <input
                        type="text"
                        placeholder="e.g. PO-001"
                        value={filters.poNumber}
                        onChange={(e) =>
                          updateFilter("poNumber", e.target.value)
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Source Type</label>
                      <select
                        value={filters.sourceType}
                        onChange={(e) =>
                          updateFilter("sourceType", e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {SOURCE_TYPES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Rework Required</label>
                      <select
                        value={filters.reworkRequired}
                        onChange={(e) =>
                          updateFilter("reworkRequired", e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Unit</label>
                      <select
                        value={unitTab}
                        onChange={(e) => setUnitTab(e.target.value)}
                      >
                        <option value="All">All</option>
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="table-scroll-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Stock ID</th>
                        <th>Unit</th>
                        <th>PO Number</th>
                        <th>Description</th>
                        <th>Thickness</th>
                        <th>Length</th>
                        <th>Width</th>
                        <th>Available Qty</th>
                        <th>Project</th>
                        <th>DWG / Description</th>
                        <th>Revision</th>
                        <th>Rework Required</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map((s) => {
                        const locked = isReworkLocked(s);
                        const noProject = !hasLinkedProject(s);

                        let btnTitle = undefined;
                        if (locked) btnTitle = REWORK_LOCK_TITLE;
                        else if (noProject) btnTitle = NO_PROJECT_TITLE;

                        return (
                          <tr key={s.id}>
                            <td className="cell-mono">{s.stockId}</td>
                            <td>{s.unit}</td>
                            <td className="cell-mono">{s.poNumber}</td>
                            <td>{s.description}</td>
                            <td>{s.thickness || "—"}</td>
                            <td>{s.length || "—"}</td>
                            <td>{s.width || "—"}</td>
                            <td>
                              <strong>{fmt(s.availableQty)}</strong> {s.uom}
                            </td>
                            <td
                              className={
                                !hasLinkedProject(s) ? "cell-muted" : ""
                              }
                            >
                              {s.project || "—"}
                            </td>
                            <td
                              className={
                                !s.dwgDescription || s.dwgDescription === "—"
                                  ? "cell-muted"
                                  : ""
                              }
                            >
                              {s.dwgDescription || "—"}
                            </td>
                            <td
                              className={
                                !s.revision || s.revision === "—"
                                  ? "cell-muted"
                                  : ""
                              }
                            >
                              {s.revision || "—"}
                            </td>
                            <td>
                              <StatusBadge status={s.reworkRequired} />
                            </td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => openIssue(s)}
                                disabled={locked}
                                title={btnTitle}
                                aria-disabled={locked}
                              >
                                Issue
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredStock.length === 0 && (
                        <tr>
                          <td colSpan={13}>
                            <div className="empty-state">
                              <p className="empty-state-title">
                                No material matches your search or filters
                              </p>
                              <p className="empty-state-desc">
                                Try clearing filters or search by PO number,
                                project, thickness, length or width.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ISSUE HISTORY */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-head-title">Issue History</div>
                    <p className="panel-head-subtitle">
                      Material already issued for in-house or outsourced job
                      work.
                    </p>
                  </div>
                </div>

                <div className="table-scroll-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Issue ID</th>
                        <th>Date</th>
                        <th>PO Number</th>
                        <th>Description</th>
                        <th>Material</th>
                        <th>Process</th>
                        <th>Process ID</th>
                        <th>Job Work Type</th>
                        <th>Unit</th>
                        <th>Vendor</th>
                        <th>Quantity</th>
                        <th>Returned</th>
                        <th>Balance</th>
                        <th>Issued By</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="cell-mono">{h.issueNumber}</td>
                          <td>{h.issueDate}</td>
                          <td className="cell-mono">{h.poNumber}</td>
                          <td>{h.description}</td>
                          <td>{h.material || "—"}</td>
                          <td>{h.processName || "—"}</td>
                          <td className="cell-mono">{h.processId || "—"}</td>
                          <td>
                            <StatusBadge status={h.jobWorkType} />
                          </td>
                          <td className={!h.jobWorkUnit ? "cell-muted" : ""}>
                            {h.jobWorkUnit || "—"}
                          </td>
                          <td className={!h.vendor ? "cell-muted" : ""}>
                            {h.vendor || "—"}
                          </td>
                          <td>
                            <strong>{fmt(h.quantityIssued)}</strong> {h.uom}
                          </td>
                          <td>{fmt(h.quantityReturned)}</td>
                          <td>
                            <strong>{fmt(h.balanceQty)}</strong>
                          </td>
                          <td>{h.issuedBy || "—"}</td>
                          <td>
                            <StatusBadge status={h.status} />
                          </td>
                        </tr>
                      ))}

                      {history.length === 0 && (
                        <tr>
                          <td colSpan={15}>
                            <div className="empty-state">
                              <p className="empty-state-title">
                                No material has been issued yet
                              </p>
                              <p className="empty-state-desc">
                                Issued material for job work will appear here.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ISSUE MODAL */}
          <Modal
            open={!!issueStock}
            title="Issue to Job Work"
            subtitle={
              issueStock
                ? `${issueStock.poNumber} · ${issueStock.description}`
                : ""
            }
            onClose={closeIssue}
          >
            {issueStock && (
              <div className="issue-form">
                {/* Selected material */}
                <div className="selected-material-card">
                  <div className="selected-material-head">
                    <span className="selected-material-id">
                      {issueStock.stockId}
                    </span>
                    <StatusBadge status={issueStock.sourceType} />
                  </div>

                  <div className="kv-grid kv-grid-compact">
                    <div className="kv">
                      <span>PO Number</span>
                      <strong className="mono">{issueStock.poNumber}</strong>
                    </div>
                    <div className="kv">
                      <span>Description</span>
                      <strong>{issueStock.description}</strong>
                    </div>
                    <div className="kv">
                      <span>Material</span>
                      <strong>{issueStock.material || "—"}</strong>
                    </div>
                    <div className="kv">
                      <span>Specification</span>
                      <strong>{issueStock.materialSpec || "—"}</strong>
                    </div>
                    <div className="kv">
                      <span>Thickness</span>
                      <strong>{issueStock.thickness || "—"}</strong>
                    </div>
                    <div className="kv">
                      <span>Length</span>
                      <strong>{issueStock.length || "—"}</strong>
                    </div>
                    <div className="kv">
                      <span>Width</span>
                      <strong>{issueStock.width || "—"}</strong>
                    </div>
                    <div className="kv">
                      <span>Available Quantity</span>
                      <strong>
                        {fmt(issueStock.availableQty)} {issueStock.uom}
                      </strong>
                    </div>
                    <div className="kv">
                      <span>Unit</span>
                      <strong>{issueStock.unit}</strong>
                    </div>
                    <div className="kv">
                      <span>Rework Required</span>
                      <StatusBadge status={issueStock.reworkRequired} />
                    </div>
                  </div>
                </div>

                {/* Rework lock warning */}
                {issueLocked && (
                  <div className="integration-block integration-warning">
                    <div className="integration-block-head">
                      <AlertTriangle size={16} />
                      <span>Rework Not Completed</span>
                    </div>
                    <p>{REWORK_LOCK_TITLE}</p>
                  </div>
                )}

                {/* No project warning */}
                {!issueLocked && !issueHasProject && (
                  <div className="integration-block integration-warning">
                    <div className="integration-block-head">
                      <AlertTriangle size={16} />
                      <span>Project Required</span>
                    </div>
                    <p>
                      <strong>
                        {issueStock.poNumber} / {issueStock.description}
                      </strong>{" "}
                      is not linked to a project yet. Please integrate it with
                      a project first.
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        closeIssue();
                        navigate("/inventory/material/po-integration");
                      }}
                    >
                      Go to Project Integration <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Project info — shown when ready */}
                {!issueBlocked && (
                  <div className="integration-block integration-ok">
                    <div className="integration-block-head">
                      <CheckCircle2 size={16} />
                      <span>Linked Project</span>
                    </div>
                    <div className="kv-grid kv-grid-compact">
                      <div className="kv">
                        <span>Project</span>
                        <strong>{issueStock.project}</strong>
                      </div>
                      <div className="kv">
                        <span>DWG</span>
                        <strong>{issueStock.dwgDescription || "—"}</strong>
                      </div>
                      <div className="kv">
                        <span>Revision</span>
                        <strong>{issueStock.revision || "—"}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {!issueBlocked && (
                  <>
                    <div className="form-field">
                      <label>Job Work Type</label>
                      <div className="segment-toggle" role="group">
                        <button
                          type="button"
                          className={`segment-btn ${
                            issueForm.jobWorkType === "In-House"
                              ? "segment-btn-active"
                              : ""
                          }`}
                          onClick={() =>
                            setFormField("jobWorkType", "In-House")
                          }
                        >
                          <Building2 size={14} /> In-House
                        </button>
                        <button
                          type="button"
                          className={`segment-btn ${
                            issueForm.jobWorkType === "Outsourcing"
                              ? "segment-btn-active"
                              : ""
                          }`}
                          onClick={() =>
                            setFormField("jobWorkType", "Outsourcing")
                          }
                        >
                          <Truck size={14} /> Outsourcing
                        </button>
                      </div>
                    </div>

                    {issueForm.jobWorkType === "In-House" && (
                      <div className="form-field">
                        <label>Receiving / Job Work Unit</label>
                        <select
                          value={issueForm.jobWorkUnit}
                          onChange={(e) =>
                            setFormField("jobWorkUnit", e.target.value)
                          }
                        >
                          {UNITS.map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {issueForm.jobWorkType && (
                      <>
                        <div className="form-field">
                          <label>Process</label>
                          <select
                            value={issueForm.process}
                            onChange={handleProcessChange}
                          >
                            <option value="">Select process</option>
                            {processes.map((p) => (
                              <option key={p.processId} value={p.processId}>
                                {p.name} - {p.processId}
                              </option>
                            ))}
                            <option value="__create__">
                              + Create New Process
                            </option>
                          </select>
                        </div>

                        <div className="form-row-2">
                          <div className="form-field">
                            <label>Available Quantity</label>
                            <input
                              value={`${fmt(issueStock.availableQty)} ${issueStock.uom}`}
                              disabled
                            />
                          </div>

                          <div
                            className={`form-field ${
                              liveQtyError ? "form-field-error" : ""
                            }`}
                          >
                            <label>Issue Quantity</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 6"
                              value={issueForm.issueQty}
                              onChange={(e) =>
                                setFormField("issueQty", e.target.value)
                              }
                            />
                            {liveQtyError ? (
                              <span className="form-error-text">
                                {liveQtyError}
                              </span>
                            ) : (
                              <span className="form-hint">
                                Up to {fmt(issueStock.availableQty)}{" "}
                                {issueStock.uom}.
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="form-field">
                          <label>Issued By</label>
                          <input
                            type="text"
                            placeholder="Enter name"
                            value={issueForm.issuedBy}
                            onChange={(e) =>
                              setFormField("issuedBy", e.target.value)
                            }
                          />
                        </div>

                        {issueForm.jobWorkType === "In-House" && (
                          <div className="form-field">
                            <label>Remarks (optional)</label>
                            <textarea
                              rows={2}
                              value={issueForm.remarks}
                              onChange={(e) =>
                                setFormField("remarks", e.target.value)
                              }
                            />
                          </div>
                        )}

                        {issueForm.jobWorkType === "Outsourcing" && (
                          <div className="outsourcing-block">
                            <div className="outsourcing-block-title">
                              Outsourcing Details
                            </div>

                            <div className="form-field">
                              <label>Vendor</label>
                              <input
                                type="text"
                                placeholder="Enter vendor name"
                                value={issueForm.vendor}
                                onChange={(e) =>
                                  setFormField("vendor", e.target.value)
                                }
                              />
                            </div>

                            <div className="form-row-2">
                              <div className="form-field">
                                <label>Vendor Contact</label>
                                <input
                                  placeholder="Phone / email"
                                  value={issueForm.vendorContact}
                                  onChange={(e) =>
                                    setFormField(
                                      "vendorContact",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="form-field">
                                <label>Job Work Location</label>
                                <input
                                  placeholder="Vendor works address / city"
                                  value={issueForm.jobWorkLocation}
                                  onChange={(e) =>
                                    setFormField(
                                      "jobWorkLocation",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="form-field">
                              <label>Expected Return Date</label>
                              <input
                                type="date"
                                value={issueForm.expectedReturnDate}
                                onChange={(e) =>
                                  setFormField(
                                    "expectedReturnDate",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div className="form-field">
                              <label>Remarks (optional)</label>
                              <textarea
                                rows={2}
                                value={issueForm.remarks}
                                onChange={(e) =>
                                  setFormField("remarks", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        )}

                        {formError && (
                          <div className="form-error-banner">
                            <AlertTriangle size={14} />
                            {formError}
                          </div>
                        )}

                        <div className="modal-actions">
                          <button
                            className="btn btn-secondary"
                            onClick={closeIssue}
                            disabled={savingIssue}
                          >
                            Cancel
                          </button>

                          {issueForm.jobWorkType === "In-House" ? (
                            <button
                              className="btn btn-primary"
                              onClick={handleIssueMaterial}
                              disabled={savingIssue}
                            >
                              {savingIssue ? "Saving..." : "Issue Material"}
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={handleContinueToChallan}
                              disabled={savingIssue}
                            >
                              {savingIssue
                                ? "Saving..."
                                : "Continue to Delivery Challan"}
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {issueBlocked && (
                  <div className="modal-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={closeIssue}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* CREATE PROCESS MODAL */}
          <Modal
            open={showCreateProcess}
            title="Create New Process"
            onClose={() => {
              setShowCreateProcess(false);
              setProcessError("");
            }}
          >
            <div className="form-field">
              <label>Process Name</label>
              <input
                placeholder="e.g. Shot Blasting"
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value)}
              />
            </div>

            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Process ID</label>
              <input
                placeholder="e.g. SHOT01"
                value={newProcessId}
                onChange={(e) => setNewProcessId(e.target.value.toUpperCase())}
              />
            </div>

            {processError && (
              <div className="form-error-banner" style={{ marginTop: 12 }}>
                <AlertTriangle size={14} />
                {processError}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateProcess(false);
                  setProcessError("");
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateProcess}>
                <Plus size={14} /> Create
              </button>
            </div>
          </Modal>
        </div>
      </div>
    </>
  );
}