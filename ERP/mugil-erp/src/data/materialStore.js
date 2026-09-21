// materialStore.js
// -----------------------------------------------------------------------------
// Single in-memory "source of truth" for the whole Material Management module.
// No backend / no API calls — this is a lightweight pub/sub store so that every
// page (GRN, Stock, Cutting, Receive From Cutting, Cutting Balance Stock,
// Issue To Production, Scrap, Rejection, Movement History) reads and writes
// the SAME connected dataset instead of generating its own random dummy data.
//
// CHANGELOG (this revision)
// - Added `finishedPieces` collection. Every piece created in "Receive From
//   Cutting" becomes a row of production inventory here (NOT a bare quantity).
// - `cuttingBalanceStock` now stores remainingLength / remainingWidth /
//   remainingWeight per the Receive From Cutting form, and is a pure
//   read-only inventory view (Cutting Balance Stock page has no actions).
// - `receiveFromCutting` now accepts the full multi-piece payload (pieces[],
//   balance, scrapWeight, rejectedQty, remarks) instead of bare counts, and
//   fans out into finishedPieces / cuttingBalanceStock / scrapMaterials /
//   rejectionMaterials + movement history in one transaction.
// - `issueToProduction` now operates on `finishedPieces` (piece-level
//   production inventory) instead of raw cutting-balance plates, matching
//   the "Issue Material To Production" spec.
//
// NEW (Outsourcing workflow)
// - Added `outsourcingJobs` collection. When material is issued for
//   Outsourcing (instead of In House cutting) a record is created here via
//   `issueToOutsourcing()` — NOT in `cuttingJobs` and NOT via
//   `issueToCutting()`.
// - `receiveFromCutting()` is reused UNCHANGED in its business logic for
//   both In House and Outsourcing jobs. It now looks up the job in either
//   `cuttingJobs` OR `outsourcingJobs` (whichever has that jobNumber), and
//   only closes/updates the collection the job actually belongs to. Every
//   other line of finished-pieces / cutting-balance / scrap / rejection
//   logic is 100% shared — no duplicated code path for Outsourcing.
// -----------------------------------------------------------------------------

import { useSyncExternalStore } from "react";

let idCounter = 1;
const nextId = (prefix) => `${prefix}-${idCounter++}`;

const todayMinus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};
const todayPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

// -----------------------------------------------------------------------------
// MATERIAL MASTER — the catalogue every other record references
// -----------------------------------------------------------------------------
const materialMaster = [
  { id: "MAT-001", steelPlant: "SAIL Bhilai", grade: "IS 2062 E250", specification: "Hot Rolled Plate", thickness: 12, width: 2500, length: 6300, materialType: "MS Plate", weight: 1483.7 },
  { id: "MAT-002", steelPlant: "JSW Vijayanagar", grade: "IS 2062 E350", specification: "Hot Rolled Plate", thickness: 16, width: 2000, length: 8000, materialType: "MS Plate", weight: 2009.6 },
  { id: "MAT-003", steelPlant: "Tata Steel Jamshedpur", grade: "SA516 Gr.70", specification: "Boiler Quality Plate", thickness: 20, width: 2500, length: 6000, materialType: "Boiler Plate", weight: 2355.0 },
  { id: "MAT-004", steelPlant: "Jindal Stainless", grade: "SS 304", specification: "Cold Rolled Sheet", thickness: 3, width: 1250, length: 2500, materialType: "SS Sheet", weight: 73.6 },
  { id: "MAT-005", steelPlant: "SAIL Rourkela", grade: "IS 2062 E250", specification: "Hot Rolled Plate", thickness: 10, width: 1500, length: 6000, materialType: "MS Plate", weight: 706.5 },
  { id: "MAT-006", steelPlant: "ESSAR Hazira", grade: "API 5L X52", specification: "Pipeline Plate", thickness: 14, width: 2200, length: 7000, materialType: "MS Plate", weight: 1693.6 },
  { id: "MAT-007", steelPlant: "Tata Steel Jamshedpur", grade: "EN8", specification: "Round Bar", thickness: 50, width: 50, length: 6000, materialType: "MS Round Bar", weight: 92.5 },
  { id: "MAT-008", steelPlant: "JSW Dolvi", grade: "SA516 Gr.60", specification: "Boiler Quality Plate", thickness: 25, width: 2500, length: 6300, materialType: "Boiler Plate", weight: 3094.5 },
  { id: "MAT-009", steelPlant: "Jindal Stainless", grade: "SS 316L", specification: "Cold Rolled Sheet", thickness: 5, width: 1500, length: 3000, materialType: "SS Sheet", weight: 176.7 },
  { id: "MAT-010", steelPlant: "SAIL Bokaro", grade: "IS 2062 E350", specification: "Hot Rolled Plate", thickness: 8, width: 2500, length: 6300, materialType: "MS Plate", weight: 989.8 },
];

const findMaterial = (id) => materialMaster.find((m) => m.id === id);

// -----------------------------------------------------------------------------
// PURCHASE ORDERS (20 records — mix of Completed / Partial / Pending)
// -----------------------------------------------------------------------------
const suppliers = [
  "Shree Metaliks Pvt Ltd", "Bansal Steel Traders", "Ganpati Ispat", "Adani Steel Corp",
  "Kalyani Steels", "Sunrise Steel Suppliers", "Bhagwati Metal Works", "Vardhman Steel Co.",
  "Om Sai Steel Traders", "Universal Metal Corp",
];
const warehouses = ["WH-A (Raw Material)", "WH-B (Heavy Plates)", "WH-C (Sheets & Coils)"];

function poRow(num, matId, orderedQty, receivedQty, extra = {}) {
  const mat = findMaterial(matId);
  const pendingQty = orderedQty - receivedQty;
  const status = pendingQty === 0 ? "Completed" : receivedQty === 0 ? "Pending" : "Partial";
  return {
    poNumber: `PO-${num}`,
    supplier: suppliers[num % suppliers.length],
    materialId: matId,
    material: mat.materialType,
    grade: mat.grade,
    specification: mat.specification,
    thickness: mat.thickness,
    width: mat.width,
    length: mat.length,
    orderedQty,
    receivedQty,
    pendingQty,
    weight: mat.weight,
    warehouse: warehouses[num % warehouses.length],
    expectedDeliveryDate: todayPlus((num % 10) + 3),
    status,
    heatNumber: `HT-${2200 + num}`,
    plateNumber: `PL-${4500 + num}`,
    ...extra,
  };
}

const purchaseOrders = [
  poRow(1001, "MAT-001", 100, 100),
  poRow(1002, "MAT-002", 80, 50),
  poRow(1003, "MAT-003", 40, 0),
  poRow(1004, "MAT-001", 100, 60, { heatNumber: "HT-2291", plateNumber: "PL-4501" }),
  poRow(1005, "MAT-004", 60, 60),
  poRow(1006, "MAT-005", 120, 0),
  poRow(1007, "MAT-006", 75, 75),
  poRow(1008, "MAT-007", 200, 140),
  poRow(1009, "MAT-008", 30, 0),
  poRow(1010, "MAT-009", 45, 45),
  poRow(1011, "MAT-010", 90, 30),
  poRow(1012, "MAT-001", 60, 60),
  poRow(1013, "MAT-002", 50, 0),
  poRow(1014, "MAT-003", 35, 20),
  poRow(1015, "MAT-004", 70, 70),
  poRow(1016, "MAT-005", 55, 0),
  poRow(1017, "MAT-006", 40, 40),
  poRow(1018, "MAT-007", 150, 90),
  poRow(1019, "MAT-008", 25, 25),
  poRow(1020, "MAT-009", 65, 0),
];

// -----------------------------------------------------------------------------
// MATERIAL STOCK — one lot per PO that has ANY received quantity.
// -----------------------------------------------------------------------------
function buildInitialStock() {
  return purchaseOrders
    .filter((po) => po.receivedQty > 0)
    .map((po) => {
      const mat = findMaterial(po.materialId);
      let availableQty = po.receivedQty;
      let status = "In Stock";

      if (po.poNumber === "PO-1004") {
        availableQty = 20;
        status = "Partially Issued";
      }

      return {
        id: nextId("STK"),
        poNumber: po.poNumber,
        material: mat.materialType,
        grade: mat.grade,
        thickness: mat.thickness,
        width: mat.width,
        length: mat.length,
        heatNumber: po.heatNumber,
        plateNumber: po.plateNumber,
        availableQty: availableQty,
        reservedQty: po.poNumber === "PO-1004" ? 40 : 0,
        warehouse: po.warehouse,
        weight: mat.weight,
        status: status,
        specification: mat.specification,
        rackLocation: "",
        batchNumber: "",
        issuedToCutting: po.poNumber === "PO-1004" ? 40 : 0,
      };
    });
}

// -----------------------------------------------------------------------------
// CUTTING JOBS (Issue Material to Cutting)
// -----------------------------------------------------------------------------
const cuttingJobs = [
  {
    jobNumber: "CUT-2001",
    poNumber: "PO-1004",
    material: "MS Plate",
    grade: "IS 2062 E250",
    heatNumber: "HT-2291",
    plateNumber: "PL-4501",
    thickness: 12,
    originalLength: 6300,
    originalWidth: 2500,
    warehouse: "WH-A (Raw Material)",
    issuedQty: 40,
    issuedBy: "R. Kumar",
    issueDate: todayMinus(6),
    remarks: "Issued for bracket cutting - Line 2",
    status: "Received",
  },
  {
    jobNumber: "CUT-2002",
    poNumber: "PO-1001",
    material: "MS Plate",
    grade: "IS 2062 E250",
    heatNumber: "HT-2201",
    plateNumber: "PL-4601",
    thickness: 12,
    originalLength: 6300,
    originalWidth: 2500,
    warehouse: "WH-A (Raw Material)",
    issuedQty: 25,
    issuedBy: "S. Verma",
    issueDate: todayMinus(2),
    remarks: "Issued for flange cutting",
    status: "Open",
  },
];

// -----------------------------------------------------------------------------
// OUTSOURCING JOBS (Issue Material to Cutting -> "Outsourcing" option)
// -----------------------------------------------------------------------------
// Same lifecycle shape as `cuttingJobs` (jobNumber, poNumber, material,
// grade, heatNumber, plateNumber, thickness, originalLength, originalWidth,
// warehouse, issuedQty, issuedBy, issueDate, remarks, status) so that
// `receiveFromCutting()` can operate on either collection without any
// branching business logic — plus outsourcing-only fields (dcNumber,
// dcDate, vendor, deliveryAddress, vehicleNumber, driver) captured from the
// Delivery Challan form. No seed records; populated only via
// `issueToOutsourcing()`.
const outsourcingJobs = [];

// -----------------------------------------------------------------------------
// FINISHED PIECES — production inventory created in Receive From Cutting.
// -----------------------------------------------------------------------------
const finishedPieces = [
  {
    id: nextId("FP"),
    jobNumber: "CUT-2001",
    poNumber: "PO-1004",
    plateNumber: "PL-4501",
    pieceCode: "PC-2001-A",
    drawingNumber: "DRG-101",
    material: "MS Plate",
    grade: "IS 2062 E250",
    length: 500,
    width: 300,
    quantity: 40,
    availableQty: 5,
    weight: 47.1,
    warehouse: "WH-A (Raw Material)",
    status: "Partially Issued",
  },
  {
    id: nextId("FP"),
    jobNumber: "CUT-2001",
    poNumber: "PO-1004",
    plateNumber: "PL-4501",
    pieceCode: "PC-2001-B",
    drawingNumber: "DRG-102",
    material: "MS Plate",
    grade: "IS 2062 E250",
    length: 300,
    width: 300,
    quantity: 20,
    availableQty: 20,
    weight: 16.9,
    warehouse: "WH-A (Raw Material)",
    status: "Ready",
  },
];

// -----------------------------------------------------------------------------
// CUTTING BALANCE STOCK — leftover parent-plate remnants after cutting.
// -----------------------------------------------------------------------------
const cuttingBalanceStock = [
  {
    id: nextId("CBS"),
    jobNumber: "CUT-2001",
    parentPlate: "PL-4501",
    material: "MS Plate",
    grade: "IS 2062 E250",
    remainingLength: 1800,
    remainingWidth: 2500,
    remainingWeight: 423.9,
    warehouse: "WH-A (Raw Material)",
    status: "Available",
  },
];

const scrapMaterials = [
  {
    id: nextId("SCR"),
    jobNumber: "CUT-2001",
    poNumber: "PO-1004",
    material: "MS Plate",
    grade: "IS 2062 E250",
    sourceJob: "CUT-2001",
    plateNumber: "PL-4501",
    heatNumber: "HT-2291",
    weight: 38.2,
    quantity: 1,
    reason: "Trim waste from cutting",
    department: null,
    remarks: "",
    warehouse: "WH-A (Raw Material)",
    source: "Cutting",
    status: "Available",
    date: todayMinus(5),
  },
];

const rejectionMaterials = [
  {
    id: nextId("REJ"),
    jobNumber: "CUT-2001",
    poNumber: "PO-1004",
    pieceCode: "PC-2001-A",
    drawingNumber: "DRG-101",
    material: "MS Plate",
    grade: "IS 2062 E250",
    sourceJob: "CUT-2001",
    plateNumber: "PL-4501",
    weight: 41.5,
    quantity: 1,
    reason: "Wrong Dimension",
    department: "Cutting",
    status: "Pending",
    date: todayMinus(5),
  },
];

// -----------------------------------------------------------------------------
// REWORK MATERIALS — populated only via "Send For Rework" on a rejection.
// -----------------------------------------------------------------------------
const reworkMaterials = [];

// -----------------------------------------------------------------------------
// ISSUE MATERIAL TO PRODUCTION — sourced from finishedPieces
// -----------------------------------------------------------------------------
const productionIssues = [
  {
    id: nextId("PIS"),
    productionOrder: "PROD-9001",
    jobCard: "JC-7001",
    pieceCode: "PC-2001-A",
    drawingNumber: "DRG-101",
    jobNumber: "CUT-2001",
    material: "MS Plate",
    grade: "IS 2062 E250",
    issuedQty: 35,
    issueDate: todayMinus(4),
    department: "Assembly",
    issuedBy: "M. Iyer",
    remarks: "Issued for bracket assembly batch #14",
  },
];

// -----------------------------------------------------------------------------
// MOVEMENT HISTORY (audit trail)
// -----------------------------------------------------------------------------
const movementHistory = [
  { id: nextId("MOV"), date: todayMinus(9), time: "09:15 AM", poNumber: "PO-1004", jobNumber: null, plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "Purchase Order Raised", from: "Shree Metaliks Pvt Ltd", to: "PO-1004", quantity: 100, user: "A. Sharma", remarks: "Initial purchase order raised", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(8), time: "11:40 AM", poNumber: "PO-1004", jobNumber: null, plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "GRN Receipt", from: "Supplier", to: "Material Stock (WH-A)", quantity: 60, user: "A. Sharma", remarks: "Partial delivery received", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(8), time: "11:55 AM", poNumber: "PO-1004", jobNumber: null, plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "Material Stock Updated", from: "GRN", to: "Material Stock (WH-A)", quantity: 60, user: "A. Sharma", remarks: "Stock lot created", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(6), time: "02:10 PM", poNumber: "PO-1004", jobNumber: "CUT-2001", plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "Issue to Cutting", from: "Material Stock (WH-A)", to: "CUT-2001", quantity: 40, user: "R. Kumar", remarks: "Issued for bracket cutting - Line 2", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(5), time: "10:05 AM", poNumber: "PO-1004", jobNumber: "CUT-2001", plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "Receive from Cutting - Finished Pieces (Fully Consumed Plates)", from: "CUT-2001", to: "Finished Pieces Inventory", quantity: 60, user: "R. Kumar", remarks: "", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(5), time: "10:06 AM", poNumber: "PO-1004", jobNumber: "CUT-2001", plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "Receive from Cutting - Balance", from: "CUT-2001", to: "Cutting Balance Stock", quantity: 1, user: "R. Kumar", remarks: "", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(5), time: "10:07 AM", poNumber: "PO-1004", jobNumber: "CUT-2001", plateNumber: "PL-4501", pieceCode: null, material: "MS Plate (PL-4501)", movementType: "Receive from Cutting - Scrap", from: "CUT-2001", to: "Scrap Materials", quantity: 38.2, user: "R. Kumar", remarks: "Trim waste from cutting", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(5), time: "10:08 AM", poNumber: "PO-1004", jobNumber: "CUT-2001", plateNumber: "PL-4501", pieceCode: "PC-2001-A", material: "MS Plate (PL-4501)", movementType: "Receive from Cutting - Rejection", from: "CUT-2001", to: "Rejection Materials", quantity: 1, user: "R. Kumar", remarks: "Wrong Dimension", status: "Completed" },
  { id: nextId("MOV"), date: todayMinus(4), time: "03:30 PM", poNumber: "PO-1004", jobNumber: "CUT-2001", plateNumber: "PL-4501", pieceCode: "PC-2001-A", material: "MS Plate (PC-2001-A)", movementType: "Issue to Production", from: "Finished Pieces (CUT-2001)", to: "PROD-9001 / JC-7001", quantity: 35, user: "M. Iyer", remarks: "Issued for bracket assembly batch #14", status: "Completed" },
];

// -----------------------------------------------------------------------------
// STORE (pub/sub)
// -----------------------------------------------------------------------------
let state = {
  materialMaster,
  purchaseOrders,
  materialStock: buildInitialStock(),
  cuttingJobs,
  outsourcingJobs,
  finishedPieces,
  cuttingBalanceStock,
  scrapMaterials,
  rejectionMaterials,
  reworkMaterials,
  productionIssues,
  movementHistory,
};

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function setState(updater) {
  state = { ...state, ...updater(state) };
  emit();
}

function nowTimeStr() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function logMovement(entry) {
  return {
    id: nextId("MOV"),
    date: todayStr(),
    time: nowTimeStr(),
    poNumber: null,
    jobNumber: null,
    plateNumber: null,
    pieceCode: null,
    remarks: "",
    status: "Completed",
    user: "Current User",
    ...entry,
  };
}

// ---- Actions -----------------------------------------------------------------

export function receiveGRN(poNumber, qty, extra = {}) {
  setState((s) => {
    const purchaseOrders = s.purchaseOrders.map((po) => {
      if (po.poNumber !== poNumber) return po;
      const receivedQty = Math.min(po.orderedQty, po.receivedQty + qty);
      const pendingQty = po.orderedQty - receivedQty;
      const status = pendingQty === 0 ? "Completed" : "Partial";
      return { ...po, receivedQty, pendingQty, status };
    });

    const po = purchaseOrders.find((p) => p.poNumber === poNumber);
    const mat = findMaterial(po.materialId);

    const materialStock = [
      ...s.materialStock,
      {
        id: nextId("STK"),
        poNumber,
        material: mat.materialType,
        grade: mat.grade,
        thickness: mat.thickness,
        width: mat.width,
        length: mat.length,
        heatNumber: extra.heatNumber || po.heatNumber,
        plateNumber: extra.plateNumber || po.plateNumber,
        availableQty: qty,
        reservedQty: 0,
        warehouse: extra.warehouse || po.warehouse,
        weight: mat.weight,
        status: "In Stock",
        specification: mat.specification,
        rackLocation: extra.rackLocation || "",
        batchNumber: extra.batchNumber || "",
        issuedToCutting: 0,
        ...extra,
      },
    ];

    const movementHistory = [
      logMovement({ poNumber, plateNumber: extra.plateNumber || po.plateNumber, material: mat.materialType, movementType: "Material Stock Updated", from: "GRN", to: `Material Stock (${extra.warehouse || po.warehouse})`, quantity: qty, remarks: "Stock lot created" }),
      logMovement({ poNumber, plateNumber: extra.plateNumber || po.plateNumber, material: mat.materialType, movementType: "GRN Receipt", from: "Supplier", to: `Material Stock (${po.warehouse})`, quantity: qty }),
      ...s.movementHistory,
    ];

    return { purchaseOrders, materialStock, movementHistory };
  });
}

export function issueToCutting({ stockId, jobNumber, issuedQty, issuedBy, remarks }) {
  setState((s) => {
    const stockRow = s.materialStock.find((r) => r.id === stockId);
    if (!stockRow) return s;

    const newAvailableQty = stockRow.availableQty - issuedQty;
    const newIssuedToCutting = (stockRow.issuedToCutting || 0) + issuedQty;

    let newStatus = "In Stock";
    if (newAvailableQty === 0) {
      newStatus = "Fully Issued";
    } else if (newAvailableQty < stockRow.availableQty) {
      newStatus = "Partially Issued";
    }

    const materialStock = s.materialStock.map((r) =>
      r.id === stockId
        ? {
            ...r,
            availableQty: newAvailableQty,
            reservedQty: (r.reservedQty || 0) + issuedQty,
            issuedToCutting: newIssuedToCutting,
            status: newStatus,
          }
        : r
    );

    const cuttingJobs = [
      {
        jobNumber,
        poNumber: stockRow.poNumber,
        material: stockRow.material,
        grade: stockRow.grade,
        heatNumber: stockRow.heatNumber,
        plateNumber: stockRow.plateNumber,
        thickness: stockRow.thickness,
        originalLength: stockRow.length,
        originalWidth: stockRow.width,
        warehouse: stockRow.warehouse,
        issuedQty,
        issuedBy,
        issueDate: todayStr(),
        remarks,
        status: "Open",
      },
      ...s.cuttingJobs,
    ];

    const movementHistory = [
      logMovement({
        poNumber: stockRow.poNumber,
        jobNumber,
        plateNumber: stockRow.plateNumber,
        material: stockRow.material,
        movementType: "Issue to Cutting",
        from: `Material Stock (${stockRow.warehouse})`,
        to: jobNumber,
        quantity: issuedQty,
        user: issuedBy,
        remarks,
      }),
      ...s.movementHistory,
    ];

    return { materialStock, cuttingJobs, movementHistory };
  });
}

/**
 * Issue Material to Outsourcing — the "Outsourcing" branch of the Issue
 * Material to Cutting screen. Mirrors `issueToCutting()`'s stock-reduction
 * logic exactly, but:
 *   - creates a record in `outsourcingJobs` (NOT `cuttingJobs`)
 *   - does NOT call issueToCutting()
 *   - additionally captures Delivery Challan details (dcNumber, dcDate,
 *     vendor, deliveryAddress, vehicleNumber, driver)
 *
 * Does NOT create Finished Pieces / Cutting Balance / Scrap — those are
 * only created later, when this job is received via receiveFromCutting()
 * (reused as-is) from the Receive From Cutting page.
 */
export function issueToOutsourcing({
  stockId,
  jobNumber,
  issuedQty,
  issuedBy,
  remarks,
  dcNumber,
  dcDate,
  vendor,
  deliveryAddress,
  vehicleNumber,
  driver,
}) {
  setState((s) => {
    const stockRow = s.materialStock.find((r) => r.id === stockId);
    if (!stockRow) return s;

    // Same stock-reduction math as issueToCutting() — one shared meaning of
    // "issued out of Material Stock", regardless of destination.
    const newAvailableQty = stockRow.availableQty - issuedQty;
    const newIssuedToCutting = (stockRow.issuedToCutting || 0) + issuedQty;

    let newStatus = "In Stock";
    if (newAvailableQty === 0) {
      newStatus = "Fully Issued";
    } else if (newAvailableQty < stockRow.availableQty) {
      newStatus = "Partially Issued";
    }

    const materialStock = s.materialStock.map((r) =>
      r.id === stockId
        ? {
            ...r,
            availableQty: newAvailableQty,
            reservedQty: (r.reservedQty || 0) + issuedQty,
            issuedToCutting: newIssuedToCutting,
            status: newStatus,
          }
        : r
    );

    const outsourcingJobs = [
      {
        jobNumber,
        source: "Outsourcing",
        poNumber: stockRow.poNumber,
        material: stockRow.material,
        grade: stockRow.grade,
        heatNumber: stockRow.heatNumber,
        plateNumber: stockRow.plateNumber,
        thickness: stockRow.thickness,
        originalLength: stockRow.length,
        originalWidth: stockRow.width,
        warehouse: stockRow.warehouse,
        issuedQty,
        issuedBy,
        issueDate: todayStr(),
        remarks,
        status: "Open",
        // Delivery Challan details captured at issue time
        dcNumber,
        dcDate,
        vendor,
        deliveryAddress,
        vehicleNumber,
        driver,
      },
      ...s.outsourcingJobs,
    ];

    const movementHistory = [
      logMovement({
        poNumber: stockRow.poNumber,
        jobNumber,
        plateNumber: stockRow.plateNumber,
        material: stockRow.material,
        movementType: "Issue to Outsourcing",
        from: `Material Stock (${stockRow.warehouse})`,
        to: jobNumber,
        quantity: issuedQty,
        user: issuedBy,
        remarks,
      }),
      logMovement({
        poNumber: stockRow.poNumber,
        jobNumber,
        plateNumber: stockRow.plateNumber,
        material: stockRow.material,
        movementType: "Delivery Challan Generated",
        from: jobNumber,
        to: `DC ${dcNumber || "-"}`,
        quantity: issuedQty,
        user: issuedBy,
        remarks: `Vendor: ${vendor || "-"}`,
      }),
      ...s.movementHistory,
    ];

    return { materialStock, outsourcingJobs, movementHistory };
  });
}

/**
 * Receive From Cutting — closes a cutting job using plate-level logic.
 *
 * payload = {
 *   jobNumber: "CUT-2002",
 *   fullyConsumedCount: number,          // how many of the issued plates were 100% used
 *   fullyConsumedPieces: [                // aggregated output from those plates (no plate-wise detail)
 *     { pieceCode, drawingNumber, quantity, weight }
 *   ],
 *   remainingPlates: [                    // one entry per plate still holding balance material
 *     {
 *       plateNumber,
 *       pieces: [{ pieceCode, drawingNumber, length, width, quantity, weight }],
 *       remainingLength, remainingWidth, remainingWeight,
 *       scrapWeight,
 *       rejectedQty,
 *       remarks,
 *     }
 *   ],
 *   receivedBy: string,
 * }
 */
/**
 * Receive From Cutting — closes a cutting job using plate-level logic.
 *
 * payload = {
 *   jobNumber: "CUT-2002",
 *   fullyConsumedCount: number,
 *   fullyConsumedPieces: [{ pieceCode, drawingNumber, quantity, weight }],
 *   remainingPlates: [{
 *     plateNumber,
 *     pieces: [{ pieceCode, drawingNumber, length, width, quantity, weight }],
 *     remainingLength, remainingWidth, remainingWeight,
 *     scrapWeight,
 *     rejectedQty,
 *     remarks,
 *   }],
 *   receivedBy: string,
 * }
 */
/**
 * Receive From Cutting — closes a cutting job using plate-level logic.
 *
 * payload = {
 *   jobNumber: "CUT-2002",
 *   fullyConsumedCount: number,
 *   fullyConsumedPieces: [{ pieceCode, drawingNumber, quantity, weight }],
 *   remainingPlates: [{
 *     plateNumber,
 *     pieces: [{ pieceCode, drawingNumber, length, width, quantity, weight }],
 *     remainingLength, remainingWidth, remainingWeight,
 *     scrapWeight,
 *     rejectedQty,
 *     remarks,
 *   }],
 *   receivedBy: string,
 * }
 */
export function receiveFromCutting(payload) {
  const {
    jobNumber,
    fullyConsumedCount = 0,
    fullyConsumedPieces = [],
    remainingPlates = [],
    receivedBy = "Current User",
  } = payload;

  console.log("🔵 receiveFromCutting called with:", {
    jobNumber,
    fullyConsumedCount,
    fullyConsumedPieces: fullyConsumedPieces.length,
    remainingPlates: remainingPlates.length,
    receivedBy
  });

  setState((s) => {
    // A job may live in either `cuttingJobs` (In House) or `outsourcingJobs`
    // (Outsourcing) — everything below this point is 100% shared logic for
    // both sources, exactly as before.
    const cuttingJob = s.cuttingJobs.find((j) => j.jobNumber === jobNumber);
    const outsourcingJob = s.outsourcingJobs.find((j) => j.jobNumber === jobNumber);
    const job = cuttingJob || outsourcingJob;
    if (!job) {
      console.error("❌ Job not found:", jobNumber);
      return s;
    }

    console.log("✅ Job found:", job);

    const isOutsourcing = !cuttingJob && !!outsourcingJob;
    // Friendly label used only for movement-history text below (e.g.
    // "Receive from Outsourcing - Scrap" vs "Receive from Cutting - Scrap").
    const sourceLabel = isOutsourcing ? "Outsourcing" : "Cutting";

    // 1. Close the job in whichever collection it actually belongs to.
    const cuttingJobs = isOutsourcing
      ? s.cuttingJobs
      : s.cuttingJobs.map((j) =>
          j.jobNumber === jobNumber ? { ...j, status: "Received" } : j
        );
    const outsourcingJobs = isOutsourcing
      ? s.outsourcingJobs.map((j) =>
          j.jobNumber === jobNumber ? { ...j, status: "Received" } : j
        )
      : s.outsourcingJobs;

    // 2a. Finished pieces from fully consumed plates
    const fullyConsumedFinishedPieces = fullyConsumedPieces
      .filter((p) => p.pieceCode && Number(p.quantity) > 0)
      .map((p) => ({
        id: nextId("FP"),
        jobNumber,
        poNumber: job.poNumber,
        plateNumber: null,
        sourceType: "Fully Consumed Plates",
        fullyConsumedPlateCount: Number(fullyConsumedCount) || 0,
        pieceCode: p.pieceCode,
        drawingNumber: p.drawingNumber,
        material: job.material,
        grade: job.grade,
        quantity: Number(p.quantity) || 0,
        availableQty: Number(p.quantity) || 0,
        weight: Number(p.weight) || 0,
        warehouse: job.warehouse,
        status: "Ready",
      }));

    // 2b. Process remaining plates
    const remainingFinishedPieces = [];
    const newCuttingBalanceStock = [];
    const newScrapMaterials = [];
    const newRejectionMaterials = [];

    remainingPlates.forEach((plate, index) => {
      console.log(`🔍 Processing remaining plate ${index + 1}:`, plate);
      
      // Process finished pieces from this plate
      (plate.pieces || [])
        .filter((p) => p.pieceCode && Number(p.quantity) > 0)
        .forEach((p) => {
          console.log(`  ➕ Adding piece ${p.pieceCode} from plate ${plate.plateNumber}`);
          remainingFinishedPieces.push({
            id: nextId("FP"),
            jobNumber,
            poNumber: job.poNumber,
            plateNumber: plate.plateNumber,
            sourceType: "Partially Consumed Plate",
            pieceCode: p.pieceCode,
            drawingNumber: p.drawingNumber,
            material: job.material,
            grade: job.grade,
            length: Number(p.length) || 0,
            width: Number(p.width) || 0,
            quantity: Number(p.quantity) || 0,
            availableQty: Number(p.quantity) || 0,
            weight: Number(p.weight) || 0,
            warehouse: job.warehouse,
            status: "Ready",
          });
        });

      // CRITICAL: Create balance stock record if there's any remaining material
      const remainingLength = Number(plate.remainingLength) || 0;
      const remainingWidth = Number(plate.remainingWidth) || 0;
      const remainingWeight = Number(plate.remainingWeight) || 0;
      
      const hasBalance = remainingLength > 0 || remainingWidth > 0 || remainingWeight > 0;
      
      console.log(`  📊 Balance check for plate ${plate.plateNumber}:`, {
        remainingLength,
        remainingWidth,
        remainingWeight,
        hasBalance
      });
      
      if (hasBalance) {
        const balanceRecord = {
          id: nextId("CBS"),
          jobNumber,
          parentPlate: plate.plateNumber,
          material: job.material,
          grade: job.grade,
          remainingLength: remainingLength,
          remainingWidth: remainingWidth,
          remainingWeight: remainingWeight,
          warehouse: job.warehouse,
          status: "Available",
        };
        
        console.log(`  ✅ Creating balance stock for plate ${plate.plateNumber}:`, balanceRecord);
        newCuttingBalanceStock.push(balanceRecord);
      } else {
        console.log(`  ⚠️ No balance for plate ${plate.plateNumber}`);
      }

      // Create scrap record — Source = Cutting. Locked/view-only downstream:
      // the weight here is what closes the material-traceability equation for
      // this job, so the Scrap page must never let it be edited.
      const scrapWeight = Number(plate.scrapWeight) || 0;
      if (scrapWeight > 0) {
        console.log(`  ♻️ Creating scrap record: ${scrapWeight}kg`);
        newScrapMaterials.push({
          id: nextId("SCR"),
          jobNumber,
          poNumber: job.poNumber,
          material: job.material,
          grade: job.grade,
          sourceJob: jobNumber,
          plateNumber: plate.plateNumber,
          heatNumber: job.heatNumber,
          weight: scrapWeight,
          quantity: 1,
          reason: plate.remarks || "Cutting scrap",
          department: null,
          remarks: plate.remarks || "",
          warehouse: job.warehouse,
          source: "Cutting",
          status: "Available",
          date: todayStr(),
        });
      }

      // Create rejection record — this is the ONLY entry point into the
      // Rejection module. The record starts life as "Pending" and can then
      // only be actioned (never manually created) from the Rejection page.
      const rejectedQty = Number(plate.rejectedQty) || 0;
      if (rejectedQty > 0) {
        console.log(`  ❌ Creating rejection record: ${rejectedQty} units`);
        newRejectionMaterials.push({
          id: nextId("REJ"),
          jobNumber,
          poNumber: job.poNumber,
          pieceCode: null,
          drawingNumber: null,
          material: job.material,
          grade: job.grade,
          sourceJob: jobNumber,
          plateNumber: plate.plateNumber,
          weight: 0,
          quantity: rejectedQty,
          reason: plate.remarks || "Rejected during cutting",
          department: "Cutting",
          status: "Pending",
          date: todayStr(),
        });
      }
    });

    // Combine all finished pieces
    const finishedPieces = [
      ...fullyConsumedFinishedPieces,
      ...remainingFinishedPieces,
      ...s.finishedPieces,
    ];
    
    // Combine balance stock - IMPORTANT: Keep existing balance stock
    const cuttingBalanceStock = [
      ...s.cuttingBalanceStock,
      ...newCuttingBalanceStock,
    ];
    
    const scrapMaterials = [...newScrapMaterials, ...s.scrapMaterials];
    const rejectionMaterials = [
      ...newRejectionMaterials,
      ...s.rejectionMaterials,
    ];

    console.log("📦 Final balance stock:", {
      existing: s.cuttingBalanceStock.length,
      new: newCuttingBalanceStock.length,
      total: cuttingBalanceStock.length,
      records: cuttingBalanceStock
    });

    // 3. Movement history
    const totalFullyConsumedQty = fullyConsumedFinishedPieces.reduce(
      (sum, p) => sum + p.quantity,
      0,
    );
    const totalRemainingQty = remainingFinishedPieces.reduce(
      (sum, p) => sum + p.quantity,
      0,
    );

    const movementHistory = [
      ...(totalFullyConsumedQty > 0
        ? [
            logMovement({
              poNumber: job.poNumber,
              jobNumber,
              plateNumber: job.plateNumber,
              material: job.material,
              movementType:
                `Receive from ${sourceLabel} - Finished Pieces (Fully Consumed Plates)`,
              from: jobNumber,
              to: "Finished Pieces Inventory",
              quantity: totalFullyConsumedQty,
              user: receivedBy,
            }),
          ]
        : []),
      ...(totalRemainingQty > 0
        ? [
            logMovement({
              poNumber: job.poNumber,
              jobNumber,
              plateNumber: job.plateNumber,
              material: job.material,
              movementType:
                `Receive from ${sourceLabel} - Finished Pieces (Remaining Plates)`,
              from: jobNumber,
              to: "Finished Pieces Inventory",
              quantity: totalRemainingQty,
              user: receivedBy,
            }),
          ]
        : []),
      ...(newCuttingBalanceStock.length > 0
        ? [
            logMovement({
              poNumber: job.poNumber,
              jobNumber,
              plateNumber: job.plateNumber,
              material: job.material,
              movementType: `Receive from ${sourceLabel} - Balance`,
              from: jobNumber,
              to: "Cutting Balance Stock",
              quantity: newCuttingBalanceStock.length,
              user: receivedBy,
            }),
          ]
        : []),
      ...(newScrapMaterials.length > 0
        ? [
            logMovement({
              poNumber: job.poNumber,
              jobNumber,
              plateNumber: job.plateNumber,
              material: job.material,
              movementType: `Receive from ${sourceLabel} - Scrap`,
              from: jobNumber,
              to: "Scrap Materials",
              quantity: newScrapMaterials.reduce((sum, r) => sum + r.weight, 0),
              user: receivedBy,
            }),
          ]
        : []),
      ...(newRejectionMaterials.length > 0
        ? [
            logMovement({
              poNumber: job.poNumber,
              jobNumber,
              plateNumber: job.plateNumber,
              material: job.material,
              movementType: `Receive from ${sourceLabel} - Rejection`,
              from: jobNumber,
              to: "Rejection Materials",
              quantity: newRejectionMaterials.reduce(
                (sum, r) => sum + r.quantity,
                0,
              ),
              user: receivedBy,
            }),
          ]
        : []),
      ...s.movementHistory,
    ];

    const newState = {
      cuttingJobs,
      outsourcingJobs,
      finishedPieces,
      cuttingBalanceStock,
      scrapMaterials,
      rejectionMaterials,
      movementHistory,
    };

    console.log("✅ State updated:", {
      cuttingBalanceStock: newState.cuttingBalanceStock.length,
      finishedPieces: newState.finishedPieces.length,
    });

    return newState;
  });
}

export function issueToProduction({ pieceId, productionOrder, jobCard, issuedQty, department, issuedBy, remarks }) {
  setState((s) => {
    const piece = s.finishedPieces.find((p) => p.id === pieceId);
    if (!piece) return s;

    const qty = Number(issuedQty) || 0;
    if (qty <= 0 || qty > piece.availableQty) return s;

    const newAvailableQty = piece.availableQty - qty;
    const newStatus = newAvailableQty === 0 ? "Fully Issued" : "Partially Issued";

    const finishedPieces = s.finishedPieces.map((p) =>
      p.id === pieceId ? { ...p, availableQty: newAvailableQty, status: newStatus } : p
    );

    const productionIssues = [
      {
        id: nextId("PIS"),
        productionOrder,
        jobCard,
        pieceCode: piece.pieceCode,
        drawingNumber: piece.drawingNumber,
        jobNumber: piece.jobNumber,
        material: piece.material,
        grade: piece.grade,
        issuedQty: qty,
        issueDate: todayStr(),
        department,
        issuedBy,
        remarks,
      },
      ...s.productionIssues,
    ];

    const movementHistory = [
      logMovement({
        poNumber: piece.poNumber,
        jobNumber: piece.jobNumber,
        plateNumber: piece.plateNumber,
        pieceCode: piece.pieceCode,
        material: `${piece.material} (${piece.pieceCode})`,
        movementType: "Issue to Production",
        from: "Finished Pieces Inventory",
        to: `${productionOrder} / ${jobCard}`,
        quantity: qty,
        user: issuedBy,
        remarks,
      }),
      ...s.movementHistory,
    ];

    return { finishedPieces, productionIssues, movementHistory };
  });
}

// -----------------------------------------------------------------------------
// SCRAP MODULE — Manual Scrap Entry
// -----------------------------------------------------------------------------

/**
 * Create a Manual scrap record (Source = Manual, editable).
 * Material / Grade / Plate Number / Heat Number / Warehouse are auto-fetched
 * from the selected PO — the user only supplies weight/department/reason/remarks.
 */
export function createManualScrap({ poNumber, weight, department, reason, remarks }) {
  setState((s) => {
    const po = s.purchaseOrders.find((p) => p.poNumber === poNumber);
    if (!po) return s;

    const scrapWeight = Number(weight) || 0;

    const scrapRecord = {
      id: nextId("SCR"),
      jobNumber: null,
      poNumber: po.poNumber,
      material: po.material,
      grade: po.grade,
      sourceJob: null,
      plateNumber: po.plateNumber,
      heatNumber: po.heatNumber,
      weight: scrapWeight,
      quantity: 1,
      reason: reason || "",
      department: department || "",
      remarks: remarks || "",
      warehouse: po.warehouse,
      source: "Manual",
      status: "Available",
      date: todayStr(),
    };

    const scrapMaterials = [scrapRecord, ...s.scrapMaterials];

    const movementHistory = [
      logMovement({
        poNumber: po.poNumber,
        plateNumber: po.plateNumber,
        material: po.material,
        movementType: "Manual Scrap Entry",
        from: department || "Production",
        to: "Scrap Inventory",
        quantity: scrapWeight,
        remarks: remarks || "",
      }),
      ...s.movementHistory,
    ];

    return { scrapMaterials, movementHistory };
  });
}

/** Edit a Manual scrap record. Cutting / Rejection / Rework sourced scrap is locked. */
export function updateManualScrap(scrapId, updates = {}) {
  setState((s) => {
    const record = s.scrapMaterials.find((r) => r.id === scrapId);
    if (!record || record.source !== "Manual") return s;

    const scrapMaterials = s.scrapMaterials.map((r) =>
      r.id === scrapId
        ? {
            ...r,
            weight: updates.weight !== undefined ? Number(updates.weight) || 0 : r.weight,
            department: updates.department !== undefined ? updates.department : r.department,
            reason: updates.reason !== undefined ? updates.reason : r.reason,
            remarks: updates.remarks !== undefined ? updates.remarks : r.remarks,
            status: updates.status !== undefined ? updates.status : r.status,
          }
        : r
    );

    return { scrapMaterials };
  });
}

/** Delete a Manual scrap record. Cutting / Rejection / Rework sourced scrap is locked. */
export function deleteManualScrap(scrapId) {
  setState((s) => {
    const record = s.scrapMaterials.find((r) => r.id === scrapId);
    if (!record || record.source !== "Manual") return s;

    const scrapMaterials = s.scrapMaterials.filter((r) => r.id !== scrapId);

    const movementHistory = [
      logMovement({
        poNumber: record.poNumber,
        jobNumber: record.jobNumber,
        plateNumber: record.plateNumber,
        material: record.material,
        movementType: "Manual Scrap Deleted",
        from: "Scrap Inventory",
        to: "-",
        quantity: record.weight,
      }),
      ...s.movementHistory,
    ];

    return { scrapMaterials, movementHistory };
  });
}

// -----------------------------------------------------------------------------
// REJECTION MODULE — process (never manually create) a Pending rejection
// -----------------------------------------------------------------------------

/** Move a Pending rejection into the Rework Inventory. */
export function sendRejectionToRework(rejectId) {
  setState((s) => {
    const rejection = s.rejectionMaterials.find((r) => r.id === rejectId);
    if (!rejection || rejection.status !== "Pending") return s; // no double-processing

    const reworkRecord = {
      id: nextId("RWK"),
      rejectId: rejection.id,
      jobNumber: rejection.jobNumber,
      poNumber: rejection.poNumber,
      pieceCode: rejection.pieceCode,
      drawingNumber: rejection.drawingNumber,
      material: rejection.material,
      grade: rejection.grade,
      quantity: rejection.quantity,
      reason: rejection.reason,
      assignedTo: "",
      status: "Pending",
      date: todayStr(),
    };

    const reworkMaterials = [reworkRecord, ...s.reworkMaterials];
    const rejectionMaterials = s.rejectionMaterials.map((r) =>
      r.id === rejectId ? { ...r, status: "Sent for Rework" } : r
    );

    const movementHistory = [
      logMovement({
        poNumber: rejection.poNumber,
        jobNumber: rejection.jobNumber,
        plateNumber: rejection.plateNumber,
        pieceCode: rejection.pieceCode,
        material: rejection.material,
        movementType: "Sent To Rework",
        from: "Rejection Materials",
        to: "Rework Inventory",
        quantity: rejection.quantity,
      }),
      ...s.movementHistory,
    ];

    return { reworkMaterials, rejectionMaterials, movementHistory };
  });
}

/** Convert a Pending rejection directly into a Scrap record (Source = Rejection). */
export function convertRejectionToScrap(rejectId) {
  setState((s) => {
    const rejection = s.rejectionMaterials.find((r) => r.id === rejectId);
    if (!rejection || rejection.status !== "Pending") return s; // no double-processing

    const scrapRecord = {
      id: nextId("SCR"),
      jobNumber: rejection.jobNumber,
      poNumber: rejection.poNumber,
      material: rejection.material,
      grade: rejection.grade,
      sourceJob: rejection.jobNumber,
      plateNumber: rejection.plateNumber || null,
      heatNumber: rejection.heatNumber || null,
      weight: rejection.weight || 0,
      quantity: rejection.quantity,
      reason: rejection.reason,
      department: rejection.department || "Rejection",
      remarks: `Converted from ${rejection.id}`,
      warehouse: rejection.warehouse || null,
      source: "Rejection",
      status: "Available",
      date: todayStr(),
    };

    const scrapMaterials = [scrapRecord, ...s.scrapMaterials];
    const rejectionMaterials = s.rejectionMaterials.map((r) =>
      r.id === rejectId ? { ...r, status: "Converted to Scrap" } : r
    );

    const movementHistory = [
      logMovement({
        poNumber: rejection.poNumber,
        jobNumber: rejection.jobNumber,
        plateNumber: rejection.plateNumber,
        pieceCode: rejection.pieceCode,
        material: rejection.material,
        movementType: "Converted To Scrap",
        from: "Rejection Materials",
        to: "Scrap Inventory",
        quantity: rejection.quantity,
      }),
      ...s.movementHistory,
    ];

    return { scrapMaterials, rejectionMaterials, movementHistory };
  });
}

// -----------------------------------------------------------------------------
// REWORK MODULE — only reachable via "Send For Rework" on a rejection
// -----------------------------------------------------------------------------

/** Pending -> In Progress */
export function startRework(reworkId, assignedTo = "") {
  setState((s) => {
    const rework = s.reworkMaterials.find((r) => r.id === reworkId);
    if (!rework || rework.status !== "Pending") return s;

    const reworkMaterials = s.reworkMaterials.map((r) =>
      r.id === reworkId
        ? { ...r, status: "In Progress", assignedTo: assignedTo || r.assignedTo }
        : r
    );

    const movementHistory = [
      logMovement({
        poNumber: rework.poNumber,
        jobNumber: rework.jobNumber,
        pieceCode: rework.pieceCode,
        material: rework.material,
        movementType: "Rework Started",
        from: "Rework Inventory (Pending)",
        to: "Rework Inventory (In Progress)",
        quantity: rework.quantity,
        ...(assignedTo ? { user: assignedTo } : {}),
      }),
      ...s.movementHistory,
    ];

    return { reworkMaterials, movementHistory };
  });
}

/** In Progress -> Completed. Repaired pieces return to Finished Pieces inventory. */
export function completeRework(reworkId) {
  setState((s) => {
    const rework = s.reworkMaterials.find((r) => r.id === reworkId);
    if (!rework || rework.status !== "In Progress") return s;

    const reworkMaterials = s.reworkMaterials.map((r) =>
      r.id === reworkId ? { ...r, status: "Completed" } : r
    );

    // Bump availableQty on the matching finished piece if it still exists,
    // otherwise create a new finished-piece row for the repaired quantity.
    const existingPiece = s.finishedPieces.find(
      (p) => p.pieceCode === rework.pieceCode && p.jobNumber === rework.jobNumber
    );

    const finishedPieces = existingPiece
      ? s.finishedPieces.map((p) =>
          p.id === existingPiece.id
            ? {
                ...p,
                quantity: p.quantity + rework.quantity,
                availableQty: p.availableQty + rework.quantity,
                status: "Ready",
              }
            : p
        )
      : [
          {
            id: nextId("FP"),
            jobNumber: rework.jobNumber,
            poNumber: rework.poNumber,
            plateNumber: null,
            sourceType: "Reworked",
            pieceCode: rework.pieceCode,
            drawingNumber: rework.drawingNumber,
            material: rework.material,
            grade: rework.grade,
            quantity: rework.quantity,
            availableQty: rework.quantity,
            weight: 0,
            warehouse: "",
            status: "Ready",
          },
          ...s.finishedPieces,
        ];

    const rejectionMaterials = s.rejectionMaterials.map((r) =>
      r.id === rework.rejectId ? { ...r, status: "Closed" } : r
    );

    const reworkCompletedEntry = logMovement({
      poNumber: rework.poNumber,
      jobNumber: rework.jobNumber,
      pieceCode: rework.pieceCode,
      material: rework.material,
      movementType: "Rework Completed",
      from: "Rework Inventory (In Progress)",
      to: "Rework Inventory (Completed)",
      quantity: rework.quantity,
    });
    const returnedToFinishedEntry = logMovement({
      poNumber: rework.poNumber,
      jobNumber: rework.jobNumber,
      pieceCode: rework.pieceCode,
      material: rework.material,
      movementType: "Returned To Finished Pieces",
      from: "Rework Inventory",
      to: "Finished Pieces Inventory",
      quantity: rework.quantity,
    });

    const movementHistory = [
      returnedToFinishedEntry,
      reworkCompletedEntry,
      ...s.movementHistory,
    ];

    return { reworkMaterials, finishedPieces, rejectionMaterials, movementHistory };
  });
}

/** In Progress -> Failed. Failed rework becomes Scrap (Source = Rework). */
export function scrapFromRework(reworkId) {
  setState((s) => {
    const rework = s.reworkMaterials.find((r) => r.id === reworkId);
    if (!rework || rework.status !== "In Progress") return s;

    const reworkMaterials = s.reworkMaterials.map((r) =>
      r.id === reworkId ? { ...r, status: "Failed" } : r
    );

    const scrapRecord = {
      id: nextId("SCR"),
      jobNumber: rework.jobNumber,
      poNumber: rework.poNumber,
      material: rework.material,
      grade: rework.grade,
      sourceJob: rework.jobNumber,
      plateNumber: null,
      heatNumber: null,
      weight: 0,
      quantity: rework.quantity,
      reason: "Rework Failed",
      department: "Rework",
      remarks: `Scrapped from ${rework.id} (Reject ${rework.rejectId})`,
      warehouse: "",
      source: "Rework",
      status: "Available",
      date: todayStr(),
    };

    const scrapMaterials = [scrapRecord, ...s.scrapMaterials];

    const rejectionMaterials = s.rejectionMaterials.map((r) =>
      r.id === rework.rejectId ? { ...r, status: "Converted to Scrap" } : r
    );

    const movementHistory = [
      logMovement({
        poNumber: rework.poNumber,
        jobNumber: rework.jobNumber,
        pieceCode: rework.pieceCode,
        material: rework.material,
        movementType: "Rework Failed - Scrapped",
        from: "Rework Inventory",
        to: "Scrap Inventory",
        quantity: rework.quantity,
      }),
      ...s.movementHistory,
    ];

    return { reworkMaterials, scrapMaterials, rejectionMaterials, movementHistory };
  });
}

// -----------------------------------------------------------------------------
// READ-ONLY SELECTORS — used by Material Movement History & Reports pages.
// Pure functions operating on a store snapshot (from useMaterialStore()).
// These do not mutate state and do not belong to the write-path business
// logic above; they only derive/aggregate data that already exists.
// -----------------------------------------------------------------------------

// Friendlier display labels for the raw movementType strings written above.
const TIMELINE_LABELS = {
  "Purchase Order Raised": "PO Created",
  "GRN Receipt": "GRN Received",
  "Material Stock Updated": "Material Stock",
  "Issue to Cutting": "Issue To Cutting",
  "Issue to Outsourcing": "Issue To Outsourcing",
  "Delivery Challan Generated": "Delivery Challan Generated",
  "Receive from Cutting - Finished Pieces (Fully Consumed Plates)": "Finished Pieces Created",
  "Receive from Cutting - Finished Pieces (Remaining Plates)": "Finished Pieces Created",
  "Receive from Cutting - Balance": "Cutting Balance Created",
  "Receive from Cutting - Scrap": "Scrap Created",
  "Receive from Cutting - Rejection": "Rejection Created",
  "Receive from Outsourcing - Finished Pieces (Fully Consumed Plates)": "Finished Pieces Created",
  "Receive from Outsourcing - Finished Pieces (Remaining Plates)": "Finished Pieces Created",
  "Receive from Outsourcing - Balance": "Cutting Balance Created",
  "Receive from Outsourcing - Scrap": "Scrap Created",
  "Receive from Outsourcing - Rejection": "Rejection Created",
  "Sent To Rework": "Sent To Rework",
  "Rework Started": "Rework Started",
  "Rework Completed": "Rework Completed",
  "Returned To Finished Pieces": "Returned To Finished Pieces",
  "Converted To Scrap": "Converted To Scrap",
  "Rework Failed - Scrapped": "Converted To Scrap",
  "Issue to Production": "Issue To Production",
  "Manual Scrap Entry": "Manual Scrap Entry",
  "Manual Scrap Deleted": "Manual Scrap Deleted",
};

/** Summary stats for the Material Movement History dashboard cards. */
export function getMovementStats(store) {
  return {
    totalMovements: store.movementHistory.length,
    totalPurchaseOrders: store.purchaseOrders.length,
    openJobs:
      store.cuttingJobs.filter((j) => j.status === "Open").length +
      store.outsourcingJobs.filter((j) => j.status === "Open").length,
    completedJobs:
      store.cuttingJobs.filter((j) => j.status === "Received").length +
      store.outsourcingJobs.filter((j) => j.status === "Received").length,
  };
}

/**
 * Builds the full chronological lifecycle timeline for one PO, dynamically
 * from movementHistory (plus a synthesized "PO Created" entry when no
 * explicit "Purchase Order Raised" movement exists for older seed POs).
 * Events that never happened for this PO simply never appear.
 */
export function buildPOTimeline(store, poNumber) {
  const po = store.purchaseOrders.find((p) => p.poNumber === poNumber);
  if (!po) return [];

  const jobNumbers = new Set([
    ...store.cuttingJobs.filter((j) => j.poNumber === poNumber).map((j) => j.jobNumber),
    ...store.outsourcingJobs.filter((j) => j.poNumber === poNumber).map((j) => j.jobNumber),
  ]);

  const relevant = store.movementHistory.filter((m) => {
    if (m.poNumber === poNumber) return true;
    if (m.jobNumber && jobNumbers.has(m.jobNumber)) return true;
    return false;
  });

  // MOV ids are assigned in creation order (MOV-1, MOV-2, ...), and rows are
  // always prepended to movementHistory, so sorting by numeric id ascending
  // recovers the true chronological order regardless of same-day dates.
  const idNum = (m) => parseInt(String(m.id).split("-")[1], 10) || 0;
  const sorted = [...relevant].sort((a, b) => idNum(a) - idNum(b));

  const timeline = sorted.map((m) => ({
    ...m,
    stageLabel: TIMELINE_LABELS[m.movementType] || m.movementType,
  }));

  const hasCreatedEvent = sorted.some((m) => m.movementType === "Purchase Order Raised");
  if (!hasCreatedEvent) {
    timeline.unshift({
      id: `PO-CREATED-${poNumber}`,
      poNumber,
      jobNumber: null,
      plateNumber: po.plateNumber,
      pieceCode: null,
      material: po.material,
      movementType: "Purchase Order Raised",
      stageLabel: "PO Created",
      from: po.supplier,
      to: poNumber,
      quantity: po.orderedQty,
      date: "—",
      time: "—",
      user: "System",
      remarks: `Ordered ${po.orderedQty} unit(s) of ${po.material} from ${po.supplier}`,
      status: po.status,
    });
  }

  return timeline;
}

/** Dashboard summary totals for the Reports page. */
export function getReportTotals(store) {
  return {
    totalPurchaseOrders: store.purchaseOrders.length,
    totalMaterialStock: store.materialStock.reduce((sum, r) => sum + (Number(r.availableQty) || 0), 0),
    totalFinishedPieces: store.finishedPieces.reduce((sum, p) => sum + (Number(p.availableQty) || 0), 0),
    totalCuttingBalance: store.cuttingBalanceStock.length,
    totalScrapWeight: store.scrapMaterials.reduce((sum, r) => sum + (Number(r.weight) || 0), 0),
    totalRejections: store.rejectionMaterials.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
    totalRework: store.reworkMaterials.length,
    totalProductionIssues: store.productionIssues.reduce((sum, p) => sum + (Number(p.issuedQty) || 0), 0),
  };
}

// ---- Hook ----------------------------------------------------------------

export function useMaterialStore() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}

export const statusOptions = {
  po: ["Pending", "Partial", "Completed"],
  scrap: ["Available", "Sold", "Disposed"],
  scrapSource: ["Cutting", "Manual", "Rejection", "Rework"],
  rejection: ["Wrong Dimension", "Bent", "Rust", "Quality Failure", "Damaged"],
  rejectionStatus: ["Pending", "Sent for Rework", "Converted to Scrap", "Closed"],
  rework: ["Pending", "In Progress", "Completed", "Failed"],
  finishedPiece: ["Ready", "Partially Issued", "Fully Issued"],
  cuttingBalance: ["Available", "Issued to Production", "Consumed"],
};