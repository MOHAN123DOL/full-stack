/* =========================================================================
   QuotationPrint.js
   -------------------------------------------------------------------------
   A completely independent print/PDF system. It does not import, extend,
   or modify QuotationForm.jsx or QuotationPreview.jsx in any way.

   PUBLIC API (called by the existing React form)
   -------------------------------------------------------------------------
     generateQuotationPrint(data, summary)

       data     - the SAME state object QuotationForm.jsx already holds
                  (the `data` passed today to <QuotationPreview data=.../>).
       summary  - optional, the SAME `summary` object produced by
                  summarizeQuoteItems(data.items, {...}) in QuotationForm.jsx.

     Nothing is hardcoded and no sample data is used — every field read
     below comes from these two arguments.

   HOW THE HAND-OFF WORKS
   -------------------------------------------------------------------------
     generateQuotationPrint() stores {data, summary} in localStorage and
     opens QuotationPrint.html in a new browser tab. That tab loads this
     same file again; this time it detects the #qp-print-app-root element
     (present only in QuotationPrint.html), reads the staged payload back
     out of localStorage, and renders the paginated document.

     Printing in a dedicated tab, rather than inside the SPA, means this
     system can never collide with the existing app's own print CSS/JS —
     it is a fully separate document from top to bottom.

   HOW PAGINATION WORKS (no character/line counting, ever)
   -------------------------------------------------------------------------
     1. Every visual chunk of the quotation (customer block, a technical
        details section, a single item row, the summary rows, etc.) is
        built as a real DOM node.
     2. Each node is mounted into an off-screen sandbox at the exact
        content width the printed page will use, and its rendered height
        is read with getBoundingClientRect() — actual browser layout,
        including text wrapping, not an estimate.
     3. Header height and footer height are measured the same way, once.
     4. availableHeight = pageHeight - topMargin - headerHeight - headerGap
                           - footerHeight - footerGap - bottomMargin
        headerGap/footerGap are only the minimum visual breathing room
        around the header/footer rules — no extra "safety" padding is
        added on top of them, so every remaining pixel goes to content.
     5. Blocks are packed onto pages GREEDILY, at the smallest granularity
        that still makes visual sense: keep adding a block to the current
        page while it still fits in the remaining height; the moment a
        block doesn't fit, start a new page and place that one block
        there. The items table is packed row-by-row (table header is
        cloned onto every continuation page); technical-detail sections
        and Terms & Conditions are packed line-by-line (one bullet/term
        per block) so a section is never moved as a whole just because
        its last line doesn't fit; the closing paragraph and the
        signature block are two separate blocks. "Keep together" is only
        ever applied to a single line/row — never to a whole section.
     6. Nothing is done to "balance" a page. Whatever space is left over
        on the last page is left over — it is never filled with an
        artificial spacer, and no page is ever started early just to
        avoid a short trailing page.
     7. Each page is rendered as its own explicitly-sized box with the
        header, content, and footer absolutely positioned inside it — the
        browser's automatic pagination is never relied on, and no
        position:fixed/negative-offset trick is used.
   ========================================================================= */

(function () {
  "use strict";

  var PAYLOAD_KEY = "qp-print-payload-v1";
  var ROOT_ID = "qp-print-app-root";

  /* ============================ PAGE GEOMETRY ============================
     All physical sizes are defined in millimetres and converted to CSS
     pixels using the standard, exact 96px-per-inch definition (96 / 25.4
     px per mm). Because this is the same definition the browser itself
     uses for both screen and @page-sized print output, page elements sized
     in these pixels come out at true A4 dimensions when printed.
     ========================================================================= */
  var MM_TO_PX = 96 / 25.4;

  var PAGE_MM = {
    width: 210,
    height: 297,
    marginTop: 12,
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 10, // physical outer margin the footer sits above
    // These two gaps are the ONLY reserved, non-content space on a page
    // besides the header/footer's own measured height and the outer page
    // margins above. They exist purely so text doesn't visually touch the
    // header rule or the footer rule — nothing more. Keep them minimal;
    // do not grow them into an artificial "safety area" that eats usable
    // content height.
    footerGap: 4, // minimum visual gap between end of body content and the footer band
    headerGap: 4, // minimum visual gap between the bottom of the header rule and body content
  };

  /* ============================ STATIC LETTERHEAD ============================
     Same rationale as QuotationPreview.jsx: the seller's letterhead is
     company-level information the form does not collect, so it lives here
     as a constant. data.companyName still overrides the printed name.
     ========================================================================= */
  var LETTERHEAD = {
    name: "Mugil Engineering Industry",
    regNo: "Udyam Reg No: UDYAM - TN - 27 - 0010156",
    gstin: "GSTIN: 33AHDPR8644K1ZX",
    address:
      "4/211, S.F. No.105, Thanjavur Main Road, Devarayanery, Assor (P.O.), Trichy - 620 015.",
    phones: ["98424-52887", "99446-51887", "89039-52887"],
    email: "mugilengg@gmail.com",
    tagline: "கண்தானம் செய்வீர்!  இரத்ததானம் செய்வீர்!!",
  };

  /* ================================ HELPERS ================================ */

  function toNumber(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function fmtINR(v) {
    var n = toNumber(v);
    var parts = n.toFixed(2).split(".");
    var intPart = parts[0].replace(/^-/, "");
    var sign = n < 0 ? "-" : "";
    // Indian digit grouping (lakh/crore): last 3 digits, then groups of 2.
    var lastThree = intPart.slice(-3);
    var rest = intPart.slice(0, -3);
    if (rest !== "") {
      lastThree = "," + lastThree;
      rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    }
    return "₹ " + sign + rest + lastThree + "." + parts[1];
  }

  function fmtDate(value) {
    if (!value) return "—";
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  }

  // Same defensive field-name lookup as QuotationPreview.jsx, since
  // OrderItemsTable / VendorDetails / TermsEditor's exact field names
  // aren't guaranteed here either.
  function pick(obj, keys, fallback) {
    if (fallback === undefined) fallback = "";
    if (!obj) return fallback;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
        return obj[k];
      }
    }
    return fallback;
  }

function getItemTotal(item) { var qty = toNumber(pick(item, ["qty", "quantity"], 0)); var rate = toNumber(pick(item,
   ["rate", "price", "unitRate"], 0)); return qty * rate; }

  function normalizeTerm(term) {
    if (term === null || term === undefined) return "";
    if (typeof term === "string") return term;
    return pick(term, ["text", "value", "label"], "");
  }

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ============================ PUBLIC ENTRY POINT ============================ */

  function generateQuotationPrint(data, summary) {
    if (!data) {
      console.error("[QuotationPrint] generateQuotationPrint() called without quotation data.");
      return;
    }
    var payload = { data: data, summary: summary || null, ts: Date.now() };
    try {
      localStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("[QuotationPrint] Could not stage quotation data for the print tab:", e);
      return;
    }
    var printTab = window.open("/QuotationPrint.html", "_blank");
    if (!printTab) {
      window.alert(
        "Your browser blocked the print preview pop-up. Please allow pop-ups for this site and try again."
      );
    }
  }

  if (typeof window !== "undefined") {
    window.generateQuotationPrint = generateQuotationPrint;
  }

  /* ============================ BOOT (print tab only) ============================
     The block below only does anything when this script is loaded from
     QuotationPrint.html (i.e. #qp-print-app-root exists in the document).
     When the SAME file is loaded by the host React app just to obtain
     window.generateQuotationPrint, this is a no-op.
     ========================================================================= */

  function readPayload() {
    var raw;
    try {
      raw = localStorage.getItem(PAYLOAD_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      localStorage.removeItem(PAYLOAD_KEY);
      return parsed;
    } catch (e) {
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    var payload = readPayload();
    if (!payload || !payload.data) {
      root.appendChild(
        el(
          "p",
          "qp-error",
          "No quotation data was found for this print preview. Please go back to the quotation form and use its " +
            '"Print / Save as PDF" action again.'
        )
      );
      return;
    }

    buildDocument(root, payload.data, payload.summary);
  });

  /* ============================ BLOCK BUILDERS ============================
     Each function returns a plain DOM node for one self-contained chunk of
     the quotation. These mirror QuotationPreview.jsx's markup/classes 1:1
     in spirit (same information, same order) under the qp- namespace.
     ========================================================================= */


function buildHeaderNode(companyName) {
  var header = el("div", "qp-header");

  /*
   * LEFT LOGO
   * The image must be placed in the public folder:
   * public/mugil-logo.png
   */
  var logoLeft = el(
    "div",
    "qp-logo",
    '<img src="/mugil-logo.png" ' +
      'alt="Mugil Engineering Industry" ' +
      'style="width:80px;height:80px;object-fit:contain;" />'
  );

  /*
   * CENTER COMPANY INFORMATION
   */
  var center = el(
    "div",
    "qp-header__center",
    "<h1>" +
      escapeHtml(companyName) +
      '</h1><p class="qp-header__meta">' +
      escapeHtml(LETTERHEAD.regNo) +
      '</p><p class="qp-header__meta">' +
      escapeHtml(LETTERHEAD.gstin) +
      "</p>"
  );

  /*
   * RIGHT LOGO
   * The image must be placed in the public folder:
   * public/mei-globe-logo.png
   */
  var logoRight = el(
    "div",
    "qp-logo qp-logo--right",
    '<img src="/globe-logo.png" ' +
      'alt="MEI" ' +
      'style="width:80px;height:80px;object-fit:contain;" />'
  );

  header.appendChild(logoLeft);
  header.appendChild(center);
  header.appendChild(logoRight);

  var wrap = el("div", "");

  /*
   * HEADER LINE
   */
  var headerRule = el("div", "qp-header-rule");

  headerRule.style.width = "100%";
  headerRule.style.height = "3px";
  headerRule.style.marginTop = "10px";
  headerRule.style.borderBottom = "3px solid #b28858";
  headerRule.style.background = "none";

  wrap.appendChild(header);
  wrap.appendChild(headerRule);

  return wrap;
}




function buildFooterNode() {
  var wrap = el("div", "");

  /* ---------------------------------------------------------------
     Footer line
     --------------------------------------------------------------- */

  var footerRule = el("div", "qp-footer-rule");

  footerRule.style.width = "100%";
  footerRule.style.height = "2px";
  footerRule.style.borderTop = "2px solid #b28858";
  footerRule.style.background = "none";

  wrap.appendChild(footerRule);

  /* ---------------------------------------------------------------
     Footer
     --------------------------------------------------------------- */

  var footer = el("div", "qp-footer");

  /* Address */
/* Address */
footer.appendChild(
  el(
    "p",
    "qp-footer__address",
    escapeHtml(LETTERHEAD.address)
  )
);

/* Second Address */
footer.appendChild(
  el(
    "p",
    "qp-footer__address",
    "S.F. No: 436 / 5A, Near B K Bharath Township, Thanjavur Main Road, Valavanthankottai, Trichy - 620015"
  )
);
  /* Contact */
  footer.appendChild(
    el(
      "p",
      "qp-footer__contact",
      "<strong>Cell :</strong> " +
        escapeHtml(LETTERHEAD.phones.join(", ")) +
        "&nbsp;&nbsp;<strong>Email :</strong> " +
        escapeHtml(LETTERHEAD.email)
    )
  );

  /* ---------------------------------------------------------------
     Tagline + donation logos
     --------------------------------------------------------------- */

  var taglineRow = el("div", "qp-footer__tagline-row");

  /* Eye donation logo - LEFT */
  var eyeLogo = el(
    "img",
    "qp-footer__logo qp-footer__logo--eye"
  );

  eyeLogo.src = "/eye-donation.png";
  eyeLogo.alt = "Eye Donation";

  /* Tagline - CENTER */
  var tagline = el(
    "p",
    "qp-footer__tagline",
    escapeHtml(LETTERHEAD.tagline)
  );

  /* Blood donation logo - RIGHT */
  var bloodLogo = el(
    "img",
    "qp-footer__logo qp-footer__logo--blood"
  );

  bloodLogo.src = "/blood-donation.png";
  bloodLogo.alt = "Blood Donation";

  taglineRow.appendChild(eyeLogo);
  taglineRow.appendChild(tagline);
  taglineRow.appendChild(bloodLogo);

  footer.appendChild(taglineRow);

  wrap.appendChild(footer);

  return wrap;
}





  function buildDocTitleNode(pageWidthPx, marginLeftPx) {
    var node = el("h2", "qp-doc-title", "QUOTATION");
    // The "QUOTATION" title must sit at the exact horizontal center of the
    // physical A4 page — not the center of the content column, which is
    // only accidentally page-centered when the left/right page margins
    // happen to be equal. To make this correct regardless of margin
    // values, widen the box to the full physical page width and cancel
    // out the content column's own left inset with a negative margin, so
    // the box spans the true page edge-to-edge and text-align:center
    // (see .qp-doc-title in the stylesheet) centers on the page itself.
    node.style.position = "relative";
    node.style.width = pageWidthPx + "px";
    node.style.marginLeft = -marginLeftPx + "px";
    node.style.marginRight = "0";
    return node;
  }


function buildMetaRowNode(data) {
  return el(
    "div",
    "qp-meta-row",
    "<div>" +
      "<p><strong>Date:</strong> " +
      escapeHtml(fmtDate(data.quotationDate)) +
      "</p>" +
      "<p><strong>Quotation No:</strong> " +
      escapeHtml(data.quotationNumber || "—") +
      "</p>" +
      "</div>"
  );
}




function buildCustomerNode(vendor) {
  var companyName = pick(vendor, ["companyName", "company", "name"]);

  // Customer GST number
  var gstNumber = pick(vendor, [
    "gst",
    "gstNumber",
    "gstNo",
    "gstin",
    "GSTNumber",
    "GSTIN"
  ]);

  // Customer address
  var addressLine1 = pick(vendor, [
    "addressLine1",
    "address1",
    "address"
  ]);

  var addressLine2 = pick(vendor, [
    "addressLine2",
    "address2"
  ]);

  var city = pick(vendor, [
    "city",
    "town"
  ]);

  var state = pick(vendor, [
    "state",
    "stateName"
  ]);

  var pincode = pick(vendor, [
    "pincode",
    "pinCode",
    "postalCode",
    "zipCode"
  ]);

  var attn = pick(vendor, [
    "attention",
    "attn",
    "contactPerson"
  ]);

  var phone = pick(vendor, [
    "phone",
    "phoneNumber",
    "mobile"
  ]);

  var email = pick(vendor, [
    "email"
  ]);

  var html = '<p class="qp-to-label"><strong>To:</strong></p>';

  if (companyName) {
    html +=
      '<p class="qp-customer__name">' +
      escapeHtml(companyName) +
      "</p>";
  }

  if (gstNumber) {
    html +=
      "<p><strong>GST:</strong> " +
      escapeHtml(gstNumber) +
      "</p>";
  }

  if (addressLine1) {
    html +=
      "<p>" +
      escapeHtml(addressLine1) +
      "</p>";
  }

  if (addressLine2) {
    html +=
      "<p>" +
      escapeHtml(addressLine2) +
      "</p>";
  }

  if (city) {
    html +=
      "<p>" +
      escapeHtml(city) +
      "</p>";
  }

  if (state || pincode) {
    html +=
      "<p>" +
      (state ? escapeHtml(state) : "") +
      (state && pincode ? " - " : "") +
      (pincode ? escapeHtml(pincode) : "") +
      "</p>";
  }

  if (attn) {
    html +=
      "<p><strong>Attn:</strong> " +
      escapeHtml(attn) +
      "</p>";
  }

  if (phone) {
    html +=
      "<p><strong>Phone:</strong> " +
      escapeHtml(phone) +
      "</p>";
  }

  if (email) {
    html +=
      "<p><strong>Email:</strong> " +
      escapeHtml(email) +
      "</p>";
  }

  return el("div", "qp-customer", html);
}



  function buildSubjectNode(subject) {
    return el("p", "qp-subject", "<strong>Subject:</strong> " + escapeHtml(subject));
  }

  function buildSalutationNode() {
    return el("p", "qp-salutation", "Dear Sir/Madam,");
  }

  function buildIntroNode(intro) {
    return el("p", "qp-intro", escapeHtml(intro));
  }

  function buildLeadInNode() {
    return el(
      "p",
      "qp-lead-in",
      "We are pleased to submit our competitive quotation as detailed below:"
    );
  }

  function buildSectionHeadingNode(text) {
    return el("h3", "qp-section-heading", escapeHtml(text));
  }

  function buildItemsTableHeaderRow() {
    var tr = el(
      "tr",
      "",
      '<th class="qp-col-sno">S.No</th>' +
        '<th class="qp-col-desc">Description of Items</th>' +
        '<th class="qp-col-size">Specification</th>' +
        '<th class="qp-col-qty">Quantity</th>' +
        '<th class="qp-col-unit">Unit</th>' +
        '<th class="qp-col-rate">Rate per Unit (₹)</th>' +
        '<th class="qp-col-total">Total (₹)</th>'
    );
    return tr;
  }

  function buildItemRow(item, idx) {
    return el(
      "tr",
      "",
      '<td class="qp-col-sno">' +
        (idx + 1) +
        '</td><td class="qp-col-desc">' +
        escapeHtml(pick(item, ["description", "name", "item"], "—")) +
        '</td><td class="qp-col-size">' +
        escapeHtml(pick(item, ["size", "sizeThickness", "thickness", "dimension"], "—")) +
        '</td><td class="qp-col-qty">' +
        escapeHtml(pick(item, ["qty", "quantity"], "—")) +
        '</td><td class="qp-col-unit">' +
        escapeHtml(pick(item, ["unit"], "—")) +
        '</td><td class="qp-col-rate">' +
        fmtINR(pick(item, ["rate", "price", "unitRate"], 0)) +
        '</td><td class="qp-col-total">' +
        fmtINR(getItemTotal(item)) +
        "</td>"
    );
  }

  function buildEmptyRow() {
    return el("tr", "", '<td class="qp-empty-row" colspan="7">No items added</td>');
  }

  function buildSummaryRows(subtotal, gstPercent, gstAmount, grandTotal) {
    var r1 = el(
      "tr",
      "",
      '<td colspan="6" class="qp-summary-label">Subtotal</td><td class="qp-summary-value">' +
        fmtINR(subtotal) +
        "</td>"
    );
    var r2 = el(
      "tr",
      "",
      '<td colspan="6" class="qp-summary-label">GST ' +
        (gstPercent !== "" && gstPercent !== undefined && gstPercent !== null
          ? "@ " + escapeHtml(gstPercent) + "%"
          : "") +
        '</td><td class="qp-summary-value">' +
        fmtINR(gstAmount) +
        "</td>"
    );
    var r3 = el(
      "tr",
      "qp-grand-total-row",
      '<td colspan="6" class="qp-summary-label">Grand Total</td><td class="qp-summary-value">' +
        fmtINR(grandTotal) +
        "</td>"
    );
    return [r1, r2, r3];
  }



  /* -------------------------------------------------------------------
     Technical details / Terms & Conditions / Closing are now built as
     many small, individually-measured line-level blocks instead of one
     big per-section block. This is what lets the packer keep 7 of 8
     lines on page 1 and move only the 8th line to page 2, rather than
     moving the whole section because it doesn't fit as a single unit.
     "break-inside: avoid" style keep-together is intentionally NOT used
     here — only a single bullet/point/term line is ever treated as
     indivisible, which is the smallest unit that still reads correctly.
     ------------------------------------------------------------------- */

  function buildTechDetailsHeadingNode() {
    return buildSectionHeadingNode("Technical Details");
  }

  function buildTechSubHeadingNode(sec, idx) {
    return el(
      "p",
      "qp-tech-heading",
      (idx + 1) + ". " + escapeHtml(sec.heading || "Untitled Section")
    );
  }

  // One bullet point per node (its own single-item <ul>) so each point is
  // an independently packable block while still rendering identically to
  // the old multi-item list (same classes, same zero inter-list margin).
  function buildTechPointNode(pt) {
    var ul = el("ul", "qp-tech-points");
    ul.appendChild(el("li", "", escapeHtml(pt)));
    return ul;
  }

  function buildTermsHeadingNode() {
    return buildSectionHeadingNode("Terms & Conditions");
  }

  // One term per node, using a single-item <ol start="n"> so the visible
  // numbering stays correct (1, 2, 3, …) even when the list is split
  // across a page boundary.
  function buildTermLineNode(text, number) {
    var ol = el("ol", "qp-terms-list");
    ol.setAttribute("start", String(number));
    ol.appendChild(el("li", "", escapeHtml(text)));
    return ol;
  }

 function buildClosingNode() {
  return el(
    "div",
    "qp-closing",
    '<p class="qp-closing-spaced">We look forward to receiving your valuable order.</p>' +
    '<p class="qp-closing-spaced">Thanking You,</p>'
  );
}

  function buildSignatureNode(companyName, signatures, designation) {
    var sigHtml =
      "<p>For " +
      escapeHtml(companyName) +
      '</p><div class="qp-signature__space"></div><p class="qp-signature__name">' +
      escapeHtml(pick(signatures, ["preparedBy"], "")) +
      "</p>";
    if (designation) sigHtml += "<p>" + escapeHtml(designation) + "</p>";
    return el("div", "qp-signature", sigHtml);
  }

  /* ============================ THE PAGINATION ENGINE ============================ */

  function buildDocument(root, data, summary) {
    var vendor = data.vendor || {};
    var items = Array.isArray(data.items) ? data.items : [];
    var technicalDetails = Array.isArray(data.technicalDetails) ? data.technicalDetails : [];
    var terms = Array.isArray(data.terms) ? data.terms : [];
    var signatures = data.signatures || {};
    var companyName = data.companyName || LETTERHEAD.name;

    // ---- totals: same fallback chain as QuotationPreview.jsx ----
    var computedSubtotal = items.reduce(function (sum, it) {
      return sum + getItemTotal(it);
    }, 0);
    var subtotal =
      (summary && (summary.subtotal !== undefined ? summary.subtotal : summary.subTotal)) ??
      computedSubtotal;
    var gstPercent = data.gstPercent !== undefined && data.gstPercent !== "" ? data.gstPercent : (summary && summary.gstPercent) ?? "";
    var gstAmount =
      (summary && summary.gstAmount !== undefined ? summary.gstAmount : undefined) ??
      (data.gstAmount !== "" && data.gstAmount !== undefined ? data.gstAmount : undefined) ??
      (gstPercent !== "" ? (toNumber(subtotal) * toNumber(gstPercent)) / 100 : 0);
    var grandTotal =
      (summary && summary.grandTotal !== undefined ? summary.grandTotal : undefined) ??
      (data.finalTotal !== "" && data.finalTotal !== undefined ? data.finalTotal : undefined) ??
      (data.grandTotal !== "" && data.grandTotal !== undefined ? data.grandTotal : undefined) ??
      toNumber(subtotal) + toNumber(gstAmount);

    // ---- toolbar (screen-only) ----
    var toolbar = el("div", "qp-toolbar");
    var status = el("span", "qp-toolbar__status", "Quotation " + escapeHtml(data.quotationNumber || ""));
    var saveBtn = el("button", "qp-btn qp-btn--save", "Save");
saveBtn.type = "button";
    var closeBtn = el("button", "qp-btn qp-btn--ghost", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", function () {
      window.close();
    });
    var printBtn = el("button", "qp-btn qp-btn--primary", "🖨 Print / Save as PDF");
    printBtn.type = "button";
    printBtn.addEventListener("click", function () {
      window.print();
    });
    toolbar.appendChild(status);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(closeBtn);
    toolbar.appendChild(printBtn);
    root.appendChild(toolbar);

    var pagesHost = el("div", "qp-pages");
    root.appendChild(pagesHost);

    // ---- geometry (px) ----
    var pageWidthPx = PAGE_MM.width * MM_TO_PX;
    var pageHeightPx = PAGE_MM.height * MM_TO_PX;
    var marginTopPx = PAGE_MM.marginTop * MM_TO_PX;
    var marginLeftPx = PAGE_MM.marginLeft * MM_TO_PX;
    var marginRightPx = PAGE_MM.marginRight * MM_TO_PX;
    var marginBottomPx = PAGE_MM.marginBottom * MM_TO_PX;
    var footerGapPx = PAGE_MM.footerGap * MM_TO_PX;
    var headerGapPx = PAGE_MM.headerGap * MM_TO_PX;
    var contentWidthPx = pageWidthPx - marginLeftPx - marginRightPx;

    // ---- measurement sandbox: off-screen, but laid out (not display:none)
    // so getBoundingClientRect() reflects real rendering. ----
    var sandbox = el("div", "");
    sandbox.style.position = "absolute";
    sandbox.style.visibility = "hidden";
    sandbox.style.pointerEvents = "none";
    sandbox.style.left = "-99999px";
    sandbox.style.top = "0";
    sandbox.style.width = contentWidthPx + "px";
    document.body.appendChild(sandbox);

    function measure(node) {
      sandbox.appendChild(node);
      // getBoundingClientRect() reports the border-box only — it does NOT
      // include the element's own margins. Two blocks stacked in normal
      // flow are separated by their margins, so the real vertical
      // footprint each block reserves on the page is border-box height +
      // marginTop + marginBottom (adjacent margins here don't collapse,
      // since every block in this stylesheet sets its own margin-top to
      // 0). Omitting the margin here caused the pagination engine to
      // under-count how much space content actually used, letting real
      // rendered output run past the computed safe area and crowd the
      // footer.
      var rect = node.getBoundingClientRect();
      var cs = window.getComputedStyle(node);
      var marginTop = parseFloat(cs.marginTop) || 0;
      var marginBottom = parseFloat(cs.marginBottom) || 0;
      var h = rect.height + marginTop + marginBottom;
      sandbox.removeChild(node);
      return h;
    }

    function measureTableChunk(rows) {
      var t = el("table", "qp-items-table");
      var tb = el("tbody");
      rows.forEach(function (r) {
        tb.appendChild(r);
      });
      t.appendChild(tb);
      var h = measure(t);
      rows.forEach(function (r) {
        tb.removeChild(r);
      });
      return h;
    }

    var headerNode = buildHeaderNode(companyName);
    var headerHeight = measure(headerNode);

    var footerNode = buildFooterNode();
    var footerHeight = measure(footerNode);

    // contentTop / footerTop mark the protected "safe" boundaries content
    // may never cross — the header-safe-space and footer-safe-space bands
    // from the required page layout. Both are computed from the *actual
    // measured* header/footer heights, not assumed constants.
    var contentTopPx = marginTopPx + headerHeight + headerGapPx;
    var footerTopPx = pageHeightPx - marginBottomPx - footerHeight - footerGapPx;
    var availableHeightPx = footerTopPx - contentTopPx;

    if (availableHeightPx < 50) {
      // Extremely small/odd content sizes could make this collapse; guard
      // against a broken layout rather than producing negative space.
      availableHeightPx = Math.max(50, availableHeightPx);
    }

    // ---- front matter blocks ----
    var frontMatter = [];
    function pushFM(node) {
      frontMatter.push({ node: node, height: measure(node) });
    }
    pushFM(buildDocTitleNode(pageWidthPx, marginLeftPx));
    pushFM(buildMetaRowNode(data));
    pushFM(buildCustomerNode(vendor));
    if (data.subject) pushFM(buildSubjectNode(data.subject));
    pushFM(buildSalutationNode());
    if (data.intro) pushFM(buildIntroNode(data.intro));
    pushFM(buildLeadInNode());
    pushFM(buildSectionHeadingNode("Quotation Details"));

    // ---- items table pieces ----
    var tableHeaderRow = buildItemsTableHeaderRow();
    var tableHeaderHeight = (function () {
      var t = el("table", "qp-items-table");
      var thead = el("thead");
      thead.appendChild(tableHeaderRow);
      t.appendChild(thead);
      var h = measure(t);
      thead.removeChild(tableHeaderRow);
      return h;
    })();

    var rowNodes = items.length
      ? items.map(function (item, idx) {
          return buildItemRow(item, idx);
        })
      : [buildEmptyRow()];
    var rowHeights = rowNodes.map(function (tr) {
      return measureTableChunk([tr]);
    });

    var summaryRows = buildSummaryRows(subtotal, gstPercent, gstAmount, grandTotal);
    var summaryHeight = measureTableChunk(summaryRows);

    // ---- after-table blocks ----
    var afterTable = [];
    function pushAT(node) {
      afterTable.push({ node: node, height: measure(node) });
    }

    // Technical details: heading once, then each sub-section's heading
    // line and every bullet point as its own packable block. If only the
    // last point of an 8-point section doesn't fit, only that point moves
    // to the next page — the rest of the section stays on page 1.
    if (technicalDetails.length) {
      pushAT(buildTechDetailsHeadingNode());
      technicalDetails.forEach(function (sec, idx) {
        pushAT(buildTechSubHeadingNode(sec, idx));
        (sec.points || []).forEach(function (pt) {
          if (pt) pushAT(buildTechPointNode(pt));
        });
      });
    }

    // Terms & Conditions: heading once, then each term as its own block,
    // numbered so it stays correct even if split across pages.
    if (terms.length) {
      pushAT(buildTermsHeadingNode());
      terms.forEach(function (term, idx) {
        var text = normalizeTerm(term);
        if (text) pushAT(buildTermLineNode(text, idx + 1));
      });
    }

    // Closing lines and the signature block are separate blocks: if the
    // closing lines fit but the signature doesn't, only the signature
    // moves to the next page.
    pushAT(buildClosingNode());
    pushAT(buildSignatureNode(companyName, signatures, data.designation));

    document.body.removeChild(sandbox);

    // ---- PACKING ----
    // pages: array of arrays of DOM nodes destined for each page's content area.
    var pages = [[]];
    var remaining = availableHeightPx;

    function packGeneric(blocks) {
      var curPage = pages[pages.length - 1];
      blocks.forEach(function (b) {
        if (curPage.length > 0 && b.height > remaining) {
          pages.push([]);
          curPage = pages[pages.length - 1];
          remaining = availableHeightPx;
        }
        curPage.push(b.node);
        remaining -= b.height;
      });
    }

    packGeneric(frontMatter);

    // ---- items table: packed row by row, header re-inserted on continuation ----
    var tableChunks = []; // { pageIndex, rows: [tr...], includeSummary }
    function openFreshTablePageIfNeeded(forceNewPage) {
      if (forceNewPage || remaining - tableHeaderHeight < 0) {
        pages.push([]);
        remaining = availableHeightPx;
      }
      remaining -= tableHeaderHeight;
    }

    openFreshTablePageIfNeeded(false);
    var curChunk = { pageIndex: pages.length - 1, rows: [], includeSummary: false };

    rowNodes.forEach(function (tr, idx) {
      var rh = rowHeights[idx];
      if (remaining - rh < 0) {
        tableChunks.push(curChunk);
        openFreshTablePageIfNeeded(true);
        curChunk = { pageIndex: pages.length - 1, rows: [], includeSummary: false };
      }
      curChunk.rows.push(tr);
      remaining -= rh;
    });

    if (remaining - summaryHeight < 0) {
      tableChunks.push(curChunk);
      openFreshTablePageIfNeeded(true);
      curChunk = { pageIndex: pages.length - 1, rows: [], includeSummary: true };
    } else {
      curChunk.includeSummary = true;
      remaining -= summaryHeight;
    }
    tableChunks.push(curChunk);

    tableChunks.forEach(function (chunk) {
      var table = el("table", "qp-items-table");
      var thead = el("thead");
      thead.appendChild(tableHeaderRow.cloneNode(true));
      table.appendChild(thead);
      var tbody = el("tbody");
      chunk.rows.forEach(function (r) {
        tbody.appendChild(r);
      });
      if (chunk.includeSummary) {
        summaryRows.forEach(function (r) {
          tbody.appendChild(r);
        });
      }
      table.appendChild(tbody);
      pages[chunk.pageIndex].push(table);
    });

    // ---- remaining after-table blocks, continuing from wherever the table left off ----
    packGeneric(afterTable);

    // No trailing spacer is inserted here on purpose. The content column
    // (.qp-content) is already given an explicit height and the footer is
    // independently positioned at the bottom of the page, so nothing is
    // needed to "push" the footer down. Any leftover space on the last
    // page is simply space that had no more content to fill it with —
    // never space that was deliberately reserved.

    // ---- render final pages ----
    pages.forEach(function (pageNodes, idx) {
      var pageEl = el("div", "qp-page");
      pageEl.style.width = pageWidthPx + "px";
      pageEl.style.height = pageHeightPx + "px";

      var headerClone = idx === 0 ? headerNode : headerNode.cloneNode(true);
      headerClone.style.position = "absolute";
      headerClone.style.top = marginTopPx + "px";
      headerClone.style.left = marginLeftPx + "px";
      headerClone.style.right = marginRightPx + "px";

      var contentWrap = el("div", "qp-content");
      contentWrap.style.position = "absolute";
      contentWrap.style.top = contentTopPx + "px";
      contentWrap.style.left = marginLeftPx + "px";
      contentWrap.style.right = marginRightPx + "px";
      contentWrap.style.height = availableHeightPx + "px";
      // Not overflow:hidden — that would silently clip/hide any block the
      // pagination engine mis-measured instead of surfacing the problem.
      // The engine above is responsible for guaranteeing every block it
      // places actually fits inside availableHeightPx; overflow stays
      // visible so nothing is ever hidden behind the footer.
      contentWrap.style.overflow = "visible";
      pageNodes.forEach(function (n) {
        contentWrap.appendChild(n);
      });

      var footerClone = idx === pages.length - 1 ? footerNode : footerNode.cloneNode(true);
      footerClone.style.position = "absolute";
      footerClone.style.left = marginLeftPx + "px";
      footerClone.style.right = marginRightPx + "px";
      footerClone.style.bottom = marginBottomPx + "px";
      footerClone.style.height = footerHeight + "px";

      pageEl.appendChild(headerClone);
      pageEl.appendChild(contentWrap);
      pageEl.appendChild(footerClone);
      pagesHost.appendChild(pageEl);
    });

    status.textContent =
      "Quotation " + (data.quotationNumber || "") + " — " + pages.length + " page" + (pages.length > 1 ? "s" : "");
  }
})();