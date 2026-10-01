import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "./ConsumableGRN.css";
import {
  ArrowLeft,
  PackagePlus,
  Search,
  ClipboardList,
  Clock,
  CheckCircle2,
  X,
  RefreshCw,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------

const WAREHOUSES = ["Unit One", "Unit Two"];

const GENERIC_ERROR = "Something went wrong. Please try again.";

const API_BASE = "/erp/consumable-grn";

// ---------------------------------------------------------------------
// API ERROR HELPER
// ---------------------------------------------------------------------

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (data && typeof data === "object") {
    const firstFieldError = Object.values(data)
      .flat()
      .find((value) => typeof value === "string");

    if (firstFieldError) {
      return firstFieldError;
    }
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
}

// ---------------------------------------------------------------------
// SAFE STRING
// ----------------------------------------------------------------
// PurchaseOrder.vendor is a JSONField, so the backend may send back an
// object (e.g. { companyName, address1, gst, ... }) where the frontend
// expects a string. Rendering an object as a React child crashes with:
//   "Objects are not valid as a React child"
// This helper converts ANY value into a safe display string.
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

// ---------------------------------------------------------------------
// LINE HELPERS
// ---------------------------------------------------------------------

function getLineDescription(line) {
  return (
    toDisplayString(
      line.description ||
        line.poDescription ||
        line.itemDescription ||
        line.consumableName,
    ) || "—"
  );
}

function getLineQuantities(line) {
  const ordered = Number(line.orderedQty) || 0;
  const received = Number(line.receivedQty) || 0;
  const pending = Math.max(ordered - received, 0);
  return { ordered, received, pending };
}

function getLineStatus(line) {
  const { ordered, received } = getLineQuantities(line);

  if (line.status) {
    return line.status;
  }

  if (received <= 0) return "Pending";
  if (received >= ordered) return "Fully Received";
  return "Partially Received";
}

// ---------------------------------------------------------------------
// INITIAL FORM STATES
// ---------------------------------------------------------------------

const initialReceiveForm = {
  quantityReceived: "",
  warehouse: "",
  receivedBy: "",
  remarks: "",
};

const initialDirectForm = {
  supplier: "",
  consumableName: "",
  category: "",
  unit: "",
  quantity: "",
  warehouse: "",
  receivedBy: "",
  remarks: "",
};

// =====================================================================
// COMPONENT
// =====================================================================

export default function ConsumableGRN() {
  const { accessToken } = useAuth();

  // ---------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  // Receive modal
  const [selectedLine, setSelectedLine] = useState(null);
  const [receiveForm, setReceiveForm] = useState(initialReceiveForm);
  const [receiveErrors, setReceiveErrors] = useState({});
  const [isReceiving, setIsReceiving] = useState(false);

  // Direct GRN modal
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directForm, setDirectForm] = useState(initialDirectForm);
  const [directErrors, setDirectErrors] = useState({});
  const [isCreatingDirect, setIsCreatingDirect] = useState(false);

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
  // FETCH PO ITEMS
  // ---------------------------------------------------------------
  const fetchPOItems = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setPurchaseOrders([]);
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

        const response = await api.get(`${API_BASE}/po-items/`, {
          headers: authHeaders(),
        });

        const data = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data?.results)
              ? response.data.results
              : [];

        setPurchaseOrders(data);
      } catch (err) {
        console.error("Failed to load PO items:", err);
        setPurchaseOrders([]);
        setError(getApiError(err, "Failed to load purchase order items."));
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders],
  );

  // ---------------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------------
  useEffect(() => {
    fetchPOItems(false);
  }, [fetchPOItems]);

  // ---------------------------------------------------------------
  // FILTERING (safe for object fields)
  // ---------------------------------------------------------------
  const filteredPOs = purchaseOrders.filter((po) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      po.poNumber,
      po.itemCode,
      po.supplier,
      po.consumableName,
      po.category,
      getLineDescription(po),
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
    totalPOs: new Set(purchaseOrders.map((po) => po.poNumber)).size,
    pending: purchaseOrders.filter((po) => getLineStatus(po) === "Pending")
      .length,
    partial: purchaseOrders.filter(
      (po) => getLineStatus(po) === "Partially Received",
    ).length,
    completed: purchaseOrders.filter(
      (po) => getLineStatus(po) === "Fully Received",
    ).length,
  };

  // ---------------------------------------------------------------
  // SORTING / GROUPING
  // ---------------------------------------------------------------
  const poFirstIndex = new Map();
  filteredPOs.forEach((po, i) => {
    if (!poFirstIndex.has(po.poNumber)) poFirstIndex.set(po.poNumber, i);
  });

  const sortedLines = [...filteredPOs].sort(
    (a, b) => poFirstIndex.get(a.poNumber) - poFirstIndex.get(b.poNumber),
  );

  const linesPerPO = filteredPOs.reduce((acc, po) => {
    acc[po.poNumber] = (acc[po.poNumber] || 0) + 1;
    return acc;
  }, {});

  // ---------------------------------------------------------------
  // SELECTED LINE QUANTITIES
  // ---------------------------------------------------------------
  const selectedQty = selectedLine
    ? getLineQuantities(selectedLine)
    : { ordered: 0, received: 0, pending: 0 };

  // ===============================================================
  // RECEIVE MODAL
  // ===============================================================

  function openReceiveModal(po) {
    setSelectedLine(po);
    setReceiveForm(initialReceiveForm);
    setReceiveErrors({});
  }

  function closeReceiveModal() {
    if (isReceiving) return;
    setSelectedLine(null);
    setReceiveForm(initialReceiveForm);
    setReceiveErrors({});
  }

  // ---------------------------------------------------------------
  // RECEIVE VALIDATION
  // ---------------------------------------------------------------
  function validateReceiveForm() {
    const errors = {};
    const qty = Number(receiveForm.quantityReceived);

    if (!receiveForm.quantityReceived) {
      errors.quantityReceived = "Quantity is required.";
    } else if (!(qty > 0)) {
      errors.quantityReceived = "Quantity must be greater than 0.";
    } else if (qty > selectedQty.pending) {
      errors.quantityReceived = `Quantity cannot exceed pending quantity (${selectedQty.pending}).`;
    }

    if (!receiveForm.warehouse) {
      errors.warehouse = "Warehouse is required.";
    }

    if (!receiveForm.receivedBy.trim()) {
      errors.receivedBy = "Received By is required.";
    }

    return errors;
  }

  // ---------------------------------------------------------------
  // RECEIVE SUBMIT
  // ---------------------------------------------------------------
  async function handleReceiveSubmit(e) {
    e.preventDefault();
    if (!selectedLine || isReceiving) return;

    const errors = validateReceiveForm();
    setReceiveErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsReceiving(true);

    try {
      await api.post(
        `${API_BASE}/receive/${selectedLine.id}/`,
        {
          quantityReceived: Number(receiveForm.quantityReceived),
          warehouse: receiveForm.warehouse,
          receivedBy: receiveForm.receivedBy.trim(),
          remarks: receiveForm.remarks,
        },
        { headers: authHeaders() },
      );

      closeReceiveModal();

      await fetchPOItems(true);
    } catch (err) {
      console.error("Receive failed:", err);
      setReceiveErrors({
        submit: getApiError(err, "Failed to receive consumable."),
      });
    } finally {
      setIsReceiving(false);
    }
  }

  // ===============================================================
  // DIRECT GRN MODAL
  // ===============================================================

  function openDirectModal() {
    setDirectForm(initialDirectForm);
    setDirectErrors({});
    setShowDirectModal(true);
  }

  function closeDirectModal() {
    if (isCreatingDirect) return;
    setShowDirectModal(false);
    setDirectForm(initialDirectForm);
    setDirectErrors({});
  }

  function handleDirectChange(field, value) {
    setDirectForm((prev) => ({ ...prev, [field]: value }));
  }

  // ---------------------------------------------------------------
  // DIRECT GRN VALIDATION
  // ---------------------------------------------------------------
  function validateDirectForm() {
    const errors = {};

    if (!directForm.supplier.trim()) {
      errors.supplier = "Supplier is required.";
    }
    if (!directForm.consumableName.trim()) {
      errors.consumableName = "Consumable Name is required.";
    }
    if (!directForm.category.trim()) {
      errors.category = "Category is required.";
    }
    if (!directForm.unit.trim()) {
      errors.unit = "Unit is required.";
    }
    if (!directForm.quantity) {
      errors.quantity = "Quantity is required.";
    } else if (!(Number(directForm.quantity) > 0)) {
      errors.quantity = "Quantity must be greater than 0.";
    }
    if (!directForm.warehouse) {
      errors.warehouse = "Warehouse is required.";
    }
    if (!directForm.receivedBy.trim()) {
      errors.receivedBy = "Received By is required.";
    }

    return errors;
  }

  // ---------------------------------------------------------------
  // DIRECT GRN SUBMIT
  // ---------------------------------------------------------------
  async function handleDirectSubmit(e) {
    e.preventDefault();
    if (isCreatingDirect) return;

    const errors = validateDirectForm();
    setDirectErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsCreatingDirect(true);

    try {
      await api.post(
        `${API_BASE}/direct/`,
        {
          supplier: directForm.supplier.trim(),
          consumableName: directForm.consumableName.trim(),
          category: directForm.category.trim(),
          unit: directForm.unit.trim(),
          quantity: Number(directForm.quantity),
          warehouse: directForm.warehouse,
          receivedBy: directForm.receivedBy.trim(),
          remarks: directForm.remarks,
        },
        { headers: authHeaders() },
      );

      closeDirectModal();

      await fetchPOItems(true);
    } catch (err) {
      console.error("Direct GRN failed:", err);
      setDirectErrors({
        submit: getApiError(err, "Failed to create direct GRN."),
      });
    } finally {
      setIsCreatingDirect(false);
    }
  }

  // ===============================================================
  // RENDER
  // ===============================================================

  return (
    <>
      <Header />
      <div className="consumable-grn-page">
        <Link to="/inventory/consumable" className="erp-back-button">
          <ArrowLeft size={16} />
          Back
        </Link>

        <header className="consumable-grn-header">
          <div className="consumable-grn-header-content">
            <div className="consumable-grn-title-section">
              <h1 className="consumable-grn-title">Consumable GRN</h1>
              <p className="consumable-grn-subtitle">
                Receive consumables against Purchase Orders or create Direct
                GRNs for local purchases.
              </p>
            </div>
          </div>
        </header>

        {/* ================= KPI ================= */}

        <div className="consumable-grn-summary-grid">
          <div className="consumable-grn-summary-card consumable-grn-total-card">
            <div className="consumable-grn-summary-icon">
              <ClipboardList size={22} />
            </div>
            <div className="consumable-grn-summary-content">
              <span className="consumable-grn-summary-label">
                Total Purchase Orders
              </span>
              <span className="consumable-grn-summary-value">
                {stats.totalPOs}
              </span>
            </div>
          </div>

          <div className="consumable-grn-summary-card consumable-grn-pending-card">
            <div className="consumable-grn-summary-icon">
              <Clock size={22} />
            </div>
            <div className="consumable-grn-summary-content">
              <span className="consumable-grn-summary-label">Pending</span>
              <span className="consumable-grn-summary-value">
                {stats.pending}
              </span>
            </div>
          </div>

          <div className="consumable-grn-summary-card consumable-grn-partial-card">
            <div className="consumable-grn-summary-icon">
              <Clock size={22} />
            </div>
            <div className="consumable-grn-summary-content">
              <span className="consumable-grn-summary-label">
                Partially Received
              </span>
              <span className="consumable-grn-summary-value">
                {stats.partial}
              </span>
            </div>
          </div>

          <div className="consumable-grn-summary-card consumable-grn-completed-card">
            <div className="consumable-grn-summary-icon">
              <CheckCircle2 size={22} />
            </div>
            <div className="consumable-grn-summary-content">
              <span className="consumable-grn-summary-label">Completed</span>
              <span className="consumable-grn-summary-value">
                {stats.completed}
              </span>
            </div>
          </div>
        </div>

        {/* ================= TOOLBAR ================= */}

        <div className="consumable-grn-toolbar">
          <div className="consumable-grn-search">
            <Search size={17} />
            <input
              type="text"
              className="consumable-grn-search-input"
              placeholder="Search by PO Number, Item Code, Description, Supplier, Consumable or Category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="consumable-grn-toolbar-actions">
            <button
              className="consumable-grn-refresh-btn"
              onClick={() => fetchPOItems(true)}
              disabled={isLoading || refreshing}
              title="Refresh PO items"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "consumable-grn-spin" : ""}
              />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <button
              className="consumable-grn-add-btn"
              onClick={openDirectModal}
              disabled={isLoading}
            >
              <PackagePlus size={17} />
              <span>New Direct GRN</span>
            </button>
          </div>
        </div>

        {/* ================= ERROR STATE ================= */}

        {error && !isLoading && (
          <div className="consumable-grn-error-box">
            <Error onRetry={() => fetchPOItems(false)} />
          </div>
        )}

        {/* ================= PURCHASE ORDER TABLE ================= */}

        {!error && (
          <div className="consumable-grn-table-card">
            <div className="consumable-grn-table-header">
              <div>
                <h3 className="consumable-grn-table-title">
                  Purchase Orders
                </h3>
                <p className="consumable-grn-table-subtitle">
                  Receive consumables against approved purchase orders.
                </p>
              </div>
            </div>

            <div className="consumable-grn-table-wrapper">
              <table className="consumable-grn-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Item Code</th>
                    <th>PO Description</th>
                    <th>Supplier</th>
                    <th>Consumable</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Pending Qty</th>
                    <th>Warehouse</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Loading state */}
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={13}
                        className="consumable-grn-empty-row"
                      >
                        <div className="consumable-grn-loading-wrapper">
                          <Loading />
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data rows */}
                  {!isLoading &&
                    sortedLines.map((po, index) => {
                      const { ordered, received, pending } =
                        getLineQuantities(po);
                      const status = getLineStatus(po);
                      const isGroupStart =
                        index === 0 ||
                        sortedLines[index - 1].poNumber !== po.poNumber;

                      return (
                        <tr
                          key={po.id}
                          className={
                            isGroupStart
                              ? "consumable-grn-row-group-start"
                              : ""
                          }
                        >
                          <td>
                            <div className="consumable-grn-po-cell">
                              <span className="consumable-grn-po-number">
                                {toDisplayString(po.poNumber) || "—"}
                              </span>
                              {isGroupStart &&
                                linesPerPO[po.poNumber] > 1 && (
                                  <span className="consumable-grn-po-count">
                                    {linesPerPO[po.poNumber]} items
                                  </span>
                                )}
                            </div>
                          </td>

                          <td className="consumable-grn-item-code-cell">
                            {toDisplayString(po.itemCode) || "—"}
                          </td>

                          <td className="consumable-grn-description-cell">
                            {getLineDescription(po)}
                          </td>

                          <td>{toDisplayString(po.supplier) || "—"}</td>

                          <td>
                            {toDisplayString(po.consumableName) || "—"}
                          </td>

                          <td>{toDisplayString(po.category) || "—"}</td>

                          <td>{toDisplayString(po.unit) || "—"}</td>

                          <td>{ordered}</td>

                          <td>{received}</td>

                          <td>{pending}</td>

                          <td>{toDisplayString(po.warehouse) || "—"}</td>

                          <td>
                            <span
                              className={`consumable-grn-status consumable-grn-status-${status
                                .replace(/\s+/g, "-")
                                .toLowerCase()}`}
                            >
                              {status}
                            </span>
                          </td>

                          <td>
                            <button
                              className="consumable-grn-receive-btn"
                              disabled={pending <= 0}
                              onClick={() => openReceiveModal(po)}
                            >
                              Receive
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Empty state */}
                  {!isLoading && sortedLines.length === 0 && (
                    <tr>
                      <td colSpan={13} className="consumable-grn-empty-row">
                        No purchase order lines found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= RECEIVE MODAL ================= */}

        {selectedLine && (
          <div
            className="consumable-grn-modal-overlay"
            onClick={closeReceiveModal}
          >
            <div
              className="consumable-grn-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="consumable-grn-modal-header">
                <div>
                  <h2 className="consumable-grn-modal-title">
                    Receive Consumable
                  </h2>
                  <p className="consumable-grn-modal-subtitle">
                    Receive stock for this PO description only. Other
                    descriptions on the same PO are not affected.
                  </p>
                </div>

                <button
                  className="consumable-grn-modal-close"
                  onClick={closeReceiveModal}
                  disabled={isReceiving}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="consumable-grn-modal-body">
                <div className="consumable-grn-info-grid">
                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">
                      PO Number
                    </span>
                    <span className="consumable-grn-info-value">
                      {toDisplayString(selectedLine.poNumber) || "—"}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">
                      Item Code
                    </span>
                    <span className="consumable-grn-info-value">
                      {toDisplayString(selectedLine.itemCode) || "—"}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card consumable-grn-info-card-wide">
                    <span className="consumable-grn-info-label">
                      PO Description
                    </span>
                    <span className="consumable-grn-info-value">
                      {getLineDescription(selectedLine)}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">
                      Consumable
                    </span>
                    <span className="consumable-grn-info-value">
                      {toDisplayString(selectedLine.consumableName) || "—"}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">Category</span>
                    <span className="consumable-grn-info-value">
                      {toDisplayString(selectedLine.category) || "—"}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">Unit</span>
                    <span className="consumable-grn-info-value">
                      {toDisplayString(selectedLine.unit) || "—"}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">
                      Ordered Quantity
                    </span>
                    <span className="consumable-grn-info-value">
                      {selectedQty.ordered}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card">
                    <span className="consumable-grn-info-label">
                      Already Received Quantity
                    </span>
                    <span className="consumable-grn-info-value">
                      {selectedQty.received}
                    </span>
                  </div>

                  <div className="consumable-grn-info-card consumable-grn-info-card-highlight">
                    <span className="consumable-grn-info-label">
                      Pending Quantity
                    </span>
                    <span className="consumable-grn-info-value">
                      {selectedQty.pending}
                    </span>
                  </div>
                </div>

                <form
                  className="consumable-grn-form"
                  onSubmit={handleReceiveSubmit}
                >
                  {receiveErrors.submit && (
                    <div className="consumable-grn-form-error">
                      {receiveErrors.submit}
                    </div>
                  )}

                  <div className="consumable-grn-form-group">
                    <label>Quantity Received</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedQty.pending}
                      value={receiveForm.quantityReceived}
                      onChange={(e) =>
                        setReceiveForm((prev) => ({
                          ...prev,
                          quantityReceived: e.target.value,
                        }))
                      }
                      disabled={isReceiving}
                    />
                    {receiveErrors.quantityReceived && (
                      <span className="consumable-grn-validation-error">
                        {receiveErrors.quantityReceived}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Warehouse</label>
                    <select
                      value={receiveForm.warehouse}
                      onChange={(e) =>
                        setReceiveForm((prev) => ({
                          ...prev,
                          warehouse: e.target.value,
                        }))
                      }
                      disabled={isReceiving}
                    >
                      <option value="">Select warehouse</option>
                      {WAREHOUSES.map((wh) => (
                        <option key={wh} value={wh}>
                          {wh}
                        </option>
                      ))}
                    </select>
                    {receiveErrors.warehouse && (
                      <span className="consumable-grn-validation-error">
                        {receiveErrors.warehouse}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Received By</label>
                    <input
                      type="text"
                      value={receiveForm.receivedBy}
                      onChange={(e) =>
                        setReceiveForm((prev) => ({
                          ...prev,
                          receivedBy: e.target.value,
                        }))
                      }
                      disabled={isReceiving}
                    />
                    {receiveErrors.receivedBy && (
                      <span className="consumable-grn-validation-error">
                        {receiveErrors.receivedBy}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Remarks</label>
                    <textarea
                      value={receiveForm.remarks}
                      onChange={(e) =>
                        setReceiveForm((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                      disabled={isReceiving}
                    />
                  </div>

                  <div className="consumable-grn-form-actions">
                    <button
                      type="button"
                      className="consumable-grn-cancel-btn"
                      onClick={closeReceiveModal}
                      disabled={isReceiving}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="consumable-grn-save-btn"
                      disabled={isReceiving}
                    >
                      {isReceiving ? (
                        <>
                          <span className="consumable-grn-btn-spinner" />
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

        {/* ================= DIRECT GRN MODAL ================= */}

        {showDirectModal && (
          <div
            className="consumable-grn-modal-overlay"
            onClick={closeDirectModal}
          >
            <div
              className="consumable-grn-modal consumable-grn-modal-large"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="consumable-grn-modal-header">
                <div>
                  <h2 className="consumable-grn-modal-title">
                    New Direct GRN
                  </h2>
                  <p className="consumable-grn-modal-subtitle">
                    Record consumables received directly from a supplier
                    without a Purchase Order.
                  </p>
                </div>

                <button
                  className="consumable-grn-modal-close"
                  onClick={closeDirectModal}
                  disabled={isCreatingDirect}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="consumable-grn-modal-body">
                <form
                  className="consumable-grn-form consumable-grn-form-grid"
                  onSubmit={handleDirectSubmit}
                >
                  {directErrors.submit && (
                    <div className="consumable-grn-form-error consumable-grn-form-group-full">
                      {directErrors.submit}
                    </div>
                  )}

                  <div className="consumable-grn-form-group">
                    <label>Supplier</label>
                    <input
                      type="text"
                      value={directForm.supplier}
                      onChange={(e) =>
                        handleDirectChange("supplier", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                    {directErrors.supplier && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.supplier}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Consumable Name</label>
                    <input
                      type="text"
                      value={directForm.consumableName}
                      onChange={(e) =>
                        handleDirectChange("consumableName", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                    {directErrors.consumableName && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.consumableName}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={directForm.category}
                      onChange={(e) =>
                        handleDirectChange("category", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                    {directErrors.category && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.category}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Unit</label>
                    <input
                      type="text"
                      placeholder="Nos, Kg, Litre..."
                      value={directForm.unit}
                      onChange={(e) =>
                        handleDirectChange("unit", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                    {directErrors.unit && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.unit}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={directForm.quantity}
                      onChange={(e) =>
                        handleDirectChange("quantity", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                    {directErrors.quantity && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.quantity}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Warehouse</label>
                    <select
                      value={directForm.warehouse}
                      onChange={(e) =>
                        handleDirectChange("warehouse", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    >
                      <option value="">Select warehouse</option>
                      {WAREHOUSES.map((wh) => (
                        <option key={wh} value={wh}>
                          {wh}
                        </option>
                      ))}
                    </select>
                    {directErrors.warehouse && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.warehouse}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group">
                    <label>Received By</label>
                    <input
                      type="text"
                      value={directForm.receivedBy}
                      onChange={(e) =>
                        handleDirectChange("receivedBy", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                    {directErrors.receivedBy && (
                      <span className="consumable-grn-validation-error">
                        {directErrors.receivedBy}
                      </span>
                    )}
                  </div>

                  <div className="consumable-grn-form-group consumable-grn-form-group-full">
                    <label>Remarks</label>
                    <textarea
                      value={directForm.remarks}
                      onChange={(e) =>
                        handleDirectChange("remarks", e.target.value)
                      }
                      disabled={isCreatingDirect}
                    />
                  </div>

                  <div className="consumable-grn-form-actions consumable-grn-form-actions-full">
                    <button
                      type="button"
                      className="consumable-grn-cancel-btn"
                      onClick={closeDirectModal}
                      disabled={isCreatingDirect}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="consumable-grn-save-btn"
                      disabled={isCreatingDirect}
                    >
                      {isCreatingDirect ? (
                        <>
                          <span className="consumable-grn-btn-spinner" />
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