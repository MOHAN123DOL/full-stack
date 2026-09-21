import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileWarning,
  Repeat,
  Search,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  AlertTriangle,
  X,
  Bell,
  ChevronDown,
  Edit,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import Header from "../../components/Header";
import "./POIntegration.css";

// ---------- Data ----------
const projects = [
  {
    id: "prj-1",
    name: "BHEL Boiler Fabrication",
    code: "BHEL-2026-001",
    description: "Steel fabrication project for BHEL",
    status: "Active",
  },
  {
    id: "prj-2",
    name: "NTPC Structural Project",
    code: "NTPC-2026-014",
    description: "Structural steel package for NTPC plant expansion",
    status: "Active",
  },
  {
    id: "prj-3",
    name: "L&T Pressure Vessel Project",
    code: "LNT-2025-087",
    description: "Pressure vessel fabrication for L&T",
    status: "On Hold",
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
    revision: "REV-01",
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
    projectId: "prj-2",
    dwgNumber: "DWG-101",
    name: "Main Column Assembly",
    revision: "REV-01",
    date: "2026-07-11",
    file: "DWG-101.pdf",
    remarks: "",
  },
  {
    id: "dwg-5",
    projectId: "prj-2",
    dwgNumber: "DWG-102",
    name: "Secondary Structure",
    revision: "REV-02",
    date: "2026-07-15",
    file: "DWG-102.pdf",
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
    drawingId: "dwg-2",
    variantNumber: "01",
    itemNumber: "01",
    description: "CHANNEL 100x50x5",
    std: "-",
    drawingNumber: "-",
    itemNo: "01",
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
    drawingId: "dwg-3",
    variantNumber: "01",
    itemNumber: "01",
    description: "PIPE NB80 SCH40",
    std: "IS1161",
    drawingNumber: "-",
    itemNo: "01",
    varNo: "-",
    materialCode: "15038626610",
    materialSpecn: "IS1161 YST240",
    acp: "-",
    di: "-",
    unit: "Mtr",
    unitWeight: 9.7,
    quantity: 12,
  },
];

// Mock POs with multiple descriptions/items
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
        alreadyIntegrated: 5,
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
        alreadyIntegrated: 4,
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
        alreadyIntegrated: 6,
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
        alreadyIntegrated: 10,
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
        alreadyIntegrated: 0,
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
        alreadyIntegrated: 0,
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
        alreadyIntegrated: 0,
      },
    ],
  },
];

// Initial integrations (mock)
const initialIntegrations = [
  {
    id: "int-1",
    projectId: "prj-1",
    drawingId: "dwg-1",
    bomId: "bom-1",
    poId: "po-1",
    poItemId: "poi-1",
    quantity: 5,
    dummy: false,
  },
  {
    id: "int-2",
    projectId: "prj-1",
    drawingId: "dwg-2",
    bomId: "bom-6",
    poId: "po-2",
    poItemId: "poi-4",
    quantity: 10,
    dummy: false,
  },
];

// Initial Material Stock (mock)
const initialMaterialStock = [
  {
    id: "ms-1",
    poNumber: "PO-005",
    description: "PL.8x600x1200",
    material: "Plate",
    materialCode: "15011029000",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    size: "600 × 1200",
    unit: "Nos",
    workUnit: "Unit 1",
    pieceNo: "—",
    project: null,
    dwg: null,
    receivedQuantity: 20,
    availableQuantity: 20,
    source: "GRN → Material Stock",
    status: "Available",
  },
  {
    id: "ms-2",
    poNumber: "PO-006",
    description: "PIPE NB100 SCH40",
    material: "Pipe",
    materialCode: "15038627000",
    materialSpec: "IS1161 YST240",
    thickness: "5 mm",
    size: "100 NB",
    unit: "Mtr",
    workUnit: "Unit 2",
    pieceNo: "—",
    project: null,
    dwg: null,
    receivedQuantity: 10,
    availableQuantity: 10,
    source: "GRN → Material Stock",
    status: "Available",
  },
  {
    id: "ms-3",
    poNumber: "PO-002",
    description: "PIPE NB80 SCH40",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    size: "100 NB",
    unit: "Mtr",
    workUnit: "Unit 1",
    pieceNo: "—",
    project: "NTPC Structural Project",
    dwg: "DWG-101",
    receivedQuantity: 1,
    availableQuantity: 1,
    source: "Receive From Job Work → Material Stock",
    status: "Available",
  },
  {
    id: "ms-4",
    poNumber: "DPO-001",
    description: "Description-1",
    material: "Plate",
    materialCode: "15110293000",
    materialSpec: "IS2062 E250A",
    thickness: "10 mm",
    size: "500 × 600",
    unit: "Nos",
    workUnit: "Unit 1",
    pieceNo: "PL-060",
    project: "BHEL Project",
    dwg: "DWG-001",
    receivedQuantity: 1,
    availableQuantity: 1,
    source: "Receive From Job Work → Rework → Material Stock",
    status: "Available",
    reworkId: "RW-RJ-004",
  },
];

// ---------- Helper Components ----------
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
    "Partially Integrated": "warning",
    Available: "success",
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

// ---------- Main POIntegration Component ----------
const SOURCES = [
  {
    key: "existing-po",
    label: "Existing PO",
    icon: Repeat,
    desc: "Select an existing purchase order and its item.",
  },
  {
    key: "dummy-po",
    label: "Dummy PO",
    icon: FileWarning,
    desc: "Create an internal dummy PO when the actual PO description is unavailable.",
  },
];

const emptyDummyPo = {
  poNumber: "",
  description: "",
  material: "",
  materialCode: "",
  materialSpec: "",
  unit: "Nos",
  quantity: "",
  unitWeight: "",
  remarks: "",
};

export default function POIntegration() {
  const navigate = useNavigate();

  // ---------- State ----------
  // Project / DWG / BOM selection
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0].id);
  const [selectedDrawingId, setSelectedDrawingId] = useState(
    drawings.find((d) => d.projectId === projects[0].id)?.id || "",
  );
  const [selectedBomId, setSelectedBomId] = useState("");
  const [selectedSource, setSelectedSource] = useState(null);

  // For Existing PO flow
  const [poSearch, setPoSearch] = useState("");
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [selectedPoItemId, setSelectedPoItemId] = useState(null);
  const [integrationQty, setIntegrationQty] = useState("");

  // For Dummy PO flow
  const [dummyPoForm, setDummyPoForm] = useState(emptyDummyPo);
  const [dummyErrors, setDummyErrors] = useState({});

  // Integrated list
  const [integrations, setIntegrations] = useState(initialIntegrations);

  // Editing state
  const [editingIntegrationId, setEditingIntegrationId] = useState(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Toast
  const [toast, setToast] = useState("");

  // Duplicate warning modal
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // ---------- Derived data ----------
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectDrawings = drawings.filter(
    (d) => d.projectId === selectedProjectId,
  );
  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  const drawingBom = bomItems.filter((b) => b.drawingId === selectedDrawingId);
  const selectedBom = bomItems.find((b) => b.id === selectedBomId);

  const selectedPo = purchaseOrders.find((p) => p.id === selectedPoId);
  const selectedPoItem = selectedPo?.items.find(
    (i) => i.id === selectedPoItemId,
  );

  // Calculate available balance for selected PO item
  const availableBalance = useMemo(() => {
    if (!selectedPoItem) return 0;
    const totalIntegrated = integrations
      .filter((int) => int.poItemId === selectedPoItem.id && !int.dummy)
      .reduce((sum, int) => sum + int.quantity, 0);
    return selectedPoItem.quantity - totalIntegrated;
  }, [selectedPoItem, integrations]);

  // Check if current BOM item is already integrated
  const existingIntegrationForBom = useMemo(() => {
    if (!selectedBomId || !selectedProjectId || !selectedDrawingId) return null;
    return integrations.find(
      (int) =>
        int.bomId === selectedBomId &&
        int.drawingId === selectedDrawingId &&
        int.projectId === selectedProjectId,
    );
  }, [selectedBomId, selectedDrawingId, selectedProjectId, integrations]);

  // Filter POs by search
  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) ||
      po.supplier.toLowerCase().includes(poSearch.toLowerCase()),
  );

  // ---------- Handlers ----------
  function resetSelection() {
    setSelectedPoId(null);
    setSelectedPoItemId(null);
    setIntegrationQty("");
    setDummyPoForm(emptyDummyPo);
    setDummyErrors({});
    setEditingIntegrationId(null);
  }

  function resetAll() {
    setSelectedSource(null);
    resetSelection();
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  // Project/DWG/BOM change resets integration form
  function handleProjectChange(id) {
    setSelectedProjectId(id);
    const firstDwg = drawings.find((d) => d.projectId === id);
    setSelectedDrawingId(firstDwg ? firstDwg.id : "");
    const firstBom = firstDwg
      ? bomItems.find((b) => b.drawingId === firstDwg.id)
      : null;
    setSelectedBomId(firstBom ? firstBom.id : "");
    resetAll();
  }

  function handleDrawingChange(id) {
    setSelectedDrawingId(id);
    const firstBom = bomItems.find((b) => b.drawingId === id);
    setSelectedBomId(firstBom ? firstBom.id : "");
    resetAll();
  }

  function handleBomChange(id) {
    setSelectedBomId(id);
    resetAll();
  }

  // Source selection
  function selectSource(key) {
    setSelectedSource(key);
    resetSelection();
  }

  // PO selection
  function selectPO(poId) {
    setSelectedPoId(poId);
    setSelectedPoItemId(null);
    setIntegrationQty("");
  }

  // PO item selection
  function selectPOItem(itemId) {
    setSelectedPoItemId(itemId);
    const item = selectedPo?.items.find((i) => i.id === itemId);
    if (item) {
      const balance =
        item.quantity -
        integrations
          .filter((int) => int.poItemId === itemId && !int.dummy)
          .reduce((sum, int) => sum + int.quantity, 0);
      const suggested = Math.min(balance, selectedBom?.quantity || balance);
      setIntegrationQty(String(suggested > 0 ? suggested : ""));
    }
  }

  // Dummy PO form change
  function handleDummyChange(field, value) {
    setDummyPoForm({ ...dummyPoForm, [field]: value });
    if (dummyErrors[field]) {
      setDummyErrors({ ...dummyErrors, [field]: null });
    }
  }

  // Validate dummy PO
  function validateDummy() {
    const errors = {};
    if (!dummyPoForm.poNumber.trim())
      errors.poNumber = "Dummy PO Number is required";
    if (!dummyPoForm.description.trim())
      errors.description = "Description is required";
    if (!dummyPoForm.material.trim()) errors.material = "Material is required";
    if (!dummyPoForm.materialCode.trim())
      errors.materialCode = "Material Code is required";
    if (!dummyPoForm.unit.trim()) errors.unit = "Unit is required";
    const qty = Number(dummyPoForm.quantity);
    if (!dummyPoForm.quantity || qty <= 0)
      errors.quantity = "Quantity must be greater than 0";
    setDummyErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Save integration (existing PO)
  function handleSaveIntegration() {
    if (!selectedProjectId || !selectedDrawingId || !selectedBomId) {
      showToast("Please select Project, DWG, and BOM Item.");
      return;
    }
    if (!selectedPoItemId) {
      showToast("Please select a PO item.");
      return;
    }
    const qty = Number(integrationQty);
    if (!qty || qty <= 0) {
      showToast("Please enter a valid integration quantity.");
      return;
    }
    if (qty > availableBalance) {
      showToast(
        `Only ${availableBalance} units are available from this PO item.`,
      );
      return;
    }

    // Check duplicate
    if (existingIntegrationForBom) {
      setDuplicateWarning({
        existing: existingIntegrationForBom,
        newQty: qty,
        newPoItemId: selectedPoItemId,
        newDummy: false,
      });
      return;
    }

    // Create integration
    const newIntegration = {
      id: `int-${Date.now()}`,
      projectId: selectedProjectId,
      drawingId: selectedDrawingId,
      bomId: selectedBomId,
      poId: selectedPoId,
      poItemId: selectedPoItemId,
      quantity: qty,
      dummy: false,
      integratedDate: new Date().toISOString().slice(0, 10),
      integratedBy: "R. Kumar",
    };
    setIntegrations((prev) => [...prev, newIntegration]);
    showToast(
      `Integrated ${qty} ${selectedPoItem.unit} of ${selectedPo.poNumber} - ${selectedPoItem.description}`,
    );
    resetSelection();
  }

  // Save dummy PO integration
  function handleSaveDummyIntegration() {
    if (!validateDummy()) return;
    if (!selectedProjectId || !selectedDrawingId || !selectedBomId) {
      showToast("Please select Project, DWG, and BOM Item.");
      return;
    }
    if (existingIntegrationForBom) {
      setDuplicateWarning({
        existing: existingIntegrationForBom,
        newQty: Number(dummyPoForm.quantity),
        newPoItemId: null,
        newDummy: true,
        dummyData: { ...dummyPoForm },
      });
      return;
    }

    const qty = Number(dummyPoForm.quantity);
    const newIntegration = {
      id: `dint-${Date.now()}`,
      projectId: selectedProjectId,
      drawingId: selectedDrawingId,
      bomId: selectedBomId,
      poId: null,
      poItemId: null,
      quantity: qty,
      dummy: true,
      dummyData: { ...dummyPoForm },
      integratedDate: new Date().toISOString().slice(0, 10),
      integratedBy: "R. Kumar",
    };
    setIntegrations((prev) => [...prev, newIntegration]);
    showToast(
      `Dummy PO ${dummyPoForm.poNumber} created and integrated (${qty} ${dummyPoForm.unit})`,
    );
    resetSelection();
    setSelectedSource(null);
  }

  // Handle duplicate warning actions
  function handleDuplicateAction(action) {
    if (action === "cancel") {
      setDuplicateWarning(null);
      return;
    }
    if (action === "edit") {
      const existing = duplicateWarning.existing;
      setEditingIntegrationId(existing.id);
      setSelectedProjectId(existing.projectId);
      setSelectedDrawingId(existing.drawingId);
      setSelectedBomId(existing.bomId);
      if (!existing.dummy) {
        setSelectedPoId(existing.poId);
        setSelectedPoItemId(existing.poItemId);
        const item = purchaseOrders
          .find((p) => p.id === existing.poId)
          ?.items.find((i) => i.id === existing.poItemId);
        if (item) {
          const balance =
            item.quantity -
            integrations
              .filter(
                (int) =>
                  int.poItemId === existing.poItemId &&
                  int.id !== existing.id &&
                  !int.dummy,
              )
              .reduce((sum, int) => sum + int.quantity, 0);
          setIntegrationQty(String(existing.quantity));
        }
      } else {
        setDummyPoForm(existing.dummyData || emptyDummyPo);
        setSelectedSource("dummy-po");
      }
      setDuplicateWarning(null);
      setIntegrations((prev) => prev.filter((int) => int.id !== existing.id));
      showToast(
        "Existing integration removed. Please review and save changes.",
      );
      return;
    }
    if (action === "delete-create") {
      const existing = duplicateWarning.existing;
      setIntegrations((prev) => prev.filter((int) => int.id !== existing.id));
      setDuplicateWarning(null);
      showToast("Existing integration deleted. You can now create a new one.");
      if (duplicateWarning.newDummy) {
        if (duplicateWarning.dummyData) {
          setDummyPoForm(duplicateWarning.dummyData);
        }
        setSelectedSource("dummy-po");
      } else {
        setSelectedPoId(
          duplicateWarning.newPoItemId
            ? purchaseOrders.find((p) =>
                p.items.some((i) => i.id === duplicateWarning.newPoItemId),
              )?.id
            : null,
        );
        setSelectedPoItemId(duplicateWarning.newPoItemId || null);
        setIntegrationQty(String(duplicateWarning.newQty || ""));
        setSelectedSource("existing-po");
      }
      return;
    }
  }

  // Edit integration
  function startEditIntegration(int) {
    if (int.materialStockId) {
      showToast(
        "To change a Material Stock integration, delete it and integrate again from Material Stock.",
      );
      return;
    }
    setEditingIntegrationId(int.id);
    setSelectedProjectId(int.projectId);
    setSelectedDrawingId(int.drawingId);
    setSelectedBomId(int.bomId);
    if (!int.dummy) {
      setSelectedPoId(int.poId);
      setSelectedPoItemId(int.poItemId);
      const item = purchaseOrders
        .find((p) => p.id === int.poId)
        ?.items.find((i) => i.id === int.poItemId);
      if (item) {
        const balance =
          item.quantity -
          integrations
            .filter(
              (i) => i.poItemId === int.poItemId && i.id !== int.id && !i.dummy,
            )
            .reduce((sum, i) => sum + i.quantity, 0);
        setIntegrationQty(String(int.quantity));
      }
      setSelectedSource("existing-po");
    } else {
      setDummyPoForm(int.dummyData || emptyDummyPo);
      setSelectedSource("dummy-po");
    }
    setIntegrations((prev) => prev.filter((i) => i.id !== int.id));
    showToast(`Editing integration. Update and save.`);
  }

  // Delete integration
  function handleDeleteIntegration(int) {
    setDeleteTarget(int);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setIntegrations((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    if (deleteTarget.materialStockId) {
      setMaterialStockList((prev) =>
        prev.map((item) => {
          if (item.id !== deleteTarget.materialStockId) return item;
          const restored = item.availableQuantity + deleteTarget.quantity;
          return {
            ...item,
            availableQuantity: restored,
            status:
              restored >= item.receivedQuantity
                ? "Available"
                : "Partially Integrated",
          };
        }),
      );
      showToast(
        "Integration deleted. Quantity released back to Material Stock.",
      );
    } else {
      showToast("Integration deleted. PO balance released.");
    }
    setDeleteTarget(null);
  }

  // ---------- Material Stock ----------
  const [materialStockList, setMaterialStockList] =
    useState(initialMaterialStock);
  const [msSearch, setMsSearch] = useState("");
  const emptyMsFilters = {
    poNumber: "",
    description: "",
    material: "",
    thickness: "",
    size: "",
    workUnit: "",
    project: "",
    dwg: "",
    source: "",
  };
  const [msFilters, setMsFilters] = useState(emptyMsFilters);

  const msFilterOptions = useMemo(() => {
    const uniq = (key) => [
      ...new Set(materialStockList.map((m) => m[key]).filter(Boolean)),
    ];
    return {
      poNumber: uniq("poNumber"),
      description: uniq("description"),
      material: uniq("material"),
      thickness: uniq("thickness"),
      size: uniq("size"),
      workUnit: uniq("workUnit"),
      project: uniq("project"),
      dwg: uniq("dwg"),
      source: uniq("source"),
    };
  }, [materialStockList]);

  const filteredMaterialStock = useMemo(() => {
    const q = msSearch.trim().toLowerCase();
    return materialStockList.filter((item) => {
      const matchesSearch =
        !q ||
        [
          item.poNumber,
          item.description,
          item.material,
          item.pieceNo,
          item.thickness,
          item.size,
          item.project,
          item.dwg,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matches = (key) => !msFilters[key] || item[key] === msFilters[key];
      return (
        matchesSearch &&
        matches("poNumber") &&
        matches("description") &&
        matches("material") &&
        matches("thickness") &&
        matches("size") &&
        matches("workUnit") &&
        matches("project") &&
        matches("dwg") &&
        matches("source")
      );
    });
  }, [materialStockList, msSearch, msFilters]);

  function clearMsFilters() {
    setMsFilters(emptyMsFilters);
    setMsSearch("");
  }

  // Material Stock integration modal
  function handleStockIntegrate(item) {
    setStockModalItem(item);
    setStockProjectId(projects[0].id);
    const firstDwg = drawings.find((d) => d.projectId === projects[0].id);
    setStockDrawingId(firstDwg ? firstDwg.id : "");
    const firstBom = firstDwg
      ? bomItems.find((b) => b.drawingId === firstDwg.id)
      : null;
    setStockBomId(firstBom ? firstBom.id : "");
    setStockQty(item.availableQuantity);
  }

  const [stockModalItem, setStockModalItem] = useState(null);
  const [stockProjectId, setStockProjectId] = useState(projects[0].id);
  const [stockDrawingId, setStockDrawingId] = useState("");
  const [stockBomId, setStockBomId] = useState("");
  const [stockQty, setStockQty] = useState(0);

  const stockProjectDrawings = drawings.filter(
    (d) => d.projectId === stockProjectId,
  );
  const stockDrawingBom = bomItems.filter(
    (b) => b.drawingId === stockDrawingId,
  );

  function saveStockIntegration() {
    if (!stockProjectId || !stockDrawingId || !stockBomId) {
      showToast("Please select Project, DWG, and BOM.");
      return;
    }
    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      showToast("Please enter a valid quantity.");
      return;
    }
    if (qty > stockModalItem.availableQuantity) {
      showToast(
        `Only ${stockModalItem.availableQuantity} units are available.`,
      );
      return;
    }
    const duplicate = integrations.find(
      (int) =>
        int.bomId === stockBomId &&
        int.drawingId === stockDrawingId &&
        int.projectId === stockProjectId,
    );
    if (duplicate) {
      showToast(
        "This BOM item is already linked to an integration. Edit or delete the existing entry first.",
      );
      return;
    }
    const stockProject = projects.find((p) => p.id === stockProjectId);
    const stockDrawing = drawings.find((d) => d.id === stockDrawingId);
    const newIntegration = {
      id: `mint-${Date.now()}`,
      projectId: stockProjectId,
      drawingId: stockDrawingId,
      bomId: stockBomId,
      poId: null,
      poItemId: null,
      quantity: qty,
      dummy: false,
      materialStockId: stockModalItem.id,
      materialStockSource: stockModalItem.source,
      materialStockSnapshot: {
        poNumber: stockModalItem.poNumber,
        description: stockModalItem.description,
        material: stockModalItem.material,
        materialCode: stockModalItem.materialCode,
        materialSpec: stockModalItem.materialSpec,
        thickness: stockModalItem.thickness,
        size: stockModalItem.size,
        unit: stockModalItem.unit,
        pieceNo: stockModalItem.pieceNo,
      },
      integratedDate: new Date().toISOString().slice(0, 10),
      integratedBy: "R. Kumar",
    };
    setIntegrations((prev) => [...prev, newIntegration]);
    setMaterialStockList((prev) =>
      prev.map((item) => {
        if (item.id !== stockModalItem.id) return item;
        const newAvail = item.availableQuantity - qty;
        return {
          ...item,
          availableQuantity: newAvail,
          status: newAvail > 0 ? "Partially Integrated" : "Integrated",
          project: item.project || stockProject?.name,
          dwg: item.dwg || stockDrawing?.dwgNumber,
        };
      }),
    );
    showToast(
      `Integrated ${qty} ${stockModalItem.unit} of ${stockModalItem.poNumber} to BOM.`,
    );
    setStockModalItem(null);
  }

  // ---------- Back Handler ----------
  function handleBack() {
    navigate("/inventory/material");
  }

  // ---------- Render ----------
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
                <h1 className="page-header-title">PO Integration</h1>
                <p className="page-header-subtitle">
                  Integrate project BOM requirements with available PO
                  materials.
                </p>
              </div>
            </div>
          </div>

          {toast && <div className="toast">{toast}</div>}

          {/* ===== STEP 1: Project / DWG / BOM ===== */}
          <section className="panel">
            <div className="panel-head">
              <div className="panel-head-title">
                <Lock size={15} strokeWidth={1.8} /> Select Project / DWG / BOM
                Item
              </div>
              <p className="panel-head-subtitle" style={{ marginTop: 0 }}>
                Choose the target for integration.
              </p>
            </div>
            <div className="panel-body">
              <div className="form-grid poi-top-grid">
                <div className="form-field">
                  <label>Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>DWG</label>
                  <select
                    value={selectedDrawingId}
                    onChange={(e) => handleDrawingChange(e.target.value)}
                    disabled={!projectDrawings.length}
                  >
                    {projectDrawings.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.dwgNumber} (Rev {d.revision})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>BOM Item</label>
                  <select
                    value={selectedBomId}
                    onChange={(e) => handleBomChange(e.target.value)}
                    disabled={!drawingBom.length}
                  >
                    {drawingBom.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.itemNumber} — {b.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedBom && (
                <div className="poi-bom-summary">
                  <div>
                    <span className="poi-summary-label">Description</span>
                    <span className="poi-summary-value">
                      {selectedBom.description}
                    </span>
                  </div>
                  <div>
                    <span className="poi-summary-label">Material Code</span>
                    <span className="poi-summary-value mono">
                      {selectedBom.materialCode}
                    </span>
                  </div>
                  <div>
                    <span className="poi-summary-label">Material Spec</span>
                    <span className="poi-summary-value">
                      {selectedBom.materialSpecn}
                    </span>
                  </div>
                  <div>
                    <span className="poi-summary-label">
                      BOM Required Quantity
                    </span>
                    <span className="poi-summary-value poi-summary-strong">
                      {selectedBom.quantity} {selectedBom.unit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ===== STEP 2: Source Selection ===== */}
          {selectedBom && (
            <section className="panel">
              <div className="panel-head">
                <div className="panel-head-title">Material Source</div>
              </div>
              <div className="panel-body">
                <div className="poi-source-grid">
                  {SOURCES.map((s) => {
                    const Icon = s.icon;
                    const active = selectedSource === s.key;
                    return (
                      <button
                        key={s.key}
                        className={`poi-source-card ${
                          active ? "poi-source-card-active" : ""
                        } ${s.comingSoon ? "poi-source-card-soon" : ""}`}
                        onClick={() => selectSource(s.key)}
                      >
                        <div className="poi-source-icon">
                          <Icon size={20} strokeWidth={1.8} />
                        </div>
                        <span className="poi-source-label">{s.label}</span>
                        <span className="poi-source-desc">{s.desc}</span>
                        {s.comingSoon && <StatusBadge status="Coming Soon" />}
                      </button>
                    );
                  })}
                </div>

                {/* ----- Existing PO ----- */}
                {selectedSource === "existing-po" && (
                  <div className="poi-source-panel">
                    <div className="form-section-title">
                      Select Purchase Order
                    </div>
                    <div className="panel-toolbar poi-existing-toolbar">
                      <div className="panel-toolbar-search">
                        <Search size={14} />
                        <input
                          placeholder="Search PO number or supplier..."
                          value={poSearch}
                          onChange={(e) => setPoSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>PO Number</th>
                            <th>Supplier</th>
                            <th>PO Date</th>
                            <th>Items</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPOs.map((po) => (
                            <tr
                              key={po.id}
                              className={
                                selectedPoId === po.id ? "poi-row-selected" : ""
                              }
                            >
                              <td className="cell-mono">{po.poNumber}</td>
                              <td>{po.supplier}</td>
                              <td>{po.poDate}</td>
                              <td>{po.items.length}</td>
                              <td>
                                <StatusBadge status={po.status} />
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => selectPO(po.id)}
                                >
                                  {selectedPoId === po.id
                                    ? "Selected"
                                    : "Select"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedPo && (
                      <>
                        <div className="form-section-title poi-section-spacer">
                          PO Items / Descriptions
                        </div>
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Description</th>
                                <th>Material</th>
                                <th>Material Code</th>
                                <th>Specification</th>
                                <th>PO Qty</th>
                                <th>Integrated</th>
                                <th>Balance</th>
                                <th>Unit</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPo.items.map((item) => {
                                const integrated = integrations
                                  .filter(
                                    (int) =>
                                      int.poItemId === item.id && !int.dummy,
                                  )
                                  .reduce((sum, int) => sum + int.quantity, 0);
                                const balance = item.quantity - integrated;
                                return (
                                  <tr
                                    key={item.id}
                                    className={
                                      selectedPoItemId === item.id
                                        ? "poi-row-selected"
                                        : ""
                                    }
                                  >
                                    <td>{item.id.slice(-2)}</td>
                                    <td>{item.description}</td>
                                    <td>{item.material}</td>
                                    <td className="cell-mono cell-muted">
                                      {item.materialCode}
                                    </td>
                                    <td>{item.materialSpec}</td>
                                    <td>{item.quantity}</td>
                                    <td className="cell-muted">{integrated}</td>
                                    <td>
                                      <strong>{balance}</strong>
                                    </td>
                                    <td>{item.unit}</td>
                                    <td>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        disabled={balance <= 0}
                                        onClick={() => selectPOItem(item.id)}
                                      >
                                        {balance <= 0 ? "No Balance" : "Select"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {selectedPoItem && (
                          <div className="poi-existing-integration">
                            <div className="form-section-title poi-section-spacer">
                              Integration Details
                            </div>
                            <div className="poi-integration-grid">
                              <div className="poi-kv">
                                <span>Project</span>
                                <strong>{selectedProject?.name}</strong>
                              </div>
                              <div className="poi-kv">
                                <span>DWG</span>
                                <strong>
                                  {selectedDrawing?.dwgNumber} (Rev{" "}
                                  {selectedDrawing?.revision})
                                </strong>
                              </div>
                              <div className="poi-kv">
                                <span>BOM Item</span>
                                <strong>
                                  {selectedBom?.itemNumber} —{" "}
                                  {selectedBom?.description}
                                </strong>
                              </div>
                              <div className="poi-kv">
                                <span>BOM Required Qty</span>
                                <strong>
                                  {selectedBom?.quantity} {selectedBom?.unit}
                                </strong>
                              </div>
                              <div className="poi-kv">
                                <span>PO Number</span>
                                <strong>{selectedPo.poNumber}</strong>
                              </div>
                              <div className="poi-kv">
                                <span>PO Description</span>
                                <strong>{selectedPoItem.description}</strong>
                              </div>
                              <div className="poi-kv">
                                <span>PO Quantity</span>
                                <strong>
                                  {selectedPoItem.quantity}{" "}
                                  {selectedPoItem.unit}
                                </strong>
                              </div>
                              <div className="poi-kv">
                                <span>Already Integrated</span>
                                <strong>
                                  {selectedPoItem.quantity - availableBalance}
                                </strong>
                              </div>
                              <div className="poi-kv">
                                <span>Available Balance</span>
                                <strong>{availableBalance}</strong>
                              </div>
                              <div className="form-field">
                                <label>
                                  Integration Quantity{" "}
                                  <span className="required-mark">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={integrationQty}
                                  onChange={(e) =>
                                    setIntegrationQty(e.target.value)
                                  }
                                  placeholder="Enter quantity"
                                  min="1"
                                  max={availableBalance}
                                />
                              </div>
                            </div>
                            <div className="form-actions">
                              <button
                                className="btn btn-secondary"
                                onClick={resetAll}
                              >
                                Cancel
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={handleSaveIntegration}
                                disabled={
                                  !integrationQty ||
                                  Number(integrationQty) <= 0 ||
                                  Number(integrationQty) > availableBalance
                                }
                              >
                                Save Integration
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ----- Dummy PO ----- */}
                {selectedSource === "dummy-po" && (
                  <div className="poi-source-panel">
                    <div className="poi-dummy-badge-row">
                      <StatusBadge status="Dummy PO" />
                      <span className="poi-dummy-hint">
                        Create an internal dummy PO when actual PO description
                        is not available.
                      </span>
                    </div>
                    <div className="form-section-title">
                      Dummy PO Information
                    </div>
                    <div className="form-grid">
                      <div
                        className={`form-field ${
                          dummyErrors.poNumber ? "form-field-error" : ""
                        }`}
                      >
                        <label>
                          Dummy PO Number{" "}
                          <span className="required-mark">*</span>
                        </label>
                        <input
                          value={dummyPoForm.poNumber}
                          onChange={(e) =>
                            handleDummyChange("poNumber", e.target.value)
                          }
                          placeholder="DPO-001"
                        />
                        {dummyErrors.poNumber && (
                          <span className="form-error-text">
                            {dummyErrors.poNumber}
                          </span>
                        )}
                      </div>
                      <div
                        className={`form-field ${
                          dummyErrors.description ? "form-field-error" : ""
                        }`}
                      >
                        <label>
                          Description <span className="required-mark">*</span>
                        </label>
                        <input
                          value={dummyPoForm.description}
                          onChange={(e) =>
                            handleDummyChange("description", e.target.value)
                          }
                          placeholder="CHANNEL 100x50x5"
                        />
                        {dummyErrors.description && (
                          <span className="form-error-text">
                            {dummyErrors.description}
                          </span>
                        )}
                      </div>
                      <div
                        className={`form-field ${
                          dummyErrors.material ? "form-field-error" : ""
                        }`}
                      >
                        <label>
                          Material <span className="required-mark">*</span>
                        </label>
                        <input
                          value={dummyPoForm.material}
                          onChange={(e) =>
                            handleDummyChange("material", e.target.value)
                          }
                          placeholder="Channel"
                        />
                        {dummyErrors.material && (
                          <span className="form-error-text">
                            {dummyErrors.material}
                          </span>
                        )}
                      </div>
                      <div
                        className={`form-field ${
                          dummyErrors.materialCode ? "form-field-error" : ""
                        }`}
                      >
                        <label>
                          Material Code <span className="required-mark">*</span>
                        </label>
                        <input
                          value={dummyPoForm.materialCode}
                          onChange={(e) =>
                            handleDummyChange("materialCode", e.target.value)
                          }
                          placeholder="15010135000"
                        />
                        {dummyErrors.materialCode && (
                          <span className="form-error-text">
                            {dummyErrors.materialCode}
                          </span>
                        )}
                      </div>
                      <div className="form-field">
                        <label>Material Specification</label>
                        <input
                          value={dummyPoForm.materialSpec}
                          onChange={(e) =>
                            handleDummyChange("materialSpec", e.target.value)
                          }
                          placeholder="IS2062 E250A"
                        />
                      </div>
                      <div
                        className={`form-field ${
                          dummyErrors.unit ? "form-field-error" : ""
                        }`}
                      >
                        <label>
                          Unit <span className="required-mark">*</span>
                        </label>
                        <select
                          value={dummyPoForm.unit}
                          onChange={(e) =>
                            handleDummyChange("unit", e.target.value)
                          }
                        >
                          <option>Nos</option>
                          <option>Mtr</option>
                          <option>Kg</option>
                        </select>
                        {dummyErrors.unit && (
                          <span className="form-error-text">
                            {dummyErrors.unit}
                          </span>
                        )}
                      </div>
                      <div
                        className={`form-field ${
                          dummyErrors.quantity ? "form-field-error" : ""
                        }`}
                      >
                        <label>
                          Quantity <span className="required-mark">*</span>
                        </label>
                        <input
                          type="number"
                          value={dummyPoForm.quantity}
                          onChange={(e) =>
                            handleDummyChange("quantity", e.target.value)
                          }
                          placeholder="6"
                        />
                        {dummyErrors.quantity && (
                          <span className="form-error-text">
                            {dummyErrors.quantity}
                          </span>
                        )}
                      </div>
                      <div className="form-field">
                        <label>Unit Weight</label>
                        <input
                          type="number"
                          step="0.01"
                          value={dummyPoForm.unitWeight}
                          onChange={(e) =>
                            handleDummyChange("unitWeight", e.target.value)
                          }
                          placeholder="18.50"
                        />
                      </div>
                      <div className="form-field form-field-full">
                        <label>Remarks</label>
                        <textarea
                          rows={2}
                          value={dummyPoForm.remarks}
                          onChange={(e) =>
                            handleDummyChange("remarks", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="form-section-title poi-section-spacer">
                      Connects to
                    </div>
                    <div className="poi-integration-grid">
                      <div className="poi-kv">
                        <span>Project</span>
                        <strong>{selectedProject?.name}</strong>
                      </div>
                      <div className="poi-kv">
                        <span>DWG</span>
                        <strong>
                          {selectedDrawing?.dwgNumber} (Rev{" "}
                          {selectedDrawing?.revision})
                        </strong>
                      </div>
                      <div className="poi-kv">
                        <span>BOM</span>
                        <strong>
                          {selectedBom?.itemNumber} — {selectedBom?.description}
                        </strong>
                      </div>
                      <div className="poi-kv">
                        <span>Integration Quantity</span>
                        <strong>
                          {dummyPoForm.quantity || "-"} {dummyPoForm.unit}
                        </strong>
                      </div>
                    </div>

                    <div className="form-actions">
                      <button className="btn btn-secondary" onClick={resetAll}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveDummyIntegration}
                      >
                        Create Dummy PO &amp; Integrate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ===== Integrated Materials ===== */}
          <section className="panel">
            <div className="panel-head">
              <div className="panel-head-title">Integrated Materials</div>
              <p className="panel-head-subtitle" style={{ marginTop: 0 }}>
                All existing integrations.
              </p>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>DWG</th>
                    <th>Revision</th>
                    <th>BOM Item</th>
                    <th>Description</th>
                    <th>BOM Required</th>
                    <th>PO</th>
                    <th>PO Description</th>
                    <th>Integrated Qty</th>
                    <th>Unit</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((int) => {
                    const project = projects.find(
                      (p) => p.id === int.projectId,
                    );
                    const drawing = drawings.find(
                      (d) => d.id === int.drawingId,
                    );
                    const bom = bomItems.find((b) => b.id === int.bomId);
                    const isDummy = int.dummy;
                    const isStock = !!int.materialStockId;
                    const po =
                      !isDummy && !isStock
                        ? purchaseOrders.find((p) => p.id === int.poId)
                        : null;
                    const poItem =
                      !isDummy && !isStock
                        ? po?.items.find((i) => i.id === int.poItemId)
                        : null;
                    const bomRequired = bom?.quantity || 0;
                    const integratedQty = int.quantity;
                    const displayPoNumber = isDummy
                      ? int.dummyData?.poNumber || "Dummy"
                      : isStock
                        ? int.materialStockSnapshot?.poNumber
                        : po?.poNumber;
                    const displayDescription = isDummy
                      ? int.dummyData?.description
                      : isStock
                        ? int.materialStockSnapshot?.description
                        : poItem?.description;
                    const unit = isDummy
                      ? int.dummyData?.unit
                      : isStock
                        ? int.materialStockSnapshot?.unit
                        : poItem?.unit || bom?.unit;
                    const source = isDummy
                      ? "Dummy PO (Internal)"
                      : isStock
                        ? int.materialStockSource
                        : "Existing PO";

                    return (
                      <tr key={int.id}>
                        <td>{project?.name}</td>
                        <td className="cell-mono">{drawing?.dwgNumber}</td>
                        <td>{drawing?.revision}</td>
                        <td>{bom?.itemNumber}</td>
                        <td>{bom?.description}</td>
                        <td>
                          <strong>{bomRequired}</strong>
                        </td>
                        <td className="cell-mono">{displayPoNumber}</td>
                        <td>{displayDescription}</td>
                        <td>
                          <strong
                            style={{
                              color:
                                integratedQty >= bomRequired
                                  ? "var(--success)"
                                  : "var(--warning)",
                            }}
                          >
                            {integratedQty}
                          </strong>
                        </td>
                        <td>{unit}</td>
                        <td className="cell-muted" style={{ fontSize: "12px" }}>
                          {source}
                        </td>
                        <td>
                          {isDummy ? (
                            <StatusBadge status="Dummy PO" />
                          ) : (
                            <StatusBadge status="Integrated" />
                          )}
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button
                              onClick={() => startEditIntegration(int)}
                              aria-label="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="danger"
                              onClick={() => handleDeleteIntegration(int)}
                              aria-label="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {integrations.length === 0 && (
                    <tr>
                      <td colSpan={12}>
                        <div className="empty-state">
                          <p className="empty-state-title">
                            No integrations yet
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== Material Stock ===== */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-head-title">Material Stock</div>
                <p className="panel-head-subtitle" style={{ marginTop: 0 }}>
                  Material already available for PO Integration — from GRN,
                  direct balance after Receive From Job Work, or completed
                  Rework. Material still in Rework (Pending / In Progress) is
                  never shown here.
                </p>
              </div>
            </div>
            <div className="panel-toolbar poi-existing-toolbar">
              <div className="panel-toolbar-search">
                <Search size={14} />
                <input
                  placeholder="Search PO, description, material, piece no, thickness, size, project, DWG..."
                  value={msSearch}
                  onChange={(e) => setMsSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="form-grid poi-ms-filter-grid">
              <div className="form-field">
                <label>PO Number</label>
                <select
                  value={msFilters.poNumber}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, poNumber: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.poNumber.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>PO Description</label>
                <select
                  value={msFilters.description}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, description: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.description.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Material</label>
                <select
                  value={msFilters.material}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, material: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.material.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Thickness</label>
                <select
                  value={msFilters.thickness}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, thickness: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.thickness.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Size</label>
                <select
                  value={msFilters.size}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, size: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.size.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Unit</label>
                <select
                  value={msFilters.workUnit}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, workUnit: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.workUnit.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Project</label>
                <select
                  value={msFilters.project}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, project: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.project.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>DWG</label>
                <select
                  value={msFilters.dwg}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, dwg: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.dwg.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Source</label>
                <select
                  value={msFilters.source}
                  onChange={(e) =>
                    setMsFilters({ ...msFilters, source: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {msFilterOptions.source.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field poi-ms-clear">
                <label>&nbsp;</label>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={clearMsFilters}
                >
                  Clear Filters
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>PO Description</th>
                    <th>Material</th>
                    <th>Thickness</th>
                    <th>Size</th>
                    <th>Unit</th>
                    <th>Available Qty</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterialStock.map((item) => (
                    <tr key={item.id}>
                      <td className="cell-mono">{item.poNumber}</td>
                      <td>{item.description}</td>
                      <td>{item.material}</td>
                      <td className="cell-muted">{item.thickness}</td>
                      <td className="cell-muted">{item.size}</td>
                      <td>{item.unit}</td>
                      <td>
                        <strong>{item.availableQuantity}</strong>
                      </td>
                      <td className="cell-muted" style={{ fontSize: "12px" }}>
                        {item.source}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        {item.availableQuantity > 0 ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStockIntegrate(item)}
                          >
                            Integrate <ArrowRight size={13} />
                          </button>
                        ) : (
                          <span className="poi-integrated-check">
                            <CheckCircle2 size={15} /> Integrated
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredMaterialStock.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="empty-state">
                          <p className="empty-state-title">
                            No material stock matches your filters
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== Modals ===== */}

          {/* Duplicate Warning Modal */}
          <Modal
            open={!!duplicateWarning}
            title="BOM Item Already Integrated"
            subtitle="This BOM item is already linked to an integration."
            onClose={() => setDuplicateWarning(null)}
          >
            {duplicateWarning && (
              <div>
                <p style={{ marginBottom: "16px" }}>
                  <strong>Existing Integration:</strong>
                </p>
                <div className="poi-duplicate-details">
                  {(() => {
                    const existing = duplicateWarning.existing;
                    const project = projects.find(
                      (p) => p.id === existing.projectId,
                    );
                    const drawing = drawings.find(
                      (d) => d.id === existing.drawingId,
                    );
                    const bom = bomItems.find((b) => b.id === existing.bomId);
                    const po = existing.dummy
                      ? null
                      : purchaseOrders.find((p) => p.id === existing.poId);
                    const poItem = existing.dummy
                      ? null
                      : po?.items.find((i) => i.id === existing.poItemId);
                    return (
                      <div className="form-grid">
                        <div className="poi-kv">
                          <span>Project</span>
                          <strong>{project?.name}</strong>
                        </div>
                        <div className="poi-kv">
                          <span>DWG</span>
                          <strong>
                            {drawing?.dwgNumber} (Rev {drawing?.revision})
                          </strong>
                        </div>
                        <div className="poi-kv">
                          <span>BOM Item</span>
                          <strong>
                            {bom?.itemNumber} — {bom?.description}
                          </strong>
                        </div>
                        <div className="poi-kv">
                          <span>PO</span>
                          <strong>
                            {existing.dummy ? "Dummy PO" : po?.poNumber}
                          </strong>
                        </div>
                        <div className="poi-kv">
                          <span>Description</span>
                          <strong>
                            {existing.dummy
                              ? existing.dummyData?.description
                              : poItem?.description}
                          </strong>
                        </div>
                        <div className="poi-kv">
                          <span>Integrated Qty</span>
                          <strong>{existing.quantity}</strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div
                  className="form-actions"
                  style={{
                    marginTop: "20px",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDuplicateAction("cancel")}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDuplicateAction("edit")}
                  >
                    Edit Existing
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDuplicateAction("delete-create")}
                  >
                    Delete &amp; Create New
                  </button>
                </div>
              </div>
            )}
          </Modal>

          {/* Confirm Delete Dialog */}
          <ConfirmDialog
            open={!!deleteTarget}
            title="Delete Integration?"
            message={
              deleteTarget
                ? `This will remove the integration for ${
                    deleteTarget.dummy
                      ? "Dummy PO"
                      : deleteTarget.materialStockId
                        ? deleteTarget.materialStockSnapshot?.poNumber ||
                          "Material Stock"
                        : purchaseOrders.find((p) => p.id === deleteTarget.poId)
                            ?.poNumber
                  } and release the quantity back to ${
                    deleteTarget.materialStockId
                      ? "Material Stock."
                      : "the PO balance."
                  }`
                : ""
            }
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDelete}
          />

          {/* Material Stock Integration Modal */}
          <Modal
            open={!!stockModalItem}
            title={`Integrate ${stockModalItem?.poNumber || ""}`}
            subtitle="Link this available Material Stock to a Project / DWG / BOM item."
            onClose={() => setStockModalItem(null)}
          >
            {stockModalItem && (
              <div
                className="poi-integration-grid"
                style={{ marginBottom: "16px" }}
              >
                <div className="poi-kv">
                  <span>PO Number</span>
                  <strong>{stockModalItem.poNumber}</strong>
                </div>
                <div className="poi-kv">
                  <span>PO Description</span>
                  <strong>{stockModalItem.description}</strong>
                </div>
                <div className="poi-kv">
                  <span>Material</span>
                  <strong>{stockModalItem.material}</strong>
                </div>
                <div className="poi-kv">
                  <span>Thickness</span>
                  <strong>{stockModalItem.thickness}</strong>
                </div>
                <div className="poi-kv">
                  <span>Size</span>
                  <strong>{stockModalItem.size}</strong>
                </div>
                <div className="poi-kv">
                  <span>Unit</span>
                  <strong>{stockModalItem.unit}</strong>
                </div>
                <div className="poi-kv">
                  <span>Available Quantity</span>
                  <strong>{stockModalItem.availableQuantity}</strong>
                </div>
                <div className="poi-kv">
                  <span>Source</span>
                  <strong style={{ fontSize: "12px" }}>
                    {stockModalItem.source}
                  </strong>
                </div>
              </div>
            )}
            <div className="form-section-title">
              Link to Project / DWG / BOM
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>Project</label>
                <select
                  value={stockProjectId}
                  onChange={(e) => {
                    setStockProjectId(e.target.value);
                    const firstDwg = drawings.find(
                      (d) => d.projectId === e.target.value,
                    );
                    setStockDrawingId(firstDwg ? firstDwg.id : "");
                    const firstBom = firstDwg
                      ? bomItems.find((b) => b.drawingId === firstDwg.id)
                      : null;
                    setStockBomId(firstBom ? firstBom.id : "");
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>DWG</label>
                <select
                  value={stockDrawingId}
                  onChange={(e) => {
                    setStockDrawingId(e.target.value);
                    const firstBom = bomItems.find(
                      (b) => b.drawingId === e.target.value,
                    );
                    setStockBomId(firstBom ? firstBom.id : "");
                  }}
                >
                  {stockProjectDrawings.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dwgNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field form-field-full">
                <label>BOM Item</label>
                <select
                  value={stockBomId}
                  onChange={(e) => setStockBomId(e.target.value)}
                >
                  {stockDrawingBom.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.itemNumber} — {b.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>
                  Integration Quantity <span className="required-mark">*</span>
                </label>
                <input
                  type="number"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  min="1"
                  max={stockModalItem?.availableQuantity || 0}
                />
                <span className="form-hint">
                  Available: {stockModalItem?.availableQuantity}
                </span>
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStockModalItem(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveStockIntegration}
                disabled={
                  !stockQty ||
                  Number(stockQty) <= 0 ||
                  Number(stockQty) > (stockModalItem?.availableQuantity || 0)
                }
              >
                Integrate
              </button>
            </div>
          </Modal>
        </div>
      </div>
    </>
  );
}
