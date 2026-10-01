import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Send,
  Boxes,
  X,
  RefreshCw,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./IssueConsumable.css";

// ---------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------

const GENERIC_ERROR = "Something went wrong. Please try again.";
const STOCK_ENDPOINT = "/erp/consumable-grn/issue-stock/";
const ISSUE_ENDPOINT = "/erp/consumable-grn/issue/";

// ---------------------------------------------------------------------
// SAFE STRING — some fields may arrive as objects (JSONField leaks).
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
// STOCK HELPERS
// ---------------------------------------------------------------------

function getStockPoNumber(item) {
  return toDisplayString(item.poNumber || item.sourcePoNumber) || "—";
}

function getStockDescription(item) {
  return (
    toDisplayString(
      item.description ||
        item.poDescription ||
        item.itemDescription,
    ) || "—"
  );
}

function getStockReference(item) {
  return toDisplayString(item.referenceNumber) || "—";
}

function getStockConsumable(item) {
  return toDisplayString(item.consumableName) || "—";
}

function getStockCategory(item) {
  return toDisplayString(item.category) || "—";
}

function getStockWarehouse(item) {
  return toDisplayString(item.warehouse) || "—";
}

function getStockUnit(item) {
  return toDisplayString(item.unit) || "—";
}

function getStockAvailable(item) {
  const n = Number(item.availableQty);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------
// FORM
// ---------------------------------------------------------------------

const initialIssueForm = {
  department: "",
  employeeName: "",
  jobCard: "",
  quantity: "",
  remarks: "",
};

// =====================================================================
// COMPONENT
// =====================================================================

export default function IssueConsumable() {
  const { accessToken } = useAuth();

  // ---------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [selectedStock, setSelectedStock] = useState(null);
  const [issueForm, setIssueForm] = useState(initialIssueForm);
  const [issueErrors, setIssueErrors] = useState({});
  const [isIssuing, setIsIssuing] = useState(false);

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
  // FETCH STOCK
  // ---------------------------------------------------------------
  const fetchStock = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setStock([]);
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

        const response = await api.get(STOCK_ENDPOINT, {
          headers: authHeaders(),
        });

        const data = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data?.results)
              ? response.data.results
              : [];

        setStock(data);
      } catch (err) {
        console.error("Failed to load issue stock:", err);
        setStock([]);
        setError(getApiError(err, "Failed to load consumable stock."));
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders],
  );

  useEffect(() => {
    fetchStock(false);
  }, [fetchStock]);

  // ---------------------------------------------------------------
  // AVAILABLE STOCK (already filtered server-side, but keep defensive)
  // ---------------------------------------------------------------
  const availableStock = useMemo(
    () => stock.filter((item) => getStockAvailable(item) > 0),
    [stock],
  );

  // ---------------------------------------------------------------
  // FILTERING
  // ---------------------------------------------------------------
  const filteredStock = availableStock.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      getStockPoNumber(item),
      getStockDescription(item),
      getStockReference(item),
      getStockConsumable(item),
      getStockCategory(item),
      getStockWarehouse(item),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });

  // ---------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------
  const totalAvailableItems = availableStock.length;

  // Group total available quantity by unit so "Nos" and "Kg" never mix.
  // Produces e.g. [{ unit: "Nos", qty: 30 }, { unit: "Kg", qty: 30 }]
  const totalsByUnit = useMemo(() => {
    const map = new Map();

    for (const item of availableStock) {
      const unit = getStockUnit(item) || "—";
      const qty = getStockAvailable(item);
      map.set(unit, (map.get(unit) || 0) + qty);
    }

    return Array.from(map.entries()).map(([unit, qty]) => ({
      unit,
      qty,
    }));
  }, [availableStock]);

  // ---------------------------------------------------------------
  // MODAL OPEN / CLOSE
  // ---------------------------------------------------------------
  function openIssueModal(stockItem) {
    setSelectedStock(stockItem);
    setIssueForm(initialIssueForm);
    setIssueErrors({});
  }

  function closeIssueModal() {
    if (isIssuing) return;
    setSelectedStock(null);
    setIssueForm(initialIssueForm);
    setIssueErrors({});
  }

  function handleIssueChange(field, value) {
    setIssueForm((prev) => ({ ...prev, [field]: value }));
  }

  // ---------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------
  function validateIssueForm() {
    const errors = {};

    if (!issueForm.department.trim()) {
      errors.department = "Department is required.";
    }

    if (!issueForm.employeeName.trim()) {
      errors.employeeName = "Employee name is required.";
    }

    const maxQty = selectedStock ? getStockAvailable(selectedStock) : 0;
    const qty = Number(issueForm.quantity);

    if (!issueForm.quantity) {
      errors.quantity = "Quantity is required.";
    } else if (!(qty > 0)) {
      errors.quantity = "Quantity must be greater than 0.";
    } else if (qty > maxQty) {
      errors.quantity = `Quantity cannot exceed available stock (${maxQty}).`;
    }

    return errors;
  }

  // ---------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------
  async function handleIssueSubmit(e) {
    e.preventDefault();
    if (!selectedStock || isIssuing) return;

    const errors = validateIssueForm();
    setIssueErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsIssuing(true);

    try {
      await api.post(
        `${ISSUE_ENDPOINT}${selectedStock.id}/`,
        {
          department: issueForm.department.trim(),
          employeeName: issueForm.employeeName.trim(),
          jobCard: issueForm.jobCard.trim(),
          quantity: Number(issueForm.quantity),
          remarks: issueForm.remarks,
        },
        { headers: authHeaders() },
      );

      closeIssueModal();

      // Refresh the stock list so the issued qty disappears
      await fetchStock(true);
    } catch (err) {
      console.error("Issue failed:", err);
      setIssueErrors({
        submit: getApiError(err, "Failed to issue consumable."),
      });
    } finally {
      setIsIssuing(false);
    }
  }

  // ===============================================================
  // RENDER
  // ===============================================================
  return (
    <>
      <Header />

      <div className="issue-consumable-page">
        <div className="issue-consumable-container">
          <Link to="/inventory/consumable" className="erp-back-button">
            <ArrowLeft size={16} />
            Back
          </Link>

          <section className="issue-consumable-hero">
            <div className="issue-consumable-hero-content">
              <span className="issue-consumable-eyebrow">
                Consumables
              </span>

              <h1 className="issue-consumable-title">
                Issue Consumables
              </h1>

              <p className="issue-consumable-description">
                Issue available consumable stock to a department, employee,
                or job card / production order.
              </p>
            </div>
          </section>

          <section className="issue-consumable-summary-grid">
            <div className="issue-consumable-summary-card">
              <div className="issue-consumable-summary-icon">
                <Boxes size={20} />
              </div>

              <div className="issue-consumable-summary-content">
                <span className="issue-consumable-summary-value">
                  {totalAvailableItems}
                </span>
                <span className="issue-consumable-summary-label">
                  Consumables Available
                </span>
              </div>
            </div>

            <div className="issue-consumable-summary-card">
              <div className="issue-consumable-summary-icon">
                <Send size={20} />
              </div>

              <div className="issue-consumable-summary-content">
                <span className="issue-consumable-summary-label">
                  Total Available Quantity
                </span>

                <div className="issue-consumable-summary-units">
                  {totalsByUnit.length === 0 && (
                    <div className="issue-consumable-summary-unit-row">
                      <span className="issue-consumable-summary-value">
                        0
                      </span>
                    </div>
                  )}

                  {totalsByUnit.map(({ unit, qty }) => (
                    <div
                      key={unit}
                      className="issue-consumable-summary-unit-row"
                    >
                      <span className="issue-consumable-summary-value">
                        {qty}
                      </span>
                      <span className="issue-consumable-summary-unit">
                        {unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="issue-consumable-toolbar">
            <div className="issue-consumable-search-box">
              <Search size={16} />

              <input
                type="text"
                placeholder="Search PO, description, consumable, reference, category, warehouse..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              type="button"
              className="issue-consumable-refresh-button"
              onClick={() => fetchStock(true)}
              disabled={isLoading || refreshing}
              title="Refresh stock"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "issue-consumable-spin" : ""}
              />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </section>

          {/* ============== ERROR ============== */}

          {error && !isLoading && (
            <section className="issue-consumable-error-box">
              <Error onRetry={() => fetchStock(false)} />
            </section>
          )}

          {/* ============== TABLE ============== */}

          {!error && (
            <section className="issue-consumable-table-card">
              <div className="issue-consumable-table-scroll">
                <table className="issue-consumable-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>PO Description</th>
                      <th>Reference Number</th>
                      <th>Consumable</th>
                      <th>Category</th>
                      <th>Warehouse</th>
                      <th>Available Quantity</th>
                      <th>Unit</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Loading */}
                    {isLoading && (
                      <tr>
                        <td
                          colSpan={9}
                          className="issue-consumable-empty-state"
                        >
                          <div className="issue-consumable-loading-wrapper">
                            <Loading />
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Rows */}
                    {!isLoading &&
                      filteredStock.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className="issue-consumable-po-number">
                              {getStockPoNumber(item)}
                            </span>
                          </td>

                          <td className="issue-consumable-po-description">
                            {getStockDescription(item)}
                          </td>

                          <td>{getStockReference(item)}</td>

                          <td>
                            <div className="issue-consumable-name-cell">
                              <span className="issue-consumable-name">
                                {getStockConsumable(item)}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="issue-consumable-category-badge">
                              {getStockCategory(item)}
                            </span>
                          </td>

                          <td>{getStockWarehouse(item)}</td>

                          <td>
                            <span className="issue-consumable-stock-value">
                              {getStockAvailable(item)}
                            </span>
                          </td>

                          <td>{getStockUnit(item)}</td>

                          <td>
                            <button
                              type="button"
                              className="issue-consumable-issue-button"
                              onClick={() => openIssueModal(item)}
                            >
                              Issue
                            </button>
                          </td>
                        </tr>
                      ))}

                    {/* Empty state */}
                    {!isLoading && filteredStock.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="issue-consumable-empty-state"
                        >
                          No available consumable stock to issue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ============== MODAL ============== */}

          {selectedStock && (
            <div
              className="issue-consumable-modal-overlay"
              onClick={closeIssueModal}
            >
              <div
                className="issue-consumable-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="issue-consumable-modal-header">
                  <div>
                    <h3 className="issue-consumable-modal-title">
                      Issue Consumable
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="issue-consumable-modal-close"
                    onClick={closeIssueModal}
                    disabled={isIssuing}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="issue-consumable-modal-body">
                  <div className="issue-consumable-info-panel">
                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        PO Number
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockPoNumber(selectedStock)}
                      </span>
                    </div>

                    <div className="issue-consumable-info-item issue-consumable-info-item-wide">
                      <span className="issue-consumable-info-label">
                        PO Description
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockDescription(selectedStock)}
                      </span>
                    </div>

                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Consumable
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockConsumable(selectedStock)}
                      </span>
                    </div>

                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Category
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockCategory(selectedStock)}
                      </span>
                    </div>

                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Warehouse
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockWarehouse(selectedStock)}
                      </span>
                    </div>

                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Available Quantity
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockAvailable(selectedStock)}{" "}
                        {getStockUnit(selectedStock)}
                      </span>
                    </div>

                    <div className="issue-consumable-info-item">
                      <span className="issue-consumable-info-label">
                        Unit
                      </span>
                      <span className="issue-consumable-info-value">
                        {getStockUnit(selectedStock)}
                      </span>
                    </div>
                  </div>

                  <form
                    className="issue-consumable-form"
                    onSubmit={handleIssueSubmit}
                  >
                    {issueErrors.submit && (
                      <div className="issue-consumable-form-error">
                        {issueErrors.submit}
                      </div>
                    )}

                    <div className="issue-consumable-form-grid">
                      <label className="issue-consumable-field">
                        <span>Department</span>
                        <input
                          type="text"
                          value={issueForm.department}
                          onChange={(e) =>
                            handleIssueChange(
                              "department",
                              e.target.value,
                            )
                          }
                          disabled={isIssuing}
                        />
                        {issueErrors.department && (
                          <span className="issue-consumable-validation-error">
                            {issueErrors.department}
                          </span>
                        )}
                      </label>

                      <label className="issue-consumable-field">
                        <span>Employee Name</span>
                        <input
                          type="text"
                          value={issueForm.employeeName}
                          onChange={(e) =>
                            handleIssueChange(
                              "employeeName",
                              e.target.value,
                            )
                          }
                          disabled={isIssuing}
                        />
                        {issueErrors.employeeName && (
                          <span className="issue-consumable-validation-error">
                            {issueErrors.employeeName}
                          </span>
                        )}
                      </label>

                      <label className="issue-consumable-field">
                        <span>Job Card / Production Order</span>
                        <input
                          type="text"
                          value={issueForm.jobCard}
                          onChange={(e) =>
                            handleIssueChange(
                              "jobCard",
                              e.target.value,
                            )
                          }
                          disabled={isIssuing}
                        />
                      </label>

                      <label className="issue-consumable-field">
                        <span>Quantity</span>
                        <input
                          type="number"
                          min="1"
                          max={getStockAvailable(selectedStock)}
                          value={issueForm.quantity}
                          onChange={(e) =>
                            handleIssueChange(
                              "quantity",
                              e.target.value,
                            )
                          }
                          disabled={isIssuing}
                        />
                        {issueErrors.quantity && (
                          <span className="issue-consumable-validation-error">
                            {issueErrors.quantity}
                          </span>
                        )}
                      </label>

                      <label className="issue-consumable-field issue-consumable-field-full">
                        <span>Remarks</span>
                        <textarea
                          value={issueForm.remarks}
                          onChange={(e) =>
                            handleIssueChange(
                              "remarks",
                              e.target.value,
                            )
                          }
                          disabled={isIssuing}
                        />
                      </label>
                    </div>

                    <div className="issue-consumable-modal-actions">
                      <button
                        type="button"
                        className="issue-consumable-cancel-button"
                        onClick={closeIssueModal}
                        disabled={isIssuing}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="issue-consumable-save-button"
                        disabled={isIssuing}
                      >
                        {isIssuing ? (
                          <>
                            <span className="issue-consumable-btn-spinner" />
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
      </div>
    </>
  );
}