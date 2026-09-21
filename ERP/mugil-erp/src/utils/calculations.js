// Indian Rupee formatting (₹ 12,50,000.00 style)
export function formatINR(value, { withSymbol = true, decimals = 2 } = {}) {
  const n = Number(value) || 0;
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withSymbol ? `₹ ${formatted}` : formatted;
}

export function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Full PO-style line item: qty * unitPrice, minus a % discount, plus a % GST
export function calcLineItem(item) {
  const qty = toNumber(item.qty);
  const unitPrice = toNumber(item.unitPrice);
  const discountPct = toNumber(item.discount);
  const gstPct = toNumber(item.gstPercent);

  const gross = qty * unitPrice;
  const discountAmount = gross * (discountPct / 100);
  const taxable = gross - discountAmount;
  const gstAmount = taxable * (gstPct / 100);
  const total = taxable + gstAmount;

  return { gross, discountAmount, taxable, gstAmount, total };
}

// Simple quotation-style line item: qty * rate (no per-line discount/GST)
export function calcQuoteLine(item) {
  const qty = toNumber(item.qty);
  const rate = toNumber(item.rate);
  return { total: qty * rate };
}

export function summarizePOItems(items, { interState = false } = {}) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;

  items.forEach((item) => {
    const { gross, discountAmount, taxable, gstAmount } = calcLineItem(item);
    subtotal += gross;
    discountTotal += discountAmount;
    taxableTotal += taxable;
    gstTotal += gstAmount;
  });

  const cgst = interState ? 0 : gstTotal / 2;
  const sgst = interState ? 0 : gstTotal / 2;
  const igst = interState ? gstTotal : 0;

  const rawGrandTotal = taxableTotal + gstTotal;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundedGrandTotal - rawGrandTotal;

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    cgst,
    sgst,
    igst,
    gstTotal,
    roundOff,
    grandTotal: roundedGrandTotal,
  };
}

export function summarizeQuoteItems(items, { gstPercent = 18 } = {}) {
  const subtotal = items.reduce((sum, item) => sum + calcQuoteLine(item).total, 0);
  const gstAmount = subtotal * (gstPercent / 100);
  const grandTotal = subtotal + gstAmount;
  return { subtotal, gstPercent, gstAmount, grandTotal };
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

let idCounter = 1;
export function nextId(prefix = 'row') {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
