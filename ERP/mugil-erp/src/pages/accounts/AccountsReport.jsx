import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./AccountsReport.css";

const REPORT_ENDPOINT = "/erp/accounts-report/";

/* Single generic error message for every failure. */
const GENERIC_ERROR = "Something went wrong. Please try again.";

/* "PO-12" → "12" */
const numericIdFromRowId = (rowId) => {
  const parts = String(rowId || "").split("-");
  return parts.length > 1 ? parts[1] : rowId;
};

/* ============================================================
   PRINT ENGINE LOADER (PO only for now)
   ============================================================ */

let purchaseOrderPrintEnginePromise = null;

function loadPurchaseOrderPrintEngine() {
  if (typeof window.generatePurchaseOrderPrint === "function") {
    return Promise.resolve();
  }
  if (purchaseOrderPrintEnginePromise) return purchaseOrderPrintEnginePromise;

  purchaseOrderPrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-purchase-order-print-engine="true"]',
    );

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => {
          purchaseOrderPrintEnginePromise = null;
          reject(new Error("PurchaseOrderPrint.js failed to load"));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "/PurchaseOrderPrint.js";
    script.async = true;
    script.dataset.purchaseOrderPrintEngine = "true";

    script.onload = () => {
      if (typeof window.generatePurchaseOrderPrint === "function") {
        resolve();
      } else {
        purchaseOrderPrintEnginePromise = null;
        reject(
          new Error(
            "PurchaseOrderPrint.js loaded but did not register generatePurchaseOrderPrint",
          ),
        );
      }
    };

    script.onerror = () => {
      purchaseOrderPrintEnginePromise = null;
      reject(new Error("PurchaseOrderPrint.js failed to load"));
    };

    document.head.appendChild(script);
  });

  return purchaseOrderPrintEnginePromise;
}

/* ============================================================
   COMPONENT
   ============================================================ */

export default function AccountsReport() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  /* Data */
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  /* Filter */
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");

  /* Per-row status update tracking */
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [statusError, setStatusError] = useState("");

  /* ============================================================
     LOAD RECORDS
     ============================================================ */
  const loadRecords = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setLoadError("");

      const response = await api.get(REPORT_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const responseData = response.data;

      if (!responseData?.success) {
        throw new Error("bad response");
      }

      setRecords(Array.isArray(responseData.data) ? responseData.data : []);
    } catch (error) {
      console.error("Failed to load accounts report:", error);
      setRecords([]);
      setLoadError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  /* ============================================================
     VIEW — pass mode:"view" so destination form asks the
     user "same number or new number?"
     ============================================================ */
  const handleView = (record) => {
    navigate(record.path, {
      state: {
        documentNumber: record.document_number,
        reportRecord: record,
        mode: "view",
      },
    });
  };

  /* ============================================================
     STATUS CHANGE — optimistic PATCH
     ============================================================ */
  const handleStatusChange = async (record, field, newValue) => {
    const previousValue = record[field];

    if (previousValue === newValue) return;

    // Optimistic update
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, [field]: newValue } : r)),
    );

    setStatusUpdatingId(record.id);
    setStatusError("");

    try {
      const numericId = numericIdFromRowId(record.id);

      const response = await api.patch(
        `/erp/accounts-report/${record.short}/${numericId}/status/`,
        { [field]: newValue },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      const serverData = response.data.data;
      if (serverData) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id
              ? {
                  ...r,
                  payment_status: serverData.payment_status ?? r.payment_status,
                  delivery_status:
                    serverData.delivery_status ?? r.delivery_status,
                }
              : r,
          ),
        );
      }
    } catch (error) {
      console.error("Status update failed:", error);

      // Revert optimistic change
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id ? { ...r, [field]: previousValue } : r,
        ),
      );

      setStatusError(GENERIC_ERROR);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  /* ============================================================
     PRINT
     ============================================================ */
  const handlePrint = async (record) => {
    if (record.short !== "PO") {
      alert("Print is currently available for Purchase Orders.");
      return;
    }

    try {
      await loadPurchaseOrderPrintEngine();

      if (typeof window.generatePurchaseOrderPrint !== "function") {
        alert("Purchase Order print system is not available.");
        return;
      }

      const data = {
        ...(record.document_data || {}),
        includeAmountDetails: true,
      };

      const subtotal = (data.items || []).reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
      );

      const gstPercent = Number(data.gstPercent) || 0;
      const gstAmount = (subtotal * gstPercent) / 100;
      const grandTotal = subtotal + gstAmount;

      const summary = {
        subtotal,
        totalGst: gstAmount,
        grandTotal,
        gstPercent,
        interState: data.interState,
      };

      window.generatePurchaseOrderPrint(data, summary, data.columns || []);
    } catch (error) {
      console.error("Purchase Order print failed:", error);
      alert("Unable to open Purchase Order print preview.");
    }
  };

  /* ============================================================
     CLIENT-SIDE FILTER
     ============================================================ */
  const filteredRecords =
    documentTypeFilter === "all"
      ? records
      : records.filter(
          (r) =>
            String(r.short).toUpperCase() ===
            String(documentTypeFilter).toUpperCase(),
        );

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <>
      <Header />

      <main className="accounts-report-page">
        <div className="accounts-report-container">
          <div className="accounts-report-top">
            <Link to="/accounts" className="erp-back-button">
              <ArrowLeft size={16} />
              Back
            </Link>
          </div>

          <div className="accounts-report-heading">
            <h1>Reports</h1>
            <p>View and manage all accounting documents</p>
          </div>

          {/* ---------- FILTER ---------- */}
          <div className="accounts-report-filter">
            <label htmlFor="document-type-filter">Document Type</label>
            <select
              id="document-type-filter"
              className="accounts-report-filter-select"
              value={documentTypeFilter}
              onChange={(e) => setDocumentTypeFilter(e.target.value)}
              disabled={loading}
            >
              <option value="all">ALL</option>
              <option value="PO">PO</option>
              <option value="QO">QO</option>
              <option value="TI">TI</option>
              <option value="DC">DC</option>
              <option value="PI">PI</option>
            </select>
          </div>

          {/* ---------- LOADING ---------- */}
          {loading && (
            <div className="qt-customer-loading">
              <Loading />
            </div>
          )}

          {/* ---------- LOAD ERROR ---------- */}
          {!loading && loadError && (
            <div className="qt-customer-error">
              <Error onRetry={loadRecords} />
              <div style={{ marginTop: 8, fontSize: 13 }}>{loadError}</div>
            </div>
          )}

          {/* ---------- STATUS UPDATE ERROR ---------- */}
          {statusError && (
            <div className="qt-alert" style={{ marginBottom: 12 }}>
              <div className="qt-alert__icon">!</div>
              <div className="qt-alert__content">
                <strong>Status update failed</strong>
                <span>{statusError}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStatusError("")}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ---------- TABLE ---------- */}
          {!loading && !loadError && (
            <div className="accounts-report-table-wrapper">
              <table className="accounts-report-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Document Number</th>
                    <th>Payment Status</th>
                    <th>Delivery Status</th>
                    <th>View</th>
                    <th>Print</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record, index) => {
                      const isUpdating = statusUpdatingId === record.id;

                      return (
                        <tr key={record.id}>
                          <td>{index + 1}</td>

                          <td>
                            <div className="report-document-info">
                              <span className="report-document-short">
                                {record.short}
                              </span>
                              <span className="report-document-number">
                                {record.document_number}
                              </span>
                            </div>
                          </td>

                          <td>
                            <select
                              className={`report-status-select payment-status-${String(
                                record.payment_status,
                              )
                                .toLowerCase()
                                .replace("/", "")}`}
                              value={record.payment_status}
                              disabled={isUpdating}
                              onChange={(e) =>
                                handleStatusChange(
                                  record,
                                  "payment_status",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="Paid">Paid</option>
                              <option value="Pending">Pending</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </td>

                          <td>
                            <select
                              className={`report-status-select delivery-status-${String(
                                record.delivery_status,
                              )
                                .toLowerCase()
                                .replace("/", "")}`}
                              value={record.delivery_status}
                              disabled={isUpdating}
                              onChange={(e) =>
                                handleStatusChange(
                                  record,
                                  "delivery_status",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="Delivered">Delivered</option>
                              <option value="Pending">Pending</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="report-action-button report-view-button"
                              onClick={() => handleView(record)}
                              disabled={isUpdating}
                            >
                              View
                            </button>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="report-action-button report-print-button"
                              onClick={() => handlePrint(record)}
                              disabled={isUpdating}
                            >
                              Print
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="report-empty">
                        {documentTypeFilter === "all"
                          ? "No documents found."
                          : `No ${documentTypeFilter} documents found.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
