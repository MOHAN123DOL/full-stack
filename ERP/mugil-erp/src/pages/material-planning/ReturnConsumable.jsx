import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Undo2,
  X,
  RefreshCw,
  Pencil,
  LockKeyhole,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./ReturnConsumable.css";

// ---------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------

const GENERIC_ERROR = "Something went wrong. Please try again.";
const ISSUES_ENDPOINT = "/erp/consumable-grn/returnable-issues/";
const RETURN_ENDPOINT = "/erp/consumable-grn/return/";
const RETURN_HISTORY_ENDPOINT = "/erp/consumable-grn/returns/";

// ---------------------------------------------------------------------
// SAFE STRING — some fields may arrive as objects.
// ---------------------------------------------------------------------
function toDisplayString(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);

  if (typeof value === "object") {
    const candidate =
      value.companyName ||
      value.company_name ||
      value.name ||
      value.label ||
      value.title ||
      value.supplier ||
      value.description;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }

    const parts = Object.values(value)
      .filter((v) => typeof v === "string" && v.trim())
      .slice(0, 2);

    return parts.join(" — ") || "—";
  }

  return String(value);
}

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;

  if (data && typeof data === "object") {
    const firstFieldError = Object.values(data)
      .flat()
      .find((value) => typeof value === "string");
    if (firstFieldError) return firstFieldError;
  }

  if (error?.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------
// FORM
// ---------------------------------------------------------------------

const initialReturnForm = {
  returnQty: "",
  remarks: "",
};

// =====================================================================
// COMPONENT
// =====================================================================

export default function ReturnConsumable() {
  const { accessToken } = useAuth();

  // ---------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------
  const [issued, setIssued] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [returnHistory, setReturnHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editForm, setEditForm] = useState({ returnQty: "", remarks: "" });
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [selectedIssue, setSelectedIssue] = useState(null);
  const [returnForm, setReturnForm] = useState(initialReturnForm);
  const [returnErrors, setReturnErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------
  // AUTH HEADERS
  // ---------------------------------------------------------------
  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  // ---------------------------------------------------------------
  // FETCH ISSUES
  // ---------------------------------------------------------------
  const fetchIssues = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setIssued([]);
        setError("Your session has expired. Please login again.");
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError("");

        const response = await api.get(ISSUES_ENDPOINT, {
          headers: authHeaders(),
        });

        const data = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data?.results)
              ? response.data.results
              : [];

        setIssued(data);
      } catch (err) {
        console.error("Failed to load issued consumables:", err);
        setIssued([]);
        setError(
          getApiError(err, "Failed to load issued consumables."),
        );
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders],
  );

  useEffect(() => {
    fetchIssues(false);
  }, [fetchIssues]);

  const fetchReturnHistory = useCallback(async () => {
    if (!accessToken) { setHistoryLoading(false); return; }
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await api.get(RETURN_HISTORY_ENDPOINT, { headers: authHeaders() });
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : [];
      setReturnHistory(rows);
    } catch (err) {
      setHistoryError(getApiError(err, "Could not load return history. Ensure GET /erp/consumable-grn/returns/ is configured."));
      setReturnHistory([]);
    } finally { setHistoryLoading(false); }
  }, [accessToken, authHeaders]);

  useEffect(() => { fetchReturnHistory(); }, [fetchReturnHistory]);

  const field = (obj, ...keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null) ?? "";
  const num = (v) => Number(v) || 0;
  const historyQty = (r) => num(field(r, "returnQty", "returnedQty", "quantity_returned", "quantity"));
  const canEditReturn = (r) => {
    const explicit = field(r, "can_edit", "canEdit");
    if (explicit !== "") return explicit === true || explicit === "true";
    // Without server-provided permission, do not assume that reissued returns are editable.
    return false;
  };
  const filteredHistory = returnHistory.filter(r => [
    field(r, "returnNumber", "return_number"),
    field(r, "issueNumber", "issue_number"),
    field(r, "consumableName", "consumable_name"),
    field(r, "returnedBy", "returned_by"),
  ].map(toDisplayString).join(" ").toLowerCase().includes(historySearch.trim().toLowerCase()));

  function openEditReturn(row) {
    if (!canEditReturn(row)) return;
    setEditingReturn(row);
    setEditForm({ returnQty: String(historyQty(row)), remarks: toDisplayString(field(row, "remarks")) });
    setEditError("");
  }
  function closeEditReturn() {
    if (savingEdit) return;
    setEditingReturn(null);
    setEditError("");
  }
  async function submitEditReturn(event) {
    event.preventDefault();
    if (!editingReturn || savingEdit) return;
    const quantity = Number(editForm.returnQty);
    if (!Number.isFinite(quantity) || quantity <= 0) { setEditError("Enter a positive return quantity."); return; }
    const id = field(editingReturn, "id");
    if (!id) { setEditError("Missing return record ID."); return; }
    setSavingEdit(true);
    setEditError("");
    try {
      await api.patch(`/erp/consumable-grn/returns/${id}/`, {
        returnQty: quantity,
        remarks: editForm.remarks,
      }, { headers: authHeaders() });
      setEditingReturn(null);
      await Promise.all([fetchIssues(true), fetchReturnHistory()]);
    } catch (err) {
      setEditError(getApiError(err, "Failed to edit return. The quantity may have already been reissued."));
    } finally { setSavingEdit(false); }
  }


  // ---------------------------------------------------------------
  // FILTERING
  // ---------------------------------------------------------------
  const filteredIssued = issued.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      item.issueNumber,
      item.consumableName,
      item.department,
      item.employeeName,
      item.jobCard,
    ]
      .map(toDisplayString)
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });

  // ---------------------------------------------------------------
  // STATS
  // ---------------------------------------------------------------
  const stats = {
    issued: issued.filter((item) => item.status === "Issued").length,
    partial: issued.filter(
      (item) => item.status === "Partially Returned",
    ).length,
    fully: issued.filter(
      (item) => item.status === "Fully Returned",
    ).length,
  };

  // ---------------------------------------------------------------
  // MODAL
  // ---------------------------------------------------------------
  function openReturnModal(issueItem) {
    setSelectedIssue(issueItem);
    setReturnForm(initialReturnForm);
    setReturnErrors({});
  }

  function closeReturnModal() {
    if (isSubmitting) return;
    setSelectedIssue(null);
    setReturnForm(initialReturnForm);
    setReturnErrors({});
  }

  // ---------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------
  function validateReturnForm() {
    const errors = {};
    const qty = Number(returnForm.returnQty);
    const maxQty = selectedIssue
      ? Number(selectedIssue.balanceQty) || 0
      : 0;

    if (!returnForm.returnQty) {
      errors.returnQty = "Return quantity is required.";
    } else if (!(qty > 0)) {
      errors.returnQty = "Quantity must be greater than 0.";
    } else if (qty > maxQty) {
      errors.returnQty = `Quantity cannot exceed balance (${maxQty}).`;
    }

    return errors;
  }

  // ---------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------
  async function handleReturnSubmit(e) {
    e.preventDefault();
    if (!selectedIssue || isSubmitting) return;

    const errors = validateReturnForm();
    setReturnErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      await api.post(
        `${RETURN_ENDPOINT}${selectedIssue.id}/`,
        {
          returnQty: Number(returnForm.returnQty),
          remarks: returnForm.remarks,
          returnedBy: toDisplayString(selectedIssue.employeeName),
        },
        { headers: authHeaders() },
      );

      closeReturnModal();

      // Refresh so statuses and balances update
      await Promise.all([fetchIssues(true), fetchReturnHistory()]);
    } catch (err) {
      console.error("Return failed:", err);
      setReturnErrors({
        submit: getApiError(err, "Failed to return consumable."),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ===============================================================
  // RENDER
  // ===============================================================
  return (
    <>
      <Header />

      <div className="rcn-page">
        <div className="rcn-header-section">
          <Link to="/inventory/consumable" className="erp-back-button">
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="rcn-header-card">
            <div className="rcn-header-content">
              <span className="rcn-header-tag">Consumables</span>

              <h1 className="rcn-page-title">
                Return Consumables
              </h1>

              <p className="rcn-page-description">
                Record consumables returned against an issue. Stock is
                restored automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="rcn-summary-grid">
          <div className="rcn-summary-card">
            <div className="rcn-summary-icon">
              <Undo2 size={20} />
            </div>

            <div className="rcn-summary-details">
              <span className="rcn-summary-value">
                {stats.issued}
              </span>
              <span className="rcn-summary-label">
                Issued
              </span>
            </div>
          </div>

          <div className="rcn-summary-card">
            <div className="rcn-summary-icon">
              <Undo2 size={20} />
            </div>

            <div className="rcn-summary-details">
              <span className="rcn-summary-value">
                {stats.partial}
              </span>
              <span className="rcn-summary-label">
                Partially Returned
              </span>
            </div>
          </div>

          <div className="rcn-summary-card">
            <div className="rcn-summary-icon">
              <Undo2 size={20} />
            </div>

            <div className="rcn-summary-details">
              <span className="rcn-summary-value">
                {stats.fully}
              </span>
              <span className="rcn-summary-label">
                Fully Returned
              </span>
            </div>
          </div>
        </div>

        <div className="rcn-toolbar-card">
          <div className="rcn-search-box">
            <Search size={16} />

            <input
              type="text"
              placeholder="Search issue number, consumable, department, employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            type="button"
            className="rcn-refresh-button"
            onClick={() => fetchIssues(true)}
            disabled={isLoading || refreshing}
            title="Refresh issues"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "rcn-spin" : ""}
            />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {/* ============== ERROR ============== */}

        {error && !isLoading && (
          <div className="rcn-error-box">
            <Error onRetry={() => fetchIssues(false)} />
          </div>
        )}

        {/* ============== TABLE ============== */}

        {!error && (
          <div className="rcn-table-card">
            <div className="rcn-table-header">
              <div>
                <h2 className="rcn-table-title">
                  Issued Consumables
                </h2>

                <p className="rcn-table-subtitle">
                  Record consumables returned against an issue.
                </p>
              </div>
            </div>

            <div className="rcn-table-wrapper">
              <table className="rcn-table">
                <thead>
                  <tr>
                    <th>Issue Number</th>
                    <th>Consumable</th>
                    <th>Department</th>
                    <th>Employee</th>
                    <th>Job Card</th>
                    <th>Issued Qty</th>
                    <th>Returned Qty</th>
                    <th>Balance Qty</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Loading */}
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={10}
                        className="rcn-empty-row"
                      >
                        <div className="rcn-loading-wrapper">
                          <Loading />
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Rows */}
                  {!isLoading &&
                    filteredIssued.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="rcn-issue-number">
                            {toDisplayString(item.issueNumber) || "—"}
                          </span>
                        </td>

                        <td>
                          <div className="rcn-consumable-cell">
                            <span className="rcn-consumable-name">
                              {toDisplayString(item.consumableName) || "—"}
                            </span>
                          </div>
                        </td>

                        <td>{toDisplayString(item.department) || "—"}</td>

                        <td>{toDisplayString(item.employeeName) || "—"}</td>

                        <td>{toDisplayString(item.jobCard) || "-"}</td>

                        <td>
                          <span className="rcn-qty">
                            {item.issuedQty}
                          </span>
                        </td>

                        <td>
                          <span className="rcn-qty">
                            {item.returnedQty}
                          </span>
                        </td>

                        <td>
                          <span className="rcn-balance">
                            {item.balanceQty}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`rcn-status-badge rcn-status-${String(
                              item.status,
                            )
                              .replace(/\s+/g, "-")
                              .toLowerCase()}`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="rcn-return-btn"
                            disabled={Number(item.balanceQty) <= 0}
                            onClick={() => openReturnModal(item)}
                          >
                            Return
                          </button>
                        </td>
                      </tr>
                    ))}

                  {/* Empty */}
                  {!isLoading && filteredIssued.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="rcn-empty-row"
                      >
                        No issued consumables found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== RETURN HISTORY / EDIT ============== */}
        <section className="rcn-table-card rcn-history-section">
          <div className="rcn-table-header rcn-history-heading">
            <div>
              <h2 className="rcn-table-title">Return History</h2>
              <p className="rcn-table-subtitle">Edit individual return transactions until their quantities have been reissued.</p>
            </div>
            <button type="button" className="rcn-refresh-button" onClick={() => { fetchReturnHistory(); fetchIssues(true); }} disabled={historyLoading}>
              <RefreshCw size={16} className={historyLoading ? "rcn-spin" : ""} /> Refresh
            </button>
          </div>
          <div className="rcn-history-search">
            <div className="rcn-search-box"><Search size={16} />
              <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search return number, issue, consumable, employee..." />
            </div>
          </div>
          {historyError && <div className="rcn-history-error">{historyError}</div>}
          <div className="rcn-table-wrapper">
            <table className="rcn-table">
              <thead><tr>
                <th>Return Number</th><th>Issue Number</th><th>Consumable</th><th>Warehouse</th>
                <th>Returned Qty</th><th>Returned By</th><th>Remarks</th><th>Action</th>
              </tr></thead>
              <tbody>
                {historyLoading ? <tr><td colSpan={8} className="rcn-empty-row"><Loading /></td></tr> :
                  filteredHistory.length === 0 ? <tr><td colSpan={8} className="rcn-empty-row">No return history found.</td></tr> :
                  filteredHistory.map((row, index) => (
                    <tr key={field(row, "id") || index}>
                      <td className="rcn-issue-number">{toDisplayString(field(row, "returnNumber", "return_number")) || `#${field(row, "id")}`}</td>
                      <td>{toDisplayString(field(row, "issueNumber", "issue_number")) || "—"}</td>
                      <td>{toDisplayString(field(row, "consumableName", "consumable_name")) || "—"}</td>
                      <td>{toDisplayString(field(row, "warehouse")) || "—"}</td>
                      <td><span className="rcn-qty">{historyQty(row)} {toDisplayString(field(row, "unit"))}</span></td>
                      <td>{toDisplayString(field(row, "returnedBy", "returned_by")) || "—"}</td>
                      <td>{toDisplayString(field(row, "remarks")) || "—"}</td>
                      <td>{canEditReturn(row) ?
                        <button type="button" className="rcn-edit-btn" onClick={() => openEditReturn(row)}><Pencil size={15} /> Edit</button> :
                        <span className="rcn-edit-locked" title="Editing disabled by backend"><LockKeyhole size={14} /> Edit Locked</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {editingReturn && (
          <div className="rcn-modal-overlay" onClick={closeEditReturn}>
            <div className="rcn-modal" onClick={e => e.stopPropagation()}>
              <div className="rcn-modal-header">
                <h3 className="rcn-modal-title">Edit Return {toDisplayString(field(editingReturn, "returnNumber", "return_number"))}</h3>
                <button type="button" className="rcn-modal-close" onClick={closeEditReturn} disabled={savingEdit}><X size={18} /></button>
              </div>
              <form className="rcn-modal-body" onSubmit={submitEditReturn}>
                {editError && <div className="rcn-form-error">{editError}</div>}
                <div className="rcn-form-grid">
                  <label className="rcn-field"><span className="rcn-field-label">Return Quantity</span>
                    <input type="number" min="0.001" step="0.001" required value={editForm.returnQty} disabled={savingEdit}
                      onChange={e => setEditForm(prev => ({ ...prev, returnQty: e.target.value }))} />
                  </label>
                  <label className="rcn-field rcn-field-full"><span className="rcn-field-label">Remarks</span>
                    <textarea value={editForm.remarks} disabled={savingEdit}
                      onChange={e => setEditForm(prev => ({ ...prev, remarks: e.target.value }))} />
                  </label>
                </div>
                <p className="rcn-edit-note">The server validates the issue balance and prevents reducing a return below any quantity already reissued.</p>
                <div className="rcn-modal-actions">
                  <button type="button" className="rcn-cancel-btn" onClick={closeEditReturn} disabled={savingEdit}>Cancel</button>
                  <button type="submit" className="rcn-save-btn" disabled={savingEdit}>{savingEdit ? "Saving..." : "Save Changes"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============== MODAL ============== */}

        {selectedIssue && (
          <div
            className="rcn-modal-overlay"
            onClick={closeReturnModal}
          >
            <div
              className="rcn-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rcn-modal-header">
                <div>
                  <h3 className="rcn-modal-title">
                    Return Consumable
                  </h3>
                </div>

                <button
                  type="button"
                  className="rcn-modal-close"
                  onClick={closeReturnModal}
                  disabled={isSubmitting}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="rcn-modal-body">
                <div className="rcn-info-grid">
                  <div className="rcn-info-card">
                    <span className="rcn-info-label">
                      Consumable
                    </span>
                    <span className="rcn-info-value">
                      {toDisplayString(selectedIssue.consumableName) || "—"}
                    </span>
                  </div>

                  <div className="rcn-info-card">
                    <span className="rcn-info-label">
                      Issued Quantity
                    </span>
                    <span className="rcn-info-value">
                      {selectedIssue.issuedQty}{" "}
                      {toDisplayString(selectedIssue.unit) || ""}
                    </span>
                  </div>

                  <div className="rcn-info-card">
                    <span className="rcn-info-label">
                      Already Returned
                    </span>
                    <span className="rcn-info-value">
                      {selectedIssue.returnedQty}{" "}
                      {toDisplayString(selectedIssue.unit) || ""}
                    </span>
                  </div>

                  <div className="rcn-info-card">
                    <span className="rcn-info-label">
                      Balance
                    </span>
                    <span className="rcn-info-value">
                      {selectedIssue.balanceQty}{" "}
                      {toDisplayString(selectedIssue.unit) || ""}
                    </span>
                  </div>
                </div>

                <form
                  className="rcn-form"
                  onSubmit={handleReturnSubmit}
                >
                  {returnErrors.submit && (
                    <div className="rcn-form-error">
                      {returnErrors.submit}
                    </div>
                  )}

                  <div className="rcn-form-grid">
                    <label className="rcn-field">
                      <span className="rcn-field-label">
                        Return Quantity
                      </span>

                      <input
                        type="number"
                        min="1"
                        max={selectedIssue.balanceQty}
                        value={returnForm.returnQty}
                        onChange={(e) =>
                          setReturnForm((prev) => ({
                            ...prev,
                            returnQty: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                      />

                      {returnErrors.returnQty && (
                        <span className="rcn-validation-error">
                          {returnErrors.returnQty}
                        </span>
                      )}
                    </label>

                    <label className="rcn-field rcn-field-full">
                      <span className="rcn-field-label">
                        Remarks
                      </span>

                      <textarea
                        value={returnForm.remarks}
                        onChange={(e) =>
                          setReturnForm((prev) => ({
                            ...prev,
                            remarks: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>

                  <div className="rcn-modal-actions">
                    <button
                      type="button"
                      className="rcn-cancel-btn"
                      onClick={closeReturnModal}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="rcn-save-btn"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="rcn-btn-spinner" />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}