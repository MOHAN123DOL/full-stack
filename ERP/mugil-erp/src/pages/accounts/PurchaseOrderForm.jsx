import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import VendorDetails from "../../components/VendorDetails";

import OrderItemsTable, {
  createDefaultColumns,
} from "../../components/OrderItemsTable";

import AmountSummary from "../../components/AmountSummary";
import TermsEditor from "../../components/TermsEditor";
import Loading from "../../components/loading";
import Error from "../../components/error";

import { initialPOData } from "../../utils/initialData";
import { summarizePOItems } from "../../utils/calculations";

import "./PurchaseOrder.css";
import "../../styles/form.css";
import "../../styles/print.css";

import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import Header from "../../components/Header";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const DRAFT_KEY = "mei-erp-po-draft";
const DRAFT_VERSION = 2;
const PRINT_ENGINE_SRC = "/PurchaseOrderPrint.js";

// ============================================================
// HELPERS
// ============================================================

const toCamelId = (label) => {
  const cleaned = label
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();

  if (!cleaned) return "column";

  return cleaned
    .split(" ")
    .map((word, i) =>
      i === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join("");
};

const makeUniqueColumnId = (label, existingColumns) => {
  const base = toCamelId(label);
  const ids = new Set(existingColumns.map((c) => c.id));

  if (!ids.has(base)) return base;

  let n = 2;
  while (ids.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
};

const buildFreshData = () =>
  typeof initialPOData === "function"
    ? initialPOData()
    : { ...initialPOData };

const EMPTY_VENDOR = {
  companyName: "",
  address1: "",
  contactPerson: "",
  phone: "",
  email: "",
  gst: "",
};

// ============================================================
// PRINT ENGINE LOADER (singleton, race-safe)
// ============================================================

let purchaseOrderPrintEnginePromise = null;

function loadPurchaseOrderPrintEngine() {
  if (typeof window.generatePurchaseOrderPrint === "function") {
    return Promise.resolve();
  }

  if (purchaseOrderPrintEnginePromise) {
    return purchaseOrderPrintEnginePromise;
  }

  purchaseOrderPrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-purchase-order-print-engine="true"]`
    );

    if (existing) {
      // Script tag exists — check if already loaded
      if (typeof window.generatePurchaseOrderPrint === "function") {
        resolve();
        return;
      }

      // Still loading — attach one-shot listeners
      const onLoad = () => {
        if (typeof window.generatePurchaseOrderPrint === "function") {
          resolve();
        } else {
          purchaseOrderPrintEnginePromise = null;
          reject(
            new Error(
              "PurchaseOrderPrint.js loaded but did not register generatePurchaseOrderPrint"
            )
          );
        }
      };

      const onError = () => {
        purchaseOrderPrintEnginePromise = null;
        reject(new Error("PurchaseOrderPrint.js failed to load"));
      };

      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = PRINT_ENGINE_SRC;
    script.async = true;
    script.dataset.purchaseOrderPrintEngine = "true";

    script.onload = () => {
      if (typeof window.generatePurchaseOrderPrint === "function") {
        resolve();
      } else {
        purchaseOrderPrintEnginePromise = null;
        reject(
          new Error(
            "PurchaseOrderPrint.js loaded but did not register generatePurchaseOrderPrint"
          )
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

// ============================================================
// COMPONENT
// ============================================================

export default function PurchaseOrderForm() {
  const location = useLocation();
  const { accessToken } = useAuth();

  // ==========================================================
  // MAIN FORM STATE
  // ==========================================================

  const [data, setData] = useState(buildFreshData);
  const [errors, setErrors] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [includeAmountDetails, setIncludeAmountDetails] = useState(true);

  // ==========================================================
  // CUSTOMER STATE
  // ==========================================================

  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [poNumberLoading, setPoNumberLoading] = useState(false);
  const [poNumberError, setPoNumberError] = useState("");

  // ==========================================================
  // COLUMN STATE
  // ==========================================================

  const [columns, setColumns] = useState(() => createDefaultColumns("po"));
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [newColOptions, setNewColOptions] = useState("");

  // ==========================================================
  // GUARDS (prevent duplicate API calls)
  // ==========================================================

  const bootstrappedRef = useRef(false);
  const lastTokenRef = useRef(null);
  const printEnginePreloadedRef = useRef(false);

  // ==========================================================
  // LOAD LOCAL DRAFT (once)
  // ==========================================================

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      if (parsed && parsed.__version === DRAFT_VERSION && parsed.data) {
        setData(parsed.data);

        if (parsed.columns && parsed.columns.length) {
          setColumns(parsed.columns);
        }

        if (typeof parsed.includeAmountDetails === "boolean") {
          setIncludeAmountDetails(parsed.includeAmountDetails);
        }
      } else if (parsed && typeof parsed === "object") {
        // Legacy draft: parsed IS the data object
        setData(parsed);
      }
    } catch {
      // Corrupt draft — ignore
    }
  }, []);

  // ==========================================================
  // LOAD REPORT RECORD (from location state)
  // ==========================================================

  useEffect(() => {
    const reportRecord = location.state?.reportRecord;
    if (!reportRecord?.documentData) return;
    if (reportRecord.type !== "Purchase Order") return;

    setData(reportRecord.documentData);
    setErrors({});
    setSavedAt(null);
  }, [location.state]);

  // ==========================================================
  // PRELOAD PRINT ENGINE (once)
  // ==========================================================

  useEffect(() => {
    if (printEnginePreloadedRef.current) return;
    printEnginePreloadedRef.current = true;

    loadPurchaseOrderPrintEngine().catch((error) => {
      // Non-fatal: engine will be retried on Preview click
      if (import.meta.env.DEV) {
        console.warn("PO print engine preload failed:", error);
      }
    });
  }, []);

  // ==========================================================
  // LOAD CUSTOMERS
  // ==========================================================

  const loadCustomers = useCallback(async (token) => {
    if (!token) return;

    try {
      setCustomersLoading(true);
      setCustomersError("");

      const response = await api.get("/erp/customers/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const responseData = response.data;

      let customerList = [];
      if (Array.isArray(responseData)) {
        customerList = responseData;
      } else if (Array.isArray(responseData?.data)) {
        customerList = responseData.data;
      } else if (Array.isArray(responseData?.results)) {
        customerList = responseData.results;
      }

      setCustomers(customerList);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to load customers:", error);
      }

      setCustomers([]);

      if (error.response) {
        setCustomersError(
          error.response.data?.message || "Unable to load customers."
        );
      } else if (error.request) {
        setCustomersError("Unable to connect to the server.");
      } else {
        setCustomersError("Something went wrong while loading customers.");
      }
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // ==========================================================
  // LOAD NEXT PO NUMBER
  // ==========================================================

  const loadPONumber = useCallback(async (token) => {
    if (!token) return;

    try {
      setPoNumberLoading(true);
      setPoNumberError("");

      const response = await api.get("/erp/purchase-orders/next-number/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const responseData = response.data;

      if (!responseData?.success || !responseData?.po_number) {
        throw new Error(
          responseData?.message || "Unable to get Purchase Order number."
        );
      }

      const poNumber = responseData.po_number;

      setData((previous) => ({ ...previous, poNumber }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to load PO number:", error);
      }

      const message = error.response
        ? error.response.data?.message ||
          "Unable to get Purchase Order number."
        : error.request
        ? "Unable to connect to the server while getting the PO number."
        : error.message || "Unable to get Purchase Order number.";

      setPoNumberError(message);
    } finally {
      setPoNumberLoading(false);
    }
  }, []);

  // ==========================================================
  // BOOTSTRAP: run customers + PO number EXACTLY ONCE per token
  // ==========================================================

  useEffect(() => {
    if (!accessToken) return;

    // Same token, already bootstrapped → skip
    if (bootstrappedRef.current && lastTokenRef.current === accessToken) {
      return;
    }

    bootstrappedRef.current = true;
    lastTokenRef.current = accessToken;

    // Fire both in parallel — this is the intended "3A" parallel load
    loadCustomers(accessToken);
    loadPONumber(accessToken);
  }, [accessToken, loadCustomers, loadPONumber]);

  // ==========================================================
  // BASIC SETTERS
  // ==========================================================

  const set = useCallback((key, value) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  const setNested = useCallback((group, key, value) => {
    setData((d) => ({
      ...d,
      [group]: { ...(d[group] || {}), [key]: value },
    }));
  }, []);

  // ==========================================================
  // CUSTOMER SELECTION
  // ==========================================================

  const handleCustomerChange = useCallback(
    (customerId) => {
      setSelectedCustomerId(customerId);

      if (!customerId) {
        // Reset vendor details when customer is cleared
        setData((previous) => ({
          ...previous,
          vendor: { ...previous.vendor, ...EMPTY_VENDOR },
        }));

        setErrors((previous) => {
          const next = { ...previous };
          delete next.vendorCompany;
          return next;
        });
        return;
      }

      const customer = customers.find(
        (item) => String(item.id) === String(customerId)
      );

      if (!customer) return;

      setData((previous) => ({
        ...previous,
        vendor: {
          ...previous.vendor,
          companyName: customer.company_name || "",
          address1: customer.address || "",
          contactPerson: customer.contact_person || "",
          phone: customer.phone || "",
          email: customer.email || "",
          gst: customer.gst_number || "",
        },
      }));

      setErrors((previous) => {
        const next = { ...previous };
        delete next.vendorCompany;
        return next;
      });
    },
    [customers]
  );

  // ==========================================================
  // AMOUNT CALCULATIONS (memoized)
  // ==========================================================

  const subtotal = useMemo(
    () =>
      data.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [data.items]
  );

  const gstPercent = useMemo(() => {
    const n = Number(data.gstPercent);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [data.gstPercent]);

  const gstAmount = useMemo(
    () => (subtotal * gstPercent) / 100,
    [subtotal, gstPercent]
  );

  const grandTotal = useMemo(
    () => subtotal + gstAmount,
    [subtotal, gstAmount]
  );

  const summary = useMemo(
    () => ({
      subtotal,
      totalGst: gstAmount,
      grandTotal,
      gstPercent,
      interState: data.interState,
    }),
    [subtotal, gstAmount, grandTotal, gstPercent, data.interState]
  );

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const validate = useCallback(() => {
    const next = {};

    if (!data.poNumber) {
      next.poNumber = "Purchase Order number is still loading.";
    }

    if (!data.poDate) {
      next.poDate = "PO Date is required";
    }

    if (!data.vendor?.companyName?.trim()) {
      next.vendorCompany = "Customer company name is required";
    }

    // GST validation
    if (data.gstPercent !== "" && data.gstPercent != null) {
      const parsedGst = Number(data.gstPercent);
      if (!Number.isFinite(parsedGst) || parsedGst < 0 || parsedGst > 100) {
        next.gstPercent = "GST % must be a number between 0 and 100";
      }
    }

    const hasItem = data.items.some(
      (it) => it.description?.trim() && Number(it.qty) > 0
    );

    if (!hasItem) {
      next.items = "Add at least one item with a description and quantity";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [data]);

  // ==========================================================
  // SAVE LOCAL DRAFT
  // ==========================================================

  const saveDraft = useCallback(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        __version: DRAFT_VERSION,
        data,
        columns,
        includeAmountDetails,
      })
    );

    setSavedAt(new Date());
  }, [data, columns, includeAmountDetails]);

  // ==========================================================
  // CLEAR FORM
  // ==========================================================

  const clearForm = useCallback(async () => {
    if (
      !window.confirm("Clear all fields and start a new Purchase Order?")
    ) {
      return;
    }

    localStorage.removeItem(DRAFT_KEY);

    setData(buildFreshData());
    setColumns(createDefaultColumns("po"));
    setErrors({});
    setSavedAt(null);
    setSelectedCustomerId("");
    setSubmitError("");
    setIncludeAmountDetails(true);

    // Fetch a fresh PO number using the same token
    if (accessToken) {
      await loadPONumber(accessToken);
    }
  }, [accessToken, loadPONumber]);

  // ==========================================================
  // CREATE PO + PREVIEW
  // ==========================================================

  const goToPreview = useCallback(async () => {
    if (submitting) return;

    setSubmitError("");

    if (!validate()) return;

    if (!accessToken) {
      setSubmitError("Your session has expired. Please login again.");
      return;
    }

    const poNumber = data.poNumber;
    if (!poNumber) {
      setSubmitError(
        "PO number is not available. Please refresh the page."
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        po_number: poNumber,
        po_date: data.poDate || null,
        ref_quote_number: data.refQuoteNumber || "",
        ref_date: data.refDate || null,
        subject: data.subject || "",
        prepared_by: data.preparedBy || "",
        vendor: data.vendor || {},
        intro_text: data.introText || "",
        items: data.items || [],
        columns: columns || [],
        include_amount_details: includeAmountDetails,
        subtotal: Number(subtotal) || 0,
        gst_percent: Number(gstPercent) || 0,
        gst_amount: Number(gstAmount) || 0,
        grand_total: Number(grandTotal) || 0,
        delivery: data.delivery || {},
        payment: data.payment || {},
        terms: data.terms || [],
        notes: data.notes || "",
        signatures: data.signatures || {},
        document_data: {
          ...data,
          poNumber,
          includeAmountDetails,
        },
        status: "previewed",
      };

      if (import.meta.env.DEV) {
        console.log("Purchase Order POST payload:", payload);
      }

      const response = await api.post("/erp/purchase-orders/", payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        setSubmitError(
          response.data?.message || "Purchase Order creation failed."
        );
        return;
      }

      const createdPO = response.data?.data;
      if (!createdPO) {
        setSubmitError(
          "Purchase Order was created, but the server returned invalid data."
        );
        return;
      }

      // Use the SERVER-CONFIRMED PO number if provided, else keep ours
      const confirmedPoNumber = createdPO.po_number || poNumber;

      const previewData = {
        ...data,
        poNumber: confirmedPoNumber,
        includeAmountDetails,
      };

      setData(previewData);

      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          __version: DRAFT_VERSION,
          data: previewData,
          columns,
          includeAmountDetails,
        })
      );

      setSavedAt(new Date());

      // Ensure print engine is ready
      await loadPurchaseOrderPrintEngine();

      if (typeof window.generatePurchaseOrderPrint !== "function") {
        setSubmitError(
          "Purchase Order was created successfully, but the print preview could not be loaded."
        );
        return;
      }

      window.generatePurchaseOrderPrint(previewData, summary, columns);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Purchase Order creation failed:", error);
      }

      if (error.response) {
        const responseData = error.response.data;
        const backendMessage = responseData?.message;
        const backendErrors = responseData?.errors;

        if (backendErrors) {
          const errorMessages = Object.entries(backendErrors)
            .map(([field, messages]) => {
              const message = Array.isArray(messages)
                ? messages.join(", ")
                : String(messages);
              return `${field}: ${message}`;
            })
            .join(" | ");

          setSubmitError(
            errorMessages ||
              backendMessage ||
              "Please check the entered details."
          );
        } else {
          setSubmitError(
            backendMessage || "Purchase Order could not be created."
          );
        }
        return;
      }

      if (error.request) {
        setSubmitError(
          "Unable to connect to the server. Please check whether the backend is running."
        );
        return;
      }

      setSubmitError(
        error.message ||
          "Something went wrong while creating the Purchase Order."
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    validate,
    accessToken,
    data,
    columns,
    includeAmountDetails,
    subtotal,
    gstPercent,
    gstAmount,
    grandTotal,
    summary,
  ]);

  // ==========================================================
  // ADD COLUMN
  // ==========================================================

  const handleAddColumn = useCallback(() => {
    const label = newColLabel.trim();
    if (!label) return;

    const id = makeUniqueColumnId(label, columns);

    const options =
      newColType === "dropdown"
        ? newColOptions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const newColumn = {
      id,
      label,
      type: newColType,
      visible: true,
      custom: true,
      removable: true,
      hideable: true,
      movable: true,
      system: false,
      ...(options ? { options } : {}),
    };

    setColumns((cols) => {
      // Insert AFTER system columns (append before first non-system, or at end)
      const firstNonSystemIdx = cols.findIndex((c) => !c.system);
      const insertAt = firstNonSystemIdx === -1 ? cols.length : firstNonSystemIdx;
      const next = [...cols];
      next.splice(insertAt, 0, newColumn);
      return next;
    });

    setData((d) => ({
      ...d,
      items: d.items.map((it) => ({ ...it, [id]: "" })),
    }));

    setNewColLabel("");
    setNewColType("text");
    setNewColOptions("");
  }, [newColLabel, newColType, newColOptions, columns]);

  // ==========================================================
  // RENAME COLUMN
  // ==========================================================

  const handleRenameColumn = useCallback((column) => {
    const next = window.prompt(
      `Rename column "${column.label}" to:`,
      column.label
    );
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) return;

    setColumns((cols) =>
      cols.map((c) => (c.id === column.id ? { ...c, label: trimmed } : c))
    );
  }, []);

  // ==========================================================
  // DELETE COLUMN
  // ==========================================================

  const handleDeleteColumn = useCallback((column) => {
    if (column.removable === false) return;

    if (
      !window.confirm(
        `Delete the "${column.label}" column? This removes its data from every row.`
      )
    ) {
      return;
    }

    setColumns((cols) => cols.filter((c) => c.id !== column.id));

    setData((d) => ({
      ...d,
      items: d.items.map((it) => {
        const { [column.id]: _removed, ...rest } = it;
        return rest;
      }),
    }));
  }, []);

  // ==========================================================
  // MOVE COLUMN
  // ==========================================================

  const handleMoveColumn = useCallback((column, direction) => {
    if (column.movable === false) return;

    setColumns((cols) => {
      const idx = cols.findIndex((c) => c.id === column.id);
      if (idx === -1) return cols;

      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= cols.length) return cols;
      if (cols[target].movable === false) return cols;

      const next = [...cols];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  // ==========================================================
  // TOGGLE COLUMN
  // ==========================================================

  const handleToggleColumnVisibility = useCallback((column) => {
    if (column.hideable === false) return;

    setColumns((cols) =>
      cols.map((c) =>
        c.id === column.id ? { ...c, visible: !c.visible } : c
      )
    );
  }, []);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <Header />

      <div className="po-page">
        <div className="po-container">
          <section className="po-hero">
            <div className="po-hero__top">
              <Link to="/accounts" className="erp-back-button">
                <ArrowLeft size={16} />
                Back
              </Link>

              <div className="po-hero__actions">
                <button
                  type="button"
                  className="po-btn po-btn--ghost"
                  onClick={clearForm}
                  disabled={submitting}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="po-btn po-btn--secondary"
                  onClick={saveDraft}
                  disabled={submitting}
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  className="po-btn po-btn--primary"
                  onClick={goToPreview}
                  disabled={submitting || !data.poNumber}
                >
                  {submitting ? (
                    <>
                      <span className="po-btn-spinner" />
                      Creating PO...
                    </>
                  ) : (
                    "Preview →"
                  )}
                </button>
              </div>
            </div>

            <div className="po-hero__content">
              <div className="po-hero__heading">
                <h1>Purchase Order</h1>
                <p>
                  Fill in the details below, then preview the official
                  document.
                </p>
              </div>

              <div className="po-status">
                <div className="po-status__card">
                  <span className="po-status__label">Draft Status</span>
                  <strong>{savedAt ? "Saved" : "Not Saved"}</strong>
                </div>

                <div className="po-status__card">
                  <span className="po-status__label">Last Saved</span>
                  <strong>
                    {savedAt ? savedAt.toLocaleTimeString() : "--"}
                  </strong>
                </div>

                <div className="po-status__card">
                  <span className="po-status__label">Items</span>
                  <strong>{data.items.length}</strong>
                </div>
              </div>
            </div>
          </section>

          {Object.keys(errors).length > 0 && (
            <div className="po-validation">
              <div className="po-validation__title">Validation Required</div>
              <div className="po-validation__text">
                Please fix the highlighted fields before previewing:{" "}
                {Object.values(errors).filter(Boolean).join(" · ")}
              </div>
            </div>
          )}

          {(submitError || poNumberError) && (
            <div className="po-submit-error">
              <div className="po-submit-error__content">
                <strong>Purchase Order could not be created</strong>
                <span>{submitError || poNumberError}</span>
              </div>

              {poNumberError && !poNumberLoading && (
                <button
                  type="button"
                  className="po-btn po-btn--secondary po-btn--sm"
                  onClick={() => loadPONumber(accessToken)}
                >
                  Retry
                </button>
              )}

              <button
                type="button"
                className="po-submit-error__close"
                onClick={() => {
                  setSubmitError("");
                  setPoNumberError("");
                }}
                aria-label="Close error"
              >
                ×
              </button>
            </div>
          )}

          {/* 01 PURCHASE DETAILS */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">01</div>
              <div className="po-card__heading">
                <h3>Purchase Details</h3>
              </div>
            </div>

            <div className="po-grid">
              <label className="po-field">
                <span className="po-field__label">PO Number</span>
                <input
                  className="po-input"
                  value={
                    data.poNumber ||
                    (poNumberLoading ? "Loading..." : "—")
                  }
                  readOnly
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">
                  PO Date<span className="po-required">*</span>
                </span>
                <input
                  type="date"
                  className={`po-input ${
                    errors.poDate ? "po-input--error" : ""
                  }`}
                  value={data.poDate}
                  onChange={(e) => set("poDate", e.target.value)}
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">
                  Reference Quotation Number
                </span>
                <input
                  className="po-input"
                  value={data.refQuoteNumber}
                  onChange={(e) => set("refQuoteNumber", e.target.value)}
                  placeholder="e.g. CS-QT/1544 R4/25-26"
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Reference Date</span>
                <input
                  type="date"
                  className="po-input"
                  value={data.refDate}
                  onChange={(e) => set("refDate", e.target.value)}
                />
              </label>

              <label className="po-field po-field--wide">
                <span className="po-field__label">Subject</span>
                <input
                  className="po-input"
                  value={data.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  placeholder="e.g. Purchase Order for 5 Ton Single Girder EOT Crane"
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Prepared By</span>
                <input
                  className="po-input"
                  value={data.preparedBy}
                  onChange={(e) => set("preparedBy", e.target.value)}
                  placeholder="Employee name"
                />
              </label>
            </div>
          </section>

          {/* 02 CUSTOMER DETAILS */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">02</div>
              <div className="po-card__heading">
                <h3>Customer Details</h3>
              </div>
            </div>

            {customersLoading && (
              <div className="po-customer-loading">
                <Loading />
              </div>
            )}

            {!customersLoading && customersError && (
              <div className="po-customer-error">
                <Error onRetry={() => loadCustomers(accessToken)} />
              </div>
            )}

            {!customersLoading &&
              !customersError &&
              customers.length > 0 && (
                <div className="po-grid">
                  <label className="po-field po-field--wide">
                    <span className="po-field__label">
                      Select Customer
                    </span>
                    <select
                      className="po-input"
                      value={selectedCustomerId}
                      onChange={(e) =>
                        handleCustomerChange(e.target.value)
                      }
                    >
                      <option value="">Select Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.company_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

            {!customersLoading &&
              !customersError &&
              customers.length === 0 && (
                <div className="po-customer-empty">
                  No saved customers. You can enter customer details manually
                  below.
                </div>
              )}

            <VendorDetails
              mode="form"
              vendor={data.vendor}
              onChange={(vendor) => set("vendor", vendor)}
              heading=""
            />
          </section>

          {/* 03 INTRO */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">03</div>
              <div className="po-card__heading">
                <h3>Intro Paragraph</h3>
              </div>
            </div>

            <div className="po-card__body">
              <label className="po-field">
                <textarea
                  className="po-textarea"
                  value={data.introText}
                  onChange={(e) => set("introText", e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* 04 ORDER ITEMS */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">04</div>
              <div className="po-card__heading">
                <h3>Order Items</h3>

                <label className="po-amount-toggle">
                  <input
                    type="checkbox"
                    checked={includeAmountDetails}
                    onChange={(e) =>
                      setIncludeAmountDetails(e.target.checked)
                    }
                  />
                  <span>Include amount details</span>
                </label>
              </div>

              <button
                type="button"
                className="po-btn po-btn--secondary po-btn--sm"
                onClick={() => setShowColumnModal(true)}
              >
                ⚙ Manage Columns
              </button>
            </div>

            <div className="po-card__body po-card__body--table">
              <OrderItemsTable
                variant="po"
                mode="form"
                items={data.items}
                onChange={(items) => set("items", items)}
                columns={columns}
              />
            </div>
          </section>

          {/* 05 AMOUNT SUMMARY */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">05</div>
              <div className="po-card__heading">
                <h3>Amount Summary</h3>
              </div>
            </div>

            <div className="po-grid">
              <label className="po-field">
                <span className="po-field__label">Total Amount (₹)</span>
                <input
                  type="number"
                  className="po-input"
                  value={subtotal}
                  readOnly
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">GST %</span>
                <input
                  type="number"
                  className={`po-input ${
                    errors.gstPercent ? "po-input--error" : ""
                  }`}
                  value={data.gstPercent || ""}
                  onChange={(e) => set("gstPercent", e.target.value)}
                  placeholder="e.g. 18"
                  min="0"
                  max="100"
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">GST Amount (₹)</span>
                <input
                  type="number"
                  className="po-input"
                  value={gstAmount}
                  readOnly
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Final Total (₹)</span>
                <input
                  type="number"
                  className="po-input"
                  value={grandTotal}
                  readOnly
                />
              </label>
            </div>
          </section>

          {/* 06 DELIVERY */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">06</div>
              <div className="po-card__heading">
                <h3>Delivery Details</h3>
              </div>
            </div>

            <div className="po-grid">
              <label className="po-field po-field--wide">
                <span className="po-field__label">Delivery Address</span>
                <input
                  className="po-input"
                  value={data.delivery.address}
                  onChange={(e) =>
                    setNested("delivery", "address", e.target.value)
                  }
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Delivery Date</span>
                <input
                  type="date"
                  className="po-input"
                  value={data.delivery.date}
                  onChange={(e) =>
                    setNested("delivery", "date", e.target.value)
                  }
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Mode of Transport</span>
                <input
                  className="po-input"
                  value={data.delivery.mode}
                  onChange={(e) =>
                    setNested("delivery", "mode", e.target.value)
                  }
                  placeholder="e.g. By Road / Courier"
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Expected Delivery</span>
                <input
                  className="po-input"
                  value={data.delivery.expectedDelivery}
                  onChange={(e) =>
                    setNested(
                      "delivery",
                      "expectedDelivery",
                      e.target.value
                    )
                  }
                  placeholder="e.g. 4-6 weeks"
                />
              </label>
            </div>
          </section>

          {/* 07 PAYMENT */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">07</div>
              <div className="po-card__heading">
                <h3>Payment Details</h3>
              </div>
            </div>

            <div className="po-grid">
              <label className="po-field">
                <span className="po-field__label">Payment Terms</span>
                <input
                  className="po-input"
                  value={data.payment.terms}
                  onChange={(e) =>
                    setNested("payment", "terms", e.target.value)
                  }
                  placeholder="e.g. 80% advance, 20% before dispatch"
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Advance %</span>
                <input
                  type="number"
                  className="po-input"
                  value={data.payment.advancePercent}
                  onChange={(e) =>
                    setNested("payment", "advancePercent", e.target.value)
                  }
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Credit Days</span>
                <input
                  type="number"
                  className="po-input"
                  value={data.payment.creditDays}
                  onChange={(e) =>
                    setNested("payment", "creditDays", e.target.value)
                  }
                />
              </label>

              <label className="po-field po-field--wide">
                <span className="po-field__label">Bank Details</span>
                <input
                  className="po-input"
                  value={data.payment.bankDetails}
                  onChange={(e) =>
                    setNested("payment", "bankDetails", e.target.value)
                  }
                  placeholder="Bank name, A/c no., IFSC"
                />
              </label>
            </div>
          </section>

          {/* 08 TERMS */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">08</div>
              <div className="po-card__heading">
                <h3>Terms &amp; Conditions</h3>
              </div>
            </div>

            <div className="po-card__body">
              <TermsEditor
                mode="form"
                terms={data.terms}
                onChange={(terms) => set("terms", terms)}
              />
            </div>
          </section>

          {/* 09 NOTES */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">09</div>
              <div className="po-card__heading">
                <h3>Notes</h3>
              </div>
            </div>

            <div className="po-card__body">
              <textarea
                className="po-textarea po-textarea--large"
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any additional notes for this order..."
              />
            </div>
          </section>

          {/* 10 SIGNATURE */}
          <section className="po-card">
            <div className="po-card__header">
              <div className="po-card__step">10</div>
              <div className="po-card__heading">
                <h3>Signature</h3>
              </div>
            </div>

            <div className="po-grid po-grid--compact">
              <label className="po-field">
                <span className="po-field__label">Prepared By</span>
                <input
                  className="po-input"
                  value={data.signatures.preparedBy}
                  onChange={(e) =>
                    setNested("signatures", "preparedBy", e.target.value)
                  }
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Checked By</span>
                <input
                  className="po-input"
                  value={data.signatures.checkedBy}
                  onChange={(e) =>
                    setNested("signatures", "checkedBy", e.target.value)
                  }
                />
              </label>

              <label className="po-field">
                <span className="po-field__label">Approved By</span>
                <input
                  className="po-input"
                  value={data.signatures.approvedBy}
                  onChange={(e) =>
                    setNested("signatures", "approvedBy", e.target.value)
                  }
                />
              </label>
            </div>
          </section>

          {/* FOOTER */}
          <div className="po-footerbar">
            <div className="po-footerbar__status">
              {savedAt
                ? `Draft saved at ${savedAt.toLocaleTimeString()}`
                : "Not saved yet"}
            </div>

            <div className="po-footerbar__actions">
              <button
                type="button"
                className="po-btn po-btn--ghost"
                onClick={clearForm}
                disabled={submitting}
              >
                Clear
              </button>

              <button
                type="button"
                className="po-btn po-btn--secondary"
                onClick={saveDraft}
                disabled={submitting}
              >
                Save Draft
              </button>

              <button
                type="button"
                className="po-btn po-btn--primary"
                onClick={goToPreview}
                disabled={submitting || !data.poNumber}
              >
                {submitting ? (
                  <>
                    <span className="po-btn-spinner" />
                    Creating PO...
                  </>
                ) : (
                  "Preview →"
                )}
              </button>
            </div>
          </div>

          {/* COLUMN MODAL */}
          {showColumnModal && (
            <div
              className="po-modal"
              role="dialog"
              aria-modal="true"
              onClick={() => setShowColumnModal(false)}
            >
              <div
                className="po-modal__panel"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="po-modal__header">
                  <h3>Manage Columns</h3>
                  <button
                    type="button"
                    className="po-icon-btn"
                    title="Close"
                    onClick={() => setShowColumnModal(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="po-modal__body">
                  <ul className="po-column-list">
                    {columns.map((c, idx) => (
                      <li
                        key={c.id}
                        className={`po-column-row${
                          c.visible === false
                            ? " po-column-row--hidden"
                            : ""
                        }`}
                      >
                        <div className="po-column-row__left">
                          <span>{c.label}</span>
                          {c.custom && (
                            <span className="po-column-badge">
                              custom
                            </span>
                          )}
                        </div>

                        <div className="po-column-row__actions">
                          <button
                            type="button"
                            className="po-icon-btn"
                            disabled={c.movable === false || idx === 0}
                            title="Move up"
                            onClick={() => handleMoveColumn(c, "up")}
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            className="po-icon-btn"
                            disabled={
                              c.movable === false ||
                              idx === columns.length - 1
                            }
                            title="Move down"
                            onClick={() => handleMoveColumn(c, "down")}
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            className="po-icon-btn"
                            title="Rename column"
                            onClick={() => handleRenameColumn(c)}
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            className="po-icon-btn"
                            disabled={c.hideable === false}
                            title={
                              c.hideable === false
                                ? "Always visible"
                                : c.visible === false
                                ? "Show column"
                                : "Hide column"
                            }
                            onClick={() =>
                              handleToggleColumnVisibility(c)
                            }
                          >
                            {c.visible === false ? "🙈" : "👁"}
                          </button>

                          <button
                            type="button"
                            className="po-icon-btn po-icon-btn--danger"
                            disabled={c.removable === false}
                            title={
                              c.removable === false
                                ? "Required for calculations"
                                : "Delete column"
                            }
                            onClick={() => handleDeleteColumn(c)}
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="po-column-add">
                    <h4>Add New Column</h4>

                    <div className="po-grid">
                      <label className="po-field">
                        <span className="po-field__label">
                          Column Name
                        </span>
                        <input
                          className="po-input"
                          value={newColLabel}
                          onChange={(e) =>
                            setNewColLabel(e.target.value)
                          }
                          placeholder="e.g. Heat Number"
                        />
                      </label>

                      <label className="po-field">
                        <span className="po-field__label">Data Type</span>
                        <select
                          className="po-input"
                          value={newColType}
                          onChange={(e) =>
                            setNewColType(e.target.value)
                          }
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="dropdown">Dropdown</option>
                        </select>
                      </label>

                      {newColType === "dropdown" && (
                        <label className="po-field po-field--wide">
                          <span className="po-field__label">
                            Dropdown Options
                          </span>
                          <input
                            className="po-input"
                            value={newColOptions}
                            onChange={(e) =>
                              setNewColOptions(e.target.value)
                            }
                            placeholder="e.g. A36, A572, SS400"
                          />
                        </label>
                      )}
                    </div>

                    <button
                      type="button"
                      className="po-btn po-btn--primary po-btn--sm"
                      disabled={!newColLabel.trim()}
                      onClick={handleAddColumn}
                    >
                      + Add Column
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}