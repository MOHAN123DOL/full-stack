import { useCallback, useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
} from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import useFilterOptions from "../../hooks/useFilterOptions";

import "./ProductionAssemblyIntegration.css";

const API_BASE = "/erp/material";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const DELIVERY_CHALLAN_ROUTE = "/accounts/DeliveryChallan";

/* ================================================================== */
/* HELPERS                                                             */
/* ================================================================== */
function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat().find((v) => typeof v === "string");
    if (first) return first;
  }
  if (error?.message) return error.message;
  return fallback;
}

function fmt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/* ------------------------------------------------------------------ */
/* PROCESS ID AUTO-GENERATION                                          */
/* ------------------------------------------------------------------ */
function processPrefix(name) {
  const letters = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (letters.length === 0) return "";
  return letters.slice(0, 3).padEnd(3, "X");
}

function nextProcessId(processes, prefix, skipRowId = null) {
  if (!prefix) return "";

  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;

  processes.forEach((p) => {
    if (p.rowId === skipRowId) return;
    const pid = String(p.processId || "").trim().toUpperCase();
    const m = pid.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  });

  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/* ================================================================== */
/* CONSTANTS                                                           */
/* ================================================================== */
const WIZARD_STEPS = [
  { n: 1, label: "Project" },
  { n: 2, label: "Inputs" },
  { n: 3, label: "Availability" },
  { n: 4, label: "Process" },
  { n: 5, label: "Review" },
];

const FILTER_FIELDS = [
  { key: "project", label: "Project", type: "select" },
  { key: "status", label: "Status", type: "select" },
  { key: "thickness", label: "Thickness", type: "select" },
  { key: "size", label: "Size", type: "select" },
  { key: "unit", label: "Unit", type: "select" },
];

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
  executionType: "In-House",
  executionUnit: "Unit 1",
  outsourcing: null,
  ...overrides,
});

let inputRowSeq = 1;
const newInputRow = (overrides = {}) => ({
  rowId: `input-${inputRowSeq++}`,
  sourceType: "material",
  sourceId: "",
  useQty: "",
  ...overrides,
});

const emptyAssemblyForm = () => ({
  projectId: null,
  project: "",
  projectName: "",
  inputs: [newInputRow()],
  processes: [newProcessRow()],
});

const buildFilterRow = (asm) => {
  const materialInputs = (asm.inputs || []).filter(
    (i) => i.sourceType === "material"
  );
  return {
    assemblyId: asm.assemblyId,
    project: asm.project,
    status: asm.status,
    thickness: materialInputs.map((i) => i.thickness).join(" "),
    size: materialInputs
      .map((i) => (i.length && i.width ? `${i.length} x ${i.width}` : ""))
      .join(" "),
    unit: materialInputs.map((i) => i.unit).join(" "),
    material: materialInputs.map((i) => i.materialName).join(" "),
    materialCode: materialInputs.map((i) => i.materialCode).join(" "),
    process: (asm.processes || []).map((p) => p.name).join(" "),
    processId: (asm.processes || []).map((p) => p.processId).join(" "),
  };
};

const matchesFilters = (row, filters) =>
  FILTER_FIELDS.every((f) => {
    const val = filters[f.key];
    if (!val) return true;
    const rowVal = String(row[f.key] ?? "").toLowerCase();
    return rowVal.includes(val.toLowerCase());
  });

const matchesSearch = (row, search) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  return [
    "assemblyId",
    "project",
    "thickness",
    "size",
    "unit",
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

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */
export default function ProductionAssemblyIntegration() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => {
      setSuccessMessage("");
      setOutsourcingHandoff(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewAssemblyId, setViewAssemblyId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [formMode, setFormMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAssemblyForm());
  const [formError, setFormError] = useState("");
  const [wizardStep, setWizardStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [sources, setSources] = useState({
    materials: [],
    assemblies: [],
  });
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProject, setHistoryProject] = useState("");

  // After a successful save, if any process is Outsourcing, we
  // surface a "Create Delivery Challan" CTA on the success banner.
  const [outsourcingHandoff, setOutsourcingHandoff] = useState(null);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const { options: filterOptions, refresh: refreshFilterOptions } =
    useFilterOptions("assembly", { enabled: !!accessToken });

  /* -------- fetch assemblies -------- */
  const fetchAssemblies = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setLoading(true);
        setError("");

        const res = await api.get(`${API_BASE}/assembly/`, {
          headers: authHeaders(),
        });

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];

        setAssemblies(list);
      } catch (err) {
        console.error("Failed to load assemblies:", err);
        setError(getApiError(err, "Failed to load assemblies."));
        setAssemblies([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accessToken, authHeaders]
  );

  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setLoading(false);
      return;
    }
    fetchAssemblies();
  }, [accessToken, fetchAssemblies]);

  /* -------- fetch sources when project changes -------- */
  useEffect(() => {
    const projectId = form.projectId;
    if (!projectId || !formMode) {
      setSources({ materials: [], assemblies: [] });
      return;
    }
    if (!accessToken) return;

    let cancelled = false;
    setSourcesLoading(true);

    (async () => {
      try {
        const res = await api.get(`${API_BASE}/assembly/sources/`, {
          params: {
            projectId,
            excludeAssemblyId: editingId || undefined,
          },
          headers: authHeaders(),
        });
        const d = res.data?.data || {};
        if (!cancelled) {
          setSources({
            materials: d.materials || [],
            assemblies: d.assemblies || [],
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load sources:", err);
        setSources({ materials: [], assemblies: [] });
      } finally {
        if (!cancelled) setSourcesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, authHeaders, form.projectId, formMode, editingId]);

  /* -------- derived -------- */
  const filterRows = useMemo(
    () =>
      assemblies.map((a) => ({
        ...buildFilterRow(a),
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

  const filterOptionsMap = useMemo(() => {
    const map = {};
    FILTER_FIELDS.forEach((f) => {
      if (f.type === "select") {
        map[f.key] = [
          ...new Set(
            filterRows
              .flatMap((r) => String(r[f.key] ?? "").split(/\s+/))
              .filter(Boolean)
          ),
        ].sort();
      }
    });
    Object.keys(filterOptions || {}).forEach((k) => {
      const merged = new Set([
        ...(map[k] || []),
        ...(filterOptions[k] || []),
      ]);
      map[k] = [...merged].sort();
    });
    return map;
  }, [filterRows, filterOptions]);

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  /* -------- eye view -------- */
  const viewAssembly = viewAssemblyId
    ? assemblies.find((a) => a.assemblyId === viewAssemblyId)
    : null;

  const openView = (assemblyId) => {
    setViewAssemblyId(assemblyId);
    setActiveTab("overview");
  };
  const closeView = () => setViewAssemblyId(null);

  /* -------- create/edit -------- */
  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyAssemblyForm());
    setFormError("");
    setWizardStep(1);
    setOutsourcingHandoff(null);
  };

  const openEdit = (asm) => {
    if (asm.status !== "Planned") return;
    setFormMode("edit");
    setEditingId(asm.assemblyId);
    setForm({
      projectId: asm.projectId,
      project: asm.project,
      projectName: asm.projectName || "",
      inputs:
        (asm.inputs || []).length > 0
          ? asm.inputs.map((i) =>
              newInputRow({
                sourceType: i.sourceType,
                sourceId:
                  i.sourceType === "material"
                    ? i.jobWorkPieceId
                    : i.sourceAssemblyId,
                useQty: i.useQty,
              })
            )
          : [newInputRow()],
      processes:
        (asm.processes || []).length > 0
          ? asm.processes.map((p) =>
              newProcessRow({
                name: p.name,
                processId: p.processId,
                qcRequired: p.qcRequired,
                executionType: p.executionType,
                executionUnit: p.executionUnit || "Unit 1",
                outsourcing:
                  p.executionType === "Outsourcing"
                    ? {
                        vendor: p.vendor || "",
                        vendorContact: p.vendorContact || "",
                        vendorLocation: p.vendorLocation || "",
                        expectedReturnDate: p.expectedReturnDate || "",
                        remarks: p.outsourcingRemarks || "",
                      }
                    : null,
              })
            )
          : [newProcessRow()],
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
    setSaving(false);
  };

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

  /* ================================================================ */
  /* PROCESS UPDATE — with auto-generated Process ID                   */
  /* ================================================================ */
  const updateProcess = (rowId, field, value) =>
    setForm((f) => {
      if (field === "name") {
        const prefix = processPrefix(value);
        const current = f.processes.find((p) => p.rowId === rowId);

        const previousPrefix = processPrefix(current?.name || "");
        const currentPid = String(current?.processId || "").trim();
        const wasAuto =
          !currentPid ||
          (previousPrefix &&
            new RegExp(`^${previousPrefix}-\\d+$`, "i").test(currentPid));

        const nextId = wasAuto
          ? nextProcessId(f.processes, prefix, rowId)
          : currentPid;

        return {
          ...f,
          processes: f.processes.map((p) =>
            p.rowId === rowId
              ? { ...p, name: value, processId: nextId }
              : p
          ),
        };
      }

      return {
        ...f,
        processes: f.processes.map((p) =>
          p.rowId === rowId ? { ...p, [field]: value } : p
        ),
      };
    });

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
              outsourcing: {
                ...(p.outsourcing || emptyOutsourcing()),
                [field]: value,
              },
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

  const findSource = (sourceType, sourceId) => {
    if (sourceType === "material")
      return sources.materials.find((m) => String(m.id) === String(sourceId));
    if (sourceType === "assembly")
      return sources.assemblies.find((a) => String(a.id) === String(sourceId));
    return null;
  };

  const getSourceDisplay = (sourceType, sourceId) => {
    const src = findSource(sourceType, sourceId);
    if (!src) return null;
    if (sourceType === "material") {
      return {
        name: src.materialName,
        code: src.materialCode,
        unit: src.unit,
        thickness: src.thickness,
        size:
          src.length && src.width ? `${src.length} × ${src.width}` : "—",
        dwg: src.drawingNumber,
        available: Number(src.availableQty) || 0,
      };
    }
    return {
      name: src.assemblyId,
      code: "—",
      unit: "No.",
      thickness: "—",
      size: "—",
      dwg: null,
      available: Number(src.availableQty) || 0,
    };
  };

  /* ================================================================ */
  /* ROW STATUS — per-row availability + cross-row allocation check    */
  /* ================================================================ */
  const rowStatus = (row, allRows = form.inputs) => {
    if (!row.sourceId) {
      return {
        disp: null,
        available: 0,
        remaining: 0,
        claimedElsewhere: 0,
        required: 0,
        pending: 0,
        balance: 0,
        status: "available",
        error: "",
      };
    }

    const disp = getSourceDisplay(row.sourceType, row.sourceId);
    const available = disp?.available || 0;

    const claimedElsewhere = (allRows || [])
      .filter(
        (r) =>
          r.rowId !== row.rowId &&
          String(r.sourceId) === String(row.sourceId) &&
          r.sourceType === row.sourceType
      )
      .reduce((sum, r) => sum + (Number(r.useQty) || 0), 0);

    const remaining = Math.max(0, available - claimedElsewhere);
    const required = Number(row.useQty) || 0;
    const pending = Math.max(0, required - remaining);
    const balance = Math.max(0, remaining - required);

    let status = "available";
    if (required > 0 && pending > 0) {
      status = available > 0 ? "partial" : "pending";
    }

    let error = "";
    if (required > 0 && required > remaining) {
      error = `Only ${fmt(remaining)} ${disp?.unit || ""} left for this ${
        row.sourceType === "material" ? "material" : "assembly"
      }. You entered ${fmt(required)}.`;
    }

    return {
      disp,
      available,
      remaining,
      claimedElsewhere,
      required,
      pending,
      balance,
      status,
      error,
    };
  };

  /* ================================================================ */
  /* FORM VALIDATION SUMMARY                                           */
  /* ================================================================ */
  const inputErrors = useMemo(() => {
    const map = {};
    form.inputs.forEach((row) => {
      const r = rowStatus(row, form.inputs);
      if (r.error) map[row.rowId] = r.error;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.inputs, sources]);

  const hasInputErrors = Object.keys(inputErrors).length > 0;

  /* ================================================================ */
  /* STEP VALIDITY                                                     */
  /* ================================================================ */
  const stepValid = {
    1: !!form.projectId,
    2:
      form.inputs.some((r) => r.sourceId && Number(r.useQty) > 0) &&
      !hasInputErrors,
    3: !hasInputErrors,
    4: form.processes.some((p) => p.name.trim() && p.processId.trim()),
    5: !hasInputErrors,
  };

  const goNext = () => {
    if (wizardStep === 2 && hasInputErrors) {
      setFormError(
        "Some inputs exceed the available quantity. Please fix them before continuing."
      );
      return;
    }
    setFormError("");
    setWizardStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => {
    setFormError("");
    setWizardStep((s) => Math.max(1, s - 1));
  };

  const validateForm = () => {
    if (!form.projectId) return "Please select a project first.";

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
            return `Enter a vendor for "${p.name}" (Execution: Outsourcing).`;
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

    const snapshot = form.inputs.filter(
      (r) => r.sourceId && Number(r.useQty) > 0
    );
    for (const row of snapshot) {
      const st = rowStatus(row, form.inputs);
      if (st.error) return st.error;
    }

    return "";
  };

  const handleSubmit = async () => {
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
        ...(r.sourceType === "material"
          ? { jobWorkPieceId: Number(r.sourceId) }
          : { sourceAssemblyId: Number(r.sourceId) }),
        useQty: Number(r.useQty),
      }));

    const cleanProcesses = form.processes
      .filter((p) => p.name.trim() && p.processId.trim())
      .map((p, idx) => ({
        name: p.name.trim(),
        processId: p.processId.trim(),
        qcRequired: !!p.qcRequired,
        executionType: p.executionType,
        executionUnit:
          p.executionType === "In-House" ? p.executionUnit || "Unit 1" : "",
        ...(p.executionType === "Outsourcing"
          ? {
              vendor: (p.outsourcing?.vendor || "").trim(),
              vendorContact: (p.outsourcing?.vendorContact || "").trim(),
              vendorLocation: (p.outsourcing?.vendorLocation || "").trim(),
              expectedReturnDate: p.outsourcing?.expectedReturnDate || null,
              outsourcingRemarks: (p.outsourcing?.remarks || "").trim(),
            }
          : {}),
        sequence: idx + 1,
      }));

    const payload = {
      projectId: form.projectId,
      inputs: cleanInputs,
      processes: cleanProcesses,
    };

    setSaving(true);
    setFormError("");

    try {
      let savedAssemblyId = editingId;

      if (formMode === "edit" && editingId) {
        await api.patch(
          `${API_BASE}/assembly/${editingId}/`,
          payload,
          { headers: authHeaders() }
        );
        setSuccessMessage(`${editingId} updated.`);
      } else {
        const res = await api.post(`${API_BASE}/assembly/`, payload, {
          headers: authHeaders(),
        });
        savedAssemblyId =
          res.data?.data?.assemblyId || res.data?.assemblyId || null;
        setSuccessMessage(res.data?.message || "Assembly created.");
      }

      // If any process is Outsourcing, offer the DC handoff
      const outsourced = (cleanProcesses || []).filter(
        (p) => p.executionType === "Outsourcing"
      );

      if (savedAssemblyId && outsourced.length > 0) {
        setOutsourcingHandoff({
          assemblyId: savedAssemblyId,
          processes: outsourced.map((p) => ({
            name: p.name,
            processId: p.processId,
            vendor: p.vendor,
            vendorContact: p.vendorContact,
            vendorLocation: p.vendorLocation,
            expectedReturnDate: p.expectedReturnDate,
          })),
        });
      } else {
        setOutsourcingHandoff(null);
      }

      closeForm();
      await fetchAssemblies({ silent: true });
      await refreshFilterOptions();
    } catch (err) {
      setFormError(getApiError(err, "Failed to save assembly."));
    } finally {
      setSaving(false);
    }
  };

  /* -------- DC handoff -------- */
  const goToDeliveryChallan = () => {
    if (!outsourcingHandoff) return;

    const first = outsourcingHandoff.processes[0];

    const prefill = {
      deliveryAt: first.vendorLocation || "",
      customer: {
        companyName: first.vendor || "",
        address: first.vendorLocation || "",
        phone: first.vendorContact || "",
        returnable: true,
      },
      items: outsourcingHandoff.processes.map((p) => ({
        description: `${outsourcingHandoff.assemblyId} — ${p.name} (${p.processId})`,
        quantity: 1,
        remarks: p.expectedReturnDate
          ? `Expected return ${p.expectedReturnDate}`
          : "",
      })),
    };

    try {
      window.localStorage.setItem(
        "pendingDeliveryChallanPrefill",
        JSON.stringify(prefill)
      );
    } catch (e) {
      console.error("Failed to stage DC prefill:", e);
    }

    navigate(DELIVERY_CHALLAN_ROUTE);
  };

  const requestDelete = (asm) => {
    setDeleteTarget(asm);
    if (asm.status !== "Planned") {
      setDeleteError(
        "This assembly can't be deleted because production has already started on it."
      );
      return;
    }
    setDeleteError("");
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteError) return;
    try {
      await api.delete(`${API_BASE}/assembly/${deleteTarget.assemblyId}/`, {
        headers: authHeaders(),
      });
      setSuccessMessage(`${deleteTarget.assemblyId} deleted.`);
      closeDelete();
      await fetchAssemblies({ silent: true });
      await refreshFilterOptions();
    } catch (err) {
      setDeleteError(getApiError(err, "Delete failed."));
    }
  };

  const handleBack = () => navigate("/inventory/material");

  const historyAssemblies = useMemo(
    () =>
      assemblies
        .filter((a) => !historyProject || a.project === historyProject)
        .slice()
        .sort((a, b) =>
          (a.createdDate || "").localeCompare(b.createdDate || "")
        ),
    [assemblies, historyProject]
  );

  return (
    <>
      <Header />
      <div className="material-page">
        <div className="material-content">

          {/* HEADER */}
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
                  Combine materials — or assemblies you've already built —
                  into a new assembly.
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

          {successMessage && (
            <div className="success-banner success-banner-with-cta">
              <span>✓ {successMessage}</span>

              {outsourcingHandoff && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm dc-handoff-btn"
                  onClick={goToDeliveryChallan}
                >
                  <Truck size={14} />
                  Create Delivery Challan ({outsourcingHandoff.processes.length})
                </button>
              )}

              <button
                type="button"
                className="banner-close"
                onClick={() => {
                  setSuccessMessage("");
                  setOutsourcingHandoff(null);
                }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {historyOpen && (
            <div className="panel history-card">
              <div className="history-header">
                <div>
                  <h3 className="modal-card-title">History</h3>
                  <p className="modal-card-hint">
                    A simple timeline of what happened to each assembly.
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
                    {(filterOptionsMap.project || []).map((p) => (
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
                      <Timeline
                        events={(asm.processes || []).map((p) => ({
                          label: `${p.name} planned`,
                          done: false,
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="grn-state-block">
              <Loading />
            </div>
          )}

          {!loading && error && (
            <div className="grn-state-block">
              <Error onRetry={() => fetchAssemblies()} />
            </div>
          )}

          {!loading && !error && (
            <div className="panel">
              <FilterPanel
                search={search}
                onSearchChange={setSearch}
                filters={filters}
                onFilterChange={(key, value) =>
                  setFilters((f) => ({ ...f, [key]: value }))
                }
                options={filterOptionsMap}
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
                      <th>Inputs</th>
                      <th>Processes</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th className="cell-action">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssemblies.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">
                            <div className="empty-state-icon">🧩</div>
                            <p className="empty-state-title">
                              No assemblies found
                            </p>
                            <p className="empty-state-desc">
                              Create your first assembly by selecting a
                              project and adding materials.
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

                    {filteredAssemblies.map((asm) => (
                      <tr key={asm.assemblyId}>
                        <td
                          className="mono"
                          style={{
                            fontWeight: 600,
                            color: "var(--primary-dark)",
                          }}
                        >
                          {asm.assemblyId}
                        </td>
                        <td>{asm.project}</td>
                        <td>{(asm.inputs || []).length}</td>
                        <td>{(asm.processes || []).length}</td>
                        <td>
                          <StatusBadge status={asm.status} />
                        </td>
                        <td>{asm.createdDate || "—"}</td>
                        <td>
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
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(asm)}
                              className="remove-btn"
                              disabled={asm.status !== "Planned"}
                              title={
                                asm.status === "Planned"
                                  ? "Edit"
                                  : "Locked — production already started"
                              }
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(asm)}
                              className="remove-btn"
                              disabled={asm.status !== "Planned"}
                              title={
                                asm.status === "Planned"
                                  ? "Delete"
                                  : "Locked — production already started"
                              }
                            >
                              <Trash2 size={14} />
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

          {/* EYE VIEW */}
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
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="tabs">
                  {[
                    ["overview", "Overview"],
                    ["materials", "Materials"],
                    ["process", "Process Route"],
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
                  {activeTab === "overview" && (
                    <div className="modal-card">
                      <h3 className="modal-card-title">Overview</h3>
                      <div className="readonly-grid">
                        <ReadonlyField
                          label="Assembly ID"
                          value={viewAssembly.assemblyId}
                        />
                        <ReadonlyField
                          label="Project"
                          value={viewAssembly.project}
                        />
                        <ReadonlyField
                          label="Created"
                          value={viewAssembly.createdDate}
                        />
                        <ReadonlyField
                          label="Status"
                          value={
                            <StatusBadge status={viewAssembly.status} />
                          }
                        />
                        <ReadonlyField
                          label="Inputs"
                          value={(viewAssembly.inputs || []).length}
                        />
                        <ReadonlyField
                          label="Processes"
                          value={(viewAssembly.processes || []).length}
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "materials" && (
                    <div className="modal-card">
                      <h3 className="modal-card-title">Materials</h3>
                      <div className="pieces-table-wrap">
                        <table className="pieces-table">
                          <thead>
                            <tr>
                              <th>Source</th>
                              <th>Material / Assembly</th>
                              <th>Required</th>
                              <th>Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(viewAssembly.inputs || []).map((inp, idx) => (
                              <tr key={idx}>
                                <td>
                                  {inp.sourceType === "assembly"
                                    ? "Assembly"
                                    : "Material"}
                                </td>
                                <td>
                                  {inp.sourceType === "assembly"
                                    ? inp.sourceAssemblyCode
                                    : inp.materialName}
                                </td>
                                <td>{fmt(inp.useQty)}</td>
                                <td>{inp.unit || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === "process" && (
                    <div className="modal-card">
                      <h3 className="modal-card-title">Process Route</h3>
                      <ol className="process-chain">
                        {(viewAssembly.processes || []).map((p, idx) => (
                          <li key={idx}>
                            <span className="process-chain-seq">
                              {idx + 1}
                            </span>
                            <span className="process-chain-name">
                              {p.name}
                            </span>
                            <span className="process-chain-id">
                              {p.processId}
                            </span>
                            <span
                              className={`qc-badge ${
                                p.qcRequired ? "qc-yes" : "qc-no"
                              }`}
                            >
                              {p.qcRequired ? "QC Required" : "No QC"}
                            </span>
                            <span className="exec-badge">
                              {p.executionType === "Outsourcing"
                                ? `Outsourcing — ${p.vendor || "—"}`
                                : `In-House — ${
                                    p.executionUnit || "Unit 1"
                                  }`}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
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

          {/* CREATE / EDIT WIZARD */}
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
                        ? "Follow the steps below — the Assembly ID is generated automatically."
                        : "Inputs, quantities and the process route can still be changed."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="modal-close-btn"
                  >
                    <X size={18} />
                  </button>
                </div>

                <WizardStepper current={wizardStep} />

                <div className="modal-body">
                  {wizardStep === 1 && (
                    <StepProject
                      form={form}
                      onSelect={(p) =>
                        setForm((f) => ({
                          ...f,
                          projectId: p?.id || null,
                          project: p?.code || "",
                          projectName: p?.name || "",
                          inputs: [newInputRow()],
                        }))
                      }
                      disabled={formMode === "edit"}
                      accessToken={accessToken}
                    />
                  )}

                  {wizardStep === 2 && (
                    <StepInputs
                      form={form}
                      sources={sources}
                      sourcesLoading={sourcesLoading}
                      onUpdate={updateInput}
                      onAdd={addInput}
                      onRemove={removeInput}
                      rowStatus={rowStatus}
                      inputErrors={inputErrors}
                    />
                  )}

                  {wizardStep === 3 && (
                    <StepAvailability
                      form={form}
                      rowStatus={rowStatus}
                      inputErrors={inputErrors}
                    />
                  )}

                  {wizardStep === 4 && (
                    <StepProcess
                      form={form}
                      onUpdate={updateProcess}
                      onSetExecutionType={setProcessExecutionType}
                      onUpdateOutsourcing={updateProcessOutsourcing}
                      onAdd={addProcess}
                      onRemove={removeProcess}
                      onMove={moveProcess}
                    />
                  )}

                  {wizardStep === 5 && (
                    <StepReview
                      form={form}
                      rowStatus={rowStatus}
                      inputErrors={inputErrors}
                    />
                  )}

                  {formError && <div className="error-box">{formError}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="btn btn-secondary"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="btn btn-secondary"
                      disabled={saving}
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
                      title={
                        wizardStep === 2 && hasInputErrors
                          ? "Fix the quantity errors above first"
                          : undefined
                      }
                    >
                      Next
                    </button>
                  )}
                  {wizardStep === 5 && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={saving || hasInputErrors}
                      className="btn btn-primary"
                    >
                      {saving
                        ? "Saving…"
                        : formMode === "create"
                          ? "Create Assembly"
                          : "Save Changes"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION */}
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
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  {deleteError ? (
                    <div className="error-box">{deleteError}</div>
                  ) : (
                    <p className="confirm-text">
                      This assembly has not started production. It can be
                      safely deleted, and its materials will go back to
                      being available.
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

/* ================================================================== */
/* STEP 1 — PROJECT PICKER                                             */
/* ================================================================== */
function StepProject({ form, onSelect, disabled, accessToken }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await api.get(`${API_BASE}/assembly/projects/`, {
          params: { search: query.trim() || undefined },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        if (!cancelled) {
          setOptions(list.slice(0, 30));
          setHighlight(0);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, accessToken]);

  const pick = (p) => {
    onSelect(p);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="modal-card">
      <h3 className="modal-card-title">Select Project</h3>
      <p className="modal-card-hint">
        Only projects with material already issued to production can be
        assembled. Pick the project you want to build from.
      </p>

      <div
        className="form-field"
        style={{ maxWidth: 460, position: "relative" }}
      >
        <label>Project</label>

        {form.projectId ? (
          <div className="project-chip">
            <span className="project-chip-code">{form.project}</span>
            <span className="project-chip-name">{form.projectName}</span>
            {!disabled && (
              <button
                type="button"
                className="project-chip-clear"
                onClick={() => onSelect(null)}
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search project by code or name..."
              value={query}
              disabled={disabled}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
            />

            {open && (
              <div className="project-picker-menu">
                {loading && (
                  <div className="project-picker-msg">Searching…</div>
                )}

                {!loading && options.length === 0 && (
                  <div className="project-picker-msg">
                    No project with issued production matches “{query}”.
                  </div>
                )}

                {!loading &&
                  options.map((p, i) => {
                    const available = Number(p.availableQty || 0);
                    const received = Number(p.receivedQty || 0);
                    const isFull = available <= 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isFull}
                        className={`project-picker-item ${
                          i === highlight ? "is-highlight" : ""
                        } ${isFull ? "is-disabled" : ""}`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => !isFull && pick(p)}
                        title={
                          isFull
                            ? "All material for this project is already allocated"
                            : undefined
                        }
                      >
                        <span className="project-picker-code">
                          {p.code}
                        </span>
                        <span className="project-picker-name">
                          {p.name}
                        </span>
                        <span className="project-picker-qty">
                          {available} available
                          {received ? ` of ${received}` : ""}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* STEP 2 — INPUTS                                                     */
/* ================================================================== */
function StepInputs({
  form,
  sources,
  sourcesLoading,
  onUpdate,
  onAdd,
  onRemove,
  rowStatus,
  inputErrors,
}) {
  return (
    <div className="modal-card">
      <h3 className="modal-card-title">Add Assembly Inputs</h3>
      <p className="modal-card-hint">
        Pick materials received from Job Work, or assemblies you've already
        built in this project. Mix freely. The quantity you enter cannot
        exceed what's currently available.
      </p>

      {sourcesLoading && (
        <p className="modal-card-hint">Loading sources…</p>
      )}

      <div className="input-list">
        {form.inputs.map((row, idx) => {
          const st = rowStatus(row, form.inputs);
          const { available, required, pending, remaining, status, disp } =
            st;
          const rowErr = inputErrors[row.rowId];

          const mat =
            row.sourceType === "material" && row.sourceId
              ? sources.materials.find(
                  (m) => String(m.id) === String(row.sourceId)
                )
              : null;

          const nested =
            row.sourceType === "assembly" && row.sourceId
              ? sources.assemblies.find(
                  (a) => String(a.id) === String(row.sourceId)
                )
              : null;

          return (
            <div
              className={`input-card ${
                rowErr ? "input-card-error" : ""
              }`}
              key={row.rowId}
            >
              <div className="input-card-top">
                <span className="input-card-index">Input {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => onRemove(row.rowId)}
                  disabled={form.inputs.length === 1}
                  className="remove-btn"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${
                    row.sourceType === "material" ? "toggle-active" : ""
                  }`}
                  onClick={() =>
                    onUpdate(row.rowId, "sourceType", "material")
                  }
                >
                  Material
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${
                    row.sourceType === "assembly" ? "toggle-active" : ""
                  }`}
                  onClick={() =>
                    onUpdate(row.rowId, "sourceType", "assembly")
                  }
                >
                  Existing Assembly
                </button>
              </div>

              <div className="form-field">
                <label>
                  {row.sourceType === "material" ? "Material" : "Assembly"}
                </label>
                <select
                  value={row.sourceId}
                  onChange={(e) =>
                    onUpdate(row.rowId, "sourceId", e.target.value)
                  }
                >
                  <option value="">
                    Select {row.sourceType}
                  </option>
                  {row.sourceType === "material"
                    ? sources.materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.materialName} ({m.materialCode}) —{" "}
                          {m.availableQty} {m.unit}
                        </option>
                      ))
                    : sources.assemblies.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.assemblyId} — {a.availableQty} available
                        </option>
                      ))}
                </select>

                {row.sourceType === "material" &&
                  !sourcesLoading &&
                  sources.materials.length === 0 && (
                    <span className="form-hint">
                      No received materials available in this project.
                    </span>
                  )}

                {row.sourceType === "assembly" &&
                  !sourcesLoading &&
                  sources.assemblies.length === 0 && (
                    <span className="form-hint">
                      No assemblies available in this project.
                    </span>
                  )}
              </div>

              {mat && (
                <div className="auto-detail">
                  <DetailChip label="DWG" value={mat.drawingNumber} />
                  <DetailChip label="Thickness" value={mat.thickness} />
                  <DetailChip
                    label="Size"
                    value={
                      mat.length && mat.width
                        ? `${mat.length} × ${mat.width}`
                        : "—"
                    }
                  />
                  <DetailChip
                    label="Available"
                    value={`${available} ${mat.unit}`}
                  />
                </div>
              )}

              {nested && (
                <div className="auto-detail">
                  <DetailChip
                    label="Assembly ID"
                    value={nested.assemblyId}
                  />
                  <DetailChip
                    label="Available"
                    value={`${available} unit(s)`}
                  />
                </div>
              )}

              {row.sourceId && (
                <div className="form-field qty-field">
                  <label>Use for Assembly</label>
                  <input
                    type="number"
                    min="1"
                    max={remaining > 0 ? remaining : undefined}
                    placeholder="0"
                    value={row.useQty}
                    onChange={(e) =>
                      onUpdate(row.rowId, "useQty", e.target.value)
                    }
                    className={rowErr ? "input-error" : ""}
                  />
                  {remaining > 0 && (
                    <span className="form-hint">
                      Max {fmt(remaining)} {disp?.unit}
                      {st.claimedElsewhere > 0
                        ? ` (${fmt(st.claimedElsewhere)} already allocated on other rows)`
                        : ""}
                    </span>
                  )}
                </div>
              )}

              {row.sourceId && row.useQty !== "" && !rowErr && (
                <p
                  className={`remaining-note ${
                    status !== "available" ? "remaining-warning" : ""
                  }`}
                >
                  {status === "available" && (
                    <>
                      Remaining after this:{" "}
                      <strong>{fmt(st.balance)}</strong> {disp?.unit}
                    </>
                  )}
                  {status !== "available" && (
                    <>
                      ⚠ {fmt(pending)} {disp?.unit} still pending. Reduce
                      the quantity to fit what's available right now, or
                      remove this input.
                    </>
                  )}
                </p>
              )}

              {rowErr && (
                <div className="inline-error">
                  <AlertTriangle size={14} />
                  <span>{rowErr}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="btn-link add-input-btn"
      >
        + Add Material / Assembly
      </button>
    </div>
  );
}

/* ================================================================== */
/* STEP 3 — AVAILABILITY                                               */
/* ================================================================== */
function StepAvailability({ form, rowStatus, inputErrors }) {
  const rows = form.inputs.filter(
    (r) => r.sourceId && r.useQty !== ""
  );

  const anyPending = rows.some(
    (r) => rowStatus(r, form.inputs).status !== "available"
  );

  return (
    <div className="modal-card">
      <h3 className="modal-card-title">Material Availability</h3>
      <p className="modal-card-hint">
        Here's what's on hand right now and what's still pending.
      </p>

      <div className="availability-list">
        {rows.map((row) => {
          const { disp, available, required, pending, status, error } =
            rowStatus(row, form.inputs);
          return (
            <div
              className={`availability-row ${
                error ? "availability-row-error" : ""
              }`}
              key={row.rowId}
            >
              <div className="availability-row-head">
                <span className="availability-name">{disp?.name}</span>
                <AvailabilityStatusBadge status={status} />
              </div>
              <div className="availability-numbers">
                <span>
                  Required <strong>{fmt(required)}</strong>
                </span>
                <span>
                  Available <strong>{fmt(available)}</strong>
                </span>
                <span>
                  Pending <strong>{fmt(pending)}</strong>
                </span>
              </div>
              {error && (
                <div className="inline-error">
                  <AlertTriangle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyPending || Object.keys(inputErrors).length > 0 ? (
        <div className="info-note info-note-warning">
          Some inputs exceed availability. Please go back to Inputs and
          adjust the quantities. You cannot continue until every input fits
          within the material currently on hand.
        </div>
      ) : (
        <div className="info-note info-note-success">
          Everything you've added is fully available right now.
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* STEP 4 — PROCESS                                                    */
/* ================================================================== */
function StepProcess({
  form,
  onUpdate,
  onSetExecutionType,
  onUpdateOutsourcing,
  onAdd,
  onRemove,
  onMove,
}) {
  return (
    <div className="modal-card">
      <h3 className="modal-card-title">Production Process</h3>
      <p className="modal-card-hint">
        Add the production steps in the order they should be completed, and
        mark which ones need QC. The Process ID is generated automatically
        from the name — you can still edit it if you want.
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
                    onUpdate(process.rowId, "name", e.target.value)
                  }
                />
              </div>
              <div className="form-field">
                <label>Process ID</label>
                <input
                  placeholder="e.g. FIT-001"
                  value={process.processId}
                  onChange={(e) =>
                    onUpdate(process.rowId, "processId", e.target.value)
                  }
                />
              </div>
              <div className="form-field">
                <label>QC Required</label>
                <select
                  value={process.qcRequired ? "yes" : "no"}
                  onChange={(e) =>
                    onUpdate(
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

            <div className="process-execution">
              <div className="form-field">
                <label>Execution Type</label>
                <div className="segment-toggle">
                  <button
                    type="button"
                    className={`segment-btn ${
                      process.executionType === "In-House"
                        ? "segment-btn-active"
                        : ""
                    }`}
                    onClick={() =>
                      onSetExecutionType(process.rowId, "In-House")
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
                      onSetExecutionType(process.rowId, "Outsourcing")
                    }
                  >
                    <Truck size={14} /> Outsourcing
                  </button>
                </div>
              </div>

              {process.executionType === "In-House" ? (
                <div className="form-field">
                  <label>Execution Unit</label>
                  <div className="segment-toggle">
                    {["Unit 1", "Unit 2"].map((u) => (
                      <button
                        key={u}
                        type="button"
                        className={`segment-btn ${
                          process.executionUnit === u
                            ? "segment-btn-active"
                            : ""
                        }`}
                        onClick={() =>
                          onUpdate(process.rowId, "executionUnit", u)
                        }
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="outsourcing-block">
                  <div className="outsourcing-block-title">
                    Outsourcing Details
                  </div>

                  <div className="form-field">
                    <label>Vendor</label>
                    <input
                      type="text"
                      placeholder="Enter vendor name"
                      value={process.outsourcing?.vendor || ""}
                      onChange={(e) =>
                        onUpdateOutsourcing(
                          process.rowId,
                          "vendor",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-field">
                      <label>Vendor Contact</label>
                      <input
                        type="text"
                        placeholder="Phone / email"
                        value={process.outsourcing?.vendorContact || ""}
                        onChange={(e) =>
                          onUpdateOutsourcing(
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
                        type="text"
                        placeholder="City"
                        value={process.outsourcing?.vendorLocation || ""}
                        onChange={(e) =>
                          onUpdateOutsourcing(
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
                        value={process.outsourcing?.expectedReturnDate || ""}
                        onChange={(e) =>
                          onUpdateOutsourcing(
                            process.rowId,
                            "expectedReturnDate",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label>Remarks</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={process.outsourcing?.remarks || ""}
                        onChange={(e) =>
                          onUpdateOutsourcing(
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
                onClick={() => onMove(process.rowId, "up")}
                disabled={idx === 0}
                className="order-btn"
                title="Move Up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onMove(process.rowId, "down")}
                disabled={idx === form.processes.length - 1}
                className="order-btn"
                title="Move Down"
              >
                ▼
              </button>
            </div>

            <button
              type="button"
              onClick={() => onRemove(process.rowId)}
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
        onClick={onAdd}
        className="btn-link add-input-btn"
      >
        + Add Another Process
      </button>
    </div>
  );
}

/* ================================================================== */
/* STEP 5 — REVIEW                                                     */
/* ================================================================== */
function StepReview({ form, rowStatus, inputErrors }) {
  const hasErrors = Object.keys(inputErrors).length > 0;

  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Assembly Review</h3>
        <p className="modal-card-hint">
          Take a moment to check everything below before creating the
          assembly.
        </p>

        <div className="readonly-grid">
          <ReadonlyField label="Project" value={form.project || "—"} />
          <ReadonlyField
            label="Inputs"
            value={form.inputs.filter((r) => r.sourceId).length}
          />
          <ReadonlyField
            label="Processes"
            value={form.processes.length}
          />
        </div>

        <h4 className="review-subhead">Inputs</h4>
        <ul className="review-list">
          {form.inputs
            .filter((r) => r.sourceId && r.useQty !== "")
            .map((row) => {
              const { disp, status, pending, required, error } = rowStatus(
                row,
                form.inputs
              );
              return (
                <li key={row.rowId}>
                  {error ? "✗" : status === "available" ? "✓" : "⚠"}{" "}
                  {disp?.name} — {fmt(required)} {disp?.unit}
                  {status !== "available" && (
                    <span className="review-pending">
                      {" "}
                      ({fmt(pending)} pending)
                    </span>
                  )}
                  {error && (
                    <span
                      className="review-pending"
                      style={{ color: "var(--danger)" }}
                    >
                      {" "}
                      — {error}
                    </span>
                  )}
                </li>
              );
            })}
        </ul>

        <h4 className="review-subhead">Process Route</h4>
        <ol className="review-process-list">
          {form.processes
            .filter((p) => p.name.trim() && p.processId.trim())
            .map((p) => (
              <li key={p.rowId}>
                {p.name}
                <span
                  className="mono"
                  style={{
                    marginLeft: 8,
                    fontWeight: 600,
                    color: "var(--primary-dark)",
                  }}
                >
                  ({p.processId})
                </span>
                {p.qcRequired && (
                  <span
                    className="qc-badge qc-yes"
                    style={{ marginLeft: 8 }}
                  >
                    QC
                  </span>
                )}
                <span className="exec-badge" style={{ marginLeft: 8 }}>
                  {p.executionType === "Outsourcing"
                    ? `Outsourcing — ${
                        p.outsourcing?.vendor || "No vendor entered"
                      }`
                    : `In-House — ${p.executionUnit || "Unit 1"}`}
                </span>
              </li>
            ))}
        </ol>
      </div>

      {hasErrors && (
        <div className="error-box">
          Some inputs exceed the available quantity. Go back to step 2 and
          correct them before creating the assembly.
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/* SHARED BITS                                                         */
/* ================================================================== */
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
                  onChange={(e) =>
                    onFilterChange(f.key, e.target.value)
                  }
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
                  onChange={(e) =>
                    onFilterChange(f.key, e.target.value)
                  }
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

function DetailChip({ label, value }) {
  return (
    <div className="detail-chip">
      <span className="detail-chip-label">{label}</span>
      <span className="detail-chip-value">{value}</span>
    </div>
  );
}

function ReadonlyField({ label, value }) {
  return (
    <div className="readonly-field">
      <label className="readonly-label">{label}</label>
      <div className="readonly-value">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Planned: "status-badge-info",
    "In Progress": "status-badge-warning",
    Completed: "status-badge-success",
    Cancelled: "status-badge-danger",
  };
  return (
    <span className={`status-badge ${map[status] || ""}`}>{status}</span>
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