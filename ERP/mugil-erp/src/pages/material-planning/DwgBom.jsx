import { useCallback, useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import "./DwgBom.css";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ---------------------------------------------------------------------
// API BASE
// ---------------------------------------------------------------------
const API_BASE = "/erp/material";

// Max options rendered inside the project dropdown at once
const PROJECT_OPTIONS_LIMIT = 50;

// ---------------------------------------------------------------------
// ERROR HELPER
// ---------------------------------------------------------------------
function getApiError(error, fallback = "Something went wrong. Please try again.") {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const firstFieldError = Object.values(data)
      .flat()
      .find((value) => typeof value === "string");
    if (firstFieldError) return firstFieldError;
  }
  if (error?.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------
// UNWRAP HELPERS
// ---------------------------------------------------------------------
function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

function unwrapObject(payload) {
  if (!payload) return null;
  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return payload.data;
  }
  return payload;
}

// ---------------------------------------------------------------------
// SAFE STRING
// ---------------------------------------------------------------------
function toDisplayString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "object") {
    const candidate =
      value.name || value.label || value.title || value.code || value.description;
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    const parts = Object.values(value)
      .filter((v) => typeof v === "string" && v.trim())
      .slice(0, 2);
    return parts.join(" — ") || "—";
  }
  return String(value);
}

// ---------------------------------------------------------------------
// DESCRIPTION HELPERS
// Description is a JSON object on the backend:
//   { materialType, thickness, length, width, grade, remarks }
// ---------------------------------------------------------------------
const EMPTY_DESCRIPTION = {
  materialType: "",
  thickness: "",
  length: "",
  width: "",
  grade: "",
  remarks: "",
};

function normalizeDescriptionFromApi(raw) {
  if (raw == null) return { ...EMPTY_DESCRIPTION };

  // Legacy plain string
  if (typeof raw === "string") {
    return { ...EMPTY_DESCRIPTION, remarks: raw };
  }

  if (typeof raw !== "object") return { ...EMPTY_DESCRIPTION };

  return {
    materialType: raw.materialType ?? raw.material_type ?? "",
    thickness:
      raw.thickness != null && raw.thickness !== "" ? String(raw.thickness) : "",
    length:
      raw.length != null && raw.length !== "" ? String(raw.length) : "",
    width:
      raw.width != null && raw.width !== "" ? String(raw.width) : "",
    grade: raw.grade ?? "",
    remarks: raw.remarks ?? "",
  };
}

function buildDescriptionPayload(desc) {
  const d = desc || {};
  const out = {};

  if (d.materialType?.trim()) out.materialType = d.materialType.trim();
  if (d.thickness !== "" && d.thickness != null) out.thickness = Number(d.thickness) || 0;
  if (d.length !== "" && d.length != null) out.length = Number(d.length) || 0;
  if (d.width !== "" && d.width != null) out.width = Number(d.width) || 0;
  if (d.grade?.trim()) out.grade = d.grade.trim();
  if (d.remarks?.trim()) out.remarks = d.remarks.trim();

  return out;
}

// ---------------------------------------------------------------------
// MAPPERS
// ---------------------------------------------------------------------
function mapProjectFromApi(p) {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description || "",
    status: p.status,
    startDate: p.startDate || "",
    endDate: p.endDate || "",
  };
}

function mapDrawingFromApi(d) {
  return {
    id: d.id,
    projectId: d.projectId,
    dwgNumber: d.dwgNumber,
    name: d.name,
    revision: d.revision,
    date: d.date || "",
    file: d.file || "",
    remarks: d.remarks || "",
  };
}

function mapBomFromApi(b) {
  return {
    id: b.id,
    drawingId: b.drawingId,
    variantNumber: b.variantNumber || "",
    itemNumber: b.itemNumber || "",
    description: normalizeDescriptionFromApi(b.description),
    std: b.std || "-",
    drawingNumber: b.drawingNumber || "-",
    itemNo: b.itemNo || "",
    varNo: b.varNo || "-",
    materialCode: b.materialCode,
    materialSpecn: b.materialSpecn || "",
    acp: b.acp || "-",
    di: b.di || "-",
    unit: b.unit || "Nos",
    unitWeight: Number(b.unitWeight) || 0,
    quantity: Number(b.quantity) || 0,
  };
}

// ---------------------------------------------------------------------
// COLUMNS
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// EMPTY FORMS
// ---------------------------------------------------------------------
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
  description: { ...EMPTY_DESCRIPTION },
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

// ---------------------------------------------------------------------
// SMALL UI COMPONENTS
// ---------------------------------------------------------------------
function StatusBadge({ status, tone }) {
  const STATUS_STYLES = {
    Active: "success",
    "On Hold": "neutral",
    Completed: "success",
  };
  const resolvedTone = tone || STATUS_STYLES[status] || "neutral";
  return (
    <span className={`status-badge status-badge-${resolvedTone}`}>{status}</span>
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
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
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

// ---------------------------------------------------------------------
// DESCRIPTION CELL — renders the structured JSON in the table
// ---------------------------------------------------------------------
function DescriptionCell({ description }) {
  const d = description || {};
  const mt = d.materialType?.trim();
  const t = d.thickness;
  const l = d.length;
  const w = d.width;
  const grade = d.grade?.trim();
  const remarks = d.remarks?.trim();

  const dims = [t, l, w].filter((v) => v !== "" && v != null && v !== undefined);

  if (!mt && dims.length === 0 && !grade && !remarks) {
    return <span className="cell-muted">—</span>;
  }

  return (
    <span>
      {mt && <strong>{mt} </strong>}
      {dims.length > 0 && <span>{dims.join(" × ")}</span>}
      {grade && <span className="cell-muted"> · {grade}</span>}
      {remarks && <span className="cell-muted"> · {remarks}</span>}
    </span>
  );
}

function PageShell({ children }) {
  return (
    <>
      <Header />
      <div className="page-shell">
        <div className="page-shell-main">
          <div className="page-shell-content">{children}</div>
        </div>
      </div>
    </>
  );
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function DwgBom() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  // ---------------- DATA ----------------
  const [projectsList, setProjectsList] = useState([]);
  const [drawingsList, setDrawingsList] = useState([]);
  const [bomList, setBomList] = useState([]);

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // ---------------- MODALS ----------------
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

  // ---------------- AUTH ----------------
  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  // ===============================================================
  // FETCHERS
  // ===============================================================
  const fetchProjects = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        setError("");
        const res = await api.get(`${API_BASE}/projects/`, {
          headers: authHeaders(),
        });

        const rawList = unwrapList(res.data);
        const mapped = rawList.map(mapProjectFromApi);
        setProjectsList(mapped);

        if (mapped.length > 0) {
          setSelectedProjectId((prev) =>
            prev != null && mapped.some((p) => Number(p.id) === Number(prev))
              ? Number(prev)
              : Number(mapped[0].id),
          );
        } else {
          setSelectedProjectId(null);
          setSelectedDrawingId(null);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
        setError(getApiError(err, "Failed to load projects."));
        setProjectsList([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders],
  );

  const fetchDrawings = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!accessToken || projectId == null) {
        setDrawingsList([]);
        setSelectedDrawingId(null);
        return;
      }
      try {
        if (!silent) setIsLoading(true);
        setError("");
        const res = await api.get(`${API_BASE}/drawings/`, {
          headers: authHeaders(),
          params: { projectId },
        });

        const rawList = unwrapList(res.data);
        const mapped = rawList.map(mapDrawingFromApi);
        setDrawingsList(mapped);

        setSelectedDrawingId((prev) =>
          prev != null && mapped.some((d) => Number(d.id) === Number(prev))
            ? Number(prev)
            : mapped[0]?.id != null
              ? Number(mapped[0].id)
              : null,
        );
      } catch (err) {
        console.error("Failed to load drawings:", err);
        setError(getApiError(err, "Failed to load drawings."));
        setDrawingsList([]);
        setSelectedDrawingId(null);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders],
  );

  const fetchBom = useCallback(
    async (drawingId, { silent = false } = {}) => {
      if (!accessToken || drawingId == null) {
        setBomList([]);
        return;
      }
      try {
        if (!silent) setIsLoading(true);
        setError("");
        const res = await api.get(`${API_BASE}/bom-items/`, {
          headers: authHeaders(),
          params: { drawingId },
        });

        const rawList = unwrapList(res.data);
        setBomList(rawList.map(mapBomFromApi));
      } catch (err) {
        console.error("Failed to load BOM:", err);
        setError(getApiError(err, "Failed to load BOM items."));
        setBomList([]);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [accessToken, authHeaders],
  );

  // ===============================================================
  // EFFECTS
  // ===============================================================
  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setIsLoading(false);
      return;
    }
    fetchProjects();
  }, [accessToken, fetchProjects]);

  useEffect(() => {
    if (selectedProjectId != null) fetchDrawings(selectedProjectId);
  }, [selectedProjectId, fetchDrawings]);

  useEffect(() => {
    if (selectedDrawingId != null) fetchBom(selectedDrawingId);
    else setBomList([]);
  }, [selectedDrawingId, fetchBom]);

  // ===============================================================
  // DERIVED
  // ===============================================================
  const selectedProject = projectsList.find(
    (p) => String(p.id) === String(selectedProjectId),
  );
  const projectDrawings = drawingsList;
  const selectedDrawing = drawingsList.find(
    (d) => String(d.id) === String(selectedDrawingId),
  );
  const drawingBom = bomList;

  // Filtered project dropdown options
  const filteredProjectOptions = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();

    let matches = projectsList;
    if (term) {
      matches = projectsList.filter((p) => {
        const haystack = [p.name, p.code, p.description]
          .map(toDisplayString)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    const selected = projectsList.find(
      (p) => String(p.id) === String(selectedProjectId),
    );

    let options = matches;
    if (
      selected &&
      !options.some((p) => String(p.id) === String(selected.id))
    ) {
      options = [selected, ...options];
    }

    if (options.length > PROJECT_OPTIONS_LIMIT) {
      options = options.slice(0, PROJECT_OPTIONS_LIMIT);
    }

    return options;
  }, [projectsList, projectSearch, selectedProjectId]);

  const projectMatchCount = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) return projectsList.length;
    return projectsList.filter((p) => {
      const haystack = [p.name, p.code, p.description]
        .map(toDisplayString)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    }).length;
  }, [projectsList, projectSearch]);

  // BOM filter options
  const unitOptions = useMemo(
    () => [...new Set(drawingBom.map((b) => b.unit))].filter(Boolean),
    [drawingBom],
  );
  const materialCodeOptions = useMemo(
    () => [...new Set(drawingBom.map((b) => b.materialCode))].filter(Boolean),
    [drawingBom],
  );
  const materialSpecOptions = useMemo(
    () => [...new Set(drawingBom.map((b) => b.materialSpecn))].filter(Boolean),
    [drawingBom],
  );

  const filteredBom = drawingBom.filter((item) => {
    const q = bomSearch.trim().toLowerCase();
    const d = item.description || {};
    const descText = [
      d.materialType,
      d.thickness,
      d.length,
      d.width,
      d.grade,
      d.remarks,
    ]
      .filter(Boolean)
      .join(" ");

    const matchesSearch =
      !q ||
      [descText, item.materialCode, item.materialSpecn, item.itemNumber]
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

  // ===============================================================
  // REFRESH
  // ===============================================================
  async function handleRefresh() {
    setRefreshing(true);
    await fetchProjects({ silent: true });
    if (selectedProjectId != null)
      await fetchDrawings(selectedProjectId, { silent: true });
    if (selectedDrawingId != null)
      await fetchBom(selectedDrawingId, { silent: true });
    setRefreshing(false);
    showToast("Refreshed");
  }

  // ===============================================================
  // PROJECT ACTIONS
  // ===============================================================
  function selectProject(id) {
    setSelectedProjectId(id === "" ? null : Number(id));
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

  async function handleAddProject() {
    if (!validateProject() || saving) return;
    setSaving(true);
    try {
      const res = await api.post(
        `${API_BASE}/projects/`,
        {
          name: projectForm.name.trim(),
          code: projectForm.code.trim(),
          description: projectForm.description || "",
          status: projectForm.status,
          startDate: projectForm.startDate || null,
          endDate: projectForm.endDate || null,
        },
        { headers: authHeaders() },
      );

      const rawProject = unwrapObject(res.data);
      const newProject = mapProjectFromApi(rawProject);

      setProjectsList((prev) => [newProject, ...prev]);
      setSelectedProjectId(Number(newProject.id));
      setProjectSearch("");
      setShowAddProject(false);
      setProjectForm(emptyProjectForm);
      setProjectErrors({});
      showToast(`Project "${newProject.name}" created`);
    } catch (err) {
      console.error("Create project failed:", err);
      setProjectErrors({
        submit: getApiError(err, "Failed to create project."),
      });
    } finally {
      setSaving(false);
    }
  }

  // ===============================================================
  // DRAWING ACTIONS
  // ===============================================================
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

  async function handleAddDrawing() {
    if (!validateDrawing() || saving || selectedProjectId == null) return;
    setSaving(true);
    try {
      const res = await api.post(
        `${API_BASE}/drawings/`,
        {
          projectId: selectedProjectId,
          dwgNumber: drawingForm.dwgNumber.trim(),
          name: drawingForm.name.trim(),
          revision: drawingForm.revision.trim(),
          date: drawingForm.date || null,
          file: drawingForm.file || "",
          remarks: drawingForm.remarks || "",
        },
        { headers: authHeaders() },
      );

      const rawDrawing = unwrapObject(res.data);
      const newDrawing = mapDrawingFromApi(rawDrawing);

      setDrawingsList((prev) => [newDrawing, ...prev]);
      setSelectedDrawingId(Number(newDrawing.id));
      setShowAddDrawing(false);
      setDrawingForm(emptyDrawingForm);
      setDrawingErrors({});
      showToast(`Drawing "${newDrawing.dwgNumber}" added`);
    } catch (err) {
      console.error("Create drawing failed:", err);
      setDrawingErrors({
        submit: getApiError(err, "Failed to create drawing."),
      });
    } finally {
      setSaving(false);
    }
  }

  // ===============================================================
  // BOM ACTIONS
  // ===============================================================
  function openAddBom() {
    setEditingBomId(null);
    setBomForm({
      ...emptyBomForm,
      description: { ...EMPTY_DESCRIPTION },
    });
    setBomErrors({});
    setBomModalOpen(true);
  }

  function openEditBom(item) {
    setEditingBomId(item.id);
    setBomForm({
      ...item,
      description: normalizeDescriptionFromApi(item.description),
      unitWeight: String(item.unitWeight),
      quantity: String(item.quantity),
    });
    setBomErrors({});
    setBomModalOpen(true);
  }

  function validateBom() {
    const errs = {};
    const d = bomForm.description || {};

    const hasAnyDesc =
      d.materialType?.trim() ||
      (d.thickness !== "" && d.thickness != null) ||
      (d.length !== "" && d.length != null) ||
      (d.width !== "" && d.width != null) ||
      d.grade?.trim() ||
      d.remarks?.trim();

    if (!hasAnyDesc)
      errs.description =
        "Enter at least one field: material type, thickness, length, width, grade, or remarks.";

    if (!bomForm.materialCode.trim())
      errs.materialCode = "Material Code is required";
    if (!bomForm.unit.trim()) errs.unit = "Unit is required";

    const qty = Number(bomForm.quantity);
    if (!bomForm.quantity || qty <= 0)
      errs.quantity = "Quantity must be greater than 0";

    setBomErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Update a single description sub-field
  function setBomDescriptionField(field, value) {
    setBomForm((prev) => ({
      ...prev,
      description: { ...prev.description, [field]: value },
    }));
  }

  async function handleSaveBomItem() {
    if (!validateBom() || saving || selectedDrawingId == null) return;
    setSaving(true);

    const payload = {
      drawingId: selectedDrawingId,
      variantNumber: bomForm.variantNumber || "",
      itemNumber: bomForm.itemNumber || "",
      description: buildDescriptionPayload(bomForm.description),
      std: bomForm.std || "-",
      drawingNumber: bomForm.drawingNumber || "-",
      itemNo: bomForm.itemNo || "",
      varNo: bomForm.varNo || "-",
      materialCode: bomForm.materialCode.trim(),
      materialSpecn: bomForm.materialSpecn || "",
      acp: bomForm.acp || "-",
      di: bomForm.di || "-",
      unit: bomForm.unit,
      unitWeight: Number(bomForm.unitWeight) || 0,
      quantity: Number(bomForm.quantity),
    };

    try {
      if (editingBomId) {
        const res = await api.patch(
          `${API_BASE}/bom-items/${editingBomId}/`,
          payload,
          { headers: authHeaders() },
        );
        const rawItem = unwrapObject(res.data);
        const updated = mapBomFromApi(rawItem);
        setBomList((prev) =>
          prev.map((b) => (b.id === editingBomId ? updated : b)),
        );
        showToast("BOM item updated");
      } else {
        const res = await api.post(`${API_BASE}/bom-items/`, payload, {
          headers: authHeaders(),
        });
        const rawItem = unwrapObject(res.data);
        const created = mapBomFromApi(rawItem);
        setBomList((prev) => [...prev, created]);
        showToast("BOM item added");
      }
      setBomModalOpen(false);
    } catch (err) {
      console.error("Save BOM failed:", err);
      setBomErrors({ submit: getApiError(err, "Failed to save BOM item.") });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBom() {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      await api.delete(`${API_BASE}/bom-items/${deleteTarget.id}/`, {
        headers: authHeaders(),
      });
      setBomList((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      showToast("BOM item deleted");
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete BOM failed:", err);
      showToast(getApiError(err, "Failed to delete BOM item."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAllBom() {
    if (selectedDrawingId == null || saving) return;
    setSaving(true);
    try {
      const items = bomList
        .filter((b) => String(b.drawingId) === String(selectedDrawingId))
        .map((b) => ({
          id: b.id,
          variantNumber: b.variantNumber,
          itemNumber: b.itemNumber,
          description: buildDescriptionPayload(b.description),
          std: b.std,
          drawingNumber: b.drawingNumber,
          itemNo: b.itemNo,
          varNo: b.varNo,
          materialCode: b.materialCode,
          materialSpecn: b.materialSpecn,
          acp: b.acp,
          di: b.di,
          unit: b.unit,
          unitWeight: b.unitWeight,
          quantity: b.quantity,
        }));

      const res = await api.post(
        `${API_BASE}/bom/batch-save/`,
        { drawingId: selectedDrawingId, items },
        { headers: authHeaders() },
      );

      showToast(res.data?.message || "BOM saved");
      await fetchBom(selectedDrawingId, { silent: true });
    } catch (err) {
      console.error("Batch save failed:", err);
      showToast(getApiError(err, "Failed to save BOM."));
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    navigate("/inventory/material");
  }

  // ===============================================================
  // RENDER
  // ===============================================================
  return (
    <PageShell>
      {/* Page Header */}
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
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
        >
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {error && !isLoading && (
        <div style={{ marginBottom: 16 }}>
          <Error onRetry={() => fetchProjects()} />
        </div>
      )}

      {!error && (
        <>
          {/* ============ Project Panel ============ */}
          <section className="panel">
            <div className="panel-head">
              <div className="panel-head-title">
                <FolderKanban size={16} strokeWidth={1.8} /> Project
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddProject(true)}
                disabled={isLoading}
              >
                <Plus size={14} /> Add Project
              </button>
            </div>
            <div className="panel-body">
              {/* Filter */}
              <div className="dwgbom-select-project">
                <label>
                  Search Project
                  {projectSearch.trim() && (
                    <span className="dwgbom-match-count">
                      {" "}
                      — {projectMatchCount} match
                      {projectMatchCount === 1 ? "" : "es"}
                      {projectMatchCount > PROJECT_OPTIONS_LIMIT &&
                        ` (showing first ${PROJECT_OPTIONS_LIMIT})`}
                    </span>
                  )}
                </label>
                <div className="dwgbom-project-search">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Filter by project name, code, or description..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    disabled={isLoading || projectsList.length === 0}
                  />
                  {projectSearch && (
                    <button
                      type="button"
                      className="dwgbom-project-search-clear"
                      onClick={() => setProjectSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Select */}
              <div className="dwgbom-select-project">
                <label>Select Existing Project</label>
                <select
                  value={
                    selectedProjectId != null ? String(selectedProjectId) : ""
                  }
                  onChange={(e) => selectProject(e.target.value)}
                  disabled={isLoading || filteredProjectOptions.length === 0}
                >
                  {filteredProjectOptions.length === 0 && (
                    <option value="">
                      {projectsList.length === 0
                        ? "No projects available"
                        : "No projects match your search"}
                    </option>
                  )}
                  {filteredProjectOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProject && (
                <div className="dwgbom-project-summary">
                  <div>
                    <span className="dwgbom-project-name">
                      {toDisplayString(selectedProject.name)}
                    </span>{" "}
                    <span className="dwgbom-project-code mono">
                      {toDisplayString(selectedProject.code)}
                    </span>
                  </div>
                  <p className="dwgbom-project-desc">
                    {toDisplayString(selectedProject.description) || "—"}
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

          {/* ============ Drawing Panel ============ */}
          {selectedProject && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-head-title">
                    <FileStack size={16} strokeWidth={1.8} /> Drawings
                  </div>
                  <p className="panel-head-subtitle">
                    {toDisplayString(selectedProject.name)}
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddDrawing(true)}
                  disabled={isLoading}
                >
                  <Plus size={14} /> Add DWG
                </button>
              </div>
              <div className="panel-body">
                {isLoading && projectDrawings.length === 0 ? (
                  <Loading />
                ) : projectDrawings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FileText size={20} strokeWidth={1.7} />
                    </div>
                    <p className="empty-state-title">No drawings yet</p>
                    <p className="empty-state-desc">
                      Add the first drawing for{" "}
                      {toDisplayString(selectedProject.name)} to begin building
                      its BOM.
                    </p>
                  </div>
                ) : (
                  <div className="dwgbom-drawing-grid">
                    {projectDrawings.map((d) => (
                      <button
                        key={d.id}
                        className={`dwgbom-drawing-card ${
                          String(d.id) === String(selectedDrawingId)
                            ? "dwgbom-drawing-card-active"
                            : ""
                        }`}
                        onClick={() => setSelectedDrawingId(Number(d.id))}
                      >
                        <span className="dwgbom-drawing-number mono">
                          {toDisplayString(d.dwgNumber)}
                        </span>
                        <span className="dwgbom-drawing-name">
                          {toDisplayString(d.name)}
                        </span>
                        <span className="dwgbom-drawing-meta">
                          {toDisplayString(d.revision)} · {d.date || "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ============ BOM Panel ============ */}
          {selectedDrawing && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-head-title">
                    <ListChecks size={16} strokeWidth={1.8} /> BOM Materials
                  </div>
                  <p className="panel-head-subtitle">
                    {toDisplayString(selectedProject?.name)} &nbsp;·&nbsp;{" "}
                    {toDisplayString(selectedDrawing.dwgNumber)} —{" "}
                    {toDisplayString(selectedDrawing.name)}
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
                  disabled={saving}
                >
                  <FileUp size={14} /> Import BOM
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSaveAllBom}
                  disabled={saving || bomList.length === 0}
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save BOM"}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={openAddBom}
                  disabled={saving}
                >
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
                    {isLoading && filteredBom.length === 0 && (
                      <tr>
                        <td colSpan={bomColumns.length + 1}>
                          <Loading />
                        </td>
                      </tr>
                    )}

                    {!isLoading &&
                      filteredBom.map((item) => (
                        <tr key={item.id}>
                          <td>{toDisplayString(item.variantNumber)}</td>
                          <td>{toDisplayString(item.itemNumber)}</td>
                          <td>
                            <DescriptionCell description={item.description} />
                          </td>
                          <td className="cell-muted">
                            {toDisplayString(item.std)}
                          </td>
                          <td className="cell-mono cell-muted">
                            {toDisplayString(item.drawingNumber)}
                          </td>
                          <td>{toDisplayString(item.itemNo)}</td>
                          <td className="cell-muted">
                            {toDisplayString(item.varNo)}
                          </td>
                          <td className="cell-mono">
                            {toDisplayString(item.materialCode)}
                          </td>
                          <td>{toDisplayString(item.materialSpecn)}</td>
                          <td className="cell-muted">
                            {toDisplayString(item.acp)}
                          </td>
                          <td className="cell-muted">
                            {toDisplayString(item.di)}
                          </td>
                          <td>{toDisplayString(item.unit)}</td>
                          <td className="cell-muted">{item.unitWeight}</td>
                          <td>
                            <strong>{item.quantity}</strong>
                          </td>
                          <td>
                            <div className="table-row-actions">
                              <button
                                onClick={() => openEditBom(item)}
                                aria-label="Edit"
                                disabled={saving}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="danger"
                                onClick={() => setDeleteTarget(item)}
                                aria-label="Delete"
                                disabled={saving}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {!isLoading && filteredBom.length === 0 && (
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
                availability. <strong>Unit Weight</strong> is informational only
                and is never used to calculate stock or PO consumption.
              </div>
            </section>
          )}
        </>
      )}

      {/* ============= Add Project Modal ============= */}
      <Modal
        open={showAddProject}
        title="Add Project"
        subtitle="Create a new project to attach drawings and BOM to."
        onClose={() => !saving && setShowAddProject(false)}
      >
        <div className="form-section">
          {projectErrors.submit && (
            <div className="form-error-text" style={{ marginBottom: 12 }}>
              {projectErrors.submit}
            </div>
          )}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                  setProjectForm({ ...projectForm, startDate: e.target.value })
                }
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAddProject}
            disabled={saving}
          >
            {saving ? "Saving..." : "Add Project"}
          </button>
        </div>
      </Modal>

      {/* ============= Add Drawing Modal ============= */}
      <Modal
        open={showAddDrawing}
        title="Add Drawing"
        subtitle={selectedProject ? `For ${selectedProject.name}` : ""}
        onClose={() => !saving && setShowAddDrawing(false)}
      >
        <div className="form-section">
          {drawingErrors.submit && (
            <div className="form-error-text" style={{ marginBottom: 12 }}>
              {drawingErrors.submit}
            </div>
          )}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
              />
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowAddDrawing(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAddDrawing}
            disabled={saving}
          >
            {saving ? "Saving..." : "Add DWG"}
          </button>
        </div>
      </Modal>

      {/* ============= BOM Modal — Separate Description Fields ============= */}
      <Modal
        open={bomModalOpen}
        title={editingBomId ? "Edit BOM Material" : "Add BOM Material"}
        subtitle={selectedDrawing ? selectedDrawing.dwgNumber : ""}
        onClose={() => !saving && setBomModalOpen(false)}
        wide={true}
      >
        <div className="form-section">
          {bomErrors.submit && (
            <div className="form-error-text" style={{ marginBottom: 12 }}>
              {bomErrors.submit}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label>Variant Number</label>
              <input
                value={bomForm.variantNumber}
                onChange={(e) =>
                  setBomForm({ ...bomForm, variantNumber: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="form-field">
              <label>Item Number</label>
              <input
                value={bomForm.itemNumber}
                onChange={(e) =>
                  setBomForm({ ...bomForm, itemNumber: e.target.value })
                }
                disabled={saving}
              />
            </div>

            {/* ---------- DESCRIPTION BLOCK ---------- */}
            <div
              className={`form-field form-field-full ${
                bomErrors.description ? "form-field-error" : ""
              }`}
            >
              <label>
                Description<span className="required-mark">*</span>
              </label>

              <div className="form-grid form-grid-inner">
                <div className="form-field">
                  <label className="form-sublabel">Material Type</label>
                  <input
                    value={bomForm.description.materialType}
                    onChange={(e) =>
                      setBomDescriptionField("materialType", e.target.value)
                    }
                    placeholder="Plate / Pipe / Channel"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label className="form-sublabel">Thickness</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bomForm.description.thickness}
                    onChange={(e) =>
                      setBomDescriptionField("thickness", e.target.value)
                    }
                    placeholder="e.g. 6"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label className="form-sublabel">Length</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bomForm.description.length}
                    onChange={(e) =>
                      setBomDescriptionField("length", e.target.value)
                    }
                    placeholder="e.g. 530"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label className="form-sublabel">Width</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bomForm.description.width}
                    onChange={(e) =>
                      setBomDescriptionField("width", e.target.value)
                    }
                    placeholder="e.g. 530"
                    disabled={saving}
                  />
                </div>

                <div className="form-field">
                  <label className="form-sublabel">Grade</label>
                  <input
                    value={bomForm.description.grade}
                    onChange={(e) =>
                      setBomDescriptionField("grade", e.target.value)
                    }
                    placeholder="IS2062 E250A"
                    disabled={saving}
                  />
                </div>

                <div className="form-field form-field-full">
                  <label className="form-sublabel">Remarks</label>
                  <input
                    value={bomForm.description.remarks}
                    onChange={(e) =>
                      setBomDescriptionField("remarks", e.target.value)
                    }
                    placeholder="Optional free text"
                    disabled={saving}
                  />
                </div>
              </div>

              {bomErrors.description && (
                <span className="form-error-text">
                  {bomErrors.description}
                </span>
              )}
            </div>
            {/* ---------- /DESCRIPTION BLOCK ---------- */}

            <div className="form-field">
              <label>STD</label>
              <input
                value={bomForm.std}
                onChange={(e) =>
                  setBomForm({ ...bomForm, std: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="form-field">
              <label>Drawing Number</label>
              <input
                value={bomForm.drawingNumber}
                onChange={(e) =>
                  setBomForm({ ...bomForm, drawingNumber: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="form-field">
              <label>Item No</label>
              <input
                value={bomForm.itemNo}
                onChange={(e) =>
                  setBomForm({ ...bomForm, itemNo: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="form-field">
              <label>Var No</label>
              <input
                value={bomForm.varNo}
                onChange={(e) =>
                  setBomForm({ ...bomForm, varNo: e.target.value })
                }
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
              />
            </div>
            <div className="form-field">
              <label>A/C/P</label>
              <input
                value={bomForm.acp}
                onChange={(e) =>
                  setBomForm({ ...bomForm, acp: e.target.value })
                }
                disabled={saving}
              />
            </div>
            <div className="form-field">
              <label>DI</label>
              <input
                value={bomForm.di}
                onChange={(e) => setBomForm({ ...bomForm, di: e.target.value })}
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveBomItem}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingBomId
                ? "Save Changes"
                : "Add Material"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete BOM item?"
        message={
          deleteTarget
            ? `This BOM item will be removed from the drawing.`
            : ""
        }
        onCancel={() => !saving && setDeleteTarget(null)}
        onConfirm={handleDeleteBom}
      />
    </PageShell>
  );
}