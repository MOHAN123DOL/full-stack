import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  X,
  Eye,
  Pencil,
  Trash2,
  Clock,
  Building2,
  Truck,
} from "lucide-react";
import Header from "../../components/Header";
import "./ProductionAssemblyIntegration.css";

// =========================================================================
// PRODUCTION ASSEMBLY INTEGRATION
// -------------------------------------------------------------------------
// This menu defines the PLANNED structure of an assembly: which production
// materials and/or previously-created assemblies are combined, in what
// quantities, and the complete process route (with QC checkpoints) that the
// assembly must travel through in Production Operation.
//
// It does NOT execute production — Production Operation (a separate menu)
// is responsible for walking an assembly through the route defined here.
//
// The page is built for normal ERP users, not developers: a guided
// step-by-step wizard for creating an assembly, plain-language labels and
// messages everywhere, and a details view organized into simple tabs.
// Visual language is carried over from IssueToProduction.jsx/css (same
// header, cards, table, filter toolbar, modal, and badge conventions).
// =========================================================================

// -------------------------------------------------------------------------
// Dummy reference data — Project → DWG → Production Material hierarchy.
// This represents material that has already been Issued to Production and
// is sitting there waiting to be built into an assembly. Every material
// here also carries the original PO / BOM / GRN trail so the "Original
// Integration" story can be told in plain language later in the page.
// -------------------------------------------------------------------------
const PROJECTS = ["BHEL-01", "NTPC-02"];

const DWGS_BY_PROJECT = {
  "BHEL-01": ["DWG-01", "DWG-02"],
  "NTPC-02": ["DWG-101"],
};

const PRODUCTION_MATERIALS = [
  {
    id: "PM-PL01",
    project: "BHEL-01",
    dwg: "DWG-01",
    material: "Plate",
    materialCode: "PL-001",
    thickness: "8 mm",
    size: "2000 × 2000",
    unit: "Nos",
    totalQty: 5,
    bomDescription: "Base Plate — Description 1",
    poNumber: "PO-001",
    grnQty: 5,
  },
  {
    id: "PM-PI01",
    project: "BHEL-01",
    dwg: "DWG-01",
    material: "Pipe",
    materialCode: "PI-001",
    thickness: "8 mm",
    size: "100 NB",
    unit: "Nos",
    totalQty: 5,
    bomDescription: "Support Pipe — Description 2",
    poNumber: "PO-002",
    grnQty: 5,
  },
  {
    id: "PM-CH01",
    project: "BHEL-01",
    dwg: "DWG-02",
    material: "Channel",
    materialCode: "CH-001",
    thickness: "6 mm",
    size: "150 × 75",
    unit: "Nos",
    totalQty: 5,
    bomDescription: "Frame Channel — Description 3",
    poNumber: "PO-003",
    grnQty: 5,
  },
  {
    id: "PM-PI02",
    project: "BHEL-01",
    dwg: "DWG-02",
    material: "Pipe",
    materialCode: "PI-002",
    thickness: "6 mm",
    size: "100 NB",
    unit: "Nos",
    totalQty: 5,
    bomDescription: "Cross Pipe — Description 4",
    poNumber: "PO-004",
    grnQty: 5,
  },
  {
    id: "PM-AN01",
    project: "NTPC-02",
    dwg: "DWG-101",
    material: "Angle",
    materialCode: "AN-001",
    thickness: "5 mm",
    size: "50 × 50",
    unit: "Nos",
    totalQty: 8,
    bomDescription: "Support Angle — Description 5",
    poNumber: "PO-101",
    grnQty: 8,
  },
];

const materialById = (id) => PRODUCTION_MATERIALS.find((m) => m.id === id);

// An assembly always produces exactly ONE finished unit that can, in turn,
// become the input of a later assembly (ASM-001 + ASM-002 -> ASM-003).
const ASSEMBLY_PRODUCED_QTY = 1;

// -------------------------------------------------------------------------
// Seed assemblies — demonstrates every required scenario:
//   ASM-001  Plate + Pipe                          -> In Progress (locked)
//   ASM-002  Channel + Pipe                        -> Planned (editable)
//   ASM-003  ASM-001 + ASM-002 (assembly+assembly) -> Planned, cross-DWG
// Assemblies no longer carry a single fixed DWG — materials can come from
// any drawing in the project, which is what makes cross-DWG assemblies
// possible. The drawing(s) an assembly touches are always derived from its
// actual inputs (see getAssemblyDwgs).
// -------------------------------------------------------------------------
let assemblyCounter = 3;
const generateAssemblyId = () =>
  `ASM-${String(++assemblyCounter).padStart(3, "0")}`;

// Same vendor list / naming convention already used for outsourcing in
// Issue To Job Work — reused here rather than inventing a second list.
const VENDORS = [
  "Shree Fabricators",
  "Om Engineering Works",
  "Precision Metal Works",
  "Bharat CNC Solutions",
  "ABC Blasting Works",
  "ABC Painting Works",
];

// "Execution" describes HOW a process is carried out — In-House (and which
// unit) or Outsourcing (and to which vendor). This is configured once here
// and Production Operation only ever reads it; it is never asked again.
const emptyOutsourcing = () => ({
  vendor: "",
  vendorContact: "",
  vendorLocation: "",
  expectedReturnDate: "",
  remarks: "",
});

let processRowSeq = 1;
const newProcessRow = (overrides = {}) => ({
  rowId: `proc-${processRowSeq++}`,
  name: "",
  processId: "",
  qcRequired: false,
  executionType: "In-House", // "In-House" | "Outsourcing"
  executionUnit: "Unit 1", // "Unit 1" | "Unit 2" — used when In-House
  outsourcing: null, // emptyOutsourcing() shape — used when Outsourcing
  ...overrides,
});

let inputRowSeq = 1;
const newInputRow = (overrides = {}) => ({
  rowId: `input-${inputRowSeq++}`,
  sourceType: "material", // "material" | "assembly"
  sourceId: "",
  useQty: "",
  ...overrides,
});

const initialAssemblies = [
  {
    assemblyId: "ASM-001",
    project: "BHEL-01",
    inputs: [
      { sourceType: "material", sourceId: "PM-PL01", useQty: 3 },
      { sourceType: "material", sourceId: "PM-PI01", useQty: 3 },
    ],
    processes: [
      {
        name: "Fit-up",
        processId: "FIT01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "Welding",
        processId: "WEL01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "Grinding",
        processId: "GRD01",
        qcRequired: false,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "Painting",
        processId: "PNT01",
        qcRequired: true,
        executionType: "Outsourcing",
        executionUnit: null,
        outsourcing: {
          vendor: "ABC Painting Works",
          vendorContact: "98765 43210",
          vendorLocation: "Chennai",
          expectedReturnDate: "2026-09-20",
          remarks: "",
        },
      },
    ],
    status: "In Progress",
    createdDate: "2026-08-29",
  },
  {
    assemblyId: "ASM-002",
    project: "BHEL-01",
    inputs: [
      { sourceType: "material", sourceId: "PM-CH01", useQty: 3 },
      { sourceType: "material", sourceId: "PM-PI02", useQty: 3 },
    ],
    processes: [
      {
        name: "Fit-up",
        processId: "FIT01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "Welding",
        processId: "WEL01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "Inspection",
        processId: "INS01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 2",
        outsourcing: null,
      },
    ],
    status: "Planned",
    createdDate: "2026-09-02",
  },
  {
    assemblyId: "ASM-003",
    project: "BHEL-01",
    inputs: [
      { sourceType: "assembly", sourceId: "ASM-001", useQty: 1 },
      { sourceType: "assembly", sourceId: "ASM-002", useQty: 1 },
    ],
    processes: [
      {
        name: "Fit-up",
        processId: "FIT01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "Welding",
        processId: "WEL01",
        qcRequired: true,
        executionType: "In-House",
        executionUnit: "Unit 1",
        outsourcing: null,
      },
      {
        name: "NDT",
        processId: "NDT01",
        qcRequired: true,
        executionType: "Outsourcing",
        executionUnit: null,
        outsourcing: {
          vendor: "Precision Metal Works",
          vendorContact: "90000 11111",
          vendorLocation: "Trichy",
          expectedReturnDate: "2026-09-25",
          remarks: "",
        },
      },
      {
        name: "Painting",
        processId: "PNT01",
        qcRequired: true,
        executionType: "Outsourcing",
        executionUnit: null,
        outsourcing: {
          vendor: "ABC Painting Works",
          vendorContact: "98765 43210",
          vendorLocation: "Chennai",
          expectedReturnDate: "2026-09-28",
          remarks: "",
        },
      },
    ],
    status: "Planned",
    createdDate: "2026-09-04",
  },
];

// -------------------------------------------------------------------------
// Availability engine
// Every input source (raw material OR a previous assembly) tracks its own
// Available / Used / Balance independently. Balances are derived — never
// stored — by summing how much of a source every assembly has drawn on.
// -------------------------------------------------------------------------
const getUsedQtyForSource = (
  sourceType,
  sourceId,
  assemblies,
  excludeAssemblyId
) =>
  assemblies
    .filter((a) => a.assemblyId !== excludeAssemblyId)
    .reduce((sum, a) => {
      const hit = a.inputs.find(
        (inp) => inp.sourceType === sourceType && inp.sourceId === sourceId
      );
      return sum + (hit ? Number(hit.useQty) : 0);
    }, 0);

const getSourceTotalQty = (sourceType, sourceId) => {
  if (sourceType === "material") {
    const mat = materialById(sourceId);
    return mat ? mat.totalQty : 0;
  }
  return ASSEMBLY_PRODUCED_QTY;
};

const getAvailableQty = (
  sourceType,
  sourceId,
  assemblies,
  excludeAssemblyId
) => {
  const total = getSourceTotalQty(sourceType, sourceId);
  const used = getUsedQtyForSource(
    sourceType,
    sourceId,
    assemblies,
    excludeAssemblyId
  );
  return Math.max(0, total - used);
};

const getSourceDisplay = (sourceType, sourceId) => {
  if (sourceType === "material") {
    const mat = materialById(sourceId);
    if (!mat) return null;
    return {
      name: mat.material,
      code: mat.materialCode,
      thickness: mat.thickness,
      size: mat.size,
      unit: mat.unit,
      dwg: mat.dwg,
    };
  }
  return {
    name: sourceId,
    code: "—",
    thickness: "—",
    size: "—",
    unit: "No.",
    dwg: null,
  };
};

// How much of a required quantity is on hand right now, and how much is
// still pending, expressed in plain business terms (no error codes).
const getInputStatus = (input, assemblies, excludeAssemblyId) => {
  const disp = getSourceDisplay(input.sourceType, input.sourceId);
  const available = getAvailableQty(
    input.sourceType,
    input.sourceId,
    assemblies,
    excludeAssemblyId
  );
  const required = Number(input.useQty) || 0;
  const pending = Math.max(0, required - available);
  const balance = Math.max(0, available - required);
  let status = "available";
  if (pending > 0) status = available > 0 ? "partial" : "pending";
  return { disp, available, required, pending, balance, status };
};

// Roll every input's status up into one simple picture for the assembly.
const getAssemblySummary = (assembly, assemblies, excludeAssemblyId) => {
  let totalRequired = 0;
  let totalCovered = 0;
  let anyPending = false;
  assembly.inputs.forEach((inp) => {
    const { required, available, pending } = getInputStatus(
      inp,
      assemblies,
      excludeAssemblyId
    );
    totalRequired += required;
    totalCovered += Math.min(required, available);
    if (pending > 0) anyPending = true;
  });
  return {
    totalRequired,
    totalCovered,
    ready: !anyPending && totalRequired > 0,
  };
};

// Which drawings does an assembly actually touch? Derived recursively so a
// finished-assembly input correctly reports the drawings of the materials
// buried inside it — this is what makes "cross-DWG assembly" visible.
const getAssemblyDwgs = (assembly, assemblies, seen = new Set()) => {
  if (!assembly || seen.has(assembly.assemblyId)) return [];
  seen.add(assembly.assemblyId);
  const dwgs = new Set();
  assembly.inputs.forEach((inp) => {
    if (inp.sourceType === "material") {
      const mat = materialById(inp.sourceId);
      if (mat) dwgs.add(mat.dwg);
    } else {
      const nested = assemblies.find((a) => a.assemblyId === inp.sourceId);
      if (nested) {
        getAssemblyDwgs(nested, assemblies, seen).forEach((d) => dwgs.add(d));
      }
    }
  });
  return [...dwgs];
};

// Is `candidateId` reachable (directly or transitively) from `assemblyId`'s
// inputs? Used to stop a user from selecting an assembly's own descendant
// (or itself) as one of its inputs, which would create a cycle.
const isDescendantOf = (assemblies, assemblyId, candidateId) => {
  const asm = assemblies.find((a) => a.assemblyId === assemblyId);
  if (!asm) return false;
  for (const inp of asm.inputs) {
    if (inp.sourceType !== "assembly") continue;
    if (inp.sourceId === candidateId) return true;
    if (isDescendantOf(assemblies, inp.sourceId, candidateId)) return true;
  }
  return false;
};

// Does anything else currently use this assembly as an input?
const findDependentAssembly = (assemblies, assemblyId) =>
  assemblies.find((a) =>
    a.inputs.some(
      (inp) => inp.sourceType === "assembly" && inp.sourceId === assemblyId
    )
  );

// A short, human sentence describing an assembly's produced-history — used
// on the History tab and the page-level History section.
const buildHistoryEvents = (assembly) => {
  const events = [{ label: `${assembly.assemblyId} created`, done: true }];
  assembly.inputs.forEach((inp) => {
    const disp = getSourceDisplay(inp.sourceType, inp.sourceId);
    const unitLabel = inp.sourceType === "assembly" ? "unit" : disp.unit;
    events.push({
      label: `${inp.useQty} ${unitLabel} of ${disp.name} allocated`,
      done: true,
    });
  });
  assembly.processes.forEach((p, idx) => {
    let label = `${p.name} planned`;
    let done = false;
    if (assembly.status === "Completed") {
      label = `${p.name} completed`;
      done = true;
    } else if (assembly.status === "In Progress") {
      if (idx === 0) {
        label = `${p.name} completed`;
        done = true;
      } else if (idx === 1) {
        label = `${p.name} in progress`;
        done = true;
      }
    }
    events.push({ label, done });
  });
  return events;
};

// -------------------------------------------------------------------------
// Filters
// -------------------------------------------------------------------------
const FILTER_FIELDS = [
  { key: "project", label: "Project", type: "select" },
  { key: "dwg", label: "DWG", type: "text" },
  { key: "assemblyId", label: "Assembly ID", type: "text" },
  { key: "material", label: "Material", type: "text" },
  { key: "materialCode", label: "Material Code", type: "text" },
  { key: "thickness", label: "Thickness", type: "select" },
  { key: "size", label: "Size", type: "select" },
  { key: "unit", label: "Unit", type: "select" },
  { key: "process", label: "Process", type: "text" },
  { key: "processId", label: "Process ID", type: "text" },
  { key: "status", label: "Status", type: "select" },
];

// Build a flattened, filter-friendly view of each assembly (its direct
// input materials + process names, joined) so the shared filter/search
// helpers can treat it like a normal row.
const buildFilterRow = (asm, assemblies) => {
  const materialInputs = asm.inputs
    .filter((i) => i.sourceType === "material")
    .map((i) => materialById(i.sourceId))
    .filter(Boolean);

  return {
    assemblyId: asm.assemblyId,
    project: asm.project,
    dwg: getAssemblyDwgs(asm, assemblies).join(" "),
    material: materialInputs.map((m) => m.material).join(" "),
    materialCode: materialInputs.map((m) => m.materialCode).join(" "),
    thickness: materialInputs.map((m) => m.thickness).join(" "),
    size: materialInputs.map((m) => m.size).join(" "),
    unit: materialInputs.map((m) => m.unit).join(" "),
    process: asm.processes.map((p) => p.name).join(" "),
    processId: asm.processes.map((p) => p.processId).join(" "),
    status: asm.status,
  };
};

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

const matchesSearch = (row, search) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  return [
    "assemblyId",
    "project",
    "dwg",
    "material",
    "materialCode",
    "process",
    "processId",
  ].some((k) =>
    String(row[k] ?? "")
      .toLowerCase()
      .includes(term)
  );
};

const emptyAssemblyForm = () => ({
  project: "",
  inputs: [newInputRow()],
  processes: [newProcessRow()],
});

// Step-by-step wizard used for both Create and Edit.
const WIZARD_STEPS = [
  { n: 1, label: "Project" },
  { n: 2, label: "Inputs" },
  { n: 3, label: "Availability" },
  { n: 4, label: "Process" },
  { n: 5, label: "Review" },
];

export default function ProductionAssemblyIntegration() {
  const navigate = useNavigate();

  const [assemblies, setAssemblies] = useState(initialAssemblies);

  // A short, purely-cosmetic loading state so the table never flashes
  // "no results" before the data is actually ready.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const [successMessage, setSuccessMessage] = useState("");
  const showSuccess = (msg) => setSuccessMessage(msg);
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 4500);
    return () => clearTimeout(t);
  }, [successMessage]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewAssemblyId, setViewAssemblyId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [formMode, setFormMode] = useState(null); // "create" | "edit" | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAssemblyForm());
  const [formError, setFormError] = useState("");
  const [wizardStep, setWizardStep] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProject, setHistoryProject] = useState("");

  // -----------------------------------------------------------------------
  // Derived: filtering
  // -----------------------------------------------------------------------
  const filterRows = useMemo(
    () =>
      assemblies.map((a) => ({
        ...buildFilterRow(a, assemblies),
        _assembly: a,
      })),
    [assemblies]
  );

  const filteredAssemblies = useMemo(
    () =>
      filterRows
        .filter((r) => matchesFilters(r, filters) && matchesSearch(r, search))
        .map((r) => r._assembly),
    [filterRows, filters, search]
  );

  const filterOptions = useMemo(
    () => buildOptionsMap(filterRows),
    [filterRows]
  );

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  // -----------------------------------------------------------------------
  // Eye view
  // -----------------------------------------------------------------------
  const viewAssembly = viewAssemblyId
    ? assemblies.find((a) => a.assemblyId === viewAssemblyId)
    : null;

  const openView = (assemblyId) => {
    setViewAssemblyId(assemblyId);
    setActiveTab("overview");
  };
  const closeView = () => setViewAssemblyId(null);

  // -----------------------------------------------------------------------
  // Create / Edit wizard
  // -----------------------------------------------------------------------
  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyAssemblyForm());
    setFormError("");
    setWizardStep(1);
  };

  const openEdit = (asm) => {
    if (asm.status !== "Planned") return; // locked once production has started
    setFormMode("edit");
    setEditingId(asm.assemblyId);
    setForm({
      project: asm.project,
      inputs: asm.inputs.map((i) => newInputRow({ ...i })),
      processes: asm.processes.map((p) => newProcessRow({ ...p })),
    });
    setFormError("");
    setWizardStep(1);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setForm(emptyAssemblyForm());
    setFormError("");
    setWizardStep(1);
  };

  const availableMaterialsForForm = useMemo(
    () => PRODUCTION_MATERIALS.filter((m) => m.project === form.project),
    [form.project]
  );

  const dwgsForForm = useMemo(
    () => [...new Set(availableMaterialsForForm.map((m) => m.dwg))],
    [availableMaterialsForForm]
  );

  // Other assemblies in the same project that can legally be selected as an
  // input: not itself, not one of its own descendants (no cycles).
  const availableAssembliesForForm = useMemo(
    () =>
      assemblies.filter((a) => {
        if (a.project !== form.project) return false;
        if (editingId && a.assemblyId === editingId) return false;
        if (editingId && isDescendantOf(assemblies, a.assemblyId, editingId)) {
          return false;
        }
        return true;
      }),
    [assemblies, form.project, editingId]
  );

  const setProject = (project) =>
    setForm((f) => ({ ...f, project, inputs: [newInputRow()] }));

  const updateInput = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      inputs: f.inputs.map((inp) =>
        inp.rowId === rowId
          ? {
              ...inp,
              [field]: value,
              ...(field === "sourceType" ? { sourceId: "", useQty: "" } : {}),
            }
          : inp
      ),
    }));

  const addInput = () =>
    setForm((f) => ({ ...f, inputs: [...f.inputs, newInputRow()] }));

  const removeInput = (rowId) =>
    setForm((f) => ({
      ...f,
      inputs:
        f.inputs.length > 1
          ? f.inputs.filter((i) => i.rowId !== rowId)
          : f.inputs,
    }));

  const updateProcess = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      processes: f.processes.map((p) =>
        p.rowId === rowId ? { ...p, [field]: value } : p
      ),
    }));

  // Switching Execution Type resets the fields that belong to the OTHER
  // type, so a process can never carry stale Unit + Vendor data at once.
  const setProcessExecutionType = (rowId, executionType) =>
    setForm((f) => ({
      ...f,
      processes: f.processes.map((p) =>
        p.rowId === rowId
          ? {
              ...p,
              executionType,
              executionUnit: executionType === "In-House" ? "Unit 1" : null,
              outsourcing:
                executionType === "Outsourcing" ? emptyOutsourcing() : null,
            }
          : p
      ),
    }));

  const updateProcessOutsourcing = (rowId, field, value) =>
    setForm((f) => ({
      ...f,
      processes: f.processes.map((p) =>
        p.rowId === rowId
          ? {
              ...p,
              outsourcing: { ...(p.outsourcing || emptyOutsourcing()), [field]: value },
            }
          : p
      ),
    }));

  const addProcess = () =>
    setForm((f) => ({ ...f, processes: [...f.processes, newProcessRow()] }));

  const removeProcess = (rowId) =>
    setForm((f) => ({
      ...f,
      processes:
        f.processes.length > 1
          ? f.processes.filter((p) => p.rowId !== rowId)
          : f.processes,
    }));

  const moveProcess = (rowId, direction) =>
    setForm((f) => {
      const idx = f.processes.findIndex((p) => p.rowId === rowId);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= f.processes.length) return f;
      const next = [...f.processes];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return { ...f, processes: next };
    });

  // Available qty for a given input row, accounting for the fact that the
  // assembly currently being edited should not count its OWN prior usage
  // against the balance (otherwise editing would always look over-budget).
  const rowStatus = (row) =>
    getInputStatus(
      {
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        useQty: row.useQty,
      },
      assemblies,
      editingId
    );

  // Step-by-step validity — used to enable/disable "Next".
  const stepValid = {
    1: !!form.project,
    2: form.inputs.some((r) => r.sourceId && Number(r.useQty) > 0),
    3: true,
    4: form.processes.some((p) => p.name.trim() && p.processId.trim()),
    5: true,
  };

  const goNext = () => setWizardStep((s) => Math.min(5, s + 1));
  const goBack = () => setWizardStep((s) => Math.max(1, s - 1));

  // Final check before creating/saving. Pending materials are NOT an error
  // — the user can still create the assembly and receive the material
  // later. Only genuinely missing or invalid data blocks submission.
  const validateForm = () => {
    if (!form.project) return "Please select a project first.";

    for (const row of form.inputs) {
      const hasSource = !!row.sourceId;
      const hasQty =
        row.useQty !== "" && row.useQty !== null && row.useQty !== undefined;
      if (hasSource !== hasQty) {
        return "Every input needs both a selection and a quantity.";
      }
      if (hasSource && !(Number(row.useQty) > 0)) {
        return "Quantity must be greater than 0 for every input.";
      }
    }

    const validInputs = form.inputs.filter(
      (r) => r.sourceId && Number(r.useQty) > 0
    );
    if (validInputs.length === 0) {
      return "Add at least one material or existing assembly to combine.";
    }

    for (const p of form.processes) {
      const hasName = p.name.trim();
      const hasId = p.processId.trim();
      if ((hasName || hasId) && !(hasName && hasId)) {
        return "Every production step needs both a name and a Process ID.";
      }
      if (hasName && hasId) {
        if (p.executionType === "Outsourcing") {
          if (!p.outsourcing || !p.outsourcing.vendor.trim()) {
            return `Select a vendor for "${p.name}" (Execution: Outsourcing).`;
          }
        } else if (!p.executionUnit) {
          return `Select an execution unit for "${p.name}" (Execution: In-House).`;
        }
      }
    }
    const validProcesses = form.processes.filter(
      (p) => p.name.trim() && p.processId.trim()
    );
    if (validProcesses.length === 0) {
      return "Add at least one production step with a name and Process ID.";
    }

    return "";
  };

  const handleSubmit = () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      setWizardStep((s) => (s < 5 ? 5 : s));
      return;
    }

    const cleanInputs = form.inputs
      .filter((r) => r.sourceId && r.useQty)
      .map((r) => ({
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        useQty: Number(r.useQty),
      }));

    const cleanProcesses = form.processes
      .filter((p) => p.name.trim() && p.processId.trim())
      .map((p) => ({
        name: p.name.trim(),
        processId: p.processId.trim(),
        qcRequired: !!p.qcRequired,
        executionType: p.executionType === "Outsourcing" ? "Outsourcing" : "In-House",
        executionUnit:
          p.executionType === "Outsourcing" ? null : p.executionUnit || "Unit 1",
        outsourcing:
          p.executionType === "Outsourcing"
            ? {
                vendor: (p.outsourcing?.vendor || "").trim(),
                vendorContact: (p.outsourcing?.vendorContact || "").trim(),
                vendorLocation: (p.outsourcing?.vendorLocation || "").trim(),
                expectedReturnDate: p.outsourcing?.expectedReturnDate || "",
                remarks: (p.outsourcing?.remarks || "").trim(),
              }
            : null,
      }));

    const hasPending = cleanInputs.some(
      (inp) =>
        getAvailableQty(inp.sourceType, inp.sourceId, assemblies, editingId) <
        inp.useQty
    );

    if (formMode === "create") {
      const newId = generateAssemblyId();
      const newAssembly = {
        assemblyId: newId,
        project: form.project,
        inputs: cleanInputs,
        processes: cleanProcesses,
        status: "Planned",
        createdDate: new Date().toISOString().slice(0, 10),
      };
      setAssemblies((prev) => [newAssembly, ...prev]);
      showSuccess(
        `${newId} created successfully.` +
          (hasPending
            ? " Some materials are still pending — you can allocate them once received."
            : "")
      );
    } else if (formMode === "edit" && editingId) {
      setAssemblies((prev) =>
        prev.map((a) =>
          a.assemblyId === editingId
            ? { ...a, inputs: cleanInputs, processes: cleanProcesses }
            : a
        )
      );
      showSuccess(`${editingId} updated successfully.`);
    }

    closeForm();
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------
  const requestDelete = (asm) => {
    setDeleteTarget(asm);
    if (asm.status !== "Planned") {
      setDeleteError(
        "This assembly can't be deleted because production has already started on it."
      );
      return;
    }
    const dependent = findDependentAssembly(assemblies, asm.assemblyId);
    if (dependent) {
      setDeleteError(
        `This assembly can't be deleted because ${dependent.assemblyId} is built using it.`
      );
      return;
    }
    setDeleteError("");
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = () => {
    if (!deleteTarget || deleteError) return;
    setAssemblies((prev) =>
      prev.filter((a) => a.assemblyId !== deleteTarget.assemblyId)
    );
    showSuccess(`${deleteTarget.assemblyId} was deleted.`);
    closeDelete();
  };

  // ---------------- Back Handler ----------------
  function handleBack() {
    navigate("/inventory/material");
  }

  // -----------------------------------------------------------------------
  // Page-level History section (all assemblies, optionally by project)
  // -----------------------------------------------------------------------
  const historyAssemblies = useMemo(
    () =>
      assemblies
        .filter((a) => !historyProject || a.project === historyProject)
        .slice()
        .sort((a, b) => a.createdDate.localeCompare(b.createdDate)),
    [assemblies, historyProject]
  );

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
                <h1 className="page-header-title">
                  Production Assembly Integration
                </h1>
                <p className="page-header-subtitle">
                  Combine materials — or assemblies you've already built — into
                  a new assembly, add the production steps it needs to go
                  through, and keep track of what's ready and what's still
                  pending.
                </p>
              </div>
            </div>

            <div className="page-header-actions">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="btn btn-secondary"
              >
                <Clock size={14} />
                {historyOpen ? "Hide History" : "History"}
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="btn btn-primary"
              >
                + Create Assembly
              </button>
            </div>
          </div>

          {/* ===================== SUCCESS BANNER ===================== */}
          {successMessage && (
            <div className="success-banner">
              <span>✓ {successMessage}</span>
              <button
                type="button"
                className="banner-close"
                onClick={() => setSuccessMessage("")}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* ===================== HISTORY SECTION ===================== */}
          {historyOpen && (
            <div className="panel history-card">
              <div className="history-header">
                <div>
                  <h3 className="modal-card-title">History</h3>
                  <p className="modal-card-hint">
                    A simple timeline of what happened to each assembly — no raw
                    database records, just the material journey in order.
                  </p>
                </div>
                <div className="form-field history-filter">
                  <label htmlFor="history-project">Project</label>
                  <select
                    id="history-project"
                    value={historyProject}
                    onChange={(e) => setHistoryProject(e.target.value)}
                  >
                    <option value="">All Projects</option>
                    {PROJECTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {historyAssemblies.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🕘</div>
                  <p className="empty-state-title">Nothing to show yet</p>
                  <p className="empty-state-desc">
                    No assemblies found for this project.
                  </p>
                </div>
              ) : (
                <div className="history-list">
                  {historyAssemblies.map((asm) => (
                    <div className="history-group" key={asm.assemblyId}>
                      <div className="history-group-head">
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {asm.assemblyId}
                        </span>
                        <span className="history-group-meta">
                          {asm.project} · Created {asm.createdDate}
                        </span>
                        <StatusBadge status={asm.status} />
                      </div>
                      <Timeline events={buildHistoryEvents(asm)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== ASSEMBLY LIST ===================== */}
          <div className="panel">
            <FilterPanel
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={(key, value) =>
                setFilters((f) => ({ ...f, [key]: value }))
              }
              options={filterOptions}
              onClear={clearFilters}
              open={filtersOpen}
              onToggleOpen={() => setFiltersOpen((o) => !o)}
              resultCount={filteredAssemblies.length}
            />

            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Assembly</th>
                    <th>Project</th>
                    <th>DWG(s)</th>
                    <th>Inputs</th>
                    <th>Availability</th>
                    <th>Status</th>
                    <th className="cell-action">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div className="loading-spinner" />
                          <p className="empty-state-desc">
                            Loading assemblies...
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && filteredAssemblies.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🧩</div>
                          <p className="empty-state-title">
                            No assemblies found
                          </p>
                          <p className="empty-state-desc">
                            Create your first assembly by selecting a project
                            and adding materials.
                          </p>
                          <button
                            type="button"
                            onClick={openCreate}
                            className="btn btn-primary empty-cta"
                          >
                            + Create Assembly
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredAssemblies.map((asm) => {
                      const inputLabel = asm.inputs
                        .map((i) =>
                          i.sourceType === "material"
                            ? getSourceDisplay(i.sourceType, i.sourceId).name
                            : `${i.sourceId} (Assembly)`
                        )
                        .join(" + ");
                      const dwgs = getAssemblyDwgs(asm, assemblies);
                      const summary = getAssemblySummary(asm, assemblies, null);
                      const editable = asm.status === "Planned";

                      return (
                        <tr key={asm.assemblyId}>
                          <td
                            data-label="Assembly"
                            className="mono"
                            style={{ fontWeight: 600, color: "var(--primary-dark)" }}
                          >
                            {asm.assemblyId}
                          </td>
                          <td data-label="Project">{asm.project}</td>
                          <td data-label="DWG(s)">
                            {dwgs.length > 0 ? dwgs.join(" + ") : "—"}
                          </td>
                          <td data-label="Inputs">{inputLabel}</td>
                          <td data-label="Availability">
                            <AvailabilityBadge ready={summary.ready} />
                            <span className="availability-fraction">
                              {summary.totalCovered}/{summary.totalRequired}
                            </span>
                          </td>
                          <td data-label="Status">
                            <StatusBadge status={asm.status} />
                          </td>
                          <td data-label="Actions">
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                justifyContent: "center",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => openView(asm.assemblyId)}
                                className="remove-btn"
                                title="View Details"
                                aria-label="View Details"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(asm)}
                                className="remove-btn"
                                title={
                                  editable
                                    ? "Edit"
                                    : "Locked — production already started"
                                }
                                aria-label="Edit"
                                disabled={!editable}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(asm)}
                                className="remove-btn"
                                title={
                                  editable
                                    ? "Delete"
                                    : "Locked — production already started"
                                }
                                aria-label="Delete"
                                disabled={!editable}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ===================== EYE VIEW MODAL ===================== */}
          {viewAssembly && (
            <div className="modal-overlay" onClick={closeView}>
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {viewAssembly.assemblyId}
                    </h2>
                    <p className="modal-subtitle">
                      {viewAssembly.project} ·{" "}
                      <StatusBadge status={viewAssembly.status} />
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

                <div className="tabs">
                  {[
                    ["overview", "Overview"],
                    ["materials", "Materials"],
                    ["integration", "Original Integration"],
                    ["process", "Process Route"],
                    ["history", "History"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`tab-btn ${
                        activeTab === key ? "tab-active" : ""
                      }`}
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="modal-body">
                  <AssemblyEyeView
                    assembly={viewAssembly}
                    assemblies={assemblies}
                    activeTab={activeTab}
                    onOpenNested={(id) => openView(id)}
                  />
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

          {/* ===================== CREATE / EDIT WIZARD MODAL ===================== */}
          {formMode && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {formMode === "create"
                        ? "Create Assembly"
                        : `Edit ${editingId}`}
                    </h2>
                    <p className="modal-subtitle">
                      {formMode === "create"
                        ? "Follow the steps below — the Assembly ID is generated automatically once you create it."
                        : "Inputs, quantities and the process route can still be changed — production has not started."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <WizardStepper current={wizardStep} />

                <div className="modal-body">
                  {/* ---------- STEP 1 — Select Project ---------- */}
                  {wizardStep === 1 && (
                    <div className="modal-card">
                      <h3 className="modal-card-title">Select Project</h3>
                      <p className="modal-card-hint">
                        Choose the project for this assembly. This decides which
                        materials and existing assemblies you can pick from
                        next.
                      </p>
                      <div
                        className="form-field"
                        style={{ maxWidth: 320 }}
                      >
                        <label htmlFor="project">Project</label>
                        <select
                          id="project"
                          value={form.project}
                          onChange={(e) => setProject(e.target.value)}
                          disabled={formMode === "edit"}
                        >
                          <option value="">Select Project</option>
                          {PROJECTS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>

                      {form.project && (
                        <div className="readonly-grid" style={{ marginTop: 16 }}>
                          <div className="readonly-field">
                            <span className="readonly-label">
                              Drawings in this project
                            </span>
                            <span className="readonly-value">
                              {(DWGS_BY_PROJECT[form.project] || []).join(", ")}
                            </span>
                          </div>
                          <div className="readonly-field">
                            <span className="readonly-label">
                              Materials ready to use
                            </span>
                            <span className="readonly-value">
                              {availableMaterialsForForm.length} items issued
                              to production
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------- STEP 2 — Add Assembly Inputs ---------- */}
                  {wizardStep === 2 && (
                    <div className="modal-card">
                      <div className="modal-card-header-row">
                        <h3 className="modal-card-title">
                          Add Assembly Inputs
                        </h3>
                      </div>
                      <p className="modal-card-hint">
                        Add the materials or existing assemblies that will be
                        combined into this assembly. You can add as many as you
                        need — nothing you've already entered will be lost.
                      </p>

                      <div className="input-list">
                        {form.inputs.map((row, idx) => {
                          const { available, status, pending, balance } =
                            rowStatus(row);
                          const disp = row.sourceId
                            ? getSourceDisplay(row.sourceType, row.sourceId)
                            : null;
                          const nestedAssembly =
                            row.sourceType === "assembly" && row.sourceId
                              ? assemblies.find(
                                  (a) => a.assemblyId === row.sourceId
                                )
                              : null;
                          const mat =
                            row.sourceType === "material" && row.sourceId
                              ? materialById(row.sourceId)
                              : null;

                          return (
                            <div className="input-card" key={row.rowId}>
                              <div className="input-card-top">
                                <span className="input-card-index">
                                  Input {idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeInput(row.rowId)}
                                  disabled={form.inputs.length === 1}
                                  className="remove-btn"
                                  title="Remove Input"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="toggle-group">
                                <button
                                  type="button"
                                  className={`toggle-btn ${
                                    row.sourceType === "material"
                                      ? "toggle-active"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    updateInput(
                                      row.rowId,
                                      "sourceType",
                                      "material"
                                    )
                                  }
                                >
                                  Material
                                </button>
                                <button
                                  type="button"
                                  className={`toggle-btn ${
                                    row.sourceType === "assembly"
                                      ? "toggle-active"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    updateInput(
                                      row.rowId,
                                      "sourceType",
                                      "assembly"
                                    )
                                  }
                                >
                                  Existing Assembly
                                </button>
                              </div>

                              {row.sourceType === "material" ? (
                                <div className="form-field">
                                  <label>Material</label>
                                  <select
                                    value={row.sourceId}
                                    onChange={(e) =>
                                      updateInput(
                                        row.rowId,
                                        "sourceId",
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="">Select material</option>
                                    {dwgsForForm.map((dwg) => (
                                      <optgroup label={dwg} key={dwg}>
                                        {availableMaterialsForForm
                                          .filter((m) => m.dwg === dwg)
                                          .map((m) => {
                                            const avail = getAvailableQty(
                                              "material",
                                              m.id,
                                              assemblies,
                                              editingId
                                            );
                                            return (
                                              <option key={m.id} value={m.id}>
                                                {m.material} ({m.materialCode})
                                                — {avail} {m.unit} available
                                              </option>
                                            );
                                          })}
                                      </optgroup>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className="form-field">
                                  <label>Existing Assembly</label>
                                  <select
                                    value={row.sourceId}
                                    onChange={(e) =>
                                      updateInput(
                                        row.rowId,
                                        "sourceId",
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="">Select assembly</option>
                                    {availableAssembliesForForm.map((a) => {
                                      const avail = getAvailableQty(
                                        "assembly",
                                        a.assemblyId,
                                        assemblies,
                                        editingId
                                      );
                                      return (
                                        <option
                                          key={a.assemblyId}
                                          value={a.assemblyId}
                                        >
                                          {a.assemblyId} — {avail} available
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}

                              {mat && (
                                <div className="auto-detail">
                                  <DetailChip label="DWG" value={mat.dwg} />
                                  <DetailChip
                                    label="Thickness"
                                    value={mat.thickness}
                                  />
                                  <DetailChip label="Size" value={mat.size} />
                                  <DetailChip label="Unit" value={mat.unit} />
                                  <DetailChip
                                    label="Available"
                                    value={`${available} ${mat.unit}`}
                                  />
                                  <DetailChip
                                    label="Integration"
                                    value="✓ Integrated"
                                    tooltip="This material has already been received and issued to production."
                                  />
                                </div>
                              )}

                              {nestedAssembly && (
                                <div className="auto-detail">
                                  <DetailChip
                                    label="Project"
                                    value={nestedAssembly.project}
                                  />
                                  <DetailChip
                                    label="Source Drawing(s)"
                                    value={
                                      getAssemblyDwgs(
                                        nestedAssembly,
                                        assemblies
                                      ).join(" + ") || "—"
                                    }
                                  />
                                  <DetailChip
                                    label="Available"
                                    value={`${available} unit(s)`}
                                  />
                                  <DetailChip
                                    label="Current Status"
                                    value={
                                      <StatusBadge
                                        status={nestedAssembly.status}
                                      />
                                    }
                                  />
                                </div>
                              )}

                              {row.sourceId && (
                                <div className="form-field qty-field">
                                  <label>Use for Assembly</label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="0"
                                    value={row.useQty}
                                    onChange={(e) =>
                                      updateInput(
                                        row.rowId,
                                        "useQty",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              )}

                              {row.sourceId && row.useQty !== "" && (
                                <p
                                  className={`remaining-note ${
                                    status !== "available"
                                      ? "remaining-warning"
                                      : ""
                                  }`}
                                >
                                  {status === "available" && (
                                    <>
                                      Remaining after this:{" "}
                                      <strong>{balance}</strong> {disp?.unit}
                                    </>
                                  )}
                                  {status !== "available" && (
                                    <>
                                      ⚠ {pending} {disp?.unit} still pending.
                                      You can still use this input — the rest
                                      can be allocated once it's available.
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={addInput}
                        className="btn-link add-input-btn"
                      >
                        + Add Material / Assembly
                      </button>
                    </div>
                  )}

                  {/* ---------- STEP 3 — Material Availability ---------- */}
                  {wizardStep === 3 && (
                    <div className="modal-card">
                      <h3 className="modal-card-title">
                        Material Availability
                      </h3>
                      <p className="modal-card-hint">
                        Here's what's on hand right now and what's still
                        pending. You don't need to calculate anything — it's
                        done for you.
                      </p>

                      <div className="availability-list">
                        {form.inputs
                          .filter((r) => r.sourceId && r.useQty !== "")
                          .map((row) => {
                            const {
                              disp,
                              available,
                              required,
                              pending,
                              status,
                            } = rowStatus(row);
                            return (
                              <div
                                className="availability-row"
                                key={row.rowId}
                              >
                                <div className="availability-row-head">
                                  <span className="availability-name">
                                    {disp.name}
                                  </span>
                                  <AvailabilityStatusBadge status={status} />
                                </div>
                                <div className="availability-numbers">
                                  <span>
                                    Required <strong>{required}</strong>
                                  </span>
                                  <span>
                                    Available <strong>{available}</strong>
                                  </span>
                                  <span>
                                    Pending <strong>{pending}</strong>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {form.inputs.some(
                        (r) => rowStatus(r).status !== "available" && r.sourceId
                      ) ? (
                        <div className="info-note info-note-warning">
                          Some materials are currently pending. You can still
                          create this assembly — the pending quantity can be
                          added once the material becomes available.
                        </div>
                      ) : (
                        <div className="info-note info-note-success">
                          Everything you've added is fully available right now.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------- STEP 4 — Production Process ---------- */}
                  {wizardStep === 4 && (
                    <div className="modal-card">
                      <div className="modal-card-header-row">
                        <h3 className="modal-card-title">
                          Production Process
                        </h3>
                      </div>
                      <p className="modal-card-hint">
                        Add the production steps in the order they should be
                        completed, and mark which ones need QC.
                      </p>

                      <div className="process-list">
                        {form.processes.map((process, idx) => (
                          <div className="process-row" key={process.rowId}>
                            <span className="process-seq">{idx + 1}</span>
                            <div className="process-fields">
                              <div className="form-field">
                                <label>Process Name</label>
                                <input
                                  placeholder="e.g. Fit-up"
                                  value={process.name}
                                  onChange={(e) =>
                                    updateProcess(
                                      process.rowId,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="form-field">
                                <label>Process ID</label>
                                <input
                                  placeholder="e.g. FIT01"
                                  value={process.processId}
                                  onChange={(e) =>
                                    updateProcess(
                                      process.rowId,
                                      "processId",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="form-field">
                                <label title="QC Required means this step must be inspected and signed off before moving to the next step.">
                                  QC Required
                                </label>
                                <select
                                  value={process.qcRequired ? "yes" : "no"}
                                  onChange={(e) =>
                                    updateProcess(
                                      process.rowId,
                                      "qcRequired",
                                      e.target.value === "yes"
                                    )
                                  }
                                >
                                  <option value="no">No</option>
                                  <option value="yes">Yes</option>
                                </select>
                              </div>
                            </div>

                            {/* ---- Execution: In-House vs Outsourcing ---- */}
                            <div className="process-execution">
                              <div className="form-field">
                                <label
                                  title="How this process is carried out. Production Operation reads this and never asks again."
                                >
                                  Execution Type
                                </label>
                                <div
                                  className="segment-toggle"
                                  role="group"
                                  aria-label="Execution Type"
                                >
                                  <button
                                    type="button"
                                    className={`segment-btn ${
                                      process.executionType === "In-House"
                                        ? "segment-btn-active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setProcessExecutionType(
                                        process.rowId,
                                        "In-House"
                                      )
                                    }
                                  >
                                    <Building2 size={14} /> In-House
                                  </button>
                                  <button
                                    type="button"
                                    className={`segment-btn ${
                                      process.executionType === "Outsourcing"
                                        ? "segment-btn-active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setProcessExecutionType(
                                        process.rowId,
                                        "Outsourcing"
                                      )
                                    }
                                  >
                                    <Truck size={14} /> Outsourcing
                                  </button>
                                </div>
                              </div>

                              {process.executionType === "In-House" ? (
                                <div className="form-field">
                                  <label>Execution Unit</label>
                                  <div
                                    className="segment-toggle"
                                    role="group"
                                    aria-label="Execution Unit"
                                  >
                                    <button
                                      type="button"
                                      className={`segment-btn ${
                                        process.executionUnit === "Unit 1"
                                          ? "segment-btn-active"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        updateProcess(
                                          process.rowId,
                                          "executionUnit",
                                          "Unit 1"
                                        )
                                      }
                                    >
                                      Unit 1
                                    </button>
                                    <button
                                      type="button"
                                      className={`segment-btn ${
                                        process.executionUnit === "Unit 2"
                                          ? "segment-btn-active"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        updateProcess(
                                          process.rowId,
                                          "executionUnit",
                                          "Unit 2"
                                        )
                                      }
                                    >
                                      Unit 2
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="outsourcing-block">
                                  <div className="outsourcing-block-title">
                                    Outsourcing Details
                                  </div>
                                  <div className="form-field">
                                    <label>Vendor</label>
                                    <select
                                      value={process.outsourcing?.vendor || ""}
                                      onChange={(e) =>
                                        updateProcessOutsourcing(
                                          process.rowId,
                                          "vendor",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">Select vendor</option>
                                      {VENDORS.map((v) => (
                                        <option key={v}>{v}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="form-row-2">
                                    <div className="form-field">
                                      <label>Vendor Contact</label>
                                      <input
                                        placeholder="Phone / email"
                                        value={
                                          process.outsourcing?.vendorContact ||
                                          ""
                                        }
                                        onChange={(e) =>
                                          updateProcessOutsourcing(
                                            process.rowId,
                                            "vendorContact",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="form-field">
                                      <label>Vendor Location</label>
                                      <input
                                        placeholder="Vendor works address / city"
                                        value={
                                          process.outsourcing
                                            ?.vendorLocation || ""
                                        }
                                        onChange={(e) =>
                                          updateProcessOutsourcing(
                                            process.rowId,
                                            "vendorLocation",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="form-row-2">
                                    <div className="form-field">
                                      <label>Expected Return Date</label>
                                      <input
                                        type="date"
                                        value={
                                          process.outsourcing
                                            ?.expectedReturnDate || ""
                                        }
                                        onChange={(e) =>
                                          updateProcessOutsourcing(
                                            process.rowId,
                                            "expectedReturnDate",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="form-field">
                                      <label>Remarks (optional)</label>
                                      <input
                                        placeholder="Optional notes"
                                        value={
                                          process.outsourcing?.remarks || ""
                                        }
                                        onChange={(e) =>
                                          updateProcessOutsourcing(
                                            process.rowId,
                                            "remarks",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="process-order-btns">
                              <button
                                type="button"
                                onClick={() =>
                                  moveProcess(process.rowId, "up")
                                }
                                disabled={idx === 0}
                                className="order-btn"
                                title="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  moveProcess(process.rowId, "down")
                                }
                                disabled={idx === form.processes.length - 1}
                                className="order-btn"
                                title="Move Down"
                              >
                                ▼
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProcess(process.rowId)}
                              disabled={form.processes.length === 1}
                              className="remove-btn"
                              title="Remove Process"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addProcess}
                        className="btn-link add-input-btn"
                      >
                        + Add Another Process
                      </button>
                    </div>
                  )}

                  {/* ---------- STEP 5 — Review & Create ---------- */}
                  {wizardStep === 5 && (
                    <>
                      <div className="modal-card">
                        <h3 className="modal-card-title">Assembly Review</h3>
                        <p className="modal-card-hint">
                          Take a moment to check everything below before
                          creating the assembly.
                        </p>

                        <div className="readonly-grid">
                          <ReadonlyField
                            label="Project"
                            value={form.project || "—"}
                          />
                          <ReadonlyField
                            label="Drawings Used"
                            value={
                              [
                                ...new Set(
                                  form.inputs
                                    .filter(
                                      (r) =>
                                        r.sourceType === "material" &&
                                        r.sourceId
                                    )
                                    .map((r) => materialById(r.sourceId)?.dwg)
                                    .filter(Boolean)
                                ),
                              ].join(", ") || "—"
                            }
                          />
                        </div>

                        {(() => {
                          const dwgCount = new Set(
                            form.inputs
                              .filter(
                                (r) =>
                                  r.sourceType === "material" && r.sourceId
                              )
                              .map((r) => materialById(r.sourceId)?.dwg)
                              .filter(Boolean)
                          ).size;
                          return dwgCount > 1 ? (
                            <div className="info-note">
                              This assembly uses materials from {dwgCount}{" "}
                              drawings.
                            </div>
                          ) : null;
                        })()}

                        <h4 className="review-subhead">Inputs</h4>
                        <ul className="review-list">
                          {form.inputs
                            .filter((r) => r.sourceId && r.useQty !== "")
                            .map((row) => {
                              const {
                                disp,
                                status,
                                pending,
                                required,
                              } = rowStatus(row);
                              return (
                                <li key={row.rowId}>
                                  {status === "available" ? "✓" : "⚠"}{" "}
                                  {disp.name} — {required} {disp.unit}
                                  {status !== "available" && (
                                    <span className="review-pending">
                                      {" "}
                                      ({pending} pending)
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                        </ul>

                        <h4 className="review-subhead">Process Route</h4>
                        <ol className="review-process-list">
                          {form.processes
                            .filter(
                              (p) => p.name.trim() && p.processId.trim()
                            )
                            .map((p) => (
                              <li key={p.rowId}>
                                {p.name}
                                {p.qcRequired && (
                                  <span
                                    className="qc-badge qc-yes"
                                    style={{ marginLeft: 8 }}
                                  >
                                    QC
                                  </span>
                                )}
                                <span
                                  className="exec-badge"
                                  style={{ marginLeft: 8 }}
                                >
                                  {p.executionType === "Outsourcing"
                                    ? `Outsourcing — ${
                                        p.outsourcing?.vendor || "No vendor selected"
                                      }`
                                    : `In-House — ${p.executionUnit || "Unit 1"}`}
                                </span>
                              </li>
                            ))}
                        </ol>
                      </div>

                      {formError && (
                        <div className="error-box">{formError}</div>
                      )}
                    </>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="btn btn-secondary"
                    >
                      Back
                    </button>
                  )}
                  {wizardStep < 5 && (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!stepValid[wizardStep]}
                      className="btn btn-primary"
                    >
                      Next
                    </button>
                  )}
                  {wizardStep === 5 && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="btn btn-primary"
                    >
                      {formMode === "create"
                        ? "Create Assembly"
                        : "Save Changes"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== DELETE CONFIRMATION ===================== */}
          {deleteTarget && (
            <div className="modal-overlay" onClick={closeDelete}>
              <div
                className="modal-box modal-box-narrow"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <h2 className="modal-title">
                    {deleteError
                      ? "Can't Delete"
                      : `Delete ${deleteTarget.assemblyId}?`}
                  </h2>
                  <button
                    type="button"
                    onClick={closeDelete}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  {deleteError ? (
                    <div className="error-box">{deleteError}</div>
                  ) : (
                    <p className="confirm-text">
                      This assembly has not started production. It can be safely
                      deleted, and its materials will go back to being
                      available. This can't be undone.
                    </p>
                  )}
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeDelete}
                    className="btn btn-secondary"
                  >
                    {deleteError ? "Close" : "Cancel"}
                  </button>
                  {!deleteError && (
                    <button
                      type="button"
                      onClick={confirmDelete}
                      className="btn btn-danger"
                    >
                      Delete Assembly
                    </button>
                  )}
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
// Wizard Stepper
// =========================================================================
function WizardStepper({ current }) {
  return (
    <div className="stepper">
      {WIZARD_STEPS.map((s, idx) => (
        <div className="stepper-item" key={s.n}>
          <div className="stepper-item-inner">
            <div
              className={`stepper-circle ${
                current === s.n
                  ? "step-current"
                  : current > s.n
                  ? "step-done"
                  : ""
              }`}
            >
              {current > s.n ? "✓" : s.n}
            </div>
            <span
              className={`stepper-label ${
                current === s.n ? "step-label-current" : ""
              }`}
            >
              {s.label}
            </span>
          </div>
          {idx < WIZARD_STEPS.length - 1 && (
            <div
              className={`stepper-line ${
                current > s.n ? "step-line-done" : ""
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// =========================================================================
// Filter Panel
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
}) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder="Search assembly, material, DWG..."
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
        </div>
      )}

      <p className="result-count">
        {resultCount} assembl{resultCount !== 1 ? "ies" : "y"} found
      </p>
    </div>
  );
}

// =========================================================================
// Eye View — tabbed Assembly detail
// =========================================================================
function AssemblyEyeView({ assembly, assemblies, activeTab, onOpenNested }) {
  const dwgs = getAssemblyDwgs(assembly, assemblies);
  const summary = getAssemblySummary(assembly, assemblies, null);

  if (activeTab === "overview") {
    return (
      <div className="modal-card">
        <h3 className="modal-card-title">Overview</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Assembly ID" value={assembly.assemblyId} />
          <ReadonlyField label="Project" value={assembly.project} />
          <ReadonlyField label="Drawing(s)" value={dwgs.join(" + ") || "—"} />
          <ReadonlyField label="Created" value={assembly.createdDate} />
          <ReadonlyField
            label="Status"
            value={<StatusBadge status={assembly.status} />}
          />
          <ReadonlyField
            label="Material Availability"
            value={
              <>
                <AvailabilityBadge ready={summary.ready} />{" "}
                <span className="availability-fraction">
                  {summary.totalCovered}/{summary.totalRequired}
                </span>
              </>
            }
          />
        </div>
        {dwgs.length > 1 && (
          <div className="info-note">
            This assembly uses materials from {dwgs.length} drawings.
          </div>
        )}
        {!summary.ready && (
          <div className="info-note info-note-warning">
            Some materials are still pending. You can still work with this
            assembly — the pending quantity will be added once available.
          </div>
        )}
      </div>
    );
  }

  if (activeTab === "materials") {
    const byDwg = {};
    assembly.inputs.forEach((inp) => {
      if (inp.sourceType !== "material") return;
      const mat = materialById(inp.sourceId);
      if (!mat) return;
      byDwg[mat.dwg] = byDwg[mat.dwg] || [];
      byDwg[mat.dwg].push(inp);
    });

    return (
      <>
        <div className="modal-card">
          <h3 className="modal-card-title">Materials</h3>
          <div className="pieces-table-wrap">
            <table className="pieces-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Material / Assembly</th>
                  <th>Required</th>
                  <th>Available</th>
                  <th>Pending</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assembly.inputs.map((inp, idx) => {
                  const { disp, available, required, pending, status } =
                    getInputStatus(inp, assemblies, null);
                  return (
                    <tr key={idx}>
                      <td>
                        {inp.sourceType === "assembly" ? (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => onOpenNested(inp.sourceId)}
                          >
                            {inp.sourceId} (Assembly)
                          </button>
                        ) : (
                          "Production Material"
                        )}
                      </td>
                      <td>{disp.name}</td>
                      <td>
                        {required} {disp.unit}
                      </td>
                      <td>
                        {available} {disp.unit}
                      </td>
                      <td>
                        {pending} {disp.unit}
                      </td>
                      <td>
                        <AvailabilityStatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {Object.keys(byDwg).length > 0 && (
          <div className="modal-card">
            <h3 className="modal-card-title">By Drawing</h3>
            <p className="modal-card-hint">
              {Object.keys(byDwg).length > 1
                ? `This assembly uses materials from ${
                    Object.keys(byDwg).length
                  } drawings — here's where each one came from.`
                : "All the materials in this assembly come from one drawing."}
            </p>
            <div className="dwg-groups">
              {Object.entries(byDwg).map(([dwg, inputs]) => (
                <div className="dwg-group" key={dwg}>
                  <span className="dwg-group-title">{dwg}</span>
                  <ul>
                    {inputs.map((inp, idx) => {
                      const { disp, required, status } = getInputStatus(
                        inp,
                        assemblies,
                        null
                      );
                      return (
                        <li key={idx}>
                          {status === "available" ? "✓" : "⚠"} {disp.name} —{" "}
                          {required} {disp.unit}
                          {status !== "available" && " pending"}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  if (activeTab === "integration") {
    return (
      <div className="modal-card">
        <h3 className="modal-card-title">Original PO / BOM Information</h3>
        <p className="modal-card-hint">
          The material journey behind each input — from the project down to how
          much of it this assembly used.
        </p>
        <div className="journey-list">
          {assembly.inputs.map((inp, idx) => {
            if (inp.sourceType === "assembly") {
              return (
                <div className="journey-block" key={idx}>
                  <p className="modal-card-hint">
                    {inp.sourceId} is itself an assembly.{" "}
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => onOpenNested(inp.sourceId)}
                    >
                      View its Original Integration
                    </button>
                  </p>
                </div>
              );
            }
            const mat = materialById(inp.sourceId);
            if (!mat) return null;
            return (
              <div className="journey-block" key={idx}>
                <MaterialJourney
                  material={mat}
                  usedQty={inp.useQty}
                  project={assembly.project}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeTab === "process") {
    return (
      <div className="modal-card">
        <h3 className="modal-card-title">Process Route</h3>
        <ol className="process-chain">
          {assembly.processes.map((p, idx) => (
            <li key={idx}>
              <span className="process-chain-seq">{idx + 1}</span>
              <span className="process-chain-name">{p.name}</span>
              <span className="process-chain-id">{p.processId}</span>
              <span
                className={`qc-badge ${
                  p.qcRequired ? "qc-yes" : "qc-no"
                }`}
              >
                {p.qcRequired ? "QC Required" : "No QC"}
              </span>
              <span className="exec-badge">
                {p.executionType === "Outsourcing"
                  ? `Outsourcing — ${p.outsourcing?.vendor || "—"}`
                  : `In-House — ${p.executionUnit || "Unit 1"}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // activeTab === "history"
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Material Journey</h3>
        <p className="modal-card-hint">
          What happened to this assembly, in the order it happened.
        </p>
        <Timeline events={buildHistoryEvents(assembly)} />
      </div>
      <div className="modal-card">
        <h3 className="modal-card-title">Full Traceability</h3>
        <p className="modal-card-hint">
          Complete lineage of this assembly back to its original production
          materials.
        </p>
        <TraceTree assembly={assembly} assemblies={assemblies} depth={0} />
      </div>
    </>
  );
}

function MaterialJourney({ material, usedQty, project }) {
  const steps = [
    { label: "PROJECT", value: project },
    { label: "DWG", value: material.dwg },
    { label: "BOM", value: material.bomDescription },
    { label: "PO", value: material.poNumber },
    { label: "GRN", value: `Received: ${material.grnQty}` },
    { label: "MATERIAL STOCK", value: `Available: ${material.totalQty}` },
    { label: "ASSEMBLY", value: `Used: ${usedQty}` },
  ];
  return (
    <div className="journey">
      <div className="journey-title">
        {material.material} ({material.materialCode})
      </div>
      <div className="journey-chain">
        {steps.map((s, idx) => (
          <div className="journey-step" key={idx}>
            <div className="journey-step-box">
              <span className="journey-step-label">{s.label}</span>
              <span className="journey-step-value">{s.value}</span>
            </div>
            {idx < steps.length - 1 && (
              <span className="journey-arrow">↓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ events }) {
  return (
    <ol className="timeline">
      {events.map((ev, idx) => (
        <li
          key={idx}
          className={`timeline-item ${ev.done ? "timeline-done" : ""}`}
        >
          <span className="timeline-dot" />
          <span className="timeline-label">{ev.label}</span>
        </li>
      ))}
    </ol>
  );
}

function TraceTree({ assembly, assemblies, depth }) {
  return (
    <div className="trace-node" style={{ marginLeft: depth * 18 }}>
      <div className="trace-label">
        <span className="trace-id">{assembly.assemblyId}</span>
        <span className="trace-project">{assembly.project}</span>
      </div>
      <ul className="trace-children">
        {assembly.inputs.map((inp, idx) => {
          if (inp.sourceType === "assembly") {
            const nested = assemblies.find(
              (a) => a.assemblyId === inp.sourceId
            );
            if (!nested) return null;
            return (
              <li key={idx}>
                <TraceTree
                  assembly={nested}
                  assemblies={assemblies}
                  depth={depth + 1}
                />
              </li>
            );
          }
          const disp = getSourceDisplay(inp.sourceType, inp.sourceId);
          return (
            <li key={idx} className="trace-leaf">
              {disp.name} ({disp.code}) — Used {inp.useQty} {disp.unit} — Issue
              To Production → PO / GRN → DWG/BOM → {assembly.project}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =========================================================================
// Small shared bits
// =========================================================================
function ReadonlyField({ label, value }) {
  return (
    <div className="readonly-field">
      <label className="readonly-label">{label}</label>
      <div className="readonly-value">{value}</div>
    </div>
  );
}

function DetailChip({ label, value, tooltip }) {
  return (
    <div className="detail-chip" title={tooltip || undefined}>
      <span className="detail-chip-label">{label}</span>
      <span className="detail-chip-value">{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Planned: "status-badge-info",
    "In Progress": "status-badge-warning",
    Completed: "status-badge-success",
  };
  return (
    <span className={`status-badge ${map[status] || ""}`}>{status}</span>
  );
}

function AvailabilityBadge({ ready }) {
  return (
    <span
      className={`avail-badge ${ready ? "avail-ok" : "avail-pending"}`}
    >
      {ready ? "✓ Ready" : "⚠ Pending"}
    </span>
  );
}

function AvailabilityStatusBadge({ status }) {
  const map = {
    available: { text: "✓ Available", cls: "avail-ok" },
    partial: { text: "⚠ Partially Available", cls: "avail-partial" },
    pending: { text: "⚠ Pending", cls: "avail-pending" },
  };
  const m = map[status] || map.available;
  return <span className={`avail-badge ${m.cls}`}>{m.text}</span>;
}