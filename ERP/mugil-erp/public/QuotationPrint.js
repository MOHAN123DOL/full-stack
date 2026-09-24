/* =========================================================================
   QuotationPrint.js
   -------------------------------------------------------------------------
   Standalone Quotation print / PDF system — mirror of PurchaseOrderPrint.js.

   PUBLIC API
   -------------------------------------------------------------------------
     generateQuotationPrint(data, summary, columns)

   PDF SAVE + STATUS CONFIRM
   -------------------------------------------------------------------------
     On "🖨 Print / Save as PDF" (and "Save"):
       1. Render .qp-pages → PDF blob via html2pdf.js (lazy-loaded).
       2. Download the PDF locally.
       3. POST the same blob to:
             /api/erp/quotations/<quotationNumber>/confirm/
          which stores it under MEDIA/quotations/ and flips the Quotation
          status from DRAFT/PREVIEWED to CONFIRMED.
       4. Toolbar status text reflects the confirmed state.

   AUTHENTICATION
   -------------------------------------------------------------------------
     HttpOnly refresh cookie + csrftoken cookie (same as PurchaseOrderPrint.js).
   ========================================================================= */

(function () {
  "use strict";

  var PAYLOAD_KEY = "qp-print-payload-v1";
  var ROOT_ID = "qp-print-app-root";

  /* =======================================================================
     PDF / CONFIRM CONFIG
     ======================================================================= */

  var CONFIRM_URL_TEMPLATE =
    "/api/erp/quotations/{quotationNumber}/confirm/";

  var HTML2PDF_CDN =
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

  var html2pdfLoadingPromise = null;

  /* ============================ PAGE GEOMETRY ============================ */

  var MM_TO_PX = 96 / 25.4;

  var PAGE_MM = {
    width: 210,
    height: 297,
    marginTop: 12,
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 10,
    footerGap: 4,
    headerGap: 4,
  };

  /* ============================ STATIC LETTERHEAD ============================ */

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

  function getItemTotal(item) {
    var qty = toNumber(pick(item, ["qty", "quantity"], 0));
    var rate = toNumber(pick(item, ["rate", "price", "unitRate"], 0));
    return qty * rate;
  }

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
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  /* =======================================================================
     CSRF COOKIE READER
     ======================================================================= */

  function readCookie(name) {
    var match = document.cookie.match(
      new RegExp("(^|;\\s*)" + name + "=([^;]*)"),
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  /* =======================================================================
     HTML2PDF LAZY LOADER
     ======================================================================= */

  function loadHtml2Pdf() {
    if (typeof window.html2pdf === "function") {
      return Promise.resolve(window.html2pdf);
    }

    if (html2pdfLoadingPromise) {
      return html2pdfLoadingPromise;
    }

    html2pdfLoadingPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");

      script.src = HTML2PDF_CDN;
      script.async = true;

      script.onload = function () {
        if (typeof window.html2pdf === "function") {
          resolve(window.html2pdf);
        } else {
          html2pdfLoadingPromise = null;
          reject(new Error("html2pdf did not register on window."));
        }
      };

      script.onerror = function () {
        html2pdfLoadingPromise = null;
        reject(new Error("html2pdf.js failed to load."));
      };

      document.head.appendChild(script);
    });

    return html2pdfLoadingPromise;
  }

  /* =======================================================================
     PDF BUILDER
     ======================================================================= */

  function buildPdfBlob(pagesHost, filename) {
    return loadHtml2Pdf().then(function (html2pdf) {
      if (!pagesHost) {
        throw new Error(
          "PDF generation failed: pages host element was not found.",
        );
      }

      var options = {
        margin: 0,
        filename: filename || "quotation.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["css", "legacy"] },
      };

      var worker = html2pdf().set(options).from(pagesHost);

      return worker.toPdf().get("pdf").then(function () {
        return worker.outputPdf("blob");
      });
    });
  }

  /* =======================================================================
     CONFIRM API CALL (cookie + CSRF)
     ======================================================================= */

  function postPdfToBackend(quotationNumber, pdfBlob, filename) {
    if (!quotationNumber) {
      return Promise.reject(
        new Error("Cannot confirm: Quotation number is missing."),
      );
    }

    if (!pdfBlob) {
      return Promise.reject(
        new Error("Cannot confirm: PDF blob is missing."),
      );
    }

    var url = CONFIRM_URL_TEMPLATE.replace(
      "{quotationNumber}",
      encodeURIComponent(quotationNumber),
    );

    var formData = new FormData();
    formData.append("pdf", pdfBlob, filename || quotationNumber + ".pdf");

    var csrfToken = readCookie("csrftoken");

    if (!csrfToken) {
      console.warn(
        "[QuotationPrint] CSRF token was not found in document.cookie.",
      );
    }

    return fetch(url, {
      method: "POST",
      headers: csrfToken ? { "X-CSRFToken": csrfToken } : {},
      body: formData,
      credentials: "include",
    })
      .catch(function (networkError) {
        throw new Error(
          "Network error while confirming the Quotation: " +
            (networkError && networkError.message
              ? networkError.message
              : "unknown error"),
        );
      })
      .then(async function (response) {
        var contentType =
          response.headers.get("content-type") || "";
        var body;

        if (contentType.includes("application/json")) {
          body = await response.json();
        } else {
          body = await response.text();
        }

        if (!response.ok) {
          var message = "";

          if (typeof body === "object" && body !== null) {
            message =
              body.message || body.detail || JSON.stringify(body);
          } else {
            message = body || "Server rejected the PDF upload.";
          }

          throw new Error("HTTP " + response.status + ": " + message);
        }

        return body;
      });
  }

  /* ============================ PUBLIC ENTRY POINT ============================ */

  function generateQuotationPrint(data, summary, columns) {
    if (!data) {
      console.error(
        "[QuotationPrint] generateQuotationPrint() called without quotation data.",
      );
      return;
    }

    var payload = {
      data: data,
      summary: summary || null,
      columns: Array.isArray(columns) ? columns : [],
      ts: Date.now(),
    };

    try {
      localStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error(
        "[QuotationPrint] Could not stage quotation data for the print tab:",
        e,
      );
      return;
    }

    var printTab = window.open("/QuotationPrint.html", "_blank");

    if (!printTab) {
      console.error(
        "[QuotationPrint] Pop-up was blocked by the browser.",
      );
      window.alert(
        "Your browser blocked the Quotation print preview pop-up. Please allow pop-ups for this site and try again.",
      );
    }
  }

  if (typeof window !== "undefined") {
    window.generateQuotationPrint = generateQuotationPrint;
  }

  /* ============================ BOOT (print tab only) ============================ */

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
            '"Print / Save as PDF" action again.',
        ),
      );
      return;
    }

    buildDocument(
      root,
      payload.data,
      payload.summary,
      payload.columns,
    );
  });

  /* ============================ BLOCK BUILDERS ============================ */

  function buildHeaderNode(companyName) {
    var header = el("div", "qp-header");

    var logoLeft = el(
      "div",
      "qp-logo",
      '<img src="/mugil-logo.png" ' +
        'alt="Mugil Engineering Industry" ' +
        'style="width:80px;height:80px;object-fit:contain;" />',
    );

    var center = el(
      "div",
      "qp-header__center",
      "<h1>" +
        escapeHtml(companyName) +
        '</h1><p class="qp-header__meta">' +
        escapeHtml(LETTERHEAD.regNo) +
        '</p><p class="qp-header__meta">' +
        escapeHtml(LETTERHEAD.gstin) +
        "</p>",
    );

    var logoRight = el(
      "div",
      "qp-logo qp-logo--right",
      '<img src="/globe-logo.png" ' +
        'alt="MEI" ' +
        'style="width:80px;height:80px;object-fit:contain;" />',
    );

    header.appendChild(logoLeft);
    header.appendChild(center);
    header.appendChild(logoRight);

    var wrap = el("div", "");

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

    var footerRule = el("div", "qp-footer-rule");
    footerRule.style.width = "100%";
    footerRule.style.height = "2px";
    footerRule.style.borderTop = "2px solid #b28858";
    footerRule.style.background = "none";

    wrap.appendChild(footerRule);

    var footer = el("div", "qp-footer");

    footer.appendChild(
      el(
        "p",
        "qp-footer__address",
        escapeHtml(LETTERHEAD.address),
      ),
    );

    footer.appendChild(
      el(
        "p",
        "qp-footer__address",
        "S.F. No: 436 / 5A, Near B K Bharath Township, Thanjavur Main Road, Valavanthankottai, Trichy - 620015",
      ),
    );

    footer.appendChild(
      el(
        "p",
        "qp-footer__contact",
        "<strong>Cell :</strong> " +
          escapeHtml(LETTERHEAD.phones.join(", ")) +
          "&nbsp;&nbsp;<strong>Email :</strong> " +
          escapeHtml(LETTERHEAD.email),
      ),
    );

    var taglineRow = el("div", "qp-footer__tagline-row");

    var eyeLogo = el(
      "img",
      "qp-footer__logo qp-footer__logo--eye",
    );
    eyeLogo.src = "/eye-donation.png";
    eyeLogo.alt = "Eye Donation";

    var tagline = el(
      "p",
      "qp-footer__tagline",
      escapeHtml(LETTERHEAD.tagline),
    );

    var bloodLogo = el(
      "img",
      "qp-footer__logo qp-footer__logo--blood",
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
        "</div>",
    );
  }

  function buildCustomerNode(vendor) {
    var companyName = pick(vendor, ["companyName", "company", "name"]);

    var gstNumber = pick(vendor, [
      "gst",
      "gstNumber",
      "gstNo",
      "gstin",
      "GSTNumber",
      "GSTIN",
    ]);

    var addressLine1 = pick(vendor, [
      "addressLine1",
      "address1",
      "address",
    ]);

    var addressLine2 = pick(vendor, [
      "addressLine2",
      "address2",
    ]);

    var city = pick(vendor, ["city", "town"]);
    var state = pick(vendor, ["state", "stateName"]);

    var pincode = pick(vendor, [
      "pincode",
      "pinCode",
      "postalCode",
      "zipCode",
    ]);

    var attn = pick(vendor, [
      "attention",
      "attn",
      "contactPerson",
    ]);

    var phone = pick(vendor, [
      "phone",
      "phoneNumber",
      "mobile",
    ]);

    var email = pick(vendor, ["email"]);

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
      html += "<p>" + escapeHtml(addressLine1) + "</p>";
    }

    if (addressLine2) {
      html += "<p>" + escapeHtml(addressLine2) + "</p>";
    }

    if (city) {
      html += "<p>" + escapeHtml(city) + "</p>";
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
    return el(
      "p",
      "qp-subject",
      "<strong>Subject:</strong> " + escapeHtml(subject),
    );
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
      "We are pleased to submit our competitive quotation as detailed below:",
    );
  }

  function buildSectionHeadingNode(text) {
    return el("h3", "qp-section-heading", escapeHtml(text));
  }

  function buildItemsTableHeaderRow() {
    return el(
      "tr",
      "",
      '<th class="qp-col-sno">S.No</th>' +
        '<th class="qp-col-desc">Description of Items</th>' +
        '<th class="qp-col-size">Specification</th>' +
        '<th class="qp-col-qty">Quantity</th>' +
        '<th class="qp-col-unit">Unit</th>' +
        '<th class="qp-col-rate">Rate per Unit (₹)</th>' +
        '<th class="qp-col-total">Total (₹)</th>',
    );
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
        escapeHtml(
          pick(
            item,
            ["size", "sizeThickness", "thickness", "dimension"],
            "—",
          ),
        ) +
        '</td><td class="qp-col-qty">' +
        escapeHtml(pick(item, ["qty", "quantity"], "—")) +
        '</td><td class="qp-col-unit">' +
        escapeHtml(pick(item, ["unit"], "—")) +
        '</td><td class="qp-col-rate">' +
        fmtINR(pick(item, ["rate", "price", "unitRate"], 0)) +
        '</td><td class="qp-col-total">' +
        fmtINR(getItemTotal(item)) +
        "</td>",
    );
  }

  function buildEmptyRow() {
    return el(
      "tr",
      "",
      '<td class="qp-empty-row" colspan="7">No items added</td>',
    );
  }

  function buildSummaryRows(
    subtotal,
    gstPercent,
    gstAmount,
    grandTotal,
  ) {
    var r1 = el(
      "tr",
      "",
      '<td colspan="6" class="qp-summary-label">Subtotal</td><td class="qp-summary-value">' +
        fmtINR(subtotal) +
        "</td>",
    );

    var r2 = el(
      "tr",
      "",
      '<td colspan="6" class="qp-summary-label">GST ' +
        (gstPercent !== "" &&
        gstPercent !== undefined &&
        gstPercent !== null
          ? "@ " + escapeHtml(gstPercent) + "%"
          : "") +
        '</td><td class="qp-summary-value">' +
        fmtINR(gstAmount) +
        "</td>",
    );

    var r3 = el(
      "tr",
      "qp-grand-total-row",
      '<td colspan="6" class="qp-summary-label">Grand Total</td><td class="qp-summary-value">' +
        fmtINR(grandTotal) +
        "</td>",
    );

    return [r1, r2, r3];
  }

  function buildTechDetailsHeadingNode() {
    return buildSectionHeadingNode("Technical Details");
  }

  function buildTechSubHeadingNode(sec, idx) {
    return el(
      "p",
      "qp-tech-heading",
      idx + 1 + ". " + escapeHtml(sec.heading || "Untitled Section"),
    );
  }

  function buildTechPointNode(pt) {
    var ul = el("ul", "qp-tech-points");
    ul.appendChild(el("li", "", escapeHtml(pt)));
    return ul;
  }

  function buildTermsHeadingNode() {
    return buildSectionHeadingNode("Terms & Conditions");
  }

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
        '<p class="qp-closing-spaced">Thanking You,</p>',
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

  function buildDocument(root, data, summary, columns) {
    var vendor = data.vendor || {};
    var items = Array.isArray(data.items) ? data.items : [];
    var technicalDetails = Array.isArray(data.technicalDetails)
      ? data.technicalDetails
      : [];
    var terms = Array.isArray(data.terms) ? data.terms : [];
    var signatures = data.signatures || {};
    var companyName = data.companyName || LETTERHEAD.name;

    /* ---- totals ---- */
    var computedSubtotal = items.reduce(function (sum, it) {
      return sum + getItemTotal(it);
    }, 0);

    var subtotal =
      summary &&
      (summary.subtotal !== undefined
        ? summary.subtotal
        : summary.subTotal);

    if (subtotal === undefined || subtotal === null) {
      subtotal = computedSubtotal;
    }

    var gstPercent =
      data.gstPercent !== undefined && data.gstPercent !== ""
        ? data.gstPercent
        : summary && summary.gstPercent != null
          ? summary.gstPercent
          : "";

    var gstAmount =
      summary && summary.gstAmount !== undefined
        ? summary.gstAmount
        : data.gstAmount !== "" && data.gstAmount !== undefined
          ? data.gstAmount
          : gstPercent !== ""
            ? (toNumber(subtotal) * toNumber(gstPercent)) / 100
            : 0;

    var grandTotal =
      summary && summary.grandTotal !== undefined
        ? summary.grandTotal
        : data.finalTotal !== "" && data.finalTotal !== undefined
          ? data.finalTotal
          : data.grandTotal !== "" && data.grandTotal !== undefined
            ? data.grandTotal
            : toNumber(subtotal) + toNumber(gstAmount);

    /* ===================================================================
       TOOLBAR
       =================================================================== */

    var toolbar = el("div", "qp-toolbar");

    var status = el(
      "span",
      "qp-toolbar__status",
      "Quotation " + escapeHtml(data.quotationNumber || ""),
    );

    var saveBtn = el("button", "qp-btn qp-btn--save", "Save");
    saveBtn.type = "button";

    var closeBtn = el("button", "qp-btn qp-btn--ghost", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", function () {
      window.close();
    });

    var printBtn = el(
      "button",
      "qp-btn qp-btn--primary",
      "🖨 Print / Save as PDF",
    );
    printBtn.type = "button";

    toolbar.appendChild(status);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(closeBtn);
    toolbar.appendChild(printBtn);

    root.appendChild(toolbar);

    /* ===================================================================
       PAGE HOST
       =================================================================== */

    var pagesHost = el("div", "qp-pages");
    root.appendChild(pagesHost);

    /* ===================================================================
       GEOMETRY
       =================================================================== */

    var pageWidthPx = PAGE_MM.width * MM_TO_PX;
    var pageHeightPx = PAGE_MM.height * MM_TO_PX;
    var marginTopPx = PAGE_MM.marginTop * MM_TO_PX;
    var marginLeftPx = PAGE_MM.marginLeft * MM_TO_PX;
    var marginRightPx = PAGE_MM.marginRight * MM_TO_PX;
    var marginBottomPx = PAGE_MM.marginBottom * MM_TO_PX;
    var footerGapPx = PAGE_MM.footerGap * MM_TO_PX;
    var headerGapPx = PAGE_MM.headerGap * MM_TO_PX;
    var contentWidthPx = pageWidthPx - marginLeftPx - marginRightPx;

    /* ===================================================================
       MEASUREMENT SANDBOX
       =================================================================== */

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

    var contentTopPx = marginTopPx + headerHeight + headerGapPx;
    var footerTopPx =
      pageHeightPx - marginBottomPx - footerHeight - footerGapPx;
    var availableHeightPx = footerTopPx - contentTopPx;

    if (availableHeightPx < 50) {
      availableHeightPx = Math.max(50, availableHeightPx);
    }

    /* ===================================================================
       FRONT MATTER
       =================================================================== */

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

    /* ===================================================================
       ITEMS TABLE
       =================================================================== */

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

    var summaryRows = buildSummaryRows(
      subtotal,
      gstPercent,
      gstAmount,
      grandTotal,
    );

    var summaryHeight = measureTableChunk(summaryRows);

    /* ===================================================================
       AFTER-TABLE BLOCKS
       =================================================================== */

    var afterTable = [];

    function pushAT(node) {
      afterTable.push({ node: node, height: measure(node) });
    }

    if (technicalDetails.length) {
      pushAT(buildTechDetailsHeadingNode());

      technicalDetails.forEach(function (sec, idx) {
        pushAT(buildTechSubHeadingNode(sec, idx));

        (sec.points || []).forEach(function (pt) {
          if (pt) pushAT(buildTechPointNode(pt));
        });
      });
    }

    if (terms.length) {
      pushAT(buildTermsHeadingNode());

      terms.forEach(function (term, idx) {
        var text = normalizeTerm(term);
        if (text) pushAT(buildTermLineNode(text, idx + 1));
      });
    }

    pushAT(buildClosingNode());

    pushAT(
      buildSignatureNode(
        companyName,
        signatures,
        data.designation,
      ),
    );

    document.body.removeChild(sandbox);

    /* ===================================================================
       PACKING
       =================================================================== */

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

    var tableChunks = [];

    function openFreshTablePageIfNeeded(forceNewPage) {
      if (forceNewPage || remaining - tableHeaderHeight < 0) {
        pages.push([]);
        remaining = availableHeightPx;
      }

      remaining -= tableHeaderHeight;
    }

    openFreshTablePageIfNeeded(false);

    var curChunk = {
      pageIndex: pages.length - 1,
      rows: [],
      includeSummary: false,
    };

    rowNodes.forEach(function (tr, idx) {
      var rh = rowHeights[idx];

      if (remaining - rh < 0) {
        tableChunks.push(curChunk);
        openFreshTablePageIfNeeded(true);

        curChunk = {
          pageIndex: pages.length - 1,
          rows: [],
          includeSummary: false,
        };
      }

      curChunk.rows.push(tr);
      remaining -= rh;
    });

    if (remaining - summaryHeight < 0) {
      tableChunks.push(curChunk);
      openFreshTablePageIfNeeded(true);

      curChunk = {
        pageIndex: pages.length - 1,
        rows: [],
        includeSummary: true,
      };
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

    packGeneric(afterTable);

    /* ===================================================================
       RENDER EXPLICIT A4 PAGES
       =================================================================== */

    pages.forEach(function (pageNodes, idx) {
      var pageEl = el("div", "qp-page");
      pageEl.style.width = pageWidthPx + "px";
      pageEl.style.height = pageHeightPx + "px";

      var headerClone =
        idx === 0 ? headerNode : headerNode.cloneNode(true);
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
      contentWrap.style.overflow = "visible";

      pageNodes.forEach(function (n) {
        contentWrap.appendChild(n);
      });

      var footerClone =
        idx === pages.length - 1
          ? footerNode
          : footerNode.cloneNode(true);
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
      "Quotation " +
      (data.quotationNumber || "") +
      " — " +
      pages.length +
      " page" +
      (pages.length > 1 ? "s" : "");

    /* ===================================================================
       PDF SAVE + CONFIRM HANDLER
       -------------------------------------------------------------------
       Bound to both "Save" and "🖨 Print / Save as PDF".
       =================================================================== */

    var pdfBusy = false;

    function downloadBlob(blob, filename) {
      var url = URL.createObjectURL(blob);

      var link = document.createElement("a");
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4000);
    }

    function handleSaveAndConfirm() {
      if (pdfBusy) {
        return;
      }

      var originalStatusText =
        "Quotation " +
        (data.quotationNumber || "") +
        " — " +
        pages.length +
        " page" +
        (pages.length > 1 ? "s" : "");

      if (!data.quotationNumber) {
        status.textContent =
          "Quotation — Save failed (missing quotation number)";
        window.alert(
          "Cannot save the PDF: Quotation number is missing.",
        );
        return;
      }

      pdfBusy = true;
      status.textContent = originalStatusText + " — Generating PDF…";

      var filename = data.quotationNumber + ".pdf";

      buildPdfBlob(pagesHost, filename)
        .then(function (blob) {
          // 1. Local download — unchanged user-visible behaviour.
          downloadBlob(blob, filename);

          status.textContent =
            originalStatusText + " — Uploading & confirming…";

          // 2. Upload + confirm on the backend.
          return postPdfToBackend(
            data.quotationNumber,
            blob,
            filename,
          );
        })
        .then(function () {
          status.textContent =
            "Quotation " +
            (data.quotationNumber || "") +
            " — Confirmed ✓  (PDF saved)";
        })
        .catch(function (error) {
          console.error(
            "[QuotationPrint] Save / confirm failed:",
            error,
          );

          status.textContent = originalStatusText + " — Save failed";

          window.alert(
            "The PDF was downloaded locally, but the Quotation could not be confirmed on the server.\n\n" +
              (error && error.message
                ? error.message
                : "Unknown error."),
          );
        })
        .then(function () {
          pdfBusy = false;
        });
    }

    saveBtn.addEventListener("click", handleSaveAndConfirm);
    printBtn.addEventListener("click", handleSaveAndConfirm);
  }
})();