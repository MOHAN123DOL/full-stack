import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  X,
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

import "./IssueToProduction.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const API_BASE = "/erp/material";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ============================================================
   HELPERS
   ============================================================ */

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat().find(
      (v) => typeof v === "string"
    );
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
   FILTER SCHEMA
   ============================================================ */

const FILTER_FIELDS = [
  { key: "thickness", label: "Thickness", type: "select" },
  { key: "size", label: "Size", type: "select" },
  { key: "poNumber", label: "PO Number", type: "text" },
  { key: "poDescription", label: "PO Description / Item", type: "text" },
  { key: "materialSpec", label: "Material Specification", type: "text" },
  { key: "project", label: "Project", type: "select" },
  { key: "unit", label: "Unit", type: "select" },
  { key: "jobWorkType", label: "Job Work Type", type: "select" },
  { key: "jobWorkId", label: "Job Work ID", type: "text" },
  { key: "process", label: "Process", type: "select" },
  { key: "processId", label: "Process ID", type: "text" },
  { key: "status", label: "Status", type: "select" },
];

const matchesFilters = (row, filters) =>
  FILTER_FIELDS.every((f) => {
    const val = filters[f.key];
    if (!val) return true;
    const rowVal = String(row[f.key] ?? "").toLowerCase();
    return f.type === "select"
      ? rowVal === val.toLowerCase()
      : rowVal.includes(val.toLowerCase());
  });

const matchesSearch = (row, search, extraKeys = []) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  const fields = [
    "jobWorkId",
    "poNumber",
    "poDescription",
    "description",
    "project",
    "material",
    "materialCode",
    "dwgDescription",
    "materialSpec",
    "pieceNo",
    ...extraKeys,
  ];
  return fields.some((k) =>
    String(row[k] ?? "")
      .toLowerCase()
      .includes(term)
  );
};

const emptyIssueForm = () => ({
  quantity: "",
  issuedBy: "",
});

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function IssueToProduction() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [availableMaterial, setAvailableMaterial] = useState([]);
  const [issueHistory, setIssueHistory] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("available");

  const [availableSearch, setAvailableSearch] = useState("");
  const [availableFilters, setAvailableFilters] = useState({});
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilters, setHistoryFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewData, setViewData] = useState(null);
  const [issueRow, setIssueRow] = useState(null);
  const [issueForm, setIssueForm] = useState(emptyIssueForm());
  const [issueError, setIssueError] = useState("");
  const [savingIssue, setSavingIssue] = useState(false);

  const { options: filterOptions, refresh: refreshFilterOptions } =
    useFilterOptions("production-issue", { enabled: !!accessToken });

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* ============================================================
     FETCHERS
     ============================================================ */

  const fetchAvailable = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        setError("");

        const res = await api.get(`${API_BASE}/production/available/`, {
          headers: authHeaders(),
        });

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setAvailableMaterial(list);
      } catch (err) {
        console.error("Failed to load available material:", err);
        setError(getApiError(err, "Failed to load available material."));
        setAvailableMaterial([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders]
  );

  const fetchHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);

        const res = await api.get(`${API_BASE}/production/history/`, {
          headers: authHeaders(),
        });

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setIssueHistory(list);
      } catch (err) {
        console.error("Failed to load issue history:", err);
        setIssueHistory([]);
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
    fetchAvailable();
    fetchHistory();
  }, [accessToken, fetchAvailable, fetchHistory]);

  /* ============================================================
     DERIVED LISTS
     ============================================================ */

  const filteredAvailable = useMemo(
    () =>
      availableMaterial.filter(
        (r) =>
          matchesFilters(r, availableFilters) &&
          matchesSearch(r, availableSearch)
      ),
    [availableMaterial, availableFilters, availableSearch]
  );

  const filteredHistory = useMemo(
    () =>
      issueHistory.filter(
        (r) =>
          matchesFilters(r, historyFilters) &&
          matchesSearch(r, historySearch, ["issueId"])
      ),
    [issueHistory, historyFilters, historySearch]
  );

  const summary = useMemo(() => {
    const total = availableMaterial.length;
    const available = availableMaterial.filter(
      (r) => r.status === "Available"
    ).length;
    const partial = availableMaterial.filter(
      (r) => r.status === "Partially Issued"
    ).length;
    const fully = availableMaterial.filter(
      (r) => r.status === "Fully Issued"
    ).length;

    return { total, available, partial, fully };
  }, [availableMaterial]);

  /* ============================================================
     TAB / FILTER HANDLERS
     ============================================================ */

  const switchTab = (tab) => {
    setActiveTab(tab);
    setFiltersOpen(false);
  };

  const handleAvailableFilterChange = (key, value) =>
    setAvailableFilters((f) => ({ ...f, [key]: value }));

  const handleHistoryFilterChange = (key, value) =>
    setHistoryFilters((f) => ({ ...f, [key]: value }));

  const clearAvailableFilters = () => {
    setAvailableFilters({});
    setAvailableSearch("");
  };
  const clearHistoryFilters = () => {
    setHistoryFilters({});
    setHistorySearch("");
  };

  /* ============================================================
     EYE VIEW
     ============================================================ */

  const openView = (type, row) => setViewData({ type, row });
  const closeView = () => setViewData(null);

  /* ============================================================
     ISSUE MODAL
     ============================================================ */

  const openIssue = (row) => {
    setIssueRow(row);
    setIssueForm(emptyIssueForm());
    setIssueError("");
  };

  const closeIssue = () => {
    if (savingIssue) return;
    setIssueRow(null);
    setIssueForm(emptyIssueForm());
    setIssueError("");
  };

  const validateIssue = () => {
    if (!issueRow) return "No material selected.";
    const qty = Number(issueForm.quantity);

    if (!issueForm.quantity || !(qty > 0)) {
      return "Enter an Issue Quantity greater than 0.";
    }
    if (qty > issueRow.availableQty) {
      return `Issue Quantity (${qty}) can't exceed the Available Quantity (${fmt(issueRow.availableQty)} ${issueRow.jobWorkUnit}).`;
    }
    if (!issueForm.issuedBy.trim()) {
      return "Enter who is issuing this material.";
    }
    return "";
  };

  const handleConfirmIssue = async () => {
    if (!issueRow) return;
    if (savingIssue) return;

    const validationError = validateIssue();
    if (validationError) {
      setIssueError(validationError);
      return;
    }

    try {
      setSavingIssue(true);

      await api.post(
        `${API_BASE}/production/issue/`,
        {
          jobWorkPieceId: issueRow.jobWorkPieceId,
          issuedQty: Number(issueForm.quantity),
          issuedBy: issueForm.issuedBy.trim(),
          remarks: "",
        },
        { headers: authHeaders() }
      );

      closeIssue();
      await Promise.all([
        fetchAvailable({ silent: true }),
        fetchHistory({ silent: true }),
        refreshFilterOptions(),
      ]);
    } catch (err) {
      console.error("Issue failed:", err);
      setIssueError(
        getApiError(err, "Failed to issue to production.")
      );
    } finally {
      setSavingIssue(false);
    }
  };

  /* ============================================================
     REFRESH / BACK
     ============================================================ */

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAvailable({ silent: true }),
      fetchHistory({ silent: true }),
      refreshFilterOptions(),
    ]);
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
                <h1 className="page-header-title">
                  Issue to Production
                </h1>
                <p className="page-header-subtitle">
                  Issue actually received Job Work material to Production
                  and track every issue transaction in history.
                </p>
              </div>
            </div>

            <div className="page-header-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRefresh}
                disabled={refreshing || isLoading}
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* SUMMARY CARDS */}
          {!isLoading && !error && (
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-card-icon summary-card-icon-neutral">
                  <Layers size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <span className="summary-card-value">
                    {summary.total}
                  </span>
                  <span className="summary-card-label">
                    Total Pieces
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-card-icon summary-card-icon-success">
                  <PackageCheck size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <span className="summary-card-value">
                    {summary.available}
                  </span>
                  <span className="summary-card-label">
                    Available
                  </span>
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
                    Partially Issued
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-card-icon summary-card-icon-neutral">
                  <PackageX size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <span className="summary-card-value">
                    {summary.fully}
                  </span>
                  <span className="summary-card-label">
                    Fully Issued
                  </span>
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {!isLoading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchAvailable()} />
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* TABS */}
              <div className="tabs">
                <button
                  type="button"
                  className={`tab ${
                    activeTab === "available" ? "tab-active" : ""
                  }`}
                  onClick={() => switchTab("available")}
                >
                  Available Material
                  <span className="tab-count">
                    {availableMaterial.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`tab ${
                    activeTab === "history" ? "tab-active" : ""
                  }`}
                  onClick={() => switchTab("history")}
                >
                  Issue History
                  <span className="tab-count">
                    {issueHistory.length}
                  </span>
                </button>
              </div>

              {/* AVAILABLE MATERIAL TAB */}
              {activeTab === "available" && (
                <div className="panel">
                  <FilterPanel
                    search={availableSearch}
                    onSearchChange={setAvailableSearch}
                    filters={availableFilters}
                    onFilterChange={handleAvailableFilterChange}
                    options={filterOptions}
                    onClear={clearAvailableFilters}
                    open={filtersOpen}
                    onToggleOpen={() => setFiltersOpen((o) => !o)}
                    resultCount={filteredAvailable.length}
                    searchPlaceholder="Search material, PO number, description, project, Job Work ID..."
                  />

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
                          <th>Piece No</th>
                          <th>Specification</th>
                          <th>Thickness</th>
                          <th>Size</th>
                          <th>Unit</th>
                          <th>Job Work Type</th>
                          <th>Job Work Unit</th>
                          <th>Process</th>
                          <th>Process ID</th>
                          <th>Received Qty</th>
                          <th>Previously Issued</th>
                          <th>Available Qty</th>
                          <th>Status</th>
                          <th className="cell-action">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAvailable.length === 0 && (
                          <tr>
                            <td colSpan={20}>
                              <div className="empty-state">
                                <div className="empty-state-icon">📦</div>
                                <p className="empty-state-title">
                                  No Available Material
                                </p>
                                <p className="empty-state-desc">
                                  No received material matches the
                                  current search / filters.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {filteredAvailable.map((row) => (
                          <tr key={row.key}>
                            <td className="cell-mono">
                              {row.jobWorkId}
                            </td>
                            <td>{row.poType}</td>
                            <td>{row.poNumber}</td>
                            <td>{row.supplier}</td>
                            <td>{row.description}</td>
                            <td>{row.project}</td>
                            <td className="cell-mono">
                              {row.pieceNo}
                            </td>
                            <td>{row.materialSpec}</td>
                            <td>{row.thickness}</td>
                            <td>{row.size}</td>
                            <td>{row.unit}</td>
                            <td>
                              <span
                                className={`type-badge ${
                                  row.jobWorkType === "Outsourcing"
                                    ? "type-badge-outsourcing"
                                    : "type-badge-inhouse"
                                }`}
                              >
                                {row.jobWorkType}
                              </span>
                            </td>
                            <td>{row.jobWorkUnit}</td>
                            <td>{row.process}</td>
                            <td className="cell-mono">
                              {row.processId}
                            </td>
                            <td className="cell-num">
                              {fmt(row.receivedQty)} {row.jobWorkUnit}
                            </td>
                            <td className="cell-num">
                              {fmt(row.previouslyIssuedQty)}{" "}
                              {row.jobWorkUnit}
                            </td>
                            <td className="cell-num cell-available">
                              {fmt(row.availableQty)} {row.jobWorkUnit}
                            </td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td>
                              <div className="table-row-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openView("available", row)
                                  }
                                  title="View Details"
                                  aria-label="View Details"
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openIssue(row)}
                                  className="btn btn-primary btn-sm"
                                >
                                  Issue
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ISSUE HISTORY TAB */}
              {activeTab === "history" && (
                <div className="panel">
                  <FilterPanel
                    search={historySearch}
                    onSearchChange={setHistorySearch}
                    filters={historyFilters}
                    onFilterChange={handleHistoryFilterChange}
                    options={filterOptions}
                    onClear={clearHistoryFilters}
                    open={filtersOpen}
                    onToggleOpen={() => setFiltersOpen((o) => !o)}
                    resultCount={filteredHistory.length}
                    searchPlaceholder="Search Issue ID, material, PO number, description, project, Job Work ID..."
                  />

                  <div className="table-scroll-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Issue ID</th>
                          <th>Job Work ID</th>
                          <th>PO Type</th>
                          <th>PO Number</th>
                          <th>Supplier</th>
                          <th>PO Description</th>
                          <th>Project</th>
                          <th>Piece No</th>
                          <th>Specification</th>
                          <th>Thickness</th>
                          <th>Size</th>
                          <th>Unit</th>
                          <th>Job Work Type</th>
                          <th>Job Work Unit</th>
                          <th>Original Received</th>
                          <th>Previously Issued</th>
                          <th>Issued Now</th>
                          <th>Remaining Available</th>
                          <th>Issued By</th>
                          <th>Issue Date</th>
                          <th>Status</th>
                          <th className="cell-action">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.length === 0 && (
                          <tr>
                            <td colSpan={22}>
                              <div className="empty-state">
                                <div className="empty-state-icon">🗂️</div>
                                <p className="empty-state-title">
                                  No Issue History
                                </p>
                                <p className="empty-state-desc">
                                  No issue transactions match the
                                  current search / filters.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {filteredHistory.map((row) => (
                          <tr key={row.issueId}>
                            <td className="cell-mono">{row.issueId}</td>
                            <td>{row.jobWorkId}</td>
                            <td>{row.poType}</td>
                            <td>{row.poNumber}</td>
                            <td>{row.supplier}</td>
                            <td>{row.description}</td>
                            <td>{row.project}</td>
                            <td className="cell-mono">{row.pieceNo}</td>
                            <td>{row.materialSpec}</td>
                            <td>{row.thickness}</td>
                            <td>{row.size}</td>
                            <td>{row.unit}</td>
                            <td>
                              <span
                                className={`type-badge ${
                                  row.jobWorkType === "Outsourcing"
                                    ? "type-badge-outsourcing"
                                    : "type-badge-inhouse"
                                }`}
                              >
                                {row.jobWorkType}
                              </span>
                            </td>
                            <td>{row.jobWorkUnit}</td>
                            <td className="cell-num">
                              {fmt(row.originalReceivedQty)}{" "}
                              {row.jobWorkUnit}
                            </td>
                            <td className="cell-num">
                              {fmt(row.previouslyIssuedQty)}{" "}
                              {row.jobWorkUnit}
                            </td>
                            <td className="cell-num cell-available">
                              {fmt(row.issuedNow)} {row.jobWorkUnit}
                            </td>
                            <td className="cell-num">
                              {fmt(row.remainingAvailableQty)}{" "}
                              {row.jobWorkUnit}
                            </td>
                            <td>{row.issuedBy}</td>
                            <td>{row.issueDate}</td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td>
                              <div className="table-row-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openView("history", row)
                                  }
                                  title="View Details"
                                  aria-label="View Details"
                                >
                                  <EyeIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* EYE VIEW MODAL */}
          {viewData && (
            <div className="modal-overlay" onClick={closeView}>
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {viewData.type === "available"
                        ? "Material Detail"
                        : "Issue Detail"}
                    </h2>
                    <p className="modal-subtitle">
                      {viewData.type === "available" ? (
                        <>
                          Job Work ID :{" "}
                          <strong>{viewData.row.jobWorkId}</strong>
                          {" · "}Piece{" "}
                          <strong>{viewData.row.pieceNo}</strong>
                        </>
                      ) : (
                        <>
                          Issue ID :{" "}
                          <strong>{viewData.row.issueId}</strong>
                        </>
                      )}
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
                  {viewData.type === "available" ? (
                    <AvailableEyeView row={viewData.row} />
                  ) : (
                    <HistoryEyeView row={viewData.row} />
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

          {/* ISSUE TO PRODUCTION MODAL */}
          {issueRow && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      Issue to Production
                    </h2>
                    <p className="modal-subtitle">
                      Job Work ID :{" "}
                      <strong>{issueRow.jobWorkId}</strong> · Piece{" "}
                      <strong>{issueRow.pieceNo}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeIssue}
                    className="modal-close-btn"
                    aria-label="Close"
                    disabled={savingIssue}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  {/* Material Details */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">
                      Material Details
                    </h3>
                    <div className="readonly-grid">
                      <ReadonlyField
                        label="Job Work ID"
                        value={issueRow.jobWorkId}
                      />
                      <ReadonlyField
                        label="PO Type"
                        value={issueRow.poType}
                      />
                      <ReadonlyField
                        label="PO Number"
                        value={issueRow.poNumber}
                      />
                      <ReadonlyField
                        label="Supplier"
                        value={issueRow.supplier}
                      />
                      <ReadonlyField
                        label="PO Description"
                        value={issueRow.description}
                      />
                      <ReadonlyField
                        label="Project"
                        value={issueRow.project}
                      />
                      <ReadonlyField
                        label="Piece No"
                        value={issueRow.pieceNo}
                      />
                      <ReadonlyField
                        label="Specification"
                        value={issueRow.materialSpec}
                      />
                      <ReadonlyField
                        label="Thickness"
                        value={issueRow.thickness}
                      />
                      <ReadonlyField
                        label="Size"
                        value={issueRow.size}
                      />
                      <ReadonlyField
                        label="Unit"
                        value={issueRow.unit}
                      />
                      <ReadonlyField
                        label="Job Work Type"
                        value={issueRow.jobWorkType}
                      />
                      <ReadonlyField
                        label="Job Work Unit"
                        value={issueRow.jobWorkUnit}
                      />
                      <ReadonlyField
                        label="Process"
                        value={`${issueRow.process} - ${issueRow.processId}`}
                      />
                      <ReadonlyField
                        label="Received Quantity"
                        value={`${fmt(issueRow.receivedQty)} ${
                          issueRow.jobWorkUnit
                        }`}
                      />
                      <ReadonlyField
                        label="Previously Issued"
                        value={`${fmt(
                          issueRow.previouslyIssuedQty
                        )} ${issueRow.jobWorkUnit}`}
                      />
                      <ReadonlyField
                        label="Available Quantity"
                        value={`${fmt(issueRow.availableQty)} ${
                          issueRow.jobWorkUnit
                        }`}
                        emphasize
                      />
                    </div>
                  </div>

                  {/* Issue Quantity */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">
                      Issue Quantity
                    </h3>
                    <div className="form-field qty-field">
                      <label htmlFor="issue-qty">
                        Issue Quantity (max{" "}
                        {fmt(issueRow.availableQty)}{" "}
                        {issueRow.jobWorkUnit})
                      </label>
                      <input
                        id="issue-qty"
                        type="number"
                        min="1"
                        max={issueRow.availableQty}
                        className="qty-input"
                        placeholder="0"
                        value={issueForm.quantity}
                        onChange={(e) =>
                          setIssueForm((f) => ({
                            ...f,
                            quantity: e.target.value,
                          }))
                        }
                        disabled={savingIssue}
                      />
                    </div>
                  </div>

                  {/* Issued By */}
                  <div className="form-field">
                    <label htmlFor="issued-by">Issued By</label>
                    <input
                      id="issued-by"
                      type="text"
                      placeholder="Enter name"
                      value={issueForm.issuedBy}
                      onChange={(e) =>
                        setIssueForm((f) => ({
                          ...f,
                          issuedBy: e.target.value,
                        }))
                      }
                      disabled={savingIssue}
                    />
                  </div>

                  {issueError && (
                    <div className="error-box">{issueError}</div>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeIssue}
                    className="btn btn-secondary"
                    disabled={savingIssue}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmIssue}
                    className="btn btn-primary"
                    disabled={savingIssue}
                  >
                    {savingIssue
                      ? "Issuing..."
                      : "Issue to Production"}
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

/* =========================================================================
   Filter Panel
   ========================================================================= */
function FilterPanel({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  options,
  onClear,
  open,
  onToggleOpen,
  resultCount,
  searchPlaceholder,
}) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder={searchPlaceholder}
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
        <FilterIcon />
        Filters
        {activeFilterCount > 0 && (
          <span className="tab-count">{activeFilterCount}</span>
        )}
      </button>
      <button type="button" onClick={onClear} className="btn-link">
        Clear Filters
      </button>

      {open && (
        <div className="filters-grid">
          {FILTER_FIELDS.map((f) => (
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
        </div>
      )}

      <p className="result-count">
        {resultCount} record{resultCount !== 1 ? "s" : ""} found
      </p>
    </div>
  );
}

/* =========================================================================
   Eye views
   ========================================================================= */
function AvailableEyeView({ row }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">
          Original Integrated Requirement
        </h3>
        <p className="modal-card-subtitle">
          Read only — from DWG / BOM / PO integration.
        </p>
        <div className="readonly-grid">
          <ReadonlyField label="Project" value={row.project} />
          <ReadonlyField
            label="Description"
            value={row.description}
          />
          <ReadonlyField
            label="Specification"
            value={row.materialSpec}
          />
          <ReadonlyField label="Thickness" value={row.thickness} />
          <ReadonlyField label="Size" value={row.size} />
          <ReadonlyField label="Piece No" value={row.pieceNo} />
          <ReadonlyField label="PO Number" value={row.poNumber} />
          <ReadonlyField
            label="PO Description"
            value={row.description}
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">
          Issued Quantity Summary
        </h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Received Quantity"
            value={`${fmt(row.receivedQty)} ${row.jobWorkUnit}`}
          />
          <ReadonlyField
            label="Previously Issued"
            value={`${fmt(row.previouslyIssuedQty)} ${
              row.jobWorkUnit
            }`}
          />
          <ReadonlyField
            label="Available Quantity"
            value={`${fmt(row.availableQty)} ${row.jobWorkUnit}`}
            emphasize
          />
        </div>
      </div>
    </>
  );
}

function HistoryEyeView({ row }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">
          Original Integrated Requirement
        </h3>
        <div className="readonly-grid">
          <ReadonlyField label="Project" value={row.project} />
          <ReadonlyField
            label="Description"
            value={row.description}
          />
          <ReadonlyField
            label="Specification"
            value={row.materialSpec}
          />
          <ReadonlyField label="Thickness" value={row.thickness} />
          <ReadonlyField label="Size" value={row.size} />
          <ReadonlyField label="Piece No" value={row.pieceNo} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">Issue to Production</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Issue ID" value={row.issueId} />
          <ReadonlyField
            label="Original Received"
            value={`${fmt(row.originalReceivedQty)} ${
              row.jobWorkUnit
            }`}
          />
          <ReadonlyField
            label="Previously Issued"
            value={`${fmt(row.previouslyIssuedQty)} ${
              row.jobWorkUnit
            }`}
          />
          <ReadonlyField
            label="Issued Quantity"
            value={`${fmt(row.issuedNow)} ${row.jobWorkUnit}`}
            emphasize
          />
          <ReadonlyField
            label="Remaining Available"
            value={`${fmt(row.remainingAvailableQty)} ${
              row.jobWorkUnit
            }`}
          />
          <ReadonlyField label="Issued By" value={row.issuedBy} />
          <ReadonlyField label="Issue Date" value={row.issueDate} />
          <ReadonlyField label="Status" value={row.status} />
        </div>
      </div>
    </>
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
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Available: "status-badge-success",
    "Partially Issued": "status-badge-warning",
    "Fully Issued": "status-badge-neutral",
    Issued: "status-badge-info",
    "In Production": "status-badge-warning",
    Completed: "status-badge-success",
  };
  return (
    <span className={`status-badge ${map[status] || ""}`}>
      {status}
    </span>
  );
}

function FilterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}