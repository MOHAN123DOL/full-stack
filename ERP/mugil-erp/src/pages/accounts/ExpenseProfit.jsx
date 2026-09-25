import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Search,
  X,
  Eye,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ExpenseProfit.css";

const JOURNAL_ENDPOINT = "/erp/journal/";
const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ---------- option lists ---------- */
const CATEGORY_OPTIONS = [
  "Purchase",
  "Transport",
  "Salary",
  "Rent",
  "Electricity",
  "Maintenance",
  "Office",
  "Sales",
  "Other",
];

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];

/* ============================================================
   COMPONENT
   ============================================================ */

export default function ExpenseProfit() {
  const { accessToken } = useAuth();

  /* Data */
  const [records, setRecords] = useState([]);
  const [totals, setTotals] = useState({
    total_income: 0,
    total_expense: 0,
    net_profit: 0,
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  /* Filters */
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  /* Add form */
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "Expense",
    category: "Transport",
    description: "",
    amount: "",
    paymentMode: "Cash",
    documentNumber: "",
    document: "",
    notes: "",
  });

  /* View modal */
  const [viewingRecord, setViewingRecord] = useState(null);

  /* ============================================================
     LOAD
     ============================================================ */
  const loadRecords = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setLoadError("");

      const response = await api.get(JOURNAL_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) throw new Error("bad response");

      setRecords(Array.isArray(response.data.data) ? response.data.data : []);
      setTotals(
        response.data.totals || {
          total_income: 0,
          total_expense: 0,
          net_profit: 0,
        },
      );
    } catch (error) {
      console.error("Failed to load journal:", error);
      setRecords([]);
      setTotals({ total_income: 0, total_expense: 0, net_profit: 0 });
      setLoadError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  /* ============================================================
     FILTERED LIST
     ============================================================ */
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    return records.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;

      return (
        String(r.description || "").toLowerCase().includes(q) ||
        String(r.category || "").toLowerCase().includes(q) ||
        String(r.document_number || "").toLowerCase().includes(q) ||
        String(r.record_number || "").toLowerCase().includes(q) ||
        String(r.payment_mode || "").toLowerCase().includes(q)
      );
    });
  }, [records, search, typeFilter]);

  /* ============================================================
     FORM
     ============================================================ */
  const handleExpenseChange = (field, value) => {
    setExpenseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (
      !expenseForm.date ||
      !expenseForm.category ||
      !expenseForm.description.trim() ||
      !expenseForm.amount
    ) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    if (!accessToken) {
      setSubmitError("Session expired. Please login again.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post(
        JOURNAL_ENDPOINT,
        {
          date: expenseForm.date,
          type: expenseForm.type,
          category: expenseForm.category,
          description: expenseForm.description.trim(),
          amount: expenseForm.amount,
          payment_mode: expenseForm.paymentMode,
          document_number: expenseForm.documentNumber.trim(),
          document: expenseForm.document.trim(),
          notes: expenseForm.notes.trim(),
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.data?.success) throw new Error("bad response");

      await loadRecords();

      setExpenseForm({
        date: new Date().toISOString().split("T")[0],
        type: "Expense",
        category: "Transport",
        description: "",
        amount: "",
        paymentMode: "Cash",
        documentNumber: "",
        document: "",
        notes: "",
      });
      setShowExpenseForm(false);
    } catch (error) {
      console.error("Failed to save journal entry:", error);
      setSubmitError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     HELPERS
     ============================================================ */
  const formatAmount = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (value) => {
    if (!value) return "";
    const [y, m, d] = String(value).split("-");
    if (!y || !m || !d) return value;
    return `${d}-${m}-${y}`;
  };

  const isProfit = totals.net_profit >= 0;

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <>
      <Header />

      <div className="journal-page">
        <div className="journal-container">
          {/* ---------- HEADER ---------- */}
          <div className="journal-top">
            <Link to="/accounts" className="erp-back-button">
              <ArrowLeft size={16} />
              Back
            </Link>

            <div className="journal-heading">
              <h1>Journal</h1>
              <p>Track income, expenses and profitability</p>
            </div>
          </div>

          {/* ---------- SUMMARY CARDS ---------- */}
          <div className="journal-summary">
            <div className="summary-card summary-card--income">
              <div className="summary-card__icon">
                <TrendingUp size={22} />
              </div>
              <div className="summary-card__body">
                <span className="summary-card__label">Total Income</span>
                <strong className="summary-card__value">
                  {formatAmount(totals.total_income)}
                </strong>
              </div>
            </div>

            <div className="summary-card summary-card--expense">
              <div className="summary-card__icon">
                <TrendingDown size={22} />
              </div>
              <div className="summary-card__body">
                <span className="summary-card__label">Total Expense</span>
                <strong className="summary-card__value">
                  {formatAmount(totals.total_expense)}
                </strong>
              </div>
            </div>

            <div
              className={`summary-card ${
                isProfit ? "summary-card--profit" : "summary-card--loss"
              }`}
            >
              <div className="summary-card__icon">
                <Wallet size={22} />
              </div>
              <div className="summary-card__body">
                <span className="summary-card__label">
                  {isProfit ? "Net Profit" : "Net Loss"}
                </span>
                <strong className="summary-card__value">
                  {formatAmount(totals.net_profit)}
                </strong>
              </div>
            </div>
          </div>

          {/* ---------- ERRORS ---------- */}
          {!loading && loadError && (
            <div className="qt-customer-error" style={{ marginBottom: 16 }}>
              <Error onRetry={loadRecords} />
              <div style={{ marginTop: 8, fontSize: 13 }}>{loadError}</div>
            </div>
          )}

          {submitError && (
            <div className="qt-alert" style={{ marginBottom: 16 }}>
              <div className="qt-alert__icon">!</div>
              <div className="qt-alert__content">
                <strong>Error</strong>
                <span>{submitError}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSubmitError("")}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ---------- TRANSACTIONS SECTION ---------- */}
          <div className="journal-section">
            <div className="journal-section__header">
              <div>
                <h2>Transactions</h2>
                <span className="journal-section__count">
                  {filteredRecords.length} of {records.length}
                </span>
              </div>

              <button
                type="button"
                className="journal-add-btn"
                onClick={() => setShowExpenseForm(true)}
              >
                + Add Transaction
              </button>
            </div>

            {/* ---------- FILTER BAR ---------- */}
            <div className="journal-filters">
              <div className="journal-search">
                <Search size={16} className="journal-search__icon" />
                <input
                  type="text"
                  placeholder="Search description, category, document…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="journal-search__clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="journal-tabs">
                {[
                  { value: "all", label: "All" },
                  { value: "Income", label: "Income" },
                  { value: "Expense", label: "Expense" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`journal-tab ${
                      typeFilter === tab.value ? "journal-tab--active" : ""
                    }`}
                    onClick={() => setTypeFilter(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---------- TABLE ---------- */}
            {loading && (
              <div className="qt-customer-loading">
                <Loading />
              </div>
            )}

            {!loading && !loadError && (
              <div className="journal-table-wrapper">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>S.No</th>
                      <th style={{ width: 110 }}>Date</th>
                      <th style={{ width: 110 }}>Type</th>
                      <th style={{ width: 130 }}>Category</th>
                      <th>Description</th>
                      <th style={{ width: 130, textAlign: "right" }}>
                        Amount
                      </th>
                      <th style={{ width: 130 }}>Payment</th>
                      <th style={{ width: 140 }}>Document No</th>
                      <th style={{ width: 130 }}>Doc Type</th>
                      <th style={{ width: 70, textAlign: "center" }}>
                        View
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record, index) => (
                        <tr key={record.id}>
                          <td className="journal-table__num">{index + 1}</td>
                          <td>{formatDate(record.date)}</td>
                          <td>
                            <span
                              className={`journal-chip ${
                                record.type === "Income"
                                  ? "journal-chip--income"
                                  : "journal-chip--expense"
                              }`}
                            >
                              {record.type}
                            </span>
                          </td>
                          <td>
                            <span className="journal-category">
                              {record.category}
                            </span>
                          </td>
                          <td className="journal-table__desc">
                            {record.description}
                          </td>
                          <td
                            className={`journal-table__amount ${
                              record.type === "Income"
                                ? "journal-table__amount--income"
                                : "journal-table__amount--expense"
                            }`}
                          >
                            {formatAmount(record.amount)}
                          </td>
                          <td>{record.payment_mode}</td>
                          <td className="journal-table__mono">
                            {record.document_number || "—"}
                          </td>
                          <td>{record.document || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="journal-view-btn"
                              onClick={() => setViewingRecord(record)}
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10" className="journal-empty">
                          {records.length === 0
                            ? "No transactions yet. Add one to get started."
                            : "No transactions match the current filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- ADD TRANSACTION MODAL ---------- */}
      {showExpenseForm && (
        <div
          className="journal-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => !submitting && setShowExpenseForm(false)}
        >
          <div
            className="journal-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="journal-modal__header">
              <h3>Add Transaction</h3>
              <button
                type="button"
                className="journal-modal__close"
                onClick={() => !submitting && setShowExpenseForm(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form className="journal-form" onSubmit={handleSaveExpense}>
              <div className="journal-form__grid">
                <label className="journal-field">
                  <span>
                    Date <b>*</b>
                  </span>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) =>
                      handleExpenseChange("date", e.target.value)
                    }
                  />
                </label>

                <label className="journal-field">
                  <span>
                    Type <b>*</b>
                  </span>
                  <select
                    value={expenseForm.type}
                    onChange={(e) =>
                      handleExpenseChange("type", e.target.value)
                    }
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                  </select>
                </label>

                <label className="journal-field">
                  <span>
                    Category <b>*</b>
                  </span>
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      handleExpenseChange("category", e.target.value)
                    }
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="journal-field">
                  <span>
                    Amount (₹) <b>*</b>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      handleExpenseChange("amount", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="journal-field journal-field--wide">
                  <span>
                    Description <b>*</b>
                  </span>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) =>
                      handleExpenseChange("description", e.target.value)
                    }
                    placeholder="Enter a short description"
                  />
                </label>

                <label className="journal-field">
                  <span>Payment Mode</span>
                  <select
                    value={expenseForm.paymentMode}
                    onChange={(e) =>
                      handleExpenseChange("paymentMode", e.target.value)
                    }
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="journal-field">
                  <span>Document Number</span>
                  <input
                    type="text"
                    value={expenseForm.documentNumber}
                    onChange={(e) =>
                      handleExpenseChange("documentNumber", e.target.value)
                    }
                    placeholder="e.g. EXP-001"
                  />
                </label>

                <label className="journal-field">
                  <span>Document Type</span>
                  <input
                    type="text"
                    value={expenseForm.document}
                    onChange={(e) =>
                      handleExpenseChange("document", e.target.value)
                    }
                    placeholder="e.g. Receipt, Bill"
                  />
                </label>

                <label className="journal-field journal-field--wide">
                  <span>Notes</span>
                  <textarea
                    rows="3"
                    value={expenseForm.notes}
                    onChange={(e) =>
                      handleExpenseChange("notes", e.target.value)
                    }
                    placeholder="Additional notes (optional)"
                  />
                </label>
              </div>

              <div className="journal-form__actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => !submitting && setShowExpenseForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- VIEW DETAILS MODAL ---------- */}
      {viewingRecord && (
        <div
          className="journal-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewingRecord(null)}
        >
          <div
            className="journal-modal__panel journal-modal__panel--view"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="journal-modal__header">
              <h3>Transaction Details</h3>
              <button
                type="button"
                className="journal-modal__close"
                onClick={() => setViewingRecord(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="journal-view">
              <div className="journal-view__banner">
                <span
                  className={`journal-chip ${
                    viewingRecord.type === "Income"
                      ? "journal-chip--income"
                      : "journal-chip--expense"
                  }`}
                >
                  {viewingRecord.type}
                </span>

                <strong
                  className={`journal-view__amount ${
                    viewingRecord.type === "Income"
                      ? "journal-view__amount--income"
                      : "journal-view__amount--expense"
                  }`}
                >
                  {formatAmount(viewingRecord.amount)}
                </strong>
              </div>

              <div className="journal-view__grid">
                <div className="journal-view__row">
                  <span className="journal-view__label">Record Number</span>
                  <span className="journal-view__value journal-view__value--mono">
                    {viewingRecord.record_number || "—"}
                  </span>
                </div>

                <div className="journal-view__row">
                  <span className="journal-view__label">Date</span>
                  <span className="journal-view__value">
                    {formatDate(viewingRecord.date)}
                  </span>
                </div>

                <div className="journal-view__row">
                  <span className="journal-view__label">Category</span>
                  <span className="journal-view__value">
                    {viewingRecord.category || "—"}
                  </span>
                </div>

                <div className="journal-view__row">
                  <span className="journal-view__label">Payment Mode</span>
                  <span className="journal-view__value">
                    {viewingRecord.payment_mode || "—"}
                  </span>
                </div>

                <div className="journal-view__row">
                  <span className="journal-view__label">Document Number</span>
                  <span className="journal-view__value journal-view__value--mono">
                    {viewingRecord.document_number || "—"}
                  </span>
                </div>

                <div className="journal-view__row">
                  <span className="journal-view__label">Document Type</span>
                  <span className="journal-view__value">
                    {viewingRecord.document || "—"}
                  </span>
                </div>

                <div className="journal-view__row journal-view__row--wide">
                  <span className="journal-view__label">Description</span>
                  <span className="journal-view__value">
                    {viewingRecord.description || "—"}
                  </span>
                </div>

                <div className="journal-view__row journal-view__row--wide">
                  <span className="journal-view__label">Notes</span>
                  <span
                    className="journal-view__value"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {viewingRecord.notes || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="journal-form__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}