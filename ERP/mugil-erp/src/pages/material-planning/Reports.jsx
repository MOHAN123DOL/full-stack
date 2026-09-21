// Reports.jsx
// =============================================================================
// Material Management Reports — process-based ERP reporting.
//
// IMPORTANT ARCHITECTURE NOTE
// ----------------------------------------------------------------------------
// There is no shared cross-module store in this codebase. This page reproduces,
// as its own read-only reference data, the SAME records already seeded in each
// real module (same PO numbers, DWG numbers, job/assembly IDs, quantities,
// people, dates), joined together the way the ERP process actually connects
// them. Every report has its own explicit column list.
// =============================================================================

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../../components/Header";
import "./Reports.css";

/* ============================================================================
   FORMAT / DATE HELPERS
   ============================================================================ */

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return String(v);
  return String(v);
};

const parseISO = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (!d || Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const daysBetween = (fromIso, toIso) => {
  const MS_DAY = 1000 * 60 * 60 * 24;
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / MS_DAY);
};

const durationLabel = (startIso, endIso) => {
  if (!startIso || !endIso) return "—";
  const n = daysBetween(startIso, endIso);
  return n <= 0 ? "0 Days" : `${n} Day${n === 1 ? "" : "s"}`;
};

const dispatchDiffLabel = (dispatchIso, endIso) => {
  if (!dispatchIso || !endIso) return "—";
  const n = daysBetween(endIso, dispatchIso);
  if (n === 0) return "Same Day · 0 Days";
  if (n > 0) return `${n} Day${n === 1 ? "" : "s"} After Production`;
  return `${Math.abs(n)} Day${Math.abs(n) === 1 ? "" : "s"} Before Production Completion`;
};

function inDateRange(dateStr, from, to) {
  if (!from && !to) return true;
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function matchesText(haystack, needle) {
  if (!needle) return true;
  return String(haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

/* ============================================================================
   1 & 2 — PO ITEMS + GRN HISTORY
   ============================================================================ */

const PO_ITEMS = [
  { id: "poi-1", poType: "Actual PO", poNumber: "PO-001", supplier: "ABC Steel Industries", description: "Description-1", material: "Plate", materialCode: "15110292000", materialSpec: "IS2062 E250A", thickness: "10 mm", size: "1500 x 6000", unit: "Nos", poQty: 5, received: 0, integrationStatus: "Integrated", project: "BHEL Boiler Fabrication", dwgNumber: "DWG-001", dwgDescription: "Description-1", integrationDate: "2026-08-24" },
  { id: "poi-2", poType: "Actual PO", poNumber: "PO-001", supplier: "ABC Steel Industries", description: "Description-2", material: "Pipe", materialCode: "15038626610", materialSpec: "IS1161 YST240", thickness: "4 mm", size: "100 NB", unit: "Mtr", poQty: 10, received: 4, integrationStatus: "Integrated", project: "BHEL Boiler Fabrication", dwgNumber: "DWG-001", dwgDescription: "Description-2", integrationDate: "2026-08-24" },
  { id: "poi-3", poType: "Actual PO", poNumber: "PO-002", supplier: "XYZ Steel Suppliers", description: "Description-1", material: "Channel", materialCode: "15010350000", materialSpec: "IS2062 E250A", thickness: "6 mm", size: "100 x 50 x 6", unit: "Nos", poQty: 8, received: 8, integrationStatus: "Integrated", project: "NTPC Structural Project", dwgNumber: "DWG-101", dwgDescription: "Description-1", integrationDate: "2026-08-16" },
  { id: "poi-4", poType: "Actual PO", poNumber: "PO-002", supplier: "XYZ Steel Suppliers", description: "Description-2", material: "Pipe", materialCode: "15038626610", materialSpec: "IS1161 YST240", thickness: "6 mm", size: "150 NB", unit: "Mtr", poQty: 10, received: 10, integrationStatus: "Integrated", project: "NTPC Structural Project", dwgNumber: "DWG-101", dwgDescription: "Description-2", integrationDate: "2026-08-21" },
  { id: "poi-5", poType: "Actual PO", poNumber: "PO-003", supplier: "Steel Traders Co.", description: "Description-1", material: "Angle", materialCode: "15013159000", materialSpec: "IS2062 E250A", thickness: "6 mm", size: "50 x 50 x 6", unit: "Nos", poQty: 12, received: 0, integrationStatus: "Not Integrated", project: "—", dwgNumber: "—", dwgDescription: "—", integrationDate: null },
  { id: "poi-6", poType: "Actual PO", poNumber: "PO-005", supplier: "Steel Traders Co.", description: "Description-1", material: "Plate", materialCode: "15110292000", materialSpec: "IS2062 E250A", thickness: "12 mm", size: "2000 x 6000", unit: "Nos", poQty: 5, received: 0, integrationStatus: "Not Integrated", project: "—", dwgNumber: "—", dwgDescription: "—", integrationDate: null },
  { id: "poi-7", poType: "Dummy PO", poNumber: "DPO-001", supplier: "Dummy / Internal", description: "Description-1", material: "Channel", materialCode: "15010135000", materialSpec: "IS2062 E250A", thickness: "8 mm", size: "125 x 65 x 6", unit: "Nos", poQty: 6, received: 2, integrationStatus: "Not Integrated", project: "—", dwgNumber: "—", dwgDescription: "—", integrationDate: null },
];
const poItemById = (id) => PO_ITEMS.find((p) => p.id === id);

const GRN_HISTORY = [
  { id: "grn-1", grnNumber: "GRN-0001", grnDate: "2026-08-25", itemId: "poi-2", poNumber: "PO-001", description: "Description-2", material: "Pipe", receivedQty: 4, receivingUnit: "Unit 1", inspectionStatus: "Accepted", inspectedBy: "Arun", receivedBy: "Suresh", remarks: "First batch of pipes received in good condition." },
  { id: "grn-2", grnNumber: "GRN-0002", grnDate: "2026-08-18", itemId: "poi-3", poNumber: "PO-002", description: "Description-1", material: "Channel", receivedQty: 8, receivingUnit: "Unit 1", inspectionStatus: "Accepted", inspectedBy: "Kumar", receivedBy: "Ravi", remarks: "Full quantity received against PO-002." },
  { id: "grn-3", grnNumber: "GRN-0003", grnDate: "2026-07-20", itemId: "poi-4", poNumber: "PO-002", description: "Description-2", material: "Pipe", receivedQty: 10, receivingUnit: "Unit 2", inspectionStatus: "Accepted", inspectedBy: "Manoj", receivedBy: "Arun", remarks: "Received directly at Unit 2 store." },
  { id: "grn-4", grnNumber: "GRN-0004", grnDate: "2026-08-30", itemId: "poi-7", poNumber: "DPO-001", description: "Description-1", material: "Channel", receivedQty: 2, receivingUnit: "Unit 1", inspectionStatus: "Pending", inspectedBy: "—", receivedBy: "Kumar", remarks: "Partial receipt against dummy PO, awaiting inspection." },
];

/* ============================================================================
   3 — MATERIAL STOCK
   ============================================================================ */

const MATERIAL_STOCK = [
  { id: "stk-1", stockId: "STK-1001", unit: "Unit 1", sourceType: "PO", poNumber: "PO-001", description: "Description-1", material: "Plate", materialCode: "15110292000", materialSpec: "IS2062 E250A", thickness: "8 mm", size: "1500 x 3000", plateNumber: "PL-001", originalQuantity: 5, availableQuantity: 5, uom: "Nos", project: "BHEL Boiler Fabrication", dwgDescription: "DWG-001 / Description-1", revision: "REV-01", stockStatus: "Available", reworkRequired: "No" },
  { id: "stk-2", stockId: "STK-1002", unit: "Unit 1", sourceType: "Dummy PO", poNumber: "DPO-001", description: "Description-1", material: "Channel", materialCode: "15010135000", materialSpec: "IS2062 E250A", thickness: "6 mm", size: "100 x 50 x 5", plateNumber: "—", originalQuantity: 6, availableQuantity: 6, uom: "Nos", project: "—", dwgDescription: "—", revision: "—", stockStatus: "Available", reworkRequired: "No" },
  { id: "stk-3", stockId: "STK-1003", unit: "Unit 2", sourceType: "Job Remaining", poNumber: "PO-002", description: "Description-2", material: "Pipe", materialCode: "15038626610", materialSpec: "IS1161 YST240", thickness: "4 mm", size: "100 NB", plateNumber: "—", originalQuantity: 10, availableQuantity: 3, uom: "Mtr", project: "NTPC Structural Project", dwgDescription: "DWG-101 / Description-2", revision: "REV-01", stockStatus: "Remaining", reworkRequired: "No" },
  { id: "stk-4", stockId: "STK-1004", unit: "Unit 1", sourceType: "Cutting Remaining", poNumber: "PO-001", description: "Description-1", material: "Plate", materialCode: "15110292000", materialSpec: "IS2062 E250A", thickness: "8 mm", size: "2000 x 2000", plateNumber: "PL-001-R1", originalQuantity: 1, availableQuantity: 1, uom: "Nos", project: "BHEL Boiler Fabrication", dwgDescription: "DWG-001 / Description-1", revision: "REV-01", stockStatus: "Cutting Remaining", reworkRequired: "Yes" },
  { id: "stk-5", stockId: "STK-1005", unit: "Unit 1", sourceType: "PO", poNumber: "PO-002", description: "Description-2", material: "Pipe", materialCode: "15038626610", materialSpec: "IS1161 YST240", thickness: "4 mm", size: "100 NB", plateNumber: "—", originalQuantity: 4, availableQuantity: 2, uom: "Mtr", project: "NTPC Structural Project", dwgDescription: "DWG-101 / Description-2", revision: "REV-01", stockStatus: "Available", reworkRequired: "No" },
  { id: "stk-8", stockId: "STK-1008", unit: "Unit 1", sourceType: "PO", poNumber: "PO-003", description: "Description-1", material: "Angle", materialCode: "15013159000", materialSpec: "IS2062 E250A", thickness: "6 mm", size: "65 x 65 x 6", plateNumber: "—", originalQuantity: 12, availableQuantity: 0, uom: "Nos", project: "—", dwgDescription: "—", revision: "—", stockStatus: "Available", reworkRequired: "No" },
];

/* ============================================================================
   4 — ISSUE TO JOB WORK
   ============================================================================ */

const ISSUE_TO_JOBWORK = [
  { id: "ISS-001", date: "2026-08-28", poNumber: "PO-001", description: "Description-1", project: "BHEL Boiler Fabrication", dwg: "DWG-001", material: "Plate", process: "Cutting", processId: "CUT01", jobWorkType: "In-House", unit: "Unit 1", vendor: "—", quantity: 6, uom: "Nos", issuedBy: "Arun", status: "Issued" },
  { id: "ISS-002", date: "2026-08-30", poNumber: "PO-002", description: "Description-2", project: "NTPC Structural Project", dwg: "DWG-101", material: "Pipe", process: "Welding", processId: "WELD01", jobWorkType: "Outsourcing", unit: "—", vendor: "Shree Fabricators", quantity: 4, uom: "Mtr", issuedBy: "Suresh", status: "Issued" },
  { id: "ISS-003", date: "2026-08-27", poNumber: "DPO-001", description: "Description-1", project: "BHEL Boiler Fabrication", dwg: "DWG-001", material: "Plate", process: "Bending", processId: "BEND01", jobWorkType: "In-House", unit: "Unit 1", vendor: "—", quantity: 12, uom: "Nos", issuedBy: "Manoj Prabhu", status: "Issued" },
];

/* ============================================================================
   5 — RECEIVE FROM JOB WORK
   ============================================================================ */

const RECEIVE_FROM_JOBWORK = [
  { id: "JW-1001", poType: "PO", poNumber: "PO-001", supplier: "—", poDescription: "Description-1", project: "BHEL Boiler Fabrication", dwg: "DWG-001", dwgDescription: "DWG-001 / Description-1", revision: "REV-01", material: "Plate", materialCode: "15110292000", materialSpec: "IS2062 E250A", thickness: "8 mm", requiredQty: 26, uom: "Nos", size: "2000 × 2000", unit: "Unit 1", jobWorkType: "In-House", process: "Cutting", processId: "CUT01", issueDate: "2026-08-28", issuedQty: 26, previouslyReceived: 25, outputQty: 25, reworkPending: true },
  { id: "JW-1002", poType: "PO", poNumber: "PO-002", supplier: "Shree Fabricators", poDescription: "Description-2", project: "NTPC Structural Project", dwg: "DWG-101", dwgDescription: "DWG-101 / Description-2", revision: "REV-01", material: "Pipe", materialCode: "15038626610", materialSpec: "IS1161 YST240", thickness: "4 mm", requiredQty: 10, uom: "Mtr", size: "100 NB", unit: "Unit 1", jobWorkType: "Outsourcing", process: "Welding", processId: "WELD01", issueDate: "2026-08-30", issuedQty: 10, previouslyReceived: 4, outputQty: 4, reworkPending: false },
  { id: "JW-1003", poType: "Dummy PO", poNumber: "DPO-001", supplier: "—", poDescription: "Description-1", project: "BHEL Boiler Fabrication", dwg: "DWG-001", dwgDescription: "DWG-001 / Description-1", revision: "REV-01", material: "Plate", materialCode: "15110293000", materialSpec: "IS2062 E250A", thickness: "10 mm", requiredQty: 12, uom: "Nos", size: "500 × 600", unit: "Unit 1", jobWorkType: "In-House", process: "Bending", processId: "BEND01", issueDate: "2026-08-27", issuedQty: 12, previouslyReceived: 12, outputQty: 12, reworkPending: false },
];
const rfjwStatus = (j) => {
  if (j.reworkPending) return "Rework Pending";
  if (j.previouslyReceived <= 0) return "Not Received";
  if (j.previouslyReceived < j.issuedQty) return "Partially Received";
  return "Fully Received";
};

/* ============================================================================
   6 — CUTTING / FINISHED PIECES
   ============================================================================ */

const CUTTING_OUTPUT_PIECES = [
  { pieceNo: "PL-001", size: "250 × 250", length: 250, width: 250, qty: 10, weight: 39.2, reworked: "No" },
  { pieceNo: "PL-002", size: "260 × 260", length: 260, width: 260, qty: 20, weight: 42.4, reworked: "No" },
  { pieceNo: "PL-026", size: "300 × 400", length: 300, width: 400, qty: 1, weight: 7.5, reworked: "Yes" },
];
const CUTTING_JOB = { id: "JW-1001", poNumber: "PO-001", project: "BHEL Boiler Fabrication", material: "Plate", materialCode: "15110292000", thickness: "8 mm", originalSize: "2000 × 2000", unit: "Nos", date: "2026-08-28" };

/* ============================================================================
   7 — ISSUE TO PRODUCTION
   ============================================================================ */

const ISSUE_TO_PRODUCTION = [
  { issueId: "IP-0001", jobWorkId: "JW-1001", poType: "Job Work PO", poNumber: "PO-001", supplier: "Sri Balaji Fabricators", poDescription: "Description-1", project: "BHEL Boiler Fabrication", dwg: "DWG-001", dwgDescription: "Base Plate Layout", revision: "REV-02", material: "Plate", materialCode: "MAT-PL-001", materialSpec: "IS2062 E250A", thickness: "8 mm", size: "250 × 250", unit: "Unit 1", jobWorkType: "In-House", process: "Cutting", processId: "CUT01", originalReceivedQty: 10, previouslyIssuedQty: 0, issuedNow: 6, remainingAvailableQty: 4, issuedBy: "R. Kumar", issueDate: "2026-09-02", status: "In Production" },
  { issueId: "IP-0002", jobWorkId: "JW-1001", poType: "Job Work PO", poNumber: "PO-001", supplier: "Sri Balaji Fabricators", poDescription: "Description-1", project: "BHEL Boiler Fabrication", dwg: "DWG-001", dwgDescription: "Base Plate Layout", revision: "REV-02", material: "Plate", materialCode: "MAT-PL-001", materialSpec: "IS2062 E250A", thickness: "8 mm", size: "260 × 260", unit: "Unit 1", jobWorkType: "In-House", process: "Cutting", processId: "CUT01", originalReceivedQty: 20, previouslyIssuedQty: 0, issuedNow: 20, remainingAvailableQty: 0, issuedBy: "S. Elango", issueDate: "2026-08-29", status: "Completed" },
  { issueId: "IP-0003", jobWorkId: "JW-1002", poType: "Outsourced PO", poNumber: "PO-101", supplier: "Chennai Piping Works", poDescription: "Description-2", project: "NTPC Structural Project", dwg: "DWG-101", dwgDescription: "Pipe Rack Layout", revision: "R1", material: "Pipe", materialCode: "MAT-PP-100NB", materialSpec: "IS1239 Medium", thickness: "4 mm", size: "100 NB", unit: "Unit 2", jobWorkType: "Outsourcing", process: "Welding", processId: "WELD01", originalReceivedQty: 8, previouslyIssuedQty: 0, issuedNow: 8, remainingAvailableQty: 0, issuedBy: "R. Kumar", issueDate: "2026-08-25", status: "In Production" },
  { issueId: "IP-0004", jobWorkId: "JW-1003", poType: "Direct PO", poNumber: "PO-205", supplier: "Apex Steel Traders", poDescription: "Description-3", project: "Vedanta Structural Project", dwg: "DWG-205", dwgDescription: "Channel Support Layout", revision: "R3", material: "Channel", materialCode: "MAT-CH-150", materialSpec: "IS808 ISMC150", thickness: "6 mm", size: "150 × 75", unit: "Unit 1", jobWorkType: "In-House", process: "Bending", processId: "BEND01", originalReceivedQty: 18, previouslyIssuedQty: 0, issuedNow: 5, remainingAvailableQty: 13, issuedBy: "Manoj Prabhu", issueDate: "2026-09-01", status: "Issued" },
];

/* ============================================================================
   8 — PRODUCTION ASSEMBLY INTEGRATION
   ============================================================================ */

const ASSEMBLY_INPUT_MATERIALS = {
  "PM-PL01": { material: "Plate", materialCode: "PL-001", dwg: "DWG-01", poNumber: "PO-001" },
  "PM-PI01": { material: "Pipe", materialCode: "PI-001", dwg: "DWG-01", poNumber: "PO-002" },
  "PM-CH01": { material: "Channel", materialCode: "CH-001", dwg: "DWG-02", poNumber: "PO-003" },
  "PM-PI02": { material: "Pipe", materialCode: "PI-002", dwg: "DWG-02", poNumber: "PO-004" },
};

const ASSEMBLY_INTEGRATIONS = [
  {
    assemblyId: "ASM-001", project: "BHEL-001",
    inputs: [{ sourceType: "material", sourceId: "PM-PL01", useQty: 3 }, { sourceType: "material", sourceId: "PM-PI01", useQty: 3 }],
    processNames: ["Fit-up", "Welding", "Grinding", "Painting"],
    status: "In Progress", createdDate: "2026-08-29",
  },
  {
    assemblyId: "ASM-002", project: "BHEL-001",
    inputs: [{ sourceType: "material", sourceId: "PM-CH01", useQty: 3 }, { sourceType: "material", sourceId: "PM-PI02", useQty: 3 }],
    processNames: ["Fit-up", "Welding", "Inspection"],
    status: "In Progress", createdDate: "2026-09-02",
  },
  {
    assemblyId: "ASM-003", project: "BHEL-001",
    inputs: [{ sourceType: "assembly", sourceId: "ASM-001", useQty: 1 }, { sourceType: "assembly", sourceId: "ASM-002", useQty: 1 }],
    processNames: ["Fit-up", "Welding", "NDT", "Painting"],
    status: "Planned", createdDate: "2026-09-04",
  },
];

/* ============================================================================
   9 — PRODUCTION OPERATION (+ embedded QC)
   ============================================================================ */

const ASSEMBLY_DWG = { "ASM-001": "DWG-01 + DWG-02", "ASM-002": "DWG-03", "ASM-003": "DWG-101", "ASM-004": "DWG-201", "ASM-005": "DWG-04" };

const PRODUCTION_OPERATION_STAGES = [
  { assemblyId: "ASM-001", project: "BHEL-001", process: "Fit-up", processId: "FIT01", sequence: 1, totalQty: 5, availableQty: 5, completedQty: 5, pendingQty: 0, reworkQty: 0, performedBy: "Manoj Prabhu", supervisor: "Arun Kumar", startDate: "2026-08-22", completionDate: "2026-08-22", qcStatus: "Accepted", qcVerifiedBy: "Ravi Shankar", qcDate: "2026-08-22", acceptedQty: 5, rejectedQty: 0, processStatus: "Completed" },
  { assemblyId: "ASM-001", project: "BHEL-001", process: "Welding", processId: "WEL01", sequence: 2, totalQty: 5, availableQty: 5, completedQty: 5, pendingQty: 0, reworkQty: 1, performedBy: "S. Elango", supervisor: "Ravi Shankar", startDate: "2026-08-23", completionDate: "2026-08-24", qcStatus: "Rejected", qcVerifiedBy: "Ravi Shankar", qcDate: "2026-08-24", acceptedQty: 4, rejectedQty: 1, processStatus: "Rework Required" },
  { assemblyId: "ASM-001", project: "BHEL-001", process: "Grinding", processId: "GRD01", sequence: 3, totalQty: 5, availableQty: 4, completedQty: 0, pendingQty: 4, reworkQty: 0, performedBy: null, supervisor: null, startDate: null, completionDate: null, qcStatus: "Not Required", qcVerifiedBy: null, qcDate: null, acceptedQty: 0, rejectedQty: 0, processStatus: "In Progress" },
  { assemblyId: "ASM-001", project: "BHEL-001", process: "Painting", processId: "PNT01", sequence: 4, totalQty: 5, availableQty: 0, completedQty: 0, pendingQty: 0, reworkQty: 0, performedBy: null, supervisor: null, startDate: null, completionDate: null, qcStatus: "Not Started", qcVerifiedBy: null, qcDate: null, acceptedQty: 0, rejectedQty: 0, processStatus: "Waiting For Previous Process" },
  { assemblyId: "ASM-002", project: "BHEL-001", process: "Fit-up", processId: "FIT01", sequence: 1, totalQty: 3, availableQty: 3, completedQty: 3, pendingQty: 0, reworkQty: 0, performedBy: "Manoj Prabhu", supervisor: "Arun Kumar", startDate: "2026-09-02", completionDate: "2026-09-02", qcStatus: "Accepted", qcVerifiedBy: "Ravi Shankar", qcDate: "2026-09-02", acceptedQty: 3, rejectedQty: 0, processStatus: "Completed" },
  { assemblyId: "ASM-002", project: "BHEL-001", process: "Welding", processId: "WEL01", sequence: 2, totalQty: 3, availableQty: 3, completedQty: 3, pendingQty: 0, reworkQty: 0, performedBy: "S. Elango", supervisor: "Ravi Shankar", startDate: "2026-09-03", completionDate: "2026-09-03", qcStatus: "Accepted", qcVerifiedBy: "Ravi Shankar", qcDate: "2026-09-03", acceptedQty: 3, rejectedQty: 0, processStatus: "Completed" },
  { assemblyId: "ASM-002", project: "BHEL-001", process: "Inspection", processId: "INS01", sequence: 3, totalQty: 3, availableQty: 3, completedQty: 3, pendingQty: 0, reworkQty: 0, performedBy: "R. Kumar", supervisor: "Arun Kumar", startDate: "2026-09-04", completionDate: "2026-09-04", qcStatus: "Pending", qcVerifiedBy: null, qcDate: null, acceptedQty: 0, rejectedQty: 0, processStatus: "QC Pending" },
  { assemblyId: "ASM-003", project: "BHEL-001", process: "Fit-up", processId: "FIT01", sequence: 1, totalQty: 1, availableQty: 1, completedQty: 1, pendingQty: 0, reworkQty: 0, performedBy: "Manoj Prabhu", supervisor: "Arun Kumar", startDate: "2026-08-10", completionDate: "2026-08-10", qcStatus: "Accepted", qcVerifiedBy: "Ravi Shankar", qcDate: "2026-08-12", acceptedQty: 0, rejectedQty: 1, processStatus: "Ready For Next Process" },
  { assemblyId: "ASM-004", project: "BHEL-002", process: "Grinding", processId: "GRD01", sequence: 1, totalQty: 8, availableQty: 8, completedQty: 6, pendingQty: 0, reworkQty: 2, performedBy: "S. Elango", supervisor: "Manoj Prabhu", startDate: "2026-08-21", completionDate: "2026-08-21", qcStatus: "Not Required", qcVerifiedBy: null, qcDate: null, acceptedQty: 0, rejectedQty: 0, processStatus: "Rework Required" },
  { assemblyId: "ASM-005", project: "BHEL-002", process: "NDT", processId: "NDT01", sequence: 1, totalQty: 3, availableQty: 3, completedQty: 0, pendingQty: 0, reworkQty: 1, performedBy: "R. Kumar", supervisor: "Arun Kumar", startDate: "2026-08-18", completionDate: "2026-08-18", qcStatus: "Rejected", qcVerifiedBy: "Arun Kumar", qcDate: "2026-08-18", acceptedQty: 0, rejectedQty: 3, processStatus: "Rework Required" },
];

/* ============================================================================
   10 — REWORK
   ============================================================================ */

const REWORK_ITEMS = [
  { reworkId: "RW-RJ-001", source: "Receive From Job Work", project: "BHEL Boiler Fabrication", dwg: "DWG-001", poNumber: "PO-001", poDescription: "Description-1", assembly: "—", material: "Plate", pieceNo: "PL-026", process: "—", requiredQty: 1, completedQty: 0, reworkDoneBy: null, supervisor: null, startDate: null, startTime: null, completionDate: null, completionTime: null, status: "Rework Required", remarks: "1 of 26 not usable as-is." },
  { reworkId: "RW-RJ-002", source: "Receive From Job Work", project: "NTPC Structural Project", dwg: "DWG-101", poNumber: "PO-002", poDescription: "Description-2", assembly: "—", material: "Pipe", pieceNo: "PI-045", process: "—", requiredQty: 1, completedQty: 0, reworkDoneBy: "Arun", supervisor: "Ravi", startDate: "2026-09-03", startTime: "09:15", completionDate: null, completionTime: null, status: "Rework In Progress", remarks: "Weld seam misalignment on outer joint." },
  { reworkId: "RW-RJ-003", source: "Receive From Job Work", project: "BHEL Boiler Fabrication", dwg: "DWG-004", poNumber: "PO-004", poDescription: "Description-4", assembly: "—", material: "Plate", pieceNo: "PL-118 to PL-120", process: "—", requiredQty: 3, completedQty: 2, reworkDoneBy: "Suresh", supervisor: "Ravi", startDate: "2026-08-29", startTime: "09:00", completionDate: "2026-08-30", completionTime: "16:10", status: "Partially Completed", remarks: "PL-118 and PL-119 corrected; 1 plate remaining." },
  { reworkId: "RW-RJ-004", source: "Receive From Job Work", project: "BHEL Boiler Fabrication", dwg: "DWG-001", poNumber: "DPO-001", poDescription: "Description-1", assembly: "—", material: "Plate", pieceNo: "PL-060", process: "—", requiredQty: 1, completedQty: 1, reworkDoneBy: "Manoj Prabhu", supervisor: "Ravi", startDate: "2026-08-20", startTime: "13:00", completionDate: "2026-08-21", completionTime: "10:45", status: "Available in Material Stock", remarks: "Edge reworked and verified — dimension within tolerance." },
  { reworkId: "RW-PO-001", source: "Production Operation", project: "BHEL-001", dwg: "DWG-01 + DWG-02", poNumber: "—", poDescription: "—", assembly: "ASM-001", material: "Plate + Pipe", pieceNo: "—", process: "Welding", requiredQty: 1, completedQty: 0, reworkDoneBy: null, supervisor: null, startDate: null, startTime: null, completionDate: null, completionTime: null, status: "Rework Required", remarks: "Porosity near joint 3." },
  { reworkId: "RW-PO-002", source: "Production Operation", project: "BHEL-002", dwg: "DWG-101", poNumber: "—", poDescription: "—", assembly: "ASM-004", material: "Angle", pieceNo: "—", process: "Grinding", requiredQty: 2, completedQty: 0, reworkDoneBy: "S. Elango", supervisor: "Manoj Prabhu", startDate: "2026-08-22", startTime: "09:30", completionDate: null, completionTime: null, status: "Rework In Progress", remarks: "2 pieces over-ground below tolerance." },
  { reworkId: "RW-PO-003", source: "Production Operation", project: "BHEL-002", dwg: "DWG-102", poNumber: "—", poDescription: "—", assembly: "ASM-005", material: "Channel", pieceNo: "—", process: "NDT", requiredQty: 3, completedQty: 2, reworkDoneBy: "R. Kumar", supervisor: "Arun Kumar", startDate: "2026-08-19", startTime: "08:45", completionDate: "2026-08-20", completionTime: "17:00", status: "Partially Completed", remarks: "2 of 3 welds re-done; 1 remaining." },
  { reworkId: "RW-PO-004", source: "Production Operation", project: "BHEL-001", dwg: "DWG-01 + DWG-02", poNumber: "—", poDescription: "—", assembly: "ASM-003", material: "Plate + Pipe (via ASM-001, ASM-002)", pieceNo: "—", process: "Fit-up", requiredQty: 1, completedQty: 1, reworkDoneBy: "Manoj Prabhu", supervisor: "Arun Kumar", startDate: "2026-08-11", startTime: "09:30", completionDate: "2026-08-12", completionTime: "15:20", status: "Ready for Next Process", remarks: "Re-aligned and re-tacked — cleared by QC." },
];
const reworkBalance = (r) => Math.max(0, r.requiredQty - r.completedQty);

/* ============================================================================
   11 — DISPATCH
   ============================================================================ */

const DISPATCH_ASSEMBLIES = [
  { assemblyId: "ASM-001", project: "BHEL-001", dwgs: ["DWG-01", "DWG-02"], revision: "Rev-02", description: "Fabricated Assembly", plannedQty: 26, productionStartDate: "2026-09-01", productionEndDate: "2026-09-06", reworkPendingQty: 0, dispatches: [] },
  { assemblyId: "ASM-002", project: "BHEL-001", dwgs: ["DWG-03"], revision: "Rev-01", description: "Fabricated Bracket Assembly", plannedQty: 26, productionStartDate: "2026-08-25", productionEndDate: "2026-09-04", reworkPendingQty: 0, dispatches: [{ dispatchId: "DISP-001", date: "2026-09-06", time: "10:30", dispatchTo: "BHEL", location: "Chennai Plant", vehicleNumber: "TN01AB1234", transporter: "ABC Transport", driverName: "Kumar", driverContact: "9876543210", qty: 20, remarks: "First lot dispatched." }] },
  { assemblyId: "ASM-003", project: "BHEL-002", dwgs: ["DWG-101"], revision: "Rev-00", description: "Support Frame Assembly", plannedQty: 40, productionStartDate: "2026-08-10", productionEndDate: "2026-08-20", reworkPendingQty: 0, dispatches: [
    { dispatchId: "DISP-002", date: "2026-08-22", time: "09:15", dispatchTo: "BHEL", location: "Trichy Plant", vehicleNumber: "TN37CD5678", transporter: "Sri Transport", driverName: "Selvam", driverContact: "9944556677", qty: 25, remarks: "First lot dispatched." },
    { dispatchId: "DISP-003", date: "2026-08-25", time: "14:00", dispatchTo: "BHEL", location: "Trichy Plant", vehicleNumber: "TN37CD5678", transporter: "Sri Transport", driverName: "Selvam", driverContact: "9944556677", qty: 15, remarks: "Final lot — assembly fully cleared." },
  ] },
  { assemblyId: "ASM-004", project: "Project-003", dwgs: ["DWG-201"], revision: "Rev-01", description: "Pipe Support Assembly", plannedQty: 12, productionStartDate: "2026-08-28", productionEndDate: "2026-09-05", reworkPendingQty: 0, dispatches: [] },
  { assemblyId: "ASM-005", project: "BHEL-001", dwgs: ["DWG-04"], revision: "Rev-00", description: "Cross Brace Assembly", plannedQty: 10, productionStartDate: "2026-09-02", productionEndDate: null, reworkPendingQty: 1, dispatches: [] },
];

const isReadyForDispatch = (a) => Boolean(a.productionEndDate) && a.reworkPendingQty === 0;
const buildDispatchAssemblyRow = (a) => {
  const dispatchedQty = a.dispatches.reduce((sum, d) => sum + d.qty, 0);
  const balanceQty = a.plannedQty - dispatchedQty;
  const dispatchStatus = !isReadyForDispatch(a)
    ? "Not Ready"
    : dispatchedQty === 0
      ? "Ready for Dispatch"
      : balanceQty > 0
        ? "Partially Dispatched"
        : "Dispatched";
  return { ...a, dwgText: a.dwgs.join(" + "), dispatchedQty, balanceQty, dispatchStatus, duration: durationLabel(a.productionStartDate, a.productionEndDate) };
};

/* ============================================================================
   12 — MATERIAL MOVEMENT HISTORY
   ============================================================================ */

const buildMovementHistory = () => {
  const rows = [];
  let n = 1;
  const push = (date, type, source, destination, extra) => {
    rows.push({ movementId: `MOV-${String(n++).padStart(4, "0")}`, date, time: extra.time || "—", movementType: type, source, destination, po: extra.po || "—", project: extra.project || "—", dwg: extra.dwg || "—", assembly: extra.assembly || "—", material: extra.material || "—", pieceNumber: extra.pieceNumber || "—", quantity: extra.quantity ?? "—", unit: extra.unit || "—", referenceId: extra.referenceId, status: extra.status || "—", poDescription: extra.poDescription || "—", thickness: extra.thickness || "—", size: extra.size || "—", process: extra.process || "—" });
  };

  GRN_HISTORY.forEach((g) => {
    const item = poItemById(g.itemId);
    push(g.grnDate, "GRN Received", g.poNumber, `Material Stock (${g.receivingUnit})`, { po: g.poNumber, project: item?.project, dwg: item?.dwgNumber, material: g.material, quantity: g.receivedQty, unit: item?.unit, referenceId: g.grnNumber, status: g.inspectionStatus, poDescription: item?.description, thickness: item?.thickness, size: item?.size });
  });

  ISSUE_TO_JOBWORK.forEach((i) => {
    push(i.date, "Issued to Job Work", "Material Stock", `${i.process} (${i.jobWorkType})`, { po: i.poNumber, project: i.project, dwg: i.dwg, material: i.material, quantity: i.quantity, unit: i.uom, referenceId: i.id, status: i.status, poDescription: i.description, process: i.process });
  });

  RECEIVE_FROM_JOBWORK.forEach((j) => {
    push(j.issueDate, "Received from Job Work", j.process, "Material Stock / Rework", { po: j.poNumber, project: j.project, dwg: j.dwg, material: j.material, quantity: j.outputQty, unit: j.uom, referenceId: j.id, status: rfjwStatus(j), poDescription: j.poDescription, thickness: j.thickness, size: j.size, process: j.process });
  });

  REWORK_ITEMS.forEach((r) => {
    push(r.startDate || r.completionDate || "2026-08-01", r.completionDate ? "Rework Completed" : "Rework Required", r.source, r.status === "Available in Material Stock" ? "Material Stock" : "Rework", { po: r.poNumber, project: r.project, dwg: r.dwg, assembly: r.assembly, material: r.material, pieceNumber: r.pieceNo, quantity: r.completedQty || r.requiredQty, unit: "Nos", referenceId: r.reworkId, status: r.status, poDescription: r.poDescription, process: r.process });
  });

  ISSUE_TO_PRODUCTION.forEach((i) => {
    push(i.issueDate, "Issued to Production", "Material Stock", "Production Assembly Integration", { po: i.poNumber, project: i.project, dwg: i.dwg, material: i.material, quantity: i.issuedNow, unit: i.unit, referenceId: i.issueId, status: i.status, poDescription: i.poDescription, thickness: i.thickness, size: i.size, process: i.process });
  });

  ASSEMBLY_INTEGRATIONS.forEach((a) => {
    push(a.createdDate, "Assembly Integration", "Issue To Production", "Production Operation", { project: a.project, assembly: a.assemblyId, material: a.inputs.map((inp) => (inp.sourceType === "material" ? ASSEMBLY_INPUT_MATERIALS[inp.sourceId]?.material : inp.sourceId)).join(" + "), quantity: a.inputs.reduce((s, i2) => s + i2.useQty, 0), unit: "Nos", referenceId: a.assemblyId, status: a.status, process: a.processNames.join(" + ") });
  });

  PRODUCTION_OPERATION_STAGES.filter((s) => s.completionDate).forEach((s) => {
    push(s.completionDate, "Production Process Completed", "Production Operation", s.qcStatus === "Not Required" ? "Next Process" : "QC", { project: s.project, assembly: s.assemblyId, material: "—", quantity: s.completedQty, unit: "Nos", referenceId: `${s.assemblyId}/${s.processId}`, status: s.processStatus, process: s.process });
  });

  DISPATCH_ASSEMBLIES.forEach((a) => {
    a.dispatches.forEach((d) => {
      push(d.date, "Dispatched", "Production Operation (Completed)", d.location, { project: a.project, assembly: a.assemblyId, material: a.description, quantity: d.qty, unit: "Nos", referenceId: d.dispatchId, status: "Dispatched" });
    });
  });

  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
};
const MOVEMENT_HISTORY = buildMovementHistory();

/* ----------------------------------------------------------------------
   MATERIAL MOVEMENT — GROUPED SUMMARY
   ---------------------------------------------------------------------- */

function firstRealValue(events, field) {
  for (const e of events) {
    if (e[field] && e[field] !== "—") return e[field];
  }
  return "—";
}

function buildMovementGroups(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key =
      r.po && r.po !== "—"
        ? `PO::${r.po}::${r.project}::${r.material}`
        : r.assembly && r.assembly !== "—"
          ? `ASM::${r.assembly}::${r.project}`
          : `REF::${r.referenceId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });

  return Array.from(map.entries())
    .map(([groupKey, groupEvents]) => {
      const events = groupEvents.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const latest = events[events.length - 1];
      const pieceNumbers = Array.from(new Set(events.map((e) => e.pieceNumber).filter((p) => p && p !== "—")));
      return {
        groupKey,
        project: firstRealValue(events, "project"),
        poNumber: firstRealValue(events, "po"),
        poDescription: firstRealValue(events, "poDescription"),
        dwg: firstRealValue(events, "dwg"),
        assembly: firstRealValue(events, "assembly"),
        material: firstRealValue(events, "material"),
        thickness: firstRealValue(events, "thickness"),
        size: firstRealValue(events, "size"),
        unit: latest.unit && latest.unit !== "—" ? latest.unit : firstRealValue(events, "unit"),
        process: firstRealValue(events, "process"),
        pieceLabel: pieceNumbers.length ? pieceNumbers.join(", ") : "—",
        qtyLabel: `${fmt(latest.quantity)}${latest.unit && latest.unit !== "—" ? ` ${latest.unit}` : ""}`,
        currentStage: latest.movementType,
        currentStatus: latest.status,
        currentLocation: latest.destination,
        lastMovementDate: latest.date,
        eventCount: events.length,
        events,
      };
    })
    .sort((a, b) => (a.lastMovementDate < b.lastMovementDate ? 1 : a.lastMovementDate > b.lastMovementDate ? -1 : 0));
}
const MOVEMENT_GROUPS = buildMovementGroups(MOVEMENT_HISTORY);

/* ============================================================================
   STATUS BADGE TONES
   ============================================================================ */

const STATUS_TONE = {
  Integrated: "success", "Not Integrated": "neutral", "Dummy PO": "amber",
  Accepted: "success", Pending: "warning", Rejected: "danger",
  "Fully Received": "success", "Partially Received": "warning", "Not Received": "neutral",
  Available: "success", Remaining: "warning", "Cutting Remaining": "info", "Job Remaining": "warning",
  Yes: "warning", No: "neutral",
  "In-House": "info", Outsourcing: "amber", Issued: "success",
  "In Production": "info", Completed: "success",
  "Rework Pending": "danger", "Rework Required": "danger", "Rework In Progress": "warning",
  "Partially Completed": "warning", "QC Pending": "warning",
  "Ready for Next Process": "info", "Ready For Next Process": "info", "Available in Material Stock": "success",
  "Ready for Dispatch": "info", "Partially Dispatched": "warning", Dispatched: "success", "Not Ready": "neutral",
  "In Progress": "info", Planned: "neutral", "Waiting For Previous Process": "neutral",
};
function Badge({ value }) {
  if (!value || value === "—") return <span>—</span>;
  const tone = STATUS_TONE[value] || "neutral";
  return <span className={`rpt-badge rpt-badge-${tone}`}>{value}</span>;
}

/* ============================================================================
   GENERIC HELPERS SHARED BY EVERY REPORT
   ============================================================================ */

function uniqueOptions(rows, getValue) {
  return Array.from(new Set(rows.map(getValue).filter((v) => v !== null && v !== undefined && v !== ""))).sort();
}

const MH_FIELD_GETTERS = {
  project: (g) => g.project,
  poNumber: (g) => g.poNumber,
  poDescription: (g) => g.poDescription,
  dwg: (g) => g.dwg,
  material: (g) => g.material,
  thickness: (g) => g.thickness,
  size: (g) => g.size,
  unit: (g) => g.unit,
  location: (g) => g.currentLocation,
  status: (g) => g.currentStatus,
  process: (g) => g.process,
};

function movementGroupMatches(g, filters, search) {
  for (const key of Object.keys(MH_FIELD_GETTERS)) {
    const val = filters[key];
    if (!val) continue;
    if (MH_FIELD_GETTERS[key](g) !== val) return false;
  }
  if (filters.movementType && !g.events.some((e) => e.movementType === filters.movementType)) return false;
  if (!inDateRange(g.lastMovementDate, filters.dateFrom, filters.dateTo)) return false;
  if (search && search.trim()) {
    const blob = [
      g.project, g.poNumber, g.poDescription, g.dwg, g.material, g.pieceLabel,
      g.currentStatus, g.currentLocation, g.process,
      ...g.events.flatMap((e) => [e.source, e.destination, e.status, e.movementType, e.pieceNumber, e.referenceId]),
    ].join(" ");
    if (!matchesText(blob, search)) return false;
  }
  return true;
}

function movementFacetOptions(groups, filters, search, excludeKey) {
  const partialFilters = { ...filters, [excludeKey]: "" };
  const subset = groups.filter((g) => movementGroupMatches(g, partialFilters, search));
  const getValue = excludeKey === "movementType" ? null : MH_FIELD_GETTERS[excludeKey];
  if (excludeKey === "movementType") {
    return Array.from(new Set(subset.flatMap((g) => g.events.map((e) => e.movementType)))).sort();
  }
  return uniqueOptions(subset, getValue);
}

function toCSV(columns, rows) {
  const escape = (v) => {
    const s = fmt(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(c.render ? c.render(r) : r[c.key])).join(","));
  return [header, ...lines].join("\n");
}

function toHTMLTable(columns, rows, title) {
  const head = columns.map((c) => `<th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">${c.label}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td style="border:1px solid #ccc;padding:6px;">${fmt(c.render ? c.render(r) : r[c.key])}</td>`).join("")}</tr>`)
    .join("");
  return `<html><head><meta charset="utf-8"><title>${title}</title></head><body><h2 style="font-family:sans-serif;">${title}</h2><table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;width:100%;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV(columns, rows, title) {
  downloadBlob(toCSV(columns, rows), `${title.replace(/\s+/g, "_")}.csv`, "text/csv");
}
function exportExcel(columns, rows, title) {
  downloadBlob(toHTMLTable(columns, rows, title), `${title.replace(/\s+/g, "_")}.xls`, "application/vnd.ms-excel");
}
function exportPDFOrPrint(columns, rows, title) {
  const html = toHTMLTable(columns, rows, title);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

/* ============================================================================
   REPORT_CONFIGS
   ============================================================================ */

const REPORT_CONFIGS = {
  poIntegration: {
    label: "PO / PO Integration",
    dateField: "integrationDate",
    rowKey: (r) => r.id,
    data: PO_ITEMS.map((p) => ({ ...p, balanceQty: p.poQty - p.received, integrationQty: p.integrationStatus === "Integrated" ? p.received : 0 })),
    columns: [
      { key: "poType", label: "PO Type" },
      { key: "poNumber", label: "PO Number" },
      { key: "supplier", label: "Supplier" },
      { key: "description", label: "PO Description" },
      { key: "material", label: "Material" },
      { key: "project", label: "Project" },
      { key: "dwgNumber", label: "DWG" },
      { key: "unit", label: "Unit" },
      { key: "poQty", label: "PO Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "integrationStatus", label: "Integration Status", badge: true },
    ],
    searchFields: ["poNumber", "description", "material", "materialCode", "project", "dwgNumber"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "poNumber", label: "PO Number", type: "text" },
      { key: "material", label: "Material", type: "select" },
      { key: "thickness", label: "Thickness", type: "select" },
      { key: "size", label: "Size", type: "select" },
      { key: "unit", label: "Unit", type: "select" },
      { key: "integrationStatus", label: "Status", type: "select" },
      { key: "poType", label: "PO Type", type: "select" },
    ],
    detailSections: (r) => [
      { title: "PO Item", fields: [["PO Type", r.poType], ["PO Number", r.poNumber], ["Supplier", r.supplier], ["PO Description", r.description], ["Material", r.material], ["Material Code", r.materialCode], ["Material Specification", r.materialSpec], ["Unit", r.unit], ["PO Quantity", r.poQty], ["Received Quantity", r.received], ["Balance Quantity", r.balanceQty]] },
      { title: "Integration", fields: [["Project", r.project], ["DWG", r.dwgNumber], ["DWG Description", r.dwgDescription], ["Integration Status", r.integrationStatus], ["Integration Quantity", r.integrationQty], ["Integration Date", fmtDate(r.integrationDate)]] },
    ],
  },

  grn: {
    label: "GRN / Received Material",
    dateField: "grnDate",
    rowKey: (r) => r.id,
    data: GRN_HISTORY.map((g) => {
      const item = poItemById(g.itemId) || {};
      return { ...g, poType: item.poType, materialCode: item.materialCode, materialSpec: item.materialSpec, thickness: item.thickness, size: item.size, unit: item.unit, poQty: item.poQty, balanceQty: (item.poQty ?? 0) - (item.received ?? 0), grnStatus: item.received >= item.poQty ? "Fully Received" : item.received > 0 ? "Partially Received" : "Not Received" };
    }),
    columns: [
      { key: "poType", label: "PO Type" },
      { key: "poNumber", label: "PO Number" },
      { key: "description", label: "PO Description" },
      { key: "material", label: "Material" },
      { key: "thickness", label: "Thickness" },
      { key: "size", label: "Size" },
      { key: "receivedQty", label: "Received Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "inspectionStatus", label: "Inspection", badge: true },
      { key: "grnStatus", label: "GRN Status", badge: true },
    ],
    searchFields: ["poNumber", "description", "material", "materialCode", "grnNumber"],
    filterFields: [
      { key: "material", label: "Material", type: "select" },
      { key: "thickness", label: "Thickness", type: "select" },
      { key: "size", label: "Size", type: "select" },
      { key: "poType", label: "PO Type", type: "select" },
      { key: "inspectionStatus", label: "Inspection Status", type: "select" },
      { key: "grnStatus", label: "GRN Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "GRN Entry", fields: [["GRN Number", r.grnNumber], ["GRN Date", fmtDate(r.grnDate)], ["PO Type", r.poType], ["PO Number", r.poNumber], ["PO Description", r.description], ["Material", r.material], ["Material Spec", r.materialSpec], ["Thickness", r.thickness], ["Size", r.size]] },
      { title: "Receiving", fields: [["Received Quantity", r.receivedQty], ["Balance Quantity", r.balanceQty], ["Receiving Unit", r.receivingUnit], ["Inspection Status", r.inspectionStatus], ["Inspected By", r.inspectedBy], ["Received By", r.receivedBy], ["Remarks", r.remarks]] },
    ],
  },

  materialStock: {
    label: "Material Stock",
    dateField: null,
    rowKey: (r) => r.id,
    data: MATERIAL_STOCK,
    columns: [
      { key: "material", label: "Material" },
      { key: "materialCode", label: "Material Code" },
      { key: "thickness", label: "Thickness" },
      { key: "size", label: "Size" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "plateNumber", label: "Piece Number" },
      { key: "availableQuantity", label: "Quantity" },
      { key: "uom", label: "Unit" },
      { key: "sourceType", label: "Source" },
      { key: "stockStatus", label: "Stock Status", badge: true },
    ],
    searchFields: ["material", "materialCode", "poNumber", "description", "plateNumber", "thickness", "size", "project"],
    filterFields: [
      { key: "unit", label: "Facility Unit", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "thickness", label: "Thickness", type: "select" },
      { key: "size", label: "Size", type: "select" },
      { key: "sourceType", label: "Source", type: "select" },
      { key: "stockStatus", label: "Stock Status", type: "select" },
      { key: "reworkRequired", label: "Rework Required", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Material", fields: [["Stock ID", r.stockId], ["Material", r.material], ["Material Code", r.materialCode], ["Material Spec", r.materialSpec], ["Thickness", r.thickness], ["Size", r.size], ["Piece Number", r.plateNumber]] },
      { title: "Origin", fields: [["PO Number", r.poNumber], ["PO Description", r.description], ["Project", r.project], ["DWG Description", r.dwgDescription], ["Revision", r.revision], ["Source", r.sourceType]] },
      { title: "Stock", fields: [["Facility Unit", r.unit], ["Original Quantity", r.originalQuantity], ["Available Quantity", r.availableQuantity], ["Unit", r.uom], ["Stock Status", r.stockStatus], ["Rework Required", r.reworkRequired]] },
    ],
  },

  issueToJobWork: {
    label: "Issue To Job Work",
    dateField: "date",
    rowKey: (r) => r.id,
    data: ISSUE_TO_JOBWORK,
    columns: [
      { key: "id", label: "Issue ID" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "material", label: "Material" },
      { key: "process", label: "Process" },
      { key: "jobWorkType", label: "Job Work Type", badge: true },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "Unit" },
      { key: "date", label: "Issue Date", render: (r) => fmtDate(r.date) },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: ["id", "poNumber", "description", "project", "dwg", "material", "process"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "jobWorkType", label: "Job Work Type", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Issue", fields: [["Issue ID", r.id], ["PO Number", r.poNumber], ["PO Description", r.description], ["Project", r.project], ["DWG", r.dwg], ["Material", r.material]] },
      { title: "Job Work", fields: [["Job Work Type", r.jobWorkType], ["Job Work Unit", r.unit], ["Vendor", r.vendor], ["Process", r.process], ["Process ID", r.processId], ["Issued Quantity", `${r.quantity} ${r.uom}`], ["Issue Date", fmtDate(r.date)], ["Issued By", r.issuedBy], ["Status", r.status]] },
    ],
  },

  receiveFromJobWork: {
    label: "Receive From Job Work",
    dateField: "issueDate",
    rowKey: (r) => r.id,
    data: RECEIVE_FROM_JOBWORK.map((j) => ({ ...j, status: rfjwStatus(j), remainingQty: j.issuedQty - j.previouslyReceived })),
    columns: [
      { key: "id", label: "Job ID" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "material", label: "Material" },
      { key: "process", label: "Process" },
      { key: "issuedQty", label: "Issued Qty" },
      { key: "outputQty", label: "Received Qty" },
      { key: "remainingQty", label: "Remaining Qty" },
      { key: "reworkPending", label: "Rework", render: (r) => (r.reworkPending ? "Yes" : "No") },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: ["id", "poNumber", "poDescription", "project", "dwg", "material", "process"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "jobWorkType", label: "Job Work Type", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Source", fields: [["Job ID", r.id], ["PO Type", r.poType], ["PO Number", r.poNumber], ["Supplier", r.supplier], ["PO Description", r.poDescription], ["Project", r.project], ["DWG", r.dwg], ["DWG Description", r.dwgDescription], ["Revision", r.revision]] },
      { title: "Material", fields: [["Material", r.material], ["Material Code", r.materialCode], ["Material Spec", r.materialSpec], ["Thickness", r.thickness], ["Size", r.size]] },
      { title: "Job Work", fields: [["Job Work Type", r.jobWorkType], ["Process", r.process], ["Process ID", r.processId], ["Original Issued Qty", r.issuedQty], ["Previously Received Qty", r.previouslyReceived], ["Received (Output) Qty", r.outputQty], ["Remaining Qty", r.remainingQty], ["Rework Pending", r.reworkPending ? "Yes" : "No"], ["Status", r.status]] },
    ],
  },

  cutting: {
    label: "Cutting / Finished Pieces",
    dateField: null,
    rowKey: (r) => r.rowKey,
    data: [
      ...CUTTING_OUTPUT_PIECES.map((p) => ({ rowKey: `out-${p.pieceNo}`, rowType: "Finished Output", id: CUTTING_JOB.id, poNumber: CUTTING_JOB.poNumber, project: CUTTING_JOB.project, material: CUTTING_JOB.material, materialCode: CUTTING_JOB.materialCode, thickness: CUTTING_JOB.thickness, originalSize: CUTTING_JOB.originalSize, pieceNo: p.pieceNo, size: p.size, length: p.length, width: p.width, quantity: p.qty, weight: p.weight, unit: CUTTING_JOB.unit, reworked: p.reworked, status: p.reworked === "Yes" ? "Rework Required" : "Available", date: CUTTING_JOB.date })),
      ...MATERIAL_STOCK.filter((s) => s.sourceType === "Cutting Remaining").map((s) => ({ rowKey: `rem-${s.id}`, rowType: "Remaining Balance", id: s.stockId, poNumber: s.poNumber, project: s.project, material: s.material, materialCode: s.materialCode, thickness: s.thickness, originalSize: s.size, pieceNo: s.plateNumber, size: s.size, length: null, width: null, quantity: s.availableQuantity, weight: null, unit: s.uom, reworked: s.reworkRequired, status: s.stockStatus, date: null })),
    ],
    columns: [
      { key: "rowType", label: "Type" },
      { key: "id", label: "Cutting / Stock ID" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "material", label: "Material" },
      { key: "pieceNo", label: "Piece Number" },
      { key: "size", label: "Size" },
      { key: "quantity", label: "Quantity" },
      { key: "reworked", label: "Reworked" },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: ["id", "poNumber", "project", "material", "materialCode", "pieceNo"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "thickness", label: "Thickness", type: "select" },
      { key: "rowType", label: "Type", type: "select" },
      { key: "reworked", label: "Reworked", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Piece", fields: [["Type", r.rowType], ["Piece Number", r.pieceNo], ["Material", r.material], ["Material Code", r.materialCode], ["Thickness", r.thickness], ["Original Size", r.originalSize], ["Cut Size", r.size], ["Quantity", `${r.quantity} ${r.unit}`], ["Weight", r.weight ?? "—"]] },
      { title: "Origin", fields: [["Cutting / Stock ID", r.id], ["PO Number", r.poNumber], ["Project", r.project], ["Reworked", r.reworked], ["Status", r.status], ["Date", fmtDate(r.date)]] },
    ],
  },

  issueToProduction: {
    label: "Issue To Production",
    dateField: "issueDate",
    rowKey: (r) => r.issueId,
    data: ISSUE_TO_PRODUCTION,
    columns: [
      { key: "issueId", label: "Issue ID" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "dwg", label: "DWG" },
      { key: "material", label: "Material" },
      { key: "issuedNow", label: "Issued Qty" },
      { key: "remainingAvailableQty", label: "Available Qty" },
      { key: "issueDate", label: "Issue Date", render: (r) => fmtDate(r.issueDate) },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: ["issueId", "poNumber", "poDescription", "project", "dwg", "material", "materialCode"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "dwg", label: "DWG", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "jobWorkType", label: "Job Work Type", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Source", fields: [["Issue ID", r.issueId], ["Job Work ID", r.jobWorkId], ["PO Type", r.poType], ["PO Number", r.poNumber], ["Supplier", r.supplier], ["PO Description", r.poDescription], ["Project", r.project], ["DWG", r.dwg], ["DWG Description", r.dwgDescription], ["Revision", r.revision]] },
      { title: "Material", fields: [["Material", r.material], ["Material Code", r.materialCode], ["Material Spec", r.materialSpec], ["Thickness", r.thickness], ["Size", r.size], ["Unit", r.unit]] },
      { title: "Issue", fields: [["Issued Quantity", r.issuedNow], ["Previously Issued Qty", r.previouslyIssuedQty], ["Available Quantity", r.remainingAvailableQty], ["Issue Date", fmtDate(r.issueDate)], ["Issued By", r.issuedBy], ["Status", r.status]], note: "Production routes are defined in Assembly Integration, not here — this record only shows material being issued." },
    ],
  },

  assemblyIntegration: {
    label: "Production Assembly Integration",
    dateField: "createdDate",
    rowKey: (r) => r.assemblyId,
    data: ASSEMBLY_INTEGRATIONS.map((a) => {
      const matInputs = a.inputs.filter((i) => i.sourceType === "material").map((i) => ASSEMBLY_INPUT_MATERIALS[i.sourceId]);
      const asmInputs = a.inputs.filter((i) => i.sourceType === "assembly");
      return {
        ...a,
        dwgText: [...new Set(matInputs.map((m) => m?.dwg).filter(Boolean))].join(" + ") || "—",
        materialText: matInputs.length ? matInputs.map((m) => m?.material).join(" + ") : asmInputs.map((i) => `${i.sourceId} (assembly)`).join(" + "),
        poText: [...new Set(matInputs.map((m) => m?.poNumber).filter(Boolean))].join(", ") || "—",
        inputQty: a.inputs.reduce((s, i) => s + i.useQty, 0),
      };
    }),
    columns: [
      { key: "assemblyId", label: "Assembly ID" },
      { key: "project", label: "Project" },
      { key: "dwgText", label: "DWG(s)" },
      { key: "materialText", label: "Material(s)" },
      { key: "poText", label: "Source PO(s)" },
      { key: "inputQty", label: "Input Qty" },
      { key: "createdDate", label: "Integration Date", render: (r) => fmtDate(r.createdDate) },
      { key: "status", label: "Assembly Status", badge: true },
    ],
    searchFields: ["assemblyId", "project", "dwgText", "materialText", "poText"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Assembly", fields: [["Assembly ID", r.assemblyId], ["Project", r.project], ["DWG(s)", r.dwgText], ["Status", r.status], ["Integration Date", fmtDate(r.createdDate)]] },
      {
        title: "Inputs Consumed",
        rows: r.inputs.map((i) => {
          if (i.sourceType === "material") {
            const m = ASSEMBLY_INPUT_MATERIALS[i.sourceId] || {};
            return { label: `${m.material || i.sourceId} (${m.materialCode || i.sourceId})`, value: `${i.useQty} Nos — PO ${m.poNumber || "—"}, DWG ${m.dwg || "—"}` };
          }
          return { label: `${i.sourceId} (prior assembly)`, value: `${i.useQty} Nos` };
        }),
      },
    ],
  },

  productionOperation: {
    label: "Production Operation",
    dateField: "startDate",
    rowKey: (r) => `${r.assemblyId}/${r.processId}`,
    data: PRODUCTION_OPERATION_STAGES.map((s) => ({ ...s, dwg: ASSEMBLY_DWG[s.assemblyId] || "—" })),
    columns: [
      { key: "assemblyId", label: "Assembly ID" },
      { key: "project", label: "Project" },
      { key: "process", label: "Process" },
      { key: "sequence", label: "Seq" },
      { key: "totalQty", label: "Total Qty" },
      { key: "completedQty", label: "Completed Qty" },
      { key: "pendingQty", label: "Pending Qty" },
      { key: "reworkQty", label: "Rework Qty" },
      { key: "qcStatus", label: "QC Status", badge: true },
      { key: "processStatus", label: "Process Status", badge: true },
    ],
    searchFields: ["assemblyId", "project", "process", "processId", "dwg"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "dwg", label: "DWG", type: "select" },
      { key: "assemblyId", label: "Assembly", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "qcStatus", label: "QC Status", type: "select" },
      { key: "processStatus", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Process", fields: [["Assembly", r.assemblyId], ["Project", r.project], ["DWG(s)", r.dwg], ["Process", r.process], ["Process ID", r.processId], ["Sequence", r.sequence], ["Total Qty", r.totalQty], ["Available Qty", r.availableQty], ["Completed Qty", r.completedQty], ["Pending Qty", r.pendingQty], ["Rework Qty", r.reworkQty], ["Status", r.processStatus]] },
      { title: "Execution", fields: [["Performed By", fmt(r.performedBy)], ["Supervisor", fmt(r.supervisor)], ["Start Date", fmtDate(r.startDate)], ["Completion Date", fmtDate(r.completionDate)]] },
      { title: "QC", fields: [["QC Status", r.qcStatus], ["QC Verified By", fmt(r.qcVerifiedBy)], ["QC Date", fmtDate(r.qcDate)], ["Accepted Qty", r.acceptedQty], ["Rejected Qty", r.rejectedQty]] },
    ],
  },

  rework: {
    label: "Rework",
    dateField: "startDate",
    rowKey: (r) => r.reworkId,
    data: REWORK_ITEMS.map((r) => ({ ...r, balanceQty: reworkBalance(r) })),
    columns: [
      { key: "reworkId", label: "Rework ID" },
      { key: "source", label: "Source", badge: true },
      { key: "project", label: "Project" },
      { key: "assembly", label: "Assembly / PO", render: (r) => (r.assembly !== "—" ? r.assembly : r.poNumber) },
      { key: "material", label: "Material" },
      { key: "process", label: "Process" },
      { key: "requiredQty", label: "Required Qty" },
      { key: "completedQty", label: "Completed Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: ["reworkId", "project", "dwg", "poNumber", "assembly", "material", "pieceNo"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "dwg", label: "DWG", type: "select" },
      { key: "assembly", label: "Assembly", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "source", label: "Rework Source", type: "select" },
      { key: "status", label: "Rework Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Rework Item", fields: [["Rework ID", r.reworkId], ["Source", r.source], ["Project", r.project], ["DWG", r.dwg], ["PO Number", r.poNumber], ["PO Description", r.poDescription], ["Assembly", r.assembly], ["Material", r.material], ["Piece Number", r.pieceNo], ["Process", r.process]] },
      { title: "Quantity", fields: [["Required Qty", r.requiredQty], ["Completed Qty", r.completedQty], ["Balance Qty", r.balanceQty], ["Status", r.status]] },
      { title: "History", fields: [["Rework Done By", fmt(r.reworkDoneBy)], ["Supervisor", fmt(r.supervisor)], ["Start Date", fmtDate(r.startDate)], ["Start Time", fmt(r.startTime)], ["Completion Date", fmtDate(r.completionDate)], ["Completion Time", fmt(r.completionTime)], ["Remarks", fmt(r.remarks)]] },
    ],
  },

  dispatch: {
    label: "Dispatch",
    dateField: "date",
    rowKey: (r) => r.rowKey,
    data: [
      ...DISPATCH_ASSEMBLIES.flatMap((a) => {
        const built = buildDispatchAssemblyRow(a);
        return a.dispatches.map((d) => ({ rowKey: d.dispatchId, dispatchId: d.dispatchId, assemblyId: a.assemblyId, project: a.project, dwgText: built.dwgText, revision: a.revision, description: a.description, plannedQty: a.plannedQty, productionStartDate: a.productionStartDate, productionEndDate: a.productionEndDate, duration: built.duration, date: d.date, time: d.time, dispatchTo: d.dispatchTo, location: d.location, vehicleNumber: d.vehicleNumber, transporter: d.transporter, driverName: d.driverName, driverContact: d.driverContact, dispatchQty: d.qty, dispatchedQty: built.dispatchedQty, balanceQty: built.balanceQty, dispatchStatus: built.dispatchStatus, remarks: d.remarks, dateDiff: dispatchDiffLabel(d.date, a.productionEndDate) }));
      }),
      ...DISPATCH_ASSEMBLIES.filter((a) => a.dispatches.length === 0).map((a) => {
        const built = buildDispatchAssemblyRow(a);
        return { rowKey: `pending-${a.assemblyId}`, dispatchId: "—", assemblyId: a.assemblyId, project: a.project, dwgText: built.dwgText, revision: a.revision, description: a.description, plannedQty: a.plannedQty, productionStartDate: a.productionStartDate, productionEndDate: a.productionEndDate, duration: built.duration, date: null, time: null, dispatchTo: "—", location: "—", vehicleNumber: "—", transporter: "—", driverName: "—", driverContact: "—", dispatchQty: 0, dispatchedQty: 0, balanceQty: built.balanceQty, dispatchStatus: built.dispatchStatus, remarks: isReadyForDispatch(a) ? "Awaiting first dispatch." : "Not yet eligible — production incomplete or quantity in rework.", dateDiff: "—" };
      }),
    ],
    columns: [
      { key: "dispatchId", label: "Dispatch ID" },
      { key: "assemblyId", label: "Assembly ID" },
      { key: "project", label: "Project" },
      { key: "plannedQty", label: "Finished Qty" },
      { key: "productionEndDate", label: "Prod. End", render: (r) => fmtDate(r.productionEndDate) },
      { key: "date", label: "Dispatch Date", render: (r) => fmtDate(r.date) },
      { key: "dispatchQty", label: "Dispatch Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "dispatchStatus", label: "Status", badge: true },
    ],
    searchFields: ["dispatchId", "assemblyId", "project", "dwgText", "location"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "assemblyId", label: "Assembly", type: "select" },
      { key: "dwgText", label: "DWG", type: "select" },
      { key: "dispatchStatus", label: "Dispatch Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Assembly", fields: [["Assembly ID", r.assemblyId], ["Project", r.project], ["DWG(s)", r.dwgText], ["Revision", r.revision], ["Description", r.description], ["Finished Quantity", r.plannedQty]] },
      { title: "Production", fields: [["Production Start", fmtDate(r.productionStartDate)], ["Production End", fmtDate(r.productionEndDate)], ["Production Duration", r.duration]] },
      { title: "Dispatch", fields: [["Dispatch ID", r.dispatchId], ["Dispatch Date", fmtDate(r.date)], ["Dispatch Time", fmt(r.time)], ["Dispatch To", r.dispatchTo], ["Destination", r.location], ["Vehicle Number", r.vehicleNumber], ["Transporter", r.transporter], ["Driver Name", r.driverName], ["Driver Contact", r.driverContact], ["Dispatch Qty", r.dispatchQty], ["Dispatched (Cumulative)", r.dispatchedQty], ["Balance Qty", r.balanceQty], ["Dispatch Date Diff.", r.dateDiff], ["Status", r.dispatchStatus], ["Remarks", fmt(r.remarks)]] },
    ],
  },

  movementHistory: {
    label: "Material Movement History",
    dateField: "date",
    rowKey: (r) => r.movementId,
    data: MOVEMENT_HISTORY,
    columns: [
      { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
      { key: "movementType", label: "Movement Type" },
      { key: "source", label: "Source" },
      { key: "destination", label: "Destination" },
      { key: "po", label: "PO" },
      { key: "project", label: "Project" },
      { key: "assembly", label: "Assembly" },
      { key: "material", label: "Material" },
      { key: "quantity", label: "Quantity" },
      { key: "referenceId", label: "Reference ID" },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: ["po", "project", "dwg", "assembly", "material", "referenceId", "movementType"],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "movementType", label: "Movement Type", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      { title: "Movement", fields: [["Movement ID", r.movementId], ["Date", fmtDate(r.date)], ["Time", r.time], ["Movement Type", r.movementType], ["Source", r.source], ["Destination", r.destination]] },
      { title: "Reference", fields: [["PO", r.po], ["Project", r.project], ["DWG", r.dwg], ["Assembly", r.assembly], ["Material", r.material], ["Piece Number", r.pieceNumber], ["Quantity", `${r.quantity} ${r.unit}`], ["Reference ID", r.referenceId], ["Status", r.status]] },
    ],
  },
};

const REPORT_ORDER = [
  "poIntegration", "grn", "materialStock", "issueToJobWork", "receiveFromJobWork",
  "cutting", "issueToProduction", "assemblyIntegration", "productionOperation",
  "rework", "dispatch", "movementHistory",
];

/* ============================================================================
   KPI CARDS
   ============================================================================ */

function computeKpis() {
  const integratedPO = PO_ITEMS.filter((p) => p.integrationStatus === "Integrated").length;
  const totalReceived = GRN_HISTORY.reduce((s, g) => s + g.receivedQty, 0);
  const availableStock = MATERIAL_STOCK.reduce((s, m) => s + m.availableQuantity, 0);
  const jobWorkPending = RECEIVE_FROM_JOBWORK.filter((j) => rfjwStatus(j) !== "Fully Received").length;
  const jobWorkRework = REWORK_ITEMS.filter((r) => r.source === "Receive From Job Work" && r.status !== "Available in Material Stock").length;
  const productionInProgress = new Set(PRODUCTION_OPERATION_STAGES.filter((s) => s.processStatus === "In Progress").map((s) => s.assemblyId)).size;
  const qcPending = PRODUCTION_OPERATION_STAGES.filter((s) => s.qcStatus === "Pending" || s.qcStatus === "QC Pending").length;
  const productionRework = REWORK_ITEMS.filter((r) => r.source === "Production Operation" && r.status !== "Ready for Next Process" && r.status !== "Available in Material Stock").length;
  const dispatchRows = DISPATCH_ASSEMBLIES.map(buildDispatchAssemblyRow);
  const completedAssemblies = dispatchRows.filter((a) => isReadyForDispatch(a)).length;
  const readyForDispatch = dispatchRows.filter((a) => a.dispatchStatus === "Ready for Dispatch").length;
  const dispatched = dispatchRows.filter((a) => a.dispatchStatus === "Dispatched" || a.dispatchStatus === "Partially Dispatched").length;

  return [
    { label: "Total PO", value: new Set(PO_ITEMS.map((p) => p.poNumber)).size, cls: "rpt-po-card" },
    { label: "Integrated PO Items", value: integratedPO, cls: "rpt-stock-card" },
    { label: "Total Received (GRN)", value: totalReceived, cls: "rpt-finished-card" },
    { label: "Available Stock", value: availableStock, cls: "rpt-balance-card" },
    { label: "Job Work Pending", value: jobWorkPending, cls: "rpt-production-card" },
    { label: "Job Work Rework", value: jobWorkRework, cls: "rpt-rework-card" },
    { label: "Production In Progress", value: productionInProgress, cls: "rpt-production-card" },
    { label: "QC Pending", value: qcPending, cls: "rpt-scrap-card" },
    { label: "Production Rework", value: productionRework, cls: "rpt-rejection-card" },
    { label: "Completed Assemblies", value: completedAssemblies, cls: "rpt-finished-card" },
    { label: "Ready For Dispatch", value: readyForDispatch, cls: "rpt-stock-card" },
    { label: "Dispatched", value: dispatched, cls: "rpt-po-card" },
  ];
}

/* ============================================================================
   UI PIECES
   ============================================================================ */

function ReadonlyField({ label, value }) {
  return (
    <div className="rpt-eye-field">
      <span className="rpt-eye-label">{label}</span>
      <span className="rpt-eye-value">{fmt(value)}</span>
    </div>
  );
}

function EyeModal({ report, row, onClose }) {
  if (!row) return null;
  const sections = report.detailSections(row);
  return (
    <div className="rpt-modal-overlay" onClick={onClose}>
      <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rpt-modal-header">
          <h3>{report.label} — Details</h3>
          <button className="rpt-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="rpt-modal-body">
          {sections.map((sec, i) => (
            <div key={i} className="rpt-eye-section">
              <h4>{sec.title}</h4>
              {sec.fields && (
                <div className="rpt-eye-grid">
                  {sec.fields.map(([label, value], j) => (
                    <ReadonlyField key={j} label={label} value={value} />
                  ))}
                </div>
              )}
              {sec.rows && (
                <ul className="rpt-eye-list">
                  {sec.rows.map((r, j) => (
                    <li key={j}>
                      <strong>{r.label}</strong>
                      <span>{r.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sec.note && <p className="rpt-eye-note">{sec.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   MATERIAL MOVEMENT HISTORY — dedicated section
   ============================================================================ */

const MH_FILTER_SECTIONS = [
  { title: "Project / PO", fields: [
    { key: "project", label: "Project" },
    { key: "poNumber", label: "PO Number" },
    { key: "poDescription", label: "PO Description" },
  ] },
  { title: "Material", fields: [
    { key: "dwg", label: "DWG" },
    { key: "material", label: "Material" },
    { key: "thickness", label: "Thickness" },
    { key: "size", label: "Size" },
    { key: "unit", label: "Unit" },
  ] },
  { title: "Status / Movement", fields: [
    { key: "movementType", label: "Movement / Source" },
    { key: "status", label: "Status" },
    { key: "location", label: "Current Location" },
    { key: "process", label: "Process" },
  ] },
];

const MH_FILTER_LABELS = {
  project: "Project", poNumber: "PO", poDescription: "PO Description", dwg: "DWG",
  material: "Material", thickness: "Thickness", size: "Size", unit: "Unit",
  movementType: "Movement", status: "Status", location: "Location", process: "Process",
};

const MH_EMPTY_FILTERS = { project: "", poNumber: "", poDescription: "", dwg: "", material: "", thickness: "", size: "", unit: "", movementType: "", status: "", location: "", process: "" };

const MH_SUMMARY_COLUMNS = [
  { key: "project", label: "Project" },
  { key: "poNumber", label: "PO Number" },
  { key: "poDescription", label: "PO Description" },
  { key: "material", label: "Material" },
  { key: "dwg", label: "DWG" },
  { key: "pieceLabel", label: "Piece / Qty", render: (r) => (r.pieceLabel !== "—" ? `${r.pieceLabel} · ${r.qtyLabel}` : r.qtyLabel) },
  { key: "currentStage", label: "Current Stage" },
  { key: "currentStatus", label: "Current Status" },
  { key: "currentLocation", label: "Current Location" },
  { key: "lastMovementDate", label: "Last Movement", render: (r) => fmtDate(r.lastMovementDate) },
];

function MovementHistorySection({ groups }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(MH_EMPTY_FILTERS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [eyeGroup, setEyeGroup] = useState(null);

  const activeFilters = useMemo(() => ({ ...filters, dateFrom, dateTo }), [filters, dateFrom, dateTo]);

  const filteredGroups = useMemo(
    () => groups.filter((g) => movementGroupMatches(g, activeFilters, search)),
    [groups, activeFilters, search],
  );

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilters(MH_EMPTY_FILTERS);
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const setFilter = (key, value) => setFilters((v) => ({ ...v, [key]: value }));

  const optionsFor = (key) => movementFacetOptions(groups, activeFilters, search, key);

  const summaryChips = MH_FILTER_SECTIONS.flatMap((s) => s.fields)
    .filter((f) => filters[f.key])
    .map((f) => `${MH_FILTER_LABELS[f.key]}: ${filters[f.key]}`);
  if (dateFrom) summaryChips.push(`From: ${fmtDate(dateFrom)}`);
  if (dateTo) summaryChips.push(`To: ${fmtDate(dateTo)}`);

  const handleExport = (type) => {
    const title = "Material Movement History";
    if (type === "csv") exportCSV(MH_SUMMARY_COLUMNS, filteredGroups, title);
    else if (type === "excel") exportExcel(MH_SUMMARY_COLUMNS, filteredGroups, title);
    else exportPDFOrPrint(MH_SUMMARY_COLUMNS, filteredGroups, title);
  };

  return (
    <>
      <div className="rpt-filter-panel">
        <input
          className="rpt-filter-input rpt-filter-search"
          placeholder="Search material movement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="rpt-filter-toggle-btn" onClick={() => setShowFilters((v) => !v)}>
          Filters {activeFilterCount > 0 && <span className="rpt-filter-count-badge">{activeFilterCount}</span>}
        </button>
        <button onClick={clearFilters} className="rpt-filter-clear-btn">
          Clear Filters
        </button>
        <div className="rpt-filter-count">
          {filteredGroups.length} of {groups.length} items
        </div>
      </div>

      {showFilters && (
        <div className="rpt-mh-filter-panel">
          {MH_FILTER_SECTIONS.map((section) => (
            <div className="rpt-mh-filter-group" key={section.title}>
              <div className="rpt-mh-filter-group-title">{section.title}</div>
              <div className="rpt-mh-filter-group-fields">
                {section.fields.map((f) => (
                  <select
                    key={f.key}
                    className="rpt-filter-select"
                    value={filters[f.key]}
                    onChange={(e) => setFilter(f.key, e.target.value)}
                  >
                    <option value="">All {f.label}</option>
                    {optionsFor(f.key).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          ))}
          <div className="rpt-mh-filter-group">
            <div className="rpt-mh-filter-group-title">Date</div>
            <div className="rpt-mh-filter-group-fields">
              <label className="rpt-filter-date">
                <span>From</span>
                <input type="date" className="rpt-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="rpt-filter-date">
                <span>To</span>
                <input type="date" className="rpt-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </div>
          </div>
        </div>
      )}

      {summaryChips.length > 0 && (
        <div className="rpt-mh-summary-banner">
          <span className="rpt-mh-summary-label">Showing movement history for:</span>
          {summaryChips.map((chip) => (
            <span key={chip} className="rpt-mh-summary-chip">{chip}</span>
          ))}
          <span className="rpt-mh-summary-count">Records: {filteredGroups.length}</span>
        </div>
      )}

      <div className="rpt-export-bar">
        <button className="rpt-export-btn" onClick={() => handleExport("pdf")}>Export PDF</button>
        <button className="rpt-export-btn" onClick={() => handleExport("excel")}>Export Excel</button>
        <button className="rpt-export-btn" onClick={() => handleExport("csv")}>Export CSV</button>
        <button className="rpt-export-btn" onClick={() => handleExport("print")}>Print</button>
      </div>

      <div className="rpt-table-wrapper">
        <table className="rpt-table">
          <thead>
            <tr>
              {MH_SUMMARY_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>Eye</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length === 0 && (
              <tr>
                <td className="rpt-empty-cell" colSpan={MH_SUMMARY_COLUMNS.length + 1}>
                  <div className="rpt-empty-state">
                    No material movements found.
                    <br />
                    Try changing or clearing your filters.
                    <div className="rpt-mh-empty-clear">
                      <button className="rpt-filter-clear-btn" onClick={clearFilters}>Clear Filters</button>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {filteredGroups.map((g) => (
              <tr key={g.groupKey}>
                {MH_SUMMARY_COLUMNS.map((c) => (
                  <td key={c.key}>
                    {c.key === "currentStatus" ? (
                      <Badge value={g.currentStatus} />
                    ) : (
                      fmt(c.render ? c.render(g) : g[c.key])
                    )}
                  </td>
                ))}
                <td>
                  <button className="rpt-eye-btn" onClick={() => setEyeGroup(g)} aria-label="View full movement history">
                    👁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MovementTimelineModal group={eyeGroup} onClose={() => setEyeGroup(null)} />
    </>
  );
}

function MovementTimelineModal({ group, onClose }) {
  if (!group) return null;
  return (
    <div className="rpt-modal-overlay" onClick={onClose}>
      <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rpt-modal-header">
          <h3>Material Movement History</h3>
          <button className="rpt-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="rpt-modal-body">
          <div className="rpt-eye-section">
            <h4>Item</h4>
            <div className="rpt-eye-grid">
              <ReadonlyField label="Project" value={group.project} />
              <ReadonlyField label="PO" value={group.poNumber} />
              <ReadonlyField label="PO Description" value={group.poDescription} />
              <ReadonlyField label="Material" value={group.material} />
              <ReadonlyField label="DWG" value={group.dwg} />
              <ReadonlyField label="Thickness" value={group.thickness} />
              <ReadonlyField label="Size" value={group.size} />
              <ReadonlyField label="Piece Number(s)" value={group.pieceLabel} />
            </div>
          </div>

          <div className="rpt-eye-section">
            <h4>Movement History</h4>
            <ol className="rpt-mh-timeline">
              {group.events.map((e, idx) => (
                <li key={e.movementId} className="rpt-mh-timeline-step">
                  <div className="rpt-mh-timeline-marker">{String(idx + 1).padStart(2, "0")}</div>
                  <div className="rpt-mh-timeline-content">
                    <div className="rpt-mh-timeline-title">{e.movementType}</div>
                    <div className="rpt-eye-grid">
                      <ReadonlyField label="Date" value={fmtDate(e.date)} />
                      <ReadonlyField label="Quantity" value={`${fmt(e.quantity)} ${e.unit !== "—" ? e.unit : ""}`} />
                      <ReadonlyField label="Source" value={e.source} />
                      <ReadonlyField label="Destination" value={e.destination} />
                      {e.process !== "—" && <ReadonlyField label="Process" value={e.process} />}
                      <ReadonlyField label="Status" value={e.status} />
                      <ReadonlyField label="Reference" value={e.referenceId} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function Reports() {
  const navigate = useNavigate();
  const handleBack = () => navigate("/inventory/material");

  const [activeKey, setActiveKey] = useState(REPORT_ORDER[0]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [eyeRow, setEyeRow] = useState(null);

  const report = REPORT_CONFIGS[activeKey];
  const kpis = useMemo(() => computeKpis(), []);

  const switchReport = (key) => {
    setActiveKey(key);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilterValues({});
    setShowFilters(false);
    setEyeRow(null);
  };

  const filterOptions = useMemo(() => {
    const map = {};
    report.filterFields.forEach((f) => {
      if (f.type === "select") map[f.key] = uniqueOptions(report.data, (r) => r[f.key]);
    });
    return map;
  }, [report]);

  const filteredRows = useMemo(() => {
    return report.data.filter((row) => {
      for (const f of report.filterFields) {
        const val = filterValues[f.key];
        if (!val) continue;
        const rowVal = String(row[f.key] ?? "");
        if (f.type === "select") {
          if (rowVal !== val) return false;
        } else if (!matchesText(rowVal, val)) {
          return false;
        }
      }
      if (report.dateField && !inDateRange(row[report.dateField], dateFrom, dateTo)) return false;
      if (search.trim()) {
        const hit = report.searchFields.some((k) => matchesText(row[k], search));
        if (!hit) return false;
      }
      return true;
    });
  }, [report, filterValues, dateFrom, dateTo, search]);

  const activeFilterCount = Object.values(filterValues).filter(Boolean).length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const clearFilters = () => {
    setFilterValues({});
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const handleExport = (type) => {
    const title = report.label;
    if (type === "csv") exportCSV(report.columns, filteredRows, title);
    else if (type === "excel") exportExcel(report.columns, filteredRows, title);
    else exportPDFOrPrint(report.columns, filteredRows, title);
  };

  return (
    <>
      <Header />
      <div className="material-page">
        <div className="material-content">
          {/* Page Header with Back Button */}
          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>
              <div className="page-header-title-group">
                <h1 className="page-header-title">Material Management Reports</h1>
                <p className="page-header-subtitle">
                  Read-only reports covering the full material journey — Project → DWG → BOM →
                  PO → GRN → Stock → Job Work → Production → QC → Rework → Dispatch.
                </p>
              </div>
            </div>
          </div>

          {/* ================= KPI Summary ================= */}
          <div className="rpt-summary-grid">
            {kpis.map((k) => (
              <div key={k.label} className={`rpt-summary-card ${k.cls}`}>
                <div className="rpt-summary-label">{k.label}</div>
                <div className="rpt-summary-value">{k.value}</div>
              </div>
            ))}
          </div>

          {/* ================= Report Selector ================= */}
          <div className="rpt-tabs">
            {REPORT_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => switchReport(key)}
                className={key === activeKey ? "rpt-tab rpt-tab-active" : "rpt-tab"}
              >
                {REPORT_CONFIGS[key].label}
              </button>
            ))}
          </div>

          {activeKey === "movementHistory" ? (
            <MovementHistorySection groups={MOVEMENT_GROUPS} />
          ) : (
            <>
              {/* ================= Search + Filters ================= */}
              <div className="rpt-filter-panel">
                <input
                  className="rpt-filter-input rpt-filter-search"
                  placeholder={`Search ${report.label}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button className="rpt-filter-toggle-btn" onClick={() => setShowFilters((v) => !v)}>
                  Filters {activeFilterCount > 0 && <span className="rpt-filter-count-badge">{activeFilterCount}</span>}
                </button>

                <button onClick={clearFilters} className="rpt-filter-clear-btn">
                  Clear Filters
                </button>

                <div className="rpt-filter-count">
                  {filteredRows.length} of {report.data.length} records
                </div>
              </div>

              {showFilters && (
                <div className="rpt-filter-panel rpt-filter-panel-expanded">
                  {report.dateField && (
                    <>
                      <label className="rpt-filter-date">
                        <span>From</span>
                        <input type="date" className="rpt-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </label>
                      <label className="rpt-filter-date">
                        <span>To</span>
                        <input type="date" className="rpt-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </label>
                    </>
                  )}

                  {report.filterFields.map((f) =>
                    f.type === "select" ? (
                      <select
                        key={f.key}
                        className="rpt-filter-select"
                        value={filterValues[f.key] || ""}
                        onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      >
                        <option value="">All {f.label}</option>
                        {(filterOptions[f.key] || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={f.key}
                        className="rpt-filter-input"
                        placeholder={f.label}
                        value={filterValues[f.key] || ""}
                        onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    ),
                  )}
                </div>
              )}

              {/* ================= Export Toolbar ================= */}
              <div className="rpt-export-bar">
                <button className="rpt-export-btn" onClick={() => handleExport("pdf")}>Export PDF</button>
                <button className="rpt-export-btn" onClick={() => handleExport("excel")}>Export Excel</button>
                <button className="rpt-export-btn" onClick={() => handleExport("csv")}>Export CSV</button>
                <button className="rpt-export-btn" onClick={() => handleExport("print")}>Print</button>
              </div>

              {/* ================= Report Table ================= */}
              <div className="rpt-table-wrapper">
                <table className="rpt-table">
                  <thead>
                    <tr>
                      {report.columns.map((c) => <th key={c.key}>{c.label}</th>)}
                      <th>Eye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 && (
                      <tr>
                        <td className="rpt-empty-cell" colSpan={report.columns.length + 1}>
                          <div className="rpt-empty-state">No records match the selected filters.</div>
                        </td>
                      </tr>
                    )}

                    {filteredRows.map((r) => (
                      <tr key={report.rowKey(r)}>
                        {report.columns.map((c) => (
                          <td key={c.key}>
                            {c.badge ? <Badge value={c.render ? c.render(r) : r[c.key]} /> : fmt(c.render ? c.render(r) : r[c.key])}
                          </td>
                        ))}
                        <td>
                          <button className="rpt-eye-btn" onClick={() => setEyeRow(r)} aria-label="View details">
                            👁
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {activeKey !== "movementHistory" && (
        <EyeModal report={report} row={eyeRow} onClose={() => setEyeRow(null)} />
      )}
    </>
  );
}