import { useEffect, useState } from "react";
import VendorDetails from "../../components/VendorDetails";
import OrderItemsTable from "../../components/OrderItemsTable";
import AmountSummary from "../../components/AmountSummary";
import TermsEditor from "../../components/TermsEditor";
// import QuotationPreview from "./QuotationPreview";
import { initialQuoteData } from "../../utils/initialData";
import { summarizeQuoteItems } from "../../utils/calculations";
import "./Quotation.css";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
const DRAFT_KEY = "mei-erp-quotation-draft";

// ---------------------------------------------------------------------------
// Lazy-loads the standalone print engine (QuotationPrint.js) into the page
// on first use, so no manual <script> tag needs to be added to index.html.
// Safe to call repeatedly — later calls reuse the same in-flight/loaded
// script instead of injecting it again.
// ---------------------------------------------------------------------------
let quotationPrintEnginePromise = null;
function loadQuotationPrintEngine() {
  if (typeof window.generateQuotationPrint === "function") {
    return Promise.resolve();
  }
  if (quotationPrintEnginePromise) return quotationPrintEnginePromise;

  quotationPrintEnginePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-quotation-print-engine="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("QuotationPrint.js failed to load")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "/QuotationPrint.js";
    script.async = true;
    script.dataset.quotationPrintEngine = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      quotationPrintEnginePromise = null; // allow retrying on a later click
      reject(new Error("QuotationPrint.js failed to load"));
    };
    document.head.appendChild(script);
  });

  return quotationPrintEnginePromise;
}

// Default technical sections based on the PDF
const DEFAULT_TECHNICAL_SECTIONS = [
  {
    heading: "Material",
    points: [
      "Mild Steel Plates conforming to IS 2062 Grade. Plate Thickness: 20 mm.",
    ],
  },
  {
    heading: "Pipe Specification",
    points: [
      "Type of Pipe: Fabricated Mild Steel Pipe",
      "Internal Diameter (I.D.): 540 mm",
      "Standard Pipe Length: 6.0 metres",
    ],
  },
  {
    heading: "Fabrication Scope",
    points: [
      "Procurement of M.S. plates.",
      "Cutting of plates to the required dimensions.",
      "Plate rolling to achieve the specified diameter.",
      "Full penetration welding of all circumferential joints.",
      "Grinding and finishing of weld joints.",
      "Dimensional inspection of fabricated pipes.",
    ],
  },
  {
    heading: "Fabrication Methodology",
    points: [
      "The pipes shall be fabricated at our works in transportable sections and supplied to the project site.",
      "Each 6.0-metre-long pipe shall be fabricated by welding four (4) rolled sections of 1.5 metre length each to achieve the required pipe length.",
      "All circumferential weld joints shall be fully welded, ground, and finished before dispatch.",
    ],
  },
  {
    heading: "Inspection",
    points: [
      "Visual inspection of weld joints.",
      "Dimensional inspection of fabricated pipes.",
    ],
  },
];

export default function QuotationForm() {
  const [data, setData] = useState(() => {
    const initial = initialQuoteData();
    // Set default technical details if not already set
    if (!initial.technicalDetails || initial.technicalDetails.length === 0) {
      initial.technicalDetails = DEFAULT_TECHNICAL_SECTIONS;
    }
    return initial;
  });
  const [errors, setErrors] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Ensure technical details exist
        if (!parsed.technicalDetails || parsed.technicalDetails.length === 0) {
          parsed.technicalDetails = DEFAULT_TECHNICAL_SECTIONS;
        }
        setData(parsed);
      } catch {
        // ignore corrupt draft
      }
    }
  }, []);

  const set = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const setNested = (parent, key, value) => {
  setData((d) => ({
    ...d,
    [parent]: {
      ...d[parent],
      [key]: value,
    },
  }));
};

  const quotationSubtotal = data.items.reduce((total, item) => { const qty = Number(item.qty) || 0; 
    const rate = Number(item.rate) || 0; return total + qty * rate; }, 0); 
    const quotationGstPercent = Number(data.gstPercent) || 0; 
    const quotationGstAmount = (quotationSubtotal * quotationGstPercent) / 100; 
    const quotationFinalTotal = quotationSubtotal + quotationGstAmount; 
    const summary = { subtotal: quotationSubtotal, gstPercent: quotationGstPercent, gstAmount: quotationGstAmount, grandTotal: quotationFinalTotal, };

  const validate = () => {
    const next = {};
    if (!data.quotationNumber.trim())
      next.quotationNumber = "Quotation Number is required";
    if (!data.quotationDate) next.quotationDate = "Quotation Date is required";
if (!data.vendor.companyName.trim())
  next.vendorCompany = "Customer company name is required";
    const hasItem = data.items.some(
      (it) => it.description.trim() && Number(it.qty) > 0,
    );
    if (!hasItem)
      next.items = "Add at least one item with a description and quantity";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    setSavedAt(new Date());
  };

  const clearForm = () => {
    if (!window.confirm("Clear all fields and start a new Quotation?")) return;
    localStorage.removeItem(DRAFT_KEY);
    const fresh = initialQuoteData();
    fresh.technicalDetails = DEFAULT_TECHNICAL_SECTIONS;
    setData(fresh);
    setErrors({});
    setSavedAt(null);
  };

  const goToPreview = async () => {
    if (!validate()) return;
    saveDraft();
    // Opens the new standalone print system (QuotationPrint.html/css/js) in
    // its own tab, handing it the exact same `data` and `summary` this form
    // already computes. See QuotationPrint.js for the pagination engine.
    //
    // QuotationPrint.js only defines window.generateQuotationPrint once it
    // has actually been loaded into a page. It's normally loaded inside the
    // new print tab (via QuotationPrint.html) — but on the very first click
    // it hasn't been loaded into THIS page (the form) yet either, so we lazy
    // -load it here on demand rather than requiring an <script> tag to be
    // hand-added to index.html.
    try {
      await loadQuotationPrintEngine();
      window.generateQuotationPrint(data, summary);
    } catch (err) {
      console.error(err);
      alert(
        "Print preview isn't available: couldn't load /QuotationPrint.js. " +
          "Make sure QuotationPrint.html, QuotationPrint.css, and QuotationPrint.js " +
          "are deployed as static files reachable at the site root (e.g. copied into " +
          "your app's public/ folder)."
      );
    }
  };

  // ---- Technical Details helpers ----
  const addSection = () => {
    set("technicalDetails", [
      ...data.technicalDetails,
      { heading: "", points: [""] },
    ]);
  };

  const updateSectionHeading = (idx, heading) => {
    const next = [...data.technicalDetails];
    next[idx] = { ...next[idx], heading };
    set("technicalDetails", next);
  };

  const removeSection = (idx) => {
    if (data.technicalDetails.length <= 1) {
      alert("At least one technical section is required.");
      return;
    }
    set(
      "technicalDetails",
      data.technicalDetails.filter((_, i) => i !== idx),
    );
  };

  const addPoint = (idx) => {
    const next = [...data.technicalDetails];
    next[idx] = { ...next[idx], points: [...next[idx].points, ""] };
    set("technicalDetails", next);
  };

  const updatePoint = (secIdx, pointIdx, value) => {
    const next = [...data.technicalDetails];
    const points = [...next[secIdx].points];
    points[pointIdx] = value;
    next[secIdx] = { ...next[secIdx], points };
    set("technicalDetails", next);
  };

  const removePoint = (secIdx, pointIdx) => {
    const next = [...data.technicalDetails];
    const points = next[secIdx].points;
    if (points.length <= 1) {
      alert("At least one point is required per section.");
      return;
    }
    next[secIdx] = {
      ...next[secIdx],
      points: points.filter((_, i) => i !== pointIdx),
    };
    set("technicalDetails", next);
  };

  // Reset to default technical sections
  const resetToDefaultTechnical = () => {
    if (!window.confirm("Reset technical details to default template?")) return;
    set("technicalDetails", DEFAULT_TECHNICAL_SECTIONS);
  };


  return (
    <>
      <Header />
    <div className="qt-page">
      <Link to="/accounts" className="erp-back-button">
  <ArrowLeft size={16} />
  Back
</Link>

  <div className="qt-header">

    <div className="qt-header__left">

      

      <div className="qt-title">

        <h1>Quotation</h1>

        <p>
          Fill in the details below, then preview the official document.
        </p>

      </div>

    </div>

    <div className="qt-header__actions">

      <button
        className="btn btn-ghost"
        onClick={clearForm}
      >
        Clear
      </button>

      <button
        className="btn btn-secondary"
        onClick={saveDraft}
      >
        Save Draft
      </button>

      <button
        className="btn btn-primary"
        onClick={goToPreview}
      >
        Preview →
      </button>

    </div>

  </div>

  {Object.keys(errors).length > 0 && (

    <div className="qt-alert">

      <div className="qt-alert__icon">!</div>

      <div className="qt-alert__content">

        <strong>
          Validation Required
        </strong>

        <span>
          Please fix the highlighted fields before previewing:
          {" "}
          {Object.values(errors).join(" · ")}
        </span>

      </div>

    </div>

  )}

  <section className="qt-card">

    <div className="qt-card__header">

      <div className="qt-step">
        01
      </div>

      <div className="qt-card__heading">

        <h3>
          Quotation Details
        </h3>

        <p>
          Basic quotation information
        </p>

      </div>

    </div>

    <div className="qt-grid">

      <label className="qt-field">

        <span className="qt-label">
          Quotation Number
          <span className="qt-required">*</span>
        </span>

        <input
          className={`qt-input ${
            errors.quotationNumber ? "qt-input--error" : ""
          }`}
          value={data.quotationNumber}
          onChange={(e) => set("quotationNumber", e.target.value)}
          placeholder="e.g. MEI/QTN/0626-05"
        />

      </label>

      <label className="qt-field">

        <span className="qt-label">
          Quotation Date
          <span className="qt-required">*</span>
        </span>

        <input
          type="date"
          className={`qt-input ${
            errors.quotationDate ? "qt-input--error" : ""
          }`}
          value={data.quotationDate}
          onChange={(e) => set("quotationDate", e.target.value)}
        />

      </label>


            </div>

    </section>

    {/* Customer Details */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          02
        </div>

        <div className="qt-card__heading">

          <h3>
            Customer Details
          </h3>

          <p>
            Customer / Company information
          </p>

        </div>

      </div>

      <VendorDetails
  mode="form"
  vendor={data.vendor}
  onChange={(value) => set("vendor", value)}
  heading=""
/>

    </section>

    {/* Intro */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          03
        </div>

        <div className="qt-card__heading">

          <h3>
            Introduction
          </h3>

          <p>
            Opening paragraph shown in the quotation
          </p>

        </div>

      </div>

     
<label className="qt-field qt-field--full">

  <span className="qt-label">
    Subject
  </span>

  <input
    type="text"
    className="qt-input"
    value={data.subject || ""}
    onChange={(e) => set("subject", e.target.value)}
    placeholder="Enter quotation subject..."
  />

</label>

<label className="qt-field qt-field--full">

  <span className="qt-label">
    Intro Paragraph
  </span>

  <textarea
    className="qt-textarea"
    rows={5}
    value={data.intro}
    onChange={(e) => set("intro", e.target.value)}
    placeholder="Enter introduction..."
  />

</label>
```


    </section>

    {/* Quotation Items */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          04
        </div>

        <div className="qt-card__heading">

          <h3>
            Quotation Items
          </h3>

          <p>
            Products and pricing
          </p>

        </div>

      </div>

      
<OrderItemsTable
  variant="quote"
  mode="form"
  items={data.items}
  onChange={(items) => set("items", items)}
/>



    </section>

    {/* Amount Summary */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          05
        </div>

        <div className="qt-card__heading">

          <h3>
            Amount Summary
          </h3>

          <p>
            Overall quotation value
          </p>

        </div>

      </div>


<div className="qt-grid">

  <label className="qt-field">

    <span className="qt-label">
      Total Amount (₹)
    </span>

    <input
      type="number"
      className="qt-input"
      value={quotationSubtotal.toFixed(2)}
      readOnly
    />

  </label>

  <label className="qt-field">

    <span className="qt-label">
      GST %
    </span>

    <input
      type="number"
      className="qt-input"
      value={data.gstPercent || ""}
      onChange={(e) => set("gstPercent", e.target.value)}
      placeholder="18"
      min="0"
    />

  </label>

  <label className="qt-field">

    <span className="qt-label">
      GST Amount (₹)
    </span>

    <input
      type="number"
      className="qt-input"
      value={quotationGstAmount.toFixed(2)}
      readOnly
    />

  </label>

  <label className="qt-field">

    <span className="qt-label">
      Final Total (₹)
    </span>

    <input
      type="number"
      className="qt-input"
      value={quotationFinalTotal.toFixed(2)}
      readOnly
    />

  </label>

</div>



    </section>

    {/* Technical Details */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          06
        </div>

        <div className="qt-card__heading">

          <h3>
            Technical Details
          </h3>

          <p>
            Product specifications and fabrication scope
          </p>

        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={resetToDefaultTechnical}
        >
          ↻ Reset to Default
        </button>

      </div>

      {data.technicalDetails.map((sec, secIdx) => (

        <div
          key={secIdx}
          className="qt-tech-card"
        >

          <div className="qt-tech-header">

            <label className="qt-field qt-field--grow">

              <span className="qt-label">
                Section Heading
              </span>

              <input
                className="qt-input qt-input--bold"
                value={sec.heading}
                onChange={(e) =>
                  updateSectionHeading(secIdx, e.target.value)
                }
                placeholder="Section Heading"
              />

            </label>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => removeSection(secIdx)}
            >
              Remove Section
            </button>

          </div>

          <div className="qt-tech-points">

            {sec.points.map((pt, ptIdx) => (

              <div
                key={ptIdx}
                className="qt-tech-point"
              >

                <span className="qt-tech-index">
                  {ptIdx + 1}
                </span>

                <input
                  className="qt-input"
                  value={pt}
                  onChange={(e) =>
                    updatePoint(secIdx, ptIdx, e.target.value)
                  }
                  placeholder="Enter point"
                />

                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() =>
                    removePoint(secIdx, ptIdx)
                  }
                >
                  ✕
                </button>

              </div>

            ))}

          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => addPoint(secIdx)}
          >
            + Add Point
          </button>

        </div>

      ))}

      <button
        type="button"
        className="btn btn-primary"
        onClick={addSection}
      >
        + Add Section
      </button>

    </section>



    {/* Terms & Conditions */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          07
        </div>

        <div className="qt-card__heading">

          <h3>
            Terms & Conditions
          </h3>

        </div>

      </div>

      <TermsEditor
        mode="form"
        terms={data.terms}
        onChange={(terms) => set("terms", terms)}
      />

    </section>



    {/* Signature */}

    <section className="qt-card">

      <div className="qt-card__header">

        <div className="qt-step">
          08
        </div>

        <div className="qt-card__heading">

          <h3>
            Signature Details
          </h3>

        </div>

      </div>

      <div className="qt-grid">

        <label className="qt-field">

          <span className="qt-label">
            Prepared By
          </span>

          <input
            className="qt-input"
            value={data.signatures.preparedBy}
            onChange={(e) =>
              setNested("signatures", "preparedBy", e.target.value)
            }
          />

        </label>

        <label className="qt-field">

          <span className="qt-label">
            Company Name
          </span>

          <input
            className="qt-input"
            value={data.companyName}
            onChange={(e) =>
              set("companyName", e.target.value)
            }
          />

        </label>

        <label className="qt-field">

          <span className="qt-label">
            Designation
          </span>

          <input
            className="qt-input"
            value={data.designation}
            onChange={(e) =>
              set("designation", e.target.value)
            }
          />

        </label>

      </div>

    </section>

    <div className="qt-footer-actions">

      <div className="qt-footer-status">
        {savedAt && (
          <span>
            Draft saved
          </span>
        )}
      </div>

      <div className="qt-footer-buttons">

        <button
          className="btn btn-secondary"
          onClick={saveDraft}
        >
          Save Draft
        </button>

        <button
          className="btn btn-primary"
          onClick={goToPreview}
        >
          Preview →
        </button>

      </div>

    </div>

  </div>
  </>
  );
}