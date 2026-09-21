import { useMemo, useState } from "react";
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
} from "lucide-react";
import Header from "../../components/Header";
import "./Scrap.css";

// =========================================================================
// SCRAP — PO based scrap entry
// -------------------------------------------------------------------------
// Scrap is always created FROM a Purchase Order. The user selects a PO
// line item (PO Number + Description), the PO/material information is
// shown read-only, and the user only ever enters scrap-specific details
// plus which Project the scrap belongs to and which Process produced it.
// Scrap is never added back to Material Stock.
// =========================================================================

// -------------------------------------------------------------------------
// Reference data — same Projects / Purchase Orders already used across the
// Material Management modules (PO Integration, GRN, etc.). Scrap does not
// keep its own copy of PO records; it only reads from this list.
// -------------------------------------------------------------------------
const projects = [
  { id: "prj-1", name: "BHEL Boiler Fabrication", code: "BHEL-2026-001" },
  { id: "prj-2", name: "NTPC Structural Project", code: "NTPC-2026-014" },
  { id: "prj-3", name: "L&T Pressure Vessel Project", code: "LNT-2025-087" },
];

const purchaseOrders = [
  {
    id: "po-1",
    poNumber: "PO-001",
    supplier: "ABC Steel Industries",
    poDate: "2026-08-20",
    status: "Active",
    items: [
      {
        id: "poi-1",
        description: "PL.6x530x530",
        material: "Plate",
        materialCode: "15110292000",
        materialSpec: "IS2062 E250A",
        unit: "Nos",
        quantity: 8,
        unitWeight: 3.86,
      },
      {
        id: "poi-2",
        description: "PL.5x120x90",
        material: "Plate",
        materialCode: "15011029000",
        materialSpec: "IS2062 E250A",
        unit: "Nos",
        quantity: 10,
        unitWeight: 0.26,
      },
      {
        id: "poi-3",
        description: "ISMC 150;1500",
        material: "Channel",
        materialCode: "15010350000",
        materialSpec: "IS2062 E250A",
        unit: "Nos",
        quantity: 6,
        unitWeight: 8,
      },
    ],
  },
  {
    id: "po-2",
    poNumber: "PO-002",
    supplier: "XYZ Steel Suppliers",
    poDate: "2026-08-22",
    status: "Active",
    items: [
      {
        id: "poi-4",
        description: "PIPE NB80 SCH40",
        material: "Pipe",
        materialCode: "15038626610",
        materialSpec: "IS1161 YST240",
        unit: "Mtr",
        quantity: 20,
        unitWeight: 9.7,
      },
      {
        id: "poi-5",
        description: "CHANNEL 100x50x5",
        material: "Channel",
        materialCode: "15010135000",
        materialSpec: "IS2062 E250A",
        unit: "Nos",
        quantity: 12,
        unitWeight: 18.5,
      },
    ],
  },
  {
    id: "po-3",
    poNumber: "PO-003",
    supplier: "Metro Steel Corporation",
    poDate: "2026-08-25",
    status: "Active",
    items: [
      {
        id: "poi-6",
        description: "PL.10x400x400",
        material: "Plate",
        materialCode: "15110300000",
        materialSpec: "IS2062 E250BR",
        unit: "Nos",
        quantity: 15,
        unitWeight: 12.56,
      },
    ],
  },
  {
    id: "po-4",
    poNumber: "PO-004",
    supplier: "National Steel",
    poDate: "2026-08-28",
    status: "Active",
    items: [
      {
        id: "poi-7",
        description: "ISA 65x65x6;346",
        material: "Angle",
        materialCode: "15013159000",
        materialSpec: "IS2062 E250A",
        unit: "Nos",
        quantity: 8,
        unitWeight: 2,
      },
    ],
  },
];

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

const SCRAP_LOCATIONS = ["Unit 1", "Unit 2", "Scrap Yard", "Other"];
const QUANTITY_UNITS = ["Nos", "Kg", "Ton", "Meter", "Piece"];
const WEIGHT_UNITS = ["Kg", "Ton"];

const today = () => new Date().toISOString().slice(0, 10);
const dash = (v) => (v === undefined || v === null || v === "" ? "—" : v);

// Best-effort dimension parsing from a PO item description. Only ever
// shown when it can be derived with confidence — never invented.
const parseDimensions = (description = "") => {
  const plate = description.match(
    /^PL\.?\s*([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/i,
  );
  if (plate) {
    return { thickness: `${plate[1]} mm`, size: `${plate[2]} × ${plate[3]}` };
  }
  const pipe = description.match(/PIPE\s+NB(\d+)/i);
  if (pipe) return { thickness: "—", size: `NB${pipe[1]}` };
  return { thickness: "—", size: "—" };
};

// Flattened, selectable PO line items — one entry per PO Description.
const poLineOptions = purchaseOrders.flatMap((po) =>
  po.items.map((item) => {
    const dims = parseDimensions(item.description);
    return {
      key: `${po.id}::${item.id}`,
      poId: po.id,
      poNumber: po.poNumber,
      supplier: po.supplier,
      poDate: po.poDate,
      itemId: item.id,
      description: item.description,
      material: item.material,
      materialCode: item.materialCode,
      materialSpec: item.materialSpec,
      unit: item.unit,
      quantity: item.quantity,
      unitWeight: item.unitWeight,
      thickness: dims.thickness,
      size: dims.size,
    };
  }),
);

const findPoLine = (key) => poLineOptions.find((l) => l.key === key) || null;

// -------------------------------------------------------------------------
// Seed scrap records — a couple of realistic starter entries against real
// PO lines above, so the table isn't empty on first load.
// -------------------------------------------------------------------------
const seedScrap = [
  {
    id: "SCR-001",
    poKey: "po-1::poi-1",
    project: "BHEL Boiler Fabrication",
    process: "Cutting",
    scrapType: "Cutting Scrap",
    quantity: 2,
    quantityUnit: "Nos",
    weight: 7.5,
    weightUnit: "Kg",
    reason: "Cutting leftover",
    date: "2026-08-29",
    location: "Scrap Yard",
    remarks: "Remaining offcuts after plate cutting.",
    createdBy: "R. Kumar",
    createdDate: "2026-08-29",
  },
  {
    id: "SCR-002",
    poKey: "po-2::poi-4",
    project: "NTPC Structural Project",
    process: "Welding",
    scrapType: "Rejected Material",
    quantity: 1,
    quantityUnit: "Meter",
    weight: 9.7,
    weightUnit: "Kg",
    reason: "QC rejection",
    date: "2026-09-01",
    location: "Unit 1",
    remarks: "Weld defect beyond repair limit.",
    createdBy: "S. Elango",
    createdDate: "2026-09-01",
  },
];

const emptyCreateForm = () => ({
  poNumber: "",
  poKey: "",
  project: "",
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
});

const nextScrapId = (records) => {
  const nums = records
    .map((r) => Number(String(r.id).replace(/\D/g, "")))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SCR-${String(next).padStart(3, "0")}`;
};

// =========================================================================
// Shared small components
// =========================================================================
function StatusBadge({ text, tone = "neutral" }) {
  return <span className={`status-badge status-badge-${tone}`}>{text}</span>;
}

function Modal({ open, title, subtitle, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-box ${wide ? "modal-box-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
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
}) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">
          <AlertTriangle size={20} strokeWidth={1.8} />
        </div>
        <h3 className="confirm-title">{title}</h3>
        {message && <p className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }) {
  return (
    <div className={`kpi-card ${tone ? `kpi-${tone}` : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

// =========================================================================
// Export helpers — dependency-free: Excel via HTML-table-as-.xls, PDF via
// a print-formatted window (browser's native "Save as PDF").
// =========================================================================
const EXPORT_COLUMNS = [
  ["id", "Scrap ID"],
  ["poNumber", "PO Number"],
  ["poDescription", "PO Description"],
  ["poType", "PO Type"],
  ["supplier", "Supplier"],
  ["project", "Project"],
  ["dwg", "DWG"],
  ["material", "Material"],
  ["materialCode", "Material Code"],
  ["thickness", "Thickness"],
  ["size", "Size"],
  ["unit", "Unit"],
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
  return rows.map((r) => {
    const line = findPoLine(r.poKey);
    return {
      id: r.id,
      poNumber: line?.poNumber || "—",
      poDescription: line?.description || "—",
      poType: "Existing PO",
      supplier: line?.supplier || "—",
      project: r.project || "—",
      dwg: "—",
      material: line?.material || "—",
      materialCode: line?.materialCode || "—",
      thickness: line?.thickness || "—",
      size: line?.size || "—",
      unit: line?.unit || "—",
      scrapType: r.scrapType,
      quantity: r.quantity || "—",
      quantityUnit: r.quantity ? r.quantityUnit : "—",
      weight: r.weight || "—",
      weightUnit: r.weight ? r.weightUnit : "—",
      reason: r.reason,
      date: r.date || "—",
      location: r.location,
      remarks: r.remarks || "—",
      createdBy: r.createdBy || "—",
    };
  });
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportExcel(rows) {
  const data = buildExportRows(rows);
  const headHtml = EXPORT_COLUMNS.map(([, label]) => `<th>${label}</th>`).join(
    "",
  );
  const bodyHtml = data
    .map(
      (row) =>
        `<tr>${EXPORT_COLUMNS.map(
          ([key]) => `<td>${String(row[key] ?? "—")}</td>`,
        ).join("")}</tr>`,
    )
    .join("");
  const html = `<html><head><meta charset="UTF-8"></head><body>
    <table border="1">
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </body></html>`;
  downloadBlob(html, `Scrap_Report_${today()}.xls`, "application/vnd.ms-excel");
}

function describeFilters(filters) {
  const parts = [];
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  if (filters.poKey)
    parts.push(`PO: ${findPoLine(filters.poKey)?.poNumber || filters.poKey}`);
  if (filters.project) parts.push(`Project: ${filters.project}`);
  if (filters.process) parts.push(`Process: ${filters.process}`);
  if (filters.material) parts.push(`Material: ${filters.material}`);
  if (filters.scrapType) parts.push(`Scrap Type: ${filters.scrapType}`);
  if (filters.reason) parts.push(`Reason: ${filters.reason}`);
  if (filters.location) parts.push(`Location: ${filters.location}`);
  if (filters.dateFrom) parts.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`To: ${filters.dateTo}`);
  return parts.length ? parts.join(" · ") : "None";
}

function exportPdf(rows, filters, totals) {
  const data = buildExportRows(rows);
  const cols = [
    "id",
    "poNumber",
    "poDescription",
    "project",
    "dwg",
    "material",
    "thickness",
    "size",
    "scrapType",
    "quantity",
    "weight",
    "reason",
    "date",
    "location",
  ];
  const labels = Object.fromEntries(EXPORT_COLUMNS);
  const headHtml = cols.map((c) => `<th>${labels[c]}</th>`).join("");
  const bodyHtml = data
    .map(
      (row) =>
        `<tr>${cols
          .map(
            (c) =>
              `<td>${
                c === "quantity"
                  ? `${row.quantity} ${
                      row.quantityUnit !== "—" ? row.quantityUnit : ""
                    }`
                  : c === "weight"
                    ? `${row.weight} ${
                        row.weightUnit !== "—" ? row.weightUnit : ""
                      }`
                    : String(row[c] ?? "—")
              }</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Scrap Report</title>
        <style>
          @page { size: landscape; margin: 14mm; }
          body { font-family: Arial, sans-serif; color: #1f2937; }
          h1 { font-size: 16px; margin: 0; }
          h2 { font-size: 13px; margin: 2px 0 12px; color: #4b5563; font-weight: 600; }
          .meta { font-size: 11px; color: #6b7280; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; }
          th { background: #f3f4f6; }
          .totals { margin-top: 14px; font-size: 12px; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>MATERIAL MANAGEMENT ERP</h1>
        <h2>SCRAP REPORT</h2>
        <div class="meta">
          Generated: ${new Date().toLocaleString()}<br/>
          Active Filters: ${describeFilters(filters)}
        </div>
        <table>
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
        <div class="totals">
          Total Scrap Records: ${rows.length}<br/>
          ${
            totals.weightKg > 0
              ? `Total Weight: ${totals.weightKg.toFixed(2)} Kg<br/>`
              : ""
          }
          ${totals.pieces > 0 ? `Total Pieces: ${totals.pieces} Nos<br/>` : ""}
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// =========================================================================
// Main component
// =========================================================================
export default function Scrap() {
  const navigate = useNavigate();

  const [records, setRecords] = useState(seedScrap);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    poKey: "",
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

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [createError, setCreateError] = useState("");

  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---------------- Back Handler ----------------
  function handleBack() {
    navigate("/inventory/material");
  }

  // ---------------------------------------------------------------------
  // Enriched rows (record + its PO line resolved for display/filtering)
  // ---------------------------------------------------------------------
  const rows = useMemo(
    () =>
      records.map((r) => {
        const line = findPoLine(r.poKey);
        return {
          ...r,
          poNumber: line?.poNumber || "—",
          poDescription: line?.description || "—",
          supplier: line?.supplier || "—",
          material: line?.material || "—",
          materialCode: line?.materialCode || "—",
          materialSpec: line?.materialSpec || "—",
          thickness: line?.thickness || "—",
          size: line?.size || "—",
          poUnit: line?.unit || "—",
        };
      }),
    [records],
  );

  const materialOptions = useMemo(
    () => [...new Set(poLineOptions.map((l) => l.material))].sort(),
    [],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.poKey && r.poKey !== filters.poKey) return false;
      if (filters.project && r.project !== filters.project) return false;
      if (filters.process && r.process !== filters.process) return false;
      if (filters.material && r.material !== filters.material) return false;
      if (filters.scrapType && r.scrapType !== filters.scrapType) return false;
      if (filters.reason && r.reason !== filters.reason) return false;
      if (filters.location && r.location !== filters.location) return false;
      if (filters.dateFrom && r.date < filters.dateFrom) return false;
      if (filters.dateTo && r.date > filters.dateTo) return false;
      if (needle) {
        const haystack = [
          r.id,
          r.poNumber,
          r.poDescription,
          r.supplier,
          r.project,
          r.material,
          r.materialCode,
          r.scrapType,
          r.reason,
          r.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, filters, search]);

  const clearFilters = () => {
    setFilters({
      poKey: "",
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
  };

  // ---------------------------------------------------------------------
  // KPIs — never sum incompatible units together
  // ---------------------------------------------------------------------
  const totals = useMemo(() => {
    const weightKg = filteredRows.reduce((sum, r) => {
      const w = Number(r.weight) || 0;
      if (!w) return sum;
      return sum + (r.weightUnit === "Ton" ? w * 1000 : w);
    }, 0);
    const pieces = filteredRows
      .filter((r) => r.quantityUnit === "Nos" || r.quantityUnit === "Piece")
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    const thisMonthKey = today().slice(0, 7);
    const thisMonth = filteredRows.filter(
      (r) => (r.date || "").slice(0, 7) === thisMonthKey,
    ).length;
    return { weightKg, pieces, thisMonth, count: filteredRows.length };
  }, [filteredRows]);

  // ---------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------
  const openCreate = () => {
    setCreateForm(emptyCreateForm());
    setCreateError("");
    setShowCreate(true);
  };

  const selectedCreateLine = createForm.poKey
    ? findPoLine(createForm.poKey)
    : null;

  // PO Number is selected first; PO Description options are then scoped to
  // that PO only. poLineOptions/findPoLine are reused as-is — poKey still
  // ends up holding the exact `po.id::item.id` line key everything else
  // (submit, table, export, view) already depends on.
  const poDescriptionOptions = createForm.poNumber
    ? poLineOptions.filter((l) => l.poNumber === createForm.poNumber)
    : [];

  const submitCreate = (e) => {
    e.preventDefault();
    if (!createForm.poNumber)
      return setCreateError("Please select a PO Number.");
    if (!createForm.poKey)
      return setCreateError("Please select a PO Description.");
    if (!createForm.project) return setCreateError("Please select a project.");
    if (
      !createForm.process ||
      (createForm.process === "Other" && !createForm.processOther.trim())
    )
      return setCreateError("Please select the process the scrap came from.");
    if (
      !createForm.scrapType ||
      (createForm.scrapType === "Other" && !createForm.scrapTypeOther.trim())
    )
      return setCreateError("Please select a scrap type.");
    if (!createForm.quantity && !createForm.weight)
      return setCreateError("Please enter scrap quantity or weight.");
    if (createForm.quantity && !createForm.quantityUnit)
      return setCreateError("Please select a quantity unit.");
    if (createForm.weight && !createForm.weightUnit)
      return setCreateError("Please select a weight unit.");
    if (
      !createForm.reason ||
      (createForm.reason === "Other" && !createForm.reasonOther.trim())
    )
      return setCreateError("Please select a scrap reason.");
    if (!createForm.date) return setCreateError("Please select a scrap date.");
    if (createForm.location === "Other" && !createForm.locationOther.trim())
      return setCreateError("Please enter the scrap location.");

    const record = {
      id: nextScrapId(records),
      poKey: createForm.poKey,
      project: createForm.project,
      process:
        createForm.process === "Other"
          ? createForm.processOther.trim()
          : createForm.process,
      scrapType:
        createForm.scrapType === "Other"
          ? createForm.scrapTypeOther.trim()
          : createForm.scrapType,
      quantity: createForm.quantity ? Number(createForm.quantity) : "",
      quantityUnit: createForm.quantity ? createForm.quantityUnit : "",
      weight: createForm.weight ? Number(createForm.weight) : "",
      weightUnit: createForm.weight ? createForm.weightUnit : "",
      reason:
        createForm.reason === "Other"
          ? createForm.reasonOther.trim()
          : createForm.reason,
      date: createForm.date,
      location:
        createForm.location === "Other"
          ? createForm.locationOther.trim()
          : createForm.location || "—",
      remarks: createForm.remarks.trim(),
      createdBy: "R. Kumar",
      createdDate: today(),
    };
    setRecords((prev) => [record, ...prev]);
    setShowCreate(false);
  };

  // ---------------------------------------------------------------------
  // Edit — PO relationship stays locked unless deliberately changed
  // ---------------------------------------------------------------------
  const openEdit = (record) => {
    setEditRecord(record);
    setEditError("");
    setEditForm({
      poKey: record.poKey,
      poLocked: true,
      project: record.project,
      process: record.process,
      scrapType: record.scrapType,
      quantity: record.quantity,
      quantityUnit: record.quantityUnit || "Nos",
      weight: record.weight,
      weightUnit: record.weightUnit || "Kg",
      reason: record.reason,
      date: record.date,
      location: record.location,
      remarks: record.remarks || "",
    });
  };

  const submitEdit = (e) => {
    e.preventDefault();
    if (!editForm.poKey) return setEditError("Please select a PO.");
    if (!editForm.quantity && !editForm.weight)
      return setEditError("Please enter scrap quantity or weight.");
    if (!editForm.reason) return setEditError("Please select a scrap reason.");

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editRecord.id
          ? {
              ...r,
              poKey: editForm.poKey,
              project: editForm.project,
              process: editForm.process,
              scrapType: editForm.scrapType,
              quantity: editForm.quantity ? Number(editForm.quantity) : "",
              quantityUnit: editForm.quantity ? editForm.quantityUnit : "",
              weight: editForm.weight ? Number(editForm.weight) : "",
              weightUnit: editForm.weight ? editForm.weightUnit : "",
              reason: editForm.reason,
              date: editForm.date,
              location: editForm.location,
              remarks: editForm.remarks,
              lastUpdatedBy: "R. Kumar",
              lastUpdatedDate: today(),
            }
          : r,
      ),
    );
    setEditRecord(null);
    setEditForm(null);
  };

  const confirmDelete = () => {
    setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // ---------------- Render ----------------
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
                <h1 className="page-header-title">Scrap</h1>
                <p className="page-header-subtitle">
                  Create scrap directly from a Purchase Order — select the PO,
                  verify the material information, and record only the
                  scrap-specific details.
                </p>
              </div>
            </div>
          </div>

          {/* ===================== KPI CARDS ===================== */}
          <div className="kpi-grid">
            <KpiCard label="Total Scrap Records" value={totals.count} />
            <KpiCard
              label="Total Weight"
              value={`${totals.weightKg.toFixed(2)} Kg`}
              tone="blue"
            />
            <KpiCard
              label="Total Pieces"
              value={`${totals.pieces} Nos`}
              tone="purple"
            />
            <KpiCard label="This Month" value={totals.thisMonth} tone="green" />
          </div>

          {/* ===================== TABLE ===================== */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-head-title">Scrap Records</div>
                <p className="panel-head-subtitle">
                  Every record is tied to its source PO — nothing here is added
                  back to Material Stock.
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

            <div className="panel-toolbar">
              <div className="panel-toolbar-search">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Scrap ID, PO, Material, Reason..."
                />
              </div>
              <button
                type="button"
                className={`btn btn-secondary btn-sm ${
                  filtersOpen ? "btn-outline-active" : ""
                }`}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {filtersOpen ? "Hide Filters" : "Show Filters"}
              </button>
              <button type="button" className="btn-link" onClick={clearFilters}>
                Clear Filters
              </button>
              <div className="export-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => exportExcel(filteredRows)}
                >
                  <FileSpreadsheet size={14} />
                  Export Excel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    exportPdf(filteredRows, { ...filters, search }, totals)
                  }
                >
                  <FileText size={14} />
                  Download PDF
                </button>
              </div>
            </div>

            {filtersOpen && (
              <div className="filters-grid">
                <div className="form-field">
                  <label>PO Number</label>
                  <select
                    value={filters.poKey}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, poKey: e.target.value }))
                    }
                  >
                    <option value="">All POs</option>
                    {poLineOptions.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.poNumber} — {l.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Project</label>
                  <select
                    value={filters.project}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, project: e.target.value }))
                    }
                  >
                    <option value="">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Process</label>
                  <select
                    value={filters.process}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, process: e.target.value }))
                    }
                  >
                    <option value="">All Processes</option>
                    {PROCESSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Material</label>
                  <select
                    value={filters.material}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, material: e.target.value }))
                    }
                  >
                    <option value="">All Materials</option>
                    {materialOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Scrap Type</label>
                  <select
                    value={filters.scrapType}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, scrapType: e.target.value }))
                    }
                  >
                    <option value="">All Types</option>
                    {SCRAP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Scrap Reason</label>
                  <select
                    value={filters.reason}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, reason: e.target.value }))
                    }
                  >
                    <option value="">All Reasons</option>
                    {SCRAP_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Location</label>
                  <select
                    value={filters.location}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, location: e.target.value }))
                    }
                  >
                    <option value="">All Locations</option>
                    {SCRAP_LOCATIONS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, dateFrom: e.target.value }))
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, dateTo: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

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
                    <th className="cell-action">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={16}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🗑️</div>
                          <p className="empty-state-title">
                            No Scrap Records Found
                          </p>
                          <p className="empty-state-desc">
                            No records match your current search / filters.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td className="cell-mono">{r.id}</td>
                      <td>{dash(r.poNumber)}</td>
                      <td>{dash(r.poDescription)}</td>
                      <td className="cell-muted">{dash(r.supplier)}</td>
                      <td>{dash(r.project)}</td>
                      <td>{dash(r.process)}</td>
                      <td>{dash(r.material)}</td>
                      <td className="cell-mono">{dash(r.thickness)}</td>
                      <td className="cell-mono">{dash(r.size)}</td>
                      <td>{dash(r.scrapType)}</td>
                      <td className="cell-num">
                        {r.quantity ? `${r.quantity} ${r.quantityUnit}` : "—"}
                      </td>
                      <td className="cell-num">
                        {r.weight ? `${r.weight} ${r.weightUnit}` : "—"}
                      </td>
                      <td>{dash(r.reason)}</td>
                      <td>{dash(r.date)}</td>
                      <td>{dash(r.location)}</td>
                      <td>
                        <div className="table-row-actions">
                          <button
                            onClick={() => setViewRecord(r)}
                            aria-label="View"
                          >
                            <Eye size={15} />
                          </button>
                          <button onClick={() => openEdit(r)} aria-label="Edit">
                            <Pencil size={14} />
                          </button>
                          <button
                            className="danger"
                            onClick={() => setDeleteTarget(r)}
                            aria-label="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================
          CREATE SCRAP
      ================================================================= */}
      <Modal
        open={showCreate}
        title="Create Scrap"
        subtitle="Select the PO this scrap came from, then enter the scrap details."
        onClose={() => setShowCreate(false)}
        wide
      >
        <form onSubmit={submitCreate}>
          <div className="form-section-title">1. Select Purchase Order</div>
          <div className="form-grid">
            <div className="form-field form-field-full">
              <label>
                PO Number <span className="required-mark">*</span>
              </label>
              <select
                value={createForm.poNumber}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    poNumber: e.target.value,
                    poKey: "",
                  }))
                }
              >
                <option value="">Select PO Number</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.poNumber}>
                    {po.poNumber}
                  </option>
                ))}
              </select>
            </div>

            {createForm.poNumber && (
              <div className="form-field form-field-full">
                <label>
                  PO Description <span className="required-mark">*</span>
                </label>
                <select
                  value={createForm.poKey}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, poKey: e.target.value }))
                  }
                >
                  <option value="">Select PO Description</option>
                  {poDescriptionOptions.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.description}
                    </option>
                  ))}
                </select>
                <span className="form-hint">
                  Showing descriptions for {createForm.poNumber} only.
                </span>
              </div>
            )}
          </div>

          {selectedCreateLine && (
            <div className="scrap-po-preview">
              <div className="scrap-po-preview-title">
                Selected Purchase Order (read-only)
              </div>
              <div className="poi-integration-grid">
                <div className="poi-kv">
                  <span>PO Number</span>
                  <strong>{selectedCreateLine.poNumber}</strong>
                </div>
                <div className="poi-kv">
                  <span>PO Description</span>
                  <strong>{selectedCreateLine.description}</strong>
                </div>
                <div className="poi-kv">
                  <span>Supplier</span>
                  <strong>{dash(selectedCreateLine.supplier)}</strong>
                </div>
                <div className="poi-kv">
                  <span>Material</span>
                  <strong>{dash(selectedCreateLine.material)}</strong>
                </div>
                <div className="poi-kv">
                  <span>Material Code</span>
                  <strong>{dash(selectedCreateLine.materialCode)}</strong>
                </div>
                <div className="poi-kv">
                  <span>Material Spec</span>
                  <strong>{dash(selectedCreateLine.materialSpec)}</strong>
                </div>
                <div className="poi-kv">
                  <span>Thickness</span>
                  <strong>{dash(selectedCreateLine.thickness)}</strong>
                </div>
                <div className="poi-kv">
                  <span>Size</span>
                  <strong>{dash(selectedCreateLine.size)}</strong>
                </div>
                <div className="poi-kv">
                  <span>Unit</span>
                  <strong>{dash(selectedCreateLine.unit)}</strong>
                </div>
              </div>
            </div>
          )}

          <div className="form-section-title">2. Project &amp; Process</div>
          <div className="form-grid">
            <div className="form-field">
              <label>
                Project <span className="required-mark">*</span>
              </label>
              <select
                value={createForm.project}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, project: e.target.value }))
                }
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>
                Process (where scrap came from){" "}
                <span className="required-mark">*</span>
              </label>
              <select
                value={createForm.process}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, process: e.target.value }))
                }
              >
                <option value="">Select process</option>
                {PROCESSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {createForm.process === "Other" && (
              <div className="form-field form-field-full">
                <label>Enter Process</label>
                <input
                  value={createForm.processOther}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      processOther: e.target.value,
                    }))
                  }
                />
              </div>
            )}
          </div>

          <div className="form-section-title">3. Scrap Details</div>
          <div className="form-grid">
            <div className="form-field">
              <label>
                Scrap Type <span className="required-mark">*</span>
              </label>
              <select
                value={createForm.scrapType}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, scrapType: e.target.value }))
                }
              >
                <option value="">Select scrap type</option>
                {SCRAP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {createForm.scrapType === "Other" && (
              <div className="form-field">
                <label>Enter Scrap Type</label>
                <input
                  value={createForm.scrapTypeOther}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      scrapTypeOther: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="form-field">
              <label>Scrap Quantity</label>
              <input
                type="number"
                min="0"
                value={createForm.quantity}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Quantity Unit</label>
              <select
                value={createForm.quantityUnit}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, quantityUnit: e.target.value }))
                }
              >
                {QUANTITY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Scrap Weight</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={createForm.weight}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, weight: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Weight Unit</label>
              <select
                value={createForm.weightUnit}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, weightUnit: e.target.value }))
                }
              >
                {WEIGHT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>
                Scrap Reason <span className="required-mark">*</span>
              </label>
              <select
                value={createForm.reason}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, reason: e.target.value }))
                }
              >
                <option value="">Select reason</option>
                {SCRAP_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {createForm.reason === "Other" && (
              <div className="form-field">
                <label>Enter Reason</label>
                <input
                  value={createForm.reasonOther}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      reasonOther: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="form-field">
              <label>
                Scrap Date <span className="required-mark">*</span>
              </label>
              <input
                type="date"
                value={createForm.date}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Scrap Location</label>
              <select
                value={createForm.location}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, location: e.target.value }))
                }
              >
                <option value="">Select location</option>
                {SCRAP_LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {createForm.location === "Other" && (
              <div className="form-field">
                <label>Enter Location</label>
                <input
                  value={createForm.locationOther}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      locationOther: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="form-field form-field-full">
              <label>Remarks</label>
              <textarea
                rows={3}
                placeholder="e.g. Remaining portion after cutting."
                value={createForm.remarks}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, remarks: e.target.value }))
                }
              />
            </div>
          </div>

          {createError && <p className="form-error-text">{createError}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Scrap
            </button>
          </div>
        </form>
      </Modal>

      {/* =================================================================
          VIEW SCRAP
      ================================================================= */}
      <Modal
        open={!!viewRecord}
        title={viewRecord ? `Scrap Record • ${viewRecord.id}` : ""}
        onClose={() => setViewRecord(null)}
        wide
      >
        {viewRecord && (
          <div className="scrap-view">
            <div className="form-section-title">Scrap Information</div>
            <div className="poi-integration-grid">
              <div className="poi-kv">
                <span>Scrap ID</span>
                <strong>{viewRecord.id}</strong>
              </div>
              <div className="poi-kv">
                <span>Scrap Date</span>
                <strong>{dash(viewRecord.date)}</strong>
              </div>
              <div className="poi-kv">
                <span>Scrap Type</span>
                <strong>{dash(viewRecord.scrapType)}</strong>
              </div>
              <div className="poi-kv">
                <span>Scrap Reason</span>
                <strong>{dash(viewRecord.reason)}</strong>
              </div>
              <div className="poi-kv">
                <span>Quantity</span>
                <strong>
                  {viewRecord.quantity
                    ? `${viewRecord.quantity} ${viewRecord.quantityUnit}`
                    : "—"}
                </strong>
              </div>
              <div className="poi-kv">
                <span>Weight</span>
                <strong>
                  {viewRecord.weight
                    ? `${viewRecord.weight} ${viewRecord.weightUnit}`
                    : "—"}
                </strong>
              </div>
              <div className="poi-kv">
                <span>Location</span>
                <strong>{dash(viewRecord.location)}</strong>
              </div>
              <div className="poi-kv">
                <span>Process</span>
                <strong>{dash(viewRecord.process)}</strong>
              </div>
              <div className="poi-kv poi-kv-full">
                <span>Remarks</span>
                <strong>{dash(viewRecord.remarks)}</strong>
              </div>
            </div>

            <div className="form-section-title">PO Information</div>
            <div className="poi-integration-grid">
              <div className="poi-kv">
                <span>PO Number</span>
                <strong>{dash(viewRecord.poNumber)}</strong>
              </div>
              <div className="poi-kv">
                <span>PO Description</span>
                <strong>{dash(viewRecord.poDescription)}</strong>
              </div>
              <div className="poi-kv">
                <span>Supplier</span>
                <strong>{dash(viewRecord.supplier)}</strong>
              </div>
            </div>

            <div className="form-section-title">Material Information</div>
            <div className="poi-integration-grid">
              <div className="poi-kv">
                <span>Material</span>
                <strong>{dash(viewRecord.material)}</strong>
              </div>
              <div className="poi-kv">
                <span>Material Code</span>
                <strong>{dash(viewRecord.materialCode)}</strong>
              </div>
              <div className="poi-kv">
                <span>Material Spec</span>
                <strong>{dash(viewRecord.materialSpec)}</strong>
              </div>
              <div className="poi-kv">
                <span>Thickness</span>
                <strong>{dash(viewRecord.thickness)}</strong>
              </div>
              <div className="poi-kv">
                <span>Size</span>
                <strong>{dash(viewRecord.size)}</strong>
              </div>
              <div className="poi-kv">
                <span>Unit</span>
                <strong>{dash(viewRecord.poUnit)}</strong>
              </div>
            </div>

            <div className="form-section-title">Project Information</div>
            <div className="poi-integration-grid">
              <div className="poi-kv">
                <span>Project</span>
                <strong>{dash(viewRecord.project)}</strong>
              </div>
            </div>

            <div className="form-section-title">Audit Information</div>
            <div className="poi-integration-grid">
              <div className="poi-kv">
                <span>Created By</span>
                <strong>{dash(viewRecord.createdBy)}</strong>
              </div>
              <div className="poi-kv">
                <span>Created Date</span>
                <strong>{dash(viewRecord.createdDate)}</strong>
              </div>
              <div className="poi-kv">
                <span>Last Updated</span>
                <strong>{dash(viewRecord.lastUpdatedDate)}</strong>
              </div>
              <div className="poi-kv">
                <span>Last Updated By</span>
                <strong>{dash(viewRecord.lastUpdatedBy)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewRecord(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =================================================================
          EDIT SCRAP
      ================================================================= */}
      <Modal
        open={!!(editRecord && editForm)}
        title={editRecord ? `Edit Scrap • ${editRecord.id}` : ""}
        subtitle="PO relationship stays linked unless you deliberately change it."
        onClose={() => {
          setEditRecord(null);
          setEditForm(null);
        }}
        wide
      >
        {editRecord && editForm && (
          <form onSubmit={submitEdit}>
            <div className="form-section-title">Purchase Order</div>
            <div className="form-grid">
              <div className="form-field form-field-full">
                <label>PO Description</label>
                <select
                  value={editForm.poKey}
                  disabled={editForm.poLocked}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, poKey: e.target.value }))
                  }
                >
                  {poLineOptions.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.poNumber} — {l.description}
                    </option>
                  ))}
                </select>
                {editForm.poLocked && (
                  <span className="form-hint">
                    Locked to the original PO.{" "}
                    <button
                      type="button"
                      className="scrap-link-btn"
                      onClick={() =>
                        setEditForm((f) => ({ ...f, poLocked: false }))
                      }
                    >
                      Change PO
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className="form-section-title">Project &amp; Process</div>
            <div className="form-grid">
              <div className="form-field">
                <label>Project</label>
                <select
                  value={editForm.project}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, project: e.target.value }))
                  }
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Process</label>
                <select
                  value={editForm.process}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, process: e.target.value }))
                  }
                >
                  {PROCESSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-section-title">Scrap Details</div>
            <div className="form-grid">
              <div className="form-field">
                <label>Scrap Type</label>
                <select
                  value={editForm.scrapType}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, scrapType: e.target.value }))
                  }
                >
                  {SCRAP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Scrap Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.quantity}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label>Quantity Unit</label>
                <select
                  value={editForm.quantityUnit}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, quantityUnit: e.target.value }))
                  }
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Scrap Weight</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.weight}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, weight: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label>Weight Unit</label>
                <select
                  value={editForm.weightUnit}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, weightUnit: e.target.value }))
                  }
                >
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Scrap Reason</label>
                <select
                  value={editForm.reason}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, reason: e.target.value }))
                  }
                >
                  {SCRAP_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Scrap Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label>Scrap Location</label>
                <select
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, location: e.target.value }))
                  }
                >
                  {SCRAP_LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field form-field-full">
                <label>Remarks</label>
                <textarea
                  rows={3}
                  value={editForm.remarks}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, remarks: e.target.value }))
                  }
                />
              </div>
            </div>

            {editError && <p className="form-error-text">{editError}</p>}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditRecord(null);
                  setEditForm(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* =================================================================
          DELETE CONFIRM
      ================================================================= */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Scrap Record"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.id}? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
