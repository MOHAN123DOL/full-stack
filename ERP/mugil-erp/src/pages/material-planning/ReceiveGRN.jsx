import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  Layers,
  AlertTriangle,
  PackageCheck,
  PackageX,
  PackagePlus,
  Hourglass,
  Link2Off,
  Eye,
  Pencil,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import Header from "../../components/Header";
import "./ReceiveGRN.css";

// =====================================================================
// Mock reference data
// =====================================================================
const employees = ["Arun", "Kumar", "Suresh", "Ravi", "Manoj"];
const units = ["Unit 1", "Unit 2"];
const inspectionStatuses = [
  "Pending",
  "Inspected",
  "Accepted",
  "Rejected",
  "Partially Accepted",
];

// Flattened PO + Description rows. Each row is one receivable line.
const initialPoItems = [
  {
    id: "poi-1",
    poType: "Actual PO",
    poNumber: "PO-001",
    supplier: "ABC Steel Industries",
    description: "Description-1",
    material: "Plate",
    materialCode: "15110292000",
    materialSpec: "IS2062 E250A",
    thickness: "10 mm",
    size: "1500 x 6000",
    unit: "Nos",
    poQty: 5,
    received: 0,
    integrationStatus: "Integrated",
    project: "BHEL Boiler Fabrication",
    dwgNumber: "DWG-001",
    dwgDescription: "Description-1",
    deliveryDate: "2026-09-10",
    receivingUnit: null,
  },
  {
    id: "poi-2",
    poType: "Actual PO",
    poNumber: "PO-001",
    supplier: "ABC Steel Industries",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    size: "100 NB",
    unit: "Mtr",
    poQty: 10,
    received: 4,
    integrationStatus: "Integrated",
    project: "BHEL Boiler Fabrication",
    dwgNumber: "DWG-001",
    dwgDescription: "Description-2",
    deliveryDate: "2026-09-05",
    receivingUnit: "Unit 1",
  },
  {
    id: "poi-3",
    poType: "Actual PO",
    poNumber: "PO-002",
    supplier: "XYZ Steel Suppliers",
    description: "Description-1",
    material: "Channel",
    materialCode: "15010350000",
    materialSpec: "IS2062 E250A",
    thickness: "6 mm",
    size: "100 x 50 x 6",
    unit: "Nos",
    poQty: 8,
    received: 8,
    integrationStatus: "Integrated",
    project: "NTPC Structural Project",
    dwgNumber: "DWG-101",
    dwgDescription: "Description-1",
    deliveryDate: "2026-08-15",
    receivingUnit: "Unit 1",
  },
  {
    id: "poi-4",
    poType: "Actual PO",
    poNumber: "PO-002",
    supplier: "XYZ Steel Suppliers",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "6 mm",
    size: "150 NB",
    unit: "Mtr",
    poQty: 10,
    received: 10,
    integrationStatus: "Integrated",
    project: "NTPC Structural Project",
    dwgNumber: "DWG-101",
    dwgDescription: "Description-2",
    deliveryDate: "2026-08-20",
    receivingUnit: "Unit 2",
  },
  {
    id: "poi-5",
    poType: "Actual PO",
    poNumber: "PO-003",
    supplier: "Steel Traders Co.",
    description: "Description-1",
    material: "Angle",
    materialCode: "15013159000",
    materialSpec: "IS2062 E250A",
    thickness: "6 mm",
    size: "50 x 50 x 6",
    unit: "Nos",
    poQty: 12,
    received: 0,
    integrationStatus: "Not Integrated",
    project: "—",
    dwgNumber: "—",
    dwgDescription: "—",
    deliveryDate: "2026-09-25",
    receivingUnit: null,
  },
  {
    id: "poi-6",
    poType: "Actual PO",
    poNumber: "PO-005",
    supplier: "Steel Traders Co.",
    description: "Description-1",
    material: "Plate",
    materialCode: "15110292000",
    materialSpec: "IS2062 E250A",
    thickness: "12 mm",
    size: "2000 x 6000",
    unit: "Nos",
    poQty: 5,
    received: 0,
    integrationStatus: "Not Integrated",
    project: "—",
    dwgNumber: "—",
    dwgDescription: "—",
    deliveryDate: "2026-10-01",
    receivingUnit: null,
  },
  {
    id: "poi-7",
    poType: "Dummy PO",
    poNumber: "DPO-001",
    supplier: "Dummy / Internal",
    description: "Description-1",
    material: "Channel",
    materialCode: "15010135000",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    size: "125 x 65 x 6",
    unit: "Nos",
    poQty: 6,
    received: 2,
    integrationStatus: "Not Integrated",
    project: "—",
    dwgNumber: "—",
    dwgDescription: "—",
    deliveryDate: "2026-09-18",
    receivingUnit: "Unit 1",
  },
];

const initialHistory = [
  {
    id: "grn-1",
    grnNumber: "GRN-0001",
    grnDate: "2026-08-25",
    itemId: "poi-2",
    poNumber: "PO-001",
    description: "Description-2",
    material: "Pipe",
    receivedQty: 4,
    unit: "Unit 1",
    inspectionStatus: "Accepted",
    inspectedBy: "Arun",
    receivedBy: "Suresh",
    remarks: "First batch of pipes received in good condition.",
  },
  {
    id: "grn-2",
    grnNumber: "GRN-0002",
    grnDate: "2026-08-18",
    itemId: "poi-3",
    poNumber: "PO-002",
    description: "Description-1",
    material: "Channel",
    receivedQty: 8,
    unit: "Unit 1",
    inspectionStatus: "Accepted",
    inspectedBy: "Kumar",
    receivedBy: "Ravi",
    remarks: "Full quantity received against PO-002.",
  },
  {
    id: "grn-3",
    grnNumber: "GRN-0003",
    grnDate: "2026-07-20",
    itemId: "poi-4",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    receivedQty: 10,
    unit: "Unit 2",
    inspectionStatus: "Accepted",
    inspectedBy: "Manoj",
    receivedBy: "Arun",
    remarks: "Received directly at Unit 2 store.",
  },
  {
    id: "grn-4",
    grnNumber: "GRN-0004",
    grnDate: "2026-08-30",
    itemId: "poi-7",
    poNumber: "DPO-001",
    description: "Description-1",
    material: "Channel",
    receivedQty: 2,
    unit: "Unit 1",
    inspectionStatus: "Pending",
    inspectedBy: "—",
    receivedBy: "Kumar",
    remarks: "Partial receipt against dummy PO, awaiting inspection.",
  },
];

function grnStatusOf(item) {
  if (item.received <= 0) return "Not Received";
  if (item.received >= item.poQty) return "Fully Received";
  return "Partially Received";
}

// =====================================================================
// Shared components
// =====================================================================
function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    "Not Received": "neutral",
    "Partially Received": "warning",
    "Fully Received": "success",
    Integrated: "success",
    "Partially Integrated": "warning",
    "Not Integrated": "neutral",
    "Actual PO": "info",
    "Dummy PO": "amber-outline",
    Pending: "neutral",
    Inspected: "info",
    Accepted: "success",
    Rejected: "danger",
    "Partially Accepted": "warning",
  };
  const resolvedTone = tone || STATUS_STYLES[status] || "neutral";
  return (
    <span className={`status-badge status-badge-${resolvedTone}`}>
      {status}
    </span>
  );
}

function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
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
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
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
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, title, subtitle, onClose, children }) {
  return (
    <div
      className={`drawer-overlay ${open ? "drawer-overlay-visible" : ""}`}
      onClick={onClose}
    >
      <div
        className={`drawer-box ${open ? "drawer-box-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <h3 className="drawer-title">{title}</h3>
            {subtitle && <p className="drawer-subtitle">{subtitle}</p>}
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

// =====================================================================
// Main Component
// =====================================================================
const emptyReceiveForm = {
  receivingUnit: "Unit 1",
  receivedNow: "",
  inspectionStatus: "Pending",
  inspectedBy: "",
  receivedBy: "",
  remarks: "",
};

export default function ReceiveGRN() {
  const navigate = useNavigate();

  const [items, setItems] = useState(initialPoItems);
  const [history, setHistory] = useState(initialHistory);
  const [toast, setToast] = useState("");

  // search + filters
  const [search, setSearch] = useState("");
  const [materialTypeFilter, setMaterialTypeFilter] = useState("All");
  const [thicknessFilter, setThicknessFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [poNumberFilter, setPoNumberFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("All");

  const [poTypeFilter, setPoTypeFilter] = useState("All");
  const [grnStatusFilter, setGrnStatusFilter] = useState("All");
  const [integrationFilter, setIntegrationFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");

  const [showFilters, setShowFilters] = useState(false);

  // receive drawer
  const [receiveItem, setReceiveItem] = useState(null);
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);
  const [receiveErrors, setReceiveErrors] = useState({});

  // history edit / delete / view
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState(emptyReceiveForm);
  const [editErrors, setEditErrors] = useState({});
  const [viewEntry, setViewEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  // ---------------- derived table rows ----------------
  const rows = useMemo(
    () =>
      items.map((item) => {
        const balance = item.poQty - item.received;
        return {
          ...item,
          materialType: item.materialType || item.material,
          balance,
          grnStatus: grnStatusOf(item),
        };
      }),
    [items],
  );
  const materialTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.materialType).filter(Boolean)),
      ).sort(),
    [rows],
  );

  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.supplier).filter(Boolean)),
      ).sort(),
    [rows],
  );

  const projectOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.project).filter(Boolean)),
      ).sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizeMeasure = (val) =>
      String(val ?? "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .trim();

    return rows.filter((row) => {
      // ---------------- SEARCH ----------------
      const matchesSearch =
        !q ||
        [
          row.poNumber,
          row.description,
          row.material,
          row.materialType,
          row.materialCode,
          row.supplier,
          row.materialSpec,
          row.thickness,
          row.size,
          row.project,
          row.dwgNumber,
          row.dwgDescription,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      // ---------------- ADVANCED FILTERS ----------------
      const matchesMaterialType =
        materialTypeFilter === "All" || row.materialType === materialTypeFilter;

      const matchesThickness =
        !thicknessFilter.trim() ||
        normalizeMeasure(row.thickness).includes(
          normalizeMeasure(thicknessFilter),
        );

      const matchesSize =
        !sizeFilter.trim() ||
        normalizeMeasure(row.size).includes(normalizeMeasure(sizeFilter));

      const matchesPO =
        !poNumberFilter.trim() ||
        String(row.poNumber ?? "")
          .toLowerCase()
          .includes(poNumberFilter.trim().toLowerCase());

      const matchesSupplier =
        supplierFilter === "All" || row.supplier === supplierFilter;

      const matchesGrade =
        !gradeFilter.trim() ||
        String(row.materialSpec ?? "")
          .toLowerCase()
          .includes(gradeFilter.trim().toLowerCase());

      const matchesUnit =
        unitFilter === "All" || row.receivingUnit === unitFilter;

      const matchesPOType =
        poTypeFilter === "All" || row.poType === poTypeFilter;

      const matchesGRNStatus =
        grnStatusFilter === "All" || row.grnStatus === grnStatusFilter;

      const matchesIntegration =
        integrationFilter === "All" ||
        row.integrationStatus === integrationFilter;

      const matchesProject =
        projectFilter === "All" || row.project === projectFilter;

      return (
        matchesSearch &&
        matchesMaterialType &&
        matchesThickness &&
        matchesSize &&
        matchesPO &&
        matchesSupplier &&
        matchesGrade &&
        matchesUnit &&
        matchesPOType &&
        matchesGRNStatus &&
        matchesIntegration &&
        matchesProject
      );
    });
  }, [
    rows,
    search,
    materialTypeFilter,
    thicknessFilter,
    sizeFilter,
    poNumberFilter,
    supplierFilter,
    gradeFilter,
    unitFilter,
    poTypeFilter,
    grnStatusFilter,
    integrationFilter,
    projectFilter,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    materialTypeFilter !== "All" ||
    thicknessFilter.trim() !== "" ||
    sizeFilter.trim() !== "" ||
    poNumberFilter.trim() !== "" ||
    supplierFilter !== "All" ||
    gradeFilter.trim() !== "" ||
    unitFilter !== "All" ||
    poTypeFilter !== "All" ||
    grnStatusFilter !== "All" ||
    integrationFilter !== "All" ||
    projectFilter !== "All";

  function clearFilters() {
    setSearch("");
    setMaterialTypeFilter("All");
    setThicknessFilter("");
    setSizeFilter("");
    setPoNumberFilter("");
    setSupplierFilter("All");
    setGradeFilter("");
    setUnitFilter("All");
    setPoTypeFilter("All");
    setGrnStatusFilter("All");
    setIntegrationFilter("All");
    setProjectFilter("All");
  }

  // ---------------- summary cards ----------------
  const summary = useMemo(() => {
    const totalItems = rows.length;
    const notReceived = rows.filter(
      (r) => r.grnStatus === "Not Received",
    ).length;
    const partiallyReceived = rows.filter(
      (r) => r.grnStatus === "Partially Received",
    ).length;
    const fullyReceived = rows.filter(
      (r) => r.grnStatus === "Fully Received",
    ).length;
    const integrationPending = rows.filter(
      (r) => r.integrationStatus !== "Integrated",
    ).length;
    return {
      totalItems,
      notReceived,
      partiallyReceived,
      fullyReceived,
      integrationPending,
    };
  }, [rows]);

  // ---------------- receive flow ----------------
  function openReceive(row) {
    setReceiveItem(row);
    setReceiveForm({
      ...emptyReceiveForm,
      receivingUnit: row.receivingUnit || "Unit 1",
    });
    setReceiveErrors({});
  }

  function validateReceive(form, balance) {
    const errs = {};
    const qty = Number(form.receivedNow);
    if (!form.receivedNow || Number.isNaN(qty) || qty <= 0) {
      errs.receivedNow = "Enter a quantity greater than 0";
    } else if (qty > balance) {
      errs.receivedNow = `Only ${balance} unit${balance === 1 ? "" : "s"} available to receive.`;
    }
    if (!form.inspectedBy)
      errs.inspectedBy = "Select who inspected this material";
    if (!form.receivedBy) errs.receivedBy = "Select who received this material";
    return errs;
  }

  function handleSaveReceive() {
    if (!receiveItem) return;
    const errs = validateReceive(receiveForm, receiveItem.balance);
    setReceiveErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const qty = Number(receiveForm.receivedNow);
    const grnNumber = `GRN-${String(history.length + 1).padStart(4, "0")}`;
    const today = new Date().toISOString().slice(0, 10);

    setItems((prev) =>
      prev.map((it) =>
        it.id === receiveItem.id
          ? {
              ...it,
              received: it.received + qty,
              receivingUnit: receiveForm.receivingUnit,
            }
          : it,
      ),
    );

    setHistory((prev) => [
      {
        id: `grn-${Date.now()}`,
        grnNumber,
        grnDate: today,
        itemId: receiveItem.id,
        poNumber: receiveItem.poNumber,
        description: receiveItem.description,
        material: receiveItem.material,
        receivedQty: qty,
        unit: receiveForm.receivingUnit,
        inspectionStatus: receiveForm.inspectionStatus,
        inspectedBy: receiveForm.inspectedBy,
        receivedBy: receiveForm.receivedBy,
        remarks: receiveForm.remarks,
      },
      ...prev,
    ]);

    showToast(
      `${grnNumber} recorded for ${receiveItem.poNumber} · ${receiveItem.description}`,
    );
    setReceiveItem(null);
  }

  // ---------------- history edit ----------------
  function openEditEntry(entry) {
    setEditingEntry(entry);
    setEditForm({
      receivingUnit: entry.unit,
      receivedNow: String(entry.receivedQty),
      inspectionStatus: entry.inspectionStatus,
      inspectedBy: entry.inspectedBy === "—" ? "" : entry.inspectedBy,
      receivedBy: entry.receivedBy === "—" ? "" : entry.receivedBy,
      remarks: entry.remarks,
    });
    setEditErrors({});
  }

  function handleSaveEdit() {
    if (!editingEntry) return;
    const item = items.find((it) => it.id === editingEntry.itemId);
    if (!item) return;
    const balanceForEdit =
      item.poQty - (item.received - editingEntry.receivedQty);
    const errs = validateReceive(editForm, balanceForEdit);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const newQty = Number(editForm.receivedNow);
    const diff = newQty - editingEntry.receivedQty;

    setItems((prev) =>
      prev.map((it) =>
        it.id === editingEntry.itemId
          ? {
              ...it,
              received: it.received + diff,
              receivingUnit: editForm.receivingUnit,
            }
          : it,
      ),
    );

    setHistory((prev) =>
      prev.map((h) =>
        h.id === editingEntry.id
          ? {
              ...h,
              receivedQty: newQty,
              unit: editForm.receivingUnit,
              inspectionStatus: editForm.inspectionStatus,
              inspectedBy: editForm.inspectedBy,
              receivedBy: editForm.receivedBy,
              remarks: editForm.remarks,
            }
          : h,
      ),
    );

    showToast(`${editingEntry.grnNumber} updated`);
    setEditingEntry(null);
  }

  function confirmDeleteEntry() {
    if (!deleteEntry) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === deleteEntry.itemId
          ? { ...it, received: it.received - deleteEntry.receivedQty }
          : it,
      ),
    );
    setHistory((prev) => prev.filter((h) => h.id !== deleteEntry.id));
    showToast(
      `${deleteEntry.grnNumber} deleted — quantity restored to balance`,
    );
    setDeleteEntry(null);
  }

  // ---------------- Back Handler ----------------
  function handleBack() {
    navigate("/inventory/material");
  }

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
                <h1 className="page-header-title">GRN / Receive</h1>
                <p className="page-header-subtitle">
                  Receive and track materials against purchase orders.
                </p>
              </div>
            </div>
          </div>

          {toast && <div className="toast">{toast}</div>}

          {/* Summary cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-neutral">
                <PackagePlus size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.totalItems}</span>
                <span className="summary-card-label">Total PO Items</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-neutral">
                <PackageX size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.notReceived}</span>
                <span className="summary-card-label">Not Received</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-warning">
                <Hourglass size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">
                  {summary.partiallyReceived}
                </span>
                <span className="summary-card-label">Partially Received</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-success">
                <PackageCheck size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.fullyReceived}</span>
                <span className="summary-card-label">Fully Received</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-danger">
                <Link2Off size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">
                  {summary.integrationPending}
                </span>
                <span className="summary-card-label">Integration Pending</span>
              </div>
            </div>
          </div>

          {/* Receivables panel */}
          <section className="panel">
            <div className="panel-head">
              <div className="panel-head-title">Receivable Materials</div>
              <p className="panel-head-subtitle" style={{ marginTop: 0 }}>
                Every PO + description appears as its own receivable line.
              </p>
            </div>

            <div className="panel-toolbar">
              <div className="panel-toolbar-search">
                <Search size={14} />
                <input
                  placeholder="Search PO, supplier, material, grade, specification, thickness, size, DWG..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className={`btn btn-secondary btn-sm ${showFilters ? "btn-outline-active" : ""}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal size={14} /> Filters
              </button>
              {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  <X size={14} /> Clear Filters
                </button>
              )}
            </div>

            {showFilters && (
              <div className="filters-grid">
                <div className="form-field">
                  <label>Material Type</label>
                  <select
                    value={materialTypeFilter}
                    onChange={(e) => setMaterialTypeFilter(e.target.value)}
                  >
                    <option>All</option>
                    {materialTypeOptions.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Thickness</label>
                  <input
                    type="text"
                    placeholder="e.g. 8 or 8 mm"
                    value={thicknessFilter}
                    onChange={(e) => setThicknessFilter(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Size</label>
                  <input
                    type="text"
                    placeholder="e.g. 100 NB or 1500 x 6000"
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>PO Number</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-1004"
                    value={poNumberFilter}
                    onChange={(e) => setPoNumberFilter(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Supplier</label>
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                  >
                    <option>All</option>
                    {supplierOptions.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Grade / Specification</label>
                  <input
                    type="text"
                    placeholder="e.g. IS2062 E250A"
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Unit</label>
                  <select
                    value={unitFilter}
                    onChange={(e) => setUnitFilter(e.target.value)}
                  >
                    <option>All</option>
                    {units.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <span className="form-hint">
                    Set once material has been received into a unit.
                  </span>
                </div>
                <div className="form-field">
                  <label>GRN Status</label>
                  <select
                    value={grnStatusFilter}
                    onChange={(e) => setGrnStatusFilter(e.target.value)}
                  >
                    <option>All</option>
                    <option>Not Received</option>
                    <option>Partially Received</option>
                    <option>Fully Received</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>PO Type</label>
                  <select
                    value={poTypeFilter}
                    onChange={(e) => setPoTypeFilter(e.target.value)}
                  >
                    <option>All</option>
                    <option>Actual PO</option>
                    <option>Dummy PO</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Integration Status</label>
                  <select
                    value={integrationFilter}
                    onChange={(e) => setIntegrationFilter(e.target.value)}
                  >
                    <option>All</option>
                    <option>Integrated</option>
                    <option>Partially Integrated</option>
                    <option>Not Integrated</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Project</label>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    <option>All</option>
                    {projectOptions.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="table-scroll">
              <table className="data-table grn-receivable-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>PO Type</th>
                    <th>Description</th>
                    <th>Project</th>
                    <th>DWG No</th>
                    <th>DWG Description</th>
                    <th>Material Type</th>
                    <th>Material</th>
                    <th>Material Code</th>
                    <th>Grade / Specification</th>
                    <th>Thickness</th>
                    <th>Size</th>
                    <th>PO Qty</th>
                    <th>Received</th>
                    <th>Balance</th>
                    <th>Unit</th>
                    <th>Delivery Date</th>
                    <th>GRN Status</th>
                    <th>Integration Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="cell-mono">{row.poNumber}</td>
                      <td>
                        <StatusBadge status={row.poType} />
                      </td>
                      <td>{row.description}</td>
                      <td className={row.project === "—" ? "cell-muted" : ""}>
                        {row.project}
                      </td>
                      <td className={row.dwgNumber === "—" ? "cell-muted" : ""}>
                        {row.dwgNumber || "—"}
                      </td>
                      <td className={row.dwgDescription === "—" ? "cell-muted" : ""}>
                        {row.dwgDescription || "—"}
                      </td>
                      <td>{row.materialType || "—"}</td>
                      <td>{row.material || "—"}</td>
                      <td className="cell-mono">{row.materialCode || "—"}</td>
                      <td>{row.materialSpec || "—"}</td>
                      <td>{row.thickness || "—"}</td>
                      <td>{row.size || "—"}</td>
                      <td>{row.poQty}</td>
                      <td>{row.received}</td>
                      <td>
                        <strong>{row.balance}</strong>
                      </td>
                      <td className={row.receivingUnit ? "" : "cell-muted"}>
                        {row.receivingUnit || "—"}
                      </td>
                      <td>{row.deliveryDate || "—"}</td>
                      <td>
                        <StatusBadge status={row.grnStatus} />
                      </td>
                      <td>
                        <StatusBadge status={row.integrationStatus} />
                      </td>
                      <td>
                        {row.balance > 0 ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openReceive(row)}
                          >
                            Receive
                          </button>
                        ) : (
                          <span className="grn-fully-received-tag">
                            <PackageCheck size={14} /> Fully Received
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={20}>
                        <div className="empty-state">
                          <p className="empty-state-title">
                            No receivable items match your search or filters
                          </p>
                          <p className="empty-state-desc">
                            Try clearing filters or searching by PO number, material
                            type, thickness, size or DWG.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* GRN History */}
          <section className="panel">
            <div className="panel-head">
              <div className="panel-head-title">GRN History</div>
              <p className="panel-head-subtitle" style={{ marginTop: 0 }}>
                All recorded receipts. Deleting a GRN restores its quantity to the
                PO balance.
              </p>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>GRN Number</th>
                    <th>GRN Date</th>
                    <th>PO Number</th>
                    <th>Description</th>
                    <th>Material</th>
                    <th>Received Qty</th>
                    <th>Unit</th>
                    <th>Inspection Status</th>
                    <th>Inspected By</th>
                    <th>Received By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="cell-mono">{h.grnNumber}</td>
                      <td>{h.grnDate}</td>
                      <td className="cell-mono">{h.poNumber}</td>
                      <td>{h.description}</td>
                      <td>{h.material}</td>
                      <td>
                        <strong>{h.receivedQty}</strong>
                      </td>
                      <td>{h.unit}</td>
                      <td>
                        <StatusBadge status={h.inspectionStatus} />
                      </td>
                      <td>{h.inspectedBy || "—"}</td>
                      <td>{h.receivedBy || "—"}</td>
                      <td>
                        <div className="table-row-actions">
                          <button onClick={() => setViewEntry(h)} aria-label="View">
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => openEditEntry(h)}
                            aria-label="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="danger"
                            onClick={() => setDeleteEntry(h)}
                            aria-label="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={11}>
                        <div className="empty-state">
                          <p className="empty-state-title">No GRN recorded yet</p>
                          <p className="empty-state-desc">
                            Receive material against a PO to see it listed here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------------- Receive Drawer ---------------- */}
          <Drawer
            open={!!receiveItem}
            title="Receive Material"
            subtitle={
              receiveItem
                ? `${receiveItem.poNumber} · ${receiveItem.description}`
                : ""
            }
            onClose={() => setReceiveItem(null)}
          >
            {receiveItem && (
              <>
                <div className="grn-readonly-block">
                  <div className="grn-kv">
                    <span>PO Number</span>
                    <strong className="mono">{receiveItem.poNumber}</strong>
                  </div>
                  <div className="grn-kv">
                    <span>PO Description</span>
                    <strong>{receiveItem.description}</strong>
                  </div>
                  <div className="grn-kv">
                    <span>Material</span>
                    <strong>{receiveItem.material}</strong>
                  </div>
                  <div className="grn-kv">
                    <span>Unit of Measure</span>
                    <strong>{receiveItem.unit}</strong>
                  </div>
                  <div className="grn-kv">
                    <span>PO Quantity</span>
                    <strong>{receiveItem.poQty}</strong>
                  </div>
                  <div className="grn-kv">
                    <span>Received Quantity</span>
                    <strong>{receiveItem.received}</strong>
                  </div>
                  <div className="grn-kv grn-kv-highlight">
                    <span>Balance Quantity</span>
                    <strong>{receiveItem.balance}</strong>
                  </div>
                  {receiveItem.integrationStatus !== "Integrated" && (
                    <div className="grn-note">
                      This item is not yet integrated with a project/DWG. It can
                      still be received — integration can happen later.
                    </div>
                  )}
                </div>

                <div className="form-grid grn-form-grid">
                  <div className="form-field">
                    <label>
                      Receiving Unit<span className="required-mark">*</span>
                    </label>
                    <select
                      value={receiveForm.receivingUnit}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          receivingUnit: e.target.value,
                        })
                      }
                    >
                      {units.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`form-field ${receiveErrors.receivedNow ? "form-field-error" : ""}`}
                  >
                    <label>
                      Received Now<span className="required-mark">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={receiveItem.balance}
                      value={receiveForm.receivedNow}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          receivedNow: e.target.value,
                        })
                      }
                      placeholder={`Up to ${receiveItem.balance}`}
                    />
                    {receiveErrors.receivedNow ? (
                      <span className="form-error-text">
                        {receiveErrors.receivedNow}
                      </span>
                    ) : (
                      <span className="form-hint">
                        Only {receiveItem.balance} unit
                        {receiveItem.balance === 1 ? "" : "s"} available to receive.
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label>Inspection Status</label>
                    <select
                      value={receiveForm.inspectionStatus}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          inspectionStatus: e.target.value,
                        })
                      }
                    >
                      {inspectionStatuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`form-field ${receiveErrors.inspectedBy ? "form-field-error" : ""}`}
                  >
                    <label>
                      Inspected By<span className="required-mark">*</span>
                    </label>
                    <select
                      value={receiveForm.inspectedBy}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          inspectedBy: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Employee</option>
                      {employees.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                    {receiveErrors.inspectedBy && (
                      <span className="form-error-text">
                        {receiveErrors.inspectedBy}
                      </span>
                    )}
                  </div>

                  <div
                    className={`form-field ${receiveErrors.receivedBy ? "form-field-error" : ""}`}
                  >
                    <label>
                      Received By<span className="required-mark">*</span>
                    </label>
                    <select
                      value={receiveForm.receivedBy}
                      onChange={(e) =>
                        setReceiveForm({
                          ...receiveForm,
                          receivedBy: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Employee</option>
                      {employees.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                    {receiveErrors.receivedBy && (
                      <span className="form-error-text">
                        {receiveErrors.receivedBy}
                      </span>
                    )}
                  </div>

                  <div className="form-field form-field-full">
                    <label>Remarks</label>
                    <textarea
                      rows={2}
                      value={receiveForm.remarks}
                      onChange={(e) =>
                        setReceiveForm({ ...receiveForm, remarks: e.target.value })
                      }
                      placeholder="Optional notes about this receipt"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setReceiveItem(null)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveReceive}>
                    Receive
                  </button>
                </div>
              </>
            )}
          </Drawer>

          {/* ---------------- Edit GRN Drawer ---------------- */}
          <Drawer
            open={!!editingEntry}
            title="Edit GRN"
            subtitle={
              editingEntry
                ? `${editingEntry.grnNumber} · ${editingEntry.poNumber}`
                : ""
            }
            onClose={() => setEditingEntry(null)}
          >
            {editingEntry && (
              <>
                <div className="form-grid grn-form-grid">
                  <div className="form-field">
                    <label>Receiving Unit</label>
                    <select
                      value={editForm.receivingUnit}
                      onChange={(e) =>
                        setEditForm({ ...editForm, receivingUnit: e.target.value })
                      }
                    >
                      {units.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={`form-field ${editErrors.receivedNow ? "form-field-error" : ""}`}
                  >
                    <label>Received Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.receivedNow}
                      onChange={(e) =>
                        setEditForm({ ...editForm, receivedNow: e.target.value })
                      }
                    />
                    {editErrors.receivedNow && (
                      <span className="form-error-text">
                        {editErrors.receivedNow}
                      </span>
                    )}
                  </div>
                  <div className="form-field">
                    <label>Inspection Status</label>
                    <select
                      value={editForm.inspectionStatus}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          inspectionStatus: e.target.value,
                        })
                      }
                    >
                      {inspectionStatuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={`form-field ${editErrors.inspectedBy ? "form-field-error" : ""}`}
                  >
                    <label>Inspected By</label>
                    <select
                      value={editForm.inspectedBy}
                      onChange={(e) =>
                        setEditForm({ ...editForm, inspectedBy: e.target.value })
                      }
                    >
                      <option value="">Select Employee</option>
                      {employees.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                    {editErrors.inspectedBy && (
                      <span className="form-error-text">
                        {editErrors.inspectedBy}
                      </span>
                    )}
                  </div>
                  <div
                    className={`form-field ${editErrors.receivedBy ? "form-field-error" : ""}`}
                  >
                    <label>Received By</label>
                    <select
                      value={editForm.receivedBy}
                      onChange={(e) =>
                        setEditForm({ ...editForm, receivedBy: e.target.value })
                      }
                    >
                      <option value="">Select Employee</option>
                      {employees.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                    {editErrors.receivedBy && (
                      <span className="form-error-text">
                        {editErrors.receivedBy}
                      </span>
                    )}
                  </div>
                  <div className="form-field form-field-full">
                    <label>Remarks</label>
                    <textarea
                      rows={2}
                      value={editForm.remarks}
                      onChange={(e) =>
                        setEditForm({ ...editForm, remarks: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditingEntry(null)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveEdit}>
                    Save Changes
                  </button>
                </div>
              </>
            )}
          </Drawer>

          {/* View GRN Modal */}
          <Modal
            open={!!viewEntry}
            title={viewEntry ? viewEntry.grnNumber : ""}
            subtitle="GRN transaction details"
            onClose={() => setViewEntry(null)}
          >
            {viewEntry && (
              <div className="grn-readonly-block">
                <div className="grn-kv">
                  <span>GRN Date</span>
                  <strong>{viewEntry.grnDate}</strong>
                </div>
                <div className="grn-kv">
                  <span>PO Number</span>
                  <strong className="mono">{viewEntry.poNumber}</strong>
                </div>
                <div className="grn-kv">
                  <span>Description</span>
                  <strong>{viewEntry.description}</strong>
                </div>
                <div className="grn-kv">
                  <span>Material</span>
                  <strong>{viewEntry.material}</strong>
                </div>
                <div className="grn-kv">
                  <span>Received Quantity</span>
                  <strong>{viewEntry.receivedQty}</strong>
                </div>
                <div className="grn-kv">
                  <span>Receiving Unit</span>
                  <strong>{viewEntry.unit}</strong>
                </div>
                <div className="grn-kv">
                  <span>Inspection Status</span>
                  <StatusBadge status={viewEntry.inspectionStatus} />
                </div>
                <div className="grn-kv">
                  <span>Inspected By</span>
                  <strong>{viewEntry.inspectedBy || "—"}</strong>
                </div>
                <div className="grn-kv">
                  <span>Received By</span>
                  <strong>{viewEntry.receivedBy || "—"}</strong>
                </div>
                <div className="grn-kv">
                  <span>Remarks</span>
                  <strong>{viewEntry.remarks || "—"}</strong>
                </div>
              </div>
            )}
          </Modal>

          <ConfirmDialog
            open={!!deleteEntry}
            title="Delete GRN entry?"
            message={
              deleteEntry
                ? `${deleteEntry.grnNumber} (${deleteEntry.receivedQty} units) will be removed and the quantity restored to ${deleteEntry.poNumber}'s balance.`
                : ""
            }
            onCancel={() => setDeleteEntry(null)}
            onConfirm={confirmDeleteEntry}
          />
        </div>
      </div>
    </>
  );
}