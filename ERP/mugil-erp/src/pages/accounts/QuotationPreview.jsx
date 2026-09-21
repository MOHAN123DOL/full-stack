import "./QuotationPreview.css";

/* =========================================================================
   STATIC LETTERHEAD INFO
   -------------------------------------------------------------------------
   QuotationForm.jsx does not collect the seller's letterhead details
   (registration no., GSTIN, works address, phone numbers, footer tagline).
   Those belong to the company, not to an individual quotation, so they are
   kept here as constants. `data.companyName` (from the Signature section of
   the form) is still used dynamically wherever the company name is printed,
   and overrides LETTERHEAD.name when supplied.
   ========================================================================= */
const LETTERHEAD = {
  name: "Mugil Engineering Industry",
  regNo: "Udyam Reg No: UDYAM - TN - 27 - 0010156",
  gstin: "GSTIN: 33AHDPR8644K1ZX",
  address: "4/211, S.F. No.105, Thanjavur Main Road, Devarayanery, Assor (P.O.), Trichy - 620 015.",
  phones: ["98424-52887", "99446-51887", "89039-52887"],
  email: "mugilengg@gmail.com",
  tagline: "கண்தானம் செய்வீர்!  இரத்ததானம் செய்வீர்!!",
};

/* ---------------------------- helpers ---------------------------------- */

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtINR = (v) => {
  const n = toNumber(v);
  return `₹ ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Pull the first defined value out of several possible field names.
// (OrderItemsTable / VendorDetails / TermsEditor source wasn't provided,
// so field names are read defensively to stay compatible with common
// naming variants without guessing a single rigid shape.)
const pick = (obj, keys, fallback = "") => {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return fallback;
};

const getItemTotal = (item) => {
  const explicitTotal = pick(item, ["total", "amount"], null);
  if (explicitTotal !== null && explicitTotal !== "") return toNumber(explicitTotal);
  const qty = toNumber(pick(item, ["qty", "quantity"], 0));
  const rate = toNumber(pick(item, ["rate", "price", "unitRate"], 0));
  return qty * rate;
};

const normalizeTerm = (term) => {
  if (term === null || term === undefined) return "";
  if (typeof term === "string") return term;
  return pick(term, ["text", "value", "label"], "");
};

/* ============================== component =============================== */

export default function QuotationPreviewNew({ data, summary, onBack }) {
  if (!data) return null;

  const vendor = data.vendor || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const technicalDetails = Array.isArray(data.technicalDetails)
    ? data.technicalDetails
    : [];
  const terms = Array.isArray(data.terms) ? data.terms : [];
  const signatures = data.signatures || {};

  const companyName = data.companyName || LETTERHEAD.name;

  const customerCompany = pick(vendor, ["companyName", "company", "name"]);
  const customerCity = pick(vendor, ["city"]);
  const customerAddress = pick(vendor, ["address"]);
  const customerAttn = pick(vendor, ["attention", "attn", "contactPerson"]);
  const customerPhone = pick(vendor, ["phone", "phoneNumber", "mobile"]);
  const customerEmail = pick(vendor, ["email"]);

  const computedSubtotal = items.reduce((sum, it) => sum + getItemTotal(it), 0);

  const subtotal = summary?.subtotal ?? summary?.subTotal ?? computedSubtotal;
  const gstPercent = data.gstPercent ?? summary?.gstPercent ?? "";
  const gstAmount =
    summary?.gstAmount ?? (data.gstAmount !== "" ? data.gstAmount : undefined) ??
    (gstPercent !== "" ? (toNumber(subtotal) * toNumber(gstPercent)) / 100 : 0);
  const grandTotal =
    summary?.grandTotal ??
    (data.finalTotal !== "" && data.finalTotal !== undefined
      ? data.finalTotal
      : undefined) ??
    (data.grandTotal !== "" && data.grandTotal !== undefined
      ? data.grandTotal
      : undefined) ??
    toNumber(subtotal) + toNumber(gstAmount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="qpn-container">
      {/* ---------------- on-screen action bar (never printed) ---------------- */}
      <div className="qpn-actionbar print-button">
        {onBack && (
          <button type="button" className="qpn-btn qpn-btn--ghost" onClick={onBack}>
            ← Back
          </button>
        )}
        <button type="button" className="qpn-btn qpn-btn--primary" onClick={handlePrint}>
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* ---------------------------- the document ---------------------------- */}
      <div className="qpn-sheet">
        {/*
          The footer is placed FIRST in the DOM on purpose (see CSS: flex
          'order' puts it back at the bottom visually). In print, Chrome
          only starts repeating a position:fixed element from the page on
          which it would naturally occur in document flow — placing it
          after a long multi-page table meant it only started repeating
          partway through the document (missing on page 1). Putting it
          first makes it repeat from page 1 onward, on every page.
        */}
        <div className="qpn-print-footer">
          <div className="qpn-footer-rule" />
          <footer className="qpn-footer">
            <p className="qpn-footer__address">{LETTERHEAD.address}</p>
            <p className="qpn-footer__contact">
              <strong>Cell :</strong> {LETTERHEAD.phones.join(", ")}
              &nbsp;&nbsp;<strong>Email :</strong> {LETTERHEAD.email}
            </p>
            <p className="qpn-footer__tagline">{LETTERHEAD.tagline}</p>
          </footer>
        </div>

        {/*
          Repeating header trick: a <table> whose <thead> is rendered by
          the browser's print engine on every physical page the table
          spans, while <tbody> flows the real content across as many
          pages as required.
        */}
        <table className="qpn-page-table">
          <thead>
            <tr>
              <td>
                <header className="qpn-letterhead">
                  <div className="qpn-logo" aria-hidden="true">
                    <svg viewBox="0 0 64 64" width="56" height="56">
                      <path
                        d="M6 46 L18 22 L26 38 L34 14 L44 46"
                        fill="none"
                        stroke="url(#qpnGrad)"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="50" cy="16" r="5" fill="#f97316" />
                      <defs>
                        <linearGradient id="qpnGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div className="qpn-letterhead__center">
                    <h1>{companyName}</h1>
                    <p className="qpn-letterhead__meta">{LETTERHEAD.regNo}</p>
                    <p className="qpn-letterhead__meta">{LETTERHEAD.gstin}</p>
                  </div>

                  <div className="qpn-logo qpn-logo--right" aria-hidden="true">
                    <svg viewBox="0 0 64 64" width="52" height="52">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#0ea5e9" strokeWidth="4" />
                      <path
                        d="M14 32c6-10 14-14 18-14s12 4 18 14c-6 10-14 14-18 14s-12-4-18-14z"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                </header>
                <div className="qpn-header-rule" />
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <main className="qpn-body">
                  <h2 className="qpn-doc-title">QUOTATION</h2>

                  <div className="qpn-meta-row qpn-avoid-break">
                    <p>
                      <strong>Date:</strong> {fmtDate(data.quotationDate)}
                    </p>
                    <p>
                      <strong>Quotation No:</strong> {data.quotationNumber || "—"}
                    </p>
                  </div>

                  <div className="qpn-customer qpn-avoid-break">
                    <p className="qpn-to-label">
                      <strong>To:</strong>
                    </p>
                    {customerCompany && <p className="qpn-customer__name">{customerCompany}</p>}
                    {customerAddress && <p>{customerAddress}</p>}
                    {customerCity && <p>{customerCity}</p>}
                    {customerAttn && (
                      <p>
                        <strong>Attn:</strong> {customerAttn}
                      </p>
                    )}
                    {customerPhone && (
                      <p>
                        <strong>Phone:</strong> {customerPhone}
                      </p>
                    )}
                    {customerEmail && (
                      <p>
                        <strong>Email:</strong> {customerEmail}
                      </p>
                    )}
                  </div>

                  {data.subject && (
                    <p className="qpn-subject qpn-avoid-break">
                      <strong>Subject:</strong> {data.subject}
                    </p>
                  )}

                  <p className="qpn-salutation qpn-avoid-break">Dear Sir,</p>

                  {data.intro && <p className="qpn-intro qpn-avoid-break">{data.intro}</p>}

                  <p className="qpn-lead-in qpn-avoid-break">
                    We are pleased to submit our competitive quotation as detailed below:
                  </p>

                  {/* --------------------------- items table --------------------------- */}
                  <h3 className="qpn-section-heading">Quotation Details</h3>

                  <table className="qpn-items-table">
                    <thead>
                      <tr>
                        <th className="qpn-col-sno">S.No</th>
                        <th className="qpn-col-desc">Description of Items</th>
                        <th className="qpn-col-size">Size / Thickness</th>
                        <th className="qpn-col-qty">Quantity</th>
                        <th className="qpn-col-unit">Unit</th>
                        <th className="qpn-col-rate">Rate (₹)</th>
                        <th className="qpn-col-total">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="qpn-empty-row">
                            No items added
                          </td>
                        </tr>
                      )}
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="qpn-col-sno">{idx + 1}</td>
                          <td className="qpn-col-desc">
                            {pick(item, ["description", "name", "item"], "—")}
                          </td>
                          <td className="qpn-col-size">
                            {pick(item, ["size", "sizeThickness", "thickness", "dimension"], "—")}
                          </td>
                          <td className="qpn-col-qty">{pick(item, ["qty", "quantity"], "—")}</td>
                          <td className="qpn-col-unit">{pick(item, ["unit"], "—")}</td>
                          <td className="qpn-col-rate">
                            {fmtINR(pick(item, ["rate", "price", "unitRate"], 0))}
                          </td>
                          <td className="qpn-col-total">{fmtINR(getItemTotal(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} className="qpn-summary-label">
                          Subtotal
                        </td>
                        <td className="qpn-summary-value">{fmtINR(subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="qpn-summary-label">
                          GST {gstPercent !== "" ? `@ ${gstPercent}%` : ""}
                        </td>
                        <td className="qpn-summary-value">{fmtINR(gstAmount)}</td>
                      </tr>
                      <tr className="qpn-grand-total-row">
                        <td colSpan={6} className="qpn-summary-label">
                          Grand Total
                        </td>
                        <td className="qpn-summary-value">{fmtINR(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {(data.validity || data.deliveryTime) && (
                    <div className="qpn-meta-row qpn-avoid-break">
                      {data.validity && (
                        <p>
                          <strong>Validity:</strong> {data.validity}
                        </p>
                      )}
                      {data.deliveryTime && (
                        <p>
                          <strong>Delivery Time:</strong> {data.deliveryTime}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ------------------------ technical details ------------------------ */}
                  {technicalDetails.length > 0 && (
                    <section className="qpn-technical">
                      <h3 className="qpn-section-heading">Technical Details</h3>
                      {technicalDetails.map((sec, secIdx) => (
                        <div key={secIdx} className="qpn-tech-section qpn-avoid-break">
                          <p className="qpn-tech-heading">
                            {secIdx + 1}. {sec.heading || "Untitled Section"}
                          </p>
                          <ul className="qpn-tech-points">
                            {(sec.points || []).map((pt, ptIdx) =>
                              pt ? <li key={ptIdx}>{pt}</li> : null
                            )}
                          </ul>
                        </div>
                      ))}
                    </section>
                  )}

                  {/* --------------------------- payment terms --------------------------- */}
                  {data.paymentTerms && (
                    <section className="qpn-avoid-break">
                      <h3 className="qpn-section-heading">Payment Terms</h3>
                      <p className="qpn-payment-terms">{data.paymentTerms}</p>
                    </section>
                  )}

                  {/* ------------------------- terms & conditions ------------------------- */}
                  {terms.length > 0 && (
                    <section className="qpn-terms">
                      <h3 className="qpn-section-heading">Terms &amp; Conditions</h3>
                      <ol className="qpn-terms-list">
                        {terms.map((term, idx) => {
                          const text = normalizeTerm(term);
                          return text ? <li key={idx}>{text}</li> : null;
                        })}
                      </ol>
                    </section>
                  )}

                  {/* --------------------------------- notes -------------------------------- */}
                  {data.notes && (
                    <section className="qpn-avoid-break">
                      <h3 className="qpn-section-heading">Notes</h3>
                      <p className="qpn-notes">{data.notes}</p>
                    </section>
                  )}

                  {/* -------------------------------- closing -------------------------------- */}
                  <div className="qpn-closing qpn-avoid-break">
                    <p>We look forward to receiving your valuable order.</p>
                    <p>Thanking You,</p>
                  </div>

                  {/* ------------------------------- signature ------------------------------- */}
                  <div className="qpn-signature qpn-avoid-break">
                    <p>For {companyName}</p>
                    <div className="qpn-signature__space" />
                    <p className="qpn-signature__name">
                      {pick(signatures, ["preparedBy"], "")}
                    </p>
                    {data.designation && <p>{data.designation}</p>}
                  </div>
                </main>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   OPTIONAL SAMPLE DATA — for standalone testing of this component only.
   Not used automatically; import it in a test route if needed, e.g.:

     import QuotationPreviewNew, { sampleQuotationData, sampleSummary }
       from "./QuotationPreviewNew";

     <QuotationPreviewNew data={sampleQuotationData} summary={sampleSummary} />
   ========================================================================= */
export const sampleQuotationData = {
  quotationNumber: "MEI/QTN/0626-05",
  quotationDate: "2026-06-26",
  validity: "7 days from the date of issue",
  deliveryTime: "4 weeks",
  vendor: {
    companyName: "MKK METAL SECTIONS PVT LTD",
    city: "CHENNAI",
    attention: "Mr.P.JERNAUS.",
    phone: "9095388478",
    email: "mkkmarketing@mkkmetal.in",
  },
  subject: "Quotation for Manufacturing and Supply of Fabricated M.S. Longitudinal Pipes",
  intro:
    "We thank you for your valuable enquiry and are pleased to submit our quotation for the manufacturing and supply of fabricated Mild Steel Pipes as per your requirements.",
  items: [
    {
      description: "Fabricated MS Pipe",
      size: "600 MM OD X 20 MM THK - 6 Mtrs Each",
      qty: 350,
      unit: "Mtrs",
      rate: 32900,
    },
  ],
  gstPercent: 18,
  gstAmount: "",
  grandTotal: "",
  finalTotal: "",
  technicalDetails: [
    {
      heading: "Material",
      points: ["Mild Steel Plates conforming to IS 2062 Grade. Plate Thickness: 20 mm."],
    },
    {
      heading: "Pipe Specification",
      points: [
        "Type of Pipe: Fabricated Mild Steel Pipe",
        "Internal Diameter (I.D.): 540 mm",
        "Standard Pipe Length: 6.0 metres",
      ],
    },
  ],
  paymentTerms: "80% advance along with the Purchase Order and the balance 20% before dispatch of the materials.",
  terms: [
    "This quotation shall remain valid for a period of 7 days from the date of issue.",
    "The quoted price is inclusive of the cost of M.S. plates, fabrication charges, welding consumables, grinding and finishing, labour, and loading.",
    "Transportation of the finished fabricated pipes to the project site shall be charged extra.",
    "GST @ 18% shall be charged extra as applicable.",
  ],
  notes: "",
  signatures: { preparedBy: "P. Rajappa" },
  companyName: "Mugil Engineering Industry",
  designation: "Proprietor",
};

export const sampleSummary = {
  subtotal: 11515000,
  gstAmount: 2072700,
  grandTotal: 13587700,
};