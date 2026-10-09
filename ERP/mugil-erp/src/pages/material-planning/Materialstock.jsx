import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  Eye,
  SlidersHorizontal,
  PackageSearch,
  Warehouse,
  Building2,
  Scissors,
  ArrowRight,
  Boxes,
  RefreshCw,
  Activity,
  AlertTriangle,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import useFilterOptions from "../../hooks/useFilterOptions";

import "./Materialstock.css";

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

const STOCK_STATUSES = [
  "Available",
  "Partially Used",
  "Remaining",
  "Cutting Remaining",
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
 * A lot flagged for rework cannot be issued. It stays visible in
 * the yard so the user can see it, but the Issue action is blocked
 * until the Rework module marks it Done.
 */
function isReworkLocked(row) {
  return String(row?.reworkRequired ?? "").toLowerCase() === "yes";
}

const REWORK_LOCK_TITLE =
  "Rework not completed — cannot issue until Rework marks it Done.";

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    Available: "success",
    "Partially Used": "warning",
    Remaining: "warning",
    "Cutting Remaining": "info",
    PO: "info",
    "Dummy PO": "amber-outline",
    "Job Remaining": "warning",
    Rework: "info",
    Other: "neutral",
    Yes: "warning",
    No: "neutral",
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
   EMPTY FILTERS
   ============================================================ */

const emptyFilters = {
  thickness: "All",
  length: "All",
  width: "All",
  poNumber: "",
  project: "All",
  sourceType: "All",
  stockStatus: "All",
  reworkRequired: "All",
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function MaterialStock() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  /* -------------------- data -------------------- */
  const [stock, setStock] = useState([]);

  /* -------------------- ui state -------------------- */
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* -------------------- filters -------------------- */
  const [search, setSearch] = useState("");
  const [unitTab, setUnitTab] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);

  /* -------------------- view -------------------- */
  const [viewStock, setViewStock] = useState(null);

  /* -------------------- filter options -------------------- */
  const { options: filterOptions, refresh: refreshFilterOptions } =
    useFilterOptions("material-stock", { enabled: !!accessToken });

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

  const fetchStock = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;

      try {
        if (!silent) setIsLoading(true);
        setError("");

        const res = await api.get(`${API_BASE}/stock/`, {
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
        setError(getApiError(err, "Failed to load material stock."));
        setStock([]);
      } finally {
        if (!silent) setIsLoading(false);
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
  }, [accessToken, fetchStock]);

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
    filters.thickness !== "All" ||
    filters.length !== "All" ||
    filters.width !== "All" ||
    filters.poNumber.trim() !== "" ||
    filters.project !== "All" ||
    filters.sourceType !== "All" ||
    filters.stockStatus !== "All" ||
    filters.reworkRequired !== "All";

  /* ============================================================
     FILTERING
     ============================================================ */

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();

    return stock.filter((s) => {
      const matchesSearch =
        !q ||
        [
          s.poNumber,
          s.description,
          s.thickness,
          s.length,
          s.width,
          s.plateNumber,
          s.project,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesUnit = unitTab === "All" || s.unit === unitTab;

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
        filters.sourceType === "All" ||
        s.sourceType === filters.sourceType;

      const matchesStatus =
        filters.stockStatus === "All" ||
        s.stockStatus === filters.stockStatus;

      const matchesRework =
        filters.reworkRequired === "All" ||
        s.reworkRequired === filters.reworkRequired;

      return (
        matchesSearch &&
        matchesUnit &&
        matchesThickness &&
        matchesLength &&
        matchesWidth &&
        matchesPo &&
        matchesProject &&
        matchesSource &&
        matchesStatus &&
        matchesRework
      );
    });
  }, [stock, search, unitTab, filters]);

  /* ============================================================
     SUMMARY
     ============================================================ */

  const summary = useMemo(() => {
    const totalItems = stock.length;
    const unit1 = stock.filter((s) => s.unit === "Unit 1").length;
    const unit2 = stock.filter((s) => s.unit === "Unit 2").length;
    const poStock = stock.filter(
      (s) => s.sourceType === "PO" || s.sourceType === "Dummy PO"
    ).length;
    const cuttingRemaining = stock.filter(
      (s) => s.sourceType === "Cutting Remaining"
    ).length;
    const reworkPending = stock.filter(isReworkLocked).length;
    return {
      totalItems,
      unit1,
      unit2,
      poStock,
      cuttingRemaining,
      reworkPending,
    };
  }, [stock]);

  /* ============================================================
     NAVIGATION
     ============================================================ */

  function handleBack() {
    navigate("/inventory/material");
  }

  function goToIssue(item) {
    if (isReworkLocked(item)) return;
    navigate("/inventory/material/issue-to-jobwork", {
      state: { stockId: item.id },
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchStock({ silent: true }), refreshFilterOptions()]);
    setRefreshing(false);
  }

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <>
      <Header />

      <div className="material-page">
        <div className="material-content">
          {/* ---------------- HEADER ---------------- */}

          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>

              <div className="page-header-title-group">
                <h1 className="page-header-title">Material Stock</h1>
                <p className="page-header-subtitle">
                  Track available material by unit, source, project and
                  dimensions.
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

          {/* ---------------- LOADING ---------------- */}

          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {/* ---------------- ERROR ---------------- */}

          {!isLoading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchStock()} />
            </div>
          )}

          {/* ---------------- CONTENT ---------------- */}

          {!isLoading && !error && (
            <>
              {/* ---------------- SUMMARY CARDS ---------------- */}

              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-neutral">
                    <PackageSearch size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.totalItems}
                    </span>
                    <span className="summary-card-label">
                      Total Available Items
                    </span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-info">
                    <Building2 size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.unit1}</span>
                    <span className="summary-card-label">Unit 1 Stock</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-info">
                    <Warehouse size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.unit2}</span>
                    <span className="summary-card-label">Unit 2 Stock</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-success">
                    <Boxes size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">{summary.poStock}</span>
                    <span className="summary-card-label">PO Stock</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-warning">
                    <Scissors size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.cuttingRemaining}
                    </span>
                    <span className="summary-card-label">
                      Cutting Remaining
                    </span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-danger">
                    <AlertTriangle size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.reworkPending}
                    </span>
                    <span className="summary-card-label">Rework Pending</span>
                  </div>
                </div>
              </div>

              {/* ---------------- AVAILABLE STOCK ---------------- */}

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-head-title">Available Stock</div>
                    <p className="panel-head-subtitle">
                      Only material with available quantity greater than zero
                      is listed.
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
                      placeholder="Search PO, description, size, plate no, project..."
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
                    <SlidersHorizontal size={14} />
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

                {/* ---------------- FILTERS ---------------- */}

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
                      <label>Stock Status</label>
                      <select
                        value={filters.stockStatus}
                        onChange={(e) =>
                          updateFilter("stockStatus", e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {STOCK_STATUSES.map((s) => (
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

                {/* ---------------- TABLE ---------------- */}

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Stock ID</th>
                        <th>Unit</th>
                        <th>Source Type</th>
                        <th>PO Number</th>
                        <th>Description</th>
                        <th>Thickness</th>
                        <th>Length</th>
                        <th>Width</th>
                        <th>Plate Number</th>
                        <th>Available Qty</th>
                        <th>UOM</th>
                        <th>Project</th>
                        <th>Revision</th>
                        <th>Stock Status</th>
                        <th>Rework Required</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map((s) => {
                        const locked = isReworkLocked(s);
                        return (
                          <tr key={s.id}>
                            <td className="cell-mono">{s.stockId}</td>
                            <td>{s.unit}</td>
                            <td>
                              <StatusBadge status={s.sourceType} />
                            </td>
                            <td className="cell-mono">{s.poNumber}</td>
                            <td>{s.description}</td>
                            <td>{s.thickness || "—"}</td>
                            <td>{s.length || "—"}</td>
                            <td>{s.width || "—"}</td>
                            <td
                              className={
                                !s.plateNumber || s.plateNumber === "—"
                                  ? "cell-muted"
                                  : "cell-mono"
                              }
                            >
                              {s.plateNumber || "—"}
                            </td>
                            <td>
                              <strong>{fmt(s.availableQty)}</strong>
                            </td>
                            <td>{s.uom || "—"}</td>
                            <td
                              className={
                                !s.project || s.project === "—"
                                  ? "cell-muted"
                                  : ""
                              }
                            >
                              {s.project || "—"}
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
                              <StatusBadge status={s.stockStatus} />
                            </td>
                            <td>
                              <StatusBadge status={s.reworkRequired} />
                            </td>
                            <td>
                              <div className="table-row-actions">
                                <button
                                  onClick={() => setViewStock(s)}
                                  aria-label="View"
                                >
                                  <Eye size={14} />
                                </button>

                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => goToIssue(s)}
                                  disabled={locked}
                                  title={locked ? REWORK_LOCK_TITLE : undefined}
                                  aria-disabled={locked}
                                >
                                  Issue
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredStock.length === 0 && (
                        <tr>
                          <td colSpan={16}>
                            <div className="empty-state">
                              <p className="empty-state-title">
                                No stock matches your search or filters
                              </p>
                              <p className="empty-state-desc">
                                Try a different thickness, size, PO number or
                                clear filters to see all available material.
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

          {/* ---------------- VIEW STOCK MODAL ---------------- */}

          <Modal
            open={!!viewStock}
            title={viewStock ? viewStock.stockId : ""}
            subtitle="Stock record details"
            onClose={() => setViewStock(null)}
          >
            {viewStock && (
              <>
                <div className="kv-grid">
                  <div className="kv">
                    <span>Unit</span>
                    <strong>{viewStock.unit}</strong>
                  </div>
                  <div className="kv">
                    <span>Source Type</span>
                    <StatusBadge status={viewStock.sourceType} />
                  </div>
                  <div className="kv">
                    <span>PO Number</span>
                    <strong className="mono">{viewStock.poNumber}</strong>
                  </div>
                  <div className="kv">
                    <span>Description</span>
                    <strong>{viewStock.description}</strong>
                  </div>
                  <div className="kv">
                    <span>Thickness</span>
                    <strong>{viewStock.thickness || "—"}</strong>
                  </div>
                  <div className="kv">
                    <span>Length</span>
                    <strong>{viewStock.length || "—"}</strong>
                  </div>
                  <div className="kv">
                    <span>Width</span>
                    <strong>{viewStock.width || "—"}</strong>
                  </div>
                  <div className="kv">
                    <span>Plate Number</span>
                    <strong>{viewStock.plateNumber || "—"}</strong>
                  </div>
                  <div className="kv kv-highlight">
                    <span>Available Quantity</span>
                    <strong>
                      {fmt(viewStock.availableQty)} {viewStock.uom}
                    </strong>
                  </div>
                  <div className="kv">
                    <span>Project</span>
                    <strong>{viewStock.project || "—"}</strong>
                  </div>
                  <div className="kv">
                    <span>Revision</span>
                    <strong>{viewStock.revision || "—"}</strong>
                  </div>
                  <div className="kv">
                    <span>Stock Status</span>
                    <StatusBadge status={viewStock.stockStatus} />
                  </div>
                  <div className="kv">
                    <span>Rework Required</span>
                    <StatusBadge status={viewStock.reworkRequired} />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setViewStock(null)}
                  >
                    Close
                  </button>

                  <button
                    className="btn btn-primary"
                    disabled={isReworkLocked(viewStock)}
                    title={
                      isReworkLocked(viewStock)
                        ? REWORK_LOCK_TITLE
                        : undefined
                    }
                    onClick={() => {
                      if (isReworkLocked(viewStock)) return;
                      const target = viewStock;
                      setViewStock(null);
                      goToIssue(target);
                    }}
                  >
                    Issue to Job Work <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </Modal>
        </div>
      </div>
    </>
  );
}