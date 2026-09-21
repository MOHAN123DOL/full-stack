import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ArrowLeft,
  Layers,
  Eye,
  SlidersHorizontal,
  PackageSearch,
  Warehouse,
  Building2,
  Scissors,
  ArrowRight,
  Boxes,
} from "lucide-react";
import Header from "../../components/Header";
import "./Materialstock.css";

// =====================================================================
// Mock reference data
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
const stockStatuses = [
  "Available",
  "Partially Used",
  "Remaining",
  "Cutting Remaining",
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

// =====================================================================
// Shared UI helpers
// =====================================================================
function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    Available: "success",
    "Partially Used": "warning",
    Remaining: "warning",
    "Cutting Remaining": "info",
    PO: "info",
    "Dummy PO": "amber-outline",
    "Job Remaining": "warning",
    Yes: "warning",
    No: "neutral",
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
  stockStatus: "All",
};

export default function MaterialStock() {
  const navigate = useNavigate();
  const [stock] = useState(initialStock);
  const [search, setSearch] = useState("");
  const [unitTab, setUnitTab] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyAdvancedFilters);
  const [viewStock, setViewStock] = useState(null);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function goToIssue(stockItem) {
    navigate("/inventory/material/issue-to-jobwork", {
      state: { stockId: stockItem.id },
    });
  }

  const projectOptions = useMemo(
    () => [...new Set(stock.map((s) => s.project).filter((p) => p !== "—"))],
    [stock],
  );

  // Only material with Available Quantity > 0 is active stock.
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
      const matchesStatus =
        filters.stockStatus === "All" || s.stockStatus === filters.stockStatus;

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
        matchesRework &&
        matchesStatus
      );
    });
  }, [activeStock, search, unitTab, filters]);

  const hasActiveFilters =
    search.trim() !== "" ||
    unitTab !== "All" ||
    Object.entries(filters).some(([key, val]) =>
      ["material", "sourceType", "reworkRequired", "stockStatus"].includes(key)
        ? val !== "All"
        : val.trim() !== "",
    );

  function clearFilters() {
    setSearch("");
    setUnitTab("All");
    setFilters(emptyAdvancedFilters);
  }

  // ---------------- summary cards ----------------
  const summary = useMemo(() => {
    const totalItems = activeStock.length;
    const unit1 = activeStock.filter((s) => s.unit === "Unit 1").length;
    const unit2 = activeStock.filter((s) => s.unit === "Unit 2").length;
    const poStock = activeStock.filter(
      (s) => s.sourceType === "PO" || s.sourceType === "Dummy PO",
    ).length;
    const cuttingRemaining = activeStock.filter(
      (s) => s.sourceType === "Cutting Remaining",
    ).length;
    return { totalItems, unit1, unit2, poStock, cuttingRemaining };
  }, [activeStock]);

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
                <h1 className="page-header-title">Material Stock</h1>
                <p className="page-header-subtitle">
                  Track available material by unit, source, project and material
                  characteristics.
                </p>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-neutral">
                <PackageSearch size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.totalItems}</span>
                <span className="summary-card-label">Total Available Items</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-info">
                <Building2 size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.unit1}</span>
                <span className="summary-card-label">Unit 1 Stock</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-info">
                <Warehouse size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.unit2}</span>
                <span className="summary-card-label">Unit 2 Stock</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-success">
                <Boxes size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">{summary.poStock}</span>
                <span className="summary-card-label">PO Stock</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-card-icon summary-card-icon-warning">
                <Scissors size={18} strokeWidth={1.8} />
              </div>
              <div>
                <span className="summary-card-value">
                  {summary.cuttingRemaining}
                </span>
                <span className="summary-card-label">Cutting Remaining</span>
              </div>
            </div>
          </div>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-head-title">Available Stock</div>
                <p className="panel-head-subtitle">
                  Only material with available quantity greater than zero is
                  listed.
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
                  <label htmlFor="filter-material">Material</label>
                  <select
                    id="filter-material"
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
                  <label htmlFor="filter-thickness">Thickness</label>
                  <input
                    id="filter-thickness"
                    placeholder="e.g. 8"
                    value={filters.thickness}
                    onChange={(e) => updateFilter("thickness", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-size">Size</label>
                  <input
                    id="filter-size"
                    placeholder="e.g. 100 NB, 1500 x 3000"
                    value={filters.size}
                    onChange={(e) => updateFilter("size", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-po-number">PO Number</label>
                  <input
                    id="filter-po-number"
                    placeholder="e.g. PO-001"
                    value={filters.poNumber}
                    onChange={(e) => updateFilter("poNumber", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-material-code">Material Code</label>
                  <input
                    id="filter-material-code"
                    value={filters.materialCode}
                    onChange={(e) => updateFilter("materialCode", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-material-spec">
                    Material Specification / Grade
                  </label>
                  <input
                    id="filter-material-spec"
                    placeholder="e.g. IS2062 E250A"
                    value={filters.materialSpec}
                    onChange={(e) => updateFilter("materialSpec", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-heat-number">Heat Number</label>
                  <input
                    id="filter-heat-number"
                    value={filters.heatNumber}
                    onChange={(e) => updateFilter("heatNumber", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-plate-number">Plate Number</label>
                  <input
                    id="filter-plate-number"
                    value={filters.plateNumber}
                    onChange={(e) => updateFilter("plateNumber", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-project">Project</label>
                  <input
                    id="filter-project"
                    list="stock-project-options"
                    placeholder="e.g. BHEL Boiler Fabrication"
                    value={filters.project}
                    onChange={(e) => updateFilter("project", e.target.value)}
                  />
                  <datalist id="stock-project-options">
                    {projectOptions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                <div className="form-field">
                  <label htmlFor="filter-dwg-description">DWG / Description</label>
                  <input
                    id="filter-dwg-description"
                    placeholder="e.g. DWG-001"
                    value={filters.dwgDescription}
                    onChange={(e) => updateFilter("dwgDescription", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-unit">Unit</label>
                  <select
                    id="filter-unit"
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
                  <label htmlFor="filter-source-type">Source Type</label>
                  <select
                    id="filter-source-type"
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
                  <label htmlFor="filter-rework">Rework Required</label>
                  <select
                    id="filter-rework"
                    value={filters.reworkRequired}
                    onChange={(e) => updateFilter("reworkRequired", e.target.value)}
                  >
                    <option>All</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="filter-stock-status">Stock Status</label>
                  <select
                    id="filter-stock-status"
                    value={filters.stockStatus}
                    onChange={(e) => updateFilter("stockStatus", e.target.value)}
                  >
                    <option>All</option>
                    {stockStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
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
                    <th>Source Type</th>
                    <th>PO Number</th>
                    <th>Description</th>
                    <th>Material</th>
                    <th>Material Code</th>
                    <th>Material Specification</th>
                    <th>Thickness</th>
                    <th>Size</th>
                    <th>Heat Number</th>
                    <th>Plate Number</th>
                    <th>Original Qty</th>
                    <th>Available Qty</th>
                    <th>Unit</th>
                    <th>Project</th>
                    <th>DWG / Description</th>
                    <th>Revision</th>
                    <th>Stock Status</th>
                    <th>Rework Required</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-mono">{s.stockId}</td>
                      <td>{s.unit}</td>
                      <td>
                        <StatusBadge status={s.sourceType} />
                      </td>
                      <td className="cell-mono">{s.poNumber}</td>
                      <td>{s.description}</td>
                      <td>{s.material}</td>
                      <td className="cell-mono">{s.materialCode}</td>
                      <td>{s.materialSpec}</td>
                      <td>{s.thickness}</td>
                      <td>{s.size}</td>
                      <td
                        className={s.heatNumber === "—" ? "cell-muted" : "cell-mono"}
                      >
                        {s.heatNumber}
                      </td>
                      <td
                        className={s.plateNumber === "—" ? "cell-muted" : "cell-mono"}
                      >
                        {s.plateNumber}
                      </td>
                      <td className="cell-muted">{s.originalQuantity}</td>
                      <td>
                        <strong>{s.availableQuantity}</strong>
                      </td>
                      <td>{s.uom}</td>
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
                        <StatusBadge status={s.stockStatus} />
                      </td>
                      <td>
                        <StatusBadge status={s.reworkRequired} />
                      </td>
                      <td>
                        <div className="table-row-actions">
                          <button onClick={() => setViewStock(s)} aria-label="View">
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => goToIssue(s)}
                          >
                            Issue
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={21}>
                        <div className="empty-state">
                          <p className="empty-state-title">
                            No stock matches your search or filters
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

          {/* View Stock Modal */}
          <Modal
            open={!!viewStock}
            title={viewStock ? viewStock.stockId : ""}
            subtitle="Stock record details"
            onClose={() => setViewStock(null)}
          >
            {viewStock && (
              <>
                <div className="kv-grid">
                  <div className="kv">
                    <span>Unit</span>
                    <strong>{viewStock.unit}</strong>
                  </div>
                  <div className="kv">
                    <span>Source Type</span>
                    <StatusBadge status={viewStock.sourceType} />
                  </div>
                  <div className="kv">
                    <span>PO Number</span>
                    <strong className="mono">{viewStock.poNumber}</strong>
                  </div>
                  <div className="kv">
                    <span>Description</span>
                    <strong>{viewStock.description}</strong>
                  </div>
                  <div className="kv">
                    <span>Material</span>
                    <strong>{viewStock.material}</strong>
                  </div>
                  <div className="kv">
                    <span>Material Code</span>
                    <strong className="mono">{viewStock.materialCode}</strong>
                  </div>
                  <div className="kv">
                    <span>Specification</span>
                    <strong>{viewStock.materialSpec}</strong>
                  </div>
                  <div className="kv">
                    <span>Thickness</span>
                    <strong>{viewStock.thickness}</strong>
                  </div>
                  <div className="kv">
                    <span>Size</span>
                    <strong>{viewStock.size}</strong>
                  </div>
                  <div className="kv">
                    <span>Heat Number</span>
                    <strong>{viewStock.heatNumber}</strong>
                  </div>
                  <div className="kv">
                    <span>Plate Number</span>
                    <strong>{viewStock.plateNumber}</strong>
                  </div>
                  <div className="kv">
                    <span>Original Quantity</span>
                    <strong>
                      {viewStock.originalQuantity} {viewStock.uom}
                    </strong>
                  </div>
                  <div className="kv kv-highlight">
                    <span>Available Quantity</span>
                    <strong>
                      {viewStock.availableQuantity} {viewStock.uom}
                    </strong>
                  </div>
                  <div className="kv">
                    <span>Project</span>
                    <strong>{viewStock.project}</strong>
                  </div>
                  <div className="kv">
                    <span>DWG / Description</span>
                    <strong>{viewStock.dwgDescription}</strong>
                  </div>
                  <div className="kv">
                    <span>Revision</span>
                    <strong>{viewStock.revision}</strong>
                  </div>
                  <div className="kv">
                    <span>Stock Status</span>
                    <StatusBadge status={viewStock.stockStatus} />
                  </div>
                  <div className="kv">
                    <span>Rework Required</span>
                    <StatusBadge status={viewStock.reworkRequired} />
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setViewStock(null)}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const target = viewStock;
                      setViewStock(null);
                      goToIssue(target);
                    }}
                  >
                    Issue to Job Work <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </Modal>
        </div>
      </div>
    </>
  );
}