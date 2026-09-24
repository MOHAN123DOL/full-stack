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
     ======================================================================= */

  function buildPdfBlob(sourceElement, filename) {
    return loadHtml2Pdf().then(function (html2pdf) {
      if (!sourceElement) {
        throw new Error(
          "PDF generation failed: source element was not found.",
        );
      }

      const options = {
        margin: 0,
        filename: filename || "delivery-challan.pdf",
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

      const worker = html2pdf().set(options).from(sourceElement);

      return worker
        .toPdf()
        .get("pdf")
        .then(function () {
          return worker.outputPdf("blob");
        });
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

    saveBtn.addEventListener("click", handleSaveAndConfirm);
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