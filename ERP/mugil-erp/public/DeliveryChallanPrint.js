/* =========================================================================
   DeliveryChallanPrint.js
   -------------------------------------------------------------------------
   Standalone Delivery Challan print / PDF system.

   Keeps the existing single-sheet .dc-sheet layout + dc-filler-row sizing.
   Only the toolbar behaviour is upgraded.

   PUBLIC API
   -------------------------------------------------------------------------
     window.generateDeliveryChallanPrint(data)

   PDF SAVE + STATUS CONFIRM
   -------------------------------------------------------------------------
     Clicking "Save" or "Print / Save PDF":
       1. Render .dc-sheet → PDF blob via html2pdf.js (lazy-loaded).
       2. Download the PDF locally.
       3. POST the same blob to:
             /api/erp/delivery-challans/<dcNumber>/confirm/
          which stores it under MEDIA/delivery_challans/ and flips the
          DC status from DRAFT/PREVIEWED to CONFIRMED.
       4. Toolbar status text reflects the confirmed state.

   AUTHENTICATION
   -------------------------------------------------------------------------
     HttpOnly refresh cookie + csrftoken cookie (same as PurchaseOrderPrint.js).
   ========================================================================= */

(function () {
  "use strict";

  const ASSETS = {
    logo: "/mugil-logo.png",
    logoRight: "/globe-logo.png",
    eyeDonation: "/eye-donation.png",
    bloodDonation: "/blood-donation.png",
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

  /* =======================================================================
     PDF / CONFIRM CONFIG
     ======================================================================= */

  const CONFIRM_URL_TEMPLATE =
    "/api/erp/delivery-challans/{dcNumber}/confirm/";

  const HTML2PDF_CDN =
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

  let html2pdfLoadingPromise = null;

  const container = document.getElementById("print-container");
  let layoutReady = Promise.resolve();

  /* =======================================================================
     BASIC HELPERS
     ======================================================================= */

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  function normaliseData(input) {
    const data = input || {};
    const customer = data.customer || {};
    return {
      dcNumber: data.dcNumber || "",
      dcDate: data.dcDate || "",
      poNumber: data.poNumber || "",
      poDate: data.poDate || "",
      billNumber: data.billNumber || "",
      billDate: data.billDate || "",
      deliveryAt: data.deliveryAt || "",
      companyAddressId: data.companyAddressId || "unit1",
      amountInWords: data.amountInWords || "",
      preparedBy: data.preparedBy || "",
      customer: {
        companyName: customer.companyName || "",
        address: customer.address || "",
        contactPerson: customer.contactPerson || "",
        phone: customer.phone || "",
        gstNumber: customer.gstNumber || "",
        returnable: !!customer.returnable,
      },
      items: Array.isArray(data.items) ? data.items : [],
    };
  }

  function customerExtras(customer) {
    const fields = [];

    if (customer.contactPerson) {
      fields.push(`Contact: ${escapeHtml(customer.contactPerson)}`);
    }

    if (customer.phone) {
      fields.push(`Phone: ${escapeHtml(customer.phone)}`);
    }

    if (customer.gstNumber) {
      fields.push(`GST: ${escapeHtml(customer.gstNumber)}`);
    }

    const returnableText = customer.returnable ? "Yes" : "No";

    return `
    <div class="dc-customer-extra">
      ${fields.join(" &nbsp;|&nbsp; ")}
      <div class="dc-returnable-print">
        Returnable: ${returnableText}
      </div>
    </div>
  `;
  }

  function referenceRow(
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
    isNumber,
  ) {
    return `
      <div class="dc-reference-row${
        isNumber ? " dc-reference-row--primary" : ""
      }">
        <span class="dc-reference-entry">
          <span class="dc-reference-label">${leftLabel}</span>
          <span class="dc-reference-value${
            isNumber ? " dc-reference-number" : ""
          }">${escapeHtml(leftValue)}</span>
        </span>
        <span class="dc-reference-entry">
          <span class="dc-reference-label">${rightLabel || ""}</span>
          <span class="dc-reference-value">${escapeHtml(rightValue)}</span>
        </span>
      </div>`;
  }

  function makeItemRows(items) {
    return items
      .map(
        (item, index) => `
      <tr class="dc-item-row">
        <td class="dc-cell-center">${index + 1}</td>
        <td>${escapeHtml(item && item.description)}</td>
        <td class="dc-cell-center">${escapeHtml(item && item.quantity)}</td>
        <td class="dc-cell-center">${escapeHtml(item && item.rate)}</td>
        <td>${escapeHtml(item && item.remarks)}</td>
      </tr>`,
      )
      .join("");
  }

  function hideBrokenAsset(event) {
    const wrapper = event.currentTarget.parentElement;
    if (wrapper) wrapper.classList.add("is-missing");
    event.currentTarget.remove();
  }

  function waitForImages(images) {
    return Promise.all(
      Array.from(images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  }

  function setFillerHeight() {
    const sheet = container && container.querySelector(".dc-sheet");
    const table = sheet && sheet.querySelector(".dc-items");
    const filler = table && table.querySelector(".dc-filler-row");
    if (!sheet || !table || !filler) return;

    const fillerCells = Array.from(filler.cells);
    fillerCells.forEach((cell) => {
      cell.style.height = "1px";
    });
    sheet.classList.remove("dc-sheet--overflow");

    const fixedSections = [
      sheet.querySelector(".dc-header"),
      sheet.querySelector(".dc-document"),
      sheet.querySelector(".dc-rupees"),
      sheet.querySelector(".dc-signature"),
      sheet.querySelector(".dc-footer"),
    ];
    const fixedHeight = fixedSections.reduce(
      (total, section) =>
        total + (section ? section.getBoundingClientRect().height : 0),
      0,
    );
    const headerHeight = table.tHead
      ? table.tHead.getBoundingClientRect().height
      : 0;
    const itemHeight = Array.from(
      table.tBodies[0].querySelectorAll(".dc-item-row"),
    ).reduce((total, row) => total + row.getBoundingClientRect().height, 0);
    const styles = getComputedStyle(sheet);
    const printableHeight =
      sheet.clientHeight -
      parseFloat(styles.paddingTop) -
      parseFloat(styles.paddingBottom);
    const remaining = Math.floor(
      printableHeight - fixedHeight - headerHeight - itemHeight - 2,
    );

    if (remaining <= 1) {
      sheet.classList.add("dc-sheet--overflow");
      fillerCells.forEach((cell) => {
        cell.style.height = "1px";
      });
      return;
    }

    fillerCells.forEach((cell) => {
      cell.style.height = `${remaining}px`;
    });
  }

  /* =======================================================================
     CSRF COOKIE READER
     ======================================================================= */

  function readCookie(name) {
    const match = document.cookie.match(
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
      const script = document.createElement("script");

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
     -----------------------------------------------------------------------
     WHY THIS IS NOT JUST html2pdf().from(sheet)
     -----------------------------------------------------------------------
     EXTRA BLANK PAGE
       html2pdf screenshots the element into one canvas and cuts that canvas
       into strips of  Math.floor(canvas.width * 297 / 210)  pixels, one PDF
       page per strip. The sheet is 297mm = 1122.5197 CSS px tall; html2canvas
       rounds the canvas height UP (1123 px -> 2246 canvas px at scale 2)
       while one strip is 2245 canvas px. That 1 px overshoot becomes a whole
       extra PDF page containing nothing but a white sliver.

       Fix: for a one-page sheet html2canvas is given an explicit capture
       size (794 x 1122.5 CSS px) so the canvas is exactly one strip tall,
       and html2pdf's page-break pass (which can only inject padding into a
       sheet that is already exactly one page) is switched off. If the
       sheet is in its ".dc-sheet--overflow" state (content genuinely longer
       than one page) the original page-break behaviour is kept, and only a
       rounding-sized final sliver page is removed.

     TAMIL FOOTER TEXT
       html2canvas 1.4.1 draws text one "grapheme" at a time whenever an element
       has a non-zero letter-spacing, and its grapheme splitter does not keep
       Tamil vowel signs attached to their consonant. The footer tagline has
       letter-spacing: 0.5px, so its Tamil came out scrambled (detached vowel
       signs, dotted-circle placeholders).

       Fix: in the export copy only, text with letter-spacing that contains
       Tamil/Indic/Arabic/etc. is rebuilt as one inline <span> per grapheme
       cluster, with the same spacing applied as a margin and letter-spacing
       set to 0 on that element. Each cluster is then shaped as a whole and
       the spacing seen in the preview is preserved.

     LOGO POSITION
       html2canvas 1.4.1 (bundled in html2pdf 0.10.1) does not implement
       CSS "object-fit". The header logos use object-fit: contain inside a
       fixed 15mm box, so in the browser a non-square logo is letterboxed and
       centred, but in the PDF it was stretched to fill the whole box: its
       visible artwork ended up larger and lower/higher than in the preview.

       Fix: the export copy (never the live preview) swaps every image that
       uses object-fit for a same-sized <div> with the equivalent
       background-size / background-position, which html2canvas does render
       correctly. Box size, flex alignment and the translateY(-50%) centring
       are untouched, so the logos land exactly where the preview draws them.

     The live, on-screen .dc-sheet is never modified: everything above is
     done on a private clone (".dc-export-host").
     ======================================================================= */

  const PDF_RENDER_SCALE = 2;
  const PDF_CSS_PX_PER_MM = 96 / 25.4;
  const PDF_A4_MM = { width: 210, height: 297 };

  function getPdfPageCount(pdf) {
    if (pdf && typeof pdf.getNumberOfPages === "function") {
      return pdf.getNumberOfPages();
    }

    return pdf.internal.getNumberOfPages();
  }

  /* Scripts that need shaping (Arabic/Hebrew, Indic incl. Tamil, Thai, ...). */
  var COMPLEX_SCRIPT_RE =
    /[\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1780-\u17FF]/;

  function splitIntoClusters(text) {
    if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
      return null;
    }

    try {
      var segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

      return Array.from(segmenter.segment(text), function (part) {
        return part.segment;
      });
    } catch (e) {
      return null;
    }
  }

  function hasOwnComplexText(element) {
    for (var node = element.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 3 && COMPLEX_SCRIPT_RE.test(node.nodeValue)) {
        return true;
      }
    }

    return false;
  }

  /*
   * Walks the live page and its clone in parallel (same structure, same
   * order). Elements with a non-zero letter-spacing that directly contain
   * complex-script text are rewritten in the clone only.
   */
  function preserveComplexScriptSpacing(liveRoot, cloneRoot) {
    var liveElements = liveRoot.querySelectorAll("*");
    var cloneElements = cloneRoot.querySelectorAll("*");

    for (var i = 0; i < liveElements.length; i++) {
      var live = liveElements[i];
      var clone = cloneElements[i];

      if (!clone) continue;

      var spacing = window.getComputedStyle(live).letterSpacing;
      var spacingPx = parseFloat(spacing);

      if (!spacing || spacing === "normal" || !spacingPx) continue;

      if (!hasOwnComplexText(live)) {
        /* Keep its spacing even if an ancestor is zeroed below. */
        clone.style.letterSpacing = spacing;
        continue;
      }

      /* html2canvas only shapes text correctly when this is exactly 0. */
      clone.style.letterSpacing = "0px";

      var textNodes = [];

      for (var n = clone.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) textNodes.push(n);
      }

      textNodes.forEach(function (textNode) {
        var value = textNode.nodeValue;

        if (!COMPLEX_SCRIPT_RE.test(value)) return;

        var clusters = splitIntoClusters(value);

        /* No Intl.Segmenter: keep correct shaping, drop only the spacing. */
        if (!clusters) return;

        var fragment = document.createDocumentFragment();

        clusters.forEach(function (cluster) {
          var span = document.createElement("span");

          span.textContent = cluster;
          span.style.marginRight = spacing;

          fragment.appendChild(span);
        });

        textNode.parentNode.replaceChild(fragment, textNode);
      });
    }
  }

  function replaceObjectFitImages(liveRoot, cloneRoot) {
    const liveImages = liveRoot.querySelectorAll("img");
    const cloneImages = cloneRoot.querySelectorAll("img");

    liveImages.forEach(function (liveImage, index) {
      const cloneImage = cloneImages[index];

      if (!cloneImage || !cloneImage.parentNode) return;

      const style = window.getComputedStyle(liveImage);
      const fit = style.objectFit;

      if (!fit || fit === "fill") return;

      const boxWidth = parseFloat(style.width) || 0;
      const boxHeight = parseFloat(style.height) || 0;

      let backgroundSize = "contain";

      if (fit === "cover") {
        backgroundSize = "cover";
      } else if (fit === "none") {
        backgroundSize = "auto";
      } else if (fit === "scale-down") {
        backgroundSize =
          liveImage.naturalWidth > boxWidth ||
          liveImage.naturalHeight > boxHeight
            ? "contain"
            : "auto";
      }

      const source = (liveImage.currentSrc || liveImage.src || "").replace(
        /"/g,
        "%22",
      );

      const replacement = document.createElement("div");

      replacement.setAttribute("role", "img");
      replacement.setAttribute("aria-label", liveImage.alt || "");

      replacement.style.display = style.display === "inline" ? "block" : style.display;
      replacement.style.boxSizing = "border-box";
      replacement.style.width = style.width;
      replacement.style.height = style.height;
      replacement.style.marginTop = style.marginTop;
      replacement.style.marginRight = style.marginRight;
      replacement.style.marginBottom = style.marginBottom;
      replacement.style.marginLeft = style.marginLeft;
      replacement.style.flexGrow = style.flexGrow;
      replacement.style.flexShrink = style.flexShrink;
      replacement.style.alignSelf = style.alignSelf;
      replacement.style.visibility = style.visibility;
      replacement.style.backgroundImage = 'url("' + source + '")';
      replacement.style.backgroundRepeat = "no-repeat";
      replacement.style.backgroundSize = backgroundSize;
      replacement.style.backgroundPosition = style.objectPosition || "50% 50%";

      cloneImage.parentNode.replaceChild(replacement, cloneImage);
    });
  }

  function buildPdfExportHost(sheet) {
    const host = document.createElement("div");

    host.className = "dc-export-host";

    host.style.display = "block";
    host.style.margin = "0";
    host.style.padding = "0";
    host.style.border = "0";
    host.style.background = "#ffffff";

    const copy = sheet.cloneNode(true);

    preserveComplexScriptSpacing(sheet, copy);

    copy.style.margin = "0";
    copy.style.boxShadow = "none";

    replaceObjectFitImages(sheet, copy);

    host.appendChild(copy);

    return host;
  }

  function buildPdfBlob(sourceElement, filename) {
    return loadHtml2Pdf().then(function (html2pdf) {
      if (!sourceElement) {
        throw new Error(
          "PDF generation failed: source element was not found.",
        );
      }

      const overflowing = sourceElement.classList.contains(
        "dc-sheet--overflow",
      );

      /* Reproduce html2pdf's own slicing arithmetic. */
      const exportWidthPx = Math.ceil(PDF_A4_MM.width * PDF_CSS_PX_PER_MM);

      const canvasWidthPx = exportWidthPx * PDF_RENDER_SCALE;

      const stripHeightPx = Math.floor(
        canvasWidthPx * (PDF_A4_MM.height / PDF_A4_MM.width),
      );

      const pagePitchCssPx = stripHeightPx / PDF_RENDER_SCALE;

      const exportHost = buildPdfExportHost(sourceElement);

      const html2canvasOptions = {
        scale: PDF_RENDER_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: exportWidthPx,
        scrollX: 0,
        scrollY: 0,
      };

      if (!overflowing) {
        /*
         * One-page sheet: capture exactly one strip so the canvas is
         * never taller than a single PDF page.
         */
        html2canvasOptions.height = pagePitchCssPx;
      }

      const options = {
        margin: 0,
        filename: filename || "delivery-challan.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: html2canvasOptions,
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: overflowing ? { mode: ["css", "legacy"] } : { mode: [] },
      };

      const previousScrollX = window.pageXOffset || 0;
      const previousScrollY = window.pageYOffset || 0;

      /*
       * html2pdf's capture container is position:fixed; html2canvas offsets
       * it by the window scroll position, so capture from the top.
       */
      window.scrollTo(0, 0);

      function restoreScroll() {
        window.scrollTo(previousScrollX, previousScrollY);
      }

      let capturedCanvasRows = 0;

      const worker = html2pdf().set(options).from(exportHost);

      return worker
        .toPdf()
        .get("canvas")
        .then(function (canvas) {
          capturedCanvasRows = canvas ? canvas.height : 0;
          return canvas;
        })
        .get("pdf")
        .then(function (pdf) {
          if (!overflowing) {
            /* A one-page sheet must never produce more than one page. */
            while (getPdfPageCount(pdf) > 1) {
              pdf.deletePage(getPdfPageCount(pdf));
            }
          } else if (getPdfPageCount(pdf) > 1) {
            /*
             * Overflowing sheet: a final page made only of the 1-2 px
             * rounding remainder is not content; remove it.
             */
            const remainder = capturedCanvasRows % stripHeightPx;

            if (remainder > 0 && remainder <= 2 * PDF_RENDER_SCALE) {
              pdf.deletePage(getPdfPageCount(pdf));
            }
          }

          return worker.outputPdf("blob");
        })
        .then(
          function (blob) {
            restoreScroll();

            return blob;
          },
          function (error) {
            restoreScroll();

            throw error;
          },
        );
    });
  }

  /* =======================================================================
     CONFIRM API CALL (cookie + CSRF)
     ======================================================================= */

  function postPdfToBackend(dcNumber, pdfBlob, filename) {
    if (!dcNumber) {
      return Promise.reject(
        new Error("Cannot confirm: Delivery Challan number is missing."),
      );
    }

    if (!pdfBlob) {
      return Promise.reject(
        new Error("Cannot confirm: PDF blob is missing."),
      );
    }

    const url = CONFIRM_URL_TEMPLATE.replace(
      "{dcNumber}",
      encodeURIComponent(dcNumber),
    );

    const formData = new FormData();
    formData.append("pdf", pdfBlob, filename || dcNumber + ".pdf");

    const csrfToken = readCookie("csrftoken");

    if (!csrfToken) {
      console.warn(
        "[DeliveryChallanPrint] CSRF token was not found in document.cookie.",
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
          "Network error while confirming the Delivery Challan: " +
            (networkError && networkError.message
              ? networkError.message
              : "unknown error"),
        );
      })
      .then(async function (response) {
        const contentType = response.headers.get("content-type") || "";
        let body;

        if (contentType.includes("application/json")) {
          body = await response.json();
        } else {
          body = await response.text();
        }

        if (!response.ok) {
          let message = "";

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

  /* =======================================================================
     DOWNLOAD HELPER
     ======================================================================= */

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
  }

  /* =======================================================================
     RENDER
     ======================================================================= */

  function renderDeliveryChallan(input) {
    if (!container) return;

    const data = normaliseData(input);
    const customer = data.customer;

    container.innerHTML = `
  <div class="dc-print-controls" aria-label="Print controls">
    <span class="dc-status" aria-live="polite"></span>
    <button type="button" class="dc-save-button">Save</button>
    <button type="button" class="dc-back-button">Back</button>
    <button type="button" class="dc-print-button">Print / Save PDF</button>
  </div>
      <article class="dc-sheet" aria-label="Delivery Challan">
        <header class="dc-header">
  <div class="dc-header-top">
    <div class="dc-registration">
      <div>GSTIN: 33AHDPR8644K1ZX</div>
    </div>

    <div class="dc-title">DELIVERY CHALLAN</div>

    <div class="dc-contacts">
      <div>Cell: 98424-52887</div>
      <div>89039-52887</div>
    </div>
  </div>

<div class="dc-brand">

  <span class="dc-logo-wrap dc-logo-wrap--left">
    <img
      src="/mugil-logo.png"
      alt="Mugil Engineering Industry"
      style="width:90px;height:90px;object-fit:contain;"
    >
  </span>

  <div class="dc-brand-copy">
    <div class="dc-company-name">MUGIL ENGINEERING INDUSTRY</div>

    <div class="dc-company-address">
      Works: ${escapeHtml(
        (
          COMPANY_ADDRESSES.find(
            (address) => address.id === data.companyAddressId,
          ) || COMPANY_ADDRESSES[0]
        ).address,
      )}
    </div>
  </div>

  <span class="dc-logo-wrap dc-logo-wrap--right">
    <img
      src="/globe-logo.png"
      alt="MEI"
      style="width:90px;height:90px;object-fit:contain;"
    >
  </span>

</div>
</header>

        <section class="dc-document">
          <div class="dc-customer">
            <div class="dc-to-label">To</div>
            <div class="dc-ms-line">
              <span class="dc-ms-label">M/s.</span>
              <span class="dc-customer-name">${escapeHtml(
                customer.companyName,
              )}</span>
            </div>
            <div class="dc-customer-address">${escapeHtml(
              customer.address,
            )}</div>
            ${customerExtras(customer)}
          </div>
          <div class="dc-reference">
            ${referenceRow(
              "No.",
              data.dcNumber,
              "Date:",
              formatDate(data.dcDate),
              true,
            )}
            ${referenceRow(
              "PO/LO/WO No.",
              data.poNumber,
              "Date:",
              formatDate(data.poDate),
              false,
            )}
            ${referenceRow(
              "Bill No.",
              data.billNumber,
              "Date:",
              formatDate(data.billDate),
              false,
            )}
            ${referenceRow("Delivery at", data.deliveryAt, "", "", false)}
          </div>
        </section>

        <table class="dc-items">
          <colgroup><col><col><col><col><col></colgroup>
          <thead>
            <tr>
              <th>Sl.<br>No.</th>
              <th>DESCRIPTION</th>
              <th>Quantity<br>(Nos.)</th>
              <th>Rate per<br>Piece/Rs.</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${makeItemRows(data.items)}
            <tr class="dc-filler-row" aria-hidden="true"><td></td><td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table>

        <section class="dc-rupees">
          <span class="dc-rupees-label">Rupees</span>
          <span class="dc-rupees-value">${escapeHtml(
            data.amountInWords,
          )}</span>
        </section>
        <div class="dc-authorization">
          <section class="dc-signature">
            <div class="dc-signature-company">For Mugil Engineering Industry</div>
            <div class="dc-signature-block">
              <div class="dc-signature-space"></div>
              <div class="dc-signature-label">Signature</div>
              
            </div>
          </section>
       <footer class="dc-footer">
  <span class="dc-footer-icon">
    <img src="${ASSETS.eyeDonation}" alt="Eye donation">
  </span>

  <span class="dc-footer-text">
    கண்தானம் செய்வீர்! இரத்ததானம் செய்வீர்!!
  </span>

  <span class="dc-footer-icon">
    <img src="${ASSETS.bloodDonation}" alt="Blood donation">
  </span>
</footer>
        </div>
      </article>`;

    /* ---- Toolbar wiring ---- */

    const statusEl = container.querySelector(".dc-status");
    const saveBtn = container.querySelector(".dc-save-button");
    const backBtn = container.querySelector(".dc-back-button");
    const printBtn = container.querySelector(".dc-print-button");
    const sheetEl = container.querySelector(".dc-sheet");

    backBtn.addEventListener("click", () => window.history.back());

    /* ---- Save / Print → PDF + download + confirm ---- */

    let pdfBusy = false;

    const baseStatusText = `Delivery Challan ${data.dcNumber || ""}`;

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function handleSaveAndConfirm() {
      if (pdfBusy) return;

      if (!data.dcNumber) {
        setStatus("Save failed (missing DC number)");
        window.alert(
          "Cannot save the PDF: Delivery Challan number is missing.",
        );
        return;
      }

      pdfBusy = true;

      const filename = data.dcNumber + ".pdf";

      setStatus("Generating PDF…");

      // Make sure the filler-row sizing / images are settled before capture.
      layoutReady
        .catch(function () {
          /* swallow — we still want to try the PDF */
        })
        .then(function () {
          return buildPdfBlob(sheetEl, filename);
        })
        .then(function (blob) {
          // 1. Local download — same user-visible behaviour as PO/Quotation.
          downloadBlob(blob, filename);

          setStatus("Uploading & confirming…");

          // 2. Upload + confirm on the backend.
          return postPdfToBackend(data.dcNumber, blob, filename);
        })
        .then(function () {
          setStatus("Confirmed ✓  (PDF saved)");
        })
        .catch(function (error) {
          console.error(
            "[DeliveryChallanPrint] Save / confirm failed:",
            error,
          );

          setStatus("Save failed");

          window.alert(
            "The PDF was downloaded locally, but the Delivery Challan could not be confirmed on the server.\n\n" +
              (error && error.message ? error.message : "Unknown error."),
          );
        })
        .then(function () {
          pdfBusy = false;
        });
    }

    // saveBtn.addEventListener("click", handleSaveAndConfirm);
    printBtn.addEventListener("click", handleSaveAndConfirm);

    /* ---- Image error handling ---- */

    container.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", hideBrokenAsset, { once: true });
    });

    /* ---- Filler height / layout settle ---- */

    // The first calculation prevents a fast Print click using the 1px fallback.
    setFillerHeight();

    layoutReady = waitForImages(container.querySelectorAll("img")).then(
      () => {
        return new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              setFillerHeight();
              resolve();
            }),
          ),
        );
      },
    );

    setStatus(baseStatusText);
  }

  /* =======================================================================
     BOOT
     ======================================================================= */

  function initialiseFromUrl() {
    const encoded = new URLSearchParams(window.location.search).get("data");
    if (!encoded) return false;
    try {
      renderDeliveryChallan(JSON.parse(encoded));
      return true;
    } catch (error) {
      console.error(
        "Unable to read Delivery Challan data from the URL.",
        error,
      );
      return false;
    }
  }

  // Keeps the existing standalone API available to the preview/open-window workflow.
  window.generateDeliveryChallanPrint = renderDeliveryChallan;

  window.addEventListener("message", (event) => {
    if (
      event.origin === window.location.origin &&
      event.data &&
      event.data.type === "delivery-challan-data"
    ) {
      renderDeliveryChallan(event.data.data);
    }
  });

  window.addEventListener("beforeprint", setFillerHeight);
  window.addEventListener("resize", () =>
    requestAnimationFrame(setFillerHeight),
  );

  if (!initialiseFromUrl()) {
    container.innerHTML =
      '<div class="dc-empty-state"><h1>Delivery Challan</h1><p>Open this page from the Delivery Challan preview to print or save a PDF.</p></div>';
  }
})();