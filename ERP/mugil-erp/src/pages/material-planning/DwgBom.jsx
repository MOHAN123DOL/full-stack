import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  FileUp,
  Save,
  Pencil,
  Trash2,
  FolderKanban,
  FileStack,
  ListChecks,
  FileText,
  Ruler,
  ClipboardList,
  Layers,
  AlertTriangle,
  X,
  Bell,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import "./DwgBom.css";

// ---------- Data ----------
const projects = [
  {
    id: "prj-1",
    name: "BHEL Boiler Fabrication",
    code: "BHEL-2026-001",
    description: "Steel fabrication project for BHEL",
    status: "Active",
    startDate: "2026-01-15",
    endDate: "2026-06-30",
  },
  {
    id: "prj-2",
    name: "NTPC Structural Project",
    code: "NTPC-2026-014",
    description: "Structural steel package for NTPC plant expansion",
    status: "Active",
    startDate: "2026-02-01",
    endDate: "2026-08-15",
  },
  {
    id: "prj-3",
    name: "L&T Pressure Vessel Project",
    code: "LNT-2025-087",
    description: "Pressure vessel fabrication for L&T",
    status: "On Hold",
    startDate: "2025-11-01",
    endDate: "2026-04-30",
  },
];

const drawings = [
  {
    id: "dwg-1",
    projectId: "prj-1",
    dwgNumber: "DWG-001",
    name: "Boiler Support Assembly",
    revision: "REV-01",
    date: "2026-08-20",
    file: "DWG-001.pdf",
    remarks: "Approved for fabrication",
  },
  {
    id: "dwg-2",
    projectId: "prj-1",
    dwgNumber: "DWG-002",
    name: "Boiler Drum Bracket",
    revision: "REV-00",
    date: "2026-08-22",
    file: "DWG-002.pdf",
    remarks: "Pending client approval",
  },
  {
    id: "dwg-3",
    projectId: "prj-1",
    dwgNumber: "DWG-003",
    name: "Access Platform Structure",
    revision: "REV-02",
    date: "2026-08-25",
    file: "DWG-003.pdf",
    remarks: "",
  },
  {
    id: "dwg-4",
    projectId: "prj-1",
    dwgNumber: "DWG-004",
    name: "Ducting Support Frame",
    revision: "REV-01",
    date: "2026-08-27",
    file: "DWG-004.pdf",
    remarks: "",
  },
  {
    id: "dwg-5",
    projectId: "prj-2",
    dwgNumber: "DWG-101",
    name: "Main Column Assembly",
    revision: "REV-01",
    date: "2026-07-11",
    file: "DWG-101.pdf",
    remarks: "",
  },
];

const bomItems = [
  {
    id: "bom-1",
    drawingId: "dwg-1",
    variantNumber: "01",
    itemNumber: "01",
    description: "PL.6x530x530",
    std: "-",
    drawingNumber: "4-48-205-42417",
    itemNo: "01",
    varNo: "-",
    materialCode: "15110292000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 3.86,
    quantity: 5,
  },
  {
    id: "bom-2",
    drawingId: "dwg-1",
    variantNumber: "02",
    itemNumber: "02",
    description: "PL.5x120x90",
    std: "-",
    drawingNumber: "-",
    itemNo: "02",
    varNo: "-",
    materialCode: "15011029000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 0.26,
    quantity: 6,
  },
  {
    id: "bom-3",
    drawingId: "dwg-1",
    variantNumber: "03",
    itemNumber: "03",
    description: "ISA 65x65x6;346",
    std: "-",
    drawingNumber: "-",
    itemNo: "03",
    varNo: "-",
    materialCode: "15013159000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 2,
    quantity: 2,
  },
  {
    id: "bom-4",
    drawingId: "dwg-1",
    variantNumber: "04",
    itemNumber: "04",
    description: "ISMC 150;1500",
    std: "-",
    drawingNumber: "-",
    itemNo: "04",
    varNo: "-",
    materialCode: "15010350000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 8,
    quantity: 2,
  },
  {
    id: "bom-5",
    drawingId: "dwg-1",
    variantNumber: "05",
    itemNumber: "05",
    description: "ISMC 150;5110",
    std: "-",
    drawingNumber: "-",
    itemNo: "05",
    varNo: "-",
    materialCode: "15010350000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 85.8,
    quantity: 4,
  },
  {
    id: "bom-6",
    drawingId: "dwg-1",
    variantNumber: "06",
    itemNumber: "06",
    description: "CHANNEL 100x50x5",
    std: "-",
    drawingNumber: "-",
    itemNo: "06",
    varNo: "-",
    materialCode: "15010135000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 18.5,
    quantity: 6,
  },
  {
    id: "bom-7",
    drawingId: "dwg-1",
    variantNumber: "07",
    itemNumber: "07",
    description: "PIPE NB80 SCH40",
    std: "IS1161",
    drawingNumber: "-",
    itemNo: "07",
    varNo: "-",
    materialCode: "15038626610",
    materialSpecn: "IS1161 YST240",
    acp: "-",
    di: "-",
    unit: "Mtr",
    unitWeight: 9.7,
    quantity: 12,
  },
  {
    id: "bom-8",
    drawingId: "dwg-1",
    variantNumber: "08",
    itemNumber: "08",
    description: "PL.8x600x1200",
    std: "-",
    drawingNumber: "-",
    itemNo: "08",
    varNo: "-",
    materialCode: "15011029000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 45.2,
    quantity: 3,
  },
  {
    id: "bom-9",
    drawingId: "dwg-2",
    variantNumber: "01",
    itemNumber: "01",
    description: "PL.10x400x400",
    std: "-",
    drawingNumber: "4-48-206-11029",
    itemNo: "01",
    varNo: "-",
    materialCode: "15110300000",
    materialSpecn: "IS2062 E250BR",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 12.56,
    quantity: 4,
  },
  {
    id: "bom-10",
    drawingId: "dwg-3",
    variantNumber: "01",
    itemNumber: "01",
    description: "ISMB 200;3000",
    std: "-",
    drawingNumber: "-",
    itemNo: "01",
    varNo: "-",
    materialCode: "15010420000",
    materialSpecn: "IS2062 E250A",
    acp: "-",
    di: "-",
    unit: "Nos",
    unitWeight: 74.4,
    quantity: 6,
  },
];

const bomColumns = [
  { key: "variantNumber", label: "Variant Number" },
  { key: "itemNumber", label: "Item Number" },
  { key: "description", label: "Description" },
  { key: "std", label: "STD" },
  { key: "drawingNumber", label: "Drawing Number" },
  { key: "itemNo", label: "Item No" },
  { key: "varNo", label: "Var No" },
  { key: "materialCode", label: "Material Code" },
  { key: "materialSpecn", label: "Material Specn" },
  { key: "acp", label: "A/C/P" },
  { key: "di", label: "DI" },
  { key: "unit", label: "Unit" },
  { key: "unitWeight", label: "Unit Weight" },
  { key: "quantity", label: "Quantity" },
];

// ---------- Components ----------
function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    Active: "success",
    "On Hold": "neutral",
    "Not Integrated": "neutral",
    "Not Allocated": "neutral",
    "Partially Allocated": "warning",
    "Fully Allocated": "success",
    "Integration Pending": "info",
    Integrated: "success",
    "Dummy PO": "amber-outline",
    "Coming Soon": "neutral",
  };
  const resolvedTone = tone || STATUS_STYLES[status] || "neutral";
  return (
    <span className={`status-badge status-badge-${resolvedTone}`}>
      {status}
    </span>
  );
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

// ---------- Header Component ----------
function AppHeader({ pageName, onBack }) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-header-brand">
          <div className="app-header-brand-icon">
            <Layers size={18} strokeWidth={1.8} />
          </div>
          <div>
            <span className="app-header-brand-label">Material Mgmt</span>
            <span className="app-header-brand-title">ERP</span>
          </div>
        </div>
      </div>
      <div className="app-header-right">
        <div className="app-header-profile-wrap">
          <button
            className="app-header-profile"
            onClick={() => setProfileOpen((v) => !v)}
          >
            <span className="app-header-avatar">RK</span>
            <span className="app-header-profile-name">R. Kumar</span>
            <ChevronDown size={14} />
          </button>
          {profileOpen && (
            <div className="app-header-profile-menu">
              <span className="app-header-profile-role">
                Stores &amp; Purchase
              </span>
              <button type="button">Profile settings</button>
              <button type="button">Sign out</button>
            </div>
          )}
        </div>
        <button className="app-header-icon-btn" aria-label="Notifications">
          <Bell size={17} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}

// ---------- Page Shell ----------
function PageShell({ pageName, children }) {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <AppHeader pageName={pageName} />
      <div className="page-shell-main">
        <div className="page-shell-content">{children}</div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------
const emptyProjectForm = {
  name: "",
  code: "",
  description: "",
  status: "Active",
  startDate: "",
  endDate: "",
};
const emptyDrawingForm = {
  dwgNumber: "",
  name: "",
  revision: "",
  date: "",
  file: "",
  remarks: "",
};
const emptyBomForm = {
  variantNumber: "",
  itemNumber: "",
  description: "",
  std: "",
  drawingNumber: "",
  itemNo: "",
  varNo: "",
  materialCode: "",
  materialSpecn: "",
  acp: "",
  di: "",
  unit: "Nos",
  unitWeight: "",
  quantity: "",
};

export default function DwgBom() {
  const navigate = useNavigate();

  const [projectsList, setProjectsList] = useState(projects);
  const [drawingsList, setDrawingsList] = useState(drawings);
  const [bomList, setBomList] = useState(bomItems);

  const [selectedProjectId, setSelectedProjectId] = useState(projects[0].id);
  const [selectedDrawingId, setSelectedDrawingId] = useState(drawings[0].id);

  const [showAddProject, setShowAddProject] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectErrors, setProjectErrors] = useState({});

  const [showAddDrawing, setShowAddDrawing] = useState(false);
  const [drawingForm, setDrawingForm] = useState(emptyDrawingForm);
  const [drawingErrors, setDrawingErrors] = useState({});

  const [bomSearch, setBomSearch] = useState("");
  const [materialCodeFilter, setMaterialCodeFilter] = useState("");
  const [materialSpecFilter, setMaterialSpecFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [editingBomId, setEditingBomId] = useState(null);
  const [bomForm, setBomForm] = useState(emptyBomForm);
  const [bomErrors, setBomErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState("");

  const selectedProject = projectsList.find((p) => p.id === selectedProjectId);
  const projectDrawings = drawingsList.filter(
    (d) => d.projectId === selectedProjectId,
  );
  const selectedDrawing = drawingsList.find((d) => d.id === selectedDrawingId);
  const drawingBom = bomList.filter((b) => b.drawingId === selectedDrawingId);

  const unitOptions = useMemo(
    () => [...new Set(drawingBom.map((b) => b.unit))],
    [drawingBom],
  );
  const materialCodeOptions = useMemo(
    () => [...new Set(drawingBom.map((b) => b.materialCode))],
    [drawingBom],
  );
  const materialSpecOptions = useMemo(
    () => [...new Set(drawingBom.map((b) => b.materialSpecn))],
    [drawingBom],
  );

  const filteredBom = drawingBom.filter((item) => {
    const q = bomSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [item.description, item.materialCode, item.materialSpecn, item.itemNumber]
        .join(" ")
        .toLowerCase()
        .includes(q);
    const matchesCode =
      !materialCodeFilter || item.materialCode === materialCodeFilter;
    const matchesSpec =
      !materialSpecFilter || item.materialSpecn === materialSpecFilter;
    const matchesUnit = !unitFilter || item.unit === unitFilter;
    return matchesSearch && matchesCode && matchesSpec && matchesUnit;
  });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  function selectProject(id) {
    setSelectedProjectId(id);
    const firstDwg = drawingsList.find((d) => d.projectId === id);
    setSelectedDrawingId(firstDwg ? firstDwg.id : null);
  }

  function validateProject() {
    const errs = {};
    if (!projectForm.name.trim()) errs.name = "Project Name is required";
    if (!projectForm.code.trim()) errs.code = "Project Code is required";
    if (!projectForm.startDate)
      errs.startDate = "Project Start Date is required";
    if (!projectForm.endDate)
      errs.endDate = "Expected Project End Date is required";
    if (
      projectForm.startDate &&
      projectForm.endDate &&
      projectForm.endDate < projectForm.startDate
    )
      errs.endDate =
        "Expected Project End Date cannot be earlier than Project Start Date";
    setProjectErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleAddProject() {
    if (!validateProject()) return;
    const id = `prj-${Date.now()}`;
    const newProject = { id, ...projectForm };
    setProjectsList((prev) => [...prev, newProject]);
    setSelectedProjectId(id);
    setSelectedDrawingId(null);
    setShowAddProject(false);
    setProjectForm(emptyProjectForm);
    showToast(`Project "${newProject.name}" created`);
  }

  function validateDrawing() {
    const errs = {};
    if (!drawingForm.dwgNumber.trim())
      errs.dwgNumber = "DWG Number is required";
    if (!drawingForm.name.trim()) errs.name = "DWG Name is required";
    if (!drawingForm.revision.trim()) errs.revision = "Revision is required";
    if (!drawingForm.date) errs.date = "Drawing Date is required";
    setDrawingErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleAddDrawing() {
    if (!validateDrawing()) return;
    const id = `dwg-${Date.now()}`;
    const newDrawing = { id, projectId: selectedProjectId, ...drawingForm };
    setDrawingsList((prev) => [...prev, newDrawing]);
    setSelectedDrawingId(id);
    setShowAddDrawing(false);
    setDrawingForm(emptyDrawingForm);
    showToast(`Drawing "${newDrawing.dwgNumber}" added`);
  }

  function openAddBom() {
    setEditingBomId(null);
    setBomForm(emptyBomForm);
    setBomErrors({});
    setBomModalOpen(true);
  }

  function openEditBom(item) {
    setEditingBomId(item.id);
    setBomForm({
      ...item,
      unitWeight: String(item.unitWeight),
      quantity: String(item.quantity),
    });
    setBomErrors({});
    setBomModalOpen(true);
  }

  function validateBom() {
    const errs = {};
    if (!bomForm.description.trim())
      errs.description = "Description is required";
    if (!bomForm.materialCode.trim())
      errs.materialCode = "Material Code is required";
    if (!bomForm.unit.trim()) errs.unit = "Unit is required";
    const qty = Number(bomForm.quantity);
    if (!bomForm.quantity || qty <= 0)
      errs.quantity = "Quantity must be greater than 0";
    setBomErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSaveBomItem() {
    if (!validateBom()) return;
    const payload = {
      ...bomForm,
      unitWeight: Number(bomForm.unitWeight) || 0,
      quantity: Number(bomForm.quantity),
    };
    if (editingBomId) {
      setBomList((prev) =>
        prev.map((b) => (b.id === editingBomId ? { ...b, ...payload } : b)),
      );
      showToast("BOM item updated");
    } else {
      const id = `bom-${Date.now()}`;
      setBomList((prev) => [
        ...prev,
        { id, drawingId: selectedDrawingId, ...payload },
      ]);
      showToast("BOM item added");
    }
    setBomModalOpen(false);
  }

  function handleDeleteBom() {
    setBomList((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    showToast("BOM item deleted");
    setDeleteTarget(null);
  }

  function handleBack() {
    navigate("/inventory/material");
  }

  return (
    <PageShell pageName="DWG & BOM">
      {/* Page Header with Back Button */}
      <div className="page-header-wrap">
        <div className="page-header-left">
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={16} strokeWidth={2} />
            Back
          </button>
          <div className="page-header-title-group">
            <h1 className="page-header-title">DWG &amp; BOM</h1>
            <p className="page-header-subtitle">
              Manage projects, drawings and material requirements.
            </p>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* Project Panel */}
      <section className="panel">
        <div className="panel-head">
          <div className="panel-head-title">
            <FolderKanban size={16} strokeWidth={1.8} /> Project
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddProject(true)}
          >
            <Plus size={14} /> Add Project
          </button>
        </div>
        <div className="panel-body">
          <div className="dwgbom-select-project">
            <label>Select Existing Project</label>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => selectProject(e.target.value)}
            >
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          {selectedProject && (
            <div className="dwgbom-project-summary">
              <div>
                <span className="dwgbom-project-name">
                  {selectedProject.name}
                </span>{" "}
                <span className="dwgbom-project-code mono">
                  {selectedProject.code}
                </span>
              </div>
              <p className="dwgbom-project-desc">
                {selectedProject.description}
              </p>
              {(selectedProject.startDate || selectedProject.endDate) && (
                <div className="dwgbom-project-dates">
                  <span>
                    <span className="dwgbom-project-dates-label">
                      Project Start Date:
                    </span>{" "}
                    {selectedProject.startDate || "—"}
                  </span>
                  <span>
                    <span className="dwgbom-project-dates-label">
                      Expected Project End Date:
                    </span>{" "}
                    {selectedProject.endDate || "—"}
                  </span>
                </div>
              )}
              <StatusBadge status={selectedProject.status} />
            </div>
          )}
        </div>
      </section>

      {/* Drawing Panel */}
      {selectedProject && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-head-title">
                <FileStack size={16} strokeWidth={1.8} /> Drawings
              </div>
              <p className="panel-head-subtitle">{selectedProject.name}</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddDrawing(true)}
            >
              <Plus size={14} /> Add DWG
            </button>
          </div>
          <div className="panel-body">
            {projectDrawings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FileText size={20} strokeWidth={1.7} />
                </div>
                <p className="empty-state-title">No drawings yet</p>
                <p className="empty-state-desc">
                  Add the first drawing for {selectedProject.name} to begin
                  building its BOM.
                </p>
              </div>
            ) : (
              <div className="dwgbom-drawing-grid">
                {projectDrawings.map((d) => (
                  <button
                    key={d.id}
                    className={`dwgbom-drawing-card ${
                      d.id === selectedDrawingId
                        ? "dwgbom-drawing-card-active"
                        : ""
                    }`}
                    onClick={() => setSelectedDrawingId(d.id)}
                  >
                    <span className="dwgbom-drawing-number mono">
                      {d.dwgNumber}
                    </span>
                    <span className="dwgbom-drawing-name">{d.name}</span>
                    <span className="dwgbom-drawing-meta">
                      {d.revision} · {d.date}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* BOM Panel */}
      {selectedDrawing && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-head-title">
                <ListChecks size={16} strokeWidth={1.8} /> BOM Materials
              </div>
              <p className="panel-head-subtitle">
                {selectedProject.name} &nbsp;·&nbsp; {selectedDrawing.dwgNumber}{" "}
                — {selectedDrawing.name}
              </p>
            </div>
          </div>
          <div className="panel-toolbar">
            <div className="panel-toolbar-search">
              <Search size={14} />
              <input
                placeholder="Search BOM (description, material code, item)..."
                value={bomSearch}
                onChange={(e) => setBomSearch(e.target.value)}
              />
            </div>
            <select
              className="panel-toolbar-filter"
              value={materialCodeFilter}
              onChange={(e) => setMaterialCodeFilter(e.target.value)}
            >
              <option value="">All Material Codes</option>
              {materialCodeOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="panel-toolbar-filter"
              value={materialSpecFilter}
              onChange={(e) => setMaterialSpecFilter(e.target.value)}
            >
              <option value="">All Material Specns</option>
              {materialSpecOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="panel-toolbar-filter"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
            >
              <option value="">All Units</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <span className="panel-toolbar-spacer" />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                showToast(
                  "Import BOM — connect a Django endpoint to enable this",
                )
              }
            >
              <FileUp size={14} /> Import BOM
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => showToast("BOM saved (mock — no backend yet)")}
            >
              <Save size={14} /> Save BOM
            </button>
            <button className="btn btn-primary btn-sm" onClick={openAddBom}>
              <Plus size={14} /> Add Material
            </button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {bomColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBom.map((item) => (
                  <tr key={item.id}>
                    <td>{item.variantNumber}</td>
                    <td>{item.itemNumber}</td>
                    <td>{item.description}</td>
                    <td className="cell-muted">{item.std}</td>
                    <td className="cell-mono cell-muted">
                      {item.drawingNumber}
                    </td>
                    <td>{item.itemNo}</td>
                    <td className="cell-muted">{item.varNo}</td>
                    <td className="cell-mono">{item.materialCode}</td>
                    <td>{item.materialSpecn}</td>
                    <td className="cell-muted">{item.acp}</td>
                    <td className="cell-muted">{item.di}</td>
                    <td>{item.unit}</td>
                    <td className="cell-muted">{item.unitWeight}</td>
                    <td>
                      <strong>{item.quantity}</strong>
                    </td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          onClick={() => openEditBom(item)}
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="danger"
                          onClick={() => setDeleteTarget(item)}
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBom.length === 0 && (
                  <tr>
                    <td colSpan={bomColumns.length + 1}>
                      <div className="empty-state">
                        <p className="empty-state-title">
                          No BOM items match your filters
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="dwgbom-bom-note">
            <strong>Quantity</strong> is the controlling value for material
            availability. <strong>Unit Weight</strong> is informational only and
            is never used to calculate stock or PO consumption.
          </div>
        </section>
      )}

      {/* Modals */}
      <Modal
        open={showAddProject}
        title="Add Project"
        subtitle="Create a new project to attach drawings and BOM to."
        onClose={() => setShowAddProject(false)}
      >
        <div className="form-section">
          <div className="form-grid">
            <div
              className={`form-field ${
                projectErrors.name ? "form-field-error" : ""
              }`}
            >
              <label>
                Project Name<span className="required-mark">*</span>
              </label>
              <input
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, name: e.target.value })
                }
                placeholder="e.g. BHEL Boiler Fabrication"
              />
              {projectErrors.name && (
                <span className="form-error-text">{projectErrors.name}</span>
              )}
            </div>
            <div
              className={`form-field ${
                projectErrors.code ? "form-field-error" : ""
              }`}
            >
              <label>
                Project Code<span className="required-mark">*</span>
              </label>
              <input
                value={projectForm.code}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, code: e.target.value })
                }
                placeholder="e.g. BHEL-2026-001"
              />
              {projectErrors.code && (
                <span className="form-error-text">{projectErrors.code}</span>
              )}
            </div>
            <div className="form-field form-field-full">
              <label>Project Description</label>
              <textarea
                rows={2}
                value={projectForm.description}
                onChange={(e) =>
                  setProjectForm({
                    ...projectForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div
              className={`form-field ${
                projectErrors.startDate ? "form-field-error" : ""
              }`}
            >
              <label>
                Project Start Date<span className="required-mark">*</span>
              </label>
              <input
                type="date"
                value={projectForm.startDate}
                onChange={(e) =>
                  setProjectForm({
                    ...projectForm,
                    startDate: e.target.value,
                  })
                }
              />
              {projectErrors.startDate && (
                <span className="form-error-text">
                  {projectErrors.startDate}
                </span>
              )}
            </div>
            <div
              className={`form-field ${
                projectErrors.endDate ? "form-field-error" : ""
              }`}
            >
              <label>
                Expected Project End Date
                <span className="required-mark">*</span>
              </label>
              <input
                type="date"
                value={projectForm.endDate}
                min={projectForm.startDate || undefined}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, endDate: e.target.value })
                }
              />
              {projectErrors.endDate && (
                <span className="form-error-text">{projectErrors.endDate}</span>
              )}
              <span className="form-hint">
                Planned target date — not the actual production completion or
                dispatch date.
              </span>
            </div>
            <div className="form-field">
              <label>Project Status</label>
              <select
                value={projectForm.status}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, status: e.target.value })
                }
              >
                <option>Active</option>
                <option>On Hold</option>
                <option>Completed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowAddProject(false)}
          >
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleAddProject}>
            Add Project
          </button>
        </div>
      </Modal>

      <Modal
        open={showAddDrawing}
        title="Add Drawing"
        subtitle={selectedProject ? `For ${selectedProject.name}` : ""}
        onClose={() => setShowAddDrawing(false)}
      >
        <div className="form-section">
          <div className="form-grid">
            <div
              className={`form-field ${
                drawingErrors.dwgNumber ? "form-field-error" : ""
              }`}
            >
              <label>
                DWG Number<span className="required-mark">*</span>
              </label>
              <input
                value={drawingForm.dwgNumber}
                onChange={(e) =>
                  setDrawingForm({ ...drawingForm, dwgNumber: e.target.value })
                }
                placeholder="e.g. DWG-005"
              />
              {drawingErrors.dwgNumber && (
                <span className="form-error-text">
                  {drawingErrors.dwgNumber}
                </span>
              )}
            </div>
            <div
              className={`form-field ${
                drawingErrors.name ? "form-field-error" : ""
              }`}
            >
              <label>
                DWG Name / Title<span className="required-mark">*</span>
              </label>
              <input
                value={drawingForm.name}
                onChange={(e) =>
                  setDrawingForm({ ...drawingForm, name: e.target.value })
                }
              />
              {drawingErrors.name && (
                <span className="form-error-text">{drawingErrors.name}</span>
              )}
            </div>
            <div
              className={`form-field ${
                drawingErrors.revision ? "form-field-error" : ""
              }`}
            >
              <label>
                Drawing Revision<span className="required-mark">*</span>
              </label>
              <input
                value={drawingForm.revision}
                onChange={(e) =>
                  setDrawingForm({ ...drawingForm, revision: e.target.value })
                }
                placeholder="e.g. REV-01"
              />
              {drawingErrors.revision && (
                <span className="form-error-text">
                  {drawingErrors.revision}
                </span>
              )}
            </div>
            <div
              className={`form-field ${
                drawingErrors.date ? "form-field-error" : ""
              }`}
            >
              <label>
                Drawing Date<span className="required-mark">*</span>
              </label>
              <input
                type="date"
                value={drawingForm.date}
                onChange={(e) =>
                  setDrawingForm({ ...drawingForm, date: e.target.value })
                }
              />
              {drawingErrors.date && (
                <span className="form-error-text">{drawingErrors.date}</span>
              )}
            </div>
            <div className="form-field">
              <label>Drawing File</label>
              <input
                value={drawingForm.file}
                onChange={(e) =>
                  setDrawingForm({ ...drawingForm, file: e.target.value })
                }
                placeholder="DWG-005.pdf"
              />
            </div>
            <div className="form-field form-field-full">
              <label>Remarks</label>
              <textarea
                rows={2}
                value={drawingForm.remarks}
                onChange={(e) =>
                  setDrawingForm({ ...drawingForm, remarks: e.target.value })
                }
              />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowAddDrawing(false)}
          >
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleAddDrawing}>
            Add DWG
          </button>
        </div>
      </Modal>

      <Modal
        open={bomModalOpen}
        title={editingBomId ? "Edit BOM Material" : "Add BOM Material"}
        subtitle={selectedDrawing ? selectedDrawing.dwgNumber : ""}
        onClose={() => setBomModalOpen(false)}
        wide={true}
      >
        <div className="form-section">
          <div className="form-grid">
            <div className="form-field">
              <label>Variant Number</label>
              <input
                value={bomForm.variantNumber}
                onChange={(e) =>
                  setBomForm({ ...bomForm, variantNumber: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>Item Number</label>
              <input
                value={bomForm.itemNumber}
                onChange={(e) =>
                  setBomForm({ ...bomForm, itemNumber: e.target.value })
                }
              />
            </div>
            <div
              className={`form-field form-field-full ${
                bomErrors.description ? "form-field-error" : ""
              }`}
            >
              <label>
                Description<span className="required-mark">*</span>
              </label>
              <input
                value={bomForm.description}
                onChange={(e) =>
                  setBomForm({ ...bomForm, description: e.target.value })
                }
                placeholder="e.g. PL.6x530x530"
              />
              {bomErrors.description && (
                <span className="form-error-text">{bomErrors.description}</span>
              )}
            </div>
            <div className="form-field">
              <label>STD</label>
              <input
                value={bomForm.std}
                onChange={(e) =>
                  setBomForm({ ...bomForm, std: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>Drawing Number</label>
              <input
                value={bomForm.drawingNumber}
                onChange={(e) =>
                  setBomForm({ ...bomForm, drawingNumber: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>Item No</label>
              <input
                value={bomForm.itemNo}
                onChange={(e) =>
                  setBomForm({ ...bomForm, itemNo: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>Var No</label>
              <input
                value={bomForm.varNo}
                onChange={(e) =>
                  setBomForm({ ...bomForm, varNo: e.target.value })
                }
              />
            </div>
            <div
              className={`form-field ${
                bomErrors.materialCode ? "form-field-error" : ""
              }`}
            >
              <label>
                Material Code<span className="required-mark">*</span>
              </label>
              <input
                value={bomForm.materialCode}
                onChange={(e) =>
                  setBomForm({ ...bomForm, materialCode: e.target.value })
                }
              />
              {bomErrors.materialCode && (
                <span className="form-error-text">
                  {bomErrors.materialCode}
                </span>
              )}
            </div>
            <div className="form-field">
              <label>Material Specn</label>
              <input
                value={bomForm.materialSpecn}
                onChange={(e) =>
                  setBomForm({ ...bomForm, materialSpecn: e.target.value })
                }
                placeholder="IS2062 E250A"
              />
            </div>
            <div className="form-field">
              <label>A/C/P</label>
              <input
                value={bomForm.acp}
                onChange={(e) =>
                  setBomForm({ ...bomForm, acp: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>DI</label>
              <input
                value={bomForm.di}
                onChange={(e) => setBomForm({ ...bomForm, di: e.target.value })}
              />
            </div>
            <div
              className={`form-field ${
                bomErrors.unit ? "form-field-error" : ""
              }`}
            >
              <label>
                Unit<span className="required-mark">*</span>
              </label>
              <select
                value={bomForm.unit}
                onChange={(e) =>
                  setBomForm({ ...bomForm, unit: e.target.value })
                }
              >
                <option>Nos</option>
                <option>Mtr</option>
                <option>Kg</option>
                <option>Set</option>
              </select>
            </div>
            <div className="form-field">
              <label>Unit Weight</label>
              <input
                type="number"
                step="0.01"
                value={bomForm.unitWeight}
                onChange={(e) =>
                  setBomForm({ ...bomForm, unitWeight: e.target.value })
                }
              />
              <span className="form-hint">
                Informational only — not the controlling quantity.
              </span>
            </div>
            <div
              className={`form-field ${
                bomErrors.quantity ? "form-field-error" : ""
              }`}
            >
              <label>
                Quantity<span className="required-mark">*</span>
              </label>
              <input
                type="number"
                value={bomForm.quantity}
                onChange={(e) =>
                  setBomForm({ ...bomForm, quantity: e.target.value })
                }
              />
              {bomErrors.quantity && (
                <span className="form-error-text">{bomErrors.quantity}</span>
              )}
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setBomModalOpen(false)}
          >
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSaveBomItem}>
            {editingBomId ? "Save Changes" : "Add Material"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete BOM item?"
        message={
          deleteTarget
            ? `"${deleteTarget.description}" will be removed from this drawing's BOM.`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteBom}
      />
    </PageShell>
  );
}
