/* =========================================================================
   PurchaseOrderPrint.js
   -------------------------------------------------------------------------
   Standalone Purchase Order print / PDF system.

   This file is completely independent from:

     - PurchaseOrderForm.jsx
     - PurchaseOrderPreview.jsx
     - PrintLayout.jsx
     - DocumentPage.jsx
     - print.css
     - QuotationPrint.js

   PUBLIC API
   -------------------------------------------------------------------------
     generatePurchaseOrderPrint(data, summary, columns)

   The existing Purchase Order form supplies its existing:
     - data
     - summary
     - columns

   No Purchase Order business logic is changed here.

   PAGINATION METHOD
   -------------------------------------------------------------------------
   This uses the same measured-DOM pagination approach as the working
   Quotation print system:

     1. Build real DOM blocks.
     2. Render them in an off-screen measurement sandbox.
     3. Measure their actual browser-rendered heights.
     4. Measure header/footer heights.
     5. Calculate the usable A4 content area.
     6. Pack normal blocks into pages.
     7. Pack Purchase Order table rows individually.
     8. Repeat the table header on continuation pages.
     9. Create every A4 page explicitly.
    10. Place the header/footer inside every explicit page.
    11. Add remaining-space spacer only to the final page.

   Browser automatic document pagination is therefore not relied upon
   for the logical page structure.

   PDF SAVE + STATUS CONFIRM
   -------------------------------------------------------------------------
   When the user clicks "🖨 Print / Save as PDF":

     1. The rendered .pop-pages element is converted to a PDF blob
        in-browser using html2pdf.js (loaded lazily on first use).
     2. The PDF is downloaded locally as before.
     3. The same PDF blob is POSTed to:
            /erp/purchase-orders/<poNumber>/confirm/
        which stores it under MEDIA/PO/PDF/ and flips the PO status
        from "previewed" to "confirmed".
     4. On success, the toolbar status text is updated to reflect
        the confirmed state.

   AUTHENTICATION (OPTION 3: COOKIE + CSRF)
   -------------------------------------------------------------------------
   No JWT access token is used here.

   The HttpOnly refresh cookie set by /erp/login/ is sent
   automatically by the browser on the confirm request because the
   print tab is same-origin with the React app (credentials: "include").

   Django enforces CSRF on the confirm endpoint, so the csrftoken
   cookie is forwarded as the X-CSRFToken header.
   ========================================================================= */

(function () {
  "use strict";

  var PAYLOAD_KEY = "pop-print-payload-v1";
  var ROOT_ID = "pop-print-app-root";

  /* =======================================================================
     PDF / CONFIRM CONFIG
     ======================================================================= */

  var CONFIRM_URL_TEMPLATE =
    "/api/erp/purchase-orders/{poNumber}/confirm/";

  var HTML2PDF_CDN =
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

  var html2pdfLoadingPromise = null;

  /* =======================================================================
     PAGE GEOMETRY
     ======================================================================= */

  var MM_TO_PX = 96 / 25.4;

  var PAGE_MM = {
    width: 210,
    height: 297,

    marginTop: 12,
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 10,

    footerGap: 8,
    headerGap: 7,

    contentPaddingTop: 3,
    contentPaddingBottom: 5,
  };

  /* =======================================================================
     LATEST QUOTATION LETTERHEAD
     -----------------------------------------------------------------------
     This is intentionally copied from the latest Quotation print system's
     current letterhead data.

     It is kept local to this standalone PO print system so the PO print
     document remains independent from the Quotation files.
     ======================================================================= */

  var LETTERHEAD = {
    name: "Mugil Engineering Industry",
    regNo: "Udyam Reg No: UDYAM - TN - 27 - 0010156",
    gstin: "GSTIN: 33AHDPR8644K1ZX",

    address:
      "4/211, S.F. No.105, Thanjavur Main Road, Devarayanery, Assor (P.O.), Trichy - 620 015.",

    phones: [
      "98424-52887",
      "99446-51887",
      "89039-52887",
    ],

    email: "mugilengg@gmail.com",

    tagline:
      "கண்தானம் செய்வீர்!  இரத்ததானம் செய்வீர்!!",
  };

  /* =======================================================================
     BASIC HELPERS
     ======================================================================= */

  function toNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function formatIndianCurrency(value) {
    var n = toNumber(value);

    var parts = n.toFixed(2).split(".");
    var integerPart = parts[0];

    var sign = "";

    if (integerPart.charAt(0) === "-") {
      sign = "-";
      integerPart = integerPart.slice(1);
    }

    var lastThree = integerPart.slice(-3);
    var other = integerPart.slice(0, -3);

    if (other !== "") {
      other = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      integerPart = other + "," + lastThree;
    } else {
      integerPart = lastThree;
    }

    return sign + integerPart;
  }

  function formatDateDisplay(value) {
    if (!value) return "—";

    var date = new Date(value);

    if (isNaN(date.getTime())) {
      return String(value);
    }

    var day = String(date.getDate()).padStart(2, "0");
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var year = date.getFullYear();

    return day + "." + month + "." + year;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[character];
      },
    );
  }

  function pick(object, keys, fallback) {
    if (fallback === undefined) {
      fallback = "";
    }

    if (!object) {
      return fallback;
    }

    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];

      if (
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }

    return fallback;
  }

  function normalizeTerm(term) {
    if (term === null || term === undefined) {
      return "";
    }

    if (typeof term === "string") {
      return term;
    }

    return pick(
      term,
      ["text", "value", "label"],
      "",
    );
  }

  function el(tag, className, html) {
    var node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (html !== undefined) {
      node.innerHTML = html;
    }

    return node;
  }

  /* =======================================================================
     CSRF COOKIE READER
     -----------------------------------------------------------------------
     Django sets the csrftoken cookie via get_token() during /erp/login/.
     We forward it as X-CSRFToken so the csrf_protect decorator on the
     confirm view accepts the request.
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
        filename: filename || "purchase-order.pdf",
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

      var worker = html2pdf()
        .set(options)
        .from(pagesHost);

      return worker.toPdf().get("pdf").then(function () {
        return worker.outputPdf("blob");
      });
    });
  }

  /* =======================================================================
     CONFIRM API CALL (cookie + CSRF)
     -----------------------------------------------------------------------
     The print tab is same-origin with the React app, so the HttpOnly
     refresh cookie set by /erp/login/ is automatically sent. CSRF is
     enforced by Django, so we forward the csrftoken cookie as the
     X-CSRFToken header. No access token is used here at all.
     ======================================================================= */
  function postPdfToBackend(poNumber, pdfBlob, filename) {
    if (!poNumber) {
      return Promise.reject(
        new Error("Cannot confirm: Purchase Order number is missing."),
      );
    }

    if (!pdfBlob) {
      return Promise.reject(
        new Error("Cannot confirm: PDF blob is missing."),
      );
    }

    var url = CONFIRM_URL_TEMPLATE.replace(
      "{poNumber}",
      encodeURIComponent(poNumber),
    );

    var formData = new FormData();

    formData.append(
      "pdf",
      pdfBlob,
      filename || poNumber + ".pdf",
    );

    var csrfToken = readCookie("csrftoken");

    if (!csrfToken) {
      console.warn(
        "[PurchaseOrderPrint] CSRF token was not found in document.cookie.",
      );
    }

    return fetch(url, {
      method: "POST",
      headers: csrfToken
        ? {
            "X-CSRFToken": csrfToken,
          }
        : {},
      body: formData,
      credentials: "include",
    })
      .catch(function (networkError) {
        // fetch() itself rejected — DNS, CORS, offline, etc.
        throw new Error(
          "Network error while confirming the Purchase Order: " +
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
              body.message ||
              body.detail ||
              JSON.stringify(body);
          } else {
            message = body || "Server rejected the PDF upload.";
          }

          throw new Error(
            "HTTP " +
              response.status +
              ": " +
              message,
          );
        }

        return body;
      });
  }

  /* =======================================================================
     PUBLIC ENTRY POINT
     ======================================================================= */

  function generatePurchaseOrderPrint(
    data,
    summary,
    columns,
  ) {
    if (!data) {
      console.error(
        "[PurchaseOrderPrint] generatePurchaseOrderPrint() called without Purchase Order data.",
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
      localStorage.setItem(
        PAYLOAD_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.error(
        "[PurchaseOrderPrint] Could not stage Purchase Order data:",
        error,
      );

      return;
    }

    var printTab = window.open(
      "/PurchaseOrderPrint.html",
      "_blank",
    );

    if (!printTab) {
      console.error(
        "[PurchaseOrderPrint] Pop-up was blocked by the browser.",
      );

      window.alert(
        "Your browser blocked the Purchase Order print preview pop-up. Please allow pop-ups for this site and try again.",
      );
    }
  }

  if (typeof window !== "undefined") {
    window.generatePurchaseOrderPrint =
      generatePurchaseOrderPrint;
  }

  /* =======================================================================
     PAYLOAD READER
     ======================================================================= */

  function readPayload() {
    var raw;

    try {
      raw = localStorage.getItem(PAYLOAD_KEY);
    } catch (error) {
      if (typeof console !== "undefined") {
        console.error(
          "[PurchaseOrderPrint] Could not read payload from localStorage:",
          error,
        );
      }
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      var parsed = JSON.parse(raw);

      localStorage.removeItem(PAYLOAD_KEY);

      return parsed;
    } catch (error) {
      if (typeof console !== "undefined") {
        console.error(
          "[PurchaseOrderPrint] Payload in localStorage is corrupt:",
          error,
        );
      }
      return null;
    }
  }

  /* =======================================================================
     BOOT
     ======================================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      var root = document.getElementById(ROOT_ID);

      /*
       * If this script is loaded by the React application only to expose
       * window.generatePurchaseOrderPrint(), the root does not exist.
       *
       * Therefore nothing else runs.
       */

      if (!root) {
        return;
      }

      var payload = readPayload();

      if (!payload || !payload.data) {
        console.error(
          "[PurchaseOrderPrint] No Purchase Order payload found for print preview.",
        );

        root.appendChild(
          el(
            "p",
            "pop-error",
            'No Purchase Order data was found for this print preview. Please return to the Purchase Order form and use the "Print / Save as PDF" action again.',
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
    },
  );

  /* =======================================================================
     HEADER
     -----------------------------------------------------------------------
     Latest Quotation header structure.
     ======================================================================= */

  function buildHeaderNode(companyName) {
    var wrap = el("div", "");

    var header = el(
      "div",
      "pop-header",
    );

    /* ---------------------------------------------------------------
       LEFT LOGO
       --------------------------------------------------------------- */

    var logoLeft = el(
      "div",
      "pop-logo",
      '<img src="/mugil-logo.png" alt="Mugil Engineering Industry" style="width:90px;height:90px;object-fit:contain;" />',
    );

    /* ---------------------------------------------------------------
       CENTER COMPANY INFORMATION
       --------------------------------------------------------------- */

    var center = el(
      "div",
      "pop-header__center",
    );

    center.innerHTML =
      "<h1>" +
      escapeHtml(companyName) +
      "</h1>" +
      '<p class="pop-header__meta">' +
      escapeHtml(LETTERHEAD.regNo) +
      "</p>" +
      '<p class="pop-header__meta">' +
      escapeHtml(LETTERHEAD.gstin) +
      "</p>";

    /* ---------------------------------------------------------------
       RIGHT LOGO
       --------------------------------------------------------------- */

    var logoRight = el(
      "div",
      "pop-logo",
      '<img src="/globe-logo.png" alt="MEI" style="width:90px;height:90px;object-fit:contain;" />',
    );

    header.appendChild(logoLeft);
    header.appendChild(center);
    header.appendChild(logoRight);

    var headerRule = el(
      "div",
      "pop-header-rule",
    );

    wrap.appendChild(header);
    wrap.appendChild(headerRule);

    return wrap;
  }

  /* =======================================================================
     FOOTER
     -----------------------------------------------------------------------
     Latest Quotation footer structure.
     ======================================================================= */

  function buildFooterNode() {
    var wrap = el("div", "");

    var footerRule = el(
      "div",
      "pop-footer-rule",
    );

    wrap.appendChild(footerRule);

    var footer = el(
      "div",
      "pop-footer",
    );

    footer.appendChild(
      el(
        "p",
        "pop-footer__address",
        escapeHtml(LETTERHEAD.address),
      ),
    );

    footer.appendChild(
      el(
        "p",
        "pop-footer__address",
        "S.F. No: 436 / 5A, Near B K Bharath Township, Thanjavur Main Road, Valavanthankottai, Trichy - 620015",
      ),
    );

    footer.appendChild(
      el(
        "p",
        "pop-footer__contact",
        "<strong>Cell :</strong> " +
          escapeHtml(
            LETTERHEAD.phones.join(", "),
          ) +
          "&nbsp;&nbsp;<strong>Email :</strong> " +
          escapeHtml(LETTERHEAD.email),
      ),
    );

    var taglineRow = el(
      "div",
      "pop-footer__tagline-row",
    );

    var eyeLogo = el(
      "img",
      "pop-footer__logo pop-footer__logo--eye",
    );

    eyeLogo.src = "/eye-donation.png";
    eyeLogo.alt = "Eye Donation";

    var tagline = el(
      "p",
      "pop-footer__tagline",
      escapeHtml(LETTERHEAD.tagline),
    );

    var bloodLogo = el(
      "img",
      "pop-footer__logo pop-footer__logo--blood",
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

  /* =======================================================================
     DOCUMENT TITLE
     ======================================================================= */

  function buildDocTitleNode() {
    /*
     * The title must be mathematically centered on the full printable
     * A4 content width, independent of the width of any sibling block
     * (meta row, vendor block, table, etc).
     *
     * ".pop-title-wrap" spans the full content width (same left/right
     * edges as every other content block). The title itself is shifted
     * to the container's horizontal center using left: 50% and then
     * pulled back by exactly half of its own rendered width using
     * transform: translateX(-50%). This is the standard mathematically
     * correct centering technique and works regardless of the title's
     * text width, font, or letter-spacing.
     *
     * "position: relative" (rather than "position: absolute") is used
     * deliberately so the title still participates in normal document
     * flow. That keeps the measurement engine's getBoundingClientRect()
     * height reading accurate — an absolutely positioned title would
     * collapse its container's height to 0 and break pagination math.
     */

    var wrap = el(
      "div",
      "pop-title-wrap",
    );

    var title = el(
      "h2",
      "pop-doc-title",
      "PURCHASE ORDER",
    );

    wrap.appendChild(title);

    return wrap;
  }

  /* =======================================================================
     VENDOR / META AREA
     -----------------------------------------------------------------------
     This intentionally preserves the visual structure of the supplied
     previous PO PDF.
     ======================================================================= */

  function buildMetaRowNode(data) {
    var vendor = data.vendor || {};

    var companyName = pick(
      vendor,
      ["companyName", "company", "name"],
      "________________",
    );

    var address1 = pick(
      vendor,
      ["address1", "addressLine1", "address"],
      "",
    );

    var address2 = pick(
      vendor,
      ["address2", "addressLine2"],
      "",
    );

    var city = pick(
      vendor,
      ["city", "town"],
      "",
    );

    var state = pick(
      vendor,
      ["state", "stateName"],
      "",
    );

    var pincode = pick(
      vendor,
      ["pincode", "pinCode", "postalCode", "zipCode"],
      "",
    );

    var gst = pick(
      vendor,
      [
        "gst",
        "gstNumber",
        "gstNo",
        "gstin",
        "GSTNumber",
        "GSTIN",
      ],
      "",
    );

    var contactPerson = pick(
      vendor,
      [
        "contactPerson",
        "contact",
        "contactName",
        "person",
      ],
      "",
    );

    var phone = pick(
      vendor,
      [
        "phone",
        "phoneNumber",
        "mobile",
        "mobileNumber",
        "contactNumber",
      ],
      "",
    );

    var leftHtml =
      '<div class="pop-meta-row__left">' +
      '<div class="pop-vendor">' +
      '<p class="pop-vendor__to">To,</p>' +
      "<p class=\"pop-vendor__name\">M/s. " +
      escapeHtml(companyName) +
      "</p>";

    if (address1) {
      leftHtml +=
        "<p>" +
        escapeHtml(address1) +
        "</p>";
    }

    if (address2) {
      leftHtml +=
        "<p>" +
        escapeHtml(address2) +
        "</p>";
    }

    var locationParts = [];

    if (city) {
      locationParts.push(city);
    }

    if (state) {
      locationParts.push(state);
    }

    if (locationParts.length || pincode) {
      leftHtml +=
        "<p>" +
        escapeHtml(
          locationParts.join(", "),
        );

      if (pincode) {
        leftHtml +=
          " - " +
          escapeHtml(pincode);
      }

      leftHtml += "</p>";
    }

    if (contactPerson) {
      leftHtml +=
        "<p>Contact Person : " +
        escapeHtml(contactPerson) +
        "</p>";
    }

    if (phone) {
      leftHtml +=
        "<p>Phone : " +
        escapeHtml(phone) +
        "</p>";
    }

    if (gst) {
      leftHtml +=
        "<p>GST : " +
        escapeHtml(gst) +
        "</p>";
    }

    leftHtml += "</div></div>";

    var rightHtml =
      '<div class="pop-meta-row__right">' +
      "<p><strong>Date :</strong> " +
      escapeHtml(
        formatDateDisplay(data.poDate),
      ) +
      "</p>" +
      "<p><strong>PO No :</strong> " +
      escapeHtml(
        data.poNumber || "—",
      ) +
      "</p>" +
      "</div>";

    return el(
      "div",
      "pop-meta-row",
      leftHtml + rightHtml,
    );
  }

  /* =======================================================================
     SUBJECT
     ======================================================================= */

  function buildSubjectNode(subject) {
    return el(
      "p",
      "pop-subject",
      "<strong>Subject :</strong> " +
        escapeHtml(subject || "—"),
    );
  }

  /* =======================================================================
     INTRODUCTION
     -----------------------------------------------------------------------
     The existing PO preview currently uses a fixed sentence. We preserve
     that existing displayed wording here rather than changing PO behavior.
     ======================================================================= */

  function buildIntroNode(data) {
    var referenceNumber =
      data.refQuoteNumber ||
      "________________";

    var referenceDate = data.refDate
      ? " dated " +
        formatDateDisplay(data.refDate)
      : "";

    var intro = el(
      "div",
      "pop-intro",
    );

    intro.appendChild(
      el(
        "p",
        "",
        "Dear Sir,",
      ),
    );

    intro.appendChild(
      el(
        "p",
        "pop-intro__body",
        "With reference to your quotation " +
          "<strong>" +
          escapeHtml(referenceNumber) +
          "</strong>" +
          escapeHtml(referenceDate) +
          ", we are pleased to place the purchase order as per the below mentioned details.",
      ),
    );

    return intro;
  }

  /* =======================================================================
     SECTION HEADING
     ======================================================================= */

  function buildSectionHeadingNode(text) {
    return el(
      "div",
      "pop-section-heading",
      escapeHtml(text),
    );
  }

  /* =======================================================================
     COLUMN HELPERS
     ======================================================================= */

  function getVisibleColumns(columns, includeAmountDetails) {
    if (!Array.isArray(columns)) {
      return [];
    }

    return columns.filter(function (column) {
      if (!column) {
        return false;
      }

      if (column.visible === false) {
        return false;
      }

      var id = String(
        column.id || "",
      ).toLowerCase();

      var label = String(
        column.label || "",
      ).toLowerCase();

      if (
        id === "action" ||
        id === "actions" ||
        label === "action" ||
        label === "actions"
      ) {
        return false;
      }

      /*
       * Hide the Amount column when
       * "Include amount details" is unchecked.
       */
      if (
        !includeAmountDetails &&
        (
          id === "amount" ||
          label === "amount" ||
          label.includes("amount") ||
          label.includes("price")
        )
      ) {
        return false;
      }

      return true;
    });
  }

  function getColumnValue(item, column) {
    if (!item || !column) {
      return "";
    }

    var value = item[column.id];

    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }

    return value;
  }

  function getColumnClass(column) {
    if (!column) {
      return "pop-column-text";
    }

    var type = String(
      column.type || "text",
    ).toLowerCase();

    if (
      type === "number" ||
      type === "currency"
    ) {
      return "pop-column-number";
    }

    if (
      type === "date"
    ) {
      return "pop-column-center";
    }

    return "pop-column-text";
  }

  function getColumnDisplayValue(
    item,
    column,
  ) {
    var value = getColumnValue(
      item,
      column,
    );

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    var type = String(
      column.type || "text",
    ).toLowerCase();

    if (type === "date") {
      return formatDateDisplay(value);
    }

    if (
      type === "number"
    ) {
      return String(value);
    }

    return String(value);
  }

  /* =======================================================================
     PURCHASE ORDER TABLE
     ======================================================================= */

  function buildItemsTableHeaderRow(
    visibleColumns,
  ) {
    var tr = el("tr", "");

    /*
     * Serial number is always the first column.
     */
    var serialTh = el(
      "th",
      "pop-column-serial",
      "S.No",
    );

    tr.appendChild(serialTh);

    visibleColumns.forEach(
      function (column) {
        var th = el(
          "th",
          getColumnClass(column),
          escapeHtml(
            column.label ||
              column.id ||
              "Column",
          ),
        );

        tr.appendChild(th);
      },
    );

    return tr;
  }

  function buildItemRow(
    item,
    visibleColumns,
    index,
  ) {
    var tr = el("tr", "");

    /*
     * Serial number column.
     */
    var serialTd = el(
      "td",
      "pop-column-serial",
    );

    serialTd.textContent =
      String(index + 1);

    tr.appendChild(serialTd);

    /*
     * Dynamic Purchase Order columns.
     */
    visibleColumns.forEach(
      function (column) {
        var td = el(
          "td",
          getColumnClass(column),
        );

        td.textContent =
          getColumnDisplayValue(
            item,
            column,
          );

        tr.appendChild(td);
      },
    );

    return tr;
  }

  function buildEmptyRow(
    visibleColumns,
  ) {
    var tr = el("tr", "");

    var td = el(
      "td",
      "pop-empty-row",
      "No items available",
    );

    /*
     * +1 because S.No is always
     * added before visibleColumns.
     */
    td.colSpan =
      Math.max(
        1,
        visibleColumns.length + 1,
      );

    tr.appendChild(td);

    return tr;
  }

  /* =======================================================================
     TABLE
     ======================================================================= */

  function buildItemsTable(
    rows,
    visibleColumns,
    includeHeader,
  ) {
    var table = el(
      "table",
      "pop-items-table",
    );

    /*
     * ---------------------------------------------------------------
     * Column widths
     * ---------------------------------------------------------------
     *
     * Reference Purchase Order:
     *
     * S.No           6%
     * Description   34%
     * Specification 28%
     * Qty            7%
     * Unit           7%
     * Amount         18%
     *
     * Total = 100%
     *
     * If custom columns are present, the remaining width is
     * distributed among those custom columns.
     */

    var colgroup =
      el("colgroup");

    /*
     * S.No
     */
    var serialCol =
      document.createElement(
        "col",
      );

    serialCol.style.width =
      "6%";

    colgroup.appendChild(
      serialCol,
    );

    /*
     * First identify which columns are standard
     * and which are custom.
     */
    var standardColumnInfo =
      [];

    var customColumns =
      [];

    visibleColumns.forEach(
      function (column) {
        var id = String(
          column.id || "",
        ).toLowerCase();

        var label = String(
          column.label || "",
        ).toLowerCase();

        var width = null;

        if (
          id === "description" ||
          label === "description" ||
          label.includes("description")
        ) {
          width = 34;
        } else if (
          id === "specification" ||
          label === "specification" ||
          label.includes("specification") ||
          label === "spec"
        ) {
          width = 28;
        } else if (
          id === "qty" ||
          label === "qty" ||
          label.includes("quantity")
        ) {
          width = 7;
        } else if (
          id === "unit" ||
          label === "unit"
        ) {
          width = 7;
        } else if (
          id === "amount" ||
          label === "amount" ||
          label.includes("amount") ||
          label.includes("price")
        ) {
          width = 18;
        }

        if (width !== null) {
          standardColumnInfo.push({
            column: column,
            width: width,
          });
        } else {
          customColumns.push(
            column,
          );
        }
      },
    );

    /*
     * Width occupied by standard columns.
     */
    var standardWidth =
      standardColumnInfo.reduce(
        function (total, entry) {
          return total + entry.width;
        },
        0,
      );

    /*
     * Available width after S.No and standard columns.
     *
     * S.No already occupies 6%.
     */
    var remainingWidth =
      Math.max(
        0,
        94 - standardWidth,
      );

    /*
     * If there are custom columns, distribute
     * the remaining width equally.
     */
    var customWidth =
      customColumns.length > 0
        ? remainingWidth /
          customColumns.length
        : 0;

    /*
     * Create the <col> elements in the EXACT
     * same order as visibleColumns.
     */
    visibleColumns.forEach(
      function (column) {
        var id = String(
          column.id || "",
        ).toLowerCase();

        var label = String(
          column.label || "",
        ).toLowerCase();

        var width = null;

        if (
          id === "description" ||
          label === "description" ||
          label.includes("description")
        ) {
          width = 34;
        } else if (
          id === "specification" ||
          label === "specification" ||
          label.includes("specification") ||
          label === "spec"
        ) {
          width = 28;
        } else if (
          id === "qty" ||
          label === "qty" ||
          label.includes("quantity")
        ) {
          width = 7;
        } else if (
          id === "unit" ||
          label === "unit"
        ) {
          width = 7;
        } else if (
          id === "amount" ||
          label === "amount" ||
          label.includes("amount") ||
          label.includes("price")
        ) {
          width = 18;
        }

        var col =
          document.createElement(
            "col",
          );

        if (width !== null) {
          col.style.width =
            width + "%";
        } else {
          col.style.width =
            customWidth + "%";
        }

        colgroup.appendChild(
          col,
        );
      },
    );

    table.appendChild(
      colgroup,
    );

    /*
     * Header
     */
    if (includeHeader) {
      var thead =
        el("thead");

      thead.appendChild(
        buildItemsTableHeaderRow(
          visibleColumns,
        ),
      );

      table.appendChild(
        thead,
      );
    }

    /*
     * Body
     */
    var tbody =
      el("tbody");

    rows.forEach(
      function (row) {
        tbody.appendChild(
          row,
        );
      },
    );

    table.appendChild(
      tbody,
    );

    return table;
  }

  /* =======================================================================
     AMOUNT SUMMARY
     ======================================================================= */

  function buildSummaryNode(
    data,
    summary,
  ) {
    var wrap = el(
      "div",
      "",
    );

    wrap.appendChild(
      buildSectionHeadingNode(
        "Amount Summary:",
      ),
    );

    var list = el(
      "ul",
      "pop-summary-list",
    );

    /*
     * ================================================================
     * CALCULATE FROM PURCHASE ORDER ITEMS
     * ================================================================
     *
     * Each item already contains its final Amount.
     * The subtotal is the sum of those item amounts.
     */

    var items =
      Array.isArray(data.items)
        ? data.items
        : [];

    var subtotal =
      items.reduce(
        function (sum, item) {
          var amount =
            Number(
              item.amount,
            ) || 0;

          return sum + amount;
        },
        0,
      );

    /*
     * ================================================================
     * GST PERCENTAGE
     * ================================================================
     *
     * Use the GST percentage entered in the existing PO data.
     */

    var gstPercent =
      data &&
      data.gstPercent !==
        undefined &&
      data.gstPercent !==
        null &&
      data.gstPercent !== ""
        ? Number(
            data.gstPercent,
          )
        : 0;

    /*
     * ================================================================
     * GST AMOUNT
     * ================================================================
     *
     * GST = subtotal × GST percentage / 100
     */

    var gstAmount =
      (subtotal *
        gstPercent) /
      100;

    /*
     * ================================================================
     * FINAL TOTAL
     * ================================================================
     *
     * Final Total = subtotal + GST
     */

    var grandTotal =
      subtotal +
      gstAmount;

    /*
     * ================================================================
     * TOTAL EXCLUDING GST
     * ================================================================
     */

    list.appendChild(
      el(
        "li",
        "",
        "<strong>Total (Excluding GST):</strong> ₹ " +
          escapeHtml(
            formatIndianCurrency(
              subtotal,
            ),
          ) +
          "/-",
      ),
    );

    /*
     * ================================================================
     * GST
     * ================================================================
     */

    list.appendChild(
      el(
        "li",
        "",
        "<strong>GST @ " +
          escapeHtml(
            String(
              gstPercent,
            ),
          ) +
          "%:</strong> ₹ " +
          escapeHtml(
            formatIndianCurrency(
              gstAmount,
            ),
          ) +
          "/-",
      ),
    );

    /*
     * ================================================================
     * TOTAL AMOUNT
     * ================================================================
     */

    list.appendChild(
      el(
        "li",
        "",
        "<strong>Total Amount:</strong> ₹ " +
          escapeHtml(
            formatIndianCurrency(
              grandTotal,
            ),
          ) +
          "/-",
      ),
    );

    wrap.appendChild(
      list,
    );

    return wrap;
  }

  /* =======================================================================
     CLOSING + SIGNATURE
     ======================================================================= */

  function buildClosingSignatureNode(
    data,
  ) {
    var wrap = el(
      "div",
      "",
    );

    var closing = el(
      "div",
      "pop-closing",
    );

    closing.innerHTML =
      "<p>Kindly proceed with the execution of the order at the earliest.</p>" +
      "<p>&nbsp;</p>" +
      "<p>Thanking You,</p>" +
      "<p>Yours faithfully,</p>";

    wrap.appendChild(closing);

    var preparedBy =
      pick(
        data.signatures,
        ["preparedBy"],
        data.preparedBy ||
          "Rajappa P",
      );

    var companyName =
      data.companyName ||
      LETTERHEAD.name;

    var location =
      data.location ||
      "Trichy";

    var signoff = el(
      "div",
      "pop-signoff",
    );

    signoff.appendChild(
      el(
        "div",
        "pop-signoff__space",
      ),
    );

    signoff.appendChild(
      el(
        "p",
        "pop-signoff__name",
        "(" +
          escapeHtml(
            preparedBy,
          ) +
          ")",
      ),
    );

    signoff.appendChild(
      el(
        "p",
        "",
        escapeHtml(
          companyName,
        ),
      ),
    );

    signoff.appendChild(
      el(
        "p",
        "",
        escapeHtml(
          location,
        ),
      ),
    );

    wrap.appendChild(signoff);

    return wrap;
  }

  /* =======================================================================
     PAGINATION ENGINE
     ======================================================================= */

  function buildDocument(
    root,
    data,
    summary,
    columns,
  ) {
    var includeAmountDetails =
      data.includeAmountDetails !== false;

    var visibleColumns =
      getVisibleColumns(
        columns,
        includeAmountDetails,
      );

    var items = Array.isArray(data.items)
      ? data.items
      : [];

    /*
     * Fallback if the payload doesn't contain the current columns array.
     *
     * This is only a safety fallback for old/draft payloads.
     */

    if (!visibleColumns.length) {
      visibleColumns = [
        {
          id: "description",
          label: "Description",
          type: "text",
          visible: true,
        },
        {
          id: "specification",
          label: "Specification",
          type: "text",
          visible: true,
        },
        {
          id: "qty",
          label: "Qty",
          type: "number",
          visible: true,
        },
        {
          id: "unit",
          label: "Unit",
          type: "text",
          visible: true,
        },
        {
          id: "amount",
          label: "Price / Unit (₹)",
          type: "number",
          visible: true,
        },
      ];
    }

    var companyName =
      data.companyName ||
      LETTERHEAD.name;

    /* ===================================================================
       TOOLBAR
       =================================================================== */

    var toolbar = el(
      "div",
      "pop-toolbar",
    );

    var status = el(
      "span",
      "pop-toolbar__status",
      "Purchase Order " +
        escapeHtml(
          data.poNumber || "",
        ),
    );

    var saveBtn = el(
      "button",
      "pop-btn pop-btn--save",
      "Save",
    );

    saveBtn.type = "button";

    var closeBtn = el(
      "button",
      "pop-btn pop-btn--ghost",
      "Close",
    );

    closeBtn.type = "button";

    closeBtn.addEventListener(
      "click",
      function () {
        window.close();
      },
    );

    var printBtn = el(
      "button",
      "pop-btn pop-btn--primary",
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

    var pagesHost = el(
      "div",
      "pop-pages",
    );

    root.appendChild(pagesHost);

    /* ===================================================================
       PAGE GEOMETRY
       =================================================================== */

    var pageWidthPx =
      PAGE_MM.width *
      MM_TO_PX;

    var pageHeightPx =
      PAGE_MM.height *
      MM_TO_PX;

    var marginTopPx =
      PAGE_MM.marginTop *
      MM_TO_PX;

    var marginLeftPx =
      PAGE_MM.marginLeft *
      MM_TO_PX;

    var marginRightPx =
      PAGE_MM.marginRight *
      MM_TO_PX;

    var marginBottomPx =
      PAGE_MM.marginBottom *
      MM_TO_PX;

    var footerGapPx =
      PAGE_MM.footerGap *
      MM_TO_PX;

    var headerGapPx =
      PAGE_MM.headerGap *
      MM_TO_PX;

    var contentPaddingTopPx =
      PAGE_MM.contentPaddingTop *
      MM_TO_PX;

    var contentPaddingBottomPx =
      PAGE_MM.contentPaddingBottom *
      MM_TO_PX;

    var contentWidthPx =
      pageWidthPx -
      marginLeftPx -
      marginRightPx;

    /* ===================================================================
       MEASUREMENT SANDBOX
       =================================================================== */

    var sandbox = el(
      "div",
      "",
    );

    sandbox.style.position =
      "absolute";

    sandbox.style.visibility =
      "hidden";

    sandbox.style.pointerEvents =
      "none";

    sandbox.style.left =
      "-99999px";

    sandbox.style.top = "0";

    sandbox.style.width =
      contentWidthPx + "px";

    document.body.appendChild(
      sandbox,
    );

    /*
     * measure(node)
     * ---------------------------------------------------------------
     * Generic block measurement. Used for whole, standalone blocks
     * (title wrap, meta row, subject, intro, section heading, summary,
     * closing/signature, header, footer). Each of these blocks is
     * rendered exactly once per page, so it is correct to fold its own
     * margin-top/margin-bottom into its reserved height here.
     */

    function measure(node) {
      sandbox.appendChild(node);

      var rect =
        node.getBoundingClientRect();

      var computedStyle =
        window.getComputedStyle(
          node,
        );

      var marginTop =
        parseFloat(
          computedStyle.marginTop,
        ) || 0;

      var marginBottom =
        parseFloat(
          computedStyle.marginBottom,
        ) || 0;

      var height =
        rect.height +
        marginTop +
        marginBottom;

      sandbox.removeChild(node);

      return height;
    }

    /*
     * measureTableStructuralMargin()
     * ---------------------------------------------------------------
     * The Purchase Order items table (.pop-items-table) carries its own
     * CSS margin-top/margin-bottom (currently 3px / 13px). That margin
     * belongs to the <table> element itself and is rendered exactly
     * ONCE per table chunk — i.e. once per page the table appears on —
     * never once per row.
     *
     * This reads the real computed margin directly from CSS so the
     * pagination math always matches the actual stylesheet, even if
     * the margin values in PurchaseOrderPrint.css change later.
     */

    function measureTableStructuralMargin() {
      var probe = buildItemsTable(
        [],
        visibleColumns,
        false,
      );

      sandbox.appendChild(probe);

      var computedStyle =
        window.getComputedStyle(
          probe,
        );

      var marginTop =
        parseFloat(
          computedStyle.marginTop,
        ) || 0;

      var marginBottom =
        parseFloat(
          computedStyle.marginBottom,
        ) || 0;

      sandbox.removeChild(probe);

      return {
        top: marginTop,
        bottom: marginBottom,
        total: marginTop + marginBottom,
      };
    }

    /*
     * measureTableRowContentHeight(rows, includeHeader)
     * ---------------------------------------------------------------
     * Measures ONLY the rendered content height of a header row or a
     * single data row — the <table> element's own margin is explicitly
     * zeroed out (via an inline style override) before measuring, so
     * repeated calls (once per row) never re-add the table's outer
     * margin. The table's margin is accounted for exactly once, by
     * measureTableStructuralMargin() above, when a table chunk is
     * opened during packing — not per row.
     */

    function measureTableRowContentHeight(
      rows,
      includeHeader,
    ) {
      var table =
        buildItemsTable(
          rows,
          visibleColumns,
          includeHeader,
        );

      /*
       * Zero out the table's own margin for measurement purposes only.
       * This does NOT affect the real table that eventually gets
       * rendered onto the page (that one is built fresh, without this
       * override, inside the page-rendering step below).
       */
      table.style.margin = "0";

      sandbox.appendChild(table);

      var height =
        table.getBoundingClientRect()
          .height;

      sandbox.removeChild(table);

      return height;
    }

    /* ===================================================================
       HEADER / FOOTER MEASUREMENT
       =================================================================== */

    var headerNode =
      buildHeaderNode(
        companyName,
      );

    var headerHeight =
      measure(headerNode);

    var footerNode =
      buildFooterNode();

    var footerHeight =
      measure(footerNode);

    var contentTopPx =
      marginTopPx +
      headerHeight +
      headerGapPx +
      contentPaddingTopPx;

    var footerTopPx =
      pageHeightPx -
      marginBottomPx -
      footerHeight -
      footerGapPx -
      contentPaddingBottomPx;

    var availableHeightPx =
      footerTopPx -
      contentTopPx;

    if (
      availableHeightPx < 50
    ) {
      availableHeightPx =
        Math.max(
          50,
          availableHeightPx,
        );
    }

    /* ===================================================================
       FRONT-MATTER BLOCKS
       =================================================================== */

    var frontMatter = [];

    function pushFrontMatter(
      node,
    ) {
      frontMatter.push({
        node: node,
        height: measure(node),
      });
    }

    pushFrontMatter(
      buildDocTitleNode(),
    );

    pushFrontMatter(
      buildMetaRowNode(data),
    );

    if (data.subject) {
      pushFrontMatter(
        buildSubjectNode(
          data.subject,
        ),
      );
    }

    pushFrontMatter(
      buildIntroNode(data),
    );

    pushFrontMatter(
      buildSectionHeadingNode(
        "Details of Order",
      ),
    );

    /* ===================================================================
       TABLE ROWS
       =================================================================== */

    var rowNodes;

    if (items.length) {
      rowNodes =
        items.map(
          function (item, index) {
            return buildItemRow(
              item,
              visibleColumns,
              index,
            );
          },
        );
    } else {
      rowNodes = [
        buildEmptyRow(
          visibleColumns,
        ),
      ];
    }

    /*
     * Each row's height is its own rendered content height only.
     * The table's outer margin (margin-top / margin-bottom) is
     * measured separately, exactly once, below — it must NEVER be
     * folded into a per-row measurement, or it gets counted once for
     * every row instead of once per rendered table chunk.
     */
    var rowHeights =
      rowNodes.map(
        function (row) {
          return measureTableRowContentHeight(
            [row],
            false,
          );
        },
      );

    /* ===================================================================
       TABLE HEADER HEIGHT
       =================================================================== */

    var tableHeaderHeight =
      measureTableRowContentHeight(
        [],
        true,
      );

    /* ===================================================================
       TABLE STRUCTURAL MARGIN (measured ONCE)
       -----------------------------------------------------------------
       This is the table's own margin-top + margin-bottom, read straight
       from the stylesheet. It is reserved exactly once per rendered
       table chunk (i.e. once per page the table occupies) during
       packing below — never once per row.
       =================================================================== */

    var tableStructuralMargin =
      measureTableStructuralMargin();

    /* ===================================================================
       SUMMARY
       =================================================================== */

    var summaryNode = null;
    var summaryHeight = 0;

    if (includeAmountDetails) {
      summaryNode =
        buildSummaryNode(
          data,
          summary,
        );

      summaryHeight =
        measure(summaryNode);
    }

    /* ===================================================================
       CLOSING
       =================================================================== */

    var closingNode =
      buildClosingSignatureNode(
        data,
      );

    var closingHeight =
      measure(closingNode);

    document.body.removeChild(
      sandbox,
    );

    /* ===================================================================
       PAGE PACKING
       =================================================================== */

    var pages = [
      [],
    ];

    var remaining =
      availableHeightPx;

    function startNewPage() {
      pages.push([]);

      remaining =
        availableHeightPx;
    }

    function packBlock(
      block,
    ) {
      if (
        pages[
          pages.length - 1
        ].length > 0 &&
        block.height > remaining
      ) {
        startNewPage();
      }

      pages[
        pages.length - 1
      ].push(block.node);

      remaining -=
        block.height;
    }

    frontMatter.forEach(
      function (block) {
        packBlock(block);
      },
    );

    /* ===================================================================
       TABLE ROW PAGINATION
       -----------------------------------------------------------------
       Each table "chunk" is the set of rows that will be rendered as
       one <table> element on one page. A chunk is associated with the
       page it belongs to; continuation pages receive a repeated table
       header.

       For every chunk, the reserved height is:

         tableStructuralMargin.total   (the <table>'s own margin,
                                         reserved ONCE per chunk)
       + tableHeaderHeight             (the header row's own content
                                         height, no margin)
       + sum(row content heights)      (each row's own content height,
                                         no margin — measured earlier)

       This matches exactly what ends up in the real rendered DOM: one
       <table class="pop-items-table"> per page, each with its own
       margin-top/margin-bottom applied exactly once.
       =================================================================== */

    var tableChunks = [];

    var currentChunk = {
      pageIndex:
        pages.length - 1,

      rows: [],
    };

    /*
     * Reserves the fixed "opening cost" of a table chunk (its
     * structural margin + repeated header) against whatever page is
     * currently active. Callers are responsible for making sure a page
     * with enough room is active before calling this.
     */
    function reserveTableChunkOpening() {
      remaining -=
        tableStructuralMargin.total;

      remaining -=
        tableHeaderHeight;
    }

    /*
     * Starts a brand new page for a table continuation chunk.
     */
    function openTablePage() {
      startNewPage();

      reserveTableChunkOpening();

      currentChunk = {
        pageIndex:
          pages.length - 1,

        rows: [],
      };
    }

    /*
     * Open the first table chunk. It continues on the current page
     * (which already holds the front matter) if the table's structural
     * margin + header genuinely fit in the remaining space; otherwise a
     * fresh page is started for the table.
     */
    if (
      remaining -
        (tableStructuralMargin.total +
          tableHeaderHeight) <
      0
    ) {
      openTablePage();
    } else {
      reserveTableChunkOpening();
    }

    rowNodes.forEach(
      function (row, index) {
        var rowHeight =
          rowHeights[index];

        /*
         * If the next row genuinely does not fit in the remaining
         * space, close out the current chunk and continue on a fresh
         * page (with the table header repeated). Every other row that
         * DOES fit stays exactly where it is — no premature page
         * breaks.
         */
        if (
          remaining -
            rowHeight <
          0
        ) {
          tableChunks.push(
            currentChunk,
          );

          openTablePage();
        }

        currentChunk.rows.push(
          row,
        );

        remaining -=
          rowHeight;
      },
    );

    /*
     * Push the final chunk. It always contains at least one row (every
     * table has at least the "No items available" placeholder row), so
     * this never produces a stray, header-only empty table.
     */
    tableChunks.push(
      currentChunk,
    );

    /* ===================================================================
       INSERT TABLE CHUNKS
       =================================================================== */

    tableChunks.forEach(
      function (chunk) {
        if (
          !pages[
            chunk.pageIndex
          ]
        ) {
          pages[
            chunk.pageIndex
          ] = [];
        }

        var table =
          buildItemsTable(
            chunk.rows,
            visibleColumns,
            true,
          );

        pages[
          chunk.pageIndex
        ].push(table);
      },
    );

    /* ===================================================================
       AFTER-TABLE BLOCKS
       -------------------------------------------------------------------
       Exactly like QuotationPrint.js:
       summary and closing/signature are normal measured blocks.

       This is important because the closing/signature must be allowed
       to remain on the current page whenever enough space is available.
       If it does not fit, packGeneric() starts the next page.
       =================================================================== */

    var afterTable = [];

    if (includeAmountDetails) {
      afterTable.push({
        node: summaryNode,
        height: summaryHeight,
      });
    }

    afterTable.push({
      node: closingNode,
      height: closingHeight,
    });

    /* ===================================================================
       PACK REMAINING AFTER-TABLE CONTENT
       -------------------------------------------------------------------
       Purchase Order uses packBlock(), which is already defined above.
       Do not use packGeneric() here because that function belongs to
       the Quotation print implementation.
       =================================================================== */

    afterTable.forEach(
      function (block) {
        packBlock(block);
      },
    );

    /* ===================================================================
       FINAL PAGE SPACER
       -------------------------------------------------------------------
       Only the final page receives the remaining-space spacer.
       =================================================================== */

    var lastPageIndex =
      pages.length - 1;

    var spacerHeight =
      Math.max(
        0,
        Math.round(
          remaining,
        ),
      );

    if (
      spacerHeight > 0
    ) {
      var spacer =
        el(
          "div",
          "pop-spacer",
        );

      spacer.style.height =
        spacerHeight + "px";

      pages[
        lastPageIndex
      ].push(
        spacer,
      );
    }

    /* ===================================================================
       RENDER EXPLICIT A4 PAGES
       =================================================================== */

    pages.forEach(
      function (
        pageNodes,
        pageIndex,
      ) {
        var pageEl =
          el(
            "div",
            "pop-page",
          );

        pageEl.style.width =
          pageWidthPx + "px";

        pageEl.style.height =
          pageHeightPx + "px";

        /* ---------------------------------------------------------------
           HEADER
           --------------------------------------------------------------- */

        var headerClone =
          pageIndex === 0
            ? headerNode
            : headerNode.cloneNode(
                true,
              );

        headerClone.style.position =
          "absolute";

        headerClone.style.top =
          marginTopPx + "px";

        headerClone.style.left =
          marginLeftPx + "px";

        headerClone.style.right =
          marginRightPx + "px";

        /* ---------------------------------------------------------------
           CONTENT
           --------------------------------------------------------------- */

        var contentWrap =
          el(
            "div",
            "pop-content",
          );

        contentWrap.style.position =
          "absolute";

        contentWrap.style.top =
          contentTopPx + "px";

        contentWrap.style.left =
          marginLeftPx + "px";

        contentWrap.style.right =
          marginRightPx + "px";

        contentWrap.style.height =
          availableHeightPx + "px";

        /*
         * Do not hide overflow.
         *
         * If the measurement engine ever encounters a layout mismatch,
         * content should remain visible instead of being silently clipped.
         */

        contentWrap.style.overflow =
          "visible";

        pageNodes.forEach(
          function (node) {
            contentWrap.appendChild(
              node,
            );
          },
        );

        /* ---------------------------------------------------------------
           FOOTER
           --------------------------------------------------------------- */

        var footerClone =
          pageIndex ===
          pages.length - 1
            ? footerNode
            : footerNode.cloneNode(
                true,
              );

        footerClone.style.position =
          "absolute";

        footerClone.style.left =
          marginLeftPx + "px";

        footerClone.style.right =
          marginRightPx + "px";

        footerClone.style.bottom =
          marginBottomPx + "px";

        footerClone.style.height =
          footerHeight + "px";

        pageEl.appendChild(
          headerClone,
        );

        pageEl.appendChild(
          contentWrap,
        );

        pageEl.appendChild(
          footerClone,
        );

        pagesHost.appendChild(
          pageEl,
        );
      },
    );

    status.textContent =
      "Purchase Order " +
      (data.poNumber || "") +
      " — " +
      pages.length +
      " page" +
      (pages.length > 1
        ? "s"
        : "");

    /* ===================================================================
       PDF SAVE + CONFIRM HANDLER
       -------------------------------------------------------------------
       Bound to both the "Save" and "🖨 Print / Save as PDF" buttons.

       Steps:
         1. Build PDF blob from the already-rendered .pop-pages element.
         2. Trigger a local download (same user-visible behaviour as
            before — the user still receives the PDF).
         3. Upload the blob to the backend confirm endpoint, which
            stores it under MEDIA/PO/PDF/ and flips the PO status to
            "confirmed".
         4. Update the toolbar status text on success / failure.
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

      // Give the browser a moment to start the download before
      // revoking the object URL.
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4000);
    }

    function handleSaveAndConfirm() {
      if (pdfBusy) {
        return;
      }

      var originalStatusText =
        "Purchase Order " +
        (data.poNumber || "") +
        " — " +
        pages.length +
        " page" +
        (pages.length > 1 ? "s" : "");

      if (!data.poNumber) {
        status.textContent =
          "Purchase Order — Save failed (missing PO number)";

        window.alert(
          "Cannot save the PDF: Purchase Order number is missing.",
        );
        return;
      }

      pdfBusy = true;

      status.textContent =
        originalStatusText + " — Generating PDF…";

      var filename = data.poNumber + ".pdf";

      buildPdfBlob(pagesHost, filename)
        .then(function (blob) {
          // 1. Local download — unchanged user-visible behaviour.
          downloadBlob(blob, filename);

          status.textContent =
            originalStatusText + " — Uploading & confirming…";

          // 2. Upload + confirm on the backend.
          return postPdfToBackend(
            data.poNumber,
            blob,
            filename,
          );
        })
        .then(function () {
          status.textContent =
            "Purchase Order " +
            (data.poNumber || "") +
            " — Confirmed ✓  (PDF saved)";
        })
        .catch(function (error) {
          console.error(
            "[PurchaseOrderPrint] Save / confirm failed:",
            error,
          );

          status.textContent =
            originalStatusText + " — Save failed";

          window.alert(
            "The PDF was downloaded locally, but the Purchase Order could not be confirmed on the server.\n\n" +
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