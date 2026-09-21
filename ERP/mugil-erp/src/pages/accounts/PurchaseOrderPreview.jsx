import "./PurchaseOrderPreview.css";

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

  purchaseOrderPrintEnginePromise = new Promise(
    (resolve, reject) => {
      const existing = document.querySelector(
        'script[data-purchase-order-print-engine="true"]'
      );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(),
          { once: true }
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                "PurchaseOrderPrint.js failed to load"
              )
            ),
          { once: true }
        );

        return;
      }

      const script = document.createElement("script");

      script.src = "/PurchaseOrderPrint.js";
      script.async = true;
      script.dataset.purchaseOrderPrintEngine =
        "true";

      script.onload = () => resolve();

      script.onerror = () => {
        purchaseOrderPrintEnginePromise = null;

        reject(
          new Error(
            "PurchaseOrderPrint.js failed to load"
          )
        );
      };

      document.head.appendChild(script);
    }
  );

  return purchaseOrderPrintEnginePromise;
}

const handlePurchaseOrderPrint = async (
  data,
  summary,
  columns
) => {
  try {
    await loadPurchaseOrderPrintEngine();

    if (
      typeof window.generatePurchaseOrderPrint !==
      "function"
    ) {
      throw new Error(
        "Purchase Order print engine is unavailable."
      );
    }

    window.generatePurchaseOrderPrint(
      data,
      summary,
      columns
    );
  } catch (error) {
    console.error(
      "Purchase Order print system failed to load:",
      error
    );

    alert(
      "Purchase Order print system could not be loaded. Please refresh the page and try again."
    );
  }
};

export default function PurchaseOrderPreview({
  data,
  summary,
  onBack,
  columns,
}) {
  // ============================================================
  // DATE FORMAT
  // ============================================================

  const formatDateDisplay = (dateString) => {
    if (!dateString) return "—";

    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  };

  // ============================================================
  // INDIAN CURRENCY FORMAT
  // ============================================================

  const formatIndianCurrency = (amount) => {
    if (!amount) return "—";

    const num = Number(amount);

    if (isNaN(num)) return "—";

    const parts = num.toFixed(2).split(".");

    let integerPart = parts[0];

    const lastThree = integerPart.slice(-3);
    const other = integerPart.slice(0, -3);

    if (other !== "") {
      integerPart =
        other.replace(
          /\B(?=(\d{2})+(?!\d))/g,
          ","
        ) +
        "," +
        lastThree;
    } else {
      integerPart = lastThree;
    }

    return integerPart;
  };

  // ============================================================
  // DISPLAY VALUES
  // ============================================================

  const displayTotal =
    data.grandTotal || 0;

  const displayGstPercent =
    data.gstPercent || "18";

  const displayGstAmount =
    data.gstAmount || "Extra";

  const displayFinalTotal =
    data.finalTotal || "As applicable";

  return (
    <div className="purchase-order-preview">

      {/* ======================================================
          PREVIEW TOOLBAR
      ====================================================== */}

      <div className="purchase-order-preview__toolbar no-print">

        <button
          type="button"
          className="purchase-order-preview__back-button"
          onClick={onBack}
        >
          ← Back to Edit
        </button>

        <div className="purchase-order-preview__actions">

          <button
            type="button"
            className="purchase-order-preview__action-button"
            onClick={() =>
              handlePurchaseOrderPrint(
                data,
                summary,
                columns
              )
            }
          >
            Save as PDF
          </button>

          <button
            type="button"
            className="purchase-order-preview__action-button"
            onClick={() =>
              handlePurchaseOrderPrint(
                data,
                summary,
                columns
              )
            }
          >
            🖨 Print
          </button>

        </div>

      </div>

      {/* ======================================================
          PURCHASE ORDER DOCUMENT
      ====================================================== */}

      <div className="purchase-order-preview__document">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="purchase-order-preview__header">

          <div className="purchase-order-preview__company">

            <div className="purchase-order-preview__company-name">
              Mugil
              <br />
              Engineering
              <br />
              Industry
            </div>

            <div className="purchase-order-preview__company-details">
              Udyam Reg No: UDYAM-TN-27-
              <br />
              0010156&nbsp; • &nbsp;GSTIN:
              <br />
              33AHDPFR8644K1ZX
            </div>

          </div>

          <div className="purchase-order-preview__title">
            PURCHASE
            <br />
            ORDER
          </div>

          <div className="purchase-order-preview__header-meta">

            <div>
              <span>To,</span>

              <strong>
                M/s.{" "}
                {data.vendor?.companyName ||
                  "________________"}
              </strong>

              {data.vendor?.address1 && (
                <span>
                  {data.vendor.address1}
                </span>
              )}

              {data.vendor?.address2 && (
                <span>
                  {data.vendor.address2}
                </span>
              )}

              {(
                data.vendor?.city ||
                data.vendor?.state ||
                data.vendor?.pincode
              ) && (
                <span>
                  {[
                    data.vendor?.city,
                    data.vendor?.state,
                  ]
                    .filter(Boolean)
                    .join(", ")}

                  {data.vendor?.pincode
                    ? ` - ${data.vendor.pincode}`
                    : ""}
                </span>
              )}

              {data.vendor?.gst && (
                <span>
                  GST : {data.vendor.gst}
                </span>
              )}

            </div>

            <div className="purchase-order-preview__document-meta">

              <p>
                <strong>
                  Date :
                </strong>{" "}
                {formatDateDisplay(
                  data.poDate
                )}
              </p>

              <p>
                <strong>
                  PO No :
                </strong>{" "}
                {data.poNumber || "—"}
              </p>

            </div>

          </div>

        </header>

        {/* ====================================================
            HEADER DIVIDER
        ==================================================== */}

        <div className="purchase-order-preview__header-divider" />

        {/* ====================================================
            SUBJECT
        ==================================================== */}

        <section className="purchase-order-preview__subject">

          <span className="purchase-order-preview__label">
            Subject :
          </span>

          <span className="purchase-order-preview__subject-value">
            {data.subject || "—"}
          </span>

        </section>

        {/* ====================================================
            INTRODUCTION
        ==================================================== */}

        <section className="purchase-order-preview__introduction">

          <p>
            Dear Sir,
          </p>

          <p>
            With reference to your quotation{" "}

            <strong>
              {data.refQuoteNumber ||
                "________________"}
            </strong>

            {data.refDate
              ? ` dated ${formatDateDisplay(
                  data.refDate
                )}`
              : ""}

            , we are pleased to place the
            purchase order as per the below
            mentioned details.
          </p>

        </section>

        {/* ====================================================
            ORDER DETAILS
        ==================================================== */}

        <section className="purchase-order-preview__order-section">

          <h2 className="purchase-order-preview__section-title">
            Details of Order
          </h2>

          <div className="purchase-order-preview__table-wrapper">

            <table className="purchase-order-preview__table">

              <colgroup>

                <col style={{ width: "6%" }} />

                <col style={{ width: "34%" }} />

                <col style={{ width: "28%" }} />

                <col style={{ width: "10%" }} />

                <col style={{ width: "10%" }} />

                <col style={{ width: "12%" }} />

              </colgroup>

              <thead>

                <tr>

                  <th>
                    S.No
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Specification
                  </th>

                  <th>
                    Qty
                  </th>

                  <th>
                    Unit
                  </th>

                  <th>
                    Price / Unit (₹)
                  </th>

                </tr>

              </thead>

              <tbody>

                {data.items?.length ? (

                  data.items.map(
                    (item, index) => (

                      <tr
                        key={
                          item.id || index
                        }
                      >

                        <td className="purchase-order-preview__cell--center">
                          {index + 1}
                        </td>

                        <td>
                          {item.description ||
                            "-"}
                        </td>

                        <td>
                          {item.specification ||
                            "-"}
                        </td>

                        <td className="purchase-order-preview__cell--center">
                          {item.qty || "-"}
                        </td>

                        <td className="purchase-order-preview__cell--center">
                          {item.unit || "-"}
                        </td>

                        <td className="purchase-order-preview__cell--right">
                          {item.amount
                            ? formatIndianCurrency(
                                item.amount
                              )
                            : "-"}
                        </td>

                      </tr>

                    )
                  )

                ) : (

                  <tr>

                    <td
                      className="purchase-order-preview__empty-cell"
                      colSpan={6}
                    >
                      No items available
                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* ====================================================
            AMOUNT SUMMARY
        ==================================================== */}

        <section className="purchase-order-preview__summary-section">

          <div className="purchase-order-preview__summary-label">
            Amount
            <br />
            Summary:
          </div>

          <ul className="purchase-order-preview__summary-list">

            <li>

              <strong>
                Total (Excluding GST):
              </strong>{" "}

              ₹{" "}
              {formatIndianCurrency(
                displayTotal
              )}
              /-

            </li>

            <li>

              <strong>
                GST @ {displayGstPercent}%:
              </strong>{" "}

              {typeof displayGstAmount ===
              "number"
                ? `₹ ${formatIndianCurrency(
                    displayGstAmount
                  )}/-`
                : "Extra"}

            </li>

            <li>

              <strong>
                Total Amount:
              </strong>{" "}

              {typeof displayFinalTotal ===
              "number"
                ? `₹ ${formatIndianCurrency(
                    displayFinalTotal
                  )}/-`
                : "As applicable"}

            </li>

          </ul>

        </section>

        {/* ====================================================
            CLOSING
        ==================================================== */}

        <section className="purchase-order-preview__closing">

          <p>
            Kindly proceed with the execution
            of the order at the earliest.
          </p>

          <p>
            Thanking You,
          </p>

          <p>
            Yours faithfully,
          </p>

        </section>

        {/* ====================================================
            SIGNATURE
        ==================================================== */}

        <section className="purchase-order-preview__signature">

          <div className="purchase-order-preview__signature-space" />

          <strong>
            (
            {data.signatures?.preparedBy ||
              "Rajappa P"}
            )
          </strong>

          <div>
            {data.companyName ||
              "M/s. Mugil Engineering Industry"}
          </div>

          <div>
            {data.location ||
              "Trichy"}
          </div>

        </section>

      </div>

    </div>
  );
}