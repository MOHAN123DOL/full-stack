import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  AlertTriangle,
  PackageCheck,
  PackageX,
  PackagePlus,
  Hourglass,
  Eye,
  Pencil,
  Trash2,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import useFilterOptions from "../../hooks/useFilterOptions";

import "./ReceiveGRN.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const API_BASE = "/erp/material";
const UNITS = ["Unit 1", "Unit 2"];
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

function grnStatusOf(item) {
  if (item.received <= 0) return "Not Received";
  if (item.received >= item.poQty) return "Fully Received";
  return "Partially Received";
}


/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    "Not Received": "neutral",
    "Partially Received": "warning",
    "Fully Received": "success",
    "Actual PO": "info",
    "Dummy PO": "amber-outline",
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

function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">
          <AlertTriangle size={20} strokeWidth={1.8} />
        </div>
        <h3 className="confirm-title">{title}</h3>
        {message && <p className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, title, subtitle, onClose, children }) {
  return (
    <div
      className={`drawer-overlay ${open ? "drawer-overlay-visible" : ""}`}
      onClick={onClose}
    >
      <div
        className={`drawer-box ${open ? "drawer-box-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <h3 className="drawer-title">{title}</h3>
            {subtitle && <p className="drawer-subtitle">{subtitle}</p>}
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}


/* ============================================================
   EMPTY FORMS
   ============================================================ */

const emptyReceiveForm = {
  receivingUnit: "Unit 1",
  receivedNow: "",
  receivedBy: "",
  remarks: "",
};


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function ReceiveGRN() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  /* -------------------- data -------------------- */
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);

  /* -------------------- ui state -------------------- */
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  /* -------------------- filters -------------------- */
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Headline filters
  const [thicknessFilter, setThicknessFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");

  // Dimension filters
  const [lengthFilter, setLengthFilter] = useState("All");
  const [widthFilter, setWidthFilter] = useState("All");

  // Remaining filters
  const [poNumberFilter, setPoNumberFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [poTypeFilter, setPoTypeFilter] = useState("All");
  const [grnStatusFilter, setGrnStatusFilter] = useState("All");
  const [unitFilter, setUnitFilter] = useState("All");

  /* -------------------- receive drawer -------------------- */
  const [receiveItem, setReceiveItem] = useState(null);
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);
  const [receiveErrors, setReceiveErrors] = useState({});
  const [savingReceive, setSavingReceive] = useState(false);

  /* -------------------- history -------------------- */
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState(emptyReceiveForm);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);


  /* ============================================================
     FILTER OPTIONS — MASTER-DRIVEN DROPDOWNS
     ============================================================ */

  const { options: filterOptions, refresh: refreshFilterOptions } =
    useFilterOptions("material-receive", {
      enabled: !!accessToken,
    });


  /* ============================================================
     AUTH HEADERS
     ============================================================ */

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );


  /* ============================================================
     TOAST
     ============================================================ */

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }


  /* ============================================================
     FETCHERS
     ============================================================ */

  const fetchReceivables = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;

      try {
        if (!silent) setIsLoading(true);
        setError("");

        const res = await api.get(
          `${API_BASE}/receive/list/`,
          { headers: authHeaders() }
        );

        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];

        setItems(list);

      } catch (err) {
        console.error("Failed to load receivables:", err);
        setError(getApiError(err, "Failed to load receivables."));
        setItems([]);
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

        const res = await api.get(
          `${API_BASE}/receive/history/`,
          { headers: authHeaders() }
        );

        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];

        setHistory(list);

      } catch (err) {
        console.error("Failed to load history:", err);
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
    fetchReceivables();
    fetchHistory();
  }, [accessToken, fetchReceivables, fetchHistory]);


  /* ============================================================
     DERIVED ROWS
     ============================================================ */

  const rows = useMemo(
    () =>
      items.map((item) => {
        const balance = Number(item.balance) || 0;
        return {
          ...item,
          balance,
          grnStatus: grnStatusOf(item),
        };
      }),
    [items]
  );


  /* ============================================================
     FILTERING
     ============================================================ */

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      // ---------------- SEARCH ----------------
      const matchesSearch =
        !q ||
        [
          row.poNumber,
          row.description,
          row.project,
          row.thickness,
          row.length,
          row.width,
          row.supplier,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      // ---------------- HEADLINE FILTERS ----------------
      const matchesThickness =
        thicknessFilter === "All" ||
        String(row.thickness ?? "").trim() === thicknessFilter;

      const matchesProject =
        projectFilter === "All" || row.project === projectFilter;

      // ---------------- DIMENSION FILTERS ----------------
      const matchesLength =
        lengthFilter === "All" ||
        String(row.length ?? "").trim() === lengthFilter;

      const matchesWidth =
        widthFilter === "All" ||
        String(row.width ?? "").trim() === widthFilter;

      // ---------------- REMAINING FILTERS ----------------
      const matchesPO =
        !poNumberFilter.trim() ||
        String(row.poNumber ?? "")
          .toLowerCase()
          .includes(poNumberFilter.trim().toLowerCase());

      const matchesSupplier =
        supplierFilter === "All" || row.supplier === supplierFilter;

      const matchesPoType =
        poTypeFilter === "All" || row.poType === poTypeFilter;

      const matchesStatus =
        grnStatusFilter === "All" ||
        row.grnStatus === grnStatusFilter;

      const matchesUnit =
        unitFilter === "All" || row.receivingUnit === unitFilter;

      return (
        matchesSearch &&
        matchesThickness &&
        matchesProject &&
        matchesLength &&
        matchesWidth &&
        matchesPO &&
        matchesSupplier &&
        matchesPoType &&
        matchesStatus &&
        matchesUnit
      );
    });
  }, [
    rows,
    search,
    thicknessFilter,
    projectFilter,
    lengthFilter,
    widthFilter,
    poNumberFilter,
    supplierFilter,
    poTypeFilter,
    grnStatusFilter,
    unitFilter,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    thicknessFilter !== "All" ||
    projectFilter !== "All" ||
    lengthFilter !== "All" ||
    widthFilter !== "All" ||
    poNumberFilter.trim() !== "" ||
    supplierFilter !== "All" ||
    poTypeFilter !== "All" ||
    grnStatusFilter !== "All" ||
    unitFilter !== "All";

  function clearFilters() {
    setSearch("");
    setThicknessFilter("All");
    setProjectFilter("All");
    setLengthFilter("All");
    setWidthFilter("All");
    setPoNumberFilter("");
    setSupplierFilter("All");
    setPoTypeFilter("All");
    setGrnStatusFilter("All");
    setUnitFilter("All");
  }


  /* ============================================================
     SUMMARY
     ============================================================ */

  const summary = useMemo(
    () => ({
      totalItems: rows.length,
      notReceived: rows.filter(
        (r) => r.grnStatus === "Not Received"
      ).length,
      partiallyReceived: rows.filter(
        (r) => r.grnStatus === "Partially Received"
      ).length,
      fullyReceived: rows.filter(
        (r) => r.grnStatus === "Fully Received"
      ).length,
      integrationPending: rows.filter(
        (r) => r.integrationStatus !== "Integrated"
      ).length,
    }),
    [rows]
  );


  /* ============================================================
     RECEIVE FLOW
     ============================================================ */

  function openReceive(row) {
    setReceiveItem(row);
    setReceiveForm({
      ...emptyReceiveForm,
      receivingUnit: row.receivingUnit || "Unit 1",
    });
    setReceiveErrors({});
  }

  function validateReceive(form, balance) {
    const errs = {};
    const qty = Number(form.receivedNow);

    if (!form.receivedNow || Number.isNaN(qty) || qty <= 0) {
      errs.receivedNow = "Enter a quantity greater than 0";
    } else if (qty > balance) {
      errs.receivedNow = `Only ${balance} unit${
        balance === 1 ? "" : "s"
      } available to receive.`;
    }

    if (!form.receivedBy.trim()) {
      errs.receivedBy = "Received By is required";
    }

    return errs;
  }

  async function handleSaveReceive() {
    if (!receiveItem) return;

    const errs = validateReceive(receiveForm, receiveItem.balance);
    setReceiveErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSavingReceive(true);

      await api.post(
        `${API_BASE}/receive/`,
        {
          sourceType: receiveItem.sourceType,
          poItemId: receiveItem.poItemId,
          receivingUnit: receiveForm.receivingUnit,
          receivedQty: Number(receiveForm.receivedNow),
          receivedBy: receiveForm.receivedBy.trim(),
          remarks: receiveForm.remarks.trim(),
        },
        { headers: authHeaders() }
      );

      showToast("GRN recorded successfully.");
      setReceiveItem(null);

      await fetchReceivables({ silent: true });
      await fetchHistory({ silent: true });

    } catch (err) {
      console.error("Receive failed:", err);
      setReceiveErrors({
        submit: getApiError(err, "Failed to receive."),
      });
    } finally {
      setSavingReceive(false);
    }
  }


  /* ============================================================
     HISTORY — EDIT
     ============================================================ */

  function openEditEntry(entry) {
    setEditingEntry(entry);
    setEditForm({
      receivingUnit: entry.unit || "Unit 1",
      receivedNow: String(entry.receivedQty),
      receivedBy: entry.receivedBy === "—" ? "" : entry.receivedBy,
      remarks: entry.remarks || "",
    });
    setEditErrors({});
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;

    const numericId = Number(
      String(editingEntry.id).replace("grn-", "")
    );

    const errs = {};
    if (!editForm.receivedNow || Number(editForm.receivedNow) <= 0) {
      errs.receivedNow = "Quantity must be greater than 0";
    }
    if (!editForm.receivedBy.trim()) {
      errs.receivedBy = "Received By is required";
    }

    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSavingEdit(true);

      await api.patch(
        `${API_BASE}/receive/history/${numericId}/`,
        {
          unit: editForm.receivingUnit,
          receivedQty: Number(editForm.receivedNow),
          receivedBy: editForm.receivedBy.trim(),
          remarks: editForm.remarks,
        },
        { headers: authHeaders() }
      );

      showToast("GRN updated.");
      setEditingEntry(null);

      await fetchReceivables({ silent: true });
      await fetchHistory({ silent: true });

    } catch (err) {
      console.error("Update failed:", err);
      setEditErrors({
        submit: getApiError(err, "Failed to update GRN."),
      });
    } finally {
      setSavingEdit(false);
    }
  }


  /* ============================================================
     HISTORY — DELETE
     ============================================================ */

  async function confirmDeleteEntry() {
    if (!deleteEntry) return;

    const numericId = Number(
      String(deleteEntry.id).replace("grn-", "")
    );

    try {
      await api.delete(
        `${API_BASE}/receive/history/${numericId}/`,
        { headers: authHeaders() }
      );

      showToast("GRN deleted.");
      setDeleteEntry(null);

      await fetchReceivables({ silent: true });
      await fetchHistory({ silent: true });

    } catch (err) {
      console.error("Delete failed:", err);
      showToast(getApiError(err, "Failed to delete GRN."));
    }
  }


  /* ============================================================
     REFRESH / BACK
     ============================================================ */

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      fetchReceivables({ silent: true }),
      fetchHistory({ silent: true }),
      refreshFilterOptions(),
    ]);
    setRefreshing(false);
    showToast("Refreshed");
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

          {/* ---------------- HEADER ---------------- */}

          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>

              <div className="page-header-title-group">
                <h1 className="page-header-title">GRN / Receive</h1>
                <p className="page-header-subtitle">
                  Receive and track materials against purchase orders.
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

          {toast && <div className="toast">{toast}</div>}

          {/* ---------------- LOADING ---------------- */}

          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {/* ---------------- ERROR ---------------- */}

          {!isLoading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchReceivables()} />
            </div>
          )}

          {/* ---------------- CONTENT ---------------- */}

          {!isLoading && !error && (
            <>
              {/* ---------------- SUMMARY CARDS ---------------- */}

              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-neutral">
                    <PackagePlus size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.totalItems}
                    </span>
                    <span className="summary-card-label">
                      Total PO Items
                    </span>
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
                    <span className="summary-card-label">
                      Not Received
                    </span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-warning">
                    <Hourglass size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.partiallyReceived}
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
                    <span className="summary-card-value">
                      {summary.fullyReceived}
                    </span>
                    <span className="summary-card-label">
                      Fully Received
                    </span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-card-icon summary-card-icon-danger">
                    <PackageX size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="summary-card-value">
                      {summary.integrationPending}
                    </span>
                    <span className="summary-card-label">
                      Integration Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* ---------------- RECEIVABLES ---------------- */}

              <section className="panel">
                <div className="panel-head">
                  <div className="panel-head-title">
                    Receivable Materials
                  </div>
                  <p
                    className="panel-head-subtitle"
                    style={{ marginTop: 0 }}
                  >
                    Every PO item appears as its own receivable line.
                  </p>
                </div>

                <div className="panel-toolbar">
                  <div className="panel-toolbar-search">
                    <Search size={14} />
                    <input
                      placeholder="Search PO, project, description, thickness, length, width..."
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

                {showFilters && (
                  <div className="filters-grid">
                    {/* ---- HEADLINE FILTERS ---- */}

                    <div className="form-field">
                      <label>Thickness</label>
                      <select
                        value={thicknessFilter}
                        onChange={(e) =>
                          setThicknessFilter(e.target.value)
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
                        value={projectFilter}
                        onChange={(e) =>
                          setProjectFilter(e.target.value)
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

                    {/* ---- DIMENSION FILTERS ---- */}

                    <div className="form-field">
                      <label>Length</label>
                      <select
                        value={lengthFilter}
                        onChange={(e) =>
                          setLengthFilter(e.target.value)
                        }
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
                        value={widthFilter}
                        onChange={(e) =>
                          setWidthFilter(e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {(filterOptions.width || []).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ---- REMAINING FILTERS ---- */}

                    <div className="form-field">
                      <label>PO Number</label>
                      <input
                        type="text"
                        placeholder="e.g. PO-1004"
                        value={poNumberFilter}
                        onChange={(e) =>
                          setPoNumberFilter(e.target.value)
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Supplier</label>
                      <select
                        value={supplierFilter}
                        onChange={(e) =>
                          setSupplierFilter(e.target.value)
                        }
                      >
                        <option value="All">All</option>
                        {(filterOptions.supplier || []).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>PO Type</label>
                      <select
                        value={poTypeFilter}
                        onChange={(e) =>
                          setPoTypeFilter(e.target.value)
                        }
                      >
                        <option>All</option>
                        <option>Actual PO</option>
                        <option>Dummy PO</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>GRN Status</label>
                      <select
                        value={grnStatusFilter}
                        onChange={(e) =>
                          setGrnStatusFilter(e.target.value)
                        }
                      >
                        <option>All</option>
                        <option>Not Received</option>
                        <option>Partially Received</option>
                        <option>Fully Received</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Unit</label>
                      <select
                        value={unitFilter}
                        onChange={(e) =>
                          setUnitFilter(e.target.value)
                        }
                      >
                        <option>All</option>
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                      <span className="form-hint">
                        Set once material has been received into a unit.
                      </span>
                    </div>
                  </div>
                )}

                <div className="table-scroll">
                  <table className="data-table grn-receivable-table">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>PO Type</th>
                        <th>Description</th>
                        <th>Project</th>
                        <th>Thickness</th>
                        <th>Length</th>
                        <th>Width</th>
                        <th>Unit</th>
                        <th>PO Qty</th>
                        <th>Received</th>
                        <th>Balance</th>
                        <th>GRN Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr key={row.id}>
                          <td className="cell-mono">{row.poNumber}</td>
                          <td>
                            <StatusBadge status={row.poType} />
                          </td>
                          <td>{row.description || "—"}</td>
                          <td
                            className={
                              row.project === "—" ? "cell-muted" : ""
                            }
                          >
                            {row.project || "—"}
                          </td>
                          <td>{row.thickness || "—"}</td>
                          <td>{row.length || "—"}</td>
                          <td>{row.width || "—"}</td>
                          <td>{row.unit || "—"}</td>
                          <td>{fmt(row.poQty)}</td>
                          <td>{fmt(row.received)}</td>
                          <td>
                            <strong>{fmt(row.balance)}</strong>
                          </td>
                          <td>
                            <StatusBadge status={row.grnStatus} />
                          </td>
                          <td>
                            {row.balance > 0 ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => openReceive(row)}
                              >
                                Receive
                              </button>
                            ) : (
                              <span className="grn-fully-received-tag">
                                <PackageCheck size={14} />
                                Fully Received
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={13}>
                            <div className="empty-state">
                              <p className="empty-state-title">
                                No receivable items match your search
                                or filters
                              </p>
                              <p className="empty-state-desc">
                                Try clearing filters or searching by PO
                                number, project, thickness, length or
                                width.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ---------------- GRN HISTORY ---------------- */}

              <section className="panel">
                <div className="panel-head">
                  <div className="panel-head-title">GRN History</div>
                  <p
                    className="panel-head-subtitle"
                    style={{ marginTop: 0 }}
                  >
                    All recorded receipts. Deleting a GRN restores its
                    quantity to the PO balance.
                  </p>
                </div>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>GRN Number</th>
                        <th>GRN Date</th>
                        <th>PO Number</th>
                        <th>Description</th>
                        <th>Received Qty</th>
                        <th>Unit</th>
                        <th>Received By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="cell-mono">{h.grnNumber}</td>
                          <td>{h.grnDate}</td>
                          <td className="cell-mono">{h.poNumber}</td>
                          <td>{h.description}</td>
                          <td>
                            <strong>{fmt(h.receivedQty)}</strong>
                          </td>
                          <td>{h.unit}</td>
                          <td>{h.receivedBy || "—"}</td>
                          <td>
                            <div className="table-row-actions">
                              <button
                                onClick={() => setViewEntry(h)}
                                aria-label="View"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => openEditEntry(h)}
                                aria-label="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="danger"
                                onClick={() => setDeleteEntry(h)}
                                aria-label="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {history.length === 0 && (
                        <tr>
                          <td colSpan={8}>
                            <div className="empty-state">
                              <p className="empty-state-title">
                                No GRN recorded yet
                              </p>
                              <p className="empty-state-desc">
                                Receive material against a PO to see it
                                listed here.
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


          {/* ---------------- RECEIVE DRAWER ---------------- */}

          <Drawer
            open={!!receiveItem}
            title="Receive Material"
            subtitle={
              receiveItem
                ? `${receiveItem.poNumber} · ${receiveItem.description}`
                : ""
            }
            onClose={() => setReceiveItem(null)}
          >
            {receiveItem && (
              <>
                <div className="grn-readonly-block">
                  <div className="grn-kv">
                    <span>PO Number</span>
                    <strong className="mono">
                      {receiveItem.poNumber}
                    </strong>
                  </div>

                  <div className="grn-kv">
                    <span>PO Description</span>
                    <strong>{receiveItem.description}</strong>
                  </div>

                  {receiveItem.project &&
                    receiveItem.project !== "—" && (
                      <div className="grn-kv">
                        <span>Project</span>
                        <strong>{receiveItem.project}</strong>
                      </div>
                    )}

                  <div className="grn-kv">
                    <span>Thickness</span>
                    <strong>{receiveItem.thickness || "—"}</strong>
                  </div>

                  <div className="grn-kv">
                    <span>Length</span>
                    <strong>{receiveItem.length || "—"}</strong>
                  </div>

                  <div className="grn-kv">
                    <span>Width</span>
                    <strong>{receiveItem.width || "—"}</strong>
                  </div>

                  <div className="grn-kv">
                    <span>Unit of Measure</span>
                    <strong>{receiveItem.unit || "—"}</strong>
                  </div>

                  <div className="grn-kv">
                    <span>PO Quantity</span>
                    <strong>{fmt(receiveItem.poQty)}</strong>
                  </div>

                  <div className="grn-kv">
                    <span>Received Quantity</span>
                    <strong>{fmt(receiveItem.received)}</strong>
                  </div>

                  <div className="grn-kv grn-kv-highlight">
                    <span>Balance Quantity</span>
                    <strong>{fmt(receiveItem.balance)}</strong>
                  </div>
                </div>

                <div className="form-grid grn-form-grid">
                  <div className="form-field">
                    <label>
                      Receiving Unit
                      <span className="required-mark">*</span>
                    </label>
                    <select
                      value={receiveForm.receivingUnit}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          receivingUnit: e.target.value,
                        })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`form-field ${
                      receiveErrors.receivedNow
                        ? "form-field-error"
                        : ""
                    }`}
                  >
                    <label>
                      Received Now
                      <span className="required-mark">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={receiveItem.balance}
                      value={receiveForm.receivedNow}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          receivedNow: e.target.value,
                        })
                      }
                      placeholder={`Up to ${fmt(receiveItem.balance)}`}
                    />
                    {receiveErrors.receivedNow ? (
                      <span className="form-error-text">
                        {receiveErrors.receivedNow}
                      </span>
                    ) : (
                      <span className="form-hint">
                        Only {fmt(receiveItem.balance)} unit
                        {receiveItem.balance === 1 ? "" : "s"}{" "}
                        available to receive.
                      </span>
                    )}
                  </div>

                  <div
                    className={`form-field ${
                      receiveErrors.receivedBy
                        ? "form-field-error"
                        : ""
                    }`}
                  >
                    <label>
                      Received By
                      <span className="required-mark">*</span>
                    </label>
                    <input
                      type="text"
                      value={receiveForm.receivedBy}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          receivedBy: e.target.value,
                        })
                      }
                      placeholder="Name of receiver"
                    />
                    {receiveErrors.receivedBy && (
                      <span className="form-error-text">
                        {receiveErrors.receivedBy}
                      </span>
                    )}
                  </div>

                  <div className="form-field form-field-full">
                    <label>Remarks</label>
                    <textarea
                      rows={2}
                      value={receiveForm.remarks}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          remarks: e.target.value,
                        })
                      }
                      placeholder="Optional notes about this receipt"
                    />
                  </div>
                </div>

                {receiveErrors.submit && (
                  <div className="grn-submit-error">
                    {receiveErrors.submit}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setReceiveItem(null)}
                    disabled={savingReceive}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveReceive}
                    disabled={savingReceive}
                  >
                    {savingReceive ? "Saving..." : "Receive"}
                  </button>
                </div>
              </>
            )}
          </Drawer>


          {/* ---------------- EDIT GRN DRAWER ---------------- */}

          <Drawer
            open={!!editingEntry}
            title="Edit GRN"
            subtitle={
              editingEntry
                ? `${editingEntry.grnNumber} · ${editingEntry.poNumber}`
                : ""
            }
            onClose={() => setEditingEntry(null)}
          >
            {editingEntry && (
              <>
                <div className="form-grid grn-form-grid">
                  <div className="form-field">
                    <label>Receiving Unit</label>
                    <select
                      value={editForm.receivingUnit}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          receivingUnit: e.target.value,
                        })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`form-field ${
                      editErrors.receivedNow
                        ? "form-field-error"
                        : ""
                    }`}
                  >
                    <label>Received Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.receivedNow}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          receivedNow: e.target.value,
                        })
                      }
                    />
                    {editErrors.receivedNow && (
                      <span className="form-error-text">
                        {editErrors.receivedNow}
                      </span>
                    )}
                  </div>

                  <div
                    className={`form-field ${
                      editErrors.receivedBy
                        ? "form-field-error"
                        : ""
                    }`}
                  >
                    <label>Received By</label>
                    <input
                      type="text"
                      value={editForm.receivedBy}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          receivedBy: e.target.value,
                        })
                      }
                    />
                    {editErrors.receivedBy && (
                      <span className="form-error-text">
                        {editErrors.receivedBy}
                      </span>
                    )}
                  </div>

                  <div className="form-field form-field-full">
                    <label>Remarks</label>
                    <textarea
                      rows={2}
                      value={editForm.remarks}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          remarks: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {editErrors.submit && (
                  <div className="grn-submit-error">
                    {editErrors.submit}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditingEntry(null)}
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </Drawer>


          {/* ---------------- VIEW MODAL ---------------- */}

          <Modal
            open={!!viewEntry}
            title={viewEntry ? viewEntry.grnNumber : ""}
            subtitle="GRN transaction details"
            onClose={() => setViewEntry(null)}
          >
            {viewEntry && (
              <div className="grn-readonly-block">
                <div className="grn-kv">
                  <span>GRN Date</span>
                  <strong>{viewEntry.grnDate}</strong>
                </div>
                <div className="grn-kv">
                  <span>PO Number</span>
                  <strong className="mono">
                    {viewEntry.poNumber}
                  </strong>
                </div>
                <div className="grn-kv">
                  <span>Description</span>
                  <strong>{viewEntry.description}</strong>
                </div>
                <div className="grn-kv">
                  <span>Received Quantity</span>
                  <strong>{fmt(viewEntry.receivedQty)}</strong>
                </div>
                <div className="grn-kv">
                  <span>Receiving Unit</span>
                  <strong>{viewEntry.unit}</strong>
                </div>
                <div className="grn-kv">
                  <span>Received By</span>
                  <strong>{viewEntry.receivedBy || "—"}</strong>
                </div>
                <div className="grn-kv">
                  <span>Remarks</span>
                  <strong>{viewEntry.remarks || "—"}</strong>
                </div>
              </div>
            )}
          </Modal>


          {/* ---------------- DELETE CONFIRM ---------------- */}

          <ConfirmDialog
            open={!!deleteEntry}
            title="Delete GRN entry?"
            message={
              deleteEntry
                ? `${deleteEntry.grnNumber} (${fmt(
                    deleteEntry.receivedQty
                  )} units) will be removed and the quantity restored to ${deleteEntry.poNumber}'s balance.`
                : ""
            }
            onCancel={() => setDeleteEntry(null)}
            onConfirm={confirmDeleteEntry}
          />

        </div>
      </div>
    </>
  );
}