import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Eye, Truck } from "lucide-react";
import Header from "../../components/Header";
import "./Dispatch.css";

// =========================================================================
// Date helpers
// =========================================================================
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const parseISO = (iso) => new Date(`${iso}T00:00:00`);

const formatDate = (iso) => {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysBetween = (fromIso, toIso) => {
  const MS_DAY = 1000 * 60 * 60 * 24;
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / MS_DAY);
};

const durationLabel = (startIso, endIso) => {
  const n = daysBetween(startIso, endIso);
  return n <= 0 ? "0 Days" : `${n} Day${n === 1 ? "" : "s"}`;
};

// Dispatch Date - Production End Date, always shown, negative never hidden.
const dispatchDiffLabel = (dispatchIso, endIso) => {
  const n = daysBetween(endIso, dispatchIso);
  if (n === 0) return "Same Day · 0 Days";
  if (n > 0) return `${n} Day${n === 1 ? "" : "s"} After Production`;
  return `${Math.abs(n)} Day${
    Math.abs(n) === 1 ? "" : "s"
  } Before Production Completion`;
};

// =========================================================================
// Read-only production source data.
// =========================================================================
const dispatchTx = (id, overrides) => ({
  dispatchId: id,
  date: "",
  time: "",
  dispatchTo: "",
  location: "",
  vehicleNumber: "",
  transporter: "",
  driverName: "",
  driverContact: "",
  qty: 0,
  remarks: "",
  ...overrides,
});

const PRODUCTION_SOURCE = [
  {
    assemblyId: "ASM-001",
    project: "BHEL-001",
    dwgs: ["DWG-01", "DWG-02"],
    revision: "Rev-02",
    description: "Fabricated Assembly",
    plannedQty: 26,
    productionStartDate: "2026-09-01",
    productionEndDate: "2026-09-06",
    processChain: [
      { name: "Fit-up", qcRequired: true },
      { name: "Welding", qcRequired: true },
      { name: "Grinding", qcRequired: false },
      { name: "Final Process", qcRequired: true },
    ],
    reworkPendingQty: 0,
    integration: {
      bom: "Description-1",
      poNumber: "PO-001",
      poDescription: "Description-1",
      grnStatus: "Received",
      materialStock: "Available",
      issueToProduction: "Issued",
    },
    productionHistory: [
      { date: "2026-09-01", event: "Fit-up started — 26 Nos" },
      { date: "2026-09-01", event: "Fit-up completed and QC Approved — 26 Nos" },
      { date: "2026-09-02", event: "Welding completed — 26 Nos" },
      {
        date: "2026-09-03",
        event: "Welding QC: 25 Accepted, 1 Rejected — sent to Rework",
      },
      { date: "2026-09-03", event: "Rework completed and re-verified — 1 Nos" },
      { date: "2026-09-04", event: "Grinding completed — 26 Nos" },
      {
        date: "2026-09-06",
        event: "Final Process completed and QC Approved — 26 Nos",
      },
      { date: "2026-09-06", event: "Assembly Completed — Ready for Dispatch" },
    ],
    dispatches: [],
  },
  {
    assemblyId: "ASM-002",
    project: "BHEL-001",
    dwgs: ["DWG-03"],
    revision: "Rev-01",
    description: "Fabricated Bracket Assembly",
    plannedQty: 26,
    productionStartDate: "2026-08-25",
    productionEndDate: "2026-09-04",
    processChain: [
      { name: "Fit-up", qcRequired: true },
      { name: "Welding", qcRequired: true },
      { name: "Grinding", qcRequired: false },
      { name: "Final Process", qcRequired: true },
    ],
    reworkPendingQty: 0,
    integration: {
      bom: "Description-6",
      poNumber: "PO-006",
      poDescription: "Description-6",
      grnStatus: "Received",
      materialStock: "Available",
      issueToProduction: "Issued",
    },
    productionHistory: [
      {
        date: "2026-08-25",
        event: "Fit-up completed and QC Approved — 26 Nos",
      },
      {
        date: "2026-08-28",
        event: "Welding completed and QC Approved — 26 Nos",
      },
      { date: "2026-08-31", event: "Grinding completed — 26 Nos" },
      {
        date: "2026-09-04",
        event: "Final Process completed and QC Approved — 26 Nos",
      },
      { date: "2026-09-04", event: "Assembly Completed — Ready for Dispatch" },
    ],
    dispatches: [
      dispatchTx("DISP-001", {
        date: "2026-09-06",
        time: "10:30",
        dispatchTo: "BHEL",
        location: "Chennai Plant",
        vehicleNumber: "TN01AB1234",
        transporter: "ABC Transport",
        driverName: "Kumar",
        driverContact: "9876543210",
        qty: 20,
        remarks: "First lot dispatched.",
      }),
    ],
  },
  {
    assemblyId: "ASM-003",
    project: "BHEL-002",
    dwgs: ["DWG-101"],
    revision: "Rev-00",
    description: "Support Frame Assembly",
    plannedQty: 40,
    productionStartDate: "2026-08-10",
    productionEndDate: "2026-08-20",
    processChain: [
      { name: "Fit-up", qcRequired: true },
      { name: "Welding", qcRequired: true },
      { name: "Grinding", qcRequired: false },
      { name: "Final Process", qcRequired: true },
    ],
    reworkPendingQty: 0,
    integration: {
      bom: "Description-7",
      poNumber: "PO-007",
      poDescription: "Description-7",
      grnStatus: "Received",
      materialStock: "Available",
      issueToProduction: "Issued",
    },
    productionHistory: [
      {
        date: "2026-08-10",
        event: "Fit-up completed and QC Approved — 40 Nos",
      },
      {
        date: "2026-08-13",
        event: "Welding completed and QC Approved — 40 Nos",
      },
      { date: "2026-08-16", event: "Grinding completed — 40 Nos" },
      {
        date: "2026-08-20",
        event: "Final Process completed and QC Approved — 40 Nos",
      },
      { date: "2026-08-20", event: "Assembly Completed — Ready for Dispatch" },
    ],
    dispatches: [
      dispatchTx("DISP-002", {
        date: "2026-08-22",
        time: "09:15",
        dispatchTo: "BHEL",
        location: "Trichy Plant",
        vehicleNumber: "TN37CD5678",
        transporter: "Sri Transport",
        driverName: "Selvam",
        driverContact: "9944556677",
        qty: 25,
        remarks: "First lot dispatched.",
      }),
      dispatchTx("DISP-003", {
        date: "2026-08-25",
        time: "14:00",
        dispatchTo: "BHEL",
        location: "Trichy Plant",
        vehicleNumber: "TN37CD5678",
        transporter: "Sri Transport",
        driverName: "Selvam",
        driverContact: "9944556677",
        qty: 15,
        remarks: "Final lot dispatched — assembly fully cleared.",
      }),
    ],
  },
  {
    assemblyId: "ASM-004",
    project: "Project-003",
    dwgs: ["DWG-201"],
    revision: "Rev-01",
    description: "Pipe Support Assembly",
    plannedQty: 12,
    productionStartDate: "2026-08-28",
    productionEndDate: "2026-09-05",
    processChain: [
      { name: "Fit-up", qcRequired: true },
      { name: "Welding", qcRequired: true },
      { name: "Grinding", qcRequired: false },
      { name: "Final Process", qcRequired: true },
    ],
    reworkPendingQty: 0,
    integration: {
      bom: "Description-8",
      poNumber: "PO-008",
      poDescription: "Description-8",
      grnStatus: "Received",
      materialStock: "Available",
      issueToProduction: "Issued",
    },
    productionHistory: [
      {
        date: "2026-08-28",
        event: "Fit-up completed and QC Approved — 12 Nos",
      },
      {
        date: "2026-08-30",
        event: "Welding completed and QC Approved — 12 Nos",
      },
      { date: "2026-09-02", event: "Grinding completed — 12 Nos" },
      {
        date: "2026-09-05",
        event: "Final Process completed and QC Approved — 12 Nos",
      },
      { date: "2026-09-05", event: "Assembly Completed — Ready for Dispatch" },
    ],
    dispatches: [],
  },
  // ASM-005 is still in production — Grinding has 1 Nos in Rework.
  {
    assemblyId: "ASM-005",
    project: "BHEL-001",
    dwgs: ["DWG-04"],
    revision: "Rev-00",
    description: "Gusset Plate Assembly",
    plannedQty: 10,
    productionStartDate: "2026-09-02",
    productionEndDate: null,
    processChain: [
      { name: "Fit-up", qcRequired: true },
      { name: "Welding", qcRequired: true },
      { name: "Grinding", qcRequired: false },
      { name: "Final Process", qcRequired: true },
    ],
    reworkPendingQty: 1,
    integration: {
      bom: "Description-9",
      poNumber: "PO-009",
      poDescription: "Description-9",
      grnStatus: "Received",
      materialStock: "Available",
      issueToProduction: "Issued",
    },
    productionHistory: [
      {
        date: "2026-09-02",
        event: "Fit-up completed and QC Approved — 10 Nos",
      },
      {
        date: "2026-09-04",
        event: "Welding QC: 9 Accepted, 1 Rejected — sent to Rework",
      },
    ],
    dispatches: [],
  },
];

const isReadyForDispatch = (src) =>
  Boolean(src.productionEndDate) && src.reworkPendingQty === 0;

// -------------------------------------------------------------------------
// Row builder
// -------------------------------------------------------------------------
const buildRow = (src) => {
  const dispatchedQty = src.dispatches.reduce((sum, d) => sum + d.qty, 0);
  const balanceQty = src.plannedQty - dispatchedQty;
  const dispatchStatus =
    dispatchedQty === 0
      ? "Ready for Dispatch"
      : balanceQty > 0
      ? "Partially Dispatched"
      : "Dispatched";
  const duration =
    src.productionStartDate && src.productionEndDate
      ? durationLabel(src.productionStartDate, src.productionEndDate)
      : "—";

  return {
    ...src,
    dwgText: src.dwgs.join(" + "),
    dispatchedQty,
    balanceQty,
    dispatchStatus,
    currentStatus: "Final Production Completed",
    duration,
  };
};

// =========================================================================
// Filters
// =========================================================================
const FILTER_FIELDS = [
  { key: "assemblyId", label: "Assembly", type: "text" },
  { key: "dwgText", label: "DWG", type: "text" },
  { key: "revision", label: "Revision", type: "select" },
  { key: "dispatchStatus", label: "Dispatch Status", type: "select" },
];

const buildOptionsMap = (rows) => {
  const map = {};
  FILTER_FIELDS.forEach((f) => {
    if (f.type === "select") {
      map[f.key] = [
        ...new Set(rows.map((r) => r[f.key]).filter(Boolean)),
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

const withinDateRange = (iso, from, to) => {
  if (!iso) return !from && !to;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
};

const matchesSearch = (row, search) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  const fields = ["assemblyId", "project", "dwgText", "description"];
  return fields.some((k) =>
    String(row[k] ?? "")
      .toLowerCase()
      .includes(term)
  );
};

// =========================================================================
// Dispatch form
// =========================================================================
const emptyDispatchForm = () => ({
  date: today(),
  time: nowTime(),
  dispatchTo: "",
  location: "",
  vehicleNumber: "",
  transporter: "",
  driverName: "",
  driverContact: "",
  qty: "",
  remarks: "",
});

let dispatchCounter = PRODUCTION_SOURCE.reduce(
  (max, a) =>
    Math.max(
      max,
      ...a.dispatches.map((d) => Number(d.dispatchId.split("-")[1]) || 0)
    ),
  0
);
const nextDispatchId = () => {
  dispatchCounter += 1;
  return `DISP-${String(dispatchCounter).padStart(3, "0")}`;
};

export default function Dispatch() {
  const navigate = useNavigate();

  const [assemblies, setAssemblies] = useState(PRODUCTION_SOURCE);

  const readyRows = useMemo(
    () => assemblies.filter(isReadyForDispatch).map(buildRow),
    [assemblies]
  );

  const projectOptions = useMemo(
    () =>
      ["All Projects", ...new Set(readyRows.map((r) => r.project))].sort(
        (a, b) =>
          a === "All Projects" ? -1 : b === "All Projects" ? 1 : a.localeCompare(b)
      ),
    [readyRows]
  );
  const [selectedProject, setSelectedProject] = useState("All Projects");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [dateFilters, setDateFilters] = useState({
    endFrom: "",
    endTo: "",
    dispatchFrom: "",
    dispatchTo: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewAssemblyId, setViewAssemblyId] = useState(null);
  const [dispatchAssemblyId, setDispatchAssemblyId] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");

  // ---------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------
  const projectRows = useMemo(
    () =>
      selectedProject === "All Projects"
        ? readyRows
        : readyRows.filter((r) => r.project === selectedProject),
    [readyRows, selectedProject]
  );

  const filteredRows = useMemo(
    () =>
      projectRows.filter((r) => {
        if (!matchesFilters(r, filters)) return false;
        if (!matchesSearch(r, search)) return false;
        if (
          !withinDateRange(
            r.productionEndDate,
            dateFilters.endFrom,
            dateFilters.endTo
          )
        )
          return false;
        const lastDispatchDate = r.dispatches.length
          ? r.dispatches[r.dispatches.length - 1].date
          : "";
        if (
          (dateFilters.dispatchFrom || dateFilters.dispatchTo) &&
          !withinDateRange(
            lastDispatchDate,
            dateFilters.dispatchFrom,
            dateFilters.dispatchTo
          )
        )
          return false;
        return true;
      }),
    [projectRows, filters, search, dateFilters]
  );

  const filterOptions = useMemo(
    () => buildOptionsMap(projectRows),
    [projectRows]
  );

  const viewAssembly = viewAssemblyId
    ? buildRow(assemblies.find((a) => a.assemblyId === viewAssemblyId))
    : null;

  const dispatchAssembly = dispatchAssemblyId
    ? buildRow(assemblies.find((a) => a.assemblyId === dispatchAssemblyId))
    : null;

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handleProjectChange = (value) => {
    setSelectedProject(value);
    setFilters({});
    setSearch("");
    setFiltersOpen(false);
  };
  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const handleDateFilterChange = (key, value) =>
    setDateFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => {
    setFilters({});
    setSearch("");
    setDateFilters({
      endFrom: "",
      endTo: "",
      dispatchFrom: "",
      dispatchTo: "",
    });
  };

  const openView = (assemblyId) => setViewAssemblyId(assemblyId);
  const closeView = () => setViewAssemblyId(null);

  const openDispatch = (assemblyId) => {
    setDispatchAssemblyId(assemblyId);
    setForm(emptyDispatchForm());
    setFormError("");
    setFormWarning("");
  };
  const closeDispatch = () => {
    setDispatchAssemblyId(null);
    setForm({});
    setFormError("");
    setFormWarning("");
  };

  const updateForm = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormWarning("");
  };

  const handleSaveDispatch = () => {
    if (!form.date) return setFormError("Dispatch Date is required.");
    if (!form.dispatchTo.trim())
      return setFormError("Dispatch destination is required.");
    const qty = Number(form.qty);
    if (!form.qty || qty <= 0)
      return setFormError("Dispatch Quantity is required.");
    if (qty > dispatchAssembly.balanceQty) {
      return setFormError("Dispatch quantity cannot exceed finished quantity.");
    }

    const newDispatch = dispatchTx(nextDispatchId(), {
      date: form.date,
      time: form.time,
      dispatchTo: form.dispatchTo.trim(),
      location: form.location.trim(),
      vehicleNumber: form.vehicleNumber.trim(),
      transporter: form.transporter.trim(),
      driverName: form.driverName.trim(),
      driverContact: form.driverContact.trim(),
      qty,
      remarks: form.remarks.trim(),
    });

    setAssemblies((prev) =>
      prev.map((a) =>
        a.assemblyId !== dispatchAssembly.assemblyId
          ? a
          : { ...a, dispatches: [...a.dispatches, newDispatch] }
      )
    );
    closeDispatch();
  };

  const handleDateBlurCheck = () => {
    if (!form.date || !dispatchAssembly) return;
    if (form.date < dispatchAssembly.productionEndDate) {
      setFormWarning("Dispatch date is before production completion date.");
    } else {
      setFormWarning("");
    }
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
                <h1 className="page-header-title">Dispatch</h1>
                <p className="page-header-subtitle">
                  Assemblies that have finished every production process and
                  cleared QC and rework are listed here, ready to be dispatched.
                  Production dates and process history are read-only — Dispatch
                  only records the outbound transaction.
                </p>
              </div>
            </div>
          </div>

          {/* ===================== PROJECT SELECTOR ===================== */}
          <div className="project-bar">
            <label htmlFor="project-select" className="project-label">
              Project
            </label>
            <select
              id="project-select"
              className="project-select"
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              {projectOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="project-hint">
              Showing completed assemblies under{" "}
              <strong>{selectedProject}</strong>
            </span>
          </div>

          {/* ===================== DISPATCH TABLE ===================== */}
          <div className="panel">
            <FilterPanel
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={handleFilterChange}
              dateFilters={dateFilters}
              onDateFilterChange={handleDateFilterChange}
              options={filterOptions}
              onClear={clearFilters}
              open={filtersOpen}
              onToggleOpen={() => setFiltersOpen((o) => !o)}
              resultCount={filteredRows.length}
            />

            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Assembly ID</th>
                    <th>Project</th>
                    <th>DWG / Description</th>
                    <th>Revision</th>
                    <th>Production</th>
                    <th>Quantity</th>
                    <th>Dispatch Status</th>
                    <th className="cell-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🚚</div>
                          <p className="empty-state-title">
                            No Assemblies Ready For Dispatch
                          </p>
                          <p className="empty-state-desc">
                            Nothing matches the current project / search /
                            filters. An assembly only appears here once every
                            production process is complete and no quantity is
                            pending rework.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredRows.map((row) => (
                    <tr key={row.assemblyId}>
                      <td className="cell-id">{row.assemblyId}</td>
                      <td>{row.project}</td>
                      <td>
                        <div className="dwg-cell">{row.dwgText}</div>
                        <div className="desc-cell">{row.description}</div>
                      </td>
                      <td>{row.revision}</td>
                      <td>
                        <div className="prod-dates">
                          {formatDate(row.productionStartDate)} →{" "}
                          {formatDate(row.productionEndDate)}
                        </div>
                        <div className="prod-duration">{row.duration}</div>
                      </td>
                      <td>
                        <div className="qty-cell">
                          <span className="qty-total">
                            {row.plannedQty} Total
                          </span>
                          <span className="qty-sub">
                            {row.dispatchedQty} Dispatched · {row.balanceQty}{" "}
                            Balance
                          </span>
                        </div>
                      </td>
                      <td>
                        <DispatchStatusBadge status={row.dispatchStatus} />
                      </td>
                      <td>
                        <div className="action-cell">
                          <button
                            type="button"
                            onClick={() => openView(row.assemblyId)}
                            className="icon-btn"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          {row.balanceQty > 0 ? (
                            <button
                              type="button"
                              onClick={() => openDispatch(row.assemblyId)}
                              className="btn btn-primary btn-sm"
                            >
                              <Truck size={13} />
                              Dispatch
                            </button>
                          ) : (
                            <span className="locked-pill">Dispatched</span>
                          )}
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

      {/* ===================== EYE VIEW MODAL ===================== */}
      {viewAssembly && (
        <div className="modal-overlay" onClick={closeView}>
          <div
            className="modal-box modal-box-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2 className="modal-title">{viewAssembly.assemblyId}</h2>
                <p className="modal-subtitle">
                  Project : <strong>{viewAssembly.project}</strong> · DWG(s) :{" "}
                  <strong>{viewAssembly.dwgText}</strong>
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
              <EyeViewBody assembly={viewAssembly} />
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

      {/* ===================== DISPATCH FORM MODAL ===================== */}
      {dispatchAssembly && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <div>
                <h2 className="modal-title">Dispatch Assembly</h2>
                <p className="modal-subtitle">
                  Assembly : <strong>{dispatchAssembly.assemblyId}</strong> ·
                  Balance : <strong>{dispatchAssembly.balanceQty}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeDispatch}
                className="modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <DispatchFormBody
                assembly={dispatchAssembly}
                form={form}
                setForm={updateForm}
                onDateBlur={handleDateBlurCheck}
              />
              {formWarning && (
                <div className="warning-box">{formWarning}</div>
              )}
              {formError && <div className="error-box">{formError}</div>}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={closeDispatch}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDispatch}
                className="btn btn-primary"
              >
                Save Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =========================================================================
// Filter panel
// =========================================================================
function FilterPanel({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  dateFilters,
  onDateFilterChange,
  options,
  onClear,
  open,
  onToggleOpen,
  resultCount,
}) {
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length +
    Object.values(dateFilters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder="Search Assembly, Project, DWG, Description..."
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={onToggleOpen}
        className={`btn btn-secondary btn-sm ${
          open ? "btn-outline-active" : ""
        }`}
      >
        Filters
        {activeFilterCount > 0 && (
          <span
            style={{
              background: "var(--primary)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "0 6px",
              borderRadius: 999,
            }}
          >
            {activeFilterCount}
          </span>
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
          <div className="form-field">
            <label>Production End Date</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFilters.endFrom}
                onChange={(e) => onDateFilterChange("endFrom", e.target.value)}
              />
              <span>to</span>
              <input
                type="date"
                value={dateFilters.endTo}
                onChange={(e) => onDateFilterChange("endTo", e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Dispatch Date</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFilters.dispatchFrom}
                onChange={(e) =>
                  onDateFilterChange("dispatchFrom", e.target.value)
                }
              />
              <span>to</span>
              <input
                type="date"
                value={dateFilters.dispatchTo}
                onChange={(e) =>
                  onDateFilterChange("dispatchTo", e.target.value)
                }
              />
            </div>
          </div>
        </div>
      )}

      <p
        style={{
          margin: "12px 2px 0",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        {resultCount} assembl{resultCount !== 1 ? "ies" : "y"} found
      </p>
    </div>
  );
}

// =========================================================================
// Dispatch form body
// =========================================================================
function DispatchFormBody({ assembly, form, setForm, onDateBlur }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Assembly Information</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Assembly ID"
            value={assembly.assemblyId}
            emphasize
          />
          <ReadonlyField label="Project" value={assembly.project} />
          <ReadonlyField label="DWG" value={assembly.dwgText} />
          <ReadonlyField label="Revision" value={assembly.revision} />
          <ReadonlyField
            label="Quantity"
            value={`${assembly.plannedQty} (Balance ${assembly.balanceQty})`}
          />
          <ReadonlyField
            label="Production Start Date"
            value={formatDate(assembly.productionStartDate)}
          />
          <ReadonlyField
            label="Production End Date"
            value={formatDate(assembly.productionEndDate)}
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">Dispatch Information</h3>
        <div className="form-grid">
          <div className="form-field">
            <label>Dispatch Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm("date", e.target.value)}
              onBlur={onDateBlur}
            />
          </div>
          <div className="form-field">
            <label>Dispatch Time</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm("time", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Dispatch To / Destination</label>
            <input
              type="text"
              placeholder="e.g. BHEL"
              value={form.dispatchTo}
              onChange={(e) => setForm("dispatchTo", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Dispatch Location</label>
            <input
              type="text"
              placeholder="e.g. Chennai Plant"
              value={form.location}
              onChange={(e) => setForm("location", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Vehicle Number</label>
            <input
              type="text"
              placeholder="e.g. TN01AB1234"
              value={form.vehicleNumber}
              onChange={(e) => setForm("vehicleNumber", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Transporter</label>
            <input
              type="text"
              value={form.transporter}
              onChange={(e) => setForm("transporter", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Driver Name</label>
            <input
              type="text"
              value={form.driverName}
              onChange={(e) => setForm("driverName", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Driver Contact Number</label>
            <input
              type="tel"
              value={form.driverContact}
              onChange={(e) => setForm("driverContact", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Dispatch Quantity</label>
            <input
              type="number"
              min="0"
              max={assembly.balanceQty}
              value={form.qty}
              onChange={(e) => setForm("qty", e.target.value)}
            />
          </div>
        </div>
        <div className="form-field" style={{ marginTop: 12 }}>
          <label>Remarks</label>
          <textarea
            rows={3}
            placeholder="Optional notes..."
            value={form.remarks}
            onChange={(e) => setForm("remarks", e.target.value)}
          />
        </div>
        {form.date && assembly.productionEndDate && (
          <p className="modal-card-footnote">
            Dispatch Difference:{" "}
            <strong>
              {dispatchDiffLabel(form.date, assembly.productionEndDate)}
            </strong>
          </p>
        )}
      </div>
    </>
  );
}

// =========================================================================
// Eye view body
// =========================================================================
function EyeViewBody({ assembly }) {
  return (
    <>
      {/* 1. Assembly Information */}
      <div className="modal-card">
        <h3 className="modal-card-title">1. Assembly Information</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Assembly ID"
            value={assembly.assemblyId}
            emphasize
          />
          <ReadonlyField label="Project" value={assembly.project} />
          <ReadonlyField label="DWG" value={assembly.dwgText} />
          <ReadonlyField label="Revision" value={assembly.revision} />
          <ReadonlyField label="Description" value={assembly.description} />
          <ReadonlyField label="Total Quantity" value={assembly.plannedQty} />
        </div>
      </div>

      {/* 2. Original Integration */}
      <div className="modal-card">
        <h3 className="modal-card-title">2. Original Integration</h3>
        <div className="readonly-grid">
          <ReadonlyField label="BOM" value={assembly.integration.bom} />
          <ReadonlyField label="PO" value={assembly.integration.poNumber} />
          <ReadonlyField
            label="PO Description"
            value={assembly.integration.poDescription}
          />
          <ReadonlyField label="GRN" value={assembly.integration.grnStatus} />
          <ReadonlyField
            label="Material Stock"
            value={assembly.integration.materialStock}
          />
          <ReadonlyField
            label="Issue To Production"
            value={assembly.integration.issueToProduction}
          />
          <ReadonlyField
            label="Assembly Integration"
            value={assembly.assemblyId}
          />
        </div>
        <p className="modal-card-footnote">
          Read-only trace back to sourcing. Dispatch never creates a new PO, GRN
          or integration.
        </p>
      </div>

      {/* 3. Production Information */}
      <div className="modal-card">
        <h3 className="modal-card-title">3. Production Information</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Production Start Date"
            value={formatDate(assembly.productionStartDate)}
          />
          <ReadonlyField
            label="Production End Date"
            value={formatDate(assembly.productionEndDate)}
          />
          <ReadonlyField
            label="Production Duration"
            value={assembly.duration}
            emphasize
          />
        </div>
      </div>

      {/* 4. Process Completion */}
      <div className="modal-card">
        <h3 className="modal-card-title">4. Process Completion</h3>
        <ol className="process-chain">
          {assembly.processChain.map((s, idx) => (
            <li key={idx} className="process-chain-step process-chain-done">
              <span className="process-chain-icon">✓</span>
              <span className="process-chain-name">{s.name}</span>
              {s.qcRequired ? (
                <span className="process-chain-tag process-chain-tag-qc">
                  QC Approved
                </span>
              ) : (
                <span className="process-chain-tag process-chain-tag-noqc">
                  QC not required
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="modal-card-footnote">
          Every stage has cleared its full planned quantity with no quantity left
          in rework.
        </p>
      </div>

      {/* 5. Quantity Information */}
      <div className="modal-card">
        <h3 className="modal-card-title">5. Quantity Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Total Quantity" value={assembly.plannedQty} />
          <ReadonlyField label="Dispatched" value={assembly.dispatchedQty} />
          <ReadonlyField
            label="Balance"
            value={assembly.balanceQty}
            emphasize
          />
          <ReadonlyField
            label="Dispatch Status"
            value={assembly.dispatchStatus}
          />
        </div>
      </div>

      {/* 6. Dispatch Information */}
      <div className="modal-card">
        <h3 className="modal-card-title">6. Dispatch Information</h3>
        {assembly.dispatches.length === 0 ? (
          <p className="modal-card-subtitle">Not dispatched yet.</p>
        ) : (
          <div className="readonly-grid">
            {(() => {
              const last = assembly.dispatches[assembly.dispatches.length - 1];
              return (
                <>
                  <ReadonlyField
                    label="Dispatch ID"
                    value={last.dispatchId}
                    emphasize
                  />
                  <ReadonlyField
                    label="Dispatch Date"
                    value={formatDate(last.date)}
                  />
                  <ReadonlyField label="Dispatch Time" value={last.time} />
                  <ReadonlyField
                    label="Destination"
                    value={`${last.dispatchTo} — ${last.location}`}
                  />
                  <ReadonlyField label="Vehicle" value={last.vehicleNumber} />
                  <ReadonlyField
                    label="Transporter"
                    value={last.transporter}
                  />
                  <ReadonlyField
                    label="Driver"
                    value={`${last.driverName} (${last.driverContact})`}
                  />
                  <ReadonlyField label="Quantity" value={last.qty} />
                  <ReadonlyField
                    label="Remarks"
                    value={last.remarks || "—"}
                  />
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* 7. Dispatch History */}
      <div className="modal-card">
        <h3 className="modal-card-title">7. Dispatch History</h3>
        <DispatchTimeline assembly={assembly} />

        {assembly.dispatches.length > 0 && (
          <div
            className="table-scroll-wrapper"
            style={{ marginTop: 14, borderRadius: 8 }}
          >
            <table className="data-table data-table-sub">
              <thead>
                <tr>
                  <th>Dispatch ID</th>
                  <th>Date</th>
                  <th>Destination</th>
                  <th>Vehicle</th>
                  <th>Qty</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {assembly.dispatches.map((d) => (
                  <tr key={d.dispatchId}>
                    <td className="cell-id">{d.dispatchId}</td>
                    <td>{formatDate(d.date)}</td>
                    <td>
                      {d.dispatchTo} — {d.location}
                    </td>
                    <td>{d.vehicleNumber}</td>
                    <td className="cell-num">{d.qty}</td>
                    <td>
                      {assembly.productionEndDate
                        ? dispatchDiffLabel(d.date, assembly.productionEndDate)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="modal-card-footnote">
          {assembly.dispatchedQty} / {assembly.plannedQty} Dispatched — Status:{" "}
          <strong>{assembly.dispatchStatus}</strong>
        </p>
      </div>
    </>
  );
}

// =========================================================================
// Timeline
// =========================================================================
function DispatchTimeline({ assembly }) {
  const steps = [
    {
      label: "Production Started",
      date: assembly.productionStartDate,
    },
    {
      label: "Production Completed",
      date: assembly.productionEndDate,
    },
    {
      label: "Ready For Dispatch",
      date: assembly.productionEndDate,
    },
    ...assembly.dispatches.map((d) => ({
      label: `Dispatched — ${d.dispatchId}`,
      date: d.date,
      note: `${d.qty} Qty · ${d.dispatchTo}${
        d.location ? ` (${d.location})` : ""
      }`,
      diff: assembly.productionEndDate
        ? dispatchDiffLabel(d.date, assembly.productionEndDate)
        : null,
    })),
  ];

  return (
    <ol className="timeline">
      {steps.map((s, idx) => (
        <li key={idx} className="timeline-step">
          <span className="timeline-dot" />
          <div className="timeline-body">
            <span className="timeline-label">{s.label}</span>
            <span className="timeline-date">{formatDate(s.date)}</span>
            {s.note && <span className="timeline-note">{s.note}</span>}
            {s.diff && <span className="timeline-diff">{s.diff}</span>}
          </div>
        </li>
      ))}
    </ol>
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
        className={`readonly-value ${
          emphasize ? "readonly-value-emphasis" : ""
        }`}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function DispatchStatusBadge({ status }) {
  const map = {
    "Ready for Dispatch": "status-badge-ready",
    "Partially Dispatched": "status-badge-partial",
    Dispatched: "status-badge-done",
  };
  return <span className={`status-badge ${map[status] || ""}`}>{status}</span>;
}