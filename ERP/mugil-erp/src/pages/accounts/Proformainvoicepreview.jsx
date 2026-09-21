import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Proformainvoiceform.css";
const STORAGE_KEY = "mei_proforma_invoice_draft";

// Standalone, PDF-accurate print renderer (ProformaInvoicePrint.html/.js/.css).
// This assumes the three print files are placed together in the app's
// `public/` folder so they're served from the site root. Adjust the path
// here if you host them somewhere else.
const PRINT_URL = "/ProformaInvoicePrint.html";

const UNIT_OPTIONS = ["Nos", "Kgs", "Mtr", "Set", "Box", "Ltr", "Pcs"];

const emptySupplier = () => ({
  name: "",
  gstNumber: "",
  address: "",
  city: "",
  state: "",
  stateCode: "",
  phone: "",
  email: "",
  contactPerson: "",
});

const emptyInvoiceDetails = () => ({
  invoiceNumber: "",
  date: "",
  deliveryNote: "",
  referenceNumber: "",
  referenceDate: "",
  buyerOrderNumber: "",
  dispatchDocNumber: "",
  dispatchedThrough: "",
  destination: "",
  termsOfDelivery: "",
  modeOfPayment: "",
});

const emptyItem = () => ({
  id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  description: "",
  hsn: "",
  quantity: "",
  unit: "Nos",
  rate: "",
  discount: "0",
});

const emptyTaxSummary = () => ({
  cgstPercent: "",
  sgstPercent: "",
  igstPercent: "",
  roundOff: "0",
  taxAmountInWords: "",
});

const defaultDeclaration =
  "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";

const getInitialState = () => ({
  supplier: emptySupplier(),
  invoiceDetails: emptyInvoiceDetails(),
  items: [emptyItem()],
  taxSummary: emptyTaxSummary(),
  declaration: defaultDeclaration,
});

/* ------------------------------------------------------------------
   Component
   ------------------------------------------------------------------ */

export default function ProformaInvoiceForm() {
  const [supplier, setSupplier] = useState(emptySupplier());
  const [invoiceDetails, setInvoiceDetails] = useState(emptyInvoiceDetails());
  const [items, setItems] = useState([emptyItem()]);
  const [taxSummary, setTaxSummary] = useState(emptyTaxSummary());
  const [declaration, setDeclaration] = useState(defaultDeclaration);
  const [saveStatus, setSaveStatus] = useState("");
  const navigate = useNavigate();
  /* ---------------- load draft on mount ---------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        setSupplier({ ...emptySupplier(), ...(draft.supplier || {}) });
        setInvoiceDetails({
          ...emptyInvoiceDetails(),
          ...(draft.invoiceDetails || {}),
        });
        setItems(
          Array.isArray(draft.items) && draft.items.length > 0
            ? draft.items
            : [emptyItem()],
        );
        setTaxSummary({ ...emptyTaxSummary(), ...(draft.taxSummary || {}) });
        setDeclaration(draft.declaration || defaultDeclaration);
      }
    } catch (err) {
      // Corrupt draft - ignore and start fresh
      console.warn("Could not load saved Proforma Invoice draft:", err);
    }
  }, []);

  /* ---------------- field handlers ---------------- */

  const updateSupplier = useCallback((field, value) => {
    setSupplier((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateInvoiceDetails = useCallback((field, value) => {
    setInvoiceDetails((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateTaxSummary = useCallback((field, value) => {
    setTaxSummary((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateItem = useCallback((id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const duplicateItem = useCallback((id) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const copy = {
        ...prev[index],
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteItem = useCallback((id) => {
    setItems((prev) => {
      if (prev.length === 1) return prev; // always keep at least one row
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  /* ---------------- amount calculation (per row) ---------------- */

  const rowAmount = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount) || 0;
    const gross = qty * rate;
    const net = gross - (gross * disc) / 100;
    return net;
  };

  /* ---------------- save draft ---------------- */

  const handleSaveDraft = () => {
    try {
      const draft = {
        supplier,
        invoiceDetails,
        items,
        taxSummary,
        declaration,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setSaveStatus("Draft saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      console.error("Could not save draft:", err);
      setSaveStatus("Save failed");
      setTimeout(() => setSaveStatus(""), 2000);
    }
  };

  const handlePrint = () => {
    const payload = {
      supplier,
      invoiceDetails,
      items,
      taxSummary,
      declaration,
    };

    // Stage the data the same way "Save Draft" does, so the print page's
    // localStorage fallback can find it even if the postMessage below
    // doesn't arrive in time (slow-loading tab, popup blocker, etc.).
    // This does not touch the form's own draft-loading behavior.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("Could not stage invoice data for printing:", err);
    }

    const printWindow = window.open(PRINT_URL, "_blank");
    if (printWindow) {
      // Also hand the live, possibly-unsaved data straight to the new
      // tab once it has had a moment to attach its message listener.
      setTimeout(() => {
        printWindow.postMessage(
          { type: "PROFORMA_INVOICE_DATA", data: payload },
          "*",
        );
      }, 300);
    }
  };

  /* ---------------- form view ---------------- */
  const backhandler = () => {
    navigate("/accounts");
  };
  return (
    <div className="form-page">
      {/* ================= SECTION 1 : Supplier Details ================= */}
      <div className="form-card">
        <button
          onClick={backhandler}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 className="form-card__title">Supplier Details</h2>
        <div className="field-grid">
          <div className="field">
            <label className="field__label">Supplier Name</label>
            <input
              className="field__input"
              type="text"
              value={supplier.name}
              onChange={(e) => updateSupplier("name", e.target.value)}
              placeholder="Enter supplier name"
            />
          </div>
          <div className="field">
            <label className="field__label">GST Number</label>
            <input
              className="field__input"
              type="text"
              value={supplier.gstNumber}
              onChange={(e) => updateSupplier("gstNumber", e.target.value)}
              placeholder="33AAAAA0000A1Z1"
            />
          </div>
          <div className="field field--wide">
            <label className="field__label">Address</label>
            <input
              className="field__input"
              type="text"
              value={supplier.address}
              onChange={(e) => updateSupplier("address", e.target.value)}
              placeholder="Street, area"
            />
          </div>
          <div className="field">
            <label className="field__label">City</label>
            <input
              className="field__input"
              type="text"
              value={supplier.city}
              onChange={(e) => updateSupplier("city", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">State</label>
            <input
              className="field__input"
              type="text"
              value={supplier.state}
              onChange={(e) => updateSupplier("state", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">State Code</label>
            <input
              className="field__input"
              type="text"
              value={supplier.stateCode}
              onChange={(e) => updateSupplier("stateCode", e.target.value)}
              placeholder="33"
            />
          </div>
          <div className="field">
            <label className="field__label">Phone</label>
            <input
              className="field__input"
              type="text"
              value={supplier.phone}
              onChange={(e) => updateSupplier("phone", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">Email</label>
            <input
              className="field__input"
              type="email"
              value={supplier.email}
              onChange={(e) => updateSupplier("email", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">Contact Person</label>
            <input
              className="field__input"
              type="text"
              value={supplier.contactPerson}
              onChange={(e) => updateSupplier("contactPerson", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ================= SECTION 2 : Invoice Details ================= */}
      <div className="form-card">
        <h2 className="form-card__title">Invoice Details</h2>
        <div className="field-grid">
          <div className="field">
            <label className="field__label">Proforma Invoice Number</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.invoiceNumber}
              onChange={(e) =>
                updateInvoiceDetails("invoiceNumber", e.target.value)
              }
              placeholder="MEI-001/26-27"
            />
          </div>
          <div className="field">
            <label className="field__label">Date</label>
            <input
              className="field__input"
              type="date"
              value={invoiceDetails.date}
              onChange={(e) => updateInvoiceDetails("date", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">Delivery Note</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.deliveryNote}
              onChange={(e) =>
                updateInvoiceDetails("deliveryNote", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Reference Number</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.referenceNumber}
              onChange={(e) =>
                updateInvoiceDetails("referenceNumber", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Reference Date</label>
            <input
              className="field__input"
              type="date"
              value={invoiceDetails.referenceDate}
              onChange={(e) =>
                updateInvoiceDetails("referenceDate", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Buyer Order Number</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.buyerOrderNumber}
              onChange={(e) =>
                updateInvoiceDetails("buyerOrderNumber", e.target.value)
              }
              placeholder="VERBAL"
            />
          </div>
          <div className="field">
            <label className="field__label">Dispatch Document Number</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.dispatchDocNumber}
              onChange={(e) =>
                updateInvoiceDetails("dispatchDocNumber", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Dispatched Through</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.dispatchedThrough}
              onChange={(e) =>
                updateInvoiceDetails("dispatchedThrough", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Destination</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.destination}
              onChange={(e) =>
                updateInvoiceDetails("destination", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Terms of Delivery</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.termsOfDelivery}
              onChange={(e) =>
                updateInvoiceDetails("termsOfDelivery", e.target.value)
              }
            />
          </div>
          <div className="field">
            <label className="field__label">Mode / Terms of Payment</label>
            <input
              className="field__input"
              type="text"
              value={invoiceDetails.modeOfPayment}
              onChange={(e) =>
                updateInvoiceDetails("modeOfPayment", e.target.value)
              }
              placeholder="100% ADVANCE"
            />
          </div>
        </div>
      </div>

      {/* ================= SECTION 3 : Items ================= */}
      <div className="form-card">
        <h2 className="form-card__title">Items</h2>
        <div className="items-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}>Sl No</th>
                <th>Description of Goods</th>
                <th style={{ width: 110 }}>HSN/SAC</th>
                <th style={{ width: 110 }}>Quantity</th>
                <th style={{ width: 90 }}>Unit</th>
                <th style={{ width: 100 }}>Rate</th>
                <th style={{ width: 80 }}>Disc %</th>
                <th style={{ width: 120 }}>Amount</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <textarea
                      className="field__input"
                      rows={2}
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      placeholder="Description of goods"
                    />
                  </td>
                  <td>
                    <input
                      className="field__input"
                      type="text"
                      value={item.hsn}
                      onChange={(e) =>
                        updateItem(item.id, "hsn", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="field__input"
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="field__input"
                      value={item.unit}
                      onChange={(e) =>
                        updateItem(item.id, "unit", e.target.value)
                      }
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="field__input"
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        updateItem(item.id, "rate", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="field__input"
                      type="number"
                      value={item.discount}
                      onChange={(e) =>
                        updateItem(item.id, "discount", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="field__input"
                      type="text"
                      value={rowAmount(item).toFixed(2)}
                      readOnly
                      tabIndex={-1}
                    />
                  </td>
                  <td>
                    <div className="buttons">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => duplicateItem(item.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => deleteItem(item.id)}
                        disabled={items.length === 1}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="buttons">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={addItem}
          >
            + Add Row
          </button>
        </div>
      </div>

      {/* ================= SECTION 4 : Tax Summary ================= */}
      <div className="form-card">
        <h2 className="form-card__title">Tax Summary</h2>
        <div className="summary-panel">
          <div className="field-grid">
            <div className="field">
              <label className="field__label">CGST %</label>
              <input
                className="field__input"
                type="number"
                value={taxSummary.cgstPercent}
                onChange={(e) =>
                  updateTaxSummary("cgstPercent", e.target.value)
                }
              />
            </div>
            <div className="field">
              <label className="field__label">SGST %</label>
              <input
                className="field__input"
                type="number"
                value={taxSummary.sgstPercent}
                onChange={(e) =>
                  updateTaxSummary("sgstPercent", e.target.value)
                }
              />
            </div>
            <div className="field">
              <label className="field__label">IGST %</label>
              <input
                className="field__input"
                type="number"
                value={taxSummary.igstPercent}
                onChange={(e) =>
                  updateTaxSummary("igstPercent", e.target.value)
                }
              />
            </div>
            <div className="field">
              <label className="field__label">Round Off</label>
              <input
                className="field__input"
                type="number"
                step="0.01"
                value={taxSummary.roundOff}
                onChange={(e) => updateTaxSummary("roundOff", e.target.value)}
              />
            </div>
            <div className="field field--wide">
              <label className="field__label">Tax Amount (in words)</label>
              <input
                className="field__input"
                type="text"
                value={taxSummary.taxAmountInWords}
                onChange={(e) =>
                  updateTaxSummary("taxAmountInWords", e.target.value)
                }
                placeholder="NIL"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 5 : Declaration ================= */}
      <div className="form-card">
        <h2 className="form-card__title">Declaration</h2>
        <div className="field field--wide">
          <textarea
            className="field__input"
            rows={4}
            value={declaration}
            onChange={(e) => setDeclaration(e.target.value)}
          />
        </div>
      </div>

      {/* ================= Sticky action bar ================= */}
      <div className="sticky-actionbar">
        <div className="buttons">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleSaveDraft}
          >
            Save Draft
          </button>
          {saveStatus && <span className="save-status">{saveStatus}</span>}
        </div>
        <div className="buttons">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handlePrint}
          >
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
