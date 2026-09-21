import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Eye, History } from "lucide-react";
import Header from "../../components/Header";
import "./Rework.css";

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const hist = (date, time, event) => ({ date, time, event });

const employees = [
  "R. Kumar",
  "S. Elango",
  "Manoj Prabhu",
  "Arun Kumar",
  "Ravi Shankar",
  "Suresh",
  "Kumar",
];

const STATUS = {
  REQUIRED: "Rework Required",
  IN_PROGRESS: "Rework In Progress",
  PARTIAL: "Partially Completed",
  QC_PENDING: "QC Pending",
  READY_NEXT: "Ready for Next Process",
  AVAILABLE_STOCK: "Available in Material Stock",
};

const ACTIVE_STATUSES = [
  STATUS.REQUIRED,
  STATUS.IN_PROGRESS,
  STATUS.PARTIAL,
  STATUS.QC_PENDING,
];

const TERMINAL_STATUSES = [STATUS.READY_NEXT, STATUS.AVAILABLE_STOCK];

const initialReworkJobWork = [
  {
    reworkId: "RW-RJ-001",
    sourceType: "RECEIVE_FROM_JOBWORK",
    sourceId: "JW-1001",
    poId: "PO-001",
    poNumber: "PO-001",
    poDescription: "Description-1",
    supplier: "—",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "DWG-001 / Description-1",
    revision: "REV-01",
    material: "Plate",
    materialCode: "15110292000",
    materialSpec: "IS2062 E250A",
    thickness: "8 mm",
    pieceNo: "PL-026",
    length: "500",
    width: "400",
    size: "500 × 400",
    unit: "Nos",
    requiredQty: 1,
    completedQty: 0,
    status: STATUS.REQUIRED,
    createdDate: "2026-09-05",
    createdTime: "10:00",
    start: null,
    completions: [],
    history: [
      hist(
        "2026-09-05",
        "10:00",
        "Remaining piece PL-026 flagged for rework during Receive From Job Work (1 of 26 not usable as-is)."
      ),
    ],
  },
  {
    reworkId: "RW-RJ-002",
    sourceType: "RECEIVE_FROM_JOBWORK",
    sourceId: "JW-1002",
    poId: "PO-002",
    poNumber: "PO-002",
    poDescription: "Description-2",
    supplier: "Shree Fabricators",
    project: "NTPC Structural Project",
    dwg: "DWG-101",
    dwgDescription: "DWG-101 / Description-2",
    revision: "REV-01",
    material: "Pipe",
    materialCode: "15038626610",
    materialSpec: "IS1161 YST240",
    thickness: "4 mm",
    pieceNo: "PI-045",
    length: "1200",
    width: "—",
    size: "100 NB",
    unit: "Mtr",
    requiredQty: 1,
    completedQty: 0,
    status: STATUS.IN_PROGRESS,
    createdDate: "2026-09-02",
    createdTime: "15:20",
    start: {
      by: "Arun",
      supervisor: "Ravi",
      date: "2026-09-03",
      time: "09:15",
      remarks:
        "Weld seam misalignment on outer joint — realign and reweld before re-offering to QC.",
    },
    completions: [],
    history: [
      hist(
        "2026-09-02",
        "15:20",
        "Remaining piece PI-045 flagged for rework during Receive From Job Work."
      ),
      hist(
        "2026-09-03",
        "09:15",
        "Rework started by Arun (Supervisor: Ravi)."
      ),
    ],
  },
  {
    reworkId: "RW-RJ-003",
    sourceType: "RECEIVE_FROM_JOBWORK",
    sourceId: "JW-1004",
    poId: "PO-004",
    poNumber: "PO-004",
    poDescription: "Description-4",
    supplier: "—",
    project: "BHEL Project",
    dwg: "DWG-004",
    dwgDescription: "DWG-004 / Description-4",
    revision: "REV-02",
    material: "Plate",
    materialCode: "15110294000",
    materialSpec: "IS2062 E250A",
    thickness: "10 mm",
    pieceNo: "PL-118 to PL-120",
    length: "600",
    width: "600",
    size: "600 × 600",
    unit: "Nos",
    requiredQty: 3,
    completedQty: 2,
    status: STATUS.PARTIAL,
    createdDate: "2026-08-28",
    createdTime: "11:40",
    start: {
      by: "Suresh",
      supervisor: "Ravi",
      date: "2026-08-29",
      time: "09:00",
      remarks:
        "3 plates undersized after cutting — trim and re-check dimensions.",
    },
    completions: [
      {
        by: "Suresh",
        date: "2026-08-30",
        time: "16:10",
        qty: 2,
        remarks: "PL-118 and PL-119 corrected and verified against drawing.",
      },
    ],
    history: [
      hist(
        "2026-08-28",
        "11:40",
        "3 remaining pieces flagged for rework during Receive From Job Work."
      ),
      hist(
        "2026-08-29",
        "09:00",
        "Rework started by Suresh (Supervisor: Ravi)."
      ),
      hist(
        "2026-08-30",
        "16:10",
        "2 of 3 pieces completed by Suresh — 1 remaining."
      ),
    ],
  },
  {
    reworkId: "RW-RJ-004",
    sourceType: "RECEIVE_FROM_JOBWORK",
    sourceId: "JW-1003",
    poId: "DPO-001",
    poNumber: "DPO-001",
    poDescription: "Description-1",
    supplier: "—",
    project: "BHEL Project",
    dwg: "DWG-001",
    dwgDescription: "DWG-001 / Description-1",
    revision: "REV-01",
    material: "Plate",
    materialCode: "15110293000",
    materialSpec: "IS2062 E250A",
    thickness: "10 mm",
    pieceNo: "PL-060",
    length: "500",
    width: "600",
    size: "500 × 600",
    unit: "Nos",
    requiredQty: 1,
    completedQty: 1,
    status: STATUS.AVAILABLE_STOCK,
    createdDate: "2026-08-20",
    createdTime: "09:30",
    start: {
      by: "Manoj Prabhu",
      supervisor: "Ravi",
      date: "2026-08-20",
      time: "13:00",
      remarks:
        "Edge chipped during bending — grind and re-check squareness.",
    },
    completions: [
      {
        by: "Manoj Prabhu",
        date: "2026-08-21",
        time: "10:45",
        qty: 1,
        remarks: "Edge reworked and verified — dimension within tolerance.",
      },
    ],
    history: [
      hist(
        "2026-08-20",
        "09:30",
        "Remaining piece PL-060 flagged for rework during Receive From Job Work."
      ),
      hist(
        "2026-08-20",
        "13:00",
        "Rework started by Manoj Prabhu (Supervisor: Ravi)."
      ),
      hist(
        "2026-08-21",
        "10:45",
        "1 of 1 pieces completed by Manoj Prabhu — Rework Completed."
      ),
      hist(
        "2026-08-21",
        "10:45",
        "Material PL-060 made Available in Material Stock (Rework ID RW-RJ-004)."
      ),
    ],
  },
];

// =========================================================================
// Seed data — Rework items sourced from Production Operation
// =========================================================================
const initialReworkProduction = [
  {
    reworkId: "RW-PO-001",
    sourceType: "PRODUCTION_OPERATION",
    sourceId: "ASM-001/WEL01",
    project: "BHEL-001",
    dwg: "DWG-01 + DWG-02",
    assemblyId: "ASM-001",
    material: "Plate + Pipe",
    description: "Base Plate — Description-1",
    process: "Welding",
    processId: "WEL01",
    unit: "Nos",
    totalQty: 5,
    qcAcceptedQty: 4,
    rejectedQty: 1,
    completedQty: 0,
    qcRequired: true,
    status: STATUS.REQUIRED,
    createdDate: "2026-08-24",
    createdTime: "11:15",
    start: null,
    completions: [],
    qc: null,
    history: [
      hist(
        "2026-08-24",
        "11:15",
        "Welding QC: 4 Accepted, 1 Rejected by Ravi Shankar — porosity near joint 3."
      ),
      hist(
        "2026-08-24",
        "11:15",
        "1 Nos sent to Rework (Welding) — Rework ID RW-PO-001 created."
      ),
    ],
  },
  {
    reworkId: "RW-PO-002",
    sourceType: "PRODUCTION_OPERATION",
    sourceId: "ASM-004/GRD01",
    project: "BHEL-002",
    dwg: "DWG-101",
    assemblyId: "ASM-004",
    material: "Angle",
    description: "Support Angle — Description-5",
    process: "Grinding",
    processId: "GRD01",
    unit: "Nos",
    totalQty: 8,
    qcAcceptedQty: 6,
    rejectedQty: 2,
    completedQty: 0,
    qcRequired: false,
    status: STATUS.IN_PROGRESS,
    createdDate: "2026-08-21",
    createdTime: "14:00",
    start: {
      by: "S. Elango",
      supervisor: "Manoj Prabhu",
      date: "2026-08-22",
      time: "09:30",
      remarks:
        "2 pieces over-ground below tolerance — build up and re-finish.",
    },
    completions: [],
    qc: null,
    history: [
      hist(
        "2026-08-21",
        "14:00",
        "Grinding: 2 of 8 pieces over-ground — sent to Rework."
      ),
      hist(
        "2026-08-22",
        "09:30",
        "Rework started by S. Elango (Supervisor: Manoj Prabhu)."
      ),
    ],
  },
  {
    reworkId: "RW-PO-003",
    sourceType: "PRODUCTION_OPERATION",
    sourceId: "ASM-005/NDT01",
    project: "BHEL-002",
    dwg: "DWG-102",
    assemblyId: "ASM-005",
    material: "Channel",
    description: "Cross Brace — Description-6",
    process: "NDT",
    processId: "NDT01",
    unit: "Nos",
    totalQty: 3,
    qcAcceptedQty: 0,
    rejectedQty: 3,
    completedQty: 2,
    qcRequired: true,
    status: STATUS.PARTIAL,
    createdDate: "2026-08-18",
    createdTime: "10:05",
    start: {
      by: "R. Kumar",
      supervisor: "Arun Kumar",
      date: "2026-08-19",
      time: "08:45",
      remarks:
        "3 welds failed NDT — reweld and re-offer for inspection.",
    },
    completions: [
      {
        by: "R. Kumar",
        date: "2026-08-20",
        time: "17:00",
        qty: 2,
        remarks:
          "2 welds re-done and visually verified — ready for re-inspection.",
      },
    ],
    qc: null,
    history: [
      hist(
        "2026-08-18",
        "10:05",
        "NDT: 3 of 3 pieces failed inspection — sent to Rework."
      ),
      hist(
        "2026-08-19",
        "08:45",
        "Rework started by R. Kumar (Supervisor: Arun Kumar)."
      ),
      hist(
        "2026-08-20",
        "17:00",
        "2 of 3 pieces completed by R. Kumar — 1 remaining."
      ),
    ],
  },
  {
    reworkId: "RW-PO-004",
    sourceType: "PRODUCTION_OPERATION",
    sourceId: "ASM-003/FIT01",
    project: "BHEL-001",
    dwg: "DWG-01 + DWG-02",
    assemblyId: "ASM-003",
    material: "Plate + Pipe (via ASM-001, ASM-002)",
    description: "Combined Frame — Description-1",
    process: "Fit-up",
    processId: "FIT01",
    unit: "Unit",
    totalQty: 1,
    qcAcceptedQty: 0,
    rejectedQty: 1,
    completedQty: 1,
    qcRequired: true,
    status: STATUS.READY_NEXT,
    createdDate: "2026-08-10",
    createdTime: "09:00",
    start: {
      by: "Manoj Prabhu",
      supervisor: "Arun Kumar",
      date: "2026-08-11",
      time: "09:30",
      remarks: "Fit-up gap out of tolerance — re-align and re-tack.",
    },
    completions: [
      {
        by: "Manoj Prabhu",
        date: "2026-08-12",
        time: "15:20",
        qty: 1,
        remarks: "Gap corrected and re-tacked within tolerance.",
      },
    ],
    qc: {
      verifiedBy: "Ravi Shankar",
      result: "Approved",
      date: "2026-08-13",
      time: "10:00",
      remarks: "Fit-up re-verified — cleared for Welding.",
    },
    history: [
      hist(
        "2026-08-10",
        "09:00",
        "Fit-up: 1 of 1 piece rejected — sent to Rework."
      ),
      hist(
        "2026-08-11",
        "09:30",
        "Rework started by Manoj Prabhu (Supervisor: Arun Kumar)."
      ),
      hist(
        "2026-08-12",
        "15:20",
        "1 of 1 pieces completed by Manoj Prabhu — Rework Completed."
      ),
      hist(
        "2026-08-13",
        "10:00",
        "QC Approved by Ravi Shankar — Ready for Next Process."
      ),
    ],
  },
];

// -------------------------------------------------------------------------
// Row builders
// -------------------------------------------------------------------------
const buildRjwRow = (item) => ({
  ...item,
  balanceQty: item.requiredQty - item.completedQty,
});

const buildPoRow = (item) => ({
  ...item,
  requiredQty: item.rejectedQty,
  balanceQty: item.rejectedQty - item.completedQty,
});

// -------------------------------------------------------------------------
// Filters
// -------------------------------------------------------------------------
const RJW_FILTER_FIELDS = [
  { key: "project", label: "Project", type: "select" },
  { key: "poNumber", label: "PO Number", type: "select" },
  { key: "poDescription", label: "PO Description", type: "select" },
  { key: "dwg", label: "DWG", type: "select" },
  { key: "revision", label: "Revision", type: "select" },
  { key: "material", label: "Material", type: "select" },
  { key: "materialCode", label: "Material Code", type: "select" },
  { key: "thickness", label: "Thickness", type: "select" },
  { key: "size", label: "Size", type: "select" },
  { key: "unit", label: "Unit", type: "select" },
  { key: "status", label: "Rework Status", type: "select" },
];
const RJW_SEARCH_FIELDS = [
  "reworkId",
  "poNumber",
  "poDescription",
  "project",
  "dwg",
  "material",
  "pieceNo",
];

const PO_FILTER_FIELDS = [
  { key: "project", label: "Project", type: "select" },
  { key: "dwg", label: "DWG", type: "select" },
  { key: "assemblyId", label: "Assembly", type: "select" },
  { key: "material", label: "Material", type: "select" },
  { key: "process", label: "Process", type: "select" },
  { key: "status", label: "Rework Status", type: "select" },
];
const PO_SEARCH_FIELDS = [
  "reworkId",
  "project",
  "dwg",
  "assemblyId",
  "material",
  "process",
];

const HISTORY_EXTRA_FIELD = { key: "createdDate", label: "Date", type: "date" };

const buildOptionsMap = (rows, fields) => {
  const map = {};
  fields.forEach((f) => {
    if (f.type === "select") {
      map[f.key] = [
        ...new Set(rows.map((r) => r[f.key]).filter(Boolean)),
      ].sort();
    }
  });
  return map;
};

const matchesFilters = (row, filters, fields) =>
  fields.every((f) => {
    const val = filters[f.key];
    if (!val) return true;
    const rowVal = String(row[f.key] ?? "").toLowerCase();
    if (f.type === "date") return rowVal === val.toLowerCase();
    return f.type === "select"
      ? rowVal === val.toLowerCase()
      : rowVal.includes(val.toLowerCase());
  });

const matchesSearch = (row, search, fields) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  return fields.some((k) =>
    String(row[k] ?? "")
      .toLowerCase()
      .includes(term)
  );
};

// -------------------------------------------------------------------------
// Forms
// -------------------------------------------------------------------------
const emptyStartForm = () => ({
  by: "",
  supervisor: "",
  date: today(),
  time: nowTime(),
  remarks: "",
});
const emptyCompleteForm = () => ({
  qty: "",
  by: "",
  date: today(),
  time: nowTime(),
  remarks: "",
});
const emptyQcForm = () => ({
  verifiedBy: "",
  result: "Approved",
  date: today(),
  time: nowTime(),
  remarks: "",
});

const ACTION_TITLES = {
  start: "Start Rework",
  complete: "Complete Rework",
  qc: "QC Verification",
};
const ACTION_SAVE_LABELS = {
  start: "Save & Start",
  complete: "Save Completion",
  qc: "Save QC Result",
};

// =========================================================================
// Main component
// =========================================================================
export default function Rework() {
  const navigate = useNavigate();

  const [rjwItems, setRjwItems] = useState(initialReworkJobWork);
  const [poItems, setPoItems] = useState(initialReworkProduction);

  const [activeTab, setActiveTab] = useState("rjw");
  const [viewMode, setViewMode] = useState("active");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewId, setViewId] = useState(null);
  const [actionState, setActionState] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");

  const isRjw = activeTab === "rjw";
  const setItems = isRjw ? setRjwItems : setPoItems;

  const filterFields = isRjw ? RJW_FILTER_FIELDS : PO_FILTER_FIELDS;
  const searchFields = isRjw ? RJW_SEARCH_FIELDS : PO_SEARCH_FIELDS;
  const effectiveFilterFields =
    viewMode === "history"
      ? [...filterFields, HISTORY_EXTRA_FIELD]
      : filterFields;

  // ---------------------------------------------------------------------
  // Derived rows
  // ---------------------------------------------------------------------
  const allRows = useMemo(
    () => (isRjw ? rjwItems.map(buildRjwRow) : poItems.map(buildPoRow)),
    [isRjw, rjwItems, poItems]
  );

  const scopedRows = useMemo(
    () =>
      viewMode === "active"
        ? allRows.filter((r) => ACTIVE_STATUSES.includes(r.status))
        : allRows,
    [allRows, viewMode]
  );

  const filteredRows = useMemo(
    () =>
      scopedRows.filter(
        (r) =>
          matchesFilters(r, filters, effectiveFilterFields) &&
          matchesSearch(r, search, searchFields)
      ),
    [scopedRows, filters, effectiveFilterFields, search, searchFields]
  );

  const filterOptions = useMemo(
    () => buildOptionsMap(scopedRows, effectiveFilterFields),
    [scopedRows, effectiveFilterFields]
  );

  const viewRow = viewId
    ? isRjw
      ? buildRjwRow(rjwItems.find((r) => r.reworkId === viewId))
      : buildPoRow(poItems.find((r) => r.reworkId === viewId))
    : null;

  const actionItem = actionState
    ? (isRjw ? rjwItems : poItems).find((r) => r.reworkId === actionState.id)
    : null;
  const actionRow = actionItem
    ? isRjw
      ? buildRjwRow(actionItem)
      : buildPoRow(actionItem)
    : null;

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const switchTab = (tab) => {
    setActiveTab(tab);
    setViewMode("active");
    setFilters({});
    setSearch("");
    setFiltersOpen(false);
  };
  const switchViewMode = (mode) => {
    setViewMode(mode);
    setFilters({});
    setSearch("");
  };
  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const openView = (id) => setViewId(id);
  const closeView = () => setViewId(null);

  const openAction = (id, mode) => {
    setActionState({ id, mode });
    setFormError("");
    if (mode === "start") setForm(emptyStartForm());
    else if (mode === "complete") setForm(emptyCompleteForm());
    else setForm(emptyQcForm());
  };
  const closeAction = () => {
    setActionState(null);
    setForm({});
    setFormError("");
  };

  const updateItem = (id, updater) => {
    setItems((prev) =>
      prev.map((it) => (it.reworkId === id ? updater(it) : it))
    );
  };
  const pushHistory = (id, event) => {
    setItems((prev) =>
      prev.map((it) =>
        it.reworkId === id
          ? { ...it, history: [...it.history, hist(today(), nowTime(), event)] }
          : it
      )
    );
  };

  const handleSaveStart = () => {
    if (!form.by) return setFormError("Please select Rework Done By.");
    if (!form.supervisor) return setFormError("Please select Supervisor.");
    const { id } = actionState;
    updateItem(id, (it) => ({
      ...it,
      status: STATUS.IN_PROGRESS,
      start: {
        by: form.by,
        supervisor: form.supervisor,
        date: form.date,
        time: form.time,
        remarks: form.remarks.trim(),
      },
    }));
    pushHistory(id, `Rework started by ${form.by} (Supervisor: ${form.supervisor}).`);
    closeAction();
  };

  const handleSaveComplete = () => {
    const qty = Number(form.qty) || 0;
    if (!form.by) return setFormError("Please select Completed By.");
    if (qty <= 0) return setFormError("Enter a Completed Quantity greater than 0.");
    if (qty > actionRow.balanceQty) {
      return setFormError(
        `Completed Quantity cannot exceed the balance rework quantity (${actionRow.balanceQty}).`
      );
    }
    const { id } = actionState;
    const newCompleted = actionItem.completedQty + qty;
    const newBalance = actionRow.requiredQty - newCompleted;
    let nextStatus;
    if (newBalance > 0) {
      nextStatus = STATUS.PARTIAL;
    } else if (isRjw) {
      nextStatus = STATUS.AVAILABLE_STOCK;
    } else {
      nextStatus = actionItem.qcRequired ? STATUS.QC_PENDING : STATUS.READY_NEXT;
    }
    updateItem(id, (it) => ({
      ...it,
      completedQty: newCompleted,
      status: nextStatus,
      completions: [
        ...it.completions,
        {
          by: form.by,
          date: form.date,
          time: form.time,
          qty,
          remarks: form.remarks.trim(),
        },
      ],
    }));
    pushHistory(
      id,
      `${newCompleted} of ${actionRow.requiredQty} completed by ${form.by}${
        newBalance > 0
          ? ` — ${newBalance} remaining.`
          : " — Rework Completed."
      }`
    );
    if (newBalance === 0) {
      if (isRjw) {
        pushHistory(
          id,
          `Material made Available in Material Stock (Rework ID ${id}).`
        );
      } else if (actionItem.qcRequired) {
        pushHistory(id, "Sent for QC verification.");
      } else {
        pushHistory(id, "Quantity released to the next production process.");
      }
    }
    closeAction();
  };

  const handleSaveQc = () => {
    if (!form.verifiedBy) return setFormError("Please select QC Verified By.");
    const { id } = actionState;
    const approved = form.result === "Approved";
    updateItem(id, (it) => ({
      ...it,
      status: approved ? STATUS.READY_NEXT : STATUS.REQUIRED,
      completedQty: approved ? it.completedQty : 0,
      qc: {
        verifiedBy: form.verifiedBy,
        result: form.result,
        date: form.date,
        time: form.time,
        remarks: form.remarks.trim(),
      },
    }));
    pushHistory(
      id,
      approved
        ? `QC Approved by ${form.verifiedBy} — Ready for Next Process.`
        : `QC Rejected by ${form.verifiedBy} — Rework Required again.`
    );
    closeAction();
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
                <h1 className="page-header-title">Rework</h1>
                <p className="page-header-subtitle">
                  The central place for every material or quantity that needs
                  rework. Items arrive here automatically from Receive From Job
                  Work and Production Operation — nothing is entered twice.
                </p>
              </div>
            </div>
          </div>

          {/* ===================== TABS ===================== */}
          <div className="tabs">
            <button
              type="button"
              className={`tab ${isRjw ? "tab-active" : ""}`}
              onClick={() => switchTab("rjw")}
            >
              Receive From Job Work
              <span className="tab-count">
                {
                  rjwItems.filter((r) => ACTIVE_STATUSES.includes(r.status))
                    .length
                }
              </span>
            </button>
            <button
              type="button"
              className={`tab ${!isRjw ? "tab-active" : ""}`}
              onClick={() => switchTab("po")}
            >
              Production Operation
              <span className="tab-count">
                {
                  poItems.filter((r) => ACTIVE_STATUSES.includes(r.status))
                    .length
                }
              </span>
            </button>
          </div>

          {/* ===================== VIEW MODE ===================== */}
          <div className="viewmode-row">
            <div className="viewmode-toggle">
              <button
                type="button"
                className={`viewmode-btn ${
                  viewMode === "active" ? "viewmode-btn-active" : ""
                }`}
                onClick={() => switchViewMode("active")}
              >
                Active Rework
              </button>
              <button
                type="button"
                className={`viewmode-btn ${
                  viewMode === "history" ? "viewmode-btn-active" : ""
                }`}
                onClick={() => switchViewMode("history")}
              >
                <History size={14} />
                History
              </button>
            </div>
            <p className="viewmode-hint">
              {viewMode === "active"
                ? "Showing rework that still needs action."
                : "Showing every rework transaction, completed and in progress."}
            </p>
          </div>

          {/* ===================== TABLE ===================== */}
          <div className="panel">
            <FilterPanel
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={handleFilterChange}
              fields={effectiveFilterFields}
              options={filterOptions}
              onClear={clearFilters}
              open={filtersOpen}
              onToggleOpen={() => setFiltersOpen((o) => !o)}
              resultCount={filteredRows.length}
              placeholder={
                isRjw
                  ? "Search Rework ID, PO Number, PO Description, Project, DWG, Material, Piece Number..."
                  : "Search Rework ID, Project, DWG, Assembly ID, Material, Process..."
              }
            />

            <div className="table-scroll-wrapper">
              {isRjw ? (
                <RjwTable
                  rows={filteredRows}
                  onView={openView}
                  onOpen={openAction}
                />
              ) : (
                <PoTable
                  rows={filteredRows}
                  onView={openView}
                  onOpen={openAction}
                />
              )}
            </div>
          </div>

          {/* ===================== EYE VIEW MODAL ===================== */}
          {viewRow && (
            <div className="modal-overlay" onClick={closeView}>
              <div
                className="modal-box modal-box-wide"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">{viewRow.reworkId}</h2>
                    <p className="modal-subtitle">
                      Source :{" "}
                      <strong>
                        {isRjw ? "Receive From Job Work" : "Production Operation"}
                      </strong>{" "}
                      · Status : <strong>{viewRow.status}</strong>
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
                  {isRjw ? <EyeViewRjw row={viewRow} /> : <EyeViewPo row={viewRow} />}
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

          {/* ===================== ACTION MODAL ===================== */}
          {actionState && actionItem && actionRow && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {ACTION_TITLES[actionState.mode]}
                    </h2>
                    <p className="modal-subtitle">
                      Rework ID : <strong>{actionRow.reworkId}</strong> ·{" "}
                      {isRjw ? "Piece" : "Assembly"} :{" "}
                      <strong>
                        {isRjw ? actionRow.pieceNo : actionRow.assemblyId}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeAction}
                    className="modal-close-btn"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body">
                  <ActionModalBody
                    row={actionRow}
                    isRjw={isRjw}
                    mode={actionState.mode}
                    form={form}
                    setForm={setForm}
                  />
                  {formError && <div className="error-box">{formError}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeAction}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={
                      {
                        start: handleSaveStart,
                        complete: handleSaveComplete,
                        qc: handleSaveQc,
                      }[actionState.mode]
                    }
                    className="btn btn-primary"
                  >
                    {ACTION_SAVE_LABELS[actionState.mode]}
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
// Filter panel
// =========================================================================
function FilterPanel({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  fields,
  options,
  onClear,
  open,
  onToggleOpen,
  resultCount,
  placeholder,
}) {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder={placeholder}
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
          {fields.map((f) => (
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
              ) : f.type === "date" ? (
                <input
                  type="date"
                  value={filters[f.key] || ""}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                />
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

      <p
        style={{
          margin: "12px 2px 0",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        {resultCount} record{resultCount !== 1 ? "s" : ""} found
      </p>
    </div>
  );
}

// =========================================================================
// Status badge
// =========================================================================
function StatusBadge({ status }) {
  const map = {
    [STATUS.REQUIRED]: { cls: "status-badge-danger", icon: "⚠" },
    [STATUS.IN_PROGRESS]: { cls: "status-badge-info", icon: "●" },
    [STATUS.PARTIAL]: { cls: "status-badge-warning", icon: "◐" },
    [STATUS.QC_PENDING]: { cls: "status-badge-purple", icon: "◐" },
    [STATUS.READY_NEXT]: { cls: "status-badge-success", icon: "✓" },
    [STATUS.AVAILABLE_STOCK]: { cls: "status-badge-success", icon: "✓" },
  };
  const m = map[status] || { cls: "", icon: "" };
  return (
    <span className={`status-badge ${m.cls}`}>
      {m.icon} {status}
    </span>
  );
}

// =========================================================================
// Action buttons
// =========================================================================
function ActionButtons({ row, onOpen }) {
  if (
    row.status === STATUS.READY_NEXT ||
    row.status === STATUS.AVAILABLE_STOCK
  ) {
    return <span className="locked-pill">Completed</span>;
  }
  if (row.status === STATUS.REQUIRED) {
    return (
      <button
        type="button"
        onClick={() => onOpen(row.reworkId, "start")}
        className="btn btn-primary btn-sm"
      >
        Start Rework
      </button>
    );
  }
  if (row.status === STATUS.IN_PROGRESS || row.status === STATUS.PARTIAL) {
    return (
      <button
        type="button"
        onClick={() => onOpen(row.reworkId, "complete")}
        className="btn btn-primary btn-sm"
      >
        Complete Rework
      </button>
    );
  }
  if (row.status === STATUS.QC_PENDING) {
    return (
      <button
        type="button"
        onClick={() => onOpen(row.reworkId, "qc")}
        className="btn btn-qc btn-sm"
      >
        QC Verify
      </button>
    );
  }
  return null;
}

// =========================================================================
// Tables
// =========================================================================
function RjwTable({ rows, onView, onOpen }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Rework ID</th>
          <th>PO Number</th>
          <th>PO Description</th>
          <th>Supplier</th>
          <th>Project</th>
          <th>DWG / Description</th>
          <th>Revision</th>
          <th>Material</th>
          <th>Material Code</th>
          <th>Material Specification</th>
          <th>Thickness</th>
          <th>Size</th>
          <th>Piece Number</th>
          <th>Unit</th>
          <th>Quantity</th>
          <th>Rework Status</th>
          <th>Created Date</th>
          <th className="cell-action">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={18}>
              <EmptyState />
            </td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={row.reworkId}>
            <td className="cell-id">{row.reworkId}</td>
            <td>{row.poNumber || "-"}</td>
            <td>{row.poDescription || "-"}</td>
            <td>{row.supplier || "-"}</td>
            <td>{row.project || "-"}</td>
            <td>{row.dwgDescription || row.dwg || "-"}</td>
            <td>{row.revision || "-"}</td>
            <td>{row.material || "-"}</td>
            <td className="cell-mono">{row.materialCode || "-"}</td>
            <td>{row.materialSpec || "-"}</td>
            <td>{row.thickness || "-"}</td>
            <td>{row.size || "-"}</td>
            <td>{row.pieceNo || "-"}</td>
            <td>{row.unit || "-"}</td>
            <td className="cell-num">
              {row.completedQty}/{row.requiredQty}
              {row.balanceQty > 0 && (
                <span className="balance-pill">bal {row.balanceQty}</span>
              )}
            </td>
            <td>
              <StatusBadge status={row.status} />
            </td>
            <td>{row.createdDate}</td>
            <td>
              <div className="action-cell">
                <button
                  type="button"
                  onClick={() => onView(row.reworkId)}
                  className="icon-btn"
                  title="View Details"
                  aria-label="View Details"
                >
                  <Eye size={15} />
                </button>
                <ActionButtons row={row} onOpen={onOpen} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PoTable({ rows, onView, onOpen }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Rework ID</th>
          <th>Project</th>
          <th>DWG</th>
          <th>Assembly ID</th>
          <th>Material</th>
          <th>Description</th>
          <th>Process</th>
          <th>Total Quantity</th>
          <th>Rejected Quantity</th>
          <th>Rework Completed Quantity</th>
          <th>Balance Rework Quantity</th>
          <th>Rework Status</th>
          <th>Created Date</th>
          <th className="cell-action">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={14}>
              <EmptyState />
            </td>
          </tr>
        )}
        {rows.map((row) => (
          <tr key={row.reworkId}>
            <td className="cell-id">{row.reworkId}</td>
            <td>{row.project || "-"}</td>
            <td>{row.dwg || "-"}</td>
            <td>{row.assemblyId || "-"}</td>
            <td>{row.material || "-"}</td>
            <td>{row.description || "-"}</td>
            <td>{row.process || "-"}</td>
            <td className="cell-num">{row.totalQty}</td>
            <td className="cell-num">{row.rejectedQty}</td>
            <td className="cell-num">{row.completedQty}</td>
            <td className="cell-num">
              {row.balanceQty > 0 ? (
                <span className="balance-pill">{row.balanceQty}</span>
              ) : (
                0
              )}
            </td>
            <td>
              <StatusBadge status={row.status} />
            </td>
            <td>{row.createdDate}</td>
            <td>
              <div className="action-cell">
                <button
                  type="button"
                  onClick={() => onView(row.reworkId)}
                  className="icon-btn"
                  title="View Details"
                  aria-label="View Details"
                >
                  <Eye size={15} />
                </button>
                <ActionButtons row={row} onOpen={onOpen} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🔧</div>
      <p className="empty-state-title">No Rework Found</p>
      <p className="empty-state-desc">
        No rework record matches the current view / search / filters.
      </p>
    </div>
  );
}

// =========================================================================
// Action modal body
// =========================================================================
function ActionModalBody({ row, isRjw, mode, form, setForm }) {
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Rework Details</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Rework ID" value={row.reworkId} emphasize />
          <ReadonlyField
            label="Source"
            value={isRjw ? "Receive From Job Work" : "Production Operation"}
          />
          {isRjw ? (
            <>
              <ReadonlyField label="PO" value={row.poNumber} />
              <ReadonlyField label="PO Description" value={row.poDescription} />
              <ReadonlyField label="Project" value={row.project} />
              <ReadonlyField label="DWG" value={row.dwg} />
              <ReadonlyField label="Material" value={row.material} />
              <ReadonlyField label="Piece" value={row.pieceNo} />
              <ReadonlyField label="Thickness" value={row.thickness} />
              <ReadonlyField label="Size" value={`${row.size} mm`} />
              <ReadonlyField
                label="Quantity"
                value={`${row.requiredQty} ${row.unit}`}
              />
            </>
          ) : (
            <>
              <ReadonlyField label="Project" value={row.project} />
              <ReadonlyField label="Assembly" value={row.assemblyId} />
              <ReadonlyField label="DWG" value={row.dwg} />
              <ReadonlyField label="Process" value={row.process} />
              <ReadonlyField label="Total" value={row.totalQty} />
              <ReadonlyField label="QC Accepted" value={row.qcAcceptedQty} />
              <ReadonlyField label="QC Rejected" value={row.rejectedQty} />
              <ReadonlyField label="Rework Quantity" value={row.requiredQty} />
            </>
          )}
          <ReadonlyField
            label="Balance To Rework"
            value={row.balanceQty}
            emphasize
          />
        </div>
      </div>

      {mode === "start" && (
        <div className="modal-card">
          <h3 className="modal-card-title">Start Rework</h3>
          <div className="modal-form-grid">
            <div className="modal-form-field">
              <label>Rework Done By</label>
              <select
                value={form.by || ""}
                onChange={(e) => update("by", e.target.value)}
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-form-field">
              <label>Supervisor</label>
              <select
                value={form.supervisor || ""}
                onChange={(e) => update("supervisor", e.target.value)}
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-form-field">
              <label>Start Date</label>
              <input
                type="date"
                value={form.date || ""}
                onChange={(e) => update("date", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>Start Time</label>
              <input
                type="time"
                value={form.time || ""}
                onChange={(e) => update("time", e.target.value)}
              />
            </div>
            <div className="modal-form-field modal-form-field-wide">
              <label>Start Remarks</label>
              <textarea
                rows={3}
                value={form.remarks || ""}
                placeholder="What needs correcting and how it will be corrected..."
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "complete" && (
        <div className="modal-card">
          <h3 className="modal-card-title">Complete Rework</h3>
          <p className="modal-card-subtitle">
            Balance rework quantity: <strong>{row.balanceQty}</strong>. Enter
            less than the balance to record a partial completion — the
            remainder stays in this list.
          </p>
          <div className="modal-form-grid">
            <div className="modal-form-field">
              <label>Completed Quantity</label>
              <input
                type="number"
                min="1"
                max={row.balanceQty}
                value={form.qty || ""}
                onChange={(e) => update("qty", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>Completed By</label>
              <select
                value={form.by || ""}
                onChange={(e) => update("by", e.target.value)}
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-form-field">
              <label>Completion Date</label>
              <input
                type="date"
                value={form.date || ""}
                onChange={(e) => update("date", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>Completion Time</label>
              <input
                type="time"
                value={form.time || ""}
                onChange={(e) => update("time", e.target.value)}
              />
            </div>
            <div className="modal-form-field modal-form-field-wide">
              <label>Completion Remarks</label>
              <textarea
                rows={3}
                value={form.remarks || ""}
                placeholder="What was done to correct it..."
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "qc" && (
        <div className="modal-card">
          <h3 className="modal-card-title">QC Verification</h3>
          <div className="modal-form-grid">
            <div className="modal-form-field">
              <label>QC Verified By</label>
              <select
                value={form.verifiedBy || ""}
                onChange={(e) => update("verifiedBy", e.target.value)}
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-form-field">
              <label>Result</label>
              <div className="radio-row">
                <label className="radio">
                  <input
                    type="radio"
                    name="qcResult"
                    checked={form.result === "Approved"}
                    onChange={() => update("result", "Approved")}
                  />
                  Approved
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="qcResult"
                    checked={form.result === "Rejected"}
                    onChange={() => update("result", "Rejected")}
                  />
                  Rejected
                </label>
              </div>
            </div>
            <div className="modal-form-field">
              <label>QC Date</label>
              <input
                type="date"
                value={form.date || ""}
                onChange={(e) => update("date", e.target.value)}
              />
            </div>
            <div className="modal-form-field">
              <label>QC Time</label>
              <input
                type="time"
                value={form.time || ""}
                onChange={(e) => update("time", e.target.value)}
              />
            </div>
            <div className="modal-form-field modal-form-field-wide">
              <label>QC Remarks</label>
              <textarea
                rows={3}
                value={form.remarks || ""}
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>
          {form.result === "Rejected" && (
            <p className="modal-card-footnote">
              Rejecting sends this Rework ID back to{" "}
              <strong>Rework Required</strong> for a new rework cycle. The
              existing history is preserved, not deleted.
            </p>
          )}
        </div>
      )}
    </>
  );
}

// =========================================================================
// Eye view — Receive From Job Work
// =========================================================================
function EyeViewRjw({ row }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">1. Rework Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Rework ID" value={row.reworkId} emphasize />
          <ReadonlyField label="Source" value="Receive From Job Work" />
          <ReadonlyField label="Status" value={row.status} />
          <ReadonlyField label="Created Date" value={row.createdDate} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">2. Original PO Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="PO Number" value={row.poId} />
          <ReadonlyField label="PO Description" value={row.poDescription} />
          <ReadonlyField label="Supplier" value={row.supplier} />
          <ReadonlyField label="Project" value={row.project} />
          <ReadonlyField label="DWG" value={row.dwg} />
          <ReadonlyField label="DWG Description" value={row.dwgDescription} />
          <ReadonlyField label="Revision" value={row.revision} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">3. Material &amp; Piece Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Material" value={row.material} />
          <ReadonlyField label="Material Code" value={row.materialCode} />
          <ReadonlyField
            label="Material Specification"
            value={row.materialSpec}
          />
          <ReadonlyField label="Piece Number" value={row.pieceNo} />
          <ReadonlyField label="Thickness" value={row.thickness} />
          <ReadonlyField label="Length" value={`${row.length} mm`} />
          <ReadonlyField
            label="Width"
            value={row.width === "—" ? "—" : `${row.width} mm`}
          />
          <ReadonlyField label="Size" value={row.size} />
          <ReadonlyField label="Required Qty" value={row.requiredQty} />
          <ReadonlyField label="Completed Qty" value={row.completedQty} />
          <ReadonlyField label="Balance Qty" value={row.balanceQty} emphasize />
          <ReadonlyField label="Unit" value={row.unit} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">4. Original Flow</h3>
        <FlowDiagram
          steps={[
            row.poId,
            row.poDescription,
            "GRN",
            "Material Stock",
            "Issue To Job Work",
            "Receive From Job Work",
            "Remaining Piece",
            "Rework Required",
          ]}
        />
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">5. Start Information</h3>
        {row.start ? (
          <div className="readonly-grid">
            <ReadonlyField label="Rework Done By" value={row.start.by} />
            <ReadonlyField label="Supervisor" value={row.start.supervisor} />
            <ReadonlyField label="Start Date" value={row.start.date} />
            <ReadonlyField label="Start Time" value={row.start.time} />
            <ReadonlyField label="Remarks" value={row.start.remarks || "—"} />
          </div>
        ) : (
          <p className="modal-card-subtitle">Rework has not started yet.</p>
        )}
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">6. Completion Information</h3>
        {row.completions.length === 0 ? (
          <p className="modal-card-subtitle">No completion recorded yet.</p>
        ) : (
          row.completions.map((c, idx) => (
            <div className="readonly-grid completion-block" key={idx}>
              <ReadonlyField label="Completed By" value={c.by} />
              <ReadonlyField label="Completed Date" value={c.date} />
              <ReadonlyField label="Completed Time" value={c.time} />
              <ReadonlyField label="Completed Qty" value={c.qty} />
              <ReadonlyField label="Remarks" value={c.remarks || "—"} />
            </div>
          ))
        )}
      </div>

      {row.status === STATUS.AVAILABLE_STOCK && (
        <div className="modal-card modal-card-final">
          <h3 className="modal-card-title">7. Material Stock</h3>
          <p className="modal-card-subtitle">
            Piece <strong>{row.pieceNo}</strong> is now Available in Material
            Stock. The original PO / GRN / Job Work linkage is preserved, and
            Rework ID <strong>{row.reworkId}</strong> is kept for traceability
            — no duplicate stock entry was created.
          </p>
        </div>
      )}

      <div className="modal-card">
        <h3 className="modal-card-title">8. Status History</h3>
        <HistoryTimeline history={row.history} />
      </div>
    </>
  );
}

// =========================================================================
// Eye view — Production Operation
// =========================================================================
function EyeViewPo({ row }) {
  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">1. Rework Information</h3>
        <div className="readonly-grid">
          <ReadonlyField label="Rework ID" value={row.reworkId} emphasize />
          <ReadonlyField label="Source" value="Production Operation" />
          <ReadonlyField label="Status" value={row.status} />
          <ReadonlyField label="Created Date" value={row.createdDate} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">2. Assembly Information</h3>
        <p className="modal-card-subtitle">
          Original Assembly Integration information — this Assembly is not
          re-created here.
        </p>
        <div className="readonly-grid">
          <ReadonlyField label="Assembly" value={row.assemblyId} />
          <ReadonlyField label="Project" value={row.project} />
          <ReadonlyField label="DWG(s)" value={row.dwg} />
          <ReadonlyField label="Material" value={row.material} />
          <ReadonlyField label="Description" value={row.description} />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">
          3. Process &amp; Quantity Information
        </h3>
        <div className="readonly-grid">
          <ReadonlyField label="Process" value={row.process} />
          <ReadonlyField label="Process ID" value={row.processId} />
          <ReadonlyField label="Total Quantity" value={row.totalQty} />
          <ReadonlyField label="QC Accepted" value={row.qcAcceptedQty} />
          <ReadonlyField label="QC Rejected" value={row.rejectedQty} />
          <ReadonlyField label="Rework Completed" value={row.completedQty} />
          <ReadonlyField
            label="Balance Rework"
            value={row.balanceQty}
            emphasize
          />
          <ReadonlyField label="Unit" value={row.unit} />
          <ReadonlyField
            label="QC Required"
            value={row.qcRequired ? "Yes" : "No"}
          />
        </div>
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">4. Flow</h3>
        <FlowDiagram
          steps={[
            "PO",
            "GRN",
            "Material Stock",
            "Issue To Production",
            `Assembly (${row.assemblyId})`,
            row.process,
            "QC Rejected",
            "Rework Required",
          ]}
        />
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">5. Start Information</h3>
        {row.start ? (
          <div className="readonly-grid">
            <ReadonlyField label="Rework Done By" value={row.start.by} />
            <ReadonlyField label="Supervisor" value={row.start.supervisor} />
            <ReadonlyField label="Start Date" value={row.start.date} />
            <ReadonlyField label="Start Time" value={row.start.time} />
            <ReadonlyField label="Remarks" value={row.start.remarks || "—"} />
          </div>
        ) : (
          <p className="modal-card-subtitle">Rework has not started yet.</p>
        )}
      </div>

      <div className="modal-card">
        <h3 className="modal-card-title">6. Completion Information</h3>
        {row.completions.length === 0 ? (
          <p className="modal-card-subtitle">No completion recorded yet.</p>
        ) : (
          row.completions.map((c, idx) => (
            <div className="readonly-grid completion-block" key={idx}>
              <ReadonlyField label="Completed By" value={c.by} />
              <ReadonlyField label="Completed Date" value={c.date} />
              <ReadonlyField label="Completed Time" value={c.time} />
              <ReadonlyField label="Completed Qty" value={c.qty} />
              <ReadonlyField label="Remarks" value={c.remarks || "—"} />
            </div>
          ))
        )}
      </div>

      {row.qcRequired && (
        <div className="modal-card">
          <h3 className="modal-card-title">7. QC Verification</h3>
          {row.qc ? (
            <div className="readonly-grid">
              <ReadonlyField label="Verified By" value={row.qc.verifiedBy} />
              <ReadonlyField label="Result" value={row.qc.result} />
              <ReadonlyField label="QC Date" value={row.qc.date} />
              <ReadonlyField label="QC Time" value={row.qc.time} />
              <ReadonlyField label="Remarks" value={row.qc.remarks || "—"} />
            </div>
          ) : (
            <p className="modal-card-subtitle">
              QC verification not recorded yet.
            </p>
          )}
        </div>
      )}

      {row.status === STATUS.READY_NEXT && (
        <div className="modal-card modal-card-final">
          <h3 className="modal-card-title">8. Next Process</h3>
          <p className="modal-card-subtitle">
            The reworked quantity has been released back into the{" "}
            <strong>{row.assemblyId}</strong> process chain. The next process
            can now receive it — this does not auto-complete the next step.
          </p>
        </div>
      )}

      <div className="modal-card">
        <h3 className="modal-card-title">9. Status History</h3>
        <HistoryTimeline history={row.history} />
      </div>
    </>
  );
}

// =========================================================================
// Small shared bits
// =========================================================================
function FlowDiagram({ steps }) {
  return (
    <div className="flow">
      {steps.map((step, idx) => (
        <div className="flow-row" key={idx}>
          <span
            className={`flow-step ${
              idx === steps.length - 1 ? "flow-step-final" : ""
            }`}
          >
            {step}
          </span>
          {idx < steps.length - 1 && <span className="flow-arrow">↓</span>}
        </div>
      ))}
    </div>
  );
}

function HistoryTimeline({ history }) {
  if (history.length === 0) {
    return <p className="modal-card-subtitle">No history recorded yet.</p>;
  }
  return (
    <ol className="timeline">
      {history.map((h, idx) => (
        <li className="timeline-item" key={idx}>
          <span className="timeline-dot" />
          <div className="timeline-content">
            <div className="timeline-date">
              {h.date} · {h.time}
            </div>
            <div className="timeline-event">{h.event}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

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