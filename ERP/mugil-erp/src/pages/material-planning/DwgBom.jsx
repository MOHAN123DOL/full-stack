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
  // RENDER — project management only
  // ===============================================================
  return (
    <PageShell>
      <div className="page-header-wrap">
        <div className="page-header-left">
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={16} strokeWidth={2} /> Back
          </button>
          <div className="page-header-title-group">
            <h1 className="page-header-title">Project Setup</h1>
            <p className="page-header-subtitle">
              Manage projects used for Purchase Order integration. Drawing and BOM management is not required here.
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

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-head-title">
              <FolderKanban size={16} strokeWidth={1.8} /> Projects
            </div>
            <p className="panel-head-subtitle">
              Select or create a project. Link its Purchase Orders in the PO Integration page.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setProjectForm(emptyProjectForm);
              setProjectErrors({});
              setShowAddProject(true);
            }}
            disabled={isLoading}
          >
            <Plus size={14} /> Add Project
          </button>
        </div>

        <div className="panel-body">
          <div className="dwgbom-select-project">
            <label>
              Search Project
              {projectSearch.trim() && (
                <span className="dwgbom-match-count">
                  {" "}— {projectMatchCount} match{projectMatchCount === 1 ? "" : "es"}
                  {projectMatchCount > PROJECT_OPTIONS_LIMIT && ` (showing first ${PROJECT_OPTIONS_LIMIT})`}
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

          <div className="dwgbom-select-project">
            <label>Select Project</label>
            <select
              value={selectedProjectId != null ? String(selectedProjectId) : ""}
              onChange={(e) => selectProject(e.target.value)}
              disabled={isLoading || filteredProjectOptions.length === 0}
            >
              {filteredProjectOptions.length === 0 && (
                <option value="">
                  {projectsList.length === 0 ? "No projects available" : "No projects match your search"}
                </option>
              )}
              {filteredProjectOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {isLoading && <Loading />}

          {!isLoading && !error && projectsList.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><FolderKanban size={20} /></div>
              <p className="empty-state-title">No projects available</p>
              <p className="empty-state-desc">Add a project to start linking Purchase Orders.</p>
            </div>
          )}

          {selectedProject && (
            <div className="dwgbom-project-summary">
              <div>
                <span className="dwgbom-project-name">{toDisplayString(selectedProject.name)}</span>{" "}
                <span className="dwgbom-project-code mono">{toDisplayString(selectedProject.code)}</span>
              </div>
              <p className="dwgbom-project-desc">{toDisplayString(selectedProject.description) || "—"}</p>
              {(selectedProject.startDate || selectedProject.endDate) && (
                <div className="dwgbom-project-dates">
                  <span>
                    <span className="dwgbom-project-dates-label">Project Start Date:</span>{" "}
                    {selectedProject.startDate || "—"}
                  </span>
                  <span>
                    <span className="dwgbom-project-dates-label">Expected Project End Date:</span>{" "}
                    {selectedProject.endDate || "—"}
                  </span>
                </div>
              )}
              <StatusBadge status={selectedProject.status} />
            </div>
          )}
        </div>
      </section>

      <Modal
        open={showAddProject}
        title="Add Project"
        subtitle="Create a project for Purchase Order integration."
        onClose={() => !saving && setShowAddProject(false)}
      >
        <div className="form-section">
          {projectErrors.submit && (
            <div className="form-error-text" style={{ marginBottom: 12 }}>{projectErrors.submit}</div>
          )}
          <div className="form-grid">
            <div className={`form-field ${projectErrors.name ? "form-field-error" : ""}`}>
              <label>Project Name<span className="required-mark">*</span></label>
              <input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                placeholder="e.g. BHEL Boiler Fabrication"
                disabled={saving}
              />
              {projectErrors.name && <span className="form-error-text">{projectErrors.name}</span>}
            </div>
            <div className={`form-field ${projectErrors.code ? "form-field-error" : ""}`}>
              <label>Project Code<span className="required-mark">*</span></label>
              <input
                value={projectForm.code}
                onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                placeholder="e.g. BHEL-2026-001"
                disabled={saving}
              />
              {projectErrors.code && <span className="form-error-text">{projectErrors.code}</span>}
            </div>
            <div className="form-field form-field-full">
              <label>Project Description</label>
              <textarea
                rows={2}
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className={`form-field ${projectErrors.startDate ? "form-field-error" : ""}`}>
              <label>Project Start Date<span className="required-mark">*</span></label>
              <input
                type="date"
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                disabled={saving}
              />
              {projectErrors.startDate && <span className="form-error-text">{projectErrors.startDate}</span>}
            </div>
            <div className={`form-field ${projectErrors.endDate ? "form-field-error" : ""}`}>
              <label>Expected Project End Date<span className="required-mark">*</span></label>
              <input
                type="date"
                value={projectForm.endDate}
                min={projectForm.startDate || undefined}
                onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                disabled={saving}
              />
              {projectErrors.endDate && <span className="form-error-text">{projectErrors.endDate}</span>}
            </div>
            <div className="form-field">
              <label>Project Status</label>
              <select
                value={projectForm.status}
                onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
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
          <button className="btn btn-secondary" onClick={() => setShowAddProject(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddProject} disabled={saving}>
            {saving ? "Saving..." : "Add Project"}
          </button>
        </div>
      </Modal>
    </PageShell>
  );
}
