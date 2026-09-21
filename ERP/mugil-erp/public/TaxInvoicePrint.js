/* =========================================================================
   TaxInvoicePrint.js
   ========================================================================= */

(function () {
  "use strict";

  var PAYLOAD_KEY = "tip-print-payload-v1";
  var ROOT_ID = "tip-print-app-root";

  /* ============================ PAGE GEOMETRY ============================ */
  var MM_TO_PX = 96 / 25.4;

  var PAGE_MM = {
    width: 210,
    height: 297,
    marginTop: 8,
    marginLeft: 8,
    marginRight: 8,
    marginBottom: 6,
    footerGap: 2,
    headerGap: 0,
  };

 var LOGO_LEFT_SRC = "/mugil-logo.png";
var LOGO_RIGHT_SRC = "/globe-logo.png";

var FOOTER_BLOOD_SRC = "/eye-donation.png";
var FOOTER_EYE_SRC = "/blood-donation.png"; 
  var DEFAULT_TAGLINE = "கண்தானம் செய்வீர்! இரத்ததானம் செய்வீர்!!";

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
    return dd + "." + mm + "." + yyyy;
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

  function getItemAmount(item) {
    var amt = item && item.amount;
    if (amt !== undefined && amt !== null && amt !== "") return toNumber(amt);
    var qty = toNumber(pick(item, ["quantity", "qty"], 0));
    var rate = toNumber(pick(item, ["rate", "price", "unitRate"], 0));
    return qty * rate;
  }

  function waitForImages(container) {
    var imgs = container.querySelectorAll ? container.querySelectorAll("img") : [];
    var pending = [];
    for (var i = 0; i < imgs.length; i++) {
      pending.push(imgs[i]);
    }
    if (!pending.length) return Promise.resolve();

    return Promise.all(
      pending.map(function (img) {
        return new Promise(function (resolve) {
          if (img.complete) {
            resolve();
            return;
          }
          var settled = false;
          function settle() {
            if (settled) return;
            settled = true;
            img.removeEventListener("load", settle);
            img.removeEventListener("error", settle);
            resolve();
          }
          img.addEventListener("load", settle);
          img.addEventListener("error", settle);
          setTimeout(settle, 4000);
        });
      })
    );
  }

  /* ============================ PUBLIC ENTRY POINT ============================ */

  function generateTaxInvoicePrint(data) {
    if (!data) {
      console.error("[TaxInvoicePrint] generateTaxInvoicePrint() called without invoice data.");
      return;
    }
    var payload = { data: data, ts: Date.now() };
    try {
      localStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("[TaxInvoicePrint] Could not stage invoice data for the print tab:", e);
      return;
    }
    var printTab = window.open("/TaxInvoicePrint.html", "_blank");
    if (!printTab) {
      window.alert(
        "Your browser blocked the print preview pop-up. Please allow pop-ups for this site and try again."
      );
    }
  }

  if (typeof window !== "undefined") {
    window.generateTaxInvoicePrint = generateTaxInvoicePrint;
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
          "tip-error",
          "No invoice data was found for this print preview. Please go back to the Tax Invoice form and use " +
            'its "Preview Invoice" action again.'
        )
      );
      return;
    }

    buildDocument(root, payload.data).catch(function (err) {
      console.error("[TaxInvoicePrint] Failed to build invoice:", err);
      root.appendChild(
        el(
          "p",
          "tip-error",
          "Something went wrong while preparing this invoice for print. Please go back and try again."
        )
      );
    });
  });

  /* ============================ BLOCK BUILDERS ============================ */

  function buildHeaderNode(company) {
    var wrap = el("div", "tip-header");

    var table = el("table", "tip-header-table");
    var tbody = el("tbody");

    // ROW 1: GSTIN on left | INVOICE in center | Cell numbers on right
    var row1 = el("tr");
    
    var leftCell1 = el("td", "tip-h-gstin");
    leftCell1.innerHTML =
      "GSTIN: " + escapeHtml(company.gstin || "33AHDPR8644K1ZX");
    
    var centerCell1 = el("td", "tip-h-title");
    centerCell1.textContent = "INVOICE";
    
    var rightCell1 = el("td", "tip-h-cell");
    rightCell1.innerHTML =
      "Cell: " +
      escapeHtml(company.cell1 || "98424-52887") +
      "<br/>" +
      escapeHtml(company.cell2 || "89039-52887");
    
    row1.appendChild(leftCell1);
    row1.appendChild(centerCell1);
    row1.appendChild(rightCell1);

    // ROW 2: Logo left | Company name + Works address in center | Logo right
    var row2 = el("tr");
    
    var logoLeftTd = el("td", "tip-h-logo tip-h-logo--left");
    logoLeftTd.innerHTML = '<img src="' + LOGO_LEFT_SRC + '" alt="Logo" />';
    
    var companyTd = el("td", "tip-h-company");
    var worksLine1 = company.worksLine1 || "Works: 2/89. SF No 105, Thanjavur Main Road, Devarayaneri, Assoor Post, Trichy - 620 015.";
    var worksLine2 = company.worksLine2 || "";
    
    companyTd.innerHTML =
      '<div class="tip-company-name">' +
      escapeHtml(company.name || "MUGIL ENGINEERING INDUSTRY") +
      "</div>" +
      '<div class="tip-works-line">' + escapeHtml(worksLine1) + "</div>" +
      (worksLine2 ? '<div class="tip-works-line">' + escapeHtml(worksLine2) + "</div>" : "");
    
    var logoRightTd = el("td", "tip-h-logo tip-h-logo--right");
    logoRightTd.innerHTML = '<img src="' + LOGO_RIGHT_SRC + '" alt="Logo" />';
    
    row2.appendChild(logoLeftTd);
    row2.appendChild(companyTd);
    row2.appendChild(logoRightTd);

    tbody.appendChild(row1);
    tbody.appendChild(row2);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildFooterNode() {
    var wrap = el("div", "tip-footer");

    var bloodLogo = el("img", "tip-footer__logo tip-footer__logo--blood");
    bloodLogo.src = FOOTER_BLOOD_SRC;
    bloodLogo.alt = "Blood Donation";

    var tagline = el("p", "tip-footer__tagline", escapeHtml(DEFAULT_TAGLINE));

    var eyeLogo = el("img", "tip-footer__logo tip-footer__logo--eye");
    eyeLogo.src = FOOTER_EYE_SRC;
    eyeLogo.alt = "Eye Donation";

    wrap.appendChild(bloodLogo);
    wrap.appendChild(tagline);
    wrap.appendChild(eyeLogo);
    return wrap;
  }

  function buildMetaTableNode(formData, placeOfSupply) {
    var table = el("table", "tip-meta-table");
    var tbody = el("tbody");

    function row(leftLabel, leftVal, rightLabel, rightVal) {
      return el(
        "tr",
        "",
        "<td><strong>" +
          escapeHtml(leftLabel) +
          "</strong> " +
          escapeHtml(leftVal || "—") +
          "</td><td><strong>" +
          escapeHtml(rightLabel) +
          "</strong> " +
          escapeHtml(rightVal || "—") +
          "</td>"
      );
    }

    tbody.appendChild(
      row("Invoice No :", formData.invoiceNumber, "Vehicle No:", formData.vehicleNumber)
    );
    tbody.appendChild(
      row(
        "Date of Invoice:",
        fmtDate(formData.invoiceDate),
        "Mode of Transport:",
        formData.modeOfTransport
      )
    );
    tbody.appendChild(
      row(
        "Date of Supply:",
        fmtDate(formData.dateOfSupply),
        "Reverse Charge (Y/N):",
        formData.reverseCharge
      )
    );
    tbody.appendChild(
      row(
        "Place of Supply:",
        placeOfSupply && placeOfSupply.state,
        "Name & Code of State :",
        placeOfSupply && placeOfSupply.state
          ? placeOfSupply.state + " & " + (placeOfSupply.stateNameCode || "")
          : placeOfSupply && placeOfSupply.stateNameCode
      )
    );

    table.appendChild(tbody);
    return table;
  }

  function buildPartyBlock(party) {
    var name = pick(party, ["companyName", "company", "name"]);
    var gst = pick(party, ["gst", "gstin", "gstNumber"]);
    var address = pick(party, ["address"]);
    var html = "";
    html += '<p class="tip-party-name">Name: ' + escapeHtml(name || "—") + "</p>";
    html += "<p>GSTIN: " + escapeHtml(gst || "—") + "</p>";
    html += "<p>Address: " + escapeHtml(address || "—") + "</p>";
    return html;
  }

function buildPartyTableNode(receiver, consignee) {
  var table = el("table", "tip-party-table");
  var tbody = el("tbody");

  tbody.appendChild(
      el(
        "tr",
        "tip-party-heading",
        "<td>Details of Receiver (Billed To)</td><td>Details of Consignee (Shipped To)</td>"
      )
    );

    tbody.appendChild(
      el(
        "tr",
        "",
        "<td>" + buildPartyBlock(receiver) + "</td><td>" + buildPartyBlock(consignee) + "</td>"
      )
    );

    table.appendChild(tbody);
    return table;
  }

  function buildItemsTableHeaderRow() {
    return el(
      "tr",
      "",
      '<th class="tip-col-sno">SL.NO</th>' +
        '<th class="tip-col-desc">Description of Goods</th>' +
        '<th class="tip-col-hsn">HSN / SAC</th>' +
        '<th class="tip-col-qty">Quantity</th>' +
        '<th class="tip-col-rate">Rate</th>' +
        '<th class="tip-col-amt">Amount Rs</th>'
    );
  }

  function buildItemRow(item, idx) {
    var qty = pick(item, ["quantity", "qty"], "—");
    var unit = pick(item, ["unit"], "");
    var qtyDisplay = unit ? qty + " " + unit : qty;
    return el(
      "tr",
      "",
      '<td class="tip-col-sno">' +
        (idx + 1) +
        '</td><td class="tip-col-desc">' +
        escapeHtml(pick(item, ["description", "name"], "—")) +
        '</td><td class="tip-col-hsn">' +
        escapeHtml(pick(item, ["hsn", "hsnSac", "sac"], "—")) +
        '</td><td class="tip-col-qty">' +
        escapeHtml(qtyDisplay) +
        '</td><td class="tip-col-rate">' +
        fmtINR(pick(item, ["rate", "price", "unitRate"], 0)) +
        '</td><td class="tip-col-amt">' +
        fmtINR(getItemAmount(item)) +
        "</td>"
    );
  }

  function buildEmptyRow() {
    return el("tr", "tip-empty-row", '<td colspan="6">No items added</td>');
  }

  function buildTotalRow(subtotal) {
    return el(
      "tr",
"tip-total-row",
'<td class="tip-col-sl"></td>' +
'<td class="tip-col-desc"></td>' +
'<td class="tip-col-hsn"></td>' +
'<td class="tip-col-qty"></td>' +
'<td class="tip-col-rate tip-total-label">Total</td>' +
'<td class="tip-col-amt">' +
fmtINR(subtotal) +
"</td>"
);
  }

  var ITEM_COL_CLASSES = [
    "tip-col-sno",
    "tip-col-desc",
    "tip-col-hsn",
    "tip-col-qty",
    "tip-col-rate",
    "tip-col-amt",
  ];

  function buildFillerRow(heightPx) {
    // IMPORTANT: this must render as SIX separate <td> cells (one per
    // item-table column) rather than a single <td colspan="6">. A
    // colspan cell only has an outer left/right border, which erases the
    // vertical column divider lines through the empty goods-table area.
    // Six individual cells (matching the item-row column classes so the
    // fixed table-layout keeps their widths identical) let each column's
    // left/right border continue naturally through the blank space.
    var tr = el("tr", "tip-filler-row");
    var h = Math.max(0, heightPx) + "px";
    ITEM_COL_CLASSES.forEach(function (cls) {
      var td = document.createElement("td");
      td.className = cls;
      td.style.height = h;
      tr.appendChild(td);
    });
    return tr;
  }

  function buildWordsTaxTableNode(totals, formData) {
    var table = el("table", "tip-words-table");
    var colgroup = el("colgroup");
    colgroup.innerHTML =
  '<col class="tip-words-column" />' +
  '<col class="tip-tax-label-column" />' +
  '<col class="tip-tax-value-column" />';
    var tbody = el("tbody");
    

    var wordsHtml =
      '<p class="tip-words-label">Total Invoice Amount ( in Words ):</p>' +
      '<p class="tip-words-value">' +
      escapeHtml(totals.amountInWords || "") +
      "</p>";
    var wordsTd = el("td", "tip-words-cell", wordsHtml);
wordsTd.rowSpan = 5;
    function taxRow(label, pct, value, isTotal) {
      var tr = el("tr", isTotal ? "tip-grand-total-row" : "");
      var pctText =
        pct !== undefined && pct !== null && pct !== "" && toNumber(pct) > 0
          ? escapeHtml(pct + "%")
          : "";
      var labelTd = el(
        "td",
        "tip-tax-label",
        '<span class="tip-tax-label-text">' +
          escapeHtml(label) +
          '</span><span class="tip-tax-pct-text">' +
          pctText +
          "</span>"
      );
      labelTd.colSpan = 1;
     var valueTd = el(
  "td",
  "tip-tax-value",
  fmtINR(value)
);

      tr.appendChild(labelTd);
      tr.appendChild(valueTd);
      return tr;
    }

    var row1 = taxRow("IGST", formData.igstPct, totals.igstAmount, false);

row1.insertBefore(wordsTd, row1.firstChild);

tbody.appendChild(row1);
tbody.appendChild(taxRow("CGST", formData.cgstPct, totals.cgstAmount, false));
tbody.appendChild(taxRow("SGST", formData.sgstPct, totals.sgstAmount, false));
tbody.appendChild(taxRow("Rounded Off", "", totals.roundedOff, false));
tbody.appendChild(taxRow("TOTAL", "", totals.grandTotal, true));

    table.appendChild(colgroup);
    table.appendChild(tbody);
    return table;
  }

  function buildBottomBlockNode(company, formData) {
    // NOTE ON STRUCTURE: this used to be a single <tr> with all the left
    // text (PAN + Declaration + Enclosures) crammed into one <td>, and all
    // the right text (Bank Details heading + bank lines + signature) into
    // one <td>. Because there was only one row, the table's normal
    // per-cell borders never produced the horizontal dividers the original
    // invoice has between "PAN / Bank Details" heading, the
    // "Declaration / Bank info" block, and the "Enclosures / Signature"
    // block. Splitting the SAME content across three <tr> rows (no text
    // changed) lets the existing td border rule draw those horizontal
    // lines automatically, while the 50%-width columns keep one
    // continuous vertical divider down the whole section.
    var table = el("table", "tip-bottom-table");
    var tbody = el("tbody");

    var enclosureLabels = Object.keys(formData.enclosures || {}).filter(function (k) {
      return formData.enclosures[k];
    });
    var enclosureHtml = enclosureLabels.length
      ? '<ol class="tip-encl-list">' +
        enclosureLabels
          .map(function (label) {
            return "<li>" + escapeHtml(label) + "</li>";
          })
          .join("") +
        "</ol>"
      : "";

    // Row 1: Company's PAN  |  Company's Bank Details (heading)
    var panHtml =
      '<p class="tip-pan-line">Company\'s PAN : ' + escapeHtml(company.pan || "") + "</p>";
    var bankHeadingHtml = '<p class="tip-bottom-heading">Company\'s Bank Details</p>';
    var row1 = el("tr", "tip-bottom-row");
    row1.appendChild(el("td", "", panHtml));
    row1.appendChild(el("td", "", bankHeadingHtml));

    // Row 2: Declaration (+ text)  |  Bank Name / A/C No / Branch / IFSC
    var leftHtml =
      '<p class="tip-bottom-heading">Declaration</p>' +
      '<p class="tip-declaration-text">' +
      escapeHtml(formData.declaration || "") +
      "</p>";

    var rightHtml =
      '<p class="tip-bank-line">Bank Name: ' +
      escapeHtml(formData.bankName || "") +
      "</p>" +
      '<p class="tip-bank-line">A/C No: ' +
      escapeHtml(formData.accountNumber || "") +
      "</p>" +
      '<p class="tip-bank-line">Branch : ' +
      escapeHtml(formData.branch || "") +
      "</p>" +
      '<p class="tip-bank-line">IFSC Code: ' +
      escapeHtml(formData.ifsc || "") +
      "</p>";
    var row2 = el("tr", "tip-bottom-row");
    row2.appendChild(el("td", "", leftHtml));
    row2.appendChild(el("td", "", rightHtml));

    // Row 3: Enclosures  |  Signature block
    var enclLeftHtml = enclosureLabels.length
      ? '<p class="tip-bottom-heading">Encl :</p>' + enclosureHtml
      : "";
    var sigRightHtml =
      '<p class="tip-sig-for">For ' +
      escapeHtml(company.name || "") +
      "</p>" +
      '<div class="tip-sig-space"></div>' +
      '<p class="tip-sig-authorised">Authorised Signature</p>';
    var row3 = el("tr", "tip-bottom-row");
    row3.appendChild(el("td", "", enclLeftHtml));
    row3.appendChild(el("td", "", sigRightHtml));

    tbody.appendChild(row1);
    tbody.appendChild(row2);
    tbody.appendChild(row3);
    table.appendChild(tbody);
    return table;
  }

  /* ============================ THE PAGINATION ENGINE ============================ */

  async function buildDocument(root, data) {
    var company = data.company || {};
    var formData = data.formData || {};
    var items = Array.isArray(data.items) ? data.items : [];
    var receiver = data.receiver || null;
    var consignee = data.consignee || null;
    var placeOfSupply = data.placeOfSupply || {};
    var totals = data.totals || {};

    var subtotal =
      totals.subtotal !== undefined
        ? totals.subtotal
        : items.reduce(function (sum, it) {
            return sum + getItemAmount(it);
          }, 0);

    // ---- toolbar (screen-only) ----
    var toolbar = el("div", "tip-toolbar");
    var status = el(
      "span",
      "tip-toolbar__status",
      "Tax Invoice " + escapeHtml(formData.invoiceNumber || "")
    );
    var saveBtn = el("button", "tip-btn tip-btn--save", "Save");
saveBtn.type = "button";

    var closeBtn = el("button", "tip-btn tip-btn--ghost", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", function () {
      window.close();
    });
    var printBtn = el("button", "tip-btn tip-btn--primary", "🖨 Print / Save as PDF");
    printBtn.type = "button";
    printBtn.addEventListener("click", function () {
      window.print();
    });
    toolbar.appendChild(status);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(closeBtn);
    toolbar.appendChild(printBtn);
    root.appendChild(toolbar);

    var pagesHost = el("div", "tip-pages");
    root.appendChild(pagesHost);

    // ---- geometry (px) ----
    // Rounded to whole pixels: 96/25.4 is a repeating decimal, so leaving
    // these fractional lets the header (sized with an explicit width) and
    // the body (previously sized with left+right) round to different
    // sub-pixels in the browser, producing a hairline step where their
    // right borders should meet.
    var pageWidthPx = Math.round(PAGE_MM.width * MM_TO_PX);
    var pageHeightPx = Math.round(PAGE_MM.height * MM_TO_PX);
    var marginTopPx = Math.round(PAGE_MM.marginTop * MM_TO_PX);
    var marginLeftPx = Math.round(PAGE_MM.marginLeft * MM_TO_PX);
    var marginRightPx = Math.round(PAGE_MM.marginRight * MM_TO_PX);
    var marginBottomPx = Math.round(PAGE_MM.marginBottom * MM_TO_PX);
    var footerGapPx = Math.round(PAGE_MM.footerGap * MM_TO_PX);
    var headerGapPx = Math.round(PAGE_MM.headerGap * MM_TO_PX);
    var contentWidthPx = pageWidthPx - marginLeftPx - marginRightPx;

    // ---- measurement sandbox ----
    var sandbox = el("div", "tip-content");
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

    function measureItemsTable(headerRow, rows, includeTotalRow, extraFillerHeight) {
      var t = el("table", "tip-items-table");
      var thead = el("thead");
      thead.appendChild(headerRow.cloneNode(true));
      t.appendChild(thead);
      var tbody = el("tbody");
      rows.forEach(function (r) {
        tbody.appendChild(r);
      });
      var fillerNode = null;
      if (extraFillerHeight && extraFillerHeight > 0) {
        fillerNode = buildFillerRow(extraFillerHeight);
        tbody.appendChild(fillerNode);
      }
      var totalRowNode = null;
      if (includeTotalRow) {
        totalRowNode = buildTotalRow(subtotal);
        tbody.appendChild(totalRowNode);
      }
      t.appendChild(tbody);
      var h = measure(t);
      rows.forEach(function (r) {
        tbody.removeChild(r);
      });
      if (fillerNode) tbody.removeChild(fillerNode);
      if (totalRowNode) tbody.removeChild(totalRowNode);
      return h;
    }

    // ---- header/footer ----
    var headerNode = buildHeaderNode(company);
    var footerNode = buildFooterNode();
    sandbox.appendChild(headerNode);
    sandbox.appendChild(footerNode);
    status.textContent = "Loading invoice…";
    await Promise.all([waitForImages(headerNode), waitForImages(footerNode)]);

    var headerHeight = measure(headerNode);
    var footerHeight = measure(footerNode);

    var contentTopPx = marginTopPx + headerHeight + headerGapPx;
    // Pull the body up into the header by a few pixels so the header's
    // left/right border lines are guaranteed to physically overlap the
    // body's top border, rather than merely sit close to it. A close-but-
    // not-touching gap (even sub-pixel) renders as a visible white
    // sliver; true overlap of two black lines never does.
    var HEADER_BODY_OVERLAP_PX = 3;
    contentTopPx -= HEADER_BODY_OVERLAP_PX;
    var footerTopPx = pageHeightPx - marginBottomPx - footerHeight - footerGapPx;
    var availableHeightPx = footerTopPx - contentTopPx;
    if (availableHeightPx < 50) {
      availableHeightPx = Math.max(50, availableHeightPx);
    }

    // ---- indivisible front-matter blocks ----
    var metaTableNode = buildMetaTableNode(formData, placeOfSupply);
    var metaTableHeight = measure(metaTableNode);

    var partyTableNode = buildPartyTableNode(receiver, consignee);
    var partyTableHeight = measure(partyTableNode);

    // ---- items table pieces ----
    var tableHeaderRow = buildItemsTableHeaderRow();
    var tableHeaderHeight = (function () {
      var t = el("table", "tip-items-table");
      var thead = el("thead");
      thead.appendChild(tableHeaderRow);
      t.appendChild(thead);
      var h = measure(t);
      thead.removeChild(tableHeaderRow);
      return h;
    })();

    var rowNodes = items.length ? items.map(buildItemRow) : [buildEmptyRow()];
    var rowHeights = rowNodes.map(function (tr) {
      return measureItemsTable(tableHeaderRow, [tr], false, 0) - tableHeaderHeight;
    });

    var totalRowHeight =
      measureItemsTable(tableHeaderRow, [], true, 0) - tableHeaderHeight;

    // ---- after-items blocks ----
    var wordsTaxNode = buildWordsTaxTableNode(totals, formData);
    var wordsTaxHeight = measure(wordsTaxNode);

    var bottomBlockNode = buildBottomBlockNode(company, formData);
    var bottomBlockHeight = measure(bottomBlockNode);

    document.body.removeChild(sandbox);

    // ---- pagination ----
    var rowsTotalHeight = rowHeights.reduce(function (a, b) {
      return a + b;
    }, 0);
    var singlePageContentHeight =
      metaTableHeight +
      partyTableHeight +
      tableHeaderHeight +
      rowsTotalHeight +
      totalRowHeight +
      wordsTaxHeight +
      bottomBlockHeight;

    var pages = [[]];

    if (singlePageContentHeight <= availableHeightPx) {
      var leftover = availableHeightPx - singlePageContentHeight;

      var itemsTable = el("table", "tip-items-table");
      var thead = el("thead");
      thead.appendChild(tableHeaderRow);
      itemsTable.appendChild(thead);
      var tbody = el("tbody");
      rowNodes.forEach(function (r) {
        tbody.appendChild(r);
      });
      if (leftover > 0.5) {
        tbody.appendChild(buildFillerRow(leftover));
      }
      tbody.appendChild(buildTotalRow(subtotal));
      itemsTable.appendChild(tbody);

      pages[0].push(metaTableNode);
      pages[0].push(partyTableNode);
      pages[0].push(itemsTable);
      pages[0].push(wordsTaxNode);
      pages[0].push(bottomBlockNode);
    } else {
      var remaining = availableHeightPx;
      var curPage = pages[0];

      function placeIndivisible(node, height) {
        if (curPage.length > 0 && height > remaining) {
          pages.push([]);
          curPage = pages[pages.length - 1];
          remaining = availableHeightPx;
        }
        curPage.push(node);
        remaining -= height;
      }

      placeIndivisible(metaTableNode, metaTableHeight);
      placeIndivisible(partyTableNode, partyTableHeight);

      function openFreshTablePageIfNeeded(forceNewPage) {
        if (forceNewPage || remaining - tableHeaderHeight < 0) {
          pages.push([]);
          curPage = pages[pages.length - 1];
          remaining = availableHeightPx;
        }
        remaining -= tableHeaderHeight;
      }

      openFreshTablePageIfNeeded(false);
      var tableChunks = [];
      var curChunk = { pageIndex: pages.length - 1, rows: [], includeTotal: false };

      rowNodes.forEach(function (tr, idx) {
        var rh = rowHeights[idx];
        if (remaining - rh < 0) {
          tableChunks.push(curChunk);
          openFreshTablePageIfNeeded(true);
          curChunk = { pageIndex: pages.length - 1, rows: [], includeTotal: false };
        }
        curChunk.rows.push(tr);
        remaining -= rh;
      });

      if (remaining - totalRowHeight < 0) {
        tableChunks.push(curChunk);
        openFreshTablePageIfNeeded(true);
        curChunk = { pageIndex: pages.length - 1, rows: [], includeTotal: true };
      } else {
        curChunk.includeTotal = true;
        remaining -= totalRowHeight;
      }
      tableChunks.push(curChunk);

      tableChunks.forEach(function (chunk) {
        var table = el("table", "tip-items-table");
        var th = el("thead");
        th.appendChild(tableHeaderRow.cloneNode(true));
        table.appendChild(th);
        var tb = el("tbody");
        chunk.rows.forEach(function (r) {
          tb.appendChild(r);
        });
        if (chunk.includeTotal) {
          tb.appendChild(buildTotalRow(subtotal));
        }
        table.appendChild(tb);
        pages[chunk.pageIndex].push(table);
      });

      placeIndivisible(wordsTaxNode, wordsTaxHeight);
      placeIndivisible(bottomBlockNode, bottomBlockHeight);
    }

    // ---- render final pages ----
    pages.forEach(function (pageNodes, idx) {
      var pageEl = el("div", "tip-page");
      pageEl.style.width = pageWidthPx + "px";
      pageEl.style.height = pageHeightPx + "px";

      var headerClone = idx === 0 ? headerNode : headerNode.cloneNode(true);
    headerClone.style.position = "absolute";
headerClone.style.top = marginTopPx + "px";
headerClone.style.left = marginLeftPx + "px";
headerClone.style.width = contentWidthPx + "px";
headerClone.style.boxSizing = "border-box";

      // Stretch the header's own bordered table a few extra pixels past
      // its natural content height, down into the overlap zone, so its
      // left/right border lines are guaranteed to be drawn all the way
      // to (and past) the seam with the body — not just close to it.
      var headerTableEl = headerClone.querySelector
        ? headerClone.querySelector(".tip-header-table")
        : null;
      if (headerTableEl) {
        headerTableEl.style.boxSizing = "border-box";
        headerTableEl.style.minHeight = (headerHeight + HEADER_BODY_OVERLAP_PX) + "px";
      }

      var contentWrap = el("div", "tip-content");
      contentWrap.style.position = "absolute";
      contentWrap.style.top = contentTopPx + "px";
      contentWrap.style.left = marginLeftPx + "px";
      contentWrap.style.width = contentWidthPx + "px";
      contentWrap.style.boxSizing = "border-box";
      contentWrap.style.height = availableHeightPx + "px";
      contentWrap.style.overflow = "visible";
      pageNodes.forEach(function (n) {
        contentWrap.appendChild(n);
      });

      var footerClone = idx === pages.length - 1 ? footerNode : footerNode.cloneNode(true);
      footerClone.style.position = "absolute";
      footerClone.style.left = marginLeftPx + "px";
      footerClone.style.width = contentWidthPx + "px";
      footerClone.style.boxSizing = "border-box";
      footerClone.style.bottom = marginBottomPx + "px";
      footerClone.style.height = footerHeight + "px";

      pageEl.appendChild(headerClone);
      pageEl.appendChild(contentWrap);
      pageEl.appendChild(footerClone);
      pagesHost.appendChild(pageEl);
    });

    status.textContent =
      "Tax Invoice " +
      (formData.invoiceNumber || "") +
      " — " +
      pages.length +
      " page" +
      (pages.length > 1 ? "s" : "");
  }
})();