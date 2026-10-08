import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./Scrap.css";

// =========================================================================
// SCRAP — BACKEND INTEGRATED
// -------------------------------------------------------------------------
// Backend endpoints expected:
//
// GET    /erp/material/scrap/po-items/
// GET    /erp/material/scrap/
// POST   /erp/material/scrap/
// GET    /erp/material/scrap/<id>/
// PATCH  /erp/material/scrap/<id>/
// DELETE /erp/material/scrap/<id>/
// GET    /erp/material/scrap/dashboard/
//
// The backend generates Scrap IDs such as SCR-001, SCR-002...
// Do NOT generate Scrap IDs in React.
// =========================================================================

const API_BASE = "/erp/material";

const SCRAP_PO_ITEMS_URL = `${API_BASE}/scrap/po-items/`;
const SCRAP_URL = `${API_BASE}/scrap/`;
const SCRAP_DASHBOARD_URL = `${API_BASE}/scrap/dashboard/`;
const PROJECTS_URL = `${API_BASE}/projects/`;

const PROCESSES = [
  "Cutting",
  "Fit-up",
  "Welding",
  "Grinding",
  "Painting",
  "Inspection",
  "NDT",
  "Job Work",
  "Other",
];

const SCRAP_TYPES = [
  "Cutting Scrap",
  "Material Damage",
  "Rejected Material",
  "Production Scrap",
  "Job Work Scrap",
  "Excess Material",
  "Other",
];

const SCRAP_REASONS = [
  "Cutting leftover",
  "Damaged during handling",
  "Production rejection",
  "QC rejection",
  "Job work damage",
  "Excess material",
  "Other",
];

const SCRAP_LOCATIONS = [
  "Unit 1",
  "Unit 2",
  "Scrap Yard",
  "Other",
];

const QUANTITY_UNITS = [
  "Nos",
  "Kg",
  "Ton",
  "Meter",
  "Piece",
];

const WEIGHT_UNITS = [
  "Kg",
  "Ton",
];

const today = () => new Date().toISOString().slice(0, 10);

const dash = (value) =>
  value === undefined || value === null || value === "" ? "—" : value;

function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (data && typeof data === "object") {
    const first = Object.values(data)
      .flat(Infinity)
      .find((value) => typeof value === "string");

    if (first) {
      return first;
    }
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
}

function authConfig(accessToken) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

// =========================================================================
// Backend → Frontend PO ITEM
// =========================================================================

function normalizePoItem(item) {
  return {
    id: item.id,

    poNumber: item.po_number ?? "",
    poDate: item.po_date ?? "",
    supplier: item.supplier ?? "",

    description: item.description ?? "",

    material: item.material ?? "",
    materialCode: item.material_code ?? "",
    materialSpec: item.material_spec ?? "",

    quantity: item.quantity ?? "",
    unit: item.unit ?? "",
    unitWeight: item.unit_weight ?? "",

    length: item.length ?? "",
    width: item.width ?? "",
    thickness: item.thickness ?? "",

    // Kept for compatibility with the existing UI.
    // The backend is the source of truth.
    poKey: String(item.id),
  };
}

// =========================================================================
// Backend → Frontend PROJECT
// =========================================================================

function normalizeProject(project) {
  return {
    id: project.id,
    name: project.name ?? "",
    code: project.code ?? "",
    description: project.description ?? "",
    status: project.status ?? "",
  };
}

// =========================================================================
// Backend → Frontend SCRAP RECORD
// =========================================================================

function normalizeScrap(record) {
  const poItem = record.purchase_order_item || {};

  return {
    id: record.id,

    scrapId: record.scrap_id ?? "",

    // Backend view currently returns po_item_id.
    poItemId:
      record.po_item_id ??
      poItem.id ??
      null,

    poNumber: record.po_number ?? "",
    poDate: record.po_date ?? "",
    supplier: record.supplier ?? "",

    poDescription:
      record.description ??
      poItem.description ??
      "",

    material:
      record.material ??
      poItem.material ??
      "",

    materialCode:
      record.material_code ??
      poItem.material_code ??
      "",

    materialSpec:
      record.material_spec ??
      poItem.material_spec ??
      "",

    unitWeight:
      record.unit_weight ??
      poItem.unit_weight ??
      "",

    length:
      record.length ??
      poItem.length ??
      "",

    width:
      record.width ??
      poItem.width ??
      "",

    thickness:
      record.thickness ??
      poItem.thickness ??
      "",

    // The backend model/view returns project as a display value.
    projectId:
      record.project_id ??
      record.project?.id ??
      null,

    project:
      typeof record.project === "string"
        ? record.project
        : record.project?.name ?? "",

    projectCode:
      record.project_code ??
      record.project?.code ??
      "",

    process: record.process ?? "",
    scrapType: record.scrap_type ?? "",

    quantity:
      record.quantity === null || record.quantity === undefined
        ? ""
        : Number(record.quantity),

    quantityUnit: record.quantity_unit ?? "",

    weight:
      record.weight === null || record.weight === undefined
        ? ""
        : Number(record.weight),

    weightUnit: record.weight_unit ?? "",

    reason: record.reason ?? "",
    date: record.scrap_date ?? "",

    location: record.location ?? "",
    remarks: record.remarks ?? "",

    createdBy:
      typeof record.created_by === "string"
        ? record.created_by
        : record.created_by?.username ?? "",

    createdDate: record.created_at
      ? String(record.created_at).slice(0, 10)
      : "",

    createdAt: record.created_at ?? "",
    updatedAt: record.updated_at ?? "",
  };
}

// =========================================================================
// Dimensions
// =========================================================================

function dimensionText(row) {
  const length = row.length;
  const width = row.width;
  const thickness = row.thickness;

  if (length && width && thickness) {
    return `${thickness} × ${length} × ${width}`;
  }

  if (length && width) {
    return `${length} × ${width}`;
  }

  if (thickness) {
    return String(thickness);
  }

  return "—";
}

// =========================================================================
// Empty forms
// =========================================================================

function emptyCreateForm() {
  return {
    poItemId: "",
    projectId: "",

    process: "",
    processOther: "",

    scrapType: "",
    scrapTypeOther: "",

    quantity: "",
    quantityUnit: "Nos",

    weight: "",
    weightUnit: "Kg",

    reason: "",
    reasonOther: "",

    date: today(),

    location: "",
    locationOther: "",

    remarks: "",
  };
}

function emptyEditForm(record) {
  return {
    projectId: record.projectId ?? "",

    process: record.process ?? "",
    processOther: "",

    scrapType: record.scrapType ?? "",
    scrapTypeOther: "",

    quantity: record.quantity ?? "",
    quantityUnit: record.quantityUnit || "Nos",

    weight: record.weight ?? "",
    weightUnit: record.weightUnit || "Kg",

    reason: record.reason ?? "",
    reasonOther: "",

    date: record.date ?? today(),

    location: record.location ?? "",

    remarks: record.remarks ?? "",
  };
}

// =========================================================================
// Other helpers
// =========================================================================

function resolveOther(value, otherValue) {
  if (value === "Other") {
    return otherValue.trim();
  }

  return value;
}

function validPositiveNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0;
}

// =========================================================================
// Small components
// =========================================================================

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-box ${wide ? "modal-box-wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 className="modal-title">{title}</h3>

            {subtitle && (
              <p className="modal-subtitle">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="confirm-overlay"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="confirm-box"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon">
          <AlertTriangle size={20} strokeWidth={1.8} />
        </div>

        <h3 className="confirm-title">
          {title}
        </h3>

        {message && (
          <p className="confirm-message">
            {message}
          </p>
        )}

        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }) {
  return (
    <div className={`kpi-card ${tone ? `kpi-${tone}` : ""}`}>
      <span className="kpi-label">
        {label}
      </span>

      <span className="kpi-value">
        {value}
      </span>

      {sub && (
        <span className="kpi-sub">
          {sub}
        </span>
      )}
    </div>
  );
}

// =========================================================================
// Export helpers
// =========================================================================

const EXPORT_COLUMNS = [
  ["scrapId", "Scrap ID"],
  ["poNumber", "PO Number"],
  ["poDescription", "PO Description"],
  ["supplier", "Supplier"],
  ["project", "Project"],
  ["process", "Process"],
  ["material", "Material"],
  ["materialCode", "Material Code"],
  ["materialSpec", "Material Spec"],
  ["thickness", "Thickness"],
  ["size", "Size"],
  ["scrapType", "Scrap Type"],
  ["quantity", "Scrap Quantity"],
  ["quantityUnit", "Quantity Unit"],
  ["weight", "Scrap Weight"],
  ["weightUnit", "Weight Unit"],
  ["reason", "Scrap Reason"],
  ["date", "Scrap Date"],
  ["location", "Scrap Location"],
  ["remarks", "Remarks"],
  ["createdBy", "Created By"],
];

function buildExportRows(rows) {
  return rows.map((row) => ({
    scrapId: row.scrapId || "—",
    poNumber: row.poNumber || "—",
    poDescription: row.poDescription || "—",
    supplier: row.supplier || "—",
    project: row.project || "—",
    process: row.process || "—",
    material: row.material || "—",
    materialCode: row.materialCode || "—",
    materialSpec: row.materialSpec || "—",
    thickness: row.thickness || "—",
    size: dimensionText(row),
    scrapType: row.scrapType || "—",
    quantity: row.quantity || "—",
    quantityUnit: row.quantity ? row.quantityUnit : "—",
    weight: row.weight || "—",
    weightUnit: row.weight ? row.weightUnit : "—",
    reason: row.reason || "—",
    date: row.date || "—",
    location: row.location || "—",
    remarks: row.remarks || "—",
    createdBy: row.createdBy || "—",
  }));
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function exportExcel(rows) {
  const data = buildExportRows(rows);

  const headHtml = EXPORT_COLUMNS
    .map(([, label]) => `<th>${label}</th>`)
    .join("");

  const bodyHtml = data
    .map(
      (row) =>
        `<tr>${EXPORT_COLUMNS
          .map(
            ([key]) =>
              `<td>${String(row[key] ?? "—")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
      </head>

      <body>
        <table border="1">
          <thead>
            <tr>${headHtml}</tr>
          </thead>

          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  downloadBlob(
    html,
    `Scrap_Report_${today()}.xls`,
    "application/vnd.ms-excel",
  );
}

function exportPdf(rows, filters, totals) {
  const data = buildExportRows(rows);

  const columns = [
    "scrapId",
    "poNumber",
    "poDescription",
    "project",
    "process",
    "material",
    "scrapType",
    "quantity",
    "weight",
    "reason",
    "date",
    "location",
  ];

  const labels = Object.fromEntries(EXPORT_COLUMNS);

  const headHtml = columns
    .map((column) => `<th>${labels[column]}</th>`)
    .join("");

  const bodyHtml = data
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => {
            if (column === "quantity") {
              return `<td>${row.quantity} ${
                row.quantityUnit !== "—"
                  ? row.quantityUnit
                  : ""
              }</td>`;
            }

            if (column === "weight") {
              return `<td>${row.weight} ${
                row.weightUnit !== "—"
                  ? row.weightUnit
                  : ""
              }</td>`;
            }

            return `<td>${String(
              row[column] ?? "—",
            )}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");

  const filterText = [
    filters.search
      ? `Search: "${filters.search}"`
      : "",
    filters.poItemId
      ? `PO Item: ${filters.poItemId}`
      : "",
    filters.project
      ? `Project: ${filters.project}`
      : "",
    filters.process
      ? `Process: ${filters.process}`
      : "",
    filters.material
      ? `Material: ${filters.material}`
      : "",
    filters.scrapType
      ? `Scrap Type: ${filters.scrapType}`
      : "",
    filters.reason
      ? `Reason: ${filters.reason}`
      : "",
    filters.location
      ? `Location: ${filters.location}`
      : "",
    filters.dateFrom
      ? `From: ${filters.dateFrom}`
      : "",
    filters.dateTo
      ? `To: ${filters.dateTo}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ") || "None";

  const win = window.open("", "_blank");

  if (!win) {
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>Scrap Report</title>

        <style>
          @page {
            size: landscape;
            margin: 14mm;
          }

          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
          }

          h1 {
            font-size: 16px;
            margin: 0;
          }

          h2 {
            font-size: 13px;
            margin: 2px 0 12px;
            color: #4b5563;
            font-weight: 600;
          }

          .meta {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 14px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }

          th,
          td {
            border: 1px solid #d1d5db;
            padding: 5px 7px;
            text-align: left;
          }

          th {
            background: #f3f4f6;
          }

          .totals {
            margin-top: 14px;
            font-size: 12px;
            font-weight: 600;
          }
        </style>
      </head>

      <body>
        <h1>MATERIAL MANAGEMENT ERP</h1>
        <h2>SCRAP REPORT</h2>

        <div class="meta">
          Generated: ${new Date().toLocaleString()}<br />
          Active Filters: ${filterText}
        </div>

        <table>
          <thead>
            <tr>${headHtml}</tr>
          </thead>

          <tbody>
            ${bodyHtml}
          </tbody>
        </table>

        <div class="totals">
          Total Scrap Records: ${rows.length}<br />
          ${
            totals.weightKg > 0
              ? `Total Weight: ${totals.weightKg.toFixed(2)} Kg<br />`
              : ""
          }
          ${
            totals.pieces > 0
              ? `Total Pieces: ${totals.pieces} Nos<br />`
              : ""
          }
        </div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();

  setTimeout(() => {
    win.print();
  }, 300);
}

// =========================================================================
// Main component
// =========================================================================


function SearchablePoItemSelect({ items, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === String(value)),
    [items, value],
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return items.slice(0, 50);
    }

    return items
      .filter((item) =>
        [
          item.poNumber,
          item.description,
          item.material,
          item.materialCode,
          item.materialSpec,
          item.supplier,
        ].some((field) =>
          String(field ?? "").toLowerCase().includes(term),
        ),
      )
      .slice(0, 50);
  }, [items, searchTerm]);

  function selectItem(item) {
    onChange(String(item.id));
    setSearchTerm("");
    setOpen(false);
  }

  function clearSelection(event) {
    event.stopPropagation();
    onChange("");
    setSearchTerm("");
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((previous) => !previous)}
        style={{
          width: "100%",
          minHeight: "42px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 12px",
          border: "1px solid var(--border-color, #d9dee7)",
          borderRadius: "8px",
          background: "var(--input-bg, #fff)",
          color: selectedItem ? "inherit" : "#8a93a3",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedItem
            ? `${selectedItem.poNumber || "PO"} — ${selectedItem.description || "No description"}`
            : "Search and select PO Description"}
        </span>

        {selectedItem && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear selected PO"
            onClick={clearSelection}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                clearSelection(event);
              }
            }}
            style={{
              display: "inline-flex",
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
            }}
          >
            <X size={15} />
          </span>
        ) : (
          <span style={{ flexShrink: 0, fontSize: "12px" }}>
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            zIndex: 1000,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            padding: "8px",
            border: "1px solid var(--border-color, #d9dee7)",
            borderRadius: "10px",
            background: "var(--card-bg, #fff)",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.14)",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "10px",
                pointerEvents: "none",
                opacity: 0.65,
              }}
            />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="Search PO number, description, material..."
              style={{
                width: "100%",
                minHeight: "40px",
                padding: "9px 10px 9px 34px",
                border: "1px solid var(--border-color, #d9dee7)",
                borderRadius: "8px",
                outline: "none",
                background: "var(--input-bg, #fff)",
                color: "inherit",
              }}
            />
          </div>

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isSelected =
                  String(item.id) === String(value);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 11px",
                      border: "0",
                      borderRadius: "7px",
                      background: isSelected
                        ? "rgba(37, 99, 235, 0.10)"
                        : "transparent",
                      color: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "13px",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.poNumber || "PO"}
                      {item.description ? ` — ${item.description}` : ""}
                    </div>

                    <div
                      style={{
                        marginTop: "3px",
                        fontSize: "12px",
                        opacity: 0.7,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.material || "Material not specified"}
                      {item.materialCode
                        ? ` • ${item.materialCode}`
                        : ""}
                      {item.supplier ? ` • ${item.supplier}` : ""}
                    </div>
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  padding: "18px 12px",
                  textAlign: "center",
                  fontSize: "13px",
                  opacity: 0.7,
                }}
              >
                No matching PO items found.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "7px",
              padding: "4px 5px 0",
              fontSize: "11px",
              opacity: 0.6,
            }}
          >
            {searchTerm.trim()
              ? `Showing up to ${filteredItems.length} matching result${filteredItems.length === 1 ? "" : "s"}.`
              : `Showing the latest ${Math.min(items.length, 50)} PO items. Use search to find others.`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Scrap() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  // -----------------------------------------------------------------------
  // Backend data
  // -----------------------------------------------------------------------

  const [poItems, setPoItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [records, setRecords] = useState([]);

  // -----------------------------------------------------------------------
  // Loading / errors
  // -----------------------------------------------------------------------

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------

  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    poItemId: "",
    project: "",
    process: "",
    material: "",
    scrapType: "",
    reason: "",
    location: "",
    dateFrom: "",
    dateTo: "",
  });

  const [filtersOpen, setFiltersOpen] = useState(true);

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(
    emptyCreateForm(),
  );
  const [createError, setCreateError] = useState("");

  // -----------------------------------------------------------------------
  // View
  // -----------------------------------------------------------------------

  const [viewRecord, setViewRecord] = useState(null);

  // -----------------------------------------------------------------------
  // Edit
  // -----------------------------------------------------------------------

  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const [deleteTarget, setDeleteTarget] = useState(null);

  // =========================================================================
  // Fetch
  // =========================================================================

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        setPageError(
          "Your session has expired. Please login again.",
        );
        setIsLoading(false);
        return;
      }

      try {
        if (!silent) {
          setIsLoading(true);
        }

        setPageError("");

        const config = authConfig(accessToken);

        const [poResponse, scrapResponse, projectResponse] =
          await Promise.all([
            api.get(
              SCRAP_PO_ITEMS_URL,
              config,
            ),

            api.get(
              SCRAP_URL,
              config,
            ),

            api.get(
              PROJECTS_URL,
              config,
            ),
          ]);

        // ---------------------------------------------------------------
        // PO ITEMS
        // ---------------------------------------------------------------

        const poData = Array.isArray(poResponse.data)
          ? poResponse.data
          : Array.isArray(poResponse.data?.data)
            ? poResponse.data.data
            : [];

        setPoItems(
          poData.map(normalizePoItem),
        );

        // ---------------------------------------------------------------
        // SCRAP
        // ---------------------------------------------------------------

        const scrapData = Array.isArray(scrapResponse.data)
          ? scrapResponse.data
          : Array.isArray(scrapResponse.data?.data)
            ? scrapResponse.data.data
            : [];

        setRecords(
          scrapData.map(normalizeScrap),
        );

        // ---------------------------------------------------------------
        // PROJECTS
        // ---------------------------------------------------------------

        const projectData = Array.isArray(projectResponse.data)
          ? projectResponse.data
          : Array.isArray(projectResponse.data?.data)
            ? projectResponse.data.data
            : [];

        setProjects(
          projectData.map(normalizeProject),
        );
      } catch (error) {
        console.error(
          "Failed to load Scrap data:",
          error,
        );

        setPageError(
          getApiError(
            error,
            "Failed to load Scrap data.",
          ),
        );
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================================================================
  // Derived
  // =========================================================================

  const poItemMap = useMemo(
    () =>
      new Map(
        poItems.map((item) => [
          String(item.id),
          item,
        ]),
      ),
    [poItems],
  );

  const projectMap = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          String(project.id),
          project,
        ]),
      ),
    [projects],
  );

  const rows = useMemo(
    () =>
      records.map((record) => {
        const poItem = poItemMap.get(
          String(record.poItemId),
        );

        const project = projectMap.get(
          String(record.projectId),
        );

        return {
          ...record,

          poNumber:
            record.poNumber ||
            poItem?.poNumber ||
            "—",

          poDescription:
            record.poDescription ||
            poItem?.description ||
            "—",

          supplier:
            record.supplier ||
            poItem?.supplier ||
            "—",

          material:
            record.material ||
            poItem?.material ||
            "—",

          materialCode:
            record.materialCode ||
            poItem?.materialCode ||
            "—",

          materialSpec:
            record.materialSpec ||
            poItem?.materialSpec ||
            "—",

          length:
            record.length ||
            poItem?.length ||
            "",

          width:
            record.width ||
            poItem?.width ||
            "",

          thickness:
            record.thickness ||
            poItem?.thickness ||
            "",

          project:
            record.project ||
            project?.name ||
            "—",

          projectCode:
            record.projectCode ||
            project?.code ||
            "",

          poUnit:
            poItem?.unit ||
            "—",
        };
      }),
    [records, poItemMap, projectMap],
  );

  const materialOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.material)
            .filter(
              (value) =>
                value &&
                value !== "—",
            ),
        ),
      ].sort(),
    [rows],
  );

  const projectOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.project)
            .filter(
              (value) =>
                value &&
                value !== "—",
            ),
        ),
      ].sort(),
    [rows],
  );

  const processOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.process)
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  const scrapTypeOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.scrapType)
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  const reasonOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.reason)
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  const locationOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.location)
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  // =========================================================================
  // Filter rows
  // =========================================================================

  const filteredRows = useMemo(() => {
    const needle = search
      .trim()
      .toLowerCase();

    return rows.filter((row) => {
      if (
        filters.poItemId &&
        String(row.poItemId) !==
          String(filters.poItemId)
      ) {
        return false;
      }

      if (
        filters.project &&
        row.project !== filters.project
      ) {
        return false;
      }

      if (
        filters.process &&
        row.process !== filters.process
      ) {
        return false;
      }

      if (
        filters.material &&
        row.material !== filters.material
      ) {
        return false;
      }

      if (
        filters.scrapType &&
        row.scrapType !== filters.scrapType
      ) {
        return false;
      }

      if (
        filters.reason &&
        row.reason !== filters.reason
      ) {
        return false;
      }

      if (
        filters.location &&
        row.location !== filters.location
      ) {
        return false;
      }

      if (
        filters.dateFrom &&
        row.date < filters.dateFrom
      ) {
        return false;
      }

      if (
        filters.dateTo &&
        row.date > filters.dateTo
      ) {
        return false;
      }

      if (needle) {
        const haystack = [
          row.scrapId,
          row.poNumber,
          row.poDescription,
          row.supplier,
          row.project,
          row.process,
          row.material,
          row.materialCode,
          row.scrapType,
          row.reason,
          row.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [
    rows,
    filters,
    search,
  ]);

  // =========================================================================
  // KPIs
  // =========================================================================

  const totals = useMemo(() => {
    const weightKg =
      filteredRows.reduce(
        (sum, row) => {
          const weight =
            Number(row.weight) || 0;

          if (!weight) {
            return sum;
          }

          return (
            sum +
            (row.weightUnit === "Ton"
              ? weight * 1000
              : weight)
          );
        },
        0,
      );

    const pieces =
      filteredRows
        .filter(
          (row) =>
            row.quantityUnit === "Nos" ||
            row.quantityUnit === "Piece",
        )
        .reduce(
          (sum, row) =>
            sum +
            (Number(row.quantity) || 0),
          0,
        );

    const thisMonthKey =
      today().slice(0, 7);

    const thisMonth =
      filteredRows.filter(
        (row) =>
          String(row.date || "")
            .slice(0, 7) ===
          thisMonthKey,
      ).length;

    return {
      count: filteredRows.length,
      weightKg,
      pieces,
      thisMonth,
    };
  }, [filteredRows]);

  // =========================================================================
  // Handlers
  // =========================================================================

  function handleBack() {
    navigate("/inventory/material");
  }

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await fetchData({
        silent: true,
      });
    } finally {
      setRefreshing(false);
    }
  }

  function clearFilters() {
    setFilters({
      poItemId: "",
      project: "",
      process: "",
      material: "",
      scrapType: "",
      reason: "",
      location: "",
      dateFrom: "",
      dateTo: "",
    });

    setSearch("");
  }

  // =========================================================================
  // CREATE
  // =========================================================================

  function openCreate() {
    setCreateForm(
      emptyCreateForm(),
    );

    setCreateError("");
    setShowCreate(true);
  }

  const selectedCreatePoItem =
    createForm.poItemId
      ? poItemMap.get(
          String(createForm.poItemId),
        )
      : null;

  async function submitCreate(event) {
    event.preventDefault();

    setCreateError("");

    if (!createForm.poItemId) {
      setCreateError(
        "Please select a PO Description.",
      );
      return;
    }

    if (!createForm.projectId) {
      setCreateError(
        "Please select a project.",
      );
      return;
    }

    const process =
      resolveOther(
        createForm.process,
        createForm.processOther,
      );

    if (!process) {
      setCreateError(
        "Please select the process the scrap came from.",
      );
      return;
    }

    const scrapType =
      resolveOther(
        createForm.scrapType,
        createForm.scrapTypeOther,
      );

    if (!scrapType) {
      setCreateError(
        "Please select a scrap type.",
      );
      return;
    }

    if (
      !createForm.quantity &&
      !createForm.weight
    ) {
      setCreateError(
        "Please enter scrap quantity or weight.",
      );
      return;
    }

    if (
      createForm.quantity &&
      !validPositiveNumber(
        createForm.quantity,
      )
    ) {
      setCreateError(
        "Quantity must be greater than zero.",
      );
      return;
    }

    if (
      createForm.weight &&
      !validPositiveNumber(
        createForm.weight,
      )
    ) {
      setCreateError(
        "Weight must be greater than zero.",
      );
      return;
    }

    if (
      createForm.quantity &&
      !createForm.quantityUnit
    ) {
      setCreateError(
        "Please select a quantity unit.",
      );
      return;
    }

    if (
      createForm.weight &&
      !createForm.weightUnit
    ) {
      setCreateError(
        "Please select a weight unit.",
      );
      return;
    }

    const reason =
      resolveOther(
        createForm.reason,
        createForm.reasonOther,
      );

    if (!reason) {
      setCreateError(
        "Please select a scrap reason.",
      );
      return;
    }

    if (!createForm.date) {
      setCreateError(
        "Please select a scrap date.",
      );
      return;
    }

    const location =
      createForm.location === "Other"
        ? createForm.locationOther.trim()
        : createForm.location;

    if (!location) {
      setCreateError(
        "Please select or enter a scrap location.",
      );
      return;
    }

    const payload = {
      po_item_id: Number(
        createForm.poItemId,
      ),

      project_id: Number(
        createForm.projectId,
      ),

      process,

      scrap_type: scrapType,

      quantity:
        createForm.quantity !== ""
          ? Number(
              createForm.quantity,
            )
          : null,

      quantity_unit:
        createForm.quantity
          ? createForm.quantityUnit
          : null,

      weight:
        createForm.weight !== ""
          ? Number(
              createForm.weight,
            )
          : null,

      weight_unit:
        createForm.weight
          ? createForm.weightUnit
          : null,

      reason,

      scrap_date:
        createForm.date,

      location,

      remarks:
        createForm.remarks.trim(),
    };

    try {
      setSaving(true);

      const response =
        await api.post(
          SCRAP_URL,
          payload,
          authConfig(accessToken),
        );

      const createdData =
        response.data?.data ||
        response.data;

      if (createdData) {
        const createdRecord =
          normalizeScrap(
            createdData,
          );

        setRecords((previous) => [
          createdRecord,
          ...previous.filter(
            (record) =>
              record.id !==
              createdRecord.id,
          ),
        ]);
      }

      setShowCreate(false);
      setCreateForm(
        emptyCreateForm(),
      );
      setCreateError("");

      // Refresh to make the database
      // the final source of truth.
      await fetchData({
        silent: true,
      });
    } catch (error) {
      console.error(
        "Failed to create Scrap:",
        error,
      );

      setCreateError(
        getApiError(
          error,
          "Failed to create Scrap.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================================
  // VIEW
  // =========================================================================

  function openView(record) {
    setViewRecord(record);
  }

  // =========================================================================
  // EDIT
  // =========================================================================

  function openEdit(record) {
    setEditRecord(record);

    setEditForm(
      emptyEditForm(record),
    );

    setEditError("");
  }

  async function submitEdit(event) {
    event.preventDefault();

    if (!editRecord || !editForm) {
      return;
    }

    setEditError("");

    if (!editForm.projectId) {
      setEditError(
        "Please select a project.",
      );
      return;
    }

    const process =
      resolveOther(
        editForm.process,
        editForm.processOther,
      );

    if (!process) {
      setEditError(
        "Please select a process.",
      );
      return;
    }

    const scrapType =
      resolveOther(
        editForm.scrapType,
        editForm.scrapTypeOther,
      );

    if (!scrapType) {
      setEditError(
        "Please select a scrap type.",
      );
      return;
    }

    if (
      !editForm.quantity &&
      !editForm.weight
    ) {
      setEditError(
        "Please enter scrap quantity or weight.",
      );
      return;
    }

    if (
      editForm.quantity &&
      !validPositiveNumber(
        editForm.quantity,
      )
    ) {
      setEditError(
        "Quantity must be greater than zero.",
      );
      return;
    }

    if (
      editForm.weight &&
      !validPositiveNumber(
        editForm.weight,
      )
    ) {
      setEditError(
        "Weight must be greater than zero.",
      );
      return;
    }

    const reason =
      resolveOther(
        editForm.reason,
        editForm.reasonOther,
      );

    if (!reason) {
      setEditError(
        "Please select a scrap reason.",
      );
      return;
    }

    if (!editForm.date) {
      setEditError(
        "Please select a scrap date.",
      );
      return;
    }

    if (!editForm.location) {
      setEditError(
        "Please select a scrap location.",
      );
      return;
    }

    const payload = {
      project_id: Number(
        editForm.projectId,
      ),

      process,

      scrap_type: scrapType,

      quantity:
        editForm.quantity !== ""
          ? Number(
              editForm.quantity,
            )
          : null,

      quantity_unit:
        editForm.quantity
          ? editForm.quantityUnit
          : null,

      weight:
        editForm.weight !== ""
          ? Number(
              editForm.weight,
            )
          : null,

      weight_unit:
        editForm.weight
          ? editForm.weightUnit
          : null,

      reason,

      scrap_date:
        editForm.date,

      location:
        editForm.location,

      remarks:
        editForm.remarks.trim(),
    };

    try {
      setSaving(true);

      const response =
        await api.patch(
          `${SCRAP_URL}${editRecord.id}/`,
          payload,
          authConfig(accessToken),
        );

      const updatedData =
        response.data?.data ||
        response.data;

      if (updatedData?.scrap_id) {
        const updated =
          normalizeScrap(
            updatedData,
          );

        setRecords((previous) =>
          previous.map(
            (record) =>
              record.id ===
              editRecord.id
                ? {
                    ...record,
                    ...updated,
                  }
                : record,
          ),
        );
      }

      setEditRecord(null);
      setEditForm(null);
      setEditError("");

      await fetchData({
        silent: true,
      });
    } catch (error) {
      console.error(
        "Failed to update Scrap:",
        error,
      );

      setEditError(
        getApiError(
          error,
          "Failed to update Scrap.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================================
  // DELETE
  // =========================================================================

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleteLoading(true);

      await api.delete(
        `${SCRAP_URL}${deleteTarget.id}/`,
        authConfig(accessToken),
      );

      setRecords((previous) =>
        previous.filter(
          (record) =>
            record.id !==
            deleteTarget.id,
        ),
      );

      setDeleteTarget(null);
    } catch (error) {
      console.error(
        "Failed to delete Scrap:",
        error,
      );

      window.alert(
        getApiError(
          error,
          "Failed to delete Scrap.",
        ),
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <>
      <Header />

      <div className="material-page">
        <div className="material-content">

          {/* =============================================================
              HEADER
          ============================================================= */}

          <div className="page-header-wrap">
            <div className="page-header-left">

              <button
                type="button"
                className="back-button"
                onClick={handleBack}
              >
                <ArrowLeft
                  size={16}
                  strokeWidth={2}
                />
                Back
              </button>

              <div className="page-header-title-group">
                <h1 className="page-header-title">
                  Scrap
                </h1>

                <p className="page-header-subtitle">
                  Create scrap directly from a
                  Purchase Order — select the PO,
                  verify the material information,
                  and record only the
                  scrap-specific details.
                </p>
              </div>
            </div>

            <div className="page-header-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRefresh}
                disabled={
                  refreshing ||
                  isLoading
                }
              >
                <RefreshCw
                  size={14}
                  className={
                    refreshing
                      ? "spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>

          {/* =============================================================
              LOADING
          ============================================================= */}

          {isLoading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {/* =============================================================
              ERROR
          ============================================================= */}

          {!isLoading &&
            pageError && (
              <div className="grn-state-block">
                <Error
                  onRetry={() =>
                    fetchData()
                  }
                />

                <p
                  className="form-error-text"
                  style={{
                    textAlign: "center",
                  }}
                >
                  {pageError}
                </p>
              </div>
            )}

          {!isLoading &&
            !pageError && (
              <>
                {/* =======================================================
                    KPI
                ======================================================= */}

                <div className="kpi-grid">
                  <KpiCard
                    label="Total Scrap Records"
                    value={totals.count}
                  />

                  <KpiCard
                    label="Total Weight"
                    value={`${totals.weightKg.toFixed(
                      2,
                    )} Kg`}
                    tone="blue"
                  />

                  <KpiCard
                    label="Total Pieces"
                    value={`${totals.pieces} Nos`}
                    tone="purple"
                  />

                  <KpiCard
                    label="This Month"
                    value={totals.thisMonth}
                    tone="green"
                  />
                </div>

                {/* =======================================================
                    TABLE PANEL
                ======================================================= */}

                <div className="panel">

                  <div className="panel-head">
                    <div>
                      <div className="panel-head-title">
                        Scrap Records
                      </div>

                      <p className="panel-head-subtitle">
                        Every record is tied to
                        its source PO — nothing
                        here is added back to
                        Material Stock.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={openCreate}
                    >
                      <Plus size={15} />
                      Create Scrap
                    </button>
                  </div>

                  {/* =====================================================
                      TOOLBAR
                  ===================================================== */}

                  <div className="panel-toolbar">

                    <div className="panel-toolbar-search">
                      <Search size={14} />

                      <input
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value,
                          )
                        }
                        placeholder="Search Scrap ID, PO, Material, Reason..."
                      />
                    </div>

                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${
                        filtersOpen
                          ? "btn-outline-active"
                          : ""
                      }`}
                      onClick={() =>
                        setFiltersOpen(
                          (value) =>
                            !value,
                        )
                      }
                    >
                      {filtersOpen
                        ? "Hide Filters"
                        : "Show Filters"}
                    </button>

                    <button
                      type="button"
                      className="btn-link"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </button>

                    <div className="export-actions">

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          exportExcel(
                            filteredRows,
                          )
                        }
                      >
                        <FileSpreadsheet
                          size={14}
                        />
                        Export Excel
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          exportPdf(
                            filteredRows,
                            {
                              ...filters,
                              search,
                            },
                            totals,
                          )
                        }
                      >
                        <FileText size={14} />
                        Download PDF
                      </button>

                    </div>
                  </div>

                  {/* =====================================================
                      FILTERS
                  ===================================================== */}

                  {filtersOpen && (
                    <div className="filters-grid">

                      <div className="form-field">
                        <label>
                          PO Number
                        </label>

                        <select
                          value={
                            filters.poItemId
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                poItemId:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All POs
                          </option>

                          {poItems.map(
                            (item) => (
                              <option
                                key={item.id}
                                value={item.id}
                              >
                                {item.poNumber}
                                {" — "}
                                {
                                  item.description
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Project
                        </label>

                        <select
                          value={
                            filters.project
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                project:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All Projects
                          </option>

                          {projectOptions.map(
                            (project) => (
                              <option
                                key={project}
                                value={project}
                              >
                                {project}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Process
                        </label>

                        <select
                          value={
                            filters.process
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                process:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All Processes
                          </option>

                          {(processOptions.length
                            ? processOptions
                            : PROCESSES
                          ).map(
                            (process) => (
                              <option
                                key={process}
                                value={process}
                              >
                                {process}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Material
                        </label>

                        <select
                          value={
                            filters.material
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                material:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All Materials
                          </option>

                          {materialOptions.map(
                            (material) => (
                              <option
                                key={material}
                                value={material}
                              >
                                {material}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Scrap Type
                        </label>

                        <select
                          value={
                            filters.scrapType
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                scrapType:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All Types
                          </option>

                          {(scrapTypeOptions.length
                            ? scrapTypeOptions
                            : SCRAP_TYPES
                          ).map(
                            (type) => (
                              <option
                                key={type}
                                value={type}
                              >
                                {type}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Scrap Reason
                        </label>

                        <select
                          value={
                            filters.reason
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                reason:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All Reasons
                          </option>

                          {(reasonOptions.length
                            ? reasonOptions
                            : SCRAP_REASONS
                          ).map(
                            (reason) => (
                              <option
                                key={reason}
                                value={reason}
                              >
                                {reason}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Location
                        </label>

                        <select
                          value={
                            filters.location
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                location:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            All Locations
                          </option>

                          {(locationOptions.length
                            ? locationOptions
                            : SCRAP_LOCATIONS
                          ).map(
                            (location) => (
                              <option
                                key={location}
                                value={location}
                              >
                                {location}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label>
                          Date From
                        </label>

                        <input
                          type="date"
                          value={
                            filters.dateFrom
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                dateFrom:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </div>

                      <div className="form-field">
                        <label>
                          Date To
                        </label>

                        <input
                          type="date"
                          value={
                            filters.dateTo
                          }
                          onChange={(event) =>
                            setFilters(
                              (previous) => ({
                                ...previous,
                                dateTo:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* =====================================================
                      TABLE
                  ===================================================== */}

                  <div className="table-scroll-wrapper">
                    <table className="data-table">

                      <thead>
                        <tr>
                          <th>Scrap ID</th>
                          <th>PO Number</th>
                          <th>PO Description</th>
                          <th>Supplier</th>
                          <th>Project</th>
                          <th>Process</th>
                          <th>Material</th>
                          <th>Thickness</th>
                          <th>Size</th>
                          <th>Scrap Type</th>
                          <th>Quantity</th>
                          <th>Weight</th>
                          <th>Reason</th>
                          <th>Date</th>
                          <th>Location</th>
                          <th className="cell-action">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredRows.length ===
                          0 && (
                          <tr>
                            <td colSpan={16}>
                              <div className="empty-state">
                                <div className="empty-state-icon">
                                  🗑️
                                </div>

                                <p className="empty-state-title">
                                  No Scrap Records Found
                                </p>

                                <p className="empty-state-desc">
                                  No records match
                                  your current
                                  search /
                                  filters.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {filteredRows.map(
                          (row) => (
                            <tr
                              key={row.id}
                            >
                              <td className="cell-mono">
                                {dash(
                                  row.scrapId,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.poNumber,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.poDescription,
                                )}
                              </td>

                              <td className="cell-muted">
                                {dash(
                                  row.supplier,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.project,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.process,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.material,
                                )}
                              </td>

                              <td className="cell-mono">
                                {dash(
                                  row.thickness,
                                )}
                              </td>

                              <td className="cell-mono">
                                {dimensionText(
                                  row,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.scrapType,
                                )}
                              </td>

                              <td className="cell-num">
                                {row.quantity !==
                                  "" &&
                                row.quantity !==
                                  null
                                  ? `${row.quantity} ${row.quantityUnit}`
                                  : "—"}
                              </td>

                              <td className="cell-num">
                                {row.weight !==
                                  "" &&
                                row.weight !==
                                  null
                                  ? `${row.weight} ${row.weightUnit}`
                                  : "—"}
                              </td>

                              <td>
                                {dash(
                                  row.reason,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.date,
                                )}
                              </td>

                              <td>
                                {dash(
                                  row.location,
                                )}
                              </td>

                              <td>
                                <div className="table-row-actions">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openView(
                                        row,
                                      )
                                    }
                                    aria-label="View"
                                  >
                                    <Eye
                                      size={15}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        row,
                                      )
                                    }
                                    aria-label="Edit"
                                  >
                                    <Pencil
                                      size={14}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() =>
                                      setDeleteTarget(
                                        row,
                                      )
                                    }
                                    aria-label="Delete"
                                  >
                                    <Trash2
                                      size={14}
                                    />
                                  </button>

                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>

      {/* ===================================================================
          CREATE SCRAP
      =================================================================== */}

      <Modal
        open={showCreate}
        title="Create Scrap"
        subtitle="Select the PO item, then enter the scrap details."
        onClose={() => {
          if (!saving) {
            setShowCreate(false);
          }
        }}
        wide
      >
        <form onSubmit={submitCreate}>

          {/* =============================================================
              PO
          ============================================================= */}

          <div className="form-section-title">
            1. Select Purchase Order
          </div>

          <div className="form-grid">

            <div className="form-field form-field-full">
              <label>
                PO Number / Description{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <SearchablePoItemSelect
                items={poItems}
                value={createForm.poItemId}
                onChange={(poItemId) =>
                  setCreateForm((previous) => ({
                    ...previous,
                    poItemId,
                  }))
                }
                disabled={saving}
              />

              <span className="form-hint">
                Only confirmed Purchase
                Order items returned by the
                backend are shown.
              </span>
            </div>
          </div>

          {/* =============================================================
              PO PREVIEW
          ============================================================= */}

          {selectedCreatePoItem && (
            <div className="scrap-po-preview">

              <div className="scrap-po-preview-title">
                Selected Purchase Order
                (read-only)
              </div>

              <div className="poi-integration-grid">

                <div className="poi-kv">
                  <span>PO Number</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.poNumber,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>PO Date</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.poDate,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>PO Description</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.description,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Supplier</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.supplier,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Material</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.material,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Material Code</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.materialCode,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Material Spec</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.materialSpec,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Unit</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.unit,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>PO Quantity</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.quantity,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Unit Weight</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.unitWeight,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Length</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.length,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Width</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.width,
                    )}
                  </strong>
                </div>

                <div className="poi-kv">
                  <span>Thickness</span>
                  <strong>
                    {dash(
                      selectedCreatePoItem.thickness,
                    )}
                  </strong>
                </div>

              </div>
            </div>
          )}

          {/* =============================================================
              PROJECT / PROCESS
          ============================================================= */}

          <div className="form-section-title">
            2. Project &amp; Process
          </div>

          <div className="form-grid">

            <div className="form-field">
              <label>
                Project{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <select
                value={
                  createForm.projectId
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      projectId:
                        event.target.value,
                    }),
                  )
                }
              >
                <option value="">
                  Select project
                </option>

                {projects
                  .filter(
                    (project) =>
                      !project.status ||
                      project.status ===
                        "Active",
                  )
                  .map(
                    (project) => (
                      <option
                        key={project.id}
                        value={project.id}
                      >
                        {project.name}
                        {project.code
                          ? ` (${project.code})`
                          : ""}
                      </option>
                    ),
                  )}
              </select>
            </div>

            <div className="form-field">
              <label>
                Process{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <select
                value={
                  createForm.process
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      process:
                        event.target.value,
                    }),
                  )
                }
              >
                <option value="">
                  Select process
                </option>

                {PROCESSES.map(
                  (process) => (
                    <option
                      key={process}
                      value={process}
                    >
                      {process}
                    </option>
                  ),
                )}
              </select>
            </div>

            {createForm.process ===
              "Other" && (
              <div className="form-field form-field-full">
                <label>
                  Enter Process
                </label>

                <input
                  value={
                    createForm.processOther
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (previous) => ({
                        ...previous,
                        processOther:
                          event.target.value,
                      }),
                    )
                  }
                />
              </div>
            )}
          </div>

          {/* =============================================================
              SCRAP DETAILS
          ============================================================= */}

          <div className="form-section-title">
            3. Scrap Details
          </div>

          <div className="form-grid">

            <div className="form-field">
              <label>
                Scrap Type{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <select
                value={
                  createForm.scrapType
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      scrapType:
                        event.target.value,
                    }),
                  )
                }
              >
                <option value="">
                  Select scrap type
                </option>

                {SCRAP_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ),
                )}
              </select>
            </div>

            {createForm.scrapType ===
              "Other" && (
              <div className="form-field">
                <label>
                  Enter Scrap Type
                </label>

                <input
                  value={
                    createForm.scrapTypeOther
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (previous) => ({
                        ...previous,
                        scrapTypeOther:
                          event.target.value,
                      }),
                    )
                  }
                />
              </div>
            )}

            <div className="form-field">
              <label>
                Scrap Quantity
              </label>

              <input
                type="number"
                min="0"
                step="0.001"
                value={
                  createForm.quantity
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      quantity:
                        event.target.value,
                    }),
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>
                Quantity Unit
              </label>

              <select
                value={
                  createForm.quantityUnit
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      quantityUnit:
                        event.target.value,
                    }),
                  )
                }
              >
                {QUANTITY_UNITS.map(
                  (unit) => (
                    <option
                      key={unit}
                      value={unit}
                    >
                      {unit}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="form-field">
              <label>
                Scrap Weight
              </label>

              <input
                type="number"
                min="0"
                step="0.001"
                value={
                  createForm.weight
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      weight:
                        event.target.value,
                    }),
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>
                Weight Unit
              </label>

              <select
                value={
                  createForm.weightUnit
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      weightUnit:
                        event.target.value,
                    }),
                  )
                }
              >
                {WEIGHT_UNITS.map(
                  (unit) => (
                    <option
                      key={unit}
                      value={unit}
                    >
                      {unit}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="form-field">
              <label>
                Scrap Reason{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <select
                value={
                  createForm.reason
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      reason:
                        event.target.value,
                    }),
                  )
                }
              >
                <option value="">
                  Select reason
                </option>

                {SCRAP_REASONS.map(
                  (reason) => (
                    <option
                      key={reason}
                      value={reason}
                    >
                      {reason}
                    </option>
                  ),
                )}
              </select>
            </div>

            {createForm.reason ===
              "Other" && (
              <div className="form-field">
                <label>
                  Enter Reason
                </label>

                <input
                  value={
                    createForm.reasonOther
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (previous) => ({
                        ...previous,
                        reasonOther:
                          event.target.value,
                      }),
                    )
                  }
                />
              </div>
            )}

            <div className="form-field">
              <label>
                Scrap Date{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <input
                type="date"
                value={
                  createForm.date
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      date:
                        event.target.value,
                    }),
                  )
                }
              />
            </div>

            <div className="form-field">
              <label>
                Scrap Location{" "}
                <span className="required-mark">
                  *
                </span>
              </label>

              <select
                value={
                  createForm.location
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      location:
                        event.target.value,
                    }),
                  )
                }
              >
                <option value="">
                  Select location
                </option>

                {SCRAP_LOCATIONS.map(
                  (location) => (
                    <option
                      key={location}
                      value={location}
                    >
                      {location}
                    </option>
                  ),
                )}
              </select>
            </div>

            {createForm.location ===
              "Other" && (
              <div className="form-field">
                <label>
                  Enter Location
                </label>

                <input
                  value={
                    createForm.locationOther
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (previous) => ({
                        ...previous,
                        locationOther:
                          event.target.value,
                      }),
                    )
                  }
                />
              </div>
            )}

            <div className="form-field form-field-full">
              <label>
                Remarks
              </label>

              <textarea
                rows={3}
                placeholder="e.g. Remaining portion after cutting."
                value={
                  createForm.remarks
                }
                onChange={(event) =>
                  setCreateForm(
                    (previous) => ({
                      ...previous,
                      remarks:
                        event.target.value,
                    }),
                  )
                }
              />
            </div>
          </div>

          {createError && (
            <p className="form-error-text">
              {createError}
            </p>
          )}

          <div className="form-actions">

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setShowCreate(false)
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving
                ? "Creating..."
                : "Create Scrap"}
            </button>

          </div>
        </form>
      </Modal>

      {/* ===================================================================
          VIEW SCRAP
      =================================================================== */}

      <Modal
        open={!!viewRecord}
        title={
          viewRecord
            ? `Scrap Record • ${viewRecord.scrapId}`
            : ""
        }
        onClose={() =>
          setViewRecord(null)
        }
        wide
      >
        {viewRecord && (
          <div className="scrap-view">

            <div className="form-section-title">
              Scrap Information
            </div>

            <div className="poi-integration-grid">

              <div className="poi-kv">
                <span>Scrap ID</span>
                <strong>
                  {dash(
                    viewRecord.scrapId,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Scrap Date</span>
                <strong>
                  {dash(
                    viewRecord.date,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Scrap Type</span>
                <strong>
                  {dash(
                    viewRecord.scrapType,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Scrap Reason</span>
                <strong>
                  {dash(
                    viewRecord.reason,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Quantity</span>
                <strong>
                  {viewRecord.quantity !==
                    "" &&
                  viewRecord.quantity !==
                    null
                    ? `${viewRecord.quantity} ${viewRecord.quantityUnit}`
                    : "—"}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Weight</span>
                <strong>
                  {viewRecord.weight !==
                    "" &&
                  viewRecord.weight !==
                    null
                    ? `${viewRecord.weight} ${viewRecord.weightUnit}`
                    : "—"}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Location</span>
                <strong>
                  {dash(
                    viewRecord.location,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Process</span>
                <strong>
                  {dash(
                    viewRecord.process,
                  )}
                </strong>
              </div>

              <div className="poi-kv poi-kv-full">
                <span>Remarks</span>
                <strong>
                  {dash(
                    viewRecord.remarks,
                  )}
                </strong>
              </div>
            </div>

            <div className="form-section-title">
              Purchase Order Information
            </div>

            <div className="poi-integration-grid">

              <div className="poi-kv">
                <span>PO Number</span>
                <strong>
                  {dash(
                    viewRecord.poNumber,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>PO Date</span>
                <strong>
                  {dash(
                    viewRecord.poDate,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>PO Description</span>
                <strong>
                  {dash(
                    viewRecord.poDescription,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Supplier</span>
                <strong>
                  {dash(
                    viewRecord.supplier,
                  )}
                </strong>
              </div>
            </div>

            <div className="form-section-title">
              Material Information
            </div>

            <div className="poi-integration-grid">

              <div className="poi-kv">
                <span>Material</span>
                <strong>
                  {dash(
                    viewRecord.material,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Material Code</span>
                <strong>
                  {dash(
                    viewRecord.materialCode,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Material Spec</span>
                <strong>
                  {dash(
                    viewRecord.materialSpec,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Unit Weight</span>
                <strong>
                  {dash(
                    viewRecord.unitWeight,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Thickness</span>
                <strong>
                  {dash(
                    viewRecord.thickness,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Length</span>
                <strong>
                  {dash(
                    viewRecord.length,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Width</span>
                <strong>
                  {dash(
                    viewRecord.width,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Unit</span>
                <strong>
                  {dash(
                    viewRecord.poUnit,
                  )}
                </strong>
              </div>

            </div>

            <div className="form-section-title">
              Project Information
            </div>

            <div className="poi-integration-grid">
              <div className="poi-kv">
                <span>Project</span>
                <strong>
                  {dash(
                    viewRecord.project,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Project Code</span>
                <strong>
                  {dash(
                    viewRecord.projectCode,
                  )}
                </strong>
              </div>
            </div>

            <div className="form-section-title">
              Audit Information
            </div>

            <div className="poi-integration-grid">

              <div className="poi-kv">
                <span>Created By</span>
                <strong>
                  {dash(
                    viewRecord.createdBy,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Created Date</span>
                <strong>
                  {dash(
                    viewRecord.createdDate,
                  )}
                </strong>
              </div>

              <div className="poi-kv">
                <span>Updated At</span>
                <strong>
                  {dash(
                    viewRecord.updatedAt,
                  )}
                </strong>
              </div>

            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setViewRecord(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================================================================
          EDIT SCRAP
      =================================================================== */}

      <Modal
        open={
          !!(
            editRecord &&
            editForm
          )
        }
        title={
          editRecord
            ? `Edit Scrap • ${editRecord.scrapId}`
            : ""
        }
        subtitle="The Scrap ID and PO relationship are controlled by the backend."
        onClose={() => {
          if (!saving) {
            setEditRecord(null);
            setEditForm(null);
          }
        }}
        wide
      >
        {editRecord &&
          editForm && (
            <form onSubmit={submitEdit}>

              <div className="form-section-title">
                Purchase Order
              </div>

              <div className="scrap-po-preview">
                <div className="poi-integration-grid">

                  <div className="poi-kv">
                    <span>Scrap ID</span>
                    <strong>
                      {editRecord.scrapId}
                    </strong>
                  </div>

                  <div className="poi-kv">
                    <span>PO Number</span>
                    <strong>
                      {dash(
                        editRecord.poNumber,
                      )}
                    </strong>
                  </div>

                  <div className="poi-kv">
                    <span>PO Description</span>
                    <strong>
                      {dash(
                        editRecord.poDescription,
                      )}
                    </strong>
                  </div>

                  <div className="poi-kv">
                    <span>Material</span>
                    <strong>
                      {dash(
                        editRecord.material,
                      )}
                    </strong>
                  </div>

                </div>
              </div>

              <div className="form-section-title">
                Project &amp; Process
              </div>

              <div className="form-grid">

                <div className="form-field">
                  <label>
                    Project{" "}
                    <span className="required-mark">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      editForm.projectId
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          projectId:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select project
                    </option>

                    {projects
                      .filter(
                        (project) =>
                          !project.status ||
                          project.status ===
                            "Active",
                      )
                      .map(
                        (project) => (
                          <option
                            key={project.id}
                            value={project.id}
                          >
                            {project.name}
                            {project.code
                              ? ` (${project.code})`
                              : ""}
                          </option>
                        ),
                      )}
                  </select>
                </div>

                <div className="form-field">
                  <label>
                    Process{" "}
                    <span className="required-mark">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      editForm.process
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          process:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select process
                    </option>

                    {PROCESSES.map(
                      (process) => (
                        <option
                          key={process}
                          value={process}
                        >
                          {process}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {editForm.process ===
                  "Other" && (
                  <div className="form-field form-field-full">
                    <label>
                      Enter Process
                    </label>

                    <input
                      value={
                        editForm.processOther
                      }
                      onChange={(event) =>
                        setEditForm(
                          (previous) => ({
                            ...previous,
                            processOther:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <div className="form-section-title">
                Scrap Details
              </div>

              <div className="form-grid">

                <div className="form-field">
                  <label>
                    Scrap Type{" "}
                    <span className="required-mark">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      editForm.scrapType
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          scrapType:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select scrap type
                    </option>

                    {SCRAP_TYPES.map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {editForm.scrapType ===
                  "Other" && (
                  <div className="form-field">
                    <label>
                      Enter Scrap Type
                    </label>

                    <input
                      value={
                        editForm.scrapTypeOther
                      }
                      onChange={(event) =>
                        setEditForm(
                          (previous) => ({
                            ...previous,
                            scrapTypeOther:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </div>
                )}

                <div className="form-field">
                  <label>
                    Scrap Quantity
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={
                      editForm.quantity
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          quantity:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>
                    Quantity Unit
                  </label>

                  <select
                    value={
                      editForm.quantityUnit
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          quantityUnit:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    {QUANTITY_UNITS.map(
                      (unit) => (
                        <option
                          key={unit}
                          value={unit}
                        >
                          {unit}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="form-field">
                  <label>
                    Scrap Weight
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={
                      editForm.weight
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          weight:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>
                    Weight Unit
                  </label>

                  <select
                    value={
                      editForm.weightUnit
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          weightUnit:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    {WEIGHT_UNITS.map(
                      (unit) => (
                        <option
                          key={unit}
                          value={unit}
                        >
                          {unit}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="form-field">
                  <label>
                    Scrap Reason{" "}
                    <span className="required-mark">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      editForm.reason
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          reason:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select reason
                    </option>

                    {SCRAP_REASONS.map(
                      (reason) => (
                        <option
                          key={reason}
                          value={reason}
                        >
                          {reason}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {editForm.reason ===
                  "Other" && (
                  <div className="form-field">
                    <label>
                      Enter Reason
                    </label>

                    <input
                      value={
                        editForm.reasonOther
                      }
                      onChange={(event) =>
                        setEditForm(
                          (previous) => ({
                            ...previous,
                            reasonOther:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </div>
                )}

                <div className="form-field">
                  <label>
                    Scrap Date{" "}
                    <span className="required-mark">
                      *
                    </span>
                  </label>

                  <input
                    type="date"
                    value={
                      editForm.date
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          date:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>
                    Scrap Location{" "}
                    <span className="required-mark">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      editForm.location
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          location:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Select location
                    </option>

                    {SCRAP_LOCATIONS.map(
                      (location) => (
                        <option
                          key={location}
                          value={location}
                        >
                          {location}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="form-field form-field-full">
                  <label>
                    Remarks
                  </label>

                  <textarea
                    rows={3}
                    value={
                      editForm.remarks
                    }
                    onChange={(event) =>
                      setEditForm(
                        (previous) => ({
                          ...previous,
                          remarks:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </div>
              </div>

              {editError && (
                <p className="form-error-text">
                  {editError}
                </p>
              )}

              <div className="form-actions">

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditRecord(null);
                    setEditForm(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>
            </form>
          )}
      </Modal>

      {/* ===================================================================
          DELETE
      =================================================================== */}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Scrap Record"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.scrapId}? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() =>
          setDeleteTarget(null)
        }
        loading={deleteLoading}
      />
    </>
  );
}
