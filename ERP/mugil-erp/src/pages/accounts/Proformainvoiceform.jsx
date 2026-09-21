import React, { useState, useEffect, useMemo } from "react";
import "./TaxInvoice.css";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";

// ---------------------------------------------------------------------------
// This form is a clone of TaxInvoiceForm.jsx's architecture, reworked for
// the Proforma Invoice. It intentionally reuses the exact same "ti-form-*"
// class names (from the shared TaxInvoice.css) so the Proforma form looks
// identical to the Tax Invoice form -- same fonts, spacing, borders, grid
// layout -- without needing a second stylesheet.
//
// IMPORTANT: every Proforma-specific value the PDF needs (Proforma No,
// Date, Valid Until, Payment Terms, Reference No, Customer PO No, PO Date,
// Place of Supply, the Declaration text, and the Encl/terms text) lives in
// this component's `formData` state and is handed to the print engine
// as-is. Nothing Proforma-specific is hardcoded in the PDF generator --
// see ProformaInvoicePrint.js's buildMetaTableNode()/buildBottomBlockNode().
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lazy-loads the standalone print engine (ProformaInvoicePrint.js) into the
// page on first use, so no manual <script> tag needs to be added to
// index.html. Mirrors the same pattern TaxInvoiceForm.jsx uses for
// TaxInvoicePrint.js. Safe to call repeatedly.
// ---------------------------------------------------------------------------
let proformaInvoicePrintEnginePromise = null;
function loadProformaInvoicePrintEngine() {
  if (typeof window.generateProformaInvoicePrint === "function") {
    return Promise.resolve();
  }
  if (proformaInvoicePrintEnginePromise)
    return proformaInvoicePrintEnginePromise;

  proformaInvoicePrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-proforma-invoice-print-engine="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("ProformaInvoicePrint.js failed to load")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "/ProformaInvoicePrint.js";
    script.async = true;
    script.dataset.proformaInvoicePrintEngine = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      proformaInvoicePrintEnginePromise = null; // allow retrying on a later click
      reject(new Error("ProformaInvoicePrint.js failed to load"));
    };
    document.head.appendChild(script);
  });

  return proformaInvoicePrintEnginePromise;
}

const COMPANY = {
  name: "MUGIL ENGINEERING INDUSTRY",
  worksLine1: "Works : 2/89. SF No 105, Thanjavur Main Road,",
  worksLine2: "Devarayaneri, Assoor Post, Trichy - 620 015.",
  gstin: "33AHDPR8644K1ZX",
  ssiNo: "18.13.18257 dt 31.01.2001",
  cell1: "98424-52887",
  cell2: "89039-52887",
  pan: "AHDPR8644K",
};

const COMPANY_ADDRESSES = [
  {
    id: "unit1",
    label: "Unit 1",
    address:
      "4/211, S.F. No.105, Thanjavur Main Road, Devarayanery, Assor (P.O.), Trichy - 620 015",
  },
  {
    id: "unit2",
    label: "Unit 2",
    address:
      "S.F. No: 436 / 5A, Near B K Bharath Township, Thanjavur Main Road, Valavanthankottai, Trichy - 620015",
  },
];

const customers = [
  {
    gst: "33ADUFS1852R1Z6",
    companyName: "SRI GURU KRUPA CONSTRUCTIONS",
    address:
      "No.90, Bhavani Main Road, Opp to Anna Statue, Perundurai - 638052",
    phone: "9876543210",
    email: "contact@srigurukrupa.com",
    state: "Tamil Nadu",
    stateCode: "33",
  },
  {
    gst: "33AHDPR8644K1ZX",
    companyName: "MUGIL ENGINEERING INDUSTRY",
    address:
      "2/89 SF No 105 Thanjavur Main Road, Devarayaneri, Assoor Post, Trichy - 620015",
    phone: "9842452887",
    email: "info@mugil.com",
    state: "Tamil Nadu",
    stateCode: "33",
  },
  {
    gst: "33AALCC1724F1Z1",
    companyName: "COIMBATORE CASTINGS PVT LTD",
    address: "45, SIDCO Industrial Estate, Kurichi, Coimbatore - 641021",
    phone: "9843211234",
    email: "sales@cbecastings.com",
    state: "Tamil Nadu",
    stateCode: "33",
  },
  {
    gst: "33ABCDE1234F1Z5",
    companyName: "SOUTHERN FABRICATORS",
    address: "12/4, Trichy Road, Karur - 639002",
    phone: "9865432190",
    email: "info@southernfab.com",
    state: "Tamil Nadu",
    stateCode: "33",
  },
  {
    gst: "29AAGCS1234H1Z8",
    companyName: "BANGALORE STEEL WORKS",
    address: "88, Peenya Industrial Area, Bangalore - 560058",
    phone: "9900112233",
    email: "contact@bswsteel.com",
    state: "Karnataka",
    stateCode: "29",
  },
  {
    gst: "27AAACP1234K1ZC",
    companyName: "PRECISION ENGINEERING CO",
    address: "23, MIDC Industrial Area, Pune - 411019",
    phone: "9822334455",
    email: "sales@precisioneng.com",
    state: "Maharashtra",
    stateCode: "27",
  },
  {
    gst: "33AAECT5678M1Z2",
    companyName: "TIRUCHY VALVES & FITTINGS",
    address: "5, Bharathidasan Nagar, Thillai Nagar, Trichy - 620018",
    phone: "9787654321",
    email: "info@tiruchyvalves.com",
    state: "Tamil Nadu",
    stateCode: "33",
  },
  {
    gst: "33AAFCM4321N1Z9",
    companyName: "MADURAI PIPES & TUBES",
    address: "17, Anna Nagar Main Road, Madurai - 625020",
    phone: "9865123456",
    email: "sales@maduraipipes.com",
    state: "Tamil Nadu",
    stateCode: "33",
  },
];

// Known states, derived from the existing customer master data (no new
// hardcoded list) -- offered as suggestions for the editable Place of
// Supply field.
const knownStates = [...new Set(customers.map((c) => c.state))];

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  description: "",
  hsn: "",
  quantity: "",
  unit: "",
  rate: "",
});

// ---------------------------------------------------------------------------
// Per-proforma storage.
//
// The "working draft" (whatever is currently on screen, saved or not) is
// always autosaved under UNSAVED_DRAFT_KEY, exactly like before -- so a
// refresh never loses in-progress typing.
//
// A *named* proforma record is only written when the user explicitly clicks
// "Save Proforma", under a key derived from the Proforma No. Loading a
// proforma by number reads that record back verbatim (including whatever
// the user edited in Receiver/Consignee) -- it never re-runs the GST
// lookup, so saved edits are never silently overwritten.
// ---------------------------------------------------------------------------
const UNSAVED_DRAFT_KEY = "proformaInvoiceDraft:__unsaved__";
const SAVED_PROFORMA_INDEX_KEY = "proformaInvoiceDraft:__savedProformaNos__";
const savedProformaRecordKey = (proformaNo) =>
  `proformaInvoiceDraft:record:${String(proformaNo).trim()}`;

const emptyPartyDetails = () => ({
  companyName: "",
  gst: "",
  address: "",
  state: "",
  stateCode: "",
  phone: "",
  email: "",
});

// ---------------------------------------------------------------------------
// Default/example form values (see prompt section 10). These are only
// *initial* values for testing -- every one of them is a normal, editable
// form field, and the PDF always reads the live formData, never these
// constants directly.
// ---------------------------------------------------------------------------
const defaultFormData = {
  // 01. Proforma Details
  proformaNo: "PF/2026/0142",
  date: "2026-08-31",
  validUntil: "2027-03-29",
  paymentTerms: "50% Advance, Balance Before Dispatch",

  // 04. Reference / Order Information
  referenceNo: "REF-2026-089",
  customerPoNo: "PO/2026/315",
  poDate: "2026-08-20",
  placeOfSupply: "Tamil Nadu (33)",

  // GST number selected from the lookup dropdown (drives which master
  // record is offered as the *initial* default -- see
  // handleReceiverGstChange / handleConsigneeGstChange below).
  receiverGst: "",
  consigneeGst: "",

  // The actual, independently-editable values used everywhere else
  // (display, save, PDF). Seeded from the GST master record when a GST is
  // selected, then fully editable and persisted with the proforma from
  // then on -- editing these never touches the `customers` master data.
  receiverDetails: emptyPartyDetails(),
  consigneeDetails: emptyPartyDetails(),

  // Which of Mugil Industry's existing addresses (COMPANY_ADDRESSES) is
  // currently applied to the Receiver / Consignee address field, if any.
  receiverAddressOptionId: "",
  consigneeAddressOptionId: "",

  companyAddressId: "unit1",

  cgstPct: 9,
  sgstPct: 9,
  igstPct: 0,
  roundedOff: 0,

  bankName: "STATE BANK OF INDIA",
  accountNumber: "",
  branch: "",
  ifsc: "",

  declaration:
    "This Proforma Invoice is issued for the purpose of order confirmation and advance payment only. It does not constitute a demand for payment under GST law and holds no value as a Tax Invoice for input credit purposes.",

  enclosureText:
    "This is a Proforma Invoice, not a demand for payment or a Tax Invoice.\n" +
    "Prices are valid until the date mentioned above.\n" +
    "GST will be charged as applicable at the time of actual supply.\n" +
    "Delivery: 3–4 weeks from receipt of confirmed order & advance.\n" +
    "Goods once dispatched will not be taken back.",
};

/* ============================================================
   Number -> Indian words helper (identical to TaxInvoiceForm.jsx)
   ============================================================ */
function numberToWordsIndian(num) {
  num = Math.round(num || 0);
  if (num === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };

  const threeDigits = (n) => {
    if (n < 100) return twoDigits(n);
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " and " + twoDigits(n % 100) : "")
    );
  };

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += threeDigits(lakh) + " Lakh ";
  if (thousand) result += threeDigits(thousand) + " Thousand ";
  if (hundred) result += threeDigits(hundred);

  return result.trim();
}

export default function ProformaInvoiceForm() {
  const [formData, setFormData] = useState(defaultFormData);
  const [items, setItems] = useState([emptyItem()]);
  const [saveStatus, setSaveStatus] = useState(""); // transient "Saved" / "Loaded" / error message
  const [loadProformaNo, setLoadProformaNo] = useState("");

  /* ---- restore the in-progress working draft (unsaved autosave) ---- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(UNSAVED_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData)
          setFormData({ ...defaultFormData, ...parsed.formData });
        if (parsed.items && parsed.items.length) setItems(parsed.items);
      }
    } catch (e) {
      console.error("Failed to restore draft", e);
    }
  }, []);

  /* ---- autosave the working draft (does NOT touch named saved proformas) ---- */
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(
          UNSAVED_DRAFT_KEY,
          JSON.stringify({ formData, items }),
        );
      } catch (e) {
        console.error("Failed to save draft", e);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [formData, items]);

  const selectedCompanyAddress = useMemo(
    () =>
      COMPANY_ADDRESSES.find(
        (address) => address.id === formData.companyAddressId,
      ) || COMPANY_ADDRESSES[0],
    [formData.companyAddressId],
  );

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* ---- Receiver: GST lookup only seeds initial values, then fully editable ---- */
  const handleReceiverGstChange = (gst) => {
    const master = customers.find((c) => c.gst === gst) || null;
    setFormData((prev) => ({
      ...prev,
      receiverGst: gst,
      receiverDetails: master
        ? {
            companyName: master.companyName,
            gst: master.gst,
            address: master.address,
            state: master.state,
            stateCode: master.stateCode,
            phone: master.phone,
            email: master.email,
          }
        : emptyPartyDetails(),
      // Reset any previously-chosen Mugil address option -- it belonged to
      // the previous customer, not this one.
      receiverAddressOptionId: "",
    }));
  };

  const updateReceiverField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      receiverDetails: { ...prev.receiverDetails, [field]: value },
    }));
  };

  const handleReceiverAddressOptionChange = (addressId) => {
    const chosen = COMPANY_ADDRESSES.find((a) => a.id === addressId);
    setFormData((prev) => ({
      ...prev,
      receiverAddressOptionId: addressId,
      receiverDetails: chosen
        ? { ...prev.receiverDetails, address: chosen.address }
        : prev.receiverDetails,
    }));
  };

  /* ---- Consignee: same pattern ---- */
  const handleConsigneeGstChange = (gst) => {
    const master = customers.find((c) => c.gst === gst) || null;
    setFormData((prev) => ({
      ...prev,
      consigneeGst: gst,
      consigneeDetails: master
        ? {
            companyName: master.companyName,
            gst: master.gst,
            address: master.address,
            state: master.state,
            stateCode: master.stateCode,
            phone: master.phone,
            email: master.email,
          }
        : emptyPartyDetails(),
      consigneeAddressOptionId: "",
    }));
  };

  const updateConsigneeField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      consigneeDetails: { ...prev.consigneeDetails, [field]: value },
    }));
  };

  const handleConsigneeAddressOptionChange = (addressId) => {
    const chosen = COMPANY_ADDRESSES.find((a) => a.id === addressId);
    setFormData((prev) => ({
      ...prev,
      consigneeAddressOptionId: addressId,
      consigneeDetails: chosen
        ? { ...prev.consigneeDetails, address: chosen.address }
        : prev.consigneeDetails,
    }));
  };

  /* ---- Save / load named proformas (separate from the autosaved draft) ---- */
  const saveProforma = () => {
    const proformaNo = (formData.proformaNo || "").trim();
    if (!proformaNo) {
      setSaveStatus("Enter a Proforma No before saving.");
      return;
    }
    try {
      localStorage.setItem(
        savedProformaRecordKey(proformaNo),
        JSON.stringify({ formData, items }),
      );
      const index = JSON.parse(
        localStorage.getItem(SAVED_PROFORMA_INDEX_KEY) || "[]",
      );
      if (!index.includes(proformaNo)) {
        index.push(proformaNo);
        localStorage.setItem(SAVED_PROFORMA_INDEX_KEY, JSON.stringify(index));
      }
      setSaveStatus(`Saved proforma ${proformaNo}.`);
    } catch (e) {
      console.error("Failed to save proforma", e);
      setSaveStatus("Could not save proforma.");
    }
  };

  const loadProforma = (proformaNoRaw) => {
    const proformaNo = (proformaNoRaw || "").trim();
    if (!proformaNo) {
      setSaveStatus("Enter a Proforma No to load.");
      return;
    }
    try {
      const saved = localStorage.getItem(savedProformaRecordKey(proformaNo));
      if (!saved) {
        setSaveStatus(`No saved proforma found for "${proformaNo}".`);
        return;
      }
      const parsed = JSON.parse(saved);
      // Load the saved proforma values exactly as stored -- this is the
      // user's edited data, so no GST lookup runs here.
      if (parsed.formData)
        setFormData({ ...defaultFormData, ...parsed.formData });
      if (parsed.items && parsed.items.length) setItems(parsed.items);
      setSaveStatus(`Loaded proforma ${proformaNo}.`);
    } catch (e) {
      console.error("Failed to load proforma", e);
      setSaveStatus("Could not load proforma.");
    }
  };

  const savedProformaNumbers = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_PROFORMA_INDEX_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }, [saveStatus]);

  /* ---- items handlers ---- */
  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);

  const duplicateRow = (id) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: Date.now() + Math.random() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const deleteRow = (id) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );
  };

  /* ---- calculations (identical to TaxInvoiceForm.jsx) ---- */
  const itemsWithAmount = items.map((it) => ({
    ...it,
    amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0),
  }));

  const subtotal = itemsWithAmount.reduce((sum, it) => sum + it.amount, 0);

  const cgstAmount = (subtotal * (parseFloat(formData.cgstPct) || 0)) / 100;
  const sgstAmount = (subtotal * (parseFloat(formData.sgstPct) || 0)) / 100;
  const igstAmount = (subtotal * (parseFloat(formData.igstPct) || 0)) / 100;

  const beforeRounding = subtotal + cgstAmount + sgstAmount + igstAmount;
  const grandTotalRaw = beforeRounding + (parseFloat(formData.roundedOff) || 0);
  const grandTotal = Math.round(grandTotalRaw);
  const roundedOffAuto = grandTotal - beforeRounding;

  

  const amountInWords = numberToWordsIndian(grandTotal) + " Rupees Only";

  // Everything the PDF needs comes from this object, which is built
  // entirely from live form state (formData / items / receiverDetails /
  // consigneeDetails). No Proforma-specific value is ever written directly
  // into the print engine -- see ProformaInvoicePrint.js.
  const previewData = {
    company: {
      ...COMPANY,
      worksLine1: `Works : ${selectedCompanyAddress.address}`,
      worksLine2: "",
    },
    formData,
    items: itemsWithAmount,
    // Receiver/Consignee: the current, possibly user-edited values -- never
    // the raw GST master record -- so the PDF always matches what's on screen.
    receiver: formData.receiverDetails,
    consignee: formData.consigneeDetails,
    totals: {
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundedOff: roundedOffAuto,
      grandTotal,
      amountInWords,
    },
  };

  // Opens the standalone print system (ProformaInvoicePrint.html/css/js) in
  // its own tab, handing it the exact same `previewData` this form already
  // computes -- mirrors TaxInvoiceForm.jsx's goToPrint().
  const goToPrint = async () => {
    try {
      await loadProformaInvoicePrintEngine();
      window.generateProformaInvoicePrint(previewData);
    } catch (err) {
      console.error(err);
      alert(
        "Print preview isn't available: couldn't load /ProformaInvoicePrint.js. " +
          "Make sure ProformaInvoicePrint.html, ProformaInvoicePrint.css, and " +
          "ProformaInvoicePrint.js are deployed as static files reachable at the " +
          "site root (e.g. copied into your app's public/ folder), and that " +
          "public/left.png and public/right.png exist.",
      );
    }
  };



  return (
    <>
      <Header />
      <div className="ti-form-page">
             <Link to="/accounts" className="erp-back-button">
    <ArrowLeft size={16} />
    Back
</Link> 
        <div className="ti-form-header">
          
          <div className="ti-form-header-left">
       

            <div className="ti-form-title-block">
              
              <h1 className="ti-form-title">Proforma Invoice</h1>
              <p className="ti-form-subtitle">
                Create and manage proforma invoice details
              </p>
            </div>
          </div>

          <div
            className="ti-form-invoice-io"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <input
              className="ti-form-input"
              list="ti-form-saved-proforma-numbers"
              placeholder="Proforma No to load"
              value={loadProformaNo}
              onChange={(e) => setLoadProformaNo(e.target.value)}
              style={{ width: "180px" }}
            />
            <datalist id="ti-form-saved-proforma-numbers">
              {savedProformaNumbers.map((num) => (
                <option key={num} value={num} />
              ))}
            </datalist>
            <button
              type="button"
              className="ti-form-load-btn"
              onClick={() => loadProforma(loadProformaNo)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Load Proforma
            </button>
            <button
              type="button"
              className="ti-form-save-btn"
              onClick={saveProforma}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
              }}
                      >
            Save Proforma
          </button>

          {/* Duplicated Preview Button */}
          <button
            type="button"
            className="ti-form-preview-btn"
            onClick={goToPrint}
          >
            Preview Invoice
          </button>

          {saveStatus && (
              <span
                className="ti-form-save-status"
                style={{ fontSize: "13px", color: "#555" }}
              >
                {saveStatus}
              </span>
            )}
          </div>
        </div>

        <div className="ti-form-content">
          {/* 1. Proforma Details */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">01</span>
              <h2 className="ti-form-section-title">Proforma Details</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-grid">
                <div className="ti-form-field">
                  <label className="ti-form-label">Proforma No</label>
                  <input
                    className="ti-form-input"
                    value={formData.proformaNo}
                    onChange={(e) => updateField("proformaNo", e.target.value)}
                    placeholder="e.g. PF/2026/0142"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Date</label>
                  <input
                    className="ti-form-input"
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateField("date", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Valid Until</label>
                  <input
                    className="ti-form-input"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => updateField("validUntil", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Payment Terms</label>
                  <input
                    className="ti-form-input"
                    value={formData.paymentTerms}
                    onChange={(e) =>
                      updateField("paymentTerms", e.target.value)
                    }
                    placeholder="e.g. 50% Advance, Balance Before Dispatch"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Address</label>
                  <select
                    className="ti-form-select"
                    value={selectedCompanyAddress.id}
                    onChange={(e) =>
                      updateField("companyAddressId", e.target.value)
                    }
                  >
                    {COMPANY_ADDRESSES.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label}: {address.address}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Receiver / 3. Consignee */}
          <div className="ti-form-party-grid">
            <section className="ti-form-party-card">
              <div className="ti-form-party-card-header">
                <h2 className="ti-form-party-card-title">
                  02 &nbsp; Details of Receiver (Billed To)
                </h2>
              </div>

              <div className="ti-form-party-card-body">
                <div className="ti-form-field ti-form-customer-select">
                  <label className="ti-form-label">Select GST</label>
                  <select
                    className="ti-form-select"
                    value={formData.receiverGst}
                    onChange={(e) => handleReceiverGstChange(e.target.value)}
                  >
                    <option value="">-- Select GST --</option>
                    {customers.map((c) => (
                      <option key={c.gst} value={c.gst}>
                        {c.gst} — {c.companyName}
                      </option>
                    ))}
                  </select>
                  <p
                    className="ti-form-hint"
                    style={{
                      fontSize: "12px",
                      color: "#777",
                      marginTop: "4px",
                    }}
                  >
                    GST lookup fills in defaults below — every field stays
                    editable and your edits are saved with this proforma.
                  </p>
                </div>

                {formData.receiverGst === COMPANY.gstin && (
                  <div className="ti-form-field ti-form-customer-select">
                    <label className="ti-form-label">
                      Mugil Industry — Address
                    </label>
                    <select
                      className="ti-form-select"
                      value={formData.receiverAddressOptionId}
                      onChange={(e) =>
                        handleReceiverAddressOptionChange(e.target.value)
                      }
                    >
                      <option value="">-- Keep GST-lookup address --</option>
                      {COMPANY_ADDRESSES.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label}: {address.address}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.receiverGst && (
                  <div className="ti-form-grid ti-form-grid--two">
                    <div className="ti-form-field">
                      <label className="ti-form-label">Company Name</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.companyName}
                        onChange={(e) =>
                          updateReceiverField("companyName", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">GST Number</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.gst}
                        onChange={(e) =>
                          updateReceiverField("gst", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field ti-form-field--span-2">
                      <label className="ti-form-label">Address</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.address}
                        onChange={(e) =>
                          updateReceiverField("address", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">State</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.state}
                        onChange={(e) =>
                          updateReceiverField("state", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">State Code</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.stateCode}
                        onChange={(e) =>
                          updateReceiverField("stateCode", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">Phone Number</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.phone}
                        onChange={(e) =>
                          updateReceiverField("phone", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">Email</label>
                      <input
                        className="ti-form-input"
                        value={formData.receiverDetails.email}
                        onChange={(e) =>
                          updateReceiverField("email", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="ti-form-party-card">
              <div className="ti-form-party-card-header">
                <h2 className="ti-form-party-card-title">
                  03 &nbsp; Details of Consignee (Shipped To)
                </h2>
              </div>

              <div className="ti-form-party-card-body">
                <div className="ti-form-field ti-form-customer-select">
                  <label className="ti-form-label">Select GST</label>
                  <select
                    className="ti-form-select"
                    value={formData.consigneeGst}
                    onChange={(e) => handleConsigneeGstChange(e.target.value)}
                  >
                    <option value="">-- Select GST --</option>
                    {customers.map((c) => (
                      <option key={c.gst} value={c.gst}>
                        {c.gst} — {c.companyName}
                      </option>
                    ))}
                  </select>
                  <p
                    className="ti-form-hint"
                    style={{
                      fontSize: "12px",
                      color: "#777",
                      marginTop: "4px",
                    }}
                  >
                    GST lookup fills in defaults below — every field stays
                    editable and your edits are saved with this proforma.
                  </p>
                </div>

                {formData.consigneeGst === COMPANY.gstin && (
                  <div className="ti-form-field ti-form-customer-select">
                    <label className="ti-form-label">
                      Mugil Industry — Address
                    </label>
                    <select
                      className="ti-form-select"
                      value={formData.consigneeAddressOptionId}
                      onChange={(e) =>
                        handleConsigneeAddressOptionChange(e.target.value)
                      }
                    >
                      <option value="">-- Keep GST-lookup address --</option>
                      {COMPANY_ADDRESSES.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label}: {address.address}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.consigneeGst && (
                  <div className="ti-form-grid ti-form-grid--two">
                    <div className="ti-form-field">
                      <label className="ti-form-label">Company Name</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.companyName}
                        onChange={(e) =>
                          updateConsigneeField("companyName", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">GST</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.gst}
                        onChange={(e) =>
                          updateConsigneeField("gst", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field ti-form-field--span-2">
                      <label className="ti-form-label">Address</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.address}
                        onChange={(e) =>
                          updateConsigneeField("address", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">State</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.state}
                        onChange={(e) =>
                          updateConsigneeField("state", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">State Code</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.stateCode}
                        onChange={(e) =>
                          updateConsigneeField("stateCode", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">Phone Number</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.phone}
                        onChange={(e) =>
                          updateConsigneeField("phone", e.target.value)
                        }
                      />
                    </div>

                    <div className="ti-form-field">
                      <label className="ti-form-label">Email</label>
                      <input
                        className="ti-form-input"
                        value={formData.consigneeDetails.email}
                        onChange={(e) =>
                          updateConsigneeField("email", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* 4. Reference / Order Information */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">04</span>
              <h2 className="ti-form-section-title">
                Reference / Order Information
              </h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-grid ti-form-grid--two">
                <div className="ti-form-field">
                  <label className="ti-form-label">Reference No</label>
                  <input
                    className="ti-form-input"
                    value={formData.referenceNo}
                    onChange={(e) => updateField("referenceNo", e.target.value)}
                    placeholder="e.g. REF-2026-089"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Customer PO No</label>
                  <input
                    className="ti-form-input"
                    value={formData.customerPoNo}
                    onChange={(e) =>
                      updateField("customerPoNo", e.target.value)
                    }
                    placeholder="e.g. PO/2026/315"
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">PO Date</label>
                  <input
                    className="ti-form-input"
                    type="date"
                    value={formData.poDate}
                    onChange={(e) => updateField("poDate", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Place of Supply</label>
                  <input
                    className="ti-form-input"
                    list="ti-form-known-states"
                    value={formData.placeOfSupply}
                    onChange={(e) =>
                      updateField("placeOfSupply", e.target.value)
                    }
                    placeholder="e.g. Tamil Nadu (33)"
                  />
                  <datalist id="ti-form-known-states">
                    {knownStates.map((state) => (
                      <option key={state} value={state} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Proforma Items */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">05</span>
              <h2 className="ti-form-section-title">Proforma Items</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-items-wrapper">
                <table className="ti-form-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>SL</th>
                      <th>Description of Goods</th>
                      <th style={{ width: 100 }}>HSN/SAC</th>
                      <th style={{ width: 90 }}>Quantity</th>
                      <th style={{ width: 80 }}>Unit</th>
                      <th style={{ width: 110 }}>Rate</th>
                      <th style={{ width: 120 }}>Amount</th>
                      <th style={{ width: 130 }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {itemsWithAmount.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="ti-form-item-sl">{idx + 1}</td>

                        <td>
                          <input
                            className="ti-form-item-input"
                            value={it.description}
                            onChange={(e) =>
                              updateItem(it.id, "description", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input"
                            value={it.hsn}
                            onChange={(e) =>
                              updateItem(it.id, "hsn", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input ti-form-item-number"
                            type="number"
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.id, "quantity", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input"
                            value={it.unit}
                            onChange={(e) =>
                              updateItem(it.id, "unit", e.target.value)
                            }
                            placeholder="Mtrs"
                          />
                        </td>

                        <td>
                          <input
                            className="ti-form-item-input ti-form-item-number"
                            type="number"
                            value={it.rate}
                            onChange={(e) =>
                              updateItem(it.id, "rate", e.target.value)
                            }
                          />
                        </td>

                        <td className="ti-form-item-amount">
                          ₹
                          {it.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        <td className="ti-form-row-actions">
                          <button
                            type="button"
                            className="ti-form-row-btn"
                            onClick={() => duplicateRow(it.id)}
                          >
                            Duplicate
                          </button>

                          <button
                            type="button"
                            className="ti-form-row-btn ti-form-row-btn--delete"
                            onClick={() => deleteRow(it.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="ti-form-add-row"
                onClick={addRow}
              >
                + Add Row
              </button>
            </div>
          </section>

          {/* 6. Amount Summary */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">06</span>
              <h2 className="ti-form-section-title">Amount Summary</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-summary-layout">
                <div className="ti-form-tax-grid">
                  <div className="ti-form-field">
                    <label className="ti-form-label">Subtotal</label>
                    <input
                      className="ti-form-input"
                      value={subtotal.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">CGST %</label>
                    <input
                      className="ti-form-input"
                      type="number"
                      value={formData.cgstPct}
                      onChange={(e) => updateField("cgstPct", e.target.value)}
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">CGST Amount</label>
                    <input
                      className="ti-form-input"
                      value={cgstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">SGST %</label>
                    <input
                      className="ti-form-input"
                      type="number"
                      value={formData.sgstPct}
                      onChange={(e) => updateField("sgstPct", e.target.value)}
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">SGST Amount</label>
                    <input
                      className="ti-form-input"
                      value={sgstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">IGST %</label>
                    <input
                      className="ti-form-input"
                      type="number"
                      value={formData.igstPct}
                      onChange={(e) => updateField("igstPct", e.target.value)}
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">IGST Amount</label>
                    <input
                      className="ti-form-input"
                      value={igstAmount.toFixed(2)}
                      readOnly
                    />
                  </div>

                  <div className="ti-form-field">
                    <label className="ti-form-label">Rounded Off</label>
                    <input
                      className="ti-form-input"
                      value={roundedOffAuto.toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>

                <div className="ti-form-grand-total">
                  <div className="ti-form-grand-total-header">Grand Total</div>

                  <div className="ti-form-grand-total-body">
                    <p className="ti-form-total-label">Grand Total</p>

                    <p className="ti-form-total-value">
                      ₹
                      {grandTotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>

                    <div className="ti-form-amount-words">
                      <div className="ti-form-amount-words-label">
                        Total Amount in Words
                      </div>

                      <div className="ti-form-amount-words-value">
                        {amountInWords}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 7. Bank Details */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">07</span>
              <h2 className="ti-form-section-title">Company Bank Details</h2>
            </div>

            <div className="ti-form-section-body">
              <div className="ti-form-grid">
                <div className="ti-form-field">
                  <label className="ti-form-label">Bank Name</label>
                  <input
                    className="ti-form-input"
                    value={formData.bankName}
                    onChange={(e) => updateField("bankName", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Account Number</label>
                  <input
                    className="ti-form-input"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      updateField("accountNumber", e.target.value)
                    }
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">Branch</label>
                  <input
                    className="ti-form-input"
                    value={formData.branch}
                    onChange={(e) => updateField("branch", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">IFSC</label>
                  <input
                    className="ti-form-input"
                    value={formData.ifsc}
                    onChange={(e) => updateField("ifsc", e.target.value)}
                  />
                </div>

                <div className="ti-form-field">
                  <label className="ti-form-label">PAN</label>
                  <input
                    className="ti-form-input"
                    value={COMPANY.pan}
                    readOnly
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 8. Declaration */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">08</span>
              <h2 className="ti-form-section-title">Declaration</h2>
            </div>

            <div className="ti-form-section-body">
              <textarea
                className="ti-form-textarea"
                rows={4}
                value={formData.declaration}
                onChange={(e) => updateField("declaration", e.target.value)}
              />
            </div>
          </section>

          {/* 9. Terms / Encl */}
          <section className="ti-form-section">
            <div className="ti-form-section-header">
              <span className="ti-form-section-number">09</span>
              <h2 className="ti-form-section-title">Terms / Encl</h2>
            </div>

            <div className="ti-form-section-body">
              <p className="ti-form-hint">
                Each line becomes one numbered point under &quot;Encl :&quot; on
                the PDF.
              </p>
              <textarea
                className="ti-form-textarea"
                rows={5}
                value={formData.enclosureText}
                onChange={(e) => updateField("enclosureText", e.target.value)}
              />
            </div>
          </section>

          <div className="ti-form-actions">
            <button
              type="button"
              className="ti-form-preview-btn"
              onClick={goToPrint}
            >
              Preview Invoice
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
