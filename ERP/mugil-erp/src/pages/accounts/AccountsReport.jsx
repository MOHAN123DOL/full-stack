import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import ErrorState from "../../components/error";
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
   PRINT ENGINE CONFIG
   ------------------------------------------------------------
   usesContainer: true  → the script renders its sheet INTO
                          #print-container (Delivery Challan).
   styleSrc             → stylesheet the script relies on. It is
                          only attached while the overlay is open,
                          because those stylesheets contain global
                          rules (body, *, #print-container).
   Engines that open their own tab (e.g. PurchaseOrderPrint.js)
   don't need either flag.
   ============================================================ */

const PRINT_ENGINES = {
  PO: {
    scriptSrc: "/PurchaseOrderPrint.js",
    globalFn: "generatePurchaseOrderPrint",
    datasetKey: "purchaseOrderPrintEngine",
    label: "Purchase Order",
  },
  QO: {
    scriptSrc: "/QuotationPrint.js",
    globalFn: "generateQuotationPrint",
    datasetKey: "quotationPrintEngine",
    label: "Quotation",
  },
  TI: {
    scriptSrc: "/TaxInvoicePrint.js",
    globalFn: "generateTaxInvoicePrint",
    datasetKey: "taxInvoicePrintEngine",
    label: "Tax Invoice",
  },
  DC: {
    scriptSrc: "/DeliveryChallanPrint.js",
    styleSrc: "/DeliveryChallanPrint.css",
    globalFn: "generateDeliveryChallanPrint",
    datasetKey: "deliveryChallanPrintEngine",
    label: "Delivery Challan",
    usesContainer: true,
  },
  PI: {
    scriptSrc: "/ProformaInvoicePrint.js",
    globalFn: "generateProformaInvoicePrint",
    datasetKey: "proformaInvoicePrintEngine",
    label: "Proforma Invoice",
  },
};

/* Cache of in-flight / resolved loader promises, keyed by short code. */
const printEnginePromises = {};

/* ============================================================
   PRINT CONTAINER / OVERLAY MANAGEMENT
   ------------------------------------------------------------
   DeliveryChallanPrint.js does, once, at load time:
       const container = document.getElementById("print-container");
   and its boot block immediately writes an "empty state" into
   it. Consequences:

   1. The container must exist BEFORE the script loads, and it
      must be the SAME DOM node for the rest of the page's life
      (the script keeps that reference forever). So it is created
      once, lives on <body>, and is NEVER removed or re-created —
      only hidden / emptied.
   2. It is hidden (display:none) from the moment it is created,
      so the boot-time empty state can never show inline. The
      overlay is only revealed right before the sheet is rendered.
   3. It is NOT rendered from JSX — React would fight with the
      script over its contents.
   ============================================================ */

const PRINT_CONTAINER_ID = "print-container";
const PRINT_OPEN_BODY_CLASS = "accounts-print-open";

function onPrintOverlayClick(event) {
  /* The DC toolbar's "Back" button calls history.back(), which would
     leave the report page. Intercept it (capture phase) and just
     close the overlay instead. */
  const target = event.target;
  if (
    target &&
    typeof target.closest === "function" &&
    target.closest(".dc-back-button, [data-print-close]")
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closePrintOverlay();
  }
}

function onPrintOverlayKeydown(event) {
  if (event.key === "Escape") closePrintOverlay();
}

function ensurePrintContainer() {
  let el = document.getElementById(PRINT_CONTAINER_ID);
  if (el) return el;

  el = document.createElement("div");
  el.id = PRINT_CONTAINER_ID;
  el.className = "accounts-print-overlay";
  el.style.display = "none"; /* hidden from the very first moment */
  el.addEventListener("click", onPrintOverlayClick, true);
  document.body.appendChild(el);
  return el;
}

function openPrintOverlay() {
  const el = ensurePrintContainer();
  el.style.display = "flex";
  document.body.classList.add(PRINT_OPEN_BODY_CLASS);
  document.addEventListener("keydown", onPrintOverlayKeydown);
}

function removeEngineStylesheets() {
  document
    .querySelectorAll("link[data-print-engine-style]")
    .forEach((link) => link.remove());
}

function closePrintOverlay() {
  const el = document.getElementById(PRINT_CONTAINER_ID);
  if (el) {
    el.style.display = "none";
    el.innerHTML = "";
  }
  document.body.classList.remove(PRINT_OPEN_BODY_CLASS);
  document.removeEventListener("keydown", onPrintOverlayKeydown);
  removeEngineStylesheets();
}

/* ============================================================
   STYLESHEET LOADER (only for engines that declare styleSrc)
   ============================================================ */

function loadEngineStylesheet(cfg) {
  if (!cfg.styleSrc) return Promise.resolve();

  const selector = `link[data-print-engine-style="${cfg.datasetKey}"]`;
  if (document.querySelector(selector)) return Promise.resolve();

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cfg.styleSrc;
    link.dataset.printEngineStyle = cfg.datasetKey;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn(`${cfg.styleSrc} failed to load`);
      resolve(); /* still try to print */
    };
    document.head.appendChild(link);
  });
}

/* ============================================================
   GENERIC PRINT ENGINE LOADER
   ============================================================ */

function loadPrintEngine(short) {
  const cfg = PRINT_ENGINES[short];
  if (!cfg) {
    return Promise.reject(new Error(`No print engine configured for ${short}`));
  }

  /* Already registered? */
  if (typeof window[cfg.globalFn] === "function") {
    return Promise.resolve();
  }

  if (printEnginePromises[short]) {
    return printEnginePromises[short];
  }

  printEnginePromises[short] = new Promise((resolve, reject) => {
    const selector = `script[data-print-engine="${cfg.datasetKey}"]`;
    const existing = document.querySelector(selector);

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => {
          printEnginePromises[short] = null;
          reject(new Error(`${cfg.scriptSrc} failed to load`));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = cfg.scriptSrc;
    script.async = true;
    script.dataset.printEngine = cfg.datasetKey;

    script.onload = () => {
      if (typeof window[cfg.globalFn] === "function") {
        resolve();
      } else {
        printEnginePromises[short] = null;
        reject(
          new Error(
            `${cfg.scriptSrc} loaded but did not register ${cfg.globalFn}`,
          ),
        );
      }
    };

    script.onerror = () => {
      printEnginePromises[short] = null;
      reject(new Error(`${cfg.scriptSrc} failed to load`));
    };

    document.head.appendChild(script);
  });

  return printEnginePromises[short];
}

/* ============================================================
   HELPERS — final-state detection
   ============================================================ */

const isPaymentFinal = (record) =>
  String(record?.payment_status || "").toUpperCase() === "PAID";

const isDeliveryFinal = (record) =>
  String(record?.delivery_status || "").toUpperCase() === "DELIVERED";

/* ============================================================
   HELPERS — print data normalisation
   ============================================================ */

const pickItems = (data) =>
  Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.line_items)
      ? data.line_items
      : Array.isArray(data?.lineItems)
        ? data.lineItems
        : [];

const pickGstPercent = (data) =>
  Number(
    data?.gstPercent ??
      data?.gst_percent ??
      data?.gstPercentage ??
      data?.gst ??
      0,
  ) || 0;

const pickInterState = (data) =>
  Boolean(data?.interState ?? data?.inter_state ?? false);

const pickColumns = (data) =>
  Array.isArray(data?.columns) ? data.columns : [];

const itemAmount = (item) => {
  if (item == null) return 0;
  const direct = item.amount ?? item.total ?? item.lineTotal ?? item.line_total;
  if (direct != null) return Number(direct) || 0;

  const qty = Number(item.qty ?? item.quantity ?? 0) || 0;
  const rate = Number(item.rate ?? item.price ?? item.unitPrice ?? 0) || 0;
  return qty * rate;
};

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
     Cleanup: if the user navigates away while the print overlay
     is open, close it. The container node itself is kept (the DC
     script holds a reference to it) — it is just hidden + emptied.
     ============================================================ */
  useEffect(() => {
    return () => {
      closePrintOverlay();
    };
  }, []);

  /* ============================================================
     VIEW
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

    if (field === "payment_status" && isPaymentFinal(record)) {
      setStatusError(
        "Payment is already marked as Paid and can no longer be changed.",
      );
      return;
    }
    if (field === "delivery_status" && isDeliveryFinal(record)) {
      setStatusError(
        "Delivery is already marked as Delivered and can no longer be changed.",
      );
      return;
    }

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

      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id ? { ...r, [field]: previousValue } : r,
        ),
      );

      const serverMessage = error?.response?.data?.message;
      setStatusError(serverMessage || GENERIC_ERROR);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  /* ============================================================
     PRINT — generic, dispatches by record.short
     ============================================================ */
  const handlePrint = async (record) => {
    const short = String(record?.short || "").toUpperCase();
    const cfg = PRINT_ENGINES[short];

    if (!cfg) {
      alert(`Print is not available for "${short || "this document"}".`);
      return;
    }

    try {
      /* Container first (hidden), then CSS, then script — the DC script
         grabs #print-container the instant it loads. */
      const container = ensurePrintContainer();

      if (cfg.usesContainer) {
        await loadEngineStylesheet(cfg);
      }
      await loadPrintEngine(short);

      const generateFn = window[cfg.globalFn];
      if (typeof generateFn !== "function") {
        alert(`${cfg.label} print system is not available.`);
        return;
      }

      const data = {
        ...(record.document_data || {}),
        includeAmountDetails: true,
      };

      const items = pickItems(data);

      const subtotal = items.reduce((sum, item) => sum + itemAmount(item), 0);

      const gstPercent = pickGstPercent(data);
      const gstAmount = (subtotal * gstPercent) / 100;
      const grandTotal = subtotal + gstAmount;

      const summary = {
        subtotal,
        totalGst: gstAmount,
        grandTotal,
        gstPercent,
        interState: pickInterState(data),
      };

      const columns = pickColumns(data);

      if (short === "DC") {
        data.includeAmountDetails = false;
      }

      if (cfg.usesContainer) {
        /* Wipe whatever the script's boot block wrote (empty state or a
           previous sheet), reveal the overlay, THEN render — the DC script
           measures layout to size its filler row, so it must be visible. */
        container.innerHTML = "";
        openPrintOverlay();
      }

      generateFn(data, summary, columns);

      /* Any other engine that happens to render into #print-container
         gets the same overlay treatment. */
      if (!cfg.usesContainer && container.childElementCount > 0) {
        openPrintOverlay();
      }
    } catch (error) {
      console.error(`${short} print failed:`, error);
      closePrintOverlay();
      alert(`Unable to open ${cfg.label} print preview.`);
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
              <ErrorState onRetry={loadRecords} />
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

                      const paymentLocked = isPaymentFinal(record);
                      const deliveryLocked = isDeliveryFinal(record);

                      const printAvailable = Boolean(
                        PRINT_ENGINES[String(record.short || "").toUpperCase()],
                      );

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
                              disabled={isUpdating || paymentLocked}
                              title={
                                paymentLocked
                                  ? "Payment is already Paid and cannot be changed."
                                  : undefined
                              }
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
                              disabled={isUpdating || deliveryLocked}
                              title={
                                deliveryLocked
                                  ? "Delivery is already Delivered and cannot be changed."
                                  : undefined
                              }
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
                              disabled={isUpdating || !printAvailable}
                              title={
                                printAvailable
                                  ? undefined
                                  : `Print is not available for ${record.short}.`
                              }
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