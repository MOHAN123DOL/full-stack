import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileWarning,
  Search,
  Save,
  ArrowLeft,
  RefreshCw,
  Lock,
  X,
  Loader2,
  Layers,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./POIntegration.css";

const API_BASE = "/erp/material";

// =====================================================================
// HELPERS
// =====================================================================
function getApiError(error, fallback = "Something went wrong. Please try again.") {
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

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtDateTime(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

// Row key must be unique across real + dummy tables.
function rowKeyOf(p) {
  return `${p.sourceType || "real"}__${p.poItemId}`;
}

// =====================================================================
// SMALL UI
// =====================================================================
function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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

// =====================================================================
// MAIN
// =====================================================================
export default function POIntegration() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const [poItems, setPoItems] = useState([]);
  const [history, setHistory] = useState([]);

  // quantities keyed by rowKey (sourceType + poItemId)
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [toast, setToast] = useState("");

  // Dummy PO modal
  const [showDummyModal, setShowDummyModal] = useState(false);
  const [dummyForm, setDummyForm] = useState({
    poNumber: "",
    itemCode: "",
    description: "",
    material: "",
    length: "",
    width: "",
    thickness: "",
    unit: "Nos",
    quantity: "",
    remarks: "",
  });
  const [dummyErrors, setDummyErrors] = useState({});
  const [savingDummy, setSavingDummy] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  // =================================================================
  // FETCHERS
  // =================================================================
  const fetchProjects = useCallback(async () => {
    const res = await api.get(`${API_BASE}/projects/`, {
      headers: authHeaders(),
    });
    const list = unwrapList(res.data).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
    }));
    setProjects(list);
    return list;
  }, [authHeaders]);

  const fetchProjectData = useCallback(
    async (projectId) => {
      if (!projectId) {
        setPoItems([]);
        setHistory([]);
        setQuantities({});
        return;
      }
      const res = await api.get(`${API_BASE}/project-po-items/`, {
        headers: authHeaders(),
        params: { projectId },
      });
      const data = res.data?.data || res.data;
      const poList = Array.isArray(data?.poItems) ? data.poItems : [];
      const histList = Array.isArray(data?.history) ? data.history : [];

      const mapped = poList.map((p) => ({
        poItemId: p.poItemId,
        sourceType: p.sourceType || "real",   // "real" | "dummy"
        poNumber: p.poNumber || "",
        poItemCode: p.poItemCode || "",
        description: p.description || "",
        material: p.material || "",
        length: p.length || "",
        width: p.width || "",
        thickness: p.thickness || "",
        unit: p.unit || "",
        poQuantity: num(p.poQuantity),
        poIntegrated: num(p.poIntegrated),
        poRemaining: num(p.poRemaining),
        isDummy: p.sourceType === "dummy" || Boolean(p.isDummy),
      }));

      setPoItems(mapped);

      setHistory(
        histList.map((h) => ({
          id: h.id,
          poItemId: h.poItemId,
          poNumber: h.poNumber,
          poDescription: h.poDescription,
          poUnit: h.poUnit,
          quantity: num(h.quantity),
          isDummy: Boolean(h.isDummy),
          createdAt: h.createdAt,
        })),
      );

      // Reset quantities keyed by rowKey
      const blank = {};
      mapped.forEach((p) => {
        blank[rowKeyOf(p)] = "";
      });
      setQuantities(blank);
    },
    [authHeaders],
  );

  // =================================================================
  // INITIAL LOAD
  // =================================================================
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!accessToken) {
        setPageError("Your session has expired. Please login again.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setPageError("");
        const list = await fetchProjects();
        if (cancelled) return;
        if (list.length > 0) {
          setSelectedProjectId(Number(list[0].id));
        }
      } catch (err) {
        console.error(err);
        setPageError(getApiError(err, "Failed to load projects."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, fetchProjects]);

  // =================================================================
  // PROJECT → DATA
  // =================================================================
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        setDataLoading(true);
        await fetchProjectData(selectedProjectId);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          showToast(getApiError(err, "Failed to load project data."));
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, fetchProjectData]);

  // =================================================================
  // DERIVED
  // =================================================================
  const selectedProject = projects.find(
    (p) => String(p.id) === String(selectedProjectId),
  );

  const filteredPoItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return poItems;
    return poItems.filter((p) =>
      [
        p.poNumber,
        p.poItemCode,
        p.description,
        p.material,
        p.length,
        p.width,
        p.thickness,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [poItems, search]);

  const rowsToSave = useMemo(() => {
    const out = [];
    poItems.forEach((p) => {
      const key = rowKeyOf(p);
      const q = Number(quantities[key]);
      if (q > 0) {
        out.push({
          poItemId: p.poItemId,
          sourceType: p.sourceType,
          quantity: q,
        });
      }
    });
    return out;
  }, [poItems, quantities]);

  const summary = useMemo(() => {
    const totalQty = rowsToSave.reduce((s, r) => s + r.quantity, 0);
    const historyQty = history.reduce((s, h) => s + h.quantity, 0);
    const uniquePo = new Set(history.map((h) => h.poItemId)).size;
    const realCount = poItems.filter((p) => p.sourceType === "real").length;
    const dummyCount = poItems.filter((p) => p.sourceType === "dummy").length;
    return {
      available: poItems.length,
      realCount,
      dummyCount,
      filled: rowsToSave.length,
      totalQty,
      historyCount: history.length,
      historyQty,
      uniquePo,
    };
  }, [poItems, rowsToSave, history]);

  // =================================================================
  // ACTIONS
  // =================================================================
  function handleProjectChange(id) {
    setSelectedProjectId(id ? Number(id) : null);
    setSearch("");
    setQuantities({});
  }

  function handleQtyChange(key, value, maxAllowed) {
    let v = value;
    if (v !== "") {
      const n = Number(v);
      if (Number.isNaN(n)) v = "";
      else if (n < 0) v = "0";
      else if (n > maxAllowed) v = String(maxAllowed);
    }
    setQuantities((prev) => ({ ...prev, [key]: v }));
  }

  function clearAllQuantities() {
    const blank = {};
    poItems.forEach((p) => {
      blank[rowKeyOf(p)] = "";
    });
    setQuantities(blank);
  }

  function fillAllMax() {
    const next = {};
    poItems.forEach((p) => {
      next[rowKeyOf(p)] = String(p.poRemaining);
    });
    setQuantities(next);
  }

  // ---------------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------------
  async function handleSaveAll() {
    if (!selectedProjectId) {
      showToast("Select a project first.");
      return;
    }
    if (rowsToSave.length === 0) {
      showToast("Enter at least one quantity to integrate.");
      return;
    }
    try {
      setSaving(true);
      const res = await api.post(
        `${API_BASE}/project-po-integration/create/`,
        {
          projectId: Number(selectedProjectId),
          rows: rowsToSave,
        },
        { headers: authHeaders() },
      );
      showToast(res.data?.message || "Integrations saved.");
      await fetchProjectData(selectedProjectId);
    } catch (err) {
      console.error("Save failed:", err);
      const body = err?.response?.data;
      if (Array.isArray(body?.errors) && body.errors.length > 0) {
        showToast(body.errors[0].error || "Some rows failed validation.");
      } else {
        showToast(getApiError(err, "Failed to save integrations."));
      }
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------
  // REFRESH
  // ---------------------------------------------------------------
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchProjects();
      if (selectedProjectId) await fetchProjectData(selectedProjectId);
      showToast("Refreshed");
    } catch (err) {
      showToast(getApiError(err, "Failed to refresh."));
    } finally {
      setRefreshing(false);
    }
  }

  function handleBack() {
    navigate("/inventory/material");
  }

  // ---------------------------------------------------------------
  // DUMMY PO
  // ---------------------------------------------------------------
  function openDummyModal() {
    setDummyForm({
      poNumber: "",
      itemCode: "",
      description: "",
      material: "",
      length: "",
      width: "",
      thickness: "",
      unit: "Nos",
      quantity: "",
      remarks: "",
    });
    setDummyErrors({});
    setShowDummyModal(true);
  }

  function handleDummyChange(field, value) {
    setDummyForm((prev) => ({ ...prev, [field]: value }));
    if (dummyErrors[field]) {
      setDummyErrors((prev) => ({ ...prev, [field]: null }));
    }
  }

  function validateDummy() {
    const errs = {};
    if (!dummyForm.poNumber.trim())
      errs.poNumber = "Dummy PO Number is required";
    if (!dummyForm.description.trim())
      errs.description = "Description is required";
    if (!dummyForm.unit.trim()) errs.unit = "Unit is required";
    const q = Number(dummyForm.quantity);
    if (!dummyForm.quantity || q <= 0)
      errs.quantity = "Quantity must be greater than 0";
    setDummyErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleCreateDummy() {
    if (!validateDummy()) return;
    try {
      setSavingDummy(true);
      await api.post(
        `${API_BASE}/dummy-purchase-orders/`,
        {
          poNumber: dummyForm.poNumber.trim(),
          itemCode: dummyForm.itemCode.trim(),
          description: dummyForm.description.trim(),
          material: dummyForm.material.trim(),
          length: dummyForm.length,
          width: dummyForm.width,
          thickness: dummyForm.thickness,
          unit: dummyForm.unit,
          quantity: Number(dummyForm.quantity),
          remarks: dummyForm.remarks.trim(),
        },
        { headers: authHeaders() },
      );
      showToast("Dummy PO created. Refreshing list...");
      setShowDummyModal(false);
      if (selectedProjectId) await fetchProjectData(selectedProjectId);
    } catch (err) {
      console.error("Dummy PO failed:", err);
      showToast(getApiError(err, "Failed to create Dummy PO."));
    } finally {
      setSavingDummy(false);
    }
  }

  // =================================================================
  // RENDER
  // =================================================================
  return (
    <>
      <Header />
      <div className="material-page">
        <div className="material-content">
          {/* ============ Page header ============ */}
          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>
              <div className="page-header-title-group">
                <h1 className="page-header-title">PO Integration</h1>
                <p className="page-header-subtitle">
                  Link project integrations to Purchase Order descriptions.
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

          {pageError && !isLoading && (
            <Error onRetry={() => window.location.reload()} />
          )}

          {isLoading && (
            <div style={{ padding: 40 }}>
              <Loading />
            </div>
          )}

          {!isLoading && !pageError && (
            <>
              {/* ============ Step 1 ============ */}
              <section className="panel">
                <div className="panel-head">
                  <div className="panel-head-title">
                    <Lock size={15} strokeWidth={1.8} /> Step 1 — Pick a Project
                  </div>
                </div>
                <div className="panel-body">
                  <div className="poi-top-grid">
                    <div className="form-field">
                      <label>Project</label>
                      <select
                        value={selectedProjectId ?? ""}
                        onChange={(e) => handleProjectChange(e.target.value)}
                        disabled={projects.length === 0}
                      >
                        {projects.length === 0 && (
                          <option value="">No projects available</option>
                        )}
                        {projects.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </select>
                      <span className="form-hint">
                        Integrations are recorded against this project.
                      </span>
                    </div>
                    <div className="form-field">
                      <label>Search PO items</label>
                      <div className="poi-search">
                        <Search size={14} />
                        <input
                          placeholder="PO number, description, material..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-field">
                      <label>Add a PO (optional)</label>
                      <button
                        className="btn btn-secondary"
                        onClick={openDummyModal}
                        type="button"
                        style={{ width: "100%" }}
                      >
                        <FileWarning size={14} /> Add Dummy PO
                      </button>
                      <span className="form-hint">
                        Creates a dummy PO for internal use only.
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ============ KPI cards ============ */}
              <div className="poi-summary-grid">
                <div className="poi-summary-card">
                  <div className="poi-summary-card-icon poi-icon-blue">
                    <Layers size={18} />
                  </div>
                  <div>
                    <div className="poi-summary-card-label">
                      Available PO Items
                    </div>
                    <div className="poi-summary-card-value">
                      {summary.available}
                    </div>
                    <div className="poi-summary-card-sub">
                      {summary.realCount} real · {summary.dummyCount} dummy
                    </div>
                  </div>
                </div>
                <div className="poi-summary-card">
                  <div className="poi-summary-card-icon poi-icon-green">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="poi-summary-card-label">
                      Integrations Saved
                    </div>
                    <div className="poi-summary-card-value">
                      {summary.historyCount}
                    </div>
                  </div>
                </div>
                <div className="poi-summary-card">
                  <div className="poi-summary-card-icon poi-icon-amber">
                    <Package size={18} />
                  </div>
                  <div>
                    <div className="poi-summary-card-label">
                      Total Integrated Qty
                    </div>
                    <div className="poi-summary-card-value">
                      {fmt(summary.historyQty)}
                    </div>
                  </div>
                </div>
                <div className="poi-summary-card">
                  <div className="poi-summary-card-icon poi-icon-purple">
                    <Clock size={18} />
                  </div>
                  <div>
                    <div className="poi-summary-card-label">
                      Unique PO Items
                    </div>
                    <div className="poi-summary-card-value">
                      {summary.uniquePo}
                    </div>
                  </div>
                </div>
              </div>

              {/* ============ Available PO items ============ */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-head-title">
                      <Save size={16} strokeWidth={1.8} /> Step 2 — Integrate PO
                      Items
                    </div>
                    <p className="panel-head-subtitle">
                      Every confirmed PO item (and dummy PO item) with remaining
                      quantity for{" "}
                      {selectedProject?.name || "this project"}.
                    </p>
                  </div>
                  <div className="poi-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={fillAllMax}
                      disabled={poItems.length === 0 || saving}
                    >
                      <Zap size={14} /> Fill All (Max)
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={clearAllQuantities}
                      disabled={rowsToSave.length === 0 || saving}
                    >
                      Clear
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveAll}
                      disabled={saving || rowsToSave.length === 0}
                    >
                      {saving ? (
                        <>
                          <Loader2 size={14} className="spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Save ({rowsToSave.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Item Code</th>
                        <th>Description</th>
                        <th>Material</th>
                        <th>L × W × T</th>
                        <th>PO Qty</th>
                        <th>Integrated</th>
                        <th>Remaining</th>
                        <th>Unit</th>
                        <th>Integrate Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataLoading && (
                        <tr>
                          <td colSpan={10}>
                            <Loading />
                          </td>
                        </tr>
                      )}

                      {!dataLoading &&
                        filteredPoItems.map((p) => {
                          const key = rowKeyOf(p);
                          const q = quantities[key] ?? "";
                          const filled = q !== "" && Number(q) > 0;
                          const dims = [p.length, p.width, p.thickness]
                            .filter(Boolean)
                            .join(" × ");

                          return (
                            <tr
                              key={key}
                              className={
                                filled
                                  ? "poi-row-filled"
                                  : p.isDummy
                                    ? "poi-row-dummy"
                                    : undefined
                              }
                            >
                              <td className="cell-mono">
                                <span>{p.poNumber}</span>
                                {p.isDummy && (
                                  <span className="poi-dummy-badge">Dummy</span>
                                )}
                              </td>
                              <td className="cell-mono cell-muted">
                                {p.poItemCode || "—"}
                              </td>
                              <td>{p.description || "—"}</td>
                              <td className="cell-muted">
                                {p.material || "—"}
                              </td>
                              <td className="cell-muted">{dims || "—"}</td>
                              <td>{fmt(p.poQuantity)}</td>
                              <td className="cell-muted">
                                {fmt(p.poIntegrated)}
                              </td>
                              <td>
                                <strong className="poi-remaining">
                                  {fmt(p.poRemaining)}
                                </strong>
                              </td>
                              <td>{p.unit || "—"}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max={p.poRemaining}
                                  step="any"
                                  value={q}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      key,
                                      e.target.value,
                                      p.poRemaining,
                                    )
                                  }
                                  placeholder="0"
                                  className="poi-qty-input"
                                />
                              </td>
                            </tr>
                          );
                        })}

                      {!dataLoading && filteredPoItems.length === 0 && (
                        <tr>
                          <td colSpan={10}>
                            <div className="empty-state">
                              <div className="empty-state-icon">
                                <AlertCircle size={20} strokeWidth={1.7} />
                              </div>
                              <p className="empty-state-title">
                                {search
                                  ? "No PO items match your search"
                                  : "No available PO items"}
                              </p>
                              <p className="empty-state-desc">
                                Confirm a Purchase Order with items or create a
                                Dummy PO to get started.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {rowsToSave.length > 0 && (
                  <div className="poi-save-preview">
                    <CheckCircle2 size={14} />
                    <span>
                      You are about to save <strong>{summary.filled}</strong>{" "}
                      integration {summary.filled === 1 ? "row" : "rows"}{" "}
                      totalling <strong>{fmt(summary.totalQty)}</strong> units
                      for <strong>{selectedProject?.name}</strong>.
                    </span>
                  </div>
                )}
              </section>

              {/* ============ Integration history ============ */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-head-title">
                      <Clock size={16} strokeWidth={1.8} /> Integration History
                    </div>
                    <p className="panel-head-subtitle">
                      Every integration saved for{" "}
                      {selectedProject?.name || "this project"}.
                    </p>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>PO Number</th>
                        <th>PO Description</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataLoading && (
                        <tr>
                          <td colSpan={7}>
                            <Loading />
                          </td>
                        </tr>
                      )}

                      {!dataLoading &&
                        history.map((h, idx) => (
                          <tr key={h.id}>
                            <td className="cell-muted">{idx + 1}</td>
                            <td className="cell-muted">
                              {fmtDateTime(h.createdAt)}
                            </td>
                            <td className="cell-mono">{h.poNumber}</td>
                            <td>{h.poDescription || "—"}</td>
                            <td>
                              <strong className="poi-qty-positive">
                                {fmt(h.quantity)}
                              </strong>
                            </td>
                            <td>{h.poUnit || "—"}</td>
                            <td className="cell-muted">
                              {h.isDummy ? "Dummy PO" : "Existing PO"}
                            </td>
                          </tr>
                        ))}

                      {!dataLoading && history.length === 0 && (
                        <tr>
                          <td colSpan={7}>
                            <div className="empty-state">
                              <p className="empty-state-title">
                                No integrations yet
                              </p>
                              <p className="empty-state-desc">
                                Enter quantities in the table above and click
                                Save.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ============ Dummy PO modal ============ */}
          <Modal
            open={showDummyModal}
            title="Add Dummy PO"
            subtitle="Creates a Dummy Purchase Order for internal planning. It never touches the accounts pipeline."
            onClose={() => !savingDummy && setShowDummyModal(false)}
          >
            <div className="form-grid">
              <div
                className={`form-field ${
                  dummyErrors.poNumber ? "form-field-error" : ""
                }`}
              >
                <label>
                  Dummy PO Number <span className="required-mark">*</span>
                </label>
                <input
                  value={dummyForm.poNumber}
                  onChange={(e) =>
                    handleDummyChange("poNumber", e.target.value)
                  }
                  placeholder="DUMMY-001"
                  disabled={savingDummy}
                />
                {dummyErrors.poNumber && (
                  <span className="form-error-text">
                    {dummyErrors.poNumber}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>Item Code</label>
                <input
                  value={dummyForm.itemCode}
                  onChange={(e) =>
                    handleDummyChange("itemCode", e.target.value)
                  }
                  placeholder="Optional"
                  disabled={savingDummy}
                />
              </div>
              <div
                className={`form-field form-field-full ${
                  dummyErrors.description ? "form-field-error" : ""
                }`}
              >
                <label>
                  Description <span className="required-mark">*</span>
                </label>
                <input
                  value={dummyForm.description}
                  onChange={(e) =>
                    handleDummyChange("description", e.target.value)
                  }
                  placeholder="MS Plate"
                  disabled={savingDummy}
                />
                {dummyErrors.description && (
                  <span className="form-error-text">
                    {dummyErrors.description}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>Material</label>
                <input
                  value={dummyForm.material}
                  onChange={(e) =>
                    handleDummyChange("material", e.target.value)
                  }
                  placeholder="Plate"
                  disabled={savingDummy}
                />
              </div>
              <div className="form-field">
                <label>Length</label>
                <input
                  value={dummyForm.length}
                  onChange={(e) => handleDummyChange("length", e.target.value)}
                  placeholder="500"
                  disabled={savingDummy}
                />
              </div>
              <div className="form-field">
                <label>Width</label>
                <input
                  value={dummyForm.width}
                  onChange={(e) => handleDummyChange("width", e.target.value)}
                  placeholder="500"
                  disabled={savingDummy}
                />
              </div>
              <div className="form-field">
                <label>Thickness</label>
                <input
                  value={dummyForm.thickness}
                  onChange={(e) =>
                    handleDummyChange("thickness", e.target.value)
                  }
                  placeholder="6"
                  disabled={savingDummy}
                />
              </div>
              <div
                className={`form-field ${
                  dummyErrors.unit ? "form-field-error" : ""
                }`}
              >
                <label>
                  Unit <span className="required-mark">*</span>
                </label>
                <select
                  value={dummyForm.unit}
                  onChange={(e) => handleDummyChange("unit", e.target.value)}
                  disabled={savingDummy}
                >
                  <option>Nos</option>
                  <option>No</option>
                  <option>Mtr</option>
                  <option>Kg</option>
                  <option>PCS</option>
                  <option>Set</option>
                </select>
                {dummyErrors.unit && (
                  <span className="form-error-text">{dummyErrors.unit}</span>
                )}
              </div>
              <div
                className={`form-field ${
                  dummyErrors.quantity ? "form-field-error" : ""
                }`}
              >
                <label>
                  Quantity <span className="required-mark">*</span>
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={dummyForm.quantity}
                  onChange={(e) =>
                    handleDummyChange("quantity", e.target.value)
                  }
                  placeholder="10"
                  disabled={savingDummy}
                />
                {dummyErrors.quantity && (
                  <span className="form-error-text">
                    {dummyErrors.quantity}
                  </span>
                )}
              </div>
              <div className="form-field form-field-full">
                <label>Remarks</label>
                <textarea
                  rows={2}
                  value={dummyForm.remarks}
                  onChange={(e) =>
                    handleDummyChange("remarks", e.target.value)
                  }
                  disabled={savingDummy}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDummyModal(false)}
                disabled={savingDummy}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateDummy}
                disabled={savingDummy}
              >
                {savingDummy ? "Creating..." : "Create Dummy PO"}
              </button>
            </div>
          </Modal>
        </div>
      </div>
    </>
  );
}