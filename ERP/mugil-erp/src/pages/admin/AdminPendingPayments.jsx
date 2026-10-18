import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  LayoutGrid,
  List,
  RefreshCw,
  X,
} from "lucide-react";

import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import AdminStatStrip from "./components/AdminStatStrip";
import AdminToolbar from "./components/AdminToolbar";

import Loading from "../../components/loading";
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import { formatCurrency, matchesQuery } from "./adminUtils";

import "./AdminPendingPayments.css";

/* =========================================================
   CONFIG
   ========================================================= */

const PENDING_PAYMENTS_ENDPOINT = "/erp/admin/pending-payments/";
const GENERIC_ERROR = "Something went wrong. Please try again.";

const STATUS_FILTERS = [
  { value: "all", label: "All invoices" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

const STATUS_CHOICES = [
  { value: "pending", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

const isPaid = (row) =>
  row?.is_paid ?? String(row?.payment_status || "").toLowerCase() === "paid";

const statusKey = (row) => (isPaid(row) ? "paid" : "pending");

const TYPE_LABELS = {
  TI: "Tax Invoice",
  PI: "Proforma Invoice",
};

const getShort = (row) => (row?.short || "").toUpperCase();

const getTypeLabel = (row) =>
  row?.type || TYPE_LABELS[getShort(row)] || "Invoice";

/* =========================================================
   SMALL PRESENTATIONAL PIECES
   ========================================================= */

function InvoiceBadge({ row }) {
  const short = getShort(row);
  return (
    <span
      className={`pending-invoice-badge pending-invoice-badge--${short.toLowerCase()}`}
    >
      {short || "—"}
    </span>
  );
}

function AmountPill({ row }) {
  return (
    <span
      className={`pending-amount-value${isPaid(row) ? " pending-amount-value--paid" : ""}`}
    >
      {formatCurrency(row.amount ?? row.outstanding_amount)}
    </span>
  );
}

function StatusBadge({ row }) {
  const paid = isPaid(row);
  return (
    <span
      className={`pending-status-badge${paid ? " pending-status-badge--paid" : ""}`}
    >
      {paid ? (
        <CheckCircle2 size={13} aria-hidden="true" />
      ) : (
        <AlertCircle size={13} aria-hidden="true" />
      )}
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

function ViewButton({ onClick }) {
  return (
    <button type="button" className="pending-view-btn" onClick={onClick}>
      <Eye size={14} aria-hidden="true" />
      View
    </button>
  );
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function AdminPendingPayments() {
  const { accessToken } = useAuth();

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [viewMode, setViewMode] = useState("list"); // "list" | "card"
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // drawer: status editing
  const [draftStatus, setDraftStatus] = useState("pending");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /* =======================================================
     LOAD DATA
     ======================================================= */

  const loadRows = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError("");

      const response = await api.get(PENDING_PAYMENTS_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        throw new Error("Invalid pending payments response.");
      }

      const results = Array.isArray(response.data.data)
        ? response.data.data
        : [];

      setRows(results);
    } catch (error) {
      console.error("Failed to load pending payments:", error);
      setRows([]);
      setLoadError(error?.response?.data?.message || GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  /* =======================================================
     SLIDER: open / close, Esc key, body scroll lock
     ======================================================= */

  const openInvoice = useCallback((row) => {
    setSelectedInvoice(row);
    setDraftStatus(statusKey(row));
    setSaveError("");
  }, []);
  const closeInvoice = useCallback(() => {
    setSelectedInvoice(null);
    setSaveError("");
  }, []);

  useEffect(() => {
    if (!selectedInvoice) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeInvoice();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedInvoice, closeInvoice]);

  const handleSaveStatus = useCallback(async () => {
    if (!selectedInvoice || saving) return;

    try {
      setSaving(true);
      setSaveError("");

      const response = await api.patch(
        `${PENDING_PAYMENTS_ENDPOINT}${selectedInvoice.id}/payment-status/`,
        { payment_status: draftStatus },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.data?.success) {
        throw new Error("Update failed.");
      }

      const updated = response.data.data;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedInvoice(updated);
      setDraftStatus(statusKey(updated));
    } catch (error) {
      console.error("Failed to update payment status:", error);
      setSaveError(error?.response?.data?.message || GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  }, [accessToken, draftStatus, saving, selectedInvoice]);

  /* =======================================================
     SEARCH + DERIVED VALUES
     ======================================================= */

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (statusFilter === "paid" && !isPaid(row)) return false;
        if (statusFilter === "unpaid" && isPaid(row)) return false;
        return matchesQuery(search, row.document_number, row.customer_name);
      }),
    [rows, search, statusFilter],
  );

  // Card view has no built-in sort, so mirror the table default (amount desc).
  const sortedCardRows = useMemo(
    () =>
      [...filteredRows].sort(
        (a, b) =>
          Number(b.outstanding_amount || 0) - Number(a.outstanding_amount || 0),
      ),
    [filteredRows],
  );

  const sumOutstanding = (list) =>
    list.reduce((sum, r) => sum + Number(r.outstanding_amount || 0), 0);

  const sumPaid = (list) =>
    list
      .filter(isPaid)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const filtersActive = Boolean(search) || statusFilter !== "all";
  const kpiRows = filtersActive ? filteredRows : rows;

  const unpaidCount = kpiRows.filter((r) => !isPaid(r)).length;
  const paidCount = kpiRows.length - unpaidCount;

  const dash = loading || loadError;

  /* =======================================================
     TABLE COLUMNS (list view)
     ======================================================= */

  const columns = useMemo(
    () => [
      {
        key: "document_number",
        header: "Invoice Number",
        mono: true,
        render: (row) => (
          <div className="pending-invoice-cell">
            <InvoiceBadge row={row} />
            <span className="pending-invoice-number">
              {row.document_number || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "customer_name",
        header: "Customer Name",
        render: (row) => (
          <div className="pending-customer-cell">
            <span className="pending-customer-name">
              {row.customer_name || "Unknown Customer"}
            </span>
          </div>
        ),
      },
      {
        key: "outstanding_amount",
        header: "Amount",
        align: "right",
        render: (row) => (
          <div className="pending-amount-cell">
            <AmountPill row={row} />
          </div>
        ),
      },
      {
        key: "payment_status",
        header: "Status",
        render: (row) => <StatusBadge row={row} />,
      },
      {
        key: "actions",
        header: "",
        align: "right",
        sortable: false,
        render: (row) => (
          <div className="pending-amount-cell">
            <ViewButton onClick={() => openInvoice(row)} />
          </div>
        ),
      },
    ],
    [openInvoice],
  );

  /* =======================================================
     RENDER HELPERS
     ======================================================= */

  const renderCards = () => {
    if (!sortedCardRows.length) {
      return (
        <div className="pending-empty">
          <CheckCircle2 size={36} aria-hidden="true" />
          <h3>No invoices found</h3>
          <p>
            {rows.length
              ? "No invoices match your filters."
              : "There are no confirmed customer invoices yet."}
          </p>
        </div>
      );
    }

    return (
      <div className="pending-card-grid">
        {sortedCardRows.map((row) => (
          <article
            key={row.id}
            className="pending-invoice-card"
            tabIndex={0}
            onClick={() => openInvoice(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openInvoice(row);
              }
            }}
          >
            <div className="pending-invoice-card-top">
              <span
                className={`pending-type-icon pending-type-icon--${getShort(row).toLowerCase()}`}
              >
                <FileText size={18} aria-hidden="true" />
              </span>
              <div className="pending-invoice-card-id">
                <InvoiceBadge row={row} />
                <span className="pending-invoice-number">
                  {row.document_number || "—"}
                </span>
              </div>
            </div>

            <h3 className="pending-invoice-card-customer">
              {row.customer_name || "Unknown Customer"}
            </h3>
            <StatusBadge row={row} />

            <div className="pending-invoice-card-bottom">
              <AmountPill row={row} />
              <ViewButton
                onClick={(e) => {
                  e.stopPropagation();
                  openInvoice(row);
                }}
              />
            </div>
          </article>
        ))}
      </div>
    );
  };

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="admin-pending-payments-page">
      {/* STICKY TOP HEADER */}
      <header className="pending-topbar">
        <div className="pending-topbar-title">
          <AlertCircle size={16} aria-hidden="true" />
          <span>Receivables</span>
          <span className="pending-topbar-sep">/</span>
          <strong>Pending Payments</strong>
        </div>
        <button
          type="button"
          className="pending-icon-btn"
          onClick={loadRows}
          disabled={loading}
          aria-label="Refresh pending payments"
          title="Refresh"
        >
          <RefreshCw
            size={15}
            className={loading ? "pending-spin" : undefined}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      </header>

      {/* HERO */}
      <section className="admin-payment-hero">
        <div className="admin-payment-hero-content">
          <span className="admin-payment-eyebrow">RECEIVABLES CONTROL</span>
          <h1>Pending Customer Payments</h1>
          <p>Customer invoices awaiting payment</p>
        </div>
      </section>

      {/* SEARCH */}
      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search invoice number or customer name"
      />

      {/* KPI CARDS */}
      <AdminStatStrip
        items={[
          {
            label: filtersActive ? "Outstanding (filtered)" : "Total Outstanding",
            value: dash ? "—" : formatCurrency(sumOutstanding(kpiRows)),
            tone: "danger",
          },
          {
            label: "Unpaid Invoices",
            value: dash ? "—" : unpaidCount,
            tone: "info",
          },
          {
            label: filtersActive ? "Paid (filtered)" : "Total Paid",
            value: dash
              ? "—"
              : `${formatCurrency(sumPaid(kpiRows))} · ${paidCount}`,
            tone: "success",
          },
        ]}
      />

      {/* LIST / CARD CONTENT */}
      <div className="admin-pending-payments-table-wrap">
        {loading ? (
          <div className="admin-payment-loading">
            <Loading />
          </div>
        ) : loadError ? (
          <div className="admin-payment-error">
            <ErrorState onRetry={loadRows} />
            <div className="pending-error-text">{loadError}</div>
          </div>
        ) : (
          <AdminCard>
            <div className="admin-payment-card-header">
              <div className="pending-card-header-left">
                <h2>Customer Invoices</h2>
                <span className="admin-payment-count">
                  {filteredRows.length}{" "}
                  {filteredRows.length === 1 ? "invoice" : "invoices"}
                </span>
              </div>

              <div className="pending-header-controls">
              <select
                className="pending-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by payment status"
              >
                {STATUS_FILTERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div
                className="pending-view-toggle"
                role="group"
                aria-label="Switch view"
              >
                <button
                  type="button"
                  className={viewMode === "list" ? "is-active" : ""}
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                >
                  <List size={14} aria-hidden="true" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  className={viewMode === "card" ? "is-active" : ""}
                  onClick={() => setViewMode("card")}
                  aria-pressed={viewMode === "card"}
                >
                  <LayoutGrid size={14} aria-hidden="true" />
                  <span>Cards</span>
                </button>
              </div>
              </div>
            </div>

            {viewMode === "list" ? (
              <AdminDataTable
                columns={columns}
                rows={filteredRows}
                totalCount={rows.length}
                rowKey="id"
                loading={false}
                error={null}
                onRetry={loadRows}
                onRowClick={openInvoice}
                emptyTitle="No invoices found"
                emptyMessage={
                  rows.length
                    ? "No invoices match your filters."
                    : "There are no confirmed customer invoices yet."
                }
                minWidth={600}
                defaultSort={{ key: "outstanding_amount", direction: "desc" }}
              />
            ) : (
              renderCards()
            )}
          </AdminCard>
        )}
      </div>

      {/* FOOTER NOTE */}
      <p className="admin-payment-note">
        Shows all confirmed Tax Invoices (TI) and Proforma Invoices (PI), paid
        and unpaid. Admins can change an invoice's payment status from the
        details panel. Outstanding totals count unpaid invoices only.
      </p>

      {/* SLIDER (right-hand drawer) */}
      <div
        className={`pending-drawer-overlay${selectedInvoice ? " is-open" : ""}`}
        onClick={closeInvoice}
        aria-hidden="true"
      />
      <aside
        className={`pending-drawer${selectedInvoice ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Invoice details"
        aria-hidden={!selectedInvoice}
      >
        {selectedInvoice && (
          <>
            <div className="pending-drawer-header">
              <div className="pending-drawer-heading">
                <span
                  className={`pending-type-icon pending-type-icon--${getShort(selectedInvoice).toLowerCase()}`}
                >
                  <FileText size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>{selectedInvoice.document_number || "—"}</h2>
                  <p>{getTypeLabel(selectedInvoice)}</p>
                </div>
              </div>
              <button
                type="button"
                className="pending-drawer-close"
                onClick={closeInvoice}
                aria-label="Close details"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="pending-drawer-body">
              <div className={`pending-drawer-amount${isPaid(selectedInvoice) ? " pending-drawer-amount--paid" : ""}`}>
                <span className="pending-drawer-label">
                  {isPaid(selectedInvoice) ? "Amount Paid" : "Outstanding Amount"}
                </span>
                <strong>
                  {formatCurrency(
                    selectedInvoice.amount ?? selectedInvoice.outstanding_amount,
                  )}
                </strong>
              </div>

              <dl className="pending-detail-list">
                <div>
                  <dt>Customer Name</dt>
                  <dd>{selectedInvoice.customer_name || "Unknown Customer"}</dd>
                </div>
                <div>
                  <dt>Invoice Number</dt>
                  <dd className="pending-mono">
                    {selectedInvoice.document_number || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    <InvoiceBadge row={selectedInvoice} />{" "}
                    {getTypeLabel(selectedInvoice)}
                  </dd>
                </div>
                <div>
                  <dt>Payment Status</dt>
                  <dd>
                    <StatusBadge row={selectedInvoice} />
                  </dd>
                </div>
                <div>
                  <dt>Update Status</dt>
                  <dd>
                    <select
                      className="pending-status-select pending-status-select--full"
                      value={draftStatus}
                      onChange={(e) => setDraftStatus(e.target.value)}
                      disabled={saving}
                      aria-label="Set payment status"
                    >
                      {STATUS_CHOICES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
              </dl>
            </div>

            {saveError && (
              <div className="pending-drawer-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {saveError}
              </div>
            )}

            <div className="pending-drawer-footer">
              <button
                type="button"
                className="pending-btn pending-btn--ghost"
                onClick={closeInvoice}
              >
                <X size={15} aria-hidden="true" />
                Close
              </button>
              <button
                type="button"
                className="pending-btn pending-btn--primary"
                onClick={handleSaveStatus}
                disabled={saving || draftStatus === statusKey(selectedInvoice)}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {saving ? "Saving…" : "Save Status"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}