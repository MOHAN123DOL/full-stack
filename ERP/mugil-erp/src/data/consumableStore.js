// consumableStore.js
// Simple pub/sub store for the Consumable module.
// Mirrors the pattern used by materialStore.js (plain JS module,
// in-memory arrays, subscribe/notify).

let listeners = [];

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// ---------------------------------------------------------------------------
// Sample Purchase Orders
// ---------------------------------------------------------------------------

let purchaseOrders = [
  {
    id: 1,
    poNumber: "PO-2001",
    supplier: "Ador Welding Ltd",
    consumableName: "Welding Rod",
    category: "Welding",
    unit: "Kg",
    orderedQty: 200,
    receivedQty: 0,
    pendingQty: 200,
    warehouse: "Warehouse A",
    expectedDate: "2025-01-15",
    status: "Pending",
  },
  {
    id: 2,
    poNumber: "PO-2002",
    supplier: "Praxair Gases",
    consumableName: "Gas Cylinder",
    category: "Gas",
    unit: "Nos",
    orderedQty: 30,
    receivedQty: 10,
    pendingQty: 20,
    warehouse: "Warehouse A",
    expectedDate: "2025-01-18",
    status: "Partially Received",
  },
  {
    id: 3,
    poNumber: "PO-2003",
    supplier: "Carborundum Universal",
    consumableName: "Grinding Wheel",
    category: "Abrasives",
    unit: "Nos",
    orderedQty: 50,
    receivedQty: 50,
    pendingQty: 0,
    warehouse: "Warehouse B",
    expectedDate: "2025-01-10",
    status: "Completed",
  },
  {
    id: 4,
    poNumber: "PO-2004",
    supplier: "Asian Paints Industrial",
    consumableName: "Paint",
    category: "Paint",
    unit: "Litre",
    orderedQty: 100,
    receivedQty: 40,
    pendingQty: 60,
    warehouse: "Warehouse A",
    expectedDate: "2025-01-20",
    status: "Partially Received",
  },
  {
    id: 5,
    poNumber: "PO-2005",
    supplier: "Safety First Supplies",
    consumableName: "Safety Helmet",
    category: "Safety",
    unit: "Nos",
    orderedQty: 60,
    receivedQty: 0,
    pendingQty: 60,
    warehouse: "Warehouse C",
    expectedDate: "2025-01-25",
    status: "Pending",
  },
];

// ---------------------------------------------------------------------------
// Consumable Stock (starts empty - populated only from GRN)
// ---------------------------------------------------------------------------

let consumableStock = [];

// ---------------------------------------------------------------------------
// Direct GRNs (starts empty - populated only from createDirectConsumableGRN)
//
// BUGFIX: Direct GRNs previously built a record and returned it, but never
// stored it anywhere. That meant Direct GRNs updated stock and Movement
// History correctly, but could never be listed/audited as GRN documents
// (e.g. in a "Direct GRN" report). They are now pushed into this array and
// exposed via getDirectGrns().
// ---------------------------------------------------------------------------

let directGrns = [];

// ---------------------------------------------------------------------------
// Issue / Return / Movement History (start empty - populated from actions)
// ---------------------------------------------------------------------------

let issuedConsumables = [];
let returnedConsumables = [];
let movementHistory = [];

let poIdCounter = purchaseOrders.length + 1;
let directGrnCounter = 1001;
let stockIdCounter = 1;
let issueCounter = 5001;
let returnCounter = 7001;
let movementIdCounter = 1;

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

function getPurchaseOrders() {
  return purchaseOrders;
}

function getConsumableStock() {
  return consumableStock;
}

function getDirectGrns() {
  return directGrns;
}

function getIssuedConsumables() {
  return issuedConsumables;
}

function getReturnedConsumables() {
  return returnedConsumables;
}

function getMovementHistory() {
  return movementHistory;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStatus(orderedQty, receivedQty) {
  if (receivedQty <= 0) return "Pending";
  if (receivedQty >= orderedQty) return "Completed";
  return "Partially Received";
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function nowTimeString() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// BUGFIX: Stock status used to be overwritten with whatever the *last*
// processed GRN's status was. If the same consumable+warehouse is fed by
// more than one Purchase Order (or a PO plus a Direct GRN), that meant the
// stock row's status reflected only the most recent transaction rather than
// the true combined state - e.g. it could show "Completed" while another PO
// for the same consumable still had pendingQty > 0.
//
// This now recomputes status by checking whether ANY purchase order for the
// same consumable + warehouse still has outstanding pendingQty. Direct GRNs
// never leave anything pending, so if no PO is outstanding, the row is
// "Completed".
function computeAggregateStockStatus(consumableName, warehouse) {
  const name = consumableName.trim().toLowerCase();
  const wh = warehouse.trim().toLowerCase();

  const hasOutstandingPO = purchaseOrders.some(
    (po) =>
      po.consumableName.trim().toLowerCase() === name &&
      po.warehouse.trim().toLowerCase() === wh &&
      po.pendingQty > 0
  );

  return hasOutstandingPO ? "Partially Received" : "Completed";
}

// Creates a new stock record, or updates an existing one if the same
// consumable already exists in the same warehouse AND unit.
//
// BUGFIX: matching used to be done on consumableName + warehouse only. If a
// later GRN for the "same" consumable arrived with a different unit (e.g.
// first entry in "Kg", a later Direct GRN mistakenly entered in "Nos"), the
// quantities would be summed together as if they were the same unit. The
// match key now also includes unit, so mismatched-unit entries create their
// own stock row instead of being silently merged.
function upsertConsumableStock({
  referenceNumber,
  consumableName,
  category,
  unit,
  quantity,
  warehouse,
  supplier,
  status,
}) {
  const existing = consumableStock.find(
    (item) =>
      item.consumableName.trim().toLowerCase() ===
        consumableName.trim().toLowerCase() &&
      item.warehouse.trim().toLowerCase() === warehouse.trim().toLowerCase() &&
      item.unit.trim().toLowerCase() === unit.trim().toLowerCase()
  );

  // Status is always recomputed from the aggregate PO state for this
  // consumable + warehouse rather than trusting the single incoming value,
  // so multi-PO / mixed PO+Direct-GRN cases stay consistent.
  const resolvedStatus = computeAggregateStockStatus(consumableName, warehouse) || status;

  if (existing) {
    existing.availableQty += quantity;
    existing.lastReceivedDate = todayString();
    existing.supplier = supplier;
    existing.referenceNumber = referenceNumber;
    existing.status = resolvedStatus;
  } else {
    consumableStock.push({
      id: stockIdCounter++,
      referenceNumber,
      consumableName,
      category,
      unit,
      availableQty: quantity,
      warehouse,
      supplier,
      lastReceivedDate: todayString(),
      status: resolvedStatus,
    });
  }
}

// Exposed directly in case a caller needs to create/update stock
// independently of a GRN action (kept for parity with the Material store API).
function createConsumableStock(payload) {
  upsertConsumableStock(payload);
  notify();
}

function updateConsumableStock(id, updates) {
  consumableStock = consumableStock.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
  notify();
}

// Finds the stock row for a given consumable + warehouse combination.
// Used as a fallback when returning stock, in case the original stockId
// on the issued record is no longer valid for any reason.
function findStockByConsumableAndWarehouse(consumableName, warehouse) {
  return consumableStock.find(
    (item) =>
      item.consumableName.trim().toLowerCase() ===
        consumableName.trim().toLowerCase() &&
      item.warehouse.trim().toLowerCase() === warehouse.trim().toLowerCase()
  );
}

// ---------------------------------------------------------------------------
// Movement History
// ---------------------------------------------------------------------------

// Records a single movement history entry. Called automatically by every
// GRN, Issue, and Return action so the Movement History / timeline is
// always kept in sync with live data (never hardcoded).
function addMovement({
  type,
  referenceNumber,
  consumableName,
  warehouse,
  quantity,
  unit,
  department,
  user,
  remarks,
}) {
  movementHistory.push({
    id: movementIdCounter++,
    date: todayString(),
    time: nowTimeString(),
    type,
    referenceNumber: referenceNumber || "",
    consumableName,
    warehouse,
    quantity,
    unit: unit || "",
    department: department || "",
    user: user || "",
    remarks: remarks || "",
  });
  notify();
}

// ---------------------------------------------------------------------------
// GRN Actions
// ---------------------------------------------------------------------------

// Receive against an existing Purchase Order.
function receiveConsumableGRN(poNumber, { quantityReceived, receivedBy, remarks }) {
  const po = purchaseOrders.find((item) => item.poNumber === poNumber);
  if (!po) return;

  const qty = Number(quantityReceived) || 0;
  if (qty <= 0) return;

  // Received Quantity cannot exceed Ordered Quantity.
  const maxReceivable = po.orderedQty - po.receivedQty;
  const appliedQty = Math.min(qty, maxReceivable);

  // BUGFIX: previously there was no guard here. If a receive was submitted
  // against a PO that had no remaining pendingQty (maxReceivable === 0),
  // appliedQty became 0 but the function still updated the stock row's
  // lastReceivedDate/status/supplier and logged a "GRN Received" movement
  // entry for 0 quantity - creating misleading phantom records.
  if (appliedQty <= 0) return;

  po.receivedQty += appliedQty;
  // Pending Quantity cannot become negative.
  po.pendingQty = Math.max(po.orderedQty - po.receivedQty, 0);
  po.status = computeStatus(po.orderedQty, po.receivedQty);
  po.lastReceivedBy = receivedBy;
  po.lastRemarks = remarks;

  // Every successful receipt updates stock immediately, whether the PO
  // ends up Partially Received or Completed. The stock row's status is
  // recomputed from the aggregate PO state (see computeAggregateStockStatus)
  // so the Stock page and GRN page never disagree.
  upsertConsumableStock({
    referenceNumber: po.poNumber,
    consumableName: po.consumableName,
    category: po.category,
    unit: po.unit,
    quantity: appliedQty,
    warehouse: po.warehouse,
    supplier: po.supplier,
    status: po.status,
  });

  addMovement({
    type: "GRN Received",
    referenceNumber: po.poNumber,
    consumableName: po.consumableName,
    warehouse: po.warehouse,
    quantity: appliedQty,
    unit: po.unit,
    user: receivedBy,
    remarks,
  });
}

// Create a Direct GRN (no Purchase Order involved).
function createDirectConsumableGRN({
  supplier,
  consumableName,
  category,
  unit,
  quantity,
  warehouse,
  receivedBy,
  remarks,
}) {
  const qty = Number(quantity) || 0;
  const directGrnNumber = `DIR-${directGrnCounter++}`;

  const directGrn = {
    id: poIdCounter++,
    grnNumber: directGrnNumber,
    supplier,
    consumableName,
    category,
    unit,
    quantity: qty,
    warehouse,
    receivedBy,
    remarks,
    date: todayString(),
  };

  // BUGFIX: directGrn was previously built and returned but never stored
  // anywhere, so Direct GRNs could never be listed/retrieved as GRN
  // documents (they only showed up indirectly in Movement History). It is
  // now tracked in the directGrns array via getDirectGrns().
  directGrns.push(directGrn);

  // Direct GRNs have no Purchase Order to stay "pending" against - the
  // full quantity is received on entry, so the stock row is Completed
  // (confirmed via computeAggregateStockStatus, since there is no matching
  // PO left outstanding for this consumable + warehouse).
  upsertConsumableStock({
    referenceNumber: directGrnNumber,
    consumableName,
    category,
    unit,
    quantity: qty,
    warehouse,
    supplier,
    status: "Completed",
  });

  addMovement({
    type: "Direct GRN Received",
    referenceNumber: directGrnNumber,
    consumableName,
    warehouse,
    quantity: qty,
    unit,
    user: receivedBy,
    remarks,
  });

  return directGrn;
}

// ---------------------------------------------------------------------------
// Issue Actions
// ---------------------------------------------------------------------------

// Issue a consumable out of stock to a department / employee / job card.
// Cannot issue more than the stock row's current Available Quantity.
function issueConsumable(
  stockId,
  { department, employeeName, jobCard, quantity, remarks }
) {
  const stockItem = consumableStock.find((item) => item.id === stockId);
  if (!stockItem) return null;

  const qty = Number(quantity) || 0;
  if (qty <= 0) return null;

  // Never allow issuing more than what is currently available.
  const appliedQty = Math.min(qty, stockItem.availableQty);
  if (appliedQty <= 0) return null;

  stockItem.availableQty -= appliedQty;

  const issueNumber = `ISS-${issueCounter++}`;
  const issuedRecord = {
    id: issueNumber,
    issueNumber,
    stockId: stockItem.id,
    referenceNumber: stockItem.referenceNumber,
    consumableName: stockItem.consumableName,
    category: stockItem.category,
    unit: stockItem.unit,
    warehouse: stockItem.warehouse,
    department,
    employeeName,
    jobCard,
    issuedQty: appliedQty,
    returnedQty: 0,
    balanceQty: appliedQty,
    status: "Issued",
    date: todayString(),
    remarks,
  };

  issuedConsumables.push(issuedRecord);

  addMovement({
    type: "Issued",
    referenceNumber: issueNumber,
    consumableName: stockItem.consumableName,
    warehouse: stockItem.warehouse,
    quantity: appliedQty,
    unit: stockItem.unit,
    department,
    user: employeeName,
    remarks,
  });

  return issuedRecord;
}

// ---------------------------------------------------------------------------
// Return Actions
// ---------------------------------------------------------------------------

// Return a previously issued consumable back into stock.
// Cannot return more than the remaining Balance Quantity on the issue.
function returnConsumable(issueId, { returnQty, remarks, returnedBy }) {
  const issuedRecord = issuedConsumables.find((item) => item.id === issueId);
  if (!issuedRecord) return null;

  const qty = Number(returnQty) || 0;
  if (qty <= 0) return null;

  // Never allow returning more than the remaining balance.
  const appliedQty = Math.min(qty, issuedRecord.balanceQty);
  if (appliedQty <= 0) return null;

  issuedRecord.returnedQty += appliedQty;
  issuedRecord.balanceQty -= appliedQty;
  issuedRecord.status =
    issuedRecord.balanceQty <= 0
      ? "Fully Returned"
      : issuedRecord.returnedQty > 0
      ? "Partially Returned"
      : "Issued";

  // BUGFIX: this previously looked the stock row up again by
  // consumableName + warehouse, ignoring the stockId already stored on the
  // issued record. That worked only by coincidence of upsertConsumableStock's
  // merge behavior. It now returns stock directly to the exact row that was
  // originally decremented, falling back to the name/warehouse lookup only
  // if that row no longer exists.
  const stockItem =
    consumableStock.find((item) => item.id === issuedRecord.stockId) ||
    findStockByConsumableAndWarehouse(
      issuedRecord.consumableName,
      issuedRecord.warehouse
    );
  if (stockItem) {
    stockItem.availableQty += appliedQty;
  }

  const returnNumber = `RET-${returnCounter++}`;
  const returnedRecord = {
    id: returnNumber,
    returnNumber,
    issueId: issuedRecord.id,
    issueNumber: issuedRecord.issueNumber,
    consumableName: issuedRecord.consumableName,
    category: issuedRecord.category,
    unit: issuedRecord.unit,
    warehouse: issuedRecord.warehouse,
    department: issuedRecord.department,
    employeeName: issuedRecord.employeeName,
    jobCard: issuedRecord.jobCard,
    returnQty: appliedQty,
    remarks,
    date: todayString(),
  };

  returnedConsumables.push(returnedRecord);

  addMovement({
    type: "Returned",
    referenceNumber: returnNumber,
    consumableName: issuedRecord.consumableName,
    warehouse: issuedRecord.warehouse,
    quantity: appliedQty,
    unit: issuedRecord.unit,
    department: issuedRecord.department,
    user: returnedBy || issuedRecord.employeeName,
    remarks,
  });

  return returnedRecord;
}

const consumableStore = {
  subscribe,
  getPurchaseOrders,
  getConsumableStock,
  getDirectGrns,
  getIssuedConsumables,
  getReturnedConsumables,
  getMovementHistory,
  receiveConsumableGRN,
  createDirectConsumableGRN,
  createConsumableStock,
  updateConsumableStock,
  issueConsumable,
  returnConsumable,
  addMovement,
};

export default consumableStore;