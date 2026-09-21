import { formatINR } from "../utils/calculations";

/**
 * docType: 'po' -> full CGST/SGST/IGST + round off breakdown
 * docType: 'quote' -> simple Subtotal / GST / Grand Total
 */

export default function AmountSummary({
  mode = "form",
  docType = "po",
  summary,
  interState,
  onToggleInterState,
}) {

  /* ======================================================
     QUOTATION
  ====================================================== */

  if (docType === "quote") {
  if (mode === "print") {
    return (
      <table className="doc-summary doc-summary--boxed">
        <tbody>
          <tr>
            <td className="label">Subtotal</td>
            <td className="value">{formatINR(summary.subtotal)}</td>
          </tr>
          <tr>
            <td className="label">
              GST @ {summary.gstPercent}%
            </td>
            <td className="value">
              {formatINR(summary.gstAmount)}
            </td>
          </tr>
          <tr>
            <td className="label">Grand Total</td>
            <td className="value">
              {formatINR(summary.grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
    return (
      <div className="summary-box">

        <div className="summary-row">
          <span>Subtotal</span>
          <strong>{formatINR(summary.subtotal)}</strong>
        </div>

        <div className="summary-row">
          <span>GST @ {summary.gstPercent}%</span>
          <strong>{formatINR(summary.gstAmount)}</strong>
        </div>

        <div className="summary-row">
          <span>Grand Total</span>
          <strong>{formatINR(summary.grandTotal)}</strong>
        </div>

      </div>
    );
  }

  /* ======================================================
     PURCHASE ORDER (UNCHANGED)
  ====================================================== */

  if (mode === "print") {

    return (
      <table className="doc-summary doc-summary--boxed">
        <tbody>

          <tr>
            <td className="label">Subtotal</td>
            <td className="value">{formatINR(summary.subtotal)}</td>
          </tr>

          <tr>
            <td className="label">Discount</td>
            <td className="value">
              - {formatINR(summary.discountTotal)}
            </td>
          </tr>

          <tr>
            <td className="label">Taxable Amount</td>
            <td className="value">
              {formatINR(summary.taxableTotal)}
            </td>
          </tr>

          {interState ? (
            <tr>
              <td className="label">IGST</td>
              <td className="value">
                {formatINR(summary.igst)}
              </td>
            </tr>
          ) : (
            <>
              <tr>
                <td className="label">CGST</td>
                <td className="value">
                  {formatINR(summary.cgst)}
                </td>
              </tr>

              <tr>
                <td className="label">SGST</td>
                <td className="value">
                  {formatINR(summary.sgst)}
                </td>
              </tr>
            </>
          )}

          <tr>
            <td className="label">Round Off</td>
            <td className="value">
              {formatINR(summary.roundOff)}
            </td>
          </tr>

          <tr>
            <td className="label">
              <strong>Grand Total</strong>
            </td>

            <td className="value">
              <strong>{formatINR(summary.grandTotal)}</strong>
            </td>
          </tr>

        </tbody>
      </table>
    );
  }

  return (
    <div className="summary-box">

      <label className="summary-toggle">

        <input
          type="checkbox"
          checked={interState}
          onChange={(e) =>
            onToggleInterState(e.target.checked)
          }
        />

        Inter-state (use IGST instead of CGST/SGST)

      </label>

      <div className="summary-row">
        <span>Subtotal</span>
        <strong>{formatINR(summary.subtotal)}</strong>
      </div>

      <div className="summary-row">
        <span>Discount</span>
        <strong>- {formatINR(summary.discountTotal)}</strong>
      </div>

      <div className="summary-row">
        <span>Taxable Amount</span>
        <strong>{formatINR(summary.taxableTotal)}</strong>
      </div>

      {interState ? (
        <div className="summary-row">
          <span>IGST</span>
          <strong>{formatINR(summary.igst)}</strong>
        </div>
      ) : (
        <>
          <div className="summary-row">
            <span>CGST</span>
            <strong>{formatINR(summary.cgst)}</strong>
          </div>

          <div className="summary-row">
            <span>SGST</span>
            <strong>{formatINR(summary.sgst)}</strong>
          </div>
        </>
      )}

      <div className="summary-row">
        <span>Round Off</span>
        <strong>{formatINR(summary.roundOff)}</strong>
      </div>

      <div className="summary-row summary-row--grand">
        <span>Grand Total</span>
        <strong>{formatINR(summary.grandTotal)}</strong>
      </div>

    </div>
  );
}