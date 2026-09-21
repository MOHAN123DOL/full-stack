import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X } from "lucide-react";
import Header from "../../components/Header";
import "./IssueToProduction.css";

// =====================================================================
// Mock reference data
// Mirrors the records created by ReceiveFromJobWork.jsx — every job below
// represents one DWG/BOM/PO requirement that has already been through
// Job Work and come back with actual, physically received pieces.
// Available Material rows are generated from these pieces further down.
// =====================================================================
const employees = [
  "R. Kumar",
  "S. Elango",
  "Manoj Prabhu",
  "Arun Kumar",
  "Ravi Shankar",
];

const jobs = {
  "JW-1001": {
    jobWorkId: "JW-1001",
    poType: "Job Work PO",
    poNumber: "PO-001",
    supplier: "Sri Balaji Fabricators",
    poDescription: "Description-1",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "Base Plate Layout",
    revision: "R2",
    material: "Plate",
    materialCode: "MAT-PL-001",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Nos",
    process: "Cutting",
    processId: "CUT01",
    originalRequirement: {
      project: "BHEL Project",
      dwg: "DWG-001",
      description: "Description-1",
      material: "Plate",
      materialCode: "MAT-PL-001",
      materialSpec: "IS2062 E250A",
      thickness: "8 mm",
      requiredQty: "26 Nos",
      originalSize: "2000 × 2000",
      poNumber: "PO-001",
      poDescription: "Description-1",
    },
    pieces: [
      { pieceNo: "PL001", size: "250 × 250", thickness: "8 mm", qty: 10 },
      { pieceNo: "PL002", size: "260 × 260", thickness: "8 mm", qty: 20 },
      { pieceNo: "PL003", size: "300 × 400", thickness: "8 mm", qty: 15 },
    ],
  },
  "JW-1002": {
    jobWorkId: "JW-1002",
    poType: "Outsourced PO",
    poNumber: "PO-101",
    supplier: "Chennai Piping Works",
    poDescription: "Description-2",
    project: "NTPC Structural Project",
    dwg: "DWG-101",
    dwgDescription: "Pipe Rack Layout",
    revision: "R1",
    material: "Pipe",
    materialCode: "MAT-PP-100NB",
    materialSpec: "IS1239 Medium",
    thickness: "4 mm",
    unit: "Unit 2",
    jobWorkType: "Outsourcing",
    jobWorkUnit: "Mtr",
    process: "Welding",
    processId: "WELD01",
    originalRequirement: {
      project: "NTPC Structural Project",
      dwg: "DWG-101",
      description: "Description-2",
      material: "Pipe",
      materialCode: "MAT-PP-100NB",
      materialSpec: "IS1239 Medium",
      thickness: "4 mm",
      requiredQty: "20 Mtr",
      originalSize: "100 NB",
      poNumber: "PO-101",
      poDescription: "Description-2",
    },
    pieces: [
      { pieceNo: "PP101", size: "100 NB", thickness: "4 mm", qty: 12 },
      { pieceNo: "PP102", size: "100 NB", thickness: "4 mm", qty: 8 },
    ],
  },
  "JW-1003": {
    jobWorkId: "JW-1003",
    poType: "Direct PO",
    poNumber: "PO-205",
    supplier: "Apex Steel Traders",
    poDescription: "Description-3",
    project: "Vedanta Structural Project",
    dwg: "DWG-205",
    dwgDescription: "Channel Support Layout",
    revision: "R3",
    material: "Channel",
    materialCode: "MAT-CH-150",
    materialSpec: "IS808 ISMC150",
    thickness: "6 mm",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Nos",
    process: "Bending",
    processId: "BEND01",
    originalRequirement: {
      project: "Vedanta Structural Project",
      dwg: "DWG-205",
      description: "Description-3",
      material: "Channel",
      materialCode: "MAT-CH-150",
      materialSpec: "IS808 ISMC150",
      thickness: "6 mm",
      requiredQty: "28 Nos",
      originalSize: "150 × 75",
      poNumber: "PO-205",
      poDescription: "Description-3",
    },
    pieces: [
      { pieceNo: "CH201", size: "150 × 75", thickness: "6 mm", qty: 18 },
      { pieceNo: "CH202", size: "150 × 75", thickness: "6 mm", qty: 10 },
    ],
  },
};

// Previously-issued quantity, per physical piece, before this session opens.
// (Used only to seed the demo — real data would come from the Issue
// History transactions below.)
const initialIssuedMap = {
  "JW-1001-PL001": 6,
  "JW-1001-PL002": 0,
  "JW-1001-PL003": 15,
  "JW-1002-PP101": 0,
  "JW-1002-PP102": 8,
  "JW-1003-CH201": 5,
  "JW-1003-CH202": 0,
};

const computeStatus = (received, issued) => {
  if (issued <= 0) return "Available";
  if (issued >= received) return "Fully Issued";
  return "Partially Issued";
};

// -----------------------------------------------------------------------
// Available Material is built by flattening every actually-received piece
// out of the jobs above. Each piece is tracked independently — issuing
// against one piece never touches the available quantity of another.
// -----------------------------------------------------------------------
const buildInitialAvailableMaterial = () => {
  const rows = [];
  Object.values(jobs).forEach((job) => {
    job.pieces.forEach((piece) => {
      const key = `${job.jobWorkId}-${piece.pieceNo}`;
      const previouslyIssuedQty = initialIssuedMap[key] || 0;
      const availableQty = piece.qty - previouslyIssuedQty;
      rows.push({
        key,
        jobWorkId: job.jobWorkId,
        poType: job.poType,
        poNumber: job.poNumber,
        supplier: job.supplier,
        poDescription: job.poDescription,
        project: job.project,
        dwg: job.dwg,
        dwgDescription: job.dwgDescription,
        revision: job.revision,
        material: job.material,
        materialCode: job.materialCode,
        materialSpec: job.materialSpec,
        thickness: piece.thickness,
        size: piece.size,
        unit: job.unit,
        jobWorkType: job.jobWorkType,
        jobWorkUnit: job.jobWorkUnit,
        process: job.process,
        processId: job.processId,
        pieceNo: piece.pieceNo,
        receivedQty: piece.qty,
        previouslyIssuedQty,
        availableQty,
        status: computeStatus(piece.qty, previouslyIssuedQty),
      });
    });
  });
  return rows;
};

// -----------------------------------------------------------------------
// Seed Issue History — one record per past Issue to Production transaction.
// These stay visible forever, even after the related piece hits 0 available.
// -----------------------------------------------------------------------
const initialIssueHistory = [
  {
    issueId: "IP-0001",
    jobWorkId: "JW-1001",
    poType: "Job Work PO",
    poNumber: "PO-001",
    supplier: "Sri Balaji Fabricators",
    poDescription: "Description-1",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "Base Plate Layout",
    revision: "R2",
    material: "Plate",
    materialCode: "MAT-PL-001",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    size: "250 × 250",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Nos",
    process: "Cutting",
    processId: "CUT01",
    originalReceivedQty: 10,
    previouslyIssuedQty: 0,
    issuedNow: 6,
    remainingAvailableQty: 4,
    issuedBy: "R. Kumar",
    issueDate: "2026-09-02",
    status: "In Production",
  },
  {
    issueId: "IP-0002",
    jobWorkId: "JW-1001",
    poType: "Job Work PO",
    poNumber: "PO-001",
    supplier: "Sri Balaji Fabricators",
    poDescription: "Description-1",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "Base Plate Layout",
    revision: "R2",
    material: "Plate",
    materialCode: "MAT-PL-001",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    size: "300 × 400",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Nos",
    process: "Cutting",
    processId: "CUT01",
    originalReceivedQty: 15,
    previouslyIssuedQty: 0,
    issuedNow: 15,
    remainingAvailableQty: 0,
    issuedBy: "S. Elango",
    issueDate: "2026-08-29",
    status: "Completed",
  },
  {
    issueId: "IP-0003",
    jobWorkId: "JW-1002",
    poType: "Outsourced PO",
    poNumber: "PO-101",
    supplier: "Chennai Piping Works",
    poDescription: "Description-2",
    project: "NTPC Structural Project",
    dwg: "DWG-101",
    dwgDescription: "Pipe Rack Layout",
    revision: "R1",
    material: "Pipe",
    materialCode: "MAT-PP-100NB",
    materialSpec: "IS1239 Medium",
    thickness: "4 mm",
    size: "100 NB",
    unit: "Unit 2",
    jobWorkType: "Outsourcing",
    jobWorkUnit: "Mtr",
    process: "Welding",
    processId: "WELD01",
    originalReceivedQty: 8,
    previouslyIssuedQty: 0,
    issuedNow: 8,
    remainingAvailableQty: 0,
    issuedBy: "R. Kumar",
    issueDate: "2026-08-25",
    status: "In Production",
  },
  {
    issueId: "IP-0004",
    jobWorkId: "JW-1003",
    poType: "Direct PO",
    poNumber: "PO-205",
    supplier: "Apex Steel Traders",
    poDescription: "Description-3",
    project: "Vedanta Structural Project",
    dwg: "DWG-205",
    dwgDescription: "Channel Support Layout",
    revision: "R3",
    material: "Channel",
    materialCode: "MAT-CH-150",
    materialSpec: "IS808 ISMC150",
    thickness: "6 mm",
    size: "150 × 75",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Nos",
    process: "Bending",
    processId: "BEND01",
    originalReceivedQty: 18,
    previouslyIssuedQty: 0,
    issuedNow: 5,
    remainingAvailableQty: 13,
    issuedBy: "Manoj Prabhu",
    issueDate: "2026-09-01",
    status: "Issued",
  },
];

// -----------------------------------------------------------------------
// Shared filter configuration — identical fields/behaviour on both tabs,
// mirroring the Receive From Job Work search & filter convention.
// -----------------------------------------------------------------------
const FILTER_FIELDS = [
  { key: "thickness", label: "Thickness", type: "select" },
  { key: "material", label: "Material", type: "select" },
  { key: "size", label: "Size", type: "select" },
  { key: "poNumber", label: "PO Number", type: "text" },
  { key: "poDescription", label: "PO Description / Item", type: "text" },
  { key: "materialCode", label: "Material Code", type: "text" },
  { key: "materialSpec", label: "Material Specification", type: "text" },
  { key: "project", label: "Project", type: "select" },
  { key: "dwg", label: "DWG", type: "select" },
  { key: "dwgDescription", label: "DWG Description", type: "text" },
  { key: "revision", label: "Revision", type: "select" },
  { key: "unit", label: "Unit", type: "select" },
  { key: "jobWorkType", label: "Job Work Type", type: "select" },
  { key: "jobWorkId", label: "Job Work ID", type: "text" },
  { key: "process", label: "Process", type: "select" },
  { key: "processId", label: "Process ID", type: "text" },
  { key: "status", label: "Status", type: "select" },
];

const buildOptionsMap = (data) => {
  const map = {};
  FILTER_FIELDS.forEach((f) => {
    if (f.type === "select") {
      map[f.key] = [
        ...new Set(data.map((r) => r[f.key]).filter(Boolean)),
      ].sort();
    }
  });
  return map;
};

const matchesFilters = (row, filters) =>
  FILTER_FIELDS.every((f) => {
    const val = filters[f.key];
    if (!val) return true;
    const rowVal = String(row[f.key] ?? "").toLowerCase();
    return f.type === "select"
      ? rowVal === val.toLowerCase()
      : rowVal.includes(val.toLowerCase());
  });

const matchesSearch = (row, search, extraKeys = []) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  const fields = [
    "jobWorkId",
    "poNumber",
    "poDescription",
    "project",
    "dwg",
    "material",
    "materialCode",
    "dwgDescription",
    "materialSpec",
    ...extraKeys,
  ];
  return fields.some((k) =>
    String(row[k] ?? "")
      .toLowerCase()
      .includes(term),
  );
};

const generateIssueId = (count) => `IP-${String(count + 1).padStart(4, "0")}`;

const emptyIssueForm = () => ({
  quantity: "",
  issuedBy: "",
});

export default function IssueToProduction() {
  const navigate = useNavigate();

  const [availableMaterial, setAvailableMaterial] = useState(
    buildInitialAvailableMaterial(),
  );
  const [issueHistory, setIssueHistory] = useState(initialIssueHistory);

  const [activeTab, setActiveTab] = useState("available");

  const [availableSearch, setAvailableSearch] = useState("");
  const [availableFilters, setAvailableFilters] = useState({});
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilters, setHistoryFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewData, setViewData] = useState(null); // { type: 'available' | 'history', row }
  const [issueRow, setIssueRow] = useState(null);
  const [issueForm, setIssueForm] = useState(emptyIssueForm());
  const [issueError, setIssueError] = useState("");

  // ---------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------
  const visibleAvailable = useMemo(
    () => availableMaterial.filter((r) => r.availableQty > 0),
    [availableMaterial],
  );

  const filteredAvailable = useMemo(
    () =>
      visibleAvailable.filter(
        (r) =>
          matchesFilters(r, availableFilters) &&
          matchesSearch(r, availableSearch),
      ),
    [visibleAvailable, availableFilters, availableSearch],
  );

  const filteredHistory = useMemo(
    () =>
      issueHistory.filter(
        (r) =>
          matchesFilters(r, historyFilters) &&
          matchesSearch(r, historySearch, ["issueId"]),
      ),
    [issueHistory, historyFilters, historySearch],
  );

  const availableOptions = useMemo(
    () => buildOptionsMap(availableMaterial),
    [availableMaterial],
  );
  const historyOptions = useMemo(
    () => buildOptionsMap(issueHistory),
    [issueHistory],
  );

  // ---------------------------------------------------------------------
  // Tab / filter handlers
  // ---------------------------------------------------------------------
  const switchTab = (tab) => {
    setActiveTab(tab);
    setFiltersOpen(false);
  };

  const handleAvailableFilterChange = (key, value) =>
    setAvailableFilters((f) => ({ ...f, [key]: value }));
  const handleHistoryFilterChange = (key, value) =>
    setHistoryFilters((f) => ({ ...f, [key]: value }));

  const clearAvailableFilters = () => {
    setAvailableFilters({});
    setAvailableSearch("");
  };
  const clearHistoryFilters = () => {
    setHistoryFilters({});
    setHistorySearch("");
  };

  // ---------------------------------------------------------------------
  // Eye view
  // ---------------------------------------------------------------------
  const openView = (type, row) => setViewData({ type, row });
  const closeView = () => setViewData(null);

  // ---------------------------------------------------------------------
  // Issue to Production modal
  // ---------------------------------------------------------------------
  const openIssue = (row) => {
    setIssueRow(row);
    setIssueForm(emptyIssueForm());
    setIssueError("");
  };
  const closeIssue = () => {
    setIssueRow(null);
    setIssueForm(emptyIssueForm());
    setIssueError("");
  };

  const validateIssue = () => {
    if (!issueRow) return "No material selected.";
    const qty = Number(issueForm.quantity);
    if (!issueForm.quantity || !(qty > 0)) {
      return "Enter an Issue Quantity greater than 0.";
    }
    if (qty > issueRow.availableQty) {
      return `Issue Quantity (${qty}) can't exceed the Available Quantity (${issueRow.availableQty} ${issueRow.jobWorkUnit}).`;
    }
    if (!issueForm.issuedBy.trim()) {
      return "Please select Issued By.";
    }
    return "";
  };

  const handleConfirmIssue = () => {
    const validationError = validateIssue();
    if (validationError) {
      setIssueError(validationError);
      return;
    }

    const qty = Number(issueForm.quantity);
    const newPreviouslyIssued = issueRow.previouslyIssuedQty + qty;
    const newAvailable = issueRow.availableQty - qty;

    setAvailableMaterial((prev) =>
      prev.map((r) =>
        r.key === issueRow.key
          ? {
              ...r,
              previouslyIssuedQty: newPreviouslyIssued,
              availableQty: newAvailable,
              status: computeStatus(r.receivedQty, newPreviouslyIssued),
            }
          : r,
      ),
    );

    const newRecord = {
      issueId: generateIssueId(issueHistory.length),
      jobWorkId: issueRow.jobWorkId,
      poType: issueRow.poType,
      poNumber: issueRow.poNumber,
      supplier: issueRow.supplier,
      poDescription: issueRow.poDescription,
      project: issueRow.project,
      dwg: issueRow.dwg,
      dwgDescription: issueRow.dwgDescription,
      revision: issueRow.revision,
      material: issueRow.material,
      materialCode: issueRow.materialCode,
      materialSpec: issueRow.materialSpec,
      thickness: issueRow.thickness,
      size: issueRow.size,
      unit: issueRow.unit,
      jobWorkType: issueRow.jobWorkType,
      jobWorkUnit: issueRow.jobWorkUnit,
      process: issueRow.process,
      processId: issueRow.processId,
      originalReceivedQty: issueRow.receivedQty,
      previouslyIssuedQty: issueRow.previouslyIssuedQty,
      issuedNow: qty,
      remainingAvailableQty: newAvailable,
      issuedBy: issueForm.issuedBy,
      issueDate: new Date().toISOString().slice(0, 10),
      status: "Issued",
    };

    setIssueHistory((prev) => [newRecord, ...prev]);
    closeIssue();
  };

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
                <h1 className="page-header-title">Issue to Production</h1>
                <p className="page-header-subtitle">
                  Issue actually received Job Work material to Production and
                  track every issue transaction in history.
                </p>
              </div>
            </div>
          </div>

          {/* ===================== TABS ===================== */}
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === "available" ? "tab-active" : ""}`}
              onClick={() => switchTab("available")}
            >
              Available Material
              <span className="tab-count">{visibleAvailable.length}</span>
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "history" ? "tab-active" : ""}`}
              onClick={() => switchTab("history")}
            >
              Issue History
              <span className="tab-count">{issueHistory.length}</span>
            </button>
          </div>

          {/* ===================== AVAILABLE MATERIAL TAB ===================== */}
          {activeTab === "available" && (
            <div className="panel">
              <FilterPanel
                search={availableSearch}
                onSearchChange={setAvailableSearch}
                filters={availableFilters}
                onFilterChange={handleAvailableFilterChange}
                options={availableOptions}
                onClear={clearAvailableFilters}
                open={filtersOpen}
                onToggleOpen={() => setFiltersOpen((o) => !o)}
                resultCount={filteredAvailable.length}
                searchPlaceholder="Search material, PO number, description, project, DWG, Job Work ID, material code..."
              />

              <div className="table-scroll-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Work ID</th>
                      <th>PO Type</th>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>PO Description</th>
                      <th>Project</th>
                      <th>DWG</th>
                      <th>DWG Description</th>
                      <th>Revision</th>
                      <th>Material</th>
                      <th>Material Code</th>
                      <th>Specification</th>
                      <th>Thickness</th>
                      <th>Size</th>
                      <th>Unit</th>
                      <th>Job Work Type</th>
                      <th>Job Work Unit</th>
                      <th>Process</th>
                      <th>Process ID</th>
                      <th>Received Qty</th>
                      <th>Previously Issued</th>
                      <th>Available Qty</th>
                      <th>Status</th>
                      <th className="cell-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAvailable.length === 0 && (
                      <tr>
                        <td colSpan={24}>
                          <div className="empty-state">
                            <div className="empty-state-icon">📦</div>
                            <p className="empty-state-title">
                              No Available Material
                            </p>
                            <p className="empty-state-desc">
                              No received material matches the current search /
                              filters.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {filteredAvailable.map((row) => (
                      <tr key={row.key}>
                        <td className="cell-mono">{row.jobWorkId}</td>
                        <td>{row.poType}</td>
                        <td>{row.poNumber}</td>
                        <td>{row.supplier}</td>
                        <td>{row.poDescription}</td>
                        <td>{row.project}</td>
                        <td>{row.dwg}</td>
                        <td>{row.dwgDescription}</td>
                        <td>{row.revision}</td>
                        <td>
                          <span className="material-chip">{row.material}</span>
                        </td>
                        <td className="cell-mono">{row.materialCode}</td>
                        <td>{row.materialSpec}</td>
                        <td>{row.thickness}</td>
                        <td>{row.size}</td>
                        <td>{row.unit}</td>
                        <td>
                          <span
                            className={`type-badge ${
                              row.jobWorkType === "Outsourcing"
                                ? "type-badge-outsourcing"
                                : "type-badge-inhouse"
                            }`}
                          >
                            {row.jobWorkType}
                          </span>
                        </td>
                        <td>{row.jobWorkUnit}</td>
                        <td>{row.process}</td>
                        <td className="cell-mono">{row.processId}</td>
                        <td className="cell-num">
                          {row.receivedQty} {row.jobWorkUnit}
                        </td>
                        <td className="cell-num">
                          {row.previouslyIssuedQty} {row.jobWorkUnit}
                        </td>
                        <td className="cell-num cell-available">
                          {row.availableQty} {row.jobWorkUnit}
                        </td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button
                              type="button"
                              onClick={() => openView("available", row)}
                              title="View Details"
                              aria-label="View Details"
                            >
                              <EyeIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => openIssue(row)}
                              className="btn btn-primary btn-sm"
                            >
                              Issue
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== ISSUE HISTORY TAB ===================== */}
          {activeTab === "history" && (
            <div className="panel">
              <FilterPanel
                search={historySearch}
                onSearchChange={setHistorySearch}
                filters={historyFilters}
                onFilterChange={handleHistoryFilterChange}
                options={historyOptions}
                onClear={clearHistoryFilters}
                open={filtersOpen}
                onToggleOpen={() => setFiltersOpen((o) => !o)}
                resultCount={filteredHistory.length}
                searchPlaceholder="Search Issue ID, material, PO number, description, project, DWG, Job Work ID..."
              />

              <div className="table-scroll-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Issue ID</th>
                      <th>Job Work ID</th>
                      <th>PO Type</th>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>PO Description</th>
                      <th>Project</th>
                      <th>DWG</th>
                      <th>DWG Description</th>
                      <th>Revision</th>
                      <th>Material</th>
                      <th>Material Code</th>
                      <th>Specification</th>
                      <th>Thickness</th>
                      <th>Size</th>
                      <th>Unit</th>
                      <th>Job Work Type</th>
                      <th>Job Work Unit</th>
                      <th>Original Received</th>
                      <th>Previously Issued</th>
                      <th>Issued Now</th>
                      <th>Remaining Available</th>
                      <th>Issued By</th>
                      <th>Issue Date</th>
                      <th>Status</th>
                      <th className="cell-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={26}>
                          <div className="empty-state">
                            <div className="empty-state-icon">🗂️</div>
                            <p className="empty-state-title">
                              No Issue History
                            </p>
                            <p className="empty-state-desc">
                              No issue transactions match the current search /
                              filters.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {filteredHistory.map((row) => (
                      <tr key={row.issueId}>
                        <td className="cell-mono">{row.issueId}</td>
                        <td>{row.jobWorkId}</td>
                        <td>{row.poType}</td>
                        <td>{row.poNumber}</td>
                        <td>{row.supplier}</td>
                        <td>{row.poDescription}</td>
                        <td>{row.project}</td>
                        <td>{row.dwg}</td>
                        <td>{row.dwgDescription}</td>
                        <td>{row.revision}</td>
                        <td>
                          <span className="material-chip">{row.material}</span>
                        </td>
                        <td className="cell-mono">{row.materialCode}</td>
                        <td>{row.materialSpec}</td>
                        <td>{row.thickness}</td>
                        <td>{row.size}</td>
                        <td>{row.unit}</td>
                        <td>
                          <span
                            className={`type-badge ${
                              row.jobWorkType === "Outsourcing"
                                ? "type-badge-outsourcing"
                                : "type-badge-inhouse"
                            }`}
                          >
                            {row.jobWorkType}
                          </span>
                        </td>
                        <td>{row.jobWorkUnit}</td>
                        <td className="cell-num">
                          {row.originalReceivedQty} {row.jobWorkUnit}
                        </td>
                        <td className="cell-num">
                          {row.previouslyIssuedQty} {row.jobWorkUnit}
                        </td>
                        <td className="cell-num cell-available">
                          {row.issuedNow} {row.jobWorkUnit}
                        </td>
                        <td className="cell-num">
                          {row.remainingAvailableQty} {row.jobWorkUnit}
                        </td>
                        <td>{row.issuedBy}</td>
                        <td>{row.issueDate}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button
                              type="button"
                              onClick={() => openView("history", row)}
                              title="View Details"
                              aria-label="View Details"
                            >
                              <EyeIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== EYE VIEW MODAL ===================== */}
          {viewData && (
            <div className="modal-overlay" onClick={closeView}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {viewData.type === "available"
                        ? "Material Detail"
                        : "Issue Detail"}
                    </h2>
                    <p className="modal-subtitle">
                      {viewData.type === "available" ? (
                        <>
                          Job Work ID : <strong>{viewData.row.jobWorkId}</strong>
                          · Piece <strong>{viewData.row.pieceNo}</strong>
                        </>
                      ) : (
                        <>
                          Issue ID : <strong>{viewData.row.issueId}</strong>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeView}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  {viewData.type === "available" ? (
                    <AvailableEyeView row={viewData.row} />
                  ) : (
                    <HistoryEyeView row={viewData.row} />
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeView}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== ISSUE TO PRODUCTION MODAL ===================== */}
          {issueRow && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">Issue to Production</h2>
                    <p className="modal-subtitle">
                      Job Work ID : <strong>{issueRow.jobWorkId}</strong> · Piece{" "}
                      <strong>{issueRow.pieceNo}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeIssue}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  {/* ---------- Material Details (read only) ---------- */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Material Details</h3>
                    <div className="readonly-grid">
                      <ReadonlyField
                        label="Job Work ID"
                        value={issueRow.jobWorkId}
                      />
                      <ReadonlyField label="PO Type" value={issueRow.poType} />
                      <ReadonlyField label="PO Number" value={issueRow.poNumber} />
                      <ReadonlyField label="Supplier" value={issueRow.supplier} />
                      <ReadonlyField
                        label="PO Description"
                        value={issueRow.poDescription}
                      />
                      <ReadonlyField label="Project" value={issueRow.project} />
                      <ReadonlyField label="DWG" value={issueRow.dwg} />
                      <ReadonlyField
                        label="DWG Description"
                        value={issueRow.dwgDescription}
                      />
                      <ReadonlyField label="Revision" value={issueRow.revision} />
                      <ReadonlyField label="Material" value={issueRow.material} />
                      <ReadonlyField
                        label="Material Code"
                        value={issueRow.materialCode}
                      />
                      <ReadonlyField
                        label="Specification"
                        value={issueRow.materialSpec}
                      />
                      <ReadonlyField label="Thickness" value={issueRow.thickness} />
                      <ReadonlyField label="Size" value={issueRow.size} />
                      <ReadonlyField label="Unit" value={issueRow.unit} />
                      <ReadonlyField
                        label="Job Work Type"
                        value={issueRow.jobWorkType}
                      />
                      <ReadonlyField
                        label="Job Work Unit"
                        value={issueRow.jobWorkUnit}
                      />
                      <ReadonlyField
                        label="Process"
                        value={`${issueRow.process} - ${issueRow.processId}`}
                      />
                      <ReadonlyField
                        label="Received Quantity"
                        value={`${issueRow.receivedQty} ${issueRow.jobWorkUnit}`}
                      />
                      <ReadonlyField
                        label="Previously Issued"
                        value={`${issueRow.previouslyIssuedQty} ${issueRow.jobWorkUnit}`}
                      />
                      <ReadonlyField
                        label="Available Quantity"
                        value={`${issueRow.availableQty} ${issueRow.jobWorkUnit}`}
                        emphasize
                      />
                    </div>
                  </div>

                  {/* ---------- Issue Quantity ---------- */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Issue Quantity</h3>
                    <div className="form-field qty-field">
                      <label htmlFor="issue-qty">
                        Issue Quantity (max {issueRow.availableQty}{" "}
                        {issueRow.jobWorkUnit})
                      </label>
                      <input
                        id="issue-qty"
                        type="number"
                        min="1"
                        max={issueRow.availableQty}
                        className="qty-input"
                        placeholder="0"
                        value={issueForm.quantity}
                        onChange={(e) =>
                          setIssueForm((f) => ({ ...f, quantity: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* ---------- Issued By ---------- */}
                  <div className="form-field">
                    <label htmlFor="issued-by">Issued By</label>
                    <select
                      id="issued-by"
                      value={issueForm.issuedBy}
                      onChange={(e) =>
                        setIssueForm((f) => ({ ...f, issuedBy: e.target.value }))
                      }
                    >
                      <option value="">Select employee</option>
                      {employees.map((emp) => (
                        <option key={emp}>{emp}</option>
                      ))}
                    </select>
                  </div>

                  {issueError && <div className="error-box">{issueError}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeIssue}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmIssue}
                    className="btn btn-primary"
                  >
                    Issue to Production
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// =========================================================================
// Filter Panel — shared between Available Material and Issue History
// =========================================================================
function FilterPanel({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  options,
  onClear,
  open,
  onToggleOpen,
  resultCount,
  searchPlaceholder,
}) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={onToggleOpen}
        className={`btn btn-secondary btn-sm ${open ? "btn-outline-active" : ""}`}
      >
        <FilterIcon />
        Filters
        {activeFilterCount > 0 && (
          <span className="tab-count">{activeFilterCount}</span>
        )}
      </button>
      <button type="button" onClick={onClear} className="btn-link">
        Clear Filters
      </button>

      {open && (
        <div className="filters-grid">
          {FILTER_FIELDS.map((f) => (
            <div className="form-field" key={f.key}>
              <label>{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={filters[f.key] || ""}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                >
                  <option value="">All</option>
                  {(options[f.key] || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filters[f.key] || ""}
                  placeholder={`Filter by ${f.label}`}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="result-count">
        {resultCount} record{resultCount !== 1 ? "s" : ""} found
      </p>
    </div>
  );
}

// =========================================================================
// Eye view bodies
// =========================================================================
function AvailableEyeView({ row }) {
  const job = jobs[row.jobWorkId];
  const req = job.originalRequirement;

  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Original Integrated Requirement</h3>
        <p className="modal-card-subtitle">
          Read only — from DWG / BOM / PO integration.
        </p>
        <div className="readonly-grid">
          <ReadonlyField label="Project" value={req.project} />
          <ReadonlyField label="DWG" value={req.dwg} />
          <ReadonlyField label="Description" value={req.description} />
          <ReadonlyField label="Material" value={req.material} />
          <ReadonlyField label="Material Code" value={req.materialCode} />
          <ReadonlyField
            label="Specification"
            value={req.materialSpec}
          />
          <ReadonlyField label="Thickness" value={req.thickness} />
          <ReadonlyField label="Required Quantity" value={req.requiredQty} />
          <ReadonlyField label="Original Size" value={req.originalSize} />
          <ReadonlyField label="PO Number" value={req.poNumber} />
          <ReadonlyField label="PO Description" value={req.poDescription} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">Actual Received From Job Work</h3>
        <p className="modal-card-subtitle">
          Job Work ID : <strong>{job.jobWorkId}</strong> · Process :{" "}
          <strong>
            {job.process} - {job.processId}
          </strong>
        </p>

        <div className="pieces-table-wrap">
          <table className="pieces-table">
            <thead>
              <tr>
                <th>Piece No</th>
                <th>Size</th>
                <th>Thickness</th>
                <th>Received Qty</th>
              </tr>
            </thead>
            <tbody>
              {job.pieces.map((p) => (
                <tr
                  key={p.pieceNo}
                  className={
                    p.pieceNo === row.pieceNo ? "piece-highlight" : ""
                  }
                >
                  <td>
                    {p.pieceNo}
                    {p.pieceNo === row.pieceNo && (
                      <span className="selected-tag">Selected</span>
                    )}
                  </td>
                  <td>{p.size}</td>
                  <td>{p.thickness}</td>
                  <td>
                    {p.qty} {job.jobWorkUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="modal-card-footnote">
          Compare the original requirement above with what Job Work actually
          returned — received output is tracked independently of the original
          DWG/BOM quantity.
        </p>
      </div>
    </>
  );
}

function HistoryEyeView({ row }) {
  const job = jobs[row.jobWorkId];
  const req = job.originalRequirement;

  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Original Integrated Requirement</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Project" value={req.project} />
          <ReadonlyField label="DWG" value={req.dwg} />
          <ReadonlyField label="Description" value={req.description} />
          <ReadonlyField label="Material" value={req.material} />
          <ReadonlyField label="Thickness" value={req.thickness} />
          <ReadonlyField label="Required Quantity" value={req.requiredQty} />
          <ReadonlyField label="Original Size" value={req.originalSize} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">Actual Job Work Receipt</h3>
        <p className="modal-card-subtitle">
          Job Work ID : <strong>{job.jobWorkId}</strong> · Process :{" "}
          <strong>
            {job.process} - {job.processId}
          </strong>
        </p>
        <div className="pieces-table-wrap">
          <table className="pieces-table">
            <thead>
              <tr>
                <th>Piece No</th>
                <th>Size</th>
                <th>Thickness</th>
                <th>Received Qty</th>
              </tr>
            </thead>
            <tbody>
              {job.pieces.map((p) => (
                <tr key={p.pieceNo}>
                  <td>{p.pieceNo}</td>
                  <td>{p.size}</td>
                  <td>{p.thickness}</td>
                  <td>
                    {p.qty} {job.jobWorkUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">Issue to Production</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Issue ID" value={row.issueId} />
          <ReadonlyField
            label="Original Received"
            value={`${row.originalReceivedQty} ${row.jobWorkUnit}`}
          />
          <ReadonlyField
            label="Previously Issued"
            value={`${row.previouslyIssuedQty} ${row.jobWorkUnit}`}
          />
          <ReadonlyField
            label="Issued Quantity"
            value={`${row.issuedNow} ${row.jobWorkUnit}`}
            emphasize
          />
          <ReadonlyField
            label="Remaining Available"
            value={`${row.remainingAvailableQty} ${row.jobWorkUnit}`}
          />
          <ReadonlyField label="Issued By" value={row.issuedBy} />
          <ReadonlyField label="Issue Date" value={row.issueDate} />
          <ReadonlyField label="Status" value={row.status} />
        </div>
      </div>
    </>
  );
}

// =========================================================================
// Small shared bits
// =========================================================================
function ReadonlyField({ label, value, emphasize }) {
  return (
    <div className="readonly-field">
      <label className="readonly-label">{label}</label>
      <div
        className={`readonly-value ${emphasize ? "readonly-value-emphasis" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Available: "status-badge-success",
    "Partially Issued": "status-badge-warning",
    "Fully Issued": "status-badge-neutral",
    Issued: "status-badge-info",
    "In Production": "status-badge-warning",
    Completed: "status-badge-success",
  };
  return <span className={`status-badge ${map[status] || ""}`}>{status}</span>;
}

function FilterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}