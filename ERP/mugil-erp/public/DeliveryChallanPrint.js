(function () {
  'use strict';

const ASSETS = {
  // Header logos
  logo: '/mugil-logo.png',
  logoRight: '/globe-logo.png',

  // Footer logos
  eyeDonation: '/eye-donation.png',
  bloodDonation: '/blood-donation.png',
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

  const container = document.getElementById('print-container');
  let layoutReady = Promise.resolve();

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(date);
  }

  function normaliseData(input) {
    const data = input || {};
    const customer = data.customer || {};
    return {
      dcNumber: data.dcNumber || '',
      dcDate: data.dcDate || '',
      poNumber: data.poNumber || '',
      poDate: data.poDate || '',
      billNumber: data.billNumber || '',
      billDate: data.billDate || '',
      deliveryAt: data.deliveryAt || '',
      companyAddressId: data.companyAddressId || 'unit1',
      amountInWords: data.amountInWords || '',
      preparedBy: data.preparedBy || '',
      customer: {
        companyName: customer.companyName || '',
        address: customer.address || '',
        contactPerson: customer.contactPerson || '',
        phone: customer.phone || '',
        gstNumber: customer.gstNumber || '',
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

  const returnableText = customer.returnable ? 'Yes' : 'No';

  return `
    <div class="dc-customer-extra">
      ${fields.join(' &nbsp;|&nbsp; ')}
      <div class="dc-returnable-print">
        Returnable: ${returnableText}
      </div>
    </div>
  `;
}

  function referenceRow(leftLabel, leftValue, rightLabel, rightValue, isNumber) {
    return `
      <div class="dc-reference-row${isNumber ? ' dc-reference-row--primary' : ''}">
        <span class="dc-reference-entry">
          <span class="dc-reference-label">${leftLabel}</span>
          <span class="dc-reference-value${isNumber ? ' dc-reference-number' : ''}">${escapeHtml(leftValue)}</span>
        </span>
        <span class="dc-reference-entry">
          <span class="dc-reference-label">${rightLabel || ''}</span>
          <span class="dc-reference-value">${escapeHtml(rightValue)}</span>
        </span>
      </div>`;
  }

  function makeItemRows(items) {
    return items.map((item, index) => `
      <tr class="dc-item-row">
        <td class="dc-cell-center">${index + 1}</td>
        <td>${escapeHtml(item && item.description)}</td>
        <td class="dc-cell-center">${escapeHtml(item && item.quantity)}</td>
        <td class="dc-cell-center">${escapeHtml(item && item.rate)}</td>
        <td>${escapeHtml(item && item.remarks)}</td>
      </tr>`).join('');
  }

  function hideBrokenAsset(event) {
    const wrapper = event.currentTarget.parentElement;
    if (wrapper) wrapper.classList.add('is-missing');
    event.currentTarget.remove();
  }

  function waitForImages(images) {
    return Promise.all(Array.from(images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  function setFillerHeight() {
    const sheet = container && container.querySelector('.dc-sheet');
    const table = sheet && sheet.querySelector('.dc-items');
    const filler = table && table.querySelector('.dc-filler-row');
    if (!sheet || !table || !filler) return;

    const fillerCells = Array.from(filler.cells);
    fillerCells.forEach((cell) => { cell.style.height = '1px'; });
    sheet.classList.remove('dc-sheet--overflow');

    const fixedSections = [
      sheet.querySelector('.dc-header'),
      sheet.querySelector('.dc-document'),
      sheet.querySelector('.dc-rupees'),
      sheet.querySelector('.dc-signature'),
      sheet.querySelector('.dc-footer'),
    ];
    const fixedHeight = fixedSections.reduce(
      (total, section) => total + (section ? section.getBoundingClientRect().height : 0), 0,
    );
    const headerHeight = table.tHead ? table.tHead.getBoundingClientRect().height : 0;
    const itemHeight = Array.from(table.tBodies[0].querySelectorAll('.dc-item-row'))
      .reduce((total, row) => total + row.getBoundingClientRect().height, 0);
    const styles = getComputedStyle(sheet);
    const printableHeight = sheet.clientHeight
      - parseFloat(styles.paddingTop)
      - parseFloat(styles.paddingBottom);
    const remaining = Math.floor(printableHeight - fixedHeight - headerHeight - itemHeight - 2);

    if (remaining <= 1) {
      sheet.classList.add('dc-sheet--overflow');
      fillerCells.forEach((cell) => { cell.style.height = '1px'; });
      return;
    }

    fillerCells.forEach((cell) => { cell.style.height = `${remaining}px`; });
  }

  function renderDeliveryChallan(input) {
    if (!container) return;
    const data = normaliseData(input);
    const customer = data.customer;

    container.innerHTML = `
  <div class="dc-print-controls" aria-label="Print controls">
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
        (COMPANY_ADDRESSES.find(
          (address) => address.id === data.companyAddressId
        ) || COMPANY_ADDRESSES[0]).address
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
              <span class="dc-customer-name">${escapeHtml(customer.companyName)}</span>
            </div>
            <div class="dc-customer-address">${escapeHtml(customer.address)}</div>
            ${customerExtras(customer)}
          </div>
          <div class="dc-reference">
            ${referenceRow('No.', data.dcNumber, 'Date:', formatDate(data.dcDate), true)}
            ${referenceRow('PO/LO/WO No.', data.poNumber, 'Date:', formatDate(data.poDate), false)}
            ${referenceRow('Bill No.', data.billNumber, 'Date:', formatDate(data.billDate), false)}
            ${referenceRow('Delivery at', data.deliveryAt, '', '', false)}
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
          <span class="dc-rupees-value">${escapeHtml(data.amountInWords)}</span>
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

    container.querySelector('.dc-back-button').addEventListener('click', () => window.history.back());
    container.querySelector('.dc-print-button').addEventListener('click', () => {
      layoutReady.finally(() => window.print());
    });
    container.querySelectorAll('img').forEach((image) => {
      image.addEventListener('error', hideBrokenAsset, { once: true });
    });

    // The first calculation prevents a fast Print click using the 1px fallback.
    setFillerHeight();
    layoutReady = waitForImages(container.querySelectorAll('img')).then(() => {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        setFillerHeight();
        resolve();
      })));
    });
  }

  function initialiseFromUrl() {
    const encoded = new URLSearchParams(window.location.search).get('data');
    if (!encoded) return false;
    try {
      renderDeliveryChallan(JSON.parse(encoded));
      return true;
    } catch (error) {
      console.error('Unable to read Delivery Challan data from the URL.', error);
      return false;
    }
  }

  // Keeps the existing standalone API available to the preview/open-window workflow.
  window.generateDeliveryChallanPrint = renderDeliveryChallan;
  window.addEventListener('message', (event) => {
    if (event.origin === window.location.origin && event.data && event.data.type === 'delivery-challan-data') {
      renderDeliveryChallan(event.data.data);
    }
  });
  window.addEventListener('beforeprint', setFillerHeight);
  window.addEventListener('resize', () => requestAnimationFrame(setFillerHeight));

  if (!initialiseFromUrl()) {
    container.innerHTML = '<div class="dc-empty-state"><h1>Delivery Challan</h1><p>Open this page from the Delivery Challan preview to print or save a PDF.</p></div>';
  }
}());
