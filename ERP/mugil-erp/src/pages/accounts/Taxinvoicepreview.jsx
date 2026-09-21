import React from "react";
import "../../styles/print.css";
import "./TaxInvoicePreview.css";

const money = (n) =>
  "₹" +
  (n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
};

export default function TaxInvoicePreview({ data, onBack }) {
  const {
    company,
    formData,
    items,
    receiver,
    consignee,
    placeOfSupply,
    totals,
  } = data;

  return (
    <div className="doc-scene">
      <div className="doc-toolbar no-print">
        <div className="doc-toolbar__left">
          <button className="ti-btn" onClick={onBack}>
            ← Back
          </button>
        </div>
        <div className="doc-toolbar__title">Tax Invoice Preview</div>
        <div className="doc-toolbar__right">
          <button
            className="ti-btn ti-btn--primary"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <div className="doc-page ti-page">
        {/* Top strip: SSI / Title / Cell */}
        <div className="ti-topstrip">
          <div className="ti-topstrip__col">
            <div>SSI NO: {company.ssiNo}</div>
            <div>GSTIN: {company.gstin}</div>
          </div>
          <div className="ti-topstrip__col ti-topstrip__title">INVOICE</div>
          <div className="ti-topstrip__col ti-topstrip__right">
            <div>Cell: {company.cell1}</div>
            <div>{company.cell2}</div>
          </div>
        </div>

        {/* Company header */}
        <div className="ti-companyblock">
          <h1 className="ti-companyname">{company.name}</h1>
          <div className="ti-worksaddr">
            <div>{company.worksLine1}</div>
            <div>{company.worksLine2}</div>
          </div>
        </div>
        {/* Invoice meta info grid */}
        <table className="ti-meta-table">
          <tbody>
            <tr>
              <td className="ti-meta-label">Invoice No :</td>
              <td>{formData.invoiceNumber}</td>
              <td className="ti-meta-label">Vehicle No:</td>
              <td>{formData.vehicleNumber}</td>
            </tr>
            <tr>
              <td className="ti-meta-label">Date of Invoice:</td>
              <td>{fmtDate(formData.invoiceDate)}</td>
              <td className="ti-meta-label">Mode of Transport:</td>
              <td>{formData.modeOfTransport}</td>
            </tr>
            <tr>
              <td className="ti-meta-label">Date of Supply:</td>
              <td>{fmtDate(formData.dateOfSupply)}</td>
              <td className="ti-meta-label">Reverse Charge (Y/N):</td>
              <td>{formData.reverseCharge}</td>
            </tr>
            <tr>
              <td className="ti-meta-label">Place of Supply:</td>
              <td>{placeOfSupply.state}</td>
              <td className="ti-meta-label">Name &amp; Code of State :</td>
              <td>{placeOfSupply.stateNameCode || "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table className="ti-items-table">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>SL.NO</th>
              <th>Description of Goods</th>
              <th style={{ width: "10%" }}>HSN/SAC</th>
              <th style={{ width: "10%" }}>Quantity</th>
              <th style={{ width: "8%" }}>Unit</th>
              <th style={{ width: "14%" }}>Rate</th>
              <th style={{ width: "16%" }}>Amount Rs</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id}>
                <td className="ti-center">{idx + 1}</td>
                <td className="ti-desc">{it.description}</td>
                <td className="ti-center">{it.hsn}</td>
                <td className="ti-center">{it.quantity}</td>
                <td className="ti-center">{it.unit}</td>
                <td className="ti-num">
                  {it.rate ? money(parseFloat(it.rate)) : ""}
                </td>
                <td className="ti-num">{money(it.amount)}</td>
              </tr>
            ))}
            {/* filler row to give body some height like a real invoice sheet */}
            <tr className="ti-filler-row">
              <td colSpan={7}>&nbsp;</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="ti-total-label">
                Total
              </td>
              <td className="ti-num ti-total-value">
                {money(totals.subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Words + tax summary */}
        <table className="ti-summary-table">
          <tbody>
            <tr>
              <td className="ti-words-cell" rowSpan={4}>
                <div className="ti-words-label">
                  Total Invoice Amount ( in Words ):
                </div>
                <div className="ti-words-value">{totals.amountInWords}</div>
              </td>
              <td className="ti-tax-label">IGST</td>
              <td className="ti-tax-pct"></td>
              <td className="ti-tax-amt">{money(totals.igstAmount)}</td>
            </tr>
            <tr>
              <td className="ti-tax-label">CGST</td>
              <td className="ti-tax-pct">{formData.cgstPct}%</td>
              <td className="ti-tax-amt">{money(totals.cgstAmount)}</td>
            </tr>
            <tr>
              <td className="ti-tax-label">SGST</td>
              <td className="ti-tax-pct">{formData.sgstPct}%</td>
              <td className="ti-tax-amt">{money(totals.sgstAmount)}</td>
            </tr>
            <tr>
              <td className="ti-tax-label">Rounded Off</td>
              <td className="ti-tax-pct"></td>
              <td className="ti-tax-amt">{money(totals.roundedOff)}</td>
            </tr>
            <tr>
              <td className="ti-words-cell"></td>
              <td className="ti-tax-label ti-grandtotal-label" colSpan={2}>
                TOTAL
              </td>
              <td className="ti-tax-amt ti-grandtotal-value">
                {money(totals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom: declaration / enclosures  |  bank details / signature */}
        <table className="ti-bottom-table">
          <tbody>
            <tr>
              <td className="ti-bottom-left">
                <div className="ti-pan-row">
                  <span className="ti-meta-label">Company's PAN :</span>{" "}
                  {company.pan}
                </div>
                <div className="ti-decl-heading">Declaration</div>
                <div className="ti-decl-text">{formData.declaration}</div>
                <div className="ti-encl-heading">Encl :</div>
                <ol className="ti-encl-list">
                  {Object.keys(formData.enclosures)
                    .filter((k) => formData.enclosures[k])
                    .map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                </ol>
              </td>
              <td className="ti-bottom-right">
                <div className="ti-bank-heading">Company's Bank Details</div>
                <div>Bank Name: {formData.bankName}</div>
                <div>A/C No: {formData.accountNumber}</div>
                <div>Branch : {formData.branch}</div>
                <div>IFSC Code: {formData.ifsc}</div>

                <div className="ti-forcompany">For {company.name}</div>
                <div className="ti-signature-space">&nbsp;</div>
                <div className="ti-signature-label">Authorised Signature</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="ti-eyesfooter">DONATE EYES • BLOOD • ORGANS</div>
      </div>
    </div>
  );
}
