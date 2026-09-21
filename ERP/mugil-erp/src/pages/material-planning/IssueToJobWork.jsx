import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  Layers,
  AlertTriangle,
  PackageSearch,
  Building2,
  Warehouse,
  CheckCircle2,
  ArrowRight,
  Plus,
  Truck,
  Send,
} from "lucide-react";
import Header from "../../components/Header";
import "./IssueToJobWork.css";

// =====================================================================
// Mock reference data
// Kept identical to MaterialStock.jsx so records line up when a stock
// item is passed over from the Material Stock page.
// =====================================================================
const units = ["Unit 1", "Unit 2"];
const sourceTypes = ["PO", "Dummy PO", "Job Remaining", "Cutting Remaining"];
const materialOptions = [
  "Plate",
  "Pipe",
  "Channel",
  "Angle",
  "Flat",
  "Beam",
  "Round Bar",
];

const initialStock = [
  {
    id: "stk-1",
    stockId: "STK-1001",
    unit: "Unit 1",
    sourceType: "PO",
    poNumber: "PO-001",
    description: "Description-1",
    material: "Plate",
    materialCode: "15110292000",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    size: "1500 x 3000",
    heatNumber: "HN-24581",
    plateNumber: "PL-001",
    originalQuantity: 5,
    availableQuantity: 5,
    uom: "Nos",
    project: "BHEL Boiler Fabrication",
    dwgDescription: "DWG-001 / Description-1",
    revision: "REV-01",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-2",
    stockId: "STK-1002",
    unit: "Unit 1",
    sourceType: "Dummy PO",
    poNumber: "DPO-001",
    description: "Description-1",
    material: "Channel",
    materialCode: "15010135000",
    materialSpec: "IS2062 E250A",
    thickness: "6 mm",
    size: "100 x 50 x 5",
    heatNumber: "—",
    plateNumber: "—",
    originalQuantity: 6,
    availableQuantity: 6,
    uom: "Nos",
    project: "—",
    dwgDescription: "—",
    revision: "—",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-3",
    stockId: "STK-1003",
    unit: "Unit 2",
    sourceType: "Job Remaining",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    size: "100 NB",
    heatNumber: "HN-19042",
    plateNumber: "—",
    originalQuantity: 10,
    availableQuantity: 3,
    uom: "Mtr",
    project: "NTPC Structural Project",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    stockStatus: "Remaining",
    reworkRequired: "No",
  },
  {
    id: "stk-4",
    stockId: "STK-1004",
    unit: "Unit 1",
    sourceType: "Cutting Remaining",
    poNumber: "PO-001",
    description: "Description-1",
    material: "Plate",
    materialCode: "15110292000",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    size: "2000 x 2000",
    heatNumber: "HN-24581",
    plateNumber: "PL-001-R1",
    originalQuantity: 1,
    availableQuantity: 1,
    uom: "Nos",
    project: "BHEL Boiler Fabrication",
    dwgDescription: "DWG-001 / Description-1",
    revision: "REV-01",
    stockStatus: "Cutting Remaining",
    reworkRequired: "Yes",
  },
  {
    id: "stk-5",
    stockId: "STK-1005",
    unit: "Unit 1",
    sourceType: "PO",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    size: "100 NB",
    heatNumber: "HN-19043",
    plateNumber: "—",
    originalQuantity: 4,
    availableQuantity: 2,
    uom: "Mtr",
    project: "NTPC Structural Project",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-6",
    stockId: "STK-1006",
    unit: "Unit 1",
    sourceType: "PO",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    size: "150 NB",
    heatNumber: "HN-19044",
    plateNumber: "—",
    originalQuantity: 4,
    availableQuantity: 4,
    uom: "Mtr",
    project: "NTPC Structural Project",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-7",
    stockId: "STK-1007",
    unit: "Unit 1",
    sourceType: "PO",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "6 mm",
    size: "100 NB",
    heatNumber: "HN-19045",
    plateNumber: "—",
    originalQuantity: 5,
    availableQuantity: 5,
    uom: "Mtr",
    project: "NTPC Structural Project",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-8",
    stockId: "STK-1008",
    unit: "Unit 1",
    sourceType: "PO",
    poNumber: "PO-003",
    description: "Description-1",
    material: "Angle",
    materialCode: "15013159000",
    materialSpec: "IS2062 E250A",
    thickness: "6 mm",
    size: "65 x 65 x 6",
    heatNumber: "HN-30021",
    plateNumber: "—",
    originalQuantity: 12,
    availableQuantity: 0,
    uom: "Nos",
    project: "—",
    dwgDescription: "—",
    revision: "—",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-9",
    stockId: "STK-1009",
    unit: "Unit 2",
    sourceType: "PO",
    poNumber: "PO-002",
    description: "Description-3",
    material: "Angle",
    materialCode: "15013160000",
    materialSpec: "IS2062 E250A",
    thickness: "6 mm",
    size: "65 x 65 x 6",
    heatNumber: "HN-30099",
    plateNumber: "—",
    originalQuantity: 8,
    availableQuantity: 8,
    uom: "Nos",
    project: "—",
    dwgDescription: "—",
    revision: "—",
    stockStatus: "Available",
    reworkRequired: "No",
  },
  {
    id: "stk-10",
    stockId: "STK-1010",
    unit: "Unit 2",
    sourceType: "Cutting Remaining",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    size: "100 NB",
    heatNumber: "HN-19042-R",
    plateNumber: "—",
    originalQuantity: 1,
    availableQuantity: 1,
    uom: "Mtr",
    project: "NTPC Structural Project",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    stockStatus: "Cutting Remaining",
    reworkRequired: "No",
  },
];

// Which PO + Description pairs have already been integrated with a
// DWG/BOM in the PO Integration process. Anything not listed here is
// treated as "Not Integrated".
const integrationMap = {
  "PO-001|Description-1": {
    project: "BHEL Boiler Fabrication",
    dwg: "DWG-001",
    description: "Description-1",
    revision: "REV-01",
    requirements: [
      {
        material: "Plate",
        thickness: "8 mm",
        requiredQty: 24,
        uom: "Nos",
        size: "300 x 400 mm",
      },
      {
        material: "Plate",
        thickness: "10 mm",
        requiredQty: 12,
        uom: "Nos",
        size: "500 x 600 mm",
      },
      {
        material: "Pipe",
        thickness: "4 mm",
        requiredQty: 10,
        uom: "Mtr",
        size: "100 NB",
      },
    ],
  },
  "PO-002|Description-2": {
    project: "NTPC Structural Project",
    dwg: "DWG-101",
    description: "Description-2",
    revision: "REV-01",
    requirements: [
      {
        material: "Pipe",
        thickness: "4 mm",
        requiredQty: 10,
        uom: "Mtr",
        size: "100 NB",
      },
    ],
  },
};
// Not integrated (intentionally excluded above):
//   DPO-001 | Description-1  — dummy PO, not yet linked to a drawing
//   PO-002  | Description-3  — received but BOM integration pending

const processesInitial = [
  { name: "Cutting", pid: "CUT01" },
  { name: "Rolling", pid: "ROLL01" },
  { name: "Bending", pid: "BEND01" },
  { name: "Drilling", pid: "DRL01" },
  { name: "Machining", pid: "MACH01" },
  { name: "Welding", pid: "WELD01" },
  { name: "Fabrication", pid: "FAB01" },
];

const employees = ["Arun", "Kumar", "Suresh", "Ravi", "Manoj"];

const vendors = [
  "Shree Fabricators",
  "Om Engineering Works",
  "Precision Metal Works",
  "Bharat CNC Solutions",
];

const initialHistory = [
  {
    id: "ISS-001",
    date: "2026-08-28",
    poNumber: "PO-001",
    description: "Description-1",
    material: "Plate",
    process: "Cutting",
    processId: "CUT01",
    jobWorkType: "In-House",
    unit: "Unit 1",
    vendor: "—",
    quantity: 6,
    uom: "Nos",
    issuedBy: "Arun",
    status: "Issued",
  },
  {
    id: "ISS-002",
    date: "2026-08-30",
    poNumber: "PO-002",
    description: "Description-2",
    material: "Pipe",
    process: "Welding",
    processId: "WELD01",
    jobWorkType: "Outsourcing",
    unit: "—",
    vendor: "Shree Fabricators",
    quantity: 4,
    uom: "Mtr",
    issuedBy: "Suresh",
    status: "Issued",
  },
];

// =====================================================================
// Shared UI helpers
// =====================================================================
function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    Available: "success",
    Remaining: "warning",
    "Cutting Remaining": "info",
    PO: "info",
    "Dummy PO": "amber-outline",
    "Job Remaining": "warning",
    Yes: "warning",
    No: "neutral",
    "In-House": "info",
    Outsourcing: "amber-outline",
    Issued: "success",
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

// =====================================================================
// Main Component
// =====================================================================
const emptyAdvancedFilters = {
  material: "All",
  thickness: "",
  size: "",
  poNumber: "",
  materialCode: "",
  materialSpec: "",
  heatNumber: "",
  plateNumber: "",
  project: "",
  dwgDescription: "",
  sourceType: "All",
  reworkRequired: "All",
};

export default function IssueToJobWork() {
  const navigate = useNavigate();
  const location = useLocation();

  const [stock, setStock] = useState(initialStock);
  const [processes, setProcesses] = useState(processesInitial);
  const [history, setHistory] = useState(initialHistory);

  const [search, setSearch] = useState("");
  const [unitTab, setUnitTab] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyAdvancedFilters);

  const [issueTargetId, setIssueTargetId] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Job work form state
  const [jobWorkType, setJobWorkType] = useState(null);
  const [jobWorkUnit, setJobWorkUnit] = useState("Unit 1");
  const [process, setProcess] = useState("");
  const [showCreateProcess, setShowCreateProcess] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [newProcessId, setNewProcessId] = useState("");
  const [processError, setProcessError] = useState("");
  const [issueQty, setIssueQty] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [jobWorkLocation, setJobWorkLocation] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [formError, setFormError] = useState("");

  // Pick up a stock record handed over from Material Stock's "Issue" action.
  useEffect(() => {
    const stockId = location.state?.stockId;
    if (stockId) {
      setIssueTargetId(stockId);
    }
  }, [location.state]);

  // Reset the form whenever a new stock item is opened for issuing.
  useEffect(() => {
    if (issueTargetId) {
      setJobWorkType(null);
      setJobWorkUnit("Unit 1");
      setProcess("");
      setShowCreateProcess(false);
      setNewProcessName("");
      setNewProcessId("");
      setProcessError("");
      setIssueQty("");
      setIssuedBy("");
      setRemarks("");
      setVendor("");
      setVendorContact("");
      setJobWorkLocation("");
      setExpectedReturnDate("");
      setFormError("");
    }
  }, [issueTargetId]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const projectOptions = useMemo(
    () => [...new Set(stock.map((s) => s.project).filter((p) => p !== "—"))],
    [stock],
  );

  // Only material with Available Quantity > 0 can be issued.
  const activeStock = useMemo(
    () => stock.filter((s) => s.availableQuantity > 0),
    [stock],
  );

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeStock.filter((s) => {
      const matchesSearch =
        !q ||
        [
          s.poNumber,
          s.description,
          s.material,
          s.materialCode,
          s.materialSpec,
          s.thickness,
          s.size,
          s.heatNumber,
          s.plateNumber,
          s.project,
          s.dwgDescription,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesUnit = unitTab === "All" || s.unit === unitTab;
      const matchesMaterial =
        filters.material === "All" || s.material === filters.material;
      const matchesThickness =
        !filters.thickness.trim() ||
        s.thickness
          .toLowerCase()
          .includes(filters.thickness.trim().toLowerCase());
      const matchesSize =
        !filters.size.trim() ||
        s.size.toLowerCase().includes(filters.size.trim().toLowerCase());
      const matchesPo =
        !filters.poNumber.trim() ||
        s.poNumber
          .toLowerCase()
          .includes(filters.poNumber.trim().toLowerCase());
      const matchesCode =
        !filters.materialCode.trim() ||
        s.materialCode
          .toLowerCase()
          .includes(filters.materialCode.trim().toLowerCase());
      const matchesSpec =
        !filters.materialSpec.trim() ||
        s.materialSpec
          .toLowerCase()
          .includes(filters.materialSpec.trim().toLowerCase());
      const matchesHeat =
        !filters.heatNumber.trim() ||
        s.heatNumber
          .toLowerCase()
          .includes(filters.heatNumber.trim().toLowerCase());
      const matchesPlate =
        !filters.plateNumber.trim() ||
        s.plateNumber
          .toLowerCase()
          .includes(filters.plateNumber.trim().toLowerCase());
      const matchesProject =
        !filters.project.trim() ||
        s.project.toLowerCase().includes(filters.project.trim().toLowerCase());
      const matchesDwg =
        !filters.dwgDescription.trim() ||
        s.dwgDescription
          .toLowerCase()
          .includes(filters.dwgDescription.trim().toLowerCase());
      const matchesSource =
        filters.sourceType === "All" || s.sourceType === filters.sourceType;
      const matchesRework =
        filters.reworkRequired === "All" ||
        s.reworkRequired === filters.reworkRequired;

      return (
        matchesSearch &&
        matchesUnit &&
        matchesMaterial &&
        matchesThickness &&
        matchesSize &&
        matchesPo &&
        matchesCode &&
        matchesSpec &&
        matchesHeat &&
        matchesPlate &&
        matchesProject &&
        matchesDwg &&
        matchesSource &&
        matchesRework
      );
    });
  }, [activeStock, search, unitTab, filters]);

  const hasActiveFilters =
    search.trim() !== "" ||
    unitTab !== "All" ||
    Object.entries(filters).some(([key, val]) =>
      ["material", "sourceType", "reworkRequired"].includes(key)
        ? val !== "All"
        : val.trim() !== "",
    );

  function clearFilters() {
    setSearch("");
    setUnitTab("All");
    setFilters(emptyAdvancedFilters);
  }

  function isIntegratedRecord(s) {
    return !!integrationMap[`${s.poNumber}|${s.description}`];
  }

  // ---------------- summary cards ----------------
  const summary = useMemo(() => {
    const total = activeStock.length;
    const unit1 = activeStock.filter((s) => s.unit === "Unit 1").length;
    const unit2 = activeStock.filter((s) => s.unit === "Unit 2").length;
    const readyToIssue = activeStock.filter(isIntegratedRecord).length;
    return { total, unit1, unit2, readyToIssue };
  }, [activeStock]);

  // ---------------- issue modal ----------------
  const issueStock = useMemo(
    () => stock.find((s) => s.id === issueTargetId) || null,
    [stock, issueTargetId],
  );

  const integration = issueStock
    ? integrationMap[`${issueStock.poNumber}|${issueStock.description}`]
    : null;
  const isIntegrated = !!integration;

  function openIssue(stockItem) {
    setIssueTargetId(stockItem.id);
  }

  function closeIssue() {
    setIssueTargetId(null);
  }

  function handleProcessChange(e) {
    const val = e.target.value;
    if (val === "__create__") {
      setShowCreateProcess(true);
      return;
    }
    setProcess(val);
  }

  function handleCreateProcess() {
    const name = newProcessName.trim();
    const pid = newProcessId.trim().toUpperCase();
    if (!name || !pid) {
      setProcessError("Enter both a process name and a process ID.");
      return;
    }
    if (processes.some((p) => p.pid.toLowerCase() === pid.toLowerCase())) {
      setProcessError("This Process ID already exists. Use a unique ID.");
      return;
    }
    setProcesses((prev) => [...prev, { name, pid }]);
    setProcess(pid);
    setShowCreateProcess(false);
    setNewProcessName("");
    setNewProcessId("");
    setProcessError("");
  }

  const liveQtyError = useMemo(() => {
    if (!issueStock || issueQty === "") return "";
    const n = Number(issueQty);
    if (Number.isNaN(n)) return "Enter a valid number.";
    if (n <= 0) return "Issue quantity must be greater than 0.";
    if (n > issueStock.availableQuantity)
      return `Only ${issueStock.availableQuantity} ${issueStock.uom} are available to issue.`;
    return "";
  }, [issueQty, issueStock]);

  function validateCommon() {
    if (!issueStock) return "Select a material to issue.";
    if (!isIntegrated)
      return "Complete DWG/BOM integration before issuing this material.";
    if (!jobWorkType) return "Select a job work type.";
    if (!process) return "Select a process.";
    const n = Number(issueQty);
    if (issueQty === "" || Number.isNaN(n) || n <= 0)
      return "Enter a valid issue quantity.";
    if (n > issueStock.availableQuantity)
      return `Only ${issueStock.availableQuantity} ${issueStock.uom} are available to issue.`;
    if (!issuedBy) return "Select who is issuing this material.";
    if (jobWorkType === "In-House" && !jobWorkUnit)
      return "Select the job work unit.";
    if (jobWorkType === "Outsourcing") {
      if (!vendor) return "Select a vendor.";
      if (!jobWorkLocation.trim()) return "Enter the job work location.";
      if (!expectedReturnDate) return "Enter the expected return date.";
    }
    return "";
  }

  function nextIssueId() {
    return `ISS-${String(history.length + 1).padStart(3, "0")}`;
  }

  function applyStockDeduction(qty) {
    setStock((prev) =>
      prev.map((s) =>
        s.id === issueStock.id
          ? { ...s, availableQuantity: s.availableQuantity - qty }
          : s,
      ),
    );
  }

  function handleIssueMaterial() {
    const err = validateCommon();
    if (err) {
      setFormError(err);
      return;
    }
    const qty = Number(issueQty);
    const procMeta = processes.find((p) => p.pid === process);
    applyStockDeduction(qty);
    setHistory((prev) => [
      {
        id: nextIssueId(),
        date: new Date().toISOString().slice(0, 10),
        poNumber: issueStock.poNumber,
        description: issueStock.description,
        material: issueStock.material,
        process: procMeta ? procMeta.name : process,
        processId: process,
        jobWorkType: "In-House",
        unit: jobWorkUnit,
        vendor: "—",
        quantity: qty,
        uom: issueStock.uom,
        issuedBy,
        status: "Issued",
      },
      ...prev,
    ]);
    setSuccessMsg(
      `${qty} ${issueStock.uom} of ${issueStock.material} issued to ${jobWorkUnit} for ${procMeta ? procMeta.name : process}.`,
    );
    closeIssue();
  }

  function handleContinueToChallan() {
    const err = validateCommon();
    if (err) {
      setFormError(err);
      return;
    }
    const qty = Number(issueQty);
    const procMeta = processes.find((p) => p.pid === process);
    const payload = {
      poNumber: issueStock.poNumber,
      poDescription: issueStock.description,
      material: issueStock.material,
      materialCode: issueStock.materialCode,
      specification: issueStock.materialSpec,
      thickness: issueStock.thickness,
      size: issueStock.size,
      quantity: qty,
      uom: issueStock.uom,
      project: integration?.project,
      dwg: integration?.dwg,
      revision: integration?.revision,
      process: procMeta ? procMeta.name : process,
      processId: process,
      jobWorkType: "Outsourcing",
      vendor,
      vendorContact,
      jobWorkLocation,
      expectedReturnDate,
      remarks,
    };
    applyStockDeduction(qty);
    setHistory((prev) => [
      {
        id: nextIssueId(),
        date: new Date().toISOString().slice(0, 10),
        poNumber: issueStock.poNumber,
        description: issueStock.description,
        material: issueStock.material,
        process: procMeta ? procMeta.name : process,
        processId: process,
        jobWorkType: "Outsourcing",
        unit: "—",
        vendor,
        quantity: qty,
        uom: issueStock.uom,
        issuedBy,
        status: "Issued",
      },
      ...prev,
    ]);
    closeIssue();
    navigate("/accounts/DeliveryChallan", { state: payload });
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
                <h1 className="page-header-title">Issue to Job Work</h1>
                <p className="page-header-subtitle">
                  Issue available material for in-house or outsourced job work.
                </p>
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="inline-success">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg("")} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Summary cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-neutral">
                <PackageSearch size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.total}</span>
                <span className="summary-card-label">Available Materials</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-info">
                <Building2 size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.unit1}</span>
                <span className="summary-card-label">Unit 1</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-info">
                <Warehouse size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.unit2}</span>
                <span className="summary-card-label">Unit 2</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-success">
                <CheckCircle2 size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.readyToIssue}</span>
                <span className="summary-card-label">Ready to Issue</span>
              </div>
            </div>
          </div>

          {/* Available material */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-head-title">Available Material</div>
                <p className="panel-head-subtitle">
                  Select material to issue for in-house or outsourced job work.
                </p>
              </div>
              <div className="unit-tabs">
                {["All", ...units].map((u) => (
                  <button
                    key={u}
                    className={`unit-tab ${unitTab === u ? "unit-tab-active" : ""}`}
                    onClick={() => setUnitTab(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-toolbar">
              <div className="panel-toolbar-search">
                <Search size={14} />
                <input
                  placeholder="Search materials... (PO, description, material, code, size, heat no, project, DWG)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="panel-toolbar-filter"
                value={unitTab}
                onChange={(e) => setUnitTab(e.target.value)}
              >
                <option value="All">All Units</option>
                {units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <button
                className={`btn btn-secondary btn-sm ${showFilters ? "btn-outline-active" : ""}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Filters
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
                  <label htmlFor="issue-filter-material">Material</label>
                  <select
                    id="issue-filter-material"
                    value={filters.material}
                    onChange={(e) => updateFilter("material", e.target.value)}
                  >
                    <option>All</option>
                    {materialOptions.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-thickness">Thickness</label>
                  <input
                    id="issue-filter-thickness"
                    placeholder="e.g. 8"
                    value={filters.thickness}
                    onChange={(e) => updateFilter("thickness", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-size">Size</label>
                  <input
                    id="issue-filter-size"
                    placeholder="e.g. 100 NB, 1500 x 3000"
                    value={filters.size}
                    onChange={(e) => updateFilter("size", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-po-number">PO Number</label>
                  <input
                    id="issue-filter-po-number"
                    placeholder="e.g. PO-001"
                    value={filters.poNumber}
                    onChange={(e) => updateFilter("poNumber", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-material-code">Material Code</label>
                  <input
                    id="issue-filter-material-code"
                    value={filters.materialCode}
                    onChange={(e) => updateFilter("materialCode", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-material-spec">Specification</label>
                  <input
                    id="issue-filter-material-spec"
                    placeholder="e.g. IS2062 E250A"
                    value={filters.materialSpec}
                    onChange={(e) => updateFilter("materialSpec", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-heat-number">Heat Number</label>
                  <input
                    id="issue-filter-heat-number"
                    value={filters.heatNumber}
                    onChange={(e) => updateFilter("heatNumber", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-plate-number">Plate Number</label>
                  <input
                    id="issue-filter-plate-number"
                    value={filters.plateNumber}
                    onChange={(e) => updateFilter("plateNumber", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-project">Project</label>
                  <input
                    id="issue-filter-project"
                    list="issue-project-options"
                    placeholder="e.g. BHEL Boiler Fabrication"
                    value={filters.project}
                    onChange={(e) => updateFilter("project", e.target.value)}
                  />
                  <datalist id="issue-project-options">
                    {projectOptions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-dwg-description">
                    DWG / Description
                  </label>
                  <input
                    id="issue-filter-dwg-description"
                    placeholder="e.g. DWG-001"
                    value={filters.dwgDescription}
                    onChange={(e) => updateFilter("dwgDescription", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-unit">Unit</label>
                  <select
                    id="issue-filter-unit"
                    value={unitTab}
                    onChange={(e) => setUnitTab(e.target.value)}
                  >
                    <option value="All">All</option>
                    {units.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-source-type">Source Type</label>
                  <select
                    id="issue-filter-source-type"
                    value={filters.sourceType}
                    onChange={(e) => updateFilter("sourceType", e.target.value)}
                  >
                    <option>All</option>
                    {sourceTypes.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="issue-filter-rework">Rework Required</label>
                  <select
                    id="issue-filter-rework"
                    value={filters.reworkRequired}
                    onChange={(e) => updateFilter("reworkRequired", e.target.value)}
                  >
                    <option>All</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
              </div>
            )}

            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock ID</th>
                    <th>Unit</th>
                    <th>PO Number</th>
                    <th>Description</th>
                    <th>Material</th>
                    <th>Material Code</th>
                    <th>Specification</th>
                    <th>Thickness</th>
                    <th>Size</th>
                    <th>Available Qty</th>
                    <th>Project</th>
                    <th>DWG / Description</th>
                    <th>Revision</th>
                    <th>Rework Required</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-mono">{s.stockId}</td>
                      <td>{s.unit}</td>
                      <td className="cell-mono">{s.poNumber}</td>
                      <td>{s.description}</td>
                      <td>{s.material}</td>
                      <td className="cell-mono">{s.materialCode}</td>
                      <td>{s.materialSpec}</td>
                      <td>{s.thickness}</td>
                      <td>{s.size}</td>
                      <td>
                        <strong>{s.availableQuantity}</strong> {s.uom}
                      </td>
                      <td className={s.project === "—" ? "cell-muted" : ""}>
                        {s.project}
                      </td>
                      <td className={s.dwgDescription === "—" ? "cell-muted" : ""}>
                        {s.dwgDescription}
                      </td>
                      <td className={s.revision === "—" ? "cell-muted" : ""}>
                        {s.revision}
                      </td>
                      <td>
                        <StatusBadge status={s.reworkRequired} />
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openIssue(s)}
                        >
                          Issue
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={15}>
                        <div className="empty-state">
                          <p className="empty-state-title">
                            No material matches your search or filters
                          </p>
                          <p className="empty-state-desc">
                            Try a different thickness, size, PO number or clear
                            filters to see all available material.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Issue history */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-head-title">Issue History</div>
                <p className="panel-head-subtitle">
                  Material already issued for in-house or outsourced job work.
                </p>
              </div>
            </div>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Issue ID</th>
                    <th>Date</th>
                    <th>PO Number</th>
                    <th>Description</th>
                    <th>Material</th>
                    <th>Process</th>
                    <th>Process ID</th>
                    <th>Job Work Type</th>
                    <th>Unit</th>
                    <th>Vendor</th>
                    <th>Quantity</th>
                    <th>Issued By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="cell-mono">{h.id}</td>
                      <td>{h.date}</td>
                      <td className="cell-mono">{h.poNumber}</td>
                      <td>{h.description}</td>
                      <td>{h.material}</td>
                      <td>{h.process}</td>
                      <td className="cell-mono">{h.processId}</td>
                      <td>
                        <StatusBadge status={h.jobWorkType} />
                      </td>
                      <td className={h.unit === "—" ? "cell-muted" : ""}>
                        {h.unit}
                      </td>
                      <td className={h.vendor === "—" ? "cell-muted" : ""}>
                        {h.vendor}
                      </td>
                      <td>
                        <strong>{h.quantity}</strong> {h.uom}
                      </td>
                      <td>{h.issuedBy}</td>
                      <td>
                        <StatusBadge status={h.status} />
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={13}>
                        <div className="empty-state">
                          <p className="empty-state-title">
                            No material has been issued yet
                          </p>
                          <p className="empty-state-desc">
                            Issued material for job work will appear here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Issue to Job Work modal */}
          <Modal
            open={!!issueStock}
            title="Issue to Job Work"
            subtitle={
              issueStock ? `${issueStock.poNumber} · ${issueStock.description}` : ""
            }
            onClose={closeIssue}
          >
            {issueStock && (
              <div className="issue-form">
                {/* Selected material — shown first, always */}
                <div className="selected-material-card">
                  <div className="selected-material-head">
                    <span className="selected-material-id">
                      {issueStock.stockId}
                    </span>
                    <StatusBadge status={issueStock.sourceType} />
                  </div>
                  <div className="kv-grid kv-grid-compact">
                    <div className="kv">
                      <span>PO Number</span>
                      <strong className="mono">{issueStock.poNumber}</strong>
                    </div>
                    <div className="kv">
                      <span>Description</span>
                      <strong>{issueStock.description}</strong>
                    </div>
                    <div className="kv">
                      <span>Material</span>
                      <strong>{issueStock.material}</strong>
                    </div>
                    <div className="kv">
                      <span>Specification</span>
                      <strong>{issueStock.materialSpec}</strong>
                    </div>
                    <div className="kv">
                      <span>Thickness</span>
                      <strong>{issueStock.thickness}</strong>
                    </div>
                    <div className="kv">
                      <span>Size</span>
                      <strong>{issueStock.size}</strong>
                    </div>
                    <div className="kv">
                      <span>Available Quantity</span>
                      <strong>
                        {issueStock.availableQuantity} {issueStock.uom}
                      </strong>
                    </div>
                    <div className="kv">
                      <span>Unit</span>
                      <strong>{issueStock.unit}</strong>
                    </div>
                    <div className="kv">
                      <span>Rework Required</span>
                      <StatusBadge status={issueStock.reworkRequired} />
                    </div>
                  </div>
                </div>

                {/* Integration check */}
                {isIntegrated ? (
                  <div className="integration-block integration-ok">
                    <div className="integration-block-head">
                      <CheckCircle2 size={16} />
                      <span>Integrated Requirement</span>
                    </div>
                    <div className="kv-grid kv-grid-compact">
                      <div className="kv">
                        <span>Project</span>
                        <strong>{integration.project}</strong>
                      </div>
                      <div className="kv">
                        <span>DWG</span>
                        <strong>{integration.dwg}</strong>
                      </div>
                      <div className="kv">
                        <span>Description</span>
                        <strong>{integration.description}</strong>
                      </div>
                    </div>
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Thickness</th>
                          <th>Required Qty</th>
                          <th>Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {integration.requirements.map((r, i) => (
                          <tr key={i}>
                            <td>{r.material}</td>
                            <td>{r.thickness}</td>
                            <td>
                              {r.requiredQty} {r.uom}
                            </td>
                            <td>{r.size}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="integration-block integration-warning">
                    <div className="integration-block-head">
                      <AlertTriangle size={16} />
                      <span>Integration Required</span>
                    </div>
                    <p>
                      <strong>
                        {issueStock.poNumber} / {issueStock.description}
                      </strong>{" "}
                      is not integrated with a DWG/BOM. Please complete the
                      integration first.
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        closeIssue();
                        navigate("/inventory/material/po-integration");
                      }}
                    >
                      Go to DWG + BOM Integration <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Remaining form only unlocks once integration is confirmed */}
                {isIntegrated && (
                  <>
                    <div className="form-field">
                      <label id="job-work-type-label">Job Work Type</label>
                      <div
                        className="segment-toggle"
                        role="group"
                        aria-labelledby="job-work-type-label"
                      >
                        <button
                          type="button"
                          className={`segment-btn ${jobWorkType === "In-House" ? "segment-btn-active" : ""}`}
                          onClick={() => setJobWorkType("In-House")}
                        >
                          <Building2 size={14} /> In-House
                        </button>
                        <button
                          type="button"
                          className={`segment-btn ${jobWorkType === "Outsourcing" ? "segment-btn-active" : ""}`}
                          onClick={() => setJobWorkType("Outsourcing")}
                        >
                          <Truck size={14} /> Outsourcing
                        </button>
                      </div>
                    </div>

                    {jobWorkType === "In-House" && (
                      <div className="form-field">
                        <label htmlFor="job-work-unit">
                          Receiving / Job Work Unit
                        </label>
                        <select
                          id="job-work-unit"
                          value={jobWorkUnit}
                          onChange={(e) => setJobWorkUnit(e.target.value)}
                        >
                          <option>Unit 1</option>
                          <option>Unit 2</option>
                        </select>
                      </div>
                    )}

                    {jobWorkType && (
                      <>
                        <div className="form-field">
                          <label htmlFor="issue-process">Process</label>
                          <select
                            id="issue-process"
                            value={process}
                            onChange={handleProcessChange}
                          >
                            <option value="">Select process</option>
                            {processes.map((p) => (
                              <option key={p.pid} value={p.pid}>
                                {p.name} - {p.pid}
                              </option>
                            ))}
                            <option value="__create__">+ Create New Process</option>
                          </select>
                        </div>

                        <div className="form-row-2">
                          <div className="form-field">
                            <label htmlFor="issue-available-qty">
                              Available Quantity
                            </label>
                            <input
                              id="issue-available-qty"
                              value={`${issueStock.availableQuantity} ${issueStock.uom}`}
                              disabled
                            />
                          </div>
                          <div className="form-field">
                            <label htmlFor="issue-qty">Issue Quantity</label>
                            <input
                              id="issue-qty"
                              type="number"
                              min="1"
                              placeholder="e.g. 6"
                              value={issueQty}
                              onChange={(e) => setIssueQty(e.target.value)}
                            />
                            {liveQtyError && (
                              <span className="field-error">{liveQtyError}</span>
                            )}
                          </div>
                        </div>

                        <div className="form-field">
                          <label htmlFor="issued-by">Issued By</label>
                          <select
                            id="issued-by"
                            value={issuedBy}
                            onChange={(e) => setIssuedBy(e.target.value)}
                          >
                            <option value="">Select employee</option>
                            {employees.map((emp) => (
                              <option key={emp}>{emp}</option>
                            ))}
                          </select>
                        </div>

                        {jobWorkType === "In-House" && (
                          <div className="form-field">
                            <label htmlFor="issue-remarks">Remarks (optional)</label>
                            <textarea
                              id="issue-remarks"
                              rows={2}
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                            />
                          </div>
                        )}

                        {jobWorkType === "Outsourcing" && (
                          <div className="outsourcing-block">
                            <div className="outsourcing-block-title">
                              Outsourcing Details
                            </div>
                            <div className="form-field">
                              <label htmlFor="outsourcing-vendor">Vendor</label>
                              <select
                                id="outsourcing-vendor"
                                value={vendor}
                                onChange={(e) => setVendor(e.target.value)}
                              >
                                <option value="">Select vendor</option>
                                {vendors.map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-row-2">
                              <div className="form-field">
                                <label htmlFor="outsourcing-vendor-contact">
                                  Vendor Contact
                                </label>
                                <input
                                  id="outsourcing-vendor-contact"
                                  placeholder="Phone / email"
                                  value={vendorContact}
                                  onChange={(e) => setVendorContact(e.target.value)}
                                />
                              </div>
                              <div className="form-field">
                                <label htmlFor="outsourcing-location">
                                  Job Work Location
                                </label>
                                <input
                                  id="outsourcing-location"
                                  placeholder="Vendor works address / city"
                                  value={jobWorkLocation}
                                  onChange={(e) =>
                                    setJobWorkLocation(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <div className="form-field">
                              <label htmlFor="outsourcing-return-date">
                                Expected Return Date
                              </label>
                              <input
                                id="outsourcing-return-date"
                                type="date"
                                value={expectedReturnDate}
                                onChange={(e) =>
                                  setExpectedReturnDate(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label htmlFor="outsourcing-remarks">
                                Remarks (optional)
                              </label>
                              <textarea
                                id="outsourcing-remarks"
                                rows={2}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                              />
                            </div>
                          </div>
                        )}

                        {formError && (
                          <div className="form-error-banner">
                            <AlertTriangle size={14} />
                            {formError}
                          </div>
                        )}

                        <div className="modal-actions">
                          <button className="btn btn-secondary" onClick={closeIssue}>
                            Cancel
                          </button>
                          {jobWorkType === "In-House" ? (
                            <button
                              className="btn btn-primary"
                              onClick={handleIssueMaterial}
                            >
                              Issue Material
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={handleContinueToChallan}
                            >
                              Continue to Delivery Challan <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </Modal>

          {/* Create New Process modal */}
          <Modal
            open={showCreateProcess}
            title="Create New Process"
            onClose={() => {
              setShowCreateProcess(false);
              setProcessError("");
            }}
          >
            <div className="form-field">
              <label htmlFor="new-process-name">Process Name</label>
              <input
                id="new-process-name"
                placeholder="e.g. Shot Blasting"
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label htmlFor="new-process-id">Process ID</label>
              <input
                id="new-process-id"
                placeholder="e.g. SHOT01"
                value={newProcessId}
                onChange={(e) => setNewProcessId(e.target.value.toUpperCase())}
              />
            </div>
            {processError && (
              <div className="form-error-banner" style={{ marginTop: 12 }}>
                <AlertTriangle size={14} />
                {processError}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateProcess(false);
                  setProcessError("");
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateProcess}>
                <Plus size={14} /> Create
              </button>
            </div>
          </Modal>
        </div>
      </div>
    </>
  );
}