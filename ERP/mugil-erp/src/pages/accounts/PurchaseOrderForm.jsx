import { useEffect, useState } from "react";
import VendorDetails from "../../components/VendorDetails";
import OrderItemsTable, {
  createDefaultColumns,
} from "../../components/OrderItemsTable";
import AmountSummary from "../../components/AmountSummary";
import TermsEditor from "../../components/TermsEditor";
import { initialPOData } from "../../utils/initialData";
import { summarizePOItems } from "../../utils/calculations";
import "./PurchaseOrder.css";
import "../../styles/form.css";
import "../../styles/print.css";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";

const DRAFT_KEY = "mei-erp-po-draft";
const DRAFT_VERSION = 2;

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
        : word.charAt(0).toUpperCase() + word.slice(1),
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

let purchaseOrderPrintEnginePromise = null;

function loadPurchaseOrderPrintEngine() {
  if (
    typeof window.generatePurchaseOrderPrint ===
    "function"
  ) {
    return Promise.resolve();
  }

  if (purchaseOrderPrintEnginePromise) {
    return purchaseOrderPrintEnginePromise;
  }

  purchaseOrderPrintEnginePromise =
    new Promise((resolve, reject) => {
      const existing =
        document.querySelector(
          'script[data-purchase-order-print-engine="true"]',
        );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(),
          { once: true },
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                "PurchaseOrderPrint.js failed to load",
              ),
            ),
          { once: true },
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src =
        "/PurchaseOrderPrint.js";

      script.async = true;

      script.dataset.purchaseOrderPrintEngine =
        "true";

      script.onload = () => resolve();

      script.onerror = () => {
        purchaseOrderPrintEnginePromise = null;

        reject(
          new Error(
            "PurchaseOrderPrint.js failed to load",
          ),
        );
      };

      document.head.appendChild(script);
    });

  return purchaseOrderPrintEnginePromise;
}

export default function PurchaseOrderForm() {
  const location = useLocation();

  const [data, setData] = useState(initialPOData);
  const [errors, setErrors] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [includeAmountDetails, setIncludeAmountDetails] = useState(true);

  const [columns, setColumns] = useState(() => createDefaultColumns("po"));
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [newColOptions, setNewColOptions] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw);

        if (
          parsed &&
          parsed.__version === DRAFT_VERSION &&
          parsed.data
        ) {
          setData(parsed.data);

          setColumns(
            parsed.columns && parsed.columns.length
              ? parsed.columns
              : createDefaultColumns("po"),
          );
        } else {
          setData(parsed);
        }
      } catch {
        // ignore corrupt draft
      }
    }
  }, []);

  useEffect(() => {
    const reportRecord = location.state?.reportRecord;

    if (!reportRecord?.documentData) return;

    if (reportRecord.type !== "Purchase Order") return;

    setData(reportRecord.documentData);
    setErrors({});
    setSavedAt(null);
  }, [location.state]);

  useEffect(() => {
    loadPurchaseOrderPrintEngine().catch((error) => {
      console.error(
        "Purchase Order print engine preload failed:",
        error
      );
    });
  }, []);

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const setNested = (group, key, value) =>
    setData((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));

  // Simple summary that just aggregates what user entered - no calculations
// ============================================================
// PURCHASE ORDER AMOUNT CALCULATIONS
// ============================================================

// Total excluding GST = sum of all item amounts
const subtotal = data.items.reduce((sum, item) => {
  const amount = Number(item.amount) || 0;
  return sum + amount;
}, 0);

// GST percentage is entered by the user
const gstPercent = Number(data.gstPercent) || 0;

// GST amount = subtotal × GST %
const gstAmount = (subtotal * gstPercent) / 100;

// Final total = subtotal + GST amount
const grandTotal = subtotal + gstAmount;

const summary = {
  subtotal,
  totalGst: gstAmount,
  grandTotal,
  gstPercent,
  interState: data.interState,
};

  const validate = () => {
    const next = {};
    if (!data.poNumber.trim()) next.poNumber = "PO Number is required";
    if (!data.poDate) next.poDate = "PO Date is required";
    if (!data.vendor.companyName.trim())
      next.vendorCompany = "Vendor company name is required";
    const hasItem = data.items.some(
      (it) => it.description.trim() && Number(it.qty) > 0,
    );
    if (!hasItem)
      next.items = "Add at least one item with a description and quantity";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveDraft = () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ __version: DRAFT_VERSION, data, columns }),
    );
    setSavedAt(new Date());
  };

  const clearForm = () => {
    if (!window.confirm("Clear all fields and start a new Purchase Order?"))
      return;
    localStorage.removeItem(DRAFT_KEY);
    setData(initialPOData());
    setColumns(createDefaultColumns("po"));
    setErrors({});
    setSavedAt(null);
  };
const goToPreview = () => {
if (!validate()) return;

saveDraft();

if (
typeof window.generatePurchaseOrderPrint !==
"function"
) {
alert(
"Purchase Order print system is still loading. Please wait a moment and try Preview again."
);
return;
}

window.generatePurchaseOrderPrint(
{
...data,
includeAmountDetails,
},
summary,
columns
);
};


  const handleAddColumn = () => {
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
      const systemIdx = cols.findIndex((c) => c.system);
      const insertAt = systemIdx === -1 ? cols.length : systemIdx;
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
  };

  const handleRenameColumn = (column) => {
    const next = window.prompt(
      `Rename column "${column.label}" to:`,
      column.label,
    );
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    setColumns((cols) =>
      cols.map((c) => (c.id === column.id ? { ...c, label: trimmed } : c)),
    );
  };

  const handleDeleteColumn = (column) => {
    if (column.removable === false) return;
    if (
      !window.confirm(
        `Delete the "${column.label}" column? This removes its data from every row.`,
      )
    )
      return;
    setColumns((cols) => cols.filter((c) => c.id !== column.id));
    setData((d) => ({
      ...d,
      items: d.items.map((it) => {
        const { [column.id]: _removed, ...rest } = it;
        return rest;
      }),
    }));
  };

  const handleMoveColumn = (column, direction) => {
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
  };

  const handleToggleColumnVisibility = (column) => {
    if (column.hideable === false) return;
    setColumns((cols) =>
      cols.map((c) => (c.id === column.id ? { ...c, visible: !c.visible } : c)),
    );
  };




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
            >
              Clear
            </button>

            <button
              type="button"
              className="po-btn po-btn--secondary"
              onClick={saveDraft}
            >
              Save Draft
            </button>

            <button
              type="button"
              className="po-btn po-btn--primary"
              onClick={goToPreview}
            >
              Preview →
            </button>
          </div>
        </div>

        <div className="po-hero__content">
          <div className="po-hero__heading">
            <h1>Purchase Order</h1>
            <p>
              Fill in the details below, then preview the official document.
            </p>
          </div>

          <div className="po-status">
            <div className="po-status__card">
              <span className="po-status__label">Draft Status</span>
              <strong>
                {savedAt ? "Saved" : "Not Saved"}
              </strong>
            </div>

            <div className="po-status__card">
              <span className="po-status__label">Last Saved</span>
              <strong>
                {savedAt
                  ? savedAt.toLocaleTimeString()
                  : "--"}
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
          <div className="po-validation__title">
            Validation Required
          </div>

          <div className="po-validation__text">
            Please fix the highlighted fields before previewing:{" "}
            {Object.values(errors).join(" · ")}
          </div>
        </div>
      )}

      <section className="po-card">
        <div className="po-card__header">
          <div className="po-card__step">01</div>

          <div className="po-card__heading">
            <h3>Purchase Details</h3>
          </div>
        </div>

        <div className="po-grid">
          <label className="po-field">
            <span className="po-field__label">
              PO Number
              <span className="po-required">*</span>
            </span>

            <input
              className={`po-input ${errors.poNumber ? "po-input--error" : ""}`}
              value={data.poNumber}
              onChange={(e) => set("poNumber", e.target.value)}
              placeholder="e.g. PO/2026/0142"
            />
          </label>

          <label className="po-field">
            <span className="po-field__label">
              PO Date
              <span className="po-required">*</span>
            </span>

            <input
              type="date"
              className={`po-input ${errors.poDate ? "po-input--error" : ""}`}
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
            <span className="po-field__label">
              Reference Date
            </span>

            <input
              type="date"
              className="po-input"
              value={data.refDate}
              onChange={(e) => set("refDate", e.target.value)}
            />
          </label>

          <label className="po-field po-field--wide">
            <span className="po-field__label">
              Subject
            </span>

            <input
              className="po-input"
              value={data.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="e.g. Purchase Order for 5 Ton Single Girder EOT Crane"
            />
          </label>

          <label className="po-field">
            <span className="po-field__label">
              Prepared By
            </span>

            <input
              className="po-input"
              value={data.preparedBy}
              onChange={(e) => set("preparedBy", e.target.value)}
              placeholder="Employee name"
            />
          </label>
        </div>
      </section>

      <section className="po-card">
  <div className="po-card__header">
    <div className="po-card__step">02</div>

    <div className="po-card__heading">
      <h3>Customer Details</h3>
    </div>
  </div>

  <VendorDetails
    mode="form"
    vendor={data.vendor}
    onChange={(v) => set("vendor", v)}
    heading=""
  />
</section>

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

      <section className="po-card">
        <div className="po-card__header">
          <div className="po-card__step">04</div>

          <div className="po-card__heading">
  <h3>Order Items</h3>

  <label className="po-amount-toggle">
    <input
      type="checkbox"
      checked={includeAmountDetails}
      onChange={(e) => setIncludeAmountDetails(e.target.checked)}
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

      <section className="po-card">
  <div className="po-card__header">
    <div className="po-card__step">05</div>

    <div className="po-card__heading">
      <h3>Amount Summary</h3>
    </div>
  </div>

  <div className="po-grid">

    {/* =========================================================
        TOTAL AMOUNT — AUTOMATIC
        Sum of all Order Item Amount values
       ========================================================= */}
    <label className="po-field">
      <span className="po-field__label">
        Total Amount (₹)
      </span>

      <input
        type="number"
        className="po-input"
        value={subtotal}
        readOnly
      />
    </label>


    {/* =========================================================
        GST % — USER INPUT
       ========================================================= */}
    <label className="po-field">
      <span className="po-field__label">
        GST %
      </span>

      <input
        type="number"
        className="po-input"
        value={data.gstPercent || ""}
        onChange={(e) =>
          set("gstPercent", e.target.value)
        }
        placeholder="e.g. 18"
        min="0"
      />
    </label>


    {/* =========================================================
        GST AMOUNT — AUTOMATIC
       ========================================================= */}
    <label className="po-field">
      <span className="po-field__label">
        GST Amount (₹)
      </span>

      <input
        type="number"
        className="po-input"
        value={gstAmount}
        readOnly
      />
    </label>


    {/* =========================================================
        FINAL TOTAL — AUTOMATIC
       ========================================================= */}
    <label className="po-field">
      <span className="po-field__label">
        Final Total (₹)
      </span>

      <input
        type="number"
        className="po-input"
        value={grandTotal}
        readOnly
      />
    </label>

  </div>
</section>


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
              onChange={(e) => setNested("delivery", "date", e.target.value)}
            />
          </label>

          <label className="po-field">
            <span className="po-field__label">Mode of Transport</span>

            <input
              className="po-input"
              value={data.delivery.mode}
              onChange={(e) => setNested("delivery", "mode", e.target.value)}
              placeholder="e.g. By Road / Courier"
            />
          </label>

          <label className="po-field">
            <span className="po-field__label">Expected Delivery</span>

            <input
              className="po-input"
              value={data.delivery.expectedDelivery}
              onChange={(e) =>
                setNested("delivery", "expectedDelivery", e.target.value)
              }
              placeholder="e.g. 4-6 weeks"
            />
          </label>
        </div>
      </section>

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
            onChange={(t) => set("terms", t)}
          />
        </div>
      </section>

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
          >
            Clear
          </button>

          <button
            type="button"
            className="po-btn po-btn--secondary"
            onClick={saveDraft}
          >
            Save Draft
          </button>

          <button
            type="button"
            className="po-btn po-btn--primary"
            onClick={goToPreview}
          >
            Preview →
          </button>
        </div>
      </div>

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
                        disabled={
                          c.movable === false || idx === 0
                        }
                        title="Move up"
                        onClick={() =>
                          handleMoveColumn(c, "up")
                        }
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
                        onClick={() =>
                          handleMoveColumn(c, "down")
                        }
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        className="po-icon-btn"
                        title="Rename column"
                        onClick={() =>
                          handleRenameColumn(c)
                        }
                      >
                        ✎
                      </button>

                      <button
                        type="button"
                        className="po-icon-btn"
                        disabled={c.hideable === false}
                        title={
                          c.hideable === false
                            ? "Always visible (required for calculations)"
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
                        onClick={() =>
                          handleDeleteColumn(c)
                        }
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
                    <span className="po-field__label">
                      Data Type
                    </span>

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
                      <option value="dropdown">
                        Dropdown
                      </option>
                    </select>
                  </label>

                  {newColType === "dropdown" && (
                    <label className="po-field po-field--wide">
                      <span className="po-field__label">
                        Dropdown Options (comma separated)
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