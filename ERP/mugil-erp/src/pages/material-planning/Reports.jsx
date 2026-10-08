import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./Reports.css";

/* ============================================================================
   CONSTANTS
   ============================================================================ */

// Axios baseURL is "/api", so this makes every report call resolve to
//   /api/erp/reports/...
const API_BASE = "/erp";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const REPORT_ORDER = [
  "poIntegration",
  "grn",
  "materialStock",
  "issueToJobWork",
  "receiveFromJobWork",
  "cutting",
  "issueToProduction",
  "assemblyIntegration",
  "productionOperation",
  "rework",
  "dispatch",
  "movementHistory",
];

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
  if (!iso || iso === "—") return "—";
  const d = parseISO(iso);
  if (!d || Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const first = Object.values(data)
      .flat()
      .find((v) => typeof v === "string");
    if (first) return first;
  }
  if (error?.message) return error.message;
  return fallback;
}

/* ============================================================================
   STATUS TONES
   ============================================================================ */

const STATUS_TONE = {
  Integrated: "success",
  "Not Integrated": "neutral",
  "Partially Integrated": "warning",
  "Dummy PO": "amber",
  "Actual PO": "info",
  Accepted: "success",
  Pending: "warning",
  Rejected: "danger",
  "Fully Received": "success",
  "Partially Received": "warning",
  "Not Received": "neutral",
  Available: "success",
  Remaining: "warning",
  "Cutting Remaining": "info",
  "Job Remaining": "warning",
  Yes: "warning",
  No: "neutral",
  "In-House": "info",
  Outsourcing: "amber",
  Issued: "success",
  "In Production": "info",
  Completed: "success",
  "Rework Pending": "danger",
  "Rework Required": "danger",
  "Rework In Progress": "warning",
  "Partially Completed": "warning",
  "QC Pending": "warning",
  "Ready for Next Process": "info",
  "Ready For Next Process": "info",
  "Available in Material Stock": "success",
  "Ready for Dispatch": "info",
  "Partially Dispatched": "warning",
  Dispatched: "success",
  "Not Ready": "neutral",
  "In Progress": "info",
  Planned: "neutral",
  "Waiting For Previous Process": "neutral",
  "Receive From Job Work": "info",
  "Production Operation": "amber",
};

function Badge({ value }) {
  if (!value || value === "—") return <span>—</span>;
  const tone = STATUS_TONE[value] || "neutral";
  return <span className={`rpt-badge rpt-badge-${tone}`}>{value}</span>;
}

/* ============================================================================
   EXPORT HELPERS
   ============================================================================ */

function toCSV(columns, rows) {
  const escape = (v) => {
    const s = fmt(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => escape(c.render ? c.render(r) : r[c.key])).join(",")
  );
  return [header, ...lines].join("\n");
}

function toHTMLTable(columns, rows, title) {
  const head = columns
    .map(
      (c) =>
        `<th style="border:1px solid #ccc;padding:6px;background:#f1f5f9;text-align:left;">${c.label}</th>`
    )
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="border:1px solid #ccc;padding:6px;">${fmt(
                c.render ? c.render(r) : r[c.key]
              )}</td>`
          )
          .join("")}</tr>`
    )
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
  downloadBlob(
    toCSV(columns, rows),
    `${title.replace(/\s+/g, "_")}.csv`,
    "text/csv"
  );
}
function exportExcel(columns, rows, title) {
  downloadBlob(
    toHTMLTable(columns, rows, title),
    `${title.replace(/\s+/g, "_")}.xls`,
    "application/vnd.ms-excel"
  );
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
   ----------------------------------------------------------------------------
   Every entry mirrors what the backend registry returns. `data` comes from
   the API at runtime.
   ============================================================================ */

const REPORT_CONFIGS = {
  poIntegration: {
    label: "PO / PO Integration",
    dateField: "integrationDate",
    rowKey: (r) => r.id,
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
    searchFields: [
      "poNumber",
      "description",
      "material",
      "materialCode",
      "project",
      "dwgNumber",
    ],
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
      {
        title: "PO Item",
        fields: [
          ["PO Type", r.poType],
          ["PO Number", r.poNumber],
          ["Supplier", r.supplier],
          ["PO Description", r.description],
          ["Material", r.material],
          ["Material Code", r.materialCode],
          ["Material Specification", r.materialSpec],
          ["Unit", r.unit],
          ["PO Quantity", r.poQty],
          ["Received Quantity", r.received],
          ["Balance Quantity", r.balanceQty],
        ],
      },
      {
        title: "Integration",
        fields: [
          ["Project", r.project],
          ["DWG", r.dwgNumber],
          ["DWG Description", r.dwgDescription],
          ["Integration Status", r.integrationStatus],
          ["Integration Quantity", r.integrationQty],
          ["Integration Date", fmtDate(r.integrationDate)],
        ],
      },
    ],
  },

  grn: {
    label: "GRN / Received Material",
    dateField: "grnDate",
    rowKey: (r) => r.id,
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
    searchFields: [
      "poNumber",
      "description",
      "material",
      "materialCode",
      "grnNumber",
    ],
    filterFields: [
      { key: "material", label: "Material", type: "select" },
      { key: "thickness", label: "Thickness", type: "select" },
      { key: "size", label: "Size", type: "select" },
      { key: "poType", label: "PO Type", type: "select" },
      { key: "inspectionStatus", label: "Inspection Status", type: "select" },
      { key: "grnStatus", label: "GRN Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "GRN Entry",
        fields: [
          ["GRN Number", r.grnNumber],
          ["GRN Date", fmtDate(r.grnDate)],
          ["PO Type", r.poType],
          ["PO Number", r.poNumber],
          ["PO Description", r.description],
          ["Material", r.material],
          ["Material Spec", r.materialSpec],
          ["Thickness", r.thickness],
          ["Size", r.size],
        ],
      },
      {
        title: "Receiving",
        fields: [
          ["Received Quantity", r.receivedQty],
          ["Balance Quantity", r.balanceQty],
          ["Receiving Unit", r.receivingUnit],
          ["Inspection Status", r.inspectionStatus],
          ["Inspected By", r.inspectedBy],
          ["Received By", r.receivedBy],
          ["Remarks", r.remarks],
        ],
      },
    ],
  },

  materialStock: {
    label: "Material Stock",
    dateField: null,
    rowKey: (r) => r.id,
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
    searchFields: [
      "material",
      "materialCode",
      "poNumber",
      "description",
      "plateNumber",
      "thickness",
      "size",
      "project",
    ],
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
      {
        title: "Material",
        fields: [
          ["Stock ID", r.stockId],
          ["Material", r.material],
          ["Material Code", r.materialCode],
          ["Material Spec", r.materialSpec],
          ["Thickness", r.thickness],
          ["Size", r.size],
          ["Piece Number", r.plateNumber],
        ],
      },
      {
        title: "Origin",
        fields: [
          ["PO Number", r.poNumber],
          ["PO Description", r.description],
          ["Project", r.project],
          ["DWG Description", r.dwgDescription],
          ["Revision", r.revision],
          ["Source", r.sourceType],
        ],
      },
      {
        title: "Stock",
        fields: [
          ["Facility Unit", r.unit],
          ["Original Quantity", r.originalQuantity],
          ["Available Quantity", r.availableQuantity],
          ["Unit", r.uom],
          ["Stock Status", r.stockStatus],
          ["Rework Required", r.reworkRequired],
        ],
      },
    ],
  },

  issueToJobWork: {
    label: "Issue To Job Work",
    dateField: "date",
    rowKey: (r) => r.id,
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
    searchFields: [
      "id",
      "poNumber",
      "description",
      "project",
      "dwg",
      "material",
      "process",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "jobWorkType", label: "Job Work Type", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Issue",
        fields: [
          ["Issue ID", r.id],
          ["PO Number", r.poNumber],
          ["PO Description", r.description],
          ["Project", r.project],
          ["DWG", r.dwg],
          ["Material", r.material],
        ],
      },
      {
        title: "Job Work",
        fields: [
          ["Job Work Type", r.jobWorkType],
          ["Job Work Unit", r.unit],
          ["Vendor", r.vendor],
          ["Process", r.process],
          ["Process ID", r.processId],
          ["Issued Quantity", `${r.quantity} ${r.uom}`],
          ["Issue Date", fmtDate(r.date)],
          ["Issued By", r.issuedBy],
          ["Status", r.status],
        ],
      },
    ],
  },

  receiveFromJobWork: {
    label: "Receive From Job Work",
    dateField: "issueDate",
    rowKey: (r) => r.id,
    columns: [
      { key: "id", label: "Job ID" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "material", label: "Material" },
      { key: "process", label: "Process" },
      { key: "issuedQty", label: "Issued Qty" },
      { key: "outputQty", label: "Received Qty" },
      { key: "remainingQty", label: "Remaining Qty" },
      {
        key: "reworkPending",
        label: "Rework",
        render: (r) => (r.reworkPending ? "Yes" : "No"),
      },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: [
      "id",
      "poNumber",
      "poDescription",
      "project",
      "dwg",
      "material",
      "process",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "jobWorkType", label: "Job Work Type", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Source",
        fields: [
          ["Job ID", r.id],
          ["PO Type", r.poType],
          ["PO Number", r.poNumber],
          ["Supplier", r.supplier],
          ["PO Description", r.poDescription],
          ["Project", r.project],
          ["DWG", r.dwg],
          ["DWG Description", r.dwgDescription],
          ["Revision", r.revision],
        ],
      },
      {
        title: "Material",
        fields: [
          ["Material", r.material],
          ["Material Code", r.materialCode],
          ["Material Spec", r.materialSpec],
          ["Thickness", r.thickness],
          ["Size", r.size],
        ],
      },
      {
        title: "Job Work",
        fields: [
          ["Job Work Type", r.jobWorkType],
          ["Process", r.process],
          ["Process ID", r.processId],
          ["Original Issued Qty", r.issuedQty],
          ["Previously Received Qty", r.previouslyReceived],
          ["Received (Output) Qty", r.outputQty],
          ["Remaining Qty", r.remainingQty],
          ["Rework Pending", r.reworkPending ? "Yes" : "No"],
          ["Status", r.status],
        ],
      },
    ],
  },

  cutting: {
    label: "Cutting / Finished Pieces",
    dateField: null,
    rowKey: (r) => r.rowKey,
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
    searchFields: [
      "id",
      "poNumber",
      "project",
      "material",
      "materialCode",
      "pieceNo",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "thickness", label: "Thickness", type: "select" },
      { key: "rowType", label: "Type", type: "select" },
      { key: "reworked", label: "Reworked", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Piece",
        fields: [
          ["Type", r.rowType],
          ["Piece Number", r.pieceNo],
          ["Material", r.material],
          ["Material Code", r.materialCode],
          ["Thickness", r.thickness],
          ["Original Size", r.originalSize],
          ["Cut Size", r.size],
          ["Quantity", `${r.quantity} ${r.unit}`],
          ["Weight", r.weight ?? "—"],
        ],
      },
      {
        title: "Origin",
        fields: [
          ["Cutting / Stock ID", r.id],
          ["PO Number", r.poNumber],
          ["Project", r.project],
          ["Reworked", r.reworked],
          ["Status", r.status],
          ["Date", fmtDate(r.date)],
        ],
      },
    ],
  },

  issueToProduction: {
    label: "Issue To Production",
    dateField: "issueDate",
    rowKey: (r) => r.issueId,
    columns: [
      { key: "issueId", label: "Issue ID" },
      { key: "poNumber", label: "PO Number" },
      { key: "project", label: "Project" },
      { key: "dwg", label: "DWG" },
      { key: "material", label: "Material" },
      { key: "issuedNow", label: "Issued Qty" },
      { key: "remainingAvailableQty", label: "Available Qty" },
      {
        key: "issueDate",
        label: "Issue Date",
        render: (r) => fmtDate(r.issueDate),
      },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: [
      "issueId",
      "poNumber",
      "poDescription",
      "project",
      "dwg",
      "material",
      "materialCode",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "dwg", label: "DWG", type: "select" },
      { key: "material", label: "Material", type: "select" },
      { key: "jobWorkType", label: "Job Work Type", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Source",
        fields: [
          ["Issue ID", r.issueId],
          ["Job Work ID", r.jobWorkId],
          ["PO Type", r.poType],
          ["PO Number", r.poNumber],
          ["Supplier", r.supplier],
          ["PO Description", r.poDescription],
          ["Project", r.project],
          ["DWG", r.dwg],
          ["DWG Description", r.dwgDescription],
          ["Revision", r.revision],
        ],
      },
      {
        title: "Material",
        fields: [
          ["Material", r.material],
          ["Material Code", r.materialCode],
          ["Material Spec", r.materialSpec],
          ["Thickness", r.thickness],
          ["Size", r.size],
          ["Unit", r.unit],
        ],
      },
      {
        title: "Issue",
        fields: [
          ["Issued Quantity", r.issuedNow],
          ["Previously Issued Qty", r.previouslyIssuedQty],
          ["Available Quantity", r.remainingAvailableQty],
          ["Issue Date", fmtDate(r.issueDate)],
          ["Issued By", r.issuedBy],
          ["Status", r.status],
        ],
        note:
          "Production routes are defined in Assembly Integration, not here — this record only shows material being issued.",
      },
    ],
  },

  assemblyIntegration: {
    label: "Production Assembly Integration",
    dateField: "createdDate",
    rowKey: (r) => r.assemblyId,
    columns: [
      { key: "assemblyId", label: "Assembly ID" },
      { key: "project", label: "Project" },
      { key: "dwgText", label: "DWG(s)" },
      { key: "materialText", label: "Material(s)" },
      { key: "poText", label: "Source PO(s)" },
      { key: "inputQty", label: "Input Qty" },
      {
        key: "createdDate",
        label: "Integration Date",
        render: (r) => fmtDate(r.createdDate),
      },
      { key: "status", label: "Assembly Status", badge: true },
    ],
    searchFields: [
      "assemblyId",
      "project",
      "dwgText",
      "materialText",
      "poText",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "status", label: "Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Assembly",
        fields: [
          ["Assembly ID", r.assemblyId],
          ["Project", r.project],
          ["DWG(s)", r.dwgText],
          ["Status", r.status],
          ["Integration Date", fmtDate(r.createdDate)],
        ],
      },
      {
        title: "Inputs Consumed",
        rows: (r.inputs || []).map((i) => {
          if (i.sourceType === "material") {
            return {
              label: `${i.materialName || i.sourceId} (${
                i.materialCode || i.sourceId
              })`,
              value: `${i.useQty} Nos — ${i.drawingNumber || "—"}`,
            };
          }
          return {
            label: `${i.sourceId} (prior assembly)`,
            value: `${i.useQty} Nos`,
          };
        }),
      },
    ],
  },

  productionOperation: {
    label: "Production Operation",
    dateField: "startDate",
    rowKey: (r) => `${r.assemblyId}/${r.processId}`,
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
      {
        title: "Process",
        fields: [
          ["Assembly", r.assemblyId],
          ["Project", r.project],
          ["DWG(s)", r.dwg],
          ["Process", r.process],
          ["Process ID", r.processId],
          ["Sequence", r.sequence],
          ["Total Qty", r.totalQty],
          ["Available Qty", r.availableQty],
          ["Completed Qty", r.completedQty],
          ["Pending Qty", r.pendingQty],
          ["Rework Qty", r.reworkQty],
          ["Status", r.processStatus],
        ],
      },
      {
        title: "Execution",
        fields: [
          ["Performed By", fmt(r.performedBy)],
          ["Supervisor", fmt(r.supervisor)],
          ["Start Date", fmtDate(r.startDate)],
          ["Completion Date", fmtDate(r.completionDate)],
        ],
      },
      {
        title: "QC",
        fields: [
          ["QC Status", r.qcStatus],
          ["QC Verified By", fmt(r.qcVerifiedBy)],
          ["QC Date", fmtDate(r.qcDate)],
          ["Accepted Qty", r.acceptedQty],
          ["Rejected Qty", r.rejectedQty],
        ],
      },
    ],
  },

  rework: {
    label: "Rework",
    dateField: "startDate",
    rowKey: (r) => r.reworkId,
    columns: [
      { key: "reworkId", label: "Rework ID" },
      { key: "source", label: "Source", badge: true },
      { key: "project", label: "Project" },
      {
        key: "assembly",
        label: "Assembly / PO",
        render: (r) => (r.assembly !== "—" ? r.assembly : r.poNumber),
      },
      { key: "material", label: "Material" },
      { key: "process", label: "Process" },
      { key: "requiredQty", label: "Required Qty" },
      { key: "completedQty", label: "Completed Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "status", label: "Status", badge: true },
    ],
    searchFields: [
      "reworkId",
      "project",
      "dwg",
      "poNumber",
      "assembly",
      "material",
      "pieceNo",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "dwg", label: "DWG", type: "select" },
      { key: "assembly", label: "Assembly", type: "select" },
      { key: "process", label: "Process", type: "select" },
      { key: "source", label: "Rework Source", type: "select" },
      { key: "status", label: "Rework Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Rework Item",
        fields: [
          ["Rework ID", r.reworkId],
          ["Source", r.source],
          ["Project", r.project],
          ["DWG", r.dwg],
          ["PO Number", r.poNumber],
          ["PO Description", r.poDescription],
          ["Assembly", r.assembly],
          ["Material", r.material],
          ["Piece Number", r.pieceNo],
          ["Process", r.process],
        ],
      },
      {
        title: "Quantity",
        fields: [
          ["Required Qty", r.requiredQty],
          ["Completed Qty", r.completedQty],
          ["Balance Qty", r.balanceQty],
          ["Status", r.status],
        ],
      },
      {
        title: "History",
        fields: [
          ["Rework Done By", fmt(r.reworkDoneBy)],
          ["Supervisor", fmt(r.supervisor)],
          ["Start Date", fmtDate(r.startDate)],
          ["Start Time", fmt(r.startTime)],
          ["Completion Date", fmtDate(r.completionDate)],
          ["Completion Time", fmt(r.completionTime)],
          ["Remarks", fmt(r.remarks)],
        ],
      },
    ],
  },

  dispatch: {
    label: "Dispatch",
    dateField: "date",
    rowKey: (r) => r.rowKey,
    columns: [
      { key: "dispatchId", label: "Dispatch ID" },
      { key: "assemblyId", label: "Assembly ID" },
      { key: "project", label: "Project" },
      { key: "plannedQty", label: "Finished Qty" },
      {
        key: "productionEndDate",
        label: "Prod. End",
        render: (r) => fmtDate(r.productionEndDate),
      },
      {
        key: "date",
        label: "Dispatch Date",
        render: (r) => fmtDate(r.date),
      },
      { key: "dispatchQty", label: "Dispatch Qty" },
      { key: "balanceQty", label: "Balance Qty" },
      { key: "dispatchStatus", label: "Status", badge: true },
    ],
    searchFields: [
      "dispatchId",
      "assemblyId",
      "project",
      "dwgText",
      "location",
    ],
    filterFields: [
      { key: "project", label: "Project", type: "select" },
      { key: "assemblyId", label: "Assembly", type: "select" },
      { key: "dwgText", label: "DWG", type: "select" },
      { key: "dispatchStatus", label: "Dispatch Status", type: "select" },
    ],
    detailSections: (r) => [
      {
        title: "Assembly",
        fields: [
          ["Assembly ID", r.assemblyId],
          ["Project", r.project],
          ["DWG(s)", r.dwgText],
          ["Revision", r.revision],
          ["Description", r.description],
          ["Finished Quantity", r.plannedQty],
        ],
      },
      {
        title: "Production",
        fields: [
          ["Production Start", fmtDate(r.productionStartDate)],
          ["Production End", fmtDate(r.productionEndDate)],
          ["Production Duration", r.duration],
        ],
      },
      {
        title: "Dispatch",
        fields: [
          ["Dispatch ID", r.dispatchId],
          ["Dispatch Date", fmtDate(r.date)],
          ["Dispatch Time", fmt(r.time)],
          ["Dispatch To", r.dispatchTo],
          ["Destination", r.location],
          ["Vehicle Number", r.vehicleNumber],
          ["Transporter", r.transporter],
          ["Driver Name", r.driverName],
          ["Driver Contact", r.driverContact],
          ["Dispatch Qty", r.dispatchQty],
          ["Dispatched (Cumulative)", r.dispatchedQty],
          ["Balance Qty", r.balanceQty],
          ["Dispatch Date Diff.", r.dateDiff],
          ["Status", r.dispatchStatus],
          ["Remarks", fmt(r.remarks)],
        ],
      },
    ],
  },
};

/* ============================================================================
   MATERIAL MOVEMENT — filter sections
   ============================================================================ */

const MH_FILTER_SECTIONS = [
  {
    title: "Project / PO",
    fields: [
      { key: "poNumber", label: "PO Number" },
      { key: "poDescription", label: "PO Description" },
      { key: "dwg", label: "DWG" },
    ],
  },
  {
    title: "Material",
    fields: [
      { key: "material", label: "Material" },
      { key: "thickness", label: "Thickness" },
      { key: "size", label: "Size" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    title: "Status / Movement",
    fields: [
      { key: "movementType", label: "Movement / Source" },
      { key: "status", label: "Status" },
      { key: "location", label: "Current Location" },
      { key: "process", label: "Process" },
    ],
  },
];

const MH_FILTER_LABELS = {
  poNumber: "PO",
  poDescription: "PO Description",
  dwg: "DWG",
  material: "Material",
  thickness: "Thickness",
  size: "Size",
  unit: "Unit",
  movementType: "Movement",
  status: "Status",
  location: "Location",
  process: "Process",
};

const MH_EMPTY_FILTERS = {
  poNumber: "",
  poDescription: "",
  dwg: "",
  material: "",
  thickness: "",
  size: "",
  unit: "",
  movementType: "",
  status: "",
  location: "",
  process: "",
};

const MH_SUMMARY_COLUMNS = [
  { key: "poNumber", label: "PO Number" },
  { key: "poDescription", label: "PO Description" },
  { key: "material", label: "Material" },
  { key: "dwg", label: "DWG" },
  {
    key: "pieceLabel",
    label: "Piece / Qty",
    render: (r) =>
      r.pieceLabel !== "—" ? `${r.pieceLabel} · ${r.qtyLabel}` : r.qtyLabel,
  },
  { key: "currentStage", label: "Current Stage" },
  { key: "currentStatus", label: "Current Status" },
  { key: "currentLocation", label: "Current Location" },
  {
    key: "lastMovementDate",
    label: "Last Movement",
    render: (r) => fmtDate(r.lastMovementDate),
  },
];

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
          <button
            className="rpt-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
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
   MOVEMENT HISTORY — SECTION
   ============================================================================ */
/* ============================================================================
   MOVEMENT HISTORY — SECTION  (Project-scoped only)
   ============================================================================ */

function MovementHistorySection({ authHeaders }) {
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOptions, setProjectOptions] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");

  const [filters, setFilters] = useState(MH_EMPTY_FILTERS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [eyeGroup, setEyeGroup] = useState(null);

  /* ---------- load project options ---------- */
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await api.get(
          `${API_BASE}/reports/material-movement/projects/`,
          {
            params: { search: projectSearch },
            headers: authHeaders(),
          }
        );
        setProjectOptions(res.data?.data || []);
      } catch {
        setProjectOptions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [projectSearch, authHeaders]);

  /* ---------- load groups ---------- */
  const loadGroups = useCallback(async () => {
    if (!selectedProject) {
      setGroups([]);
      return;
    }
    setGroupsLoading(true);
    setGroupsError("");
    try {
      const params = { projectId: selectedProject.projectId };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await api.get(
        `${API_BASE}/reports/material-movement/groups/`,
        { params, headers: authHeaders() }
      );
      setGroups(res.data?.data || []);
    } catch (err) {
      setGroupsError(getApiError(err, "Failed to load movement history."));
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [
    selectedProject,
    search,
    filters,
    dateFrom,
    dateTo,
    authHeaders,
  ]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  /* ---------- derived ---------- */
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilters(MH_EMPTY_FILTERS);
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const setFilter = (key, value) =>
    setFilters((v) => ({ ...v, [key]: value }));

  const summaryChips = MH_FILTER_SECTIONS.flatMap((s) => s.fields)
    .filter((f) => filters[f.key])
    .map((f) => `${MH_FILTER_LABELS[f.key]}: ${filters[f.key]}`);
  if (dateFrom) summaryChips.push(`From: ${fmtDate(dateFrom)}`);
  if (dateTo) summaryChips.push(`To: ${fmtDate(dateTo)}`);

  const handleExport = (type) => {
    const title = "Material Movement History";
    if (type === "csv") exportCSV(MH_SUMMARY_COLUMNS, groups, title);
    else if (type === "excel")
      exportExcel(MH_SUMMARY_COLUMNS, groups, title);
    else exportPDFOrPrint(MH_SUMMARY_COLUMNS, groups, title);
  };

  /* ---------- picker screen (Project only) ---------- */
  if (!selectedProject) {
    return (
      <div className="rpt-mh-picker rpt-mh-picker-single">
        <div className="rpt-mh-picker-col">
          <h3 className="rpt-mh-picker-title">Select a Project</h3>
          <input
            className="rpt-filter-input rpt-filter-search"
            placeholder="Search project name or code..."
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
          />
          <div className="rpt-mh-picker-list">
            {projectOptions.length === 0 && (
              <div className="rpt-mh-picker-empty">
                {projectSearch
                  ? "No projects match."
                  : "Type to search projects."}
              </div>
            )}
            {projectOptions.map((p) => (
              <button
                key={p.projectId}
                className="rpt-mh-picker-row"
                onClick={() => setSelectedProject(p)}
              >
                <div className="rpt-mh-picker-row-code">{p.code}</div>
                <div className="rpt-mh-picker-row-name">{p.name}</div>
                <div className="rpt-mh-picker-row-meta">
                  {p.poCount} POs · {p.movementCount} movements
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- grouped report screen ---------- */
  return (
    <>
      <div className="rpt-mh-scope">
        <span className="rpt-mh-scope-label">Scope:</span>
        <span className="rpt-mh-scope-chip">
          Project · {selectedProject.code}
          <button
            className="rpt-mh-scope-x"
            onClick={() => {
              setSelectedProject(null);
              setGroups([]);
              clearFilters();
            }}
          >
            ✕
          </button>
        </span>
        <button
          className="rpt-filter-clear-btn"
          onClick={() => {
            setSelectedProject(null);
            setGroups([]);
            clearFilters();
          }}
        >
          Change Project
        </button>
      </div>

      <div className="rpt-filter-panel">
        <input
          className="rpt-filter-input rpt-filter-search"
          placeholder="Search material movement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="rpt-filter-toggle-btn"
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters{" "}
          {activeFilterCount > 0 && (
            <span className="rpt-filter-count-badge">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button onClick={clearFilters} className="rpt-filter-clear-btn">
          Clear Filters
        </button>
        <div className="rpt-filter-count">
          {groups.length} item{groups.length !== 1 ? "s" : ""}
        </div>
      </div>

      {showFilters && (
        <div className="rpt-mh-filter-panel">
          {MH_FILTER_SECTIONS.map((section) => (
            <div className="rpt-mh-filter-group" key={section.title}>
              <div className="rpt-mh-filter-group-title">
                {section.title}
              </div>
              <div className="rpt-mh-filter-group-fields">
                {section.fields.map((f) => (
                  <input
                    key={f.key}
                    className="rpt-filter-input"
                    placeholder={`All ${f.label}`}
                    value={filters[f.key]}
                    onChange={(e) => setFilter(f.key, e.target.value)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="rpt-mh-filter-group">
            <div className="rpt-mh-filter-group-title">Date</div>
            <div className="rpt-mh-filter-group-fields">
              <label className="rpt-filter-date">
                <span>From</span>
                <input
                  type="date"
                  className="rpt-filter-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="rpt-filter-date">
                <span>To</span>
                <input
                  type="date"
                  className="rpt-filter-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {summaryChips.length > 0 && (
        <div className="rpt-mh-summary-banner">
          <span className="rpt-mh-summary-label">
            Showing movement history for:
          </span>
          {summaryChips.map((chip) => (
            <span key={chip} className="rpt-mh-summary-chip">
              {chip}
            </span>
          ))}
          <span className="rpt-mh-summary-count">
            Records: {groups.length}
          </span>
        </div>
      )}

      <div className="rpt-export-bar">
        <button
          className="rpt-export-btn"
          onClick={() => handleExport("pdf")}
        >
          Export PDF
        </button>
        <button
          className="rpt-export-btn"
          onClick={() => handleExport("excel")}
        >
          Export Excel
        </button>
        <button
          className="rpt-export-btn"
          onClick={() => handleExport("csv")}
        >
          Export CSV
        </button>
        <button
          className="rpt-export-btn"
          onClick={() => handleExport("print")}
        >
          Print
        </button>
      </div>

      {groupsLoading && (
        <div className="grn-state-block">
          <Loading />
        </div>
      )}

      {!groupsLoading && groupsError && (
        <div className="grn-state-block">
          <Error onRetry={loadGroups} />
        </div>
      )}

      {!groupsLoading && !groupsError && (
        <div className="rpt-table-wrapper">
          <table className="rpt-table">
            <thead>
              <tr>
                {MH_SUMMARY_COLUMNS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Eye</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td
                    className="rpt-empty-cell"
                    colSpan={MH_SUMMARY_COLUMNS.length + 1}
                  >
                    <div className="rpt-empty-state">
                      No material movements found.
                      <br />
                      Try changing or clearing your filters.
                      <div className="rpt-mh-empty-clear">
                        <button
                          className="rpt-filter-clear-btn"
                          onClick={clearFilters}
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {groups.map((g) => (
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
                    <button
                      className="rpt-eye-btn"
                      onClick={() => setEyeGroup(g)}
                      aria-label="View full movement history"
                    >
                      👁
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MovementTimelineModal
        group={eyeGroup}
        onClose={() => setEyeGroup(null)}
      />
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
          <button
            className="rpt-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="rpt-modal-body">
          <div className="rpt-eye-section">
            <h4>Item</h4>
            <div className="rpt-eye-grid">
              <ReadonlyField label="Project" value={group.projectCode} />
              <ReadonlyField label="PO" value={group.poNumber} />
              <ReadonlyField
                label="PO Description"
                value={group.poDescription}
              />
              <ReadonlyField label="Material" value={group.material} />
              <ReadonlyField label="DWG" value={group.dwg} />
              <ReadonlyField label="Thickness" value={group.thickness} />
              <ReadonlyField label="Size" value={group.size} />
              <ReadonlyField
                label="Piece Number(s)"
                value={group.pieceLabel}
              />
            </div>
          </div>

          <div className="rpt-eye-section">
            <h4>Movement History</h4>
            <ol className="rpt-mh-timeline">
              {(group.events || []).map((e, idx) => (
                <li key={e.movementId} className="rpt-mh-timeline-step">
                  <div className="rpt-mh-timeline-marker">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="rpt-mh-timeline-content">
                    <div className="rpt-mh-timeline-title">
                      {e.movementType}
                    </div>
                    <div className="rpt-eye-grid">
                      <ReadonlyField
                        label="Date"
                        value={fmtDate(e.date)}
                      />
                      <ReadonlyField
                        label="Quantity"
                        value={`${fmt(e.quantity)} ${
                          e.unit !== "—" ? e.unit : ""
                        }`}
                      />
                      <ReadonlyField label="Source" value={e.source} />
                      <ReadonlyField
                        label="Destination"
                        value={e.destination}
                      />
                      {e.process !== "—" && (
                        <ReadonlyField
                          label="Process"
                          value={e.process}
                        />
                      )}
                      <ReadonlyField label="Status" value={e.status} />
                      <ReadonlyField
                        label="Reference"
                        value={e.referenceId}
                      />
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
  const { accessToken } = useAuth();

  const handleBack = () => navigate("/inventory/material");

  const [activeKey, setActiveKey] = useState(REPORT_ORDER[0]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [eyeRow, setEyeRow] = useState(null);

  const [kpis, setKpis] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [filterOptions, setFilterOptions] = useState({});

  const report = REPORT_CONFIGS[activeKey];

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* ---------- KPIs ---------- */
  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await api.get(`${API_BASE}/reports/kpis/`, {
          headers: authHeaders(),
        });
        setKpis(res.data?.data || []);
      } catch {
        setKpis([]);
      }
    })();
  }, [accessToken, authHeaders]);

  /* ---------- rows ---------- */
  const loadRows = useCallback(async () => {
    if (!accessToken) return;
    if (activeKey === "movementHistory") return;
    setRowsLoading(true);
    setRowsError("");
    try {
      const params = {};
      if (search) params.search = search;
      Object.entries(filterValues).forEach(
        ([k, v]) => v && (params[k] = v)
      );
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await api.get(
        `${API_BASE}/reports/${activeKey}/`,
        { params, headers: authHeaders() }
      );
      setRows(res.data?.data || []);
    } catch (err) {
      setRowsError(getApiError(err, "Failed to load report."));
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, [
    accessToken,
    activeKey,
    search,
    filterValues,
    dateFrom,
    dateTo,
    authHeaders,
  ]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  /* ---------- filter options ---------- */
  useEffect(() => {
    if (!accessToken) return;
    if (activeKey === "movementHistory") return;
    (async () => {
      try {
        const res = await api.get(
          `${API_BASE}/reports/${activeKey}/filter-options/`,
          { headers: authHeaders() }
        );
        setFilterOptions(res.data?.data || {});
      } catch {
        setFilterOptions({});
      }
    })();
  }, [activeKey, accessToken, authHeaders]);

  /* ---------- report switching ---------- */
  const switchReport = (key) => {
    setActiveKey(key);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilterValues({});
    setShowFilters(false);
    setEyeRow(null);
    setRows([]);
    setRowsError("");
  };

  /* ---------- filter helpers ---------- */
  const activeFilterCount =
    Object.values(filterValues).filter(Boolean).length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilterValues({});
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const handleExport = (type) => {
    const title = report.label;
    if (type === "csv") exportCSV(report.columns, rows, title);
    else if (type === "excel") exportExcel(report.columns, rows, title);
    else exportPDFOrPrint(report.columns, rows, title);
  };

  /* ---------- auth guard ---------- */
  if (!accessToken) {
    return (
      <>
        <Header />
        <div className="material-page">
          <div className="material-content">
            <div className="grn-state-block">
              <Error
                onRetry={handleBack}
                message="Your session has expired. Please login again."
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="material-page">
        <div className="material-content">
          {/* -------- Page header -------- */}
          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>
              <div className="page-header-title-group">
                <h1 className="page-header-title">
                  Material Management Reports
                </h1>
                <p className="page-header-subtitle">
                  Read-only reports covering the full material journey —
                  Project → DWG → BOM → PO → GRN → Stock → Job Work →
                  Production → QC → Rework → Dispatch.
                </p>
              </div>
            </div>
          </div>

          {/* -------- KPI cards -------- */}
          <div className="rpt-summary-grid">
            {kpis.map((k) => (
              <div
                key={k.label}
                className={`rpt-summary-card ${k.cls}`}
              >
                <div className="rpt-summary-label">{k.label}</div>
                <div className="rpt-summary-value">{k.value}</div>
              </div>
            ))}
          </div>

          {/* -------- Tabs -------- */}
          <div className="rpt-tabs">
            {REPORT_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => switchReport(key)}
                className={
                  key === activeKey ? "rpt-tab rpt-tab-active" : "rpt-tab"
                }
              >
                {key === "movementHistory"
                  ? "Material Movement History"
                  : REPORT_CONFIGS[key].label}
              </button>
            ))}
          </div>

          {/* -------- Body -------- */}
          {activeKey === "movementHistory" ? (
            <MovementHistorySection authHeaders={authHeaders} />
          ) : (
            <>
              {/* Toolbar */}
              <div className="rpt-filter-panel">
                <input
                  className="rpt-filter-input rpt-filter-search"
                  placeholder={`Search ${report.label}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button
                  className="rpt-filter-toggle-btn"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  Filters{" "}
                  {activeFilterCount > 0 && (
                    <span className="rpt-filter-count-badge">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={clearFilters}
                  className="rpt-filter-clear-btn"
                >
                  Clear Filters
                </button>

                <div className="rpt-filter-count">
                  {rows.length} record{rows.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Expanded filters */}
              {showFilters && (
                <div className="rpt-filter-panel rpt-filter-panel-expanded">
                  {report.dateField && (
                    <>
                      <label className="rpt-filter-date">
                        <span>From</span>
                        <input
                          type="date"
                          className="rpt-filter-input"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </label>
                      <label className="rpt-filter-date">
                        <span>To</span>
                        <input
                          type="date"
                          className="rpt-filter-input"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {report.filterFields.map((f) =>
                    f.type === "select" ? (
                      <select
                        key={f.key}
                        className="rpt-filter-select"
                        value={filterValues[f.key] || ""}
                        onChange={(e) =>
                          setFilterValues((v) => ({
                            ...v,
                            [f.key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">All {f.label}</option>
                        {(filterOptions[f.key] || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={f.key}
                        className="rpt-filter-input"
                        placeholder={f.label}
                        value={filterValues[f.key] || ""}
                        onChange={(e) =>
                          setFilterValues((v) => ({
                            ...v,
                            [f.key]: e.target.value,
                          }))
                        }
                      />
                    )
                  )}
                </div>
              )}

              {/* Export toolbar */}
              <div className="rpt-export-bar">
                <button
                  className="rpt-export-btn"
                  onClick={() => handleExport("pdf")}
                >
                  Export PDF
                </button>
                <button
                  className="rpt-export-btn"
                  onClick={() => handleExport("excel")}
                >
                  Export Excel
                </button>
                <button
                  className="rpt-export-btn"
                  onClick={() => handleExport("csv")}
                >
                  Export CSV
                </button>
                <button
                  className="rpt-export-btn"
                  onClick={() => handleExport("print")}
                >
                  Print
                </button>
              </div>

              {/* Loading / Error / Table */}
              {rowsLoading && (
                <div className="grn-state-block">
                  <Loading />
                </div>
              )}

              {!rowsLoading && rowsError && (
                <div className="grn-state-block">
                  <Error onRetry={loadRows} />
                </div>
              )}

              {!rowsLoading && !rowsError && (
                <div className="rpt-table-wrapper">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        {report.columns.map((c) => (
                          <th key={c.key}>{c.label}</th>
                        ))}
                        <th>Eye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td
                            className="rpt-empty-cell"
                            colSpan={report.columns.length + 1}
                          >
                            <div className="rpt-empty-state">
                              No records match the selected filters.
                            </div>
                          </td>
                        </tr>
                      )}

                      {rows.map((r) => (
                        <tr key={report.rowKey(r)}>
                          {report.columns.map((c) => (
                            <td key={c.key}>
                              {c.badge ? (
                                <Badge
                                  value={
                                    c.render ? c.render(r) : r[c.key]
                                  }
                                />
                              ) : (
                                fmt(c.render ? c.render(r) : r[c.key])
                              )}
                            </td>
                          ))}
                          <td>
                            <button
                              className="rpt-eye-btn"
                              onClick={() => setEyeRow(r)}
                              aria-label="View details"
                            >
                              👁
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {activeKey !== "movementHistory" && (
        <EyeModal
          report={report}
          row={eyeRow}
          onClose={() => setEyeRow(null)}
        />
      )}
    </>
  );
}