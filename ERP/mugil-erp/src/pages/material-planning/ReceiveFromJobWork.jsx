import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X } from "lucide-react";
import Header from "../../components/Header";
import "./ReceiveFromJobWork.css";

// =====================================================================
// Mock reference data
// Mirrors the records created by IssueToJobWork.jsx — each row here is
// one Issue-to-Job-Work ticket. INPUT quantity (plates/material issued)
// and OUTPUT quantity (finished pieces produced) are tracked completely
// independently — see the receive logic further down.
// =====================================================================
const employees = ["Arun", "Kumar", "Suresh", "Ravi", "Manoj"];

// Process-specific output form config. Only Cutting is implemented for
// now; other processes fall back to a generic single quantity field.
// New processes just add an entry here — no other logic changes needed.
const processOutputConfig = {
  CUT01: {
    label: "Cutting Output",
    fields: [
      { key: "pieceNo", label: "Piece No", type: "text" },
      { key: "length", label: "Length", type: "number" },
      { key: "width", label: "Width", type: "number" },
      { key: "qty", label: "Quantity", type: "number" },
      { key: "weight", label: "Weight", type: "number" },
      { key: "remarks", label: "Remarks", type: "text" },
    ],
  },
};
const defaultOutputConfig = {
  label: "Process Output",
  fields: [
    { key: "pieceNo", label: "Piece No", type: "text" },
    { key: "qty", label: "Quantity", type: "number" },
    { key: "weight", label: "Weight", type: "number" },
    { key: "remarks", label: "Remarks", type: "text" },
  ],
};

const initialJobs = [
  {
    id: "JW-1001",
    poType: "PO",
    poNumber: "PO-001",
    supplier: "—",
    poDescription: "Description-1",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "DWG-001 / Description-1",
    revision: "REV-01",
    material: "Plate",
    materialCode: "15110292000",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    requiredQty: 26,
    uom: "Nos",
    size: "2000 × 2000",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Unit 1",
    process: "Cutting",
    processId: "CUT01",
    issueDate: "2026-09-02",
    issuedQty: 26,
    previouslyReceived: 0,
    outputQty: 0,
    reworkPending: false,
  },
  {
    id: "JW-1002",
    poType: "PO",
    poNumber: "PO-002",
    supplier: "Shree Fabricators",
    poDescription: "Description-2",
    project: "NTPC Structural Project",
    dwg: "DWG-101",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    requiredQty: 10,
    uom: "Mtr",
    size: "100 NB",
    unit: "Unit 1",
    jobWorkType: "Outsourcing",
    jobWorkUnit: "—",
    process: "Welding",
    processId: "WELD01",
    issueDate: "2026-08-30",
    issuedQty: 10,
    previouslyReceived: 4,
    outputQty: 4,
    reworkPending: false,
  },
  {
    id: "JW-1003",
    poType: "Dummy PO",
    poNumber: "DPO-001",
    supplier: "—",
    poDescription: "Description-1",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "DWG-001 / Description-1",
    revision: "REV-01",
    material: "Plate",
    materialCode: "15110293000",
    materialSpec: "IS2062 E250A",
    thickness: "10 mm",
    requiredQty: 12,
    uom: "Nos",
    size: "500 × 600",
    unit: "Unit 1",
    jobWorkType: "In-House",
    jobWorkUnit: "Unit 1",
    process: "Bending",
    processId: "BEND01",
    issueDate: "2026-08-27",
    issuedQty: 12,
    previouslyReceived: 12,
    outputQty: 12,
    reworkPending: false,
  },
];

// -----------------------------------------------------------------------
// Row factories
// -----------------------------------------------------------------------
let outputRowId = 1;
const newOutputRow = (fields) =>
  fields.reduce((row, f) => ({ ...row, [f.key]: "" }), {
    rowId: outputRowId++,
  });

let remainingRowId = 1;
const newRemainingRow = () => ({
  rowId: remainingRowId++,
  plateNo: "",
  length: "",
  width: "",
  weight: "",
  remarks: "",
  reworkRequired: "No",
});

// Keep existing remaining-piece rows when the remaining count changes;
// add/trim as needed (same pattern used in Receivefromcutting.jsx).
const reconcileRemainingPieces = (existing, targetCount) => {
  const count = Math.max(0, targetCount);
  if (count === existing.length) return existing;
  if (count < existing.length) return existing.slice(0, count);
  const extra = Array.from({ length: count - existing.length }, () =>
    newRemainingRow(),
  );
  return [...existing, ...extra];
};

const emptyForm = (outputFields) => ({
  completedInputQty: "",
  outputPieces: [newOutputRow(outputFields)],
  remainingPieces: [],
  receivedBy: "",
});

const statusOf = (job) => {
  if (job.reworkPending) return "Rework Pending";
  if (job.previouslyReceived <= 0) return "Not Received";
  if (job.previouslyReceived < job.issuedQty) return "Partially Received";
  return "Fully Received";
};

const statusToneClass = (status) => {
  switch (status) {
    case "Fully Received":
      return "status-tone-success";
    case "Partially Received":
      return "status-tone-warning";
    case "Rework Pending":
      return "status-tone-danger";
    default:
      return "status-tone-neutral";
  }
};

const emptyFilters = {
  thickness: "All",
  material: "All",
  size: "All",
  poNumber: "All",
  project: "All",
  dwg: "All",
  unit: "All",
  jobWorkType: "All",
  process: "All",
  status: "All",
};

const uniqueValues = (jobs, key) => [
  ...new Set(jobs.map((j) => j[key]).filter(Boolean)),
];

export default function ReceiveFromJobWork() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(initialJobs);
  const [activeJob, setActiveJob] = useState(null);
  const [form, setForm] = useState(() => emptyForm(defaultOutputConfig.fields));
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);

  // -----------------------------------------------------------------
  // Filtering — every filter combines with AND logic, plus a free-text
  // search across every important identifying field.
  // -----------------------------------------------------------------
  const filterOptions = useMemo(
    () => ({
      thickness: uniqueValues(jobs, "thickness"),
      material: uniqueValues(jobs, "material"),
      size: uniqueValues(jobs, "size"),
      poNumber: uniqueValues(jobs, "poNumber"),
      project: uniqueValues(jobs, "project"),
      dwg: uniqueValues(jobs, "dwg"),
      unit: uniqueValues(jobs, "unit"),
      jobWorkType: uniqueValues(jobs, "jobWorkType"),
      process: uniqueValues(jobs, "process"),
      status: [
        "Not Received",
        "Partially Received",
        "Fully Received",
        "Rework Pending",
      ],
    }),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const status = statusOf(job);
      const matchesSearch =
        !q ||
        [
          job.id,
          job.poType,
          job.poNumber,
          job.supplier,
          job.poDescription,
          job.project,
          job.dwg,
          job.dwgDescription,
          job.revision,
          job.material,
          job.materialCode,
          job.materialSpec,
          job.process,
          job.processId,
          job.unit,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesFilter = (key, field) =>
        filters[key] === "All" || job[field ?? key] === filters[key];

      return (
        matchesSearch &&
        matchesFilter("thickness") &&
        matchesFilter("material") &&
        matchesFilter("size") &&
        matchesFilter("poNumber") &&
        matchesFilter("project") &&
        matchesFilter("dwg") &&
        matchesFilter("unit") &&
        matchesFilter("jobWorkType") &&
        matchesFilter("process") &&
        (filters.status === "All" || status === filters.status)
      );
    });
  }, [jobs, search, filters]);

  const updateFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => {
    setFilters(emptyFilters);
    setSearch("");
  };

  // -----------------------------------------------------------------
  // Receive modal
  // -----------------------------------------------------------------
  const outputConfig = activeJob
    ? processOutputConfig[activeJob.processId] || defaultOutputConfig
    : defaultOutputConfig;

  const balanceToReceive = activeJob
    ? Math.max(activeJob.issuedQty - activeJob.previouslyReceived, 0)
    : 0;

  const completedInputQty = Number(form.completedInputQty) || 0;
  const inputEntered = form.completedInputQty !== "" && completedInputQty > 0;
  const remainingInputQty = inputEntered
    ? Math.max(balanceToReceive - completedInputQty, 0)
    : null;

  const totalOutputQty = useMemo(
    () => form.outputPieces.reduce((sum, p) => sum + (Number(p.qty) || 0), 0),
    [form.outputPieces],
  );

  const openModal = (job) => {
    const cfg = processOutputConfig[job.processId] || defaultOutputConfig;
    setActiveJob(job);
    setForm(emptyForm(cfg.fields));
    setError("");
  };
  const closeModal = () => {
    setActiveJob(null);
    setError("");
  };

  // Completed Input Quantity — Step 1. Reconciles the remaining-pieces
  // rows to match the newly computed Remaining Input Quantity, exactly
  // like Receivefromcutting.jsx does for remaining plates.
  const handleCompletedInputChange = (raw) => {
    const clamped =
      raw === "" ? "" : Math.max(0, Math.min(Number(raw), balanceToReceive));
    const newRemaining =
      clamped === "" ? 0 : balanceToReceive - (Number(clamped) || 0);
    setForm((f) => ({
      ...f,
      completedInputQty: clamped,
      remainingPieces: reconcileRemainingPieces(
        f.remainingPieces,
        newRemaining,
      ),
    }));
  };

  // Process Output rows (Step 2) — independent of input quantity.
  const updateOutputPiece = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      outputPieces: f.outputPieces.map((p) =>
        p.rowId === rowId ? { ...p, [field]: value } : p,
      ),
    }));
  const addOutputPiece = () =>
    setForm((f) => ({
      ...f,
      outputPieces: [...f.outputPieces, newOutputRow(outputConfig.fields)],
    }));
  const removeOutputPiece = (rowId) =>
    setForm((f) => ({
      ...f,
      outputPieces:
        f.outputPieces.length > 1
          ? f.outputPieces.filter((p) => p.rowId !== rowId)
          : f.outputPieces,
    }));

  // Remaining Input Material rows (Step 3).
  const updateRemainingPiece = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      remainingPieces: f.remainingPieces.map((p) =>
        p.rowId === rowId ? { ...p, [field]: value } : p,
      ),
    }));
  const addRemainingPiece = () =>
    setForm((f) => ({
      ...f,
      remainingPieces: [...f.remainingPieces, newRemainingRow()],
    }));
  const removeRemainingPiece = (rowId) =>
    setForm((f) => ({
      ...f,
      remainingPieces:
        f.remainingPieces.length > 1
          ? f.remainingPieces.filter((p) => p.rowId !== rowId)
          : f.remainingPieces,
    }));

  // -----------------------------------------------------------------
  // Validation + save
  // -----------------------------------------------------------------
  const validate = () => {
    if (form.completedInputQty === "" || completedInputQty <= 0) {
      return "Enter a Completed Input Quantity greater than 0.";
    }
    if (completedInputQty > balanceToReceive) {
      return `Completed Input Quantity can't exceed the Balance to Receive (${balanceToReceive}).`;
    }

    const validOutputPieces = form.outputPieces.filter(
      (p) => (p.pieceNo || "").toString().trim() && Number(p.qty) > 0,
    );
    if (validOutputPieces.length === 0) {
      return "Add at least one process output piece with a Piece No and Quantity.";
    }

    if (remainingInputQty > 0) {
      if (form.remainingPieces.length !== remainingInputQty) {
        return "Remaining input material rows don't match the Remaining Input Quantity.";
      }
      for (const piece of form.remainingPieces) {
        if (!piece.plateNo.trim()) {
          return "Enter a Plate / Material No for every remaining input piece.";
        }
      }
    }

    if (!form.receivedBy.trim()) {
      return "Please select Received By.";
    }
    return "";
  };

  const handleReceive = () => {
    if (!activeJob) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const validOutputPieces = form.outputPieces.filter(
      (p) => (p.pieceNo || "").toString().trim() && Number(p.qty) > 0,
    );
    const outputAdded = validOutputPieces.reduce(
      (sum, p) => sum + (Number(p.qty) || 0),
      0,
    );
    const anyReworkFlagged =
      remainingInputQty > 0 &&
      form.remainingPieces.some((p) => p.reworkRequired === "Yes");

    setJobs((prev) =>
      prev.map((j) =>
        j.id === activeJob.id
          ? {
              ...j,
              previouslyReceived: j.previouslyReceived + completedInputQty,
              outputQty: j.outputQty + outputAdded,
              reworkPending: j.reworkPending || anyReworkFlagged,
            }
          : j,
      ),
    );
    // Output pieces → Material Stock, remaining material → Material Stock
    // or Rework Pending: hand-off point for a future integration; for now
    // the job record above is the source of truth for status/quantities.
    closeModal();
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
                <h1 className="page-header-title">Receive From Job Work</h1>
                <p className="page-header-subtitle">
                  Record completed input quantity, process output and any
                  remaining input material against each issued job work ticket.
                </p>
              </div>
            </div>
          </div>

          {/* ===================== SEARCH + FILTERS ===================== */}
          <div className="panel">
            <div className="panel-toolbar">
              <div className="panel-toolbar-search">
                <Search size={14} />
                <input
                  placeholder="Search material, PO, job work ID, project..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>

            <div className="filters-grid">
              <FilterSelect
                label="Thickness"
                value={filters.thickness}
                options={filterOptions.thickness}
                onChange={(v) => updateFilter("thickness", v)}
              />
              <FilterSelect
                label="Material"
                value={filters.material}
                options={filterOptions.material}
                onChange={(v) => updateFilter("material", v)}
              />
              <FilterSelect
                label="Size"
                value={filters.size}
                options={filterOptions.size}
                onChange={(v) => updateFilter("size", v)}
              />
              <FilterSelect
                label="PO Number"
                value={filters.poNumber}
                options={filterOptions.poNumber}
                onChange={(v) => updateFilter("poNumber", v)}
              />
              <FilterSelect
                label="Project"
                value={filters.project}
                options={filterOptions.project}
                onChange={(v) => updateFilter("project", v)}
              />
              <FilterSelect
                label="DWG"
                value={filters.dwg}
                options={filterOptions.dwg}
                onChange={(v) => updateFilter("dwg", v)}
              />
              <FilterSelect
                label="Unit"
                value={filters.unit}
                options={filterOptions.unit}
                onChange={(v) => updateFilter("unit", v)}
              />
              <FilterSelect
                label="Job Work Type"
                value={filters.jobWorkType}
                options={filterOptions.jobWorkType}
                onChange={(v) => updateFilter("jobWorkType", v)}
              />
              <FilterSelect
                label="Process"
                value={filters.process}
                options={filterOptions.process}
                onChange={(v) => updateFilter("process", v)}
              />
              <FilterSelect
                label="Status"
                value={filters.status}
                options={filterOptions.status}
                onChange={(v) => updateFilter("status", v)}
              />
            </div>
          </div>

          {/* ===================== JOB LIST ===================== */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-head-title">Job Work Records</div>
                <p className="panel-head-subtitle">
                  {filteredJobs.length} of {jobs.length} record
                  {jobs.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

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
                    <th>Issued Qty</th>
                    <th>Received Qty</th>
                    <th>Balance</th>
                    <th>Output Qty</th>
                    <th>Status</th>
                    <th className="cell-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={25}>
                        <div className="empty-state">
                          <div className="empty-state-icon">📋</div>
                          <p className="empty-state-title">
                            No Matching Job Work
                          </p>
                          <p className="empty-state-desc">
                            Try adjusting or clearing the filters above.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredJobs.map((job) => {
                    const balance = job.issuedQty - job.previouslyReceived;
                    const status = statusOf(job);
                    const canReceive = balance > 0;
                    return (
                      <tr key={job.id}>
                        <td className="cell-mono">{job.id}</td>
                        <td>{job.poType}</td>
                        <td className="cell-mono">{job.poNumber}</td>
                        <td>{job.supplier}</td>
                        <td>{job.poDescription}</td>
                        <td>{job.project}</td>
                        <td>{job.dwg}</td>
                        <td>{job.dwgDescription}</td>
                        <td>{job.revision}</td>
                        <td>
                          <span className="material-chip">{job.material}</span>
                        </td>
                        <td className="cell-mono">{job.materialCode}</td>
                        <td>{job.materialSpec}</td>
                        <td>{job.thickness}</td>
                        <td>{job.size}</td>
                        <td>{job.unit}</td>
                        <td>
                          <span
                            className={`type-badge ${
                              job.jobWorkType === "Outsourcing"
                                ? "type-badge-outsourcing"
                                : "type-badge-inhouse"
                            }`}
                          >
                            {job.jobWorkType}
                          </span>
                        </td>
                        <td>{job.jobWorkUnit}</td>
                        <td>{job.process}</td>
                        <td className="cell-mono">{job.processId}</td>
                        <td className="cell-num">
                          {job.issuedQty} {job.uom}
                        </td>
                        <td className="cell-num">
                          {job.previouslyReceived} {job.uom}
                        </td>
                        <td className="cell-num cell-balance">
                          {balance} {job.uom}
                        </td>
                        <td className="cell-num">{job.outputQty}</td>
                        <td>
                          <span
                            className={`status-badge ${statusToneClass(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="cell-action">
                          <button
                            type="button"
                            onClick={() => openModal(job)}
                            disabled={!canReceive}
                            className="btn btn-primary btn-sm"
                          >
                            Receive
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ===================== RECEIVE MODAL ===================== */}
          {activeJob && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">Receive From Job Work</h2>
                    <p className="modal-subtitle">
                      Job Work ID : <strong>{activeJob.id}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  {/* ---------- 1. Integrated Requirement ---------- */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Integrated Requirement</h3>
                    <div className="readonly-grid">
                      <ReadonlyField label="Project" value={activeJob.project} />
                      <ReadonlyField label="DWG" value={activeJob.dwg} />
                      <ReadonlyField
                        label="Description"
                        value={activeJob.poDescription}
                      />
                      <ReadonlyField label="Material" value={activeJob.material} />
                      <ReadonlyField
                        label="Thickness"
                        value={activeJob.thickness}
                      />
                      <ReadonlyField
                        label="Required Qty"
                        value={`${activeJob.requiredQty} ${activeJob.uom}`}
                      />
                      <ReadonlyField label="Original Size" value={activeJob.size} />
                    </div>
                  </div>

                  {/* ---------- 2. Job Work Details ---------- */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Job Work Details</h3>
                    <div className="readonly-grid">
                      <ReadonlyField
                        label="Job Work Type"
                        value={activeJob.jobWorkType}
                      />
                      <ReadonlyField
                        label={
                          activeJob.jobWorkType === "Outsourcing"
                            ? "Vendor"
                            : "Unit"
                        }
                        value={
                          activeJob.jobWorkType === "Outsourcing"
                            ? activeJob.supplier
                            : activeJob.jobWorkUnit
                        }
                      />
                      <ReadonlyField
                        label="Process"
                        value={`${activeJob.process} - ${activeJob.processId}`}
                      />
                      <ReadonlyField
                        label="Issued Quantity"
                        value={`${activeJob.issuedQty} ${activeJob.uom}`}
                      />
                      <ReadonlyField
                        label="Previously Received"
                        value={`${activeJob.previouslyReceived} ${activeJob.uom}`}
                      />
                      <ReadonlyField
                        label="Balance to Receive"
                        value={`${balanceToReceive} ${activeJob.uom}`}
                        emphasize
                      />
                    </div>
                  </div>

                  {/* ---------- 3. Input Material Receipt ---------- */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">Input Material Receipt</h3>
                    <p className="modal-card-subtitle">
                      How many of the original {activeJob.material.toLowerCase()}{" "}
                      units were processed / consumed?
                    </p>
                    <div className="receive-input-row">
                      <div className="form-field">
                        <label htmlFor="completed-input-qty">
                          Completed Input Quantity
                        </label>
                        <input
                          id="completed-input-qty"
                          type="number"
                          min="0"
                          max={balanceToReceive}
                          placeholder={`e.g. ${balanceToReceive}`}
                          value={form.completedInputQty}
                          onChange={(e) =>
                            handleCompletedInputChange(e.target.value)
                          }
                        />
                      </div>
                      <div className="remaining-preview">
                        <span className="readonly-label">
                          Remaining Input Quantity
                        </span>
                        <strong>
                          {inputEntered ? remainingInputQty : "—"}{" "}
                          {inputEntered ? activeJob.uom : ""}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* ---------- 4. Process Output ---------- */}
                  {inputEntered && (
                    <div className="modal-card">
                      <div className="modal-card-header-row">
                        <h3 className="modal-card-title">{outputConfig.label}</h3>
                        <button
                          type="button"
                          onClick={addOutputPiece}
                          className="btn-link"
                        >
                          + Add Another Piece
                        </button>
                      </div>

                      <div className="pieces-table-wrap">
                        <table className="pieces-table">
                          <thead>
                            <tr>
                              {outputConfig.fields.map((f) => (
                                <th key={f.key}>{f.label}</th>
                              ))}
                              <th>Thickness</th>
                              <th aria-label="Remove" />
                            </tr>
                          </thead>
                          <tbody>
                            {form.outputPieces.map((piece) => (
                              <tr key={piece.rowId}>
                                {outputConfig.fields.map((f) => (
                                  <td key={f.key}>
                                    <div className="form-field">
                                      <input
                                        type={f.type}
                                        placeholder={
                                          f.key === "pieceNo" ? "PL001" : ""
                                        }
                                        value={piece[f.key]}
                                        onChange={(e) =>
                                          updateOutputPiece(
                                            piece.rowId,
                                            f.key,
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  </td>
                                ))}
                                <td>
                                  <div className="form-field">
                                    <input
                                      value={activeJob.thickness}
                                      disabled
                                      title="Thickness comes from the original issued material"
                                    />
                                  </div>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => removeOutputPiece(piece.rowId)}
                                    disabled={form.outputPieces.length === 1}
                                    className="btn-ghost btn-sm"
                                    title="Remove Piece"
                                    style={{
                                      color: "var(--text-muted)",
                                      padding: "4px",
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="pieces-summary">
                        <span>
                          Total Output: <strong>{totalOutputQty} Nos</strong>
                        </span>
                        <span className="summary-note">
                          Output quantity is independent of input quantity — one
                          input unit can yield many output pieces.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ---------- 5. Remaining Input Material ---------- */}
                  {inputEntered && remainingInputQty > 0 && (
                    <div className="modal-card">
                      <div className="modal-card-header-row">
                        <h3 className="modal-card-title">
                          Remaining Input Material ({remainingInputQty})
                        </h3>
                        <button
                          type="button"
                          onClick={addRemainingPiece}
                          className="btn-link"
                        >
                          + Add Another Remaining Piece
                        </button>
                      </div>

                      {form.remainingPieces.map((piece, idx) => (
                        <div key={piece.rowId} className="remaining-row">
                          <div className="remaining-row-header">
                            Remaining {activeJob.material} {idx + 1}
                          </div>
                          <div className="remaining-grid">
                            <div className="form-field">
                              <label>Plate / Material No</label>
                              <input
                                value={piece.plateNo}
                                onChange={(e) =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "plateNo",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label>Length</label>
                              <input
                                type="number"
                                value={piece.length}
                                onChange={(e) =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "length",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label>Width</label>
                              <input
                                type="number"
                                value={piece.width}
                                onChange={(e) =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "width",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label>Thickness</label>
                              <input value={activeJob.thickness} disabled />
                            </div>
                            <div className="form-field">
                              <label>Weight</label>
                              <input
                                type="number"
                                value={piece.weight}
                                onChange={(e) =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "weight",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="form-field remaining-remarks">
                              <label>Remarks</label>
                              <input
                                value={piece.remarks}
                                onChange={(e) =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "remarks",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>

                          {/* Rework decision per remaining piece */}
                          <div className="radio-group">
                            <span className="radio-label">
                              Rework required?
                            </span>
                            <label className="radio-option">
                              <input
                                type="radio"
                                name={`rework-${piece.rowId}`}
                                checked={piece.reworkRequired === "No"}
                                onChange={() =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "reworkRequired",
                                    "No",
                                  )
                                }
                              />
                              No
                            </label>
                            <label className="radio-option">
                              <input
                                type="radio"
                                name={`rework-${piece.rowId}`}
                                checked={piece.reworkRequired === "Yes"}
                                onChange={() =>
                                  updateRemainingPiece(
                                    piece.rowId,
                                    "reworkRequired",
                                    "Yes",
                                  )
                                }
                              />
                              Yes
                            </label>
                            {form.remainingPieces.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRemainingPiece(piece.rowId)}
                                className="btn-ghost btn-sm remaining-remove"
                                title="Remove Piece"
                                style={{ color: "var(--text-muted)" }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ---------- 6. Received By ---------- */}
                  <div className="form-field">
                    <label htmlFor="received-by">Received By</label>
                    <select
                      id="received-by"
                      value={form.receivedBy}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, receivedBy: e.target.value }))
                      }
                    >
                      <option value="">Select employee</option>
                      {employees.map((emp) => (
                        <option key={emp}>{emp}</option>
                      ))}
                    </select>
                  </div>

                  {error && <div className="error-box">{error}</div>}

                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReceive}
                      className="btn btn-primary"
                    >
                      Receive Job Work
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------
function ReadonlyField({ label, value, emphasize }) {
  return (
    <div className="readonly-field">
      <label className="readonly-label">{label}</label>
      <div
        className={`readonly-value ${
          emphasize ? "readonly-value-emphasis" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="All">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}