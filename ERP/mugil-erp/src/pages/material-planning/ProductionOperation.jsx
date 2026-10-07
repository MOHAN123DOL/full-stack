import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Eye, RefreshCw } from "lucide-react";

import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

import "./ProductionOperation.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const API_BASE = "/erp/material";

const REWORK_ROUTE = "/inventory/material/rework";
const DELIVERY_CHALLAN_ROUTE = "/accounts/DeliveryChallan";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ============================================================
   HELPERS
   ============================================================ */

function getApiError(error, fallback = GENERIC_ERROR) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat().find(
      (v) => typeof v === "string"
    );
    if (first) return first;
  }
  if (error?.message) return error.message;
  return fallback;
}

const today = () => new Date().toISOString().slice(0, 10);

const nowTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const generateDcRef = () =>
  `DC-${Date.now().toString().slice(-6)}`;

/* ============================================================
   DERIVED HELPERS
   ============================================================ */

/**
 * A stage stays "current" until:
 *   - released_qty >= planned_qty, AND
 *   - nothing held in rework or awaiting QC, AND
 *   - no open ReworkRecord.
 *
 * This is what anchors the row while rework is pending so the
 * user keeps seeing the Rework / QC buttons.
 */
const getCurrentStageIndex = (execution) => {
  if (!execution?.stages?.length) return -1;

  return execution.stages.findIndex((s) => {
    const fullyReleased = s.releasedQty >= execution.plannedQty;

    const nothingHeldBack =
      s.reworkQty === 0 &&
      s.awaitingQcQty === 0 &&
      s.pendingOperationQty === 0;

    const noOpenRework = !(s.reworkRecords || []).some(
      (r) =>
        r.status !== "Ready for Next Process" &&
        r.status !== "Available in Material Stock" &&
        r.status !== "Cancelled"
    );

    return !(fullyReleased && nothingHeldBack && noOpenRework);
  });
};

const getCurrentStage = (execution) => {
  const idx = getCurrentStageIndex(execution);
  return idx === -1 ? null : execution.stages[idx];
};

/* ============================================================
   QC LABELS
   ============================================================ */

const QC_LABEL = {
  rework: "Rejected",
  qcPending: "Pending",
  notRequired: "Not Required",
  accepted: "Accepted",
  notStarted: "Not Started",
};

const computeQcStatusLabel = (stage) => {
  if (!stage) return QC_LABEL.accepted;
  if (stage.reworkQty > 0) return QC_LABEL.rework;
  if (stage.awaitingQcQty > 0) return QC_LABEL.qcPending;
  if (!stage.qcRequired) return QC_LABEL.notRequired;
  if (stage.releasedQty > 0) return QC_LABEL.accepted;
  return QC_LABEL.notStarted;
};

const computeOverallStatus = (execution, stage, index) => {
  if (index === -1) return "Completed";
  if (!stage) return "Ready for Production";
  if (stage.reworkQty > 0) return "Rework Required";

  if (stage.executionType === "Outsourcing") {
    const pendingReturn = stage.sentQty - stage.receivedQty;
    if (pendingReturn > 0) {
      return stage.receivedQty > 0
        ? "Partially Received"
        : "Waiting for Return";
    }
  }

  if (stage.awaitingQcQty > 0 && stage.pendingOperationQty === 0) {
    return "QC Pending";
  }

  const nothingStarted = execution.stages.every(
    (s) =>
      s.releasedQty === 0 &&
      s.awaitingQcQty === 0 &&
      s.reworkQty === 0 &&
      !s.started &&
      !s.lastOperation &&
      !s.lastOutsourcing
  );
  if (nothingStarted) return "Ready for Production";

  if (
    stage.executionType === "Outsourcing" &&
    stage.pendingOperationQty > 0
  ) {
    return "Outsourcing";
  }

  const drained =
    stage.pendingOperationQty === 0 &&
    stage.awaitingQcQty === 0 &&
    stage.reworkQty === 0;
  if (drained && stage.availableQty === 0) return "Ready for Next Process";

  return "In Progress";
};

/* ============================================================
   ROW SHAPE
   ============================================================ */

const buildRow = (execution) => {
  const currentIndex = getCurrentStageIndex(execution);
  const currentStage =
    currentIndex === -1 ? null : execution.stages[currentIndex];

  const executionLabel = currentStage
    ? currentStage.executionType === "Outsourcing"
      ? `Outsourcing — ${currentStage.vendor || "—"}`
      : `In-House — ${currentStage.executionUnit || "Unit 1"}`
    : "—";

  return {
    ...execution,
    currentIndex,
    currentStage,
    currentProcessName: currentStage ? currentStage.name : "—",
    executionType: currentStage ? currentStage.executionType : null,
    executionLabel,
    qcStatusLabel: computeQcStatusLabel(currentStage),
    overallStatus: computeOverallStatus(
      execution,
      currentStage,
      currentIndex
    ),
    requiredQty: execution.plannedQty,
    pendingQty: currentStage?.pendingOperationQty ?? 0,
    unit: "Nos",
  };
};

/* ============================================================
   FILTER FIELDS
   ============================================================ */

const FILTER_FIELDS = [
  { key: "assemblyId", label: "Assembly ID", type: "text" },
  { key: "currentProcessName", label: "Current Process", type: "select" },
  { key: "executionLabel", label: "Execution", type: "select" },
  { key: "qcStatusLabel", label: "QC Status", type: "select" },
  { key: "overallStatus", label: "Overall Status", type: "select" },
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

const matchesSearch = (row, search) => {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  return ["assemblyId", "project"].some((k) =>
    String(row[k] ?? "").toLowerCase().includes(term)
  );
};

/* ============================================================
   FORMS
   ============================================================ */

const emptyStartForm = () => ({
  startedBy: "",
  supervisedBy: "",
  remarks: "",
});

const emptyCompleteForm = () => ({
  completedQty: "",
  rejectedQty: "",
  remarks: "",
  by: "",
});

const emptyQcForm = () => ({
  acceptedQty: "",
  rejectedQty: "",
  verifiedBy: "",
  remarks: "",
});

const emptySendOutsourcingForm = (s) => ({
  qty: s ? String(s.pendingOperationQty || "") : "",
  expectedReturnDate: s?.expectedReturnDate || "",
  remarks: "",
});

const emptyReceiveOutsourcingForm = () => ({
  receivedQty: "",
  remarks: "",
});

/* ============================================================
   ACTION TITLES
   ============================================================ */

const ACTION_TITLES = {
  start: "Start Process",
  complete: "Complete Process",
  qc: "QC Verification",
  "send-outsourcing": "Send to Outsourcing",
  "receive-outsourcing": "Receive from Outsourcing",
};

const ACTION_SAVE_LABELS = {
  start: "Save & Start",
  complete: "Save Completion",
  qc: "Save QC Verification",
  "send-outsourcing": "Save & Open Delivery Challan",
  "receive-outsourcing": "Save Receipt",
};

const nextStageName = (execution, sequence) => {
  const next = execution.stages.find((s) => s.sequence === sequence + 1);
  return next ? next.name : "Final Completion";
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function ProductionOperation() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [executions, setExecutions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedProject, setSelectedProject] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewAssemblyId, setViewAssemblyId] = useState(null);
  const [actionState, setActionState] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  /* ============================================================
     AUTH HEADERS
     ============================================================ */

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* ============================================================
     FETCH EXECUTIONS
     ============================================================ */

  const fetchExecutions = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) return;
      try {
        if (!silent) setIsLoading(true);
        else setRefreshing(true);
        setError("");

        const res = await api.get(
          `${API_BASE}/production/operation/`,
          { headers: authHeaders() }
        );

        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : [];

        setExecutions(list);
      } catch (err) {
        console.error("Failed to load production operations:", err);
        setError(getApiError(err, "Failed to load production operations."));
        setExecutions([]);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, authHeaders]
  );

  /* ============================================================
     FETCH EMPLOYEES
     ============================================================ */

  const fetchEmployees = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await api.get("/erp/salary/employees/", {
        headers: authHeaders(),
        params: { page_size: 100 },
      });

      const list = Array.isArray(res.data?.results)
        ? res.data.results
        : Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      const names = list
        .map((e) => {
          if (e.name && String(e.name).trim()) {
            return String(e.name).trim();
          }
          const parts = [e.first_name, e.last_name].filter(Boolean);
          return parts.join(" ").trim();
        })
        .filter(Boolean);

      const unique = [...new Set(names)].sort((a, b) =>
        a.localeCompare(b)
      );

      setEmployees(unique);
    } catch (err) {
      console.error("Failed to load employees:", err);
      setEmployees([]);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    if (!accessToken) {
      setError("Your session has expired. Please login again.");
      setIsLoading(false);
      return;
    }
    fetchExecutions();
    fetchEmployees();
  }, [accessToken, fetchExecutions, fetchEmployees]);

  /* ============================================================
     DERIVED LISTS
     ============================================================ */

  const projectOptions = useMemo(
    () => [
      ...new Set(executions.map((e) => e.project).filter(Boolean)),
    ].sort(),
    [executions]
  );

  useEffect(() => {
    if (!selectedProject && projectOptions.length > 0) {
      setSelectedProject(projectOptions[0]);
    }
  }, [projectOptions, selectedProject]);

  const projectRows = useMemo(
    () =>
      executions
        .filter((e) => !selectedProject || e.project === selectedProject)
        .map(buildRow),
    [executions, selectedProject]
  );

  const filteredRows = useMemo(
    () =>
      projectRows.filter(
        (r) => matchesFilters(r, filters) && matchesSearch(r, search)
      ),
    [projectRows, filters, search]
  );

  const filterOptions = useMemo(
    () => buildOptionsMap(projectRows),
    [projectRows]
  );

  const viewExecution = useMemo(() => {
    if (!viewAssemblyId) return null;
    const found = executions.find(
      (e) => e.assemblyId === viewAssemblyId
    );
    return found ? buildRow(found) : null;
  }, [executions, viewAssemblyId]);

  const actionExecution = useMemo(() => {
    if (!actionState) return null;
    return (
      executions.find(
        (e) => e.assemblyId === actionState.assemblyId
      ) || null
    );
  }, [executions, actionState]);

  const actionStage = useMemo(() => {
    if (!actionExecution || !actionState) return null;
    return (
      actionExecution.stages.find(
        (s) => s.sequence === actionState.sequence
      ) || null
    );
  }, [actionExecution, actionState]);

  /* ============================================================
     HANDLERS
     ============================================================ */

  const handleProjectChange = (value) => {
    setSelectedProject(value);
    setFilters({});
    setSearch("");
    setFiltersOpen(false);
  };

  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const openView = (assemblyId) => setViewAssemblyId(assemblyId);
  const closeView = () => setViewAssemblyId(null);
  const jumpToAssembly = (assemblyId) => setViewAssemblyId(assemblyId);

  const openAction = (assemblyId, sequence, mode) => {
    setActionState({ assemblyId, sequence, mode });
    setFormError("");

    const targetExecution = executions.find(
      (e) => e.assemblyId === assemblyId
    );
    const targetStage = targetExecution?.stages.find(
      (s) => s.sequence === sequence
    );

    if (mode === "start") setForm(emptyStartForm());
    else if (mode === "complete") setForm(emptyCompleteForm());
    else if (mode === "qc") setForm(emptyQcForm());
    else if (mode === "send-outsourcing")
      setForm(emptySendOutsourcingForm(targetStage));
    else setForm(emptyReceiveOutsourcingForm());
  };

  const closeAction = () => {
    setActionState(null);
    setForm({});
    setFormError("");
  };

  /* ============================================================
     SUBMIT — one POST for every mode
     ------------------------------------------------------------
     Returns the server response, or throws. Callers decide whether
     to refresh, close the modal, navigate away, etc.
     ============================================================ */

  const submitAction = async (payload) => {
    if (!actionState) throw new Error("No action in flight.");

    setSaving(true);
    setFormError("");

    try {
      const res = await api.post(
        `${API_BASE}/production/operation/${actionState.assemblyId}/action/`,
        {
          sequence: actionState.sequence,
          mode: actionState.mode,
          ...payload,
        },
        { headers: authHeaders() }
      );

      await fetchExecutions({ silent: true });
      return res;
    } catch (err) {
      console.error("Action failed:", err);
      const message = getApiError(err, "Action failed. Please try again.");
      setFormError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     VALIDATION + DISPATCH PER MODE
     ============================================================ */

  const handleSaveStart = async () => {
    if (!form.startedBy)
      return setFormError("Please select Started By.");
    if (!form.supervisedBy)
      return setFormError("Please select Supervisor.");

    try {
      await submitAction({
        startedBy: form.startedBy,
        supervisedBy: form.supervisedBy,
        remarks: form.remarks?.trim() || "",
      });
      closeAction();
    } catch {
      /* formError already set */
    }
  };

  const handleSaveComplete = async () => {
    const completed = Number(form.completedQty) || 0;
    const rejected = Number(form.rejectedQty) || 0;

    if (completed + rejected <= 0)
      return setFormError("Enter Completed and/or Rejected Quantity.");

    if (rejected > 0 && !form.by) {
      return setFormError(
        "Select who is flagging the rejected quantity for rework."
      );
    }

    if (
      actionStage &&
      completed + rejected > actionStage.pendingOperationQty
    ) {
      return setFormError(
        `Completed + Rejected cannot exceed the pending quantity (${actionStage.pendingOperationQty}).`
      );
    }

    try {
      await submitAction({
        completedQty: completed,
        rejectedQty: rejected,
        remarks: form.remarks?.trim() || "",
        by: form.by || "",
      });
      closeAction();
    } catch {
      /* formError already set */
    }
  };

  const handleSaveQc = async () => {
    const accepted = Number(form.acceptedQty) || 0;
    const rejected = Number(form.rejectedQty) || 0;

    if (!form.verifiedBy)
      return setFormError("Please select QC Verified By.");
    if (accepted + rejected <= 0)
      return setFormError("Enter Accepted and/or Rejected Quantity.");

    if (
      actionStage &&
      accepted + rejected > actionStage.awaitingQcQty
    ) {
      return setFormError(
        `Accepted + Rejected cannot exceed the quantity awaiting QC (${actionStage.awaitingQcQty}).`
      );
    }

    try {
      await submitAction({
        acceptedQty: accepted,
        rejectedQty: rejected,
        verifiedBy: form.verifiedBy,
        remarks: form.remarks?.trim() || "",
      });
      closeAction();
    } catch {
      /* formError already set */
    }
  };

  /* ============================================================
     SEND TO OUTSOURCING
     ------------------------------------------------------------
     1. Save the send on the backend (updates the stage counters).
     2. Write the prefill to localStorage so the DC form lands
        pre-populated.
     3. Navigate to the Delivery Challan page.

     The DC page reads `pendingDeliveryChallanPrefill` on mount.
     Once the user confirms the DC there, the DC number will be
     the one we generated — and matching it back to this stage's
     Send Out movement is trivial (dc_ref column).
     ============================================================ */
  const handleSaveSendOutsourcing = async () => {
    const qty = Number(form.qty) || 0;

    if (qty <= 0)
      return setFormError("Enter the quantity to send to the vendor.");

    if (actionStage && qty > actionStage.pendingOperationQty) {
      return setFormError(
        `Quantity cannot exceed what is available to send (${actionStage.pendingOperationQty}).`
      );
    }

    const dcRef = generateDcRef();

    // Prefill the DC module so the user lands on a populated form
    try {
      window.localStorage.setItem(
        "pendingDeliveryChallanPrefill",
        JSON.stringify({
          dcNumber: dcRef,
          deliveryAt: actionStage?.vendorLocation || "",
          customer: {
            companyName: actionStage?.vendor || "",
            address: actionStage?.vendorLocation || "",
            phone: actionStage?.vendorContact || "",
            returnable: true,
          },
          items: [
            {
              description: `${actionState.assemblyId} — ${actionStage?.name} (${actionStage?.processId})`,
              quantity: qty,
              remarks: `Job work — expected return ${
                form.expectedReturnDate ||
                actionStage?.expectedReturnDate ||
                "—"
              }`,
            },
          ],
        })
      );
    } catch (e) {
      console.error("Failed to stage DC prefill:", e);
      /* non-fatal — the send is still recorded on the backend */
    }

    try {
      await submitAction({
        qty,
        expectedReturnDate: form.expectedReturnDate || "",
        remarks: form.remarks?.trim() || "",
        dcRef,
      });
      closeAction();

      // Redirect to the Delivery Challan module
      navigate(DELIVERY_CHALLAN_ROUTE);
    } catch {
      /* formError already set; stay on the modal */
    }
  };

  /* ============================================================
     RECEIVE FROM OUTSOURCING
     ------------------------------------------------------------
     No redirect. Stays on the page and refreshes the row.
     ============================================================ */
  const handleSaveReceiveOutsourcing = async () => {
    const qty = Number(form.receivedQty) || 0;

    if (qty <= 0)
      return setFormError("Enter the quantity received from the vendor.");

    const pendingReturn = actionStage
      ? actionStage.sentQty - actionStage.receivedQty
      : 0;

    if (qty > pendingReturn) {
      return setFormError(
        `Received quantity cannot exceed the quantity still pending from the vendor (${pendingReturn}).`
      );
    }

    try {
      await submitAction({
        receivedQty: qty,
        remarks: form.remarks?.trim() || "",
      });
      closeAction();
    } catch {
      /* formError already set */
    }
  };

  /* ============================================================
     BACK HANDLER
     ============================================================ */

  function handleBack() {
    navigate("/inventory/material");
  }

  /* ============================================================
     RENDER
     ============================================================ */

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="material-page">
          <div className="material-content">
            <Loading />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="material-page">
          <div className="material-content">
            <Error
              message={error}
              onRetry={() => fetchExecutions()}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="material-page">
        <div className="material-content">
          {/* ============ PAGE HEADER ============ */}
          <div className="page-header-wrap">
            <div className="page-header-left">
              <button className="back-button" onClick={handleBack}>
                <ArrowLeft size={16} strokeWidth={2} />
                Back
              </button>
              <div className="page-header-title-group">
                <h1 className="page-header-title">
                  Production Operation
                </h1>
                <p className="page-header-subtitle">
                  Execute the assembly process route already defined in
                  Production Assembly Integration. Rejected quantity
                  flows into the Rework module; outsourced stages hand
                  off to Delivery Challan.
                </p>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchExecutions({ silent: true })}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw size={14} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* ============ PROJECT SELECTOR ============ */}
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
              {projectOptions.length === 0 && (
                <option value="">— No projects —</option>
              )}
              {projectOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="project-hint">
              Showing integrated assemblies under{" "}
              <strong>{selectedProject || "—"}</strong>
            </span>
          </div>

          {/* ============ TABLE PANEL ============ */}
          <div className="panel">
            <FilterPanel
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={handleFilterChange}
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
                    <th>Required Qty</th>
                    <th>Pending Qty</th>
                    <th>Current Process</th>
                    <th>Execution</th>
                    <th>QC Status</th>
                    <th>Overall Status</th>
                    <th className="cell-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">
                          <div className="empty-state-icon">🏭</div>
                          <p className="empty-state-title">
                            No Assemblies Found
                          </p>
                          <p className="empty-state-desc">
                            No integrated assembly matches the current
                            project / search / filters.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredRows.map((row) => (
                    <tr key={row.assemblyId}>
                      <td
                        data-label="Assembly ID"
                        className="mono"
                        style={{
                          fontWeight: 600,
                          color: "var(--primary-dark)",
                        }}
                      >
                        {row.assemblyId}
                      </td>
                      <td data-label="Project">{row.project}</td>
                      <td data-label="Required Qty" className="cell-num">
                        {row.requiredQty}
                      </td>
                      <td data-label="Pending Qty" className="cell-num">
                        {row.pendingQty}
                      </td>
                      <td data-label="Current Process">
                        {row.currentProcessName}
                      </td>
                      <td data-label="Execution">
                        <span
                          className={`exec-pill ${
                            row.executionType === "Outsourcing"
                              ? "exec-pill-outsource"
                              : "exec-pill-inhouse"
                          }`}
                        >
                          {row.executionLabel}
                        </span>
                      </td>
                      <td data-label="QC Status">
                        <QcStatusBadge status={row.qcStatusLabel} />
                      </td>
                      <td data-label="Overall Status">
                        <OverallStatusBadge status={row.overallStatus} />
                      </td>
                      <td data-label="Action">
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            justifyContent: "center",
                            alignItems: "flex-start",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openView(row.assemblyId)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              width: 30,
                              height: 30,
                              padding: 0,
                            }}
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <AssemblyActionButtons
                            row={row}
                            onOpen={openAction}
                            onGoToRework={() => navigate(REWORK_ROUTE)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============ EYE VIEW MODAL ============ */}
          {viewExecution && (
            <div className="modal-overlay" onClick={closeView}>
              <div
                className="modal-box modal-box-wide"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {viewExecution.assemblyId}
                    </h2>
                    <p className="modal-subtitle">
                      Project : <strong>{viewExecution.project}</strong>
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
                  <EyeViewBody
                    execution={viewExecution}
                    onJump={jumpToAssembly}
                    onGoToRework={() => navigate(REWORK_ROUTE)}
                    onGoToDeliveryChallan={() =>
                      navigate(DELIVERY_CHALLAN_ROUTE)
                    }
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

          {/* ============ ACTION MODAL ============ */}
          {actionState && actionExecution && actionStage && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-head">
                  <div>
                    <h2 className="modal-title">
                      {ACTION_TITLES[actionState.mode]}
                    </h2>
                    <p className="modal-subtitle">
                      Assembly :{" "}
                      <strong>{actionExecution.assemblyId}</strong> ·
                      Process :{" "}
                      <strong>
                        {actionStage.name} - {actionStage.processId}
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
                    execution={actionExecution}
                    stage={actionStage}
                    mode={actionState.mode}
                    form={form}
                    setForm={setForm}
                    employees={employees}
                  />
                  {formError && (
                    <div className="error-box">{formError}</div>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={closeAction}
                    className="btn btn-secondary"
                    disabled={saving}
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
                        "send-outsourcing":
                          handleSaveSendOutsourcing,
                        "receive-outsourcing":
                          handleSaveReceiveOutsourcing,
                      }[actionState.mode]
                    }
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving…"
                      : ACTION_SAVE_LABELS[actionState.mode]}
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

/* ============================================================
   FILTER PANEL
   ============================================================ */

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
  const activeFilterCount = Object.values(filters).filter(
    Boolean
  ).length;

  return (
    <div className="panel-toolbar">
      <div className="panel-toolbar-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          placeholder="Search Assembly ID, Project..."
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

/* ============================================================
   ACTION BUTTONS
   ============================================================ */

function AssemblyActionButtons({ row, onOpen, onGoToRework }) {
  if (row.currentIndex === -1) {
    return <span className="locked-pill locked-final">Completed</span>;
  }

  const s = row.currentStage;

  if (!s) {
    return (
      <span className="locked-pill locked-pending">
        Awaiting Setup
      </span>
    );
  }

  if (s.availableQty === 0 && s.reworkQty === 0 && s.awaitingQcQty === 0) {
    return (
      <span className="locked-pill locked-pending">
        Material Pending
      </span>
    );
  }

  const openReworkRecords = (s.reworkRecords || []).filter(
    (r) =>
      r.status !== "Ready for Next Process" &&
      r.status !== "Available in Material Stock" &&
      r.status !== "Cancelled"
  );

  const buttons = [];

  // ---- Rework section ----
  // If there is an open ReworkRecord, the user must finish it in the
  // Rework module. We surface that as a "Go to Rework Module" button.
  if (s.reworkQty > 0) {
    if (openReworkRecords.length > 0) {
      const ids = openReworkRecords
        .map((r) => r.reworkId)
        .join(", ");
      buttons.push(
        <button
          key="goto-rework"
          type="button"
          onClick={onGoToRework}
          className="btn btn-rework btn-sm"
          title={`Open Rework module to finish ${ids}`}
        >
          ⚠ Go to Rework ({s.reworkQty}) — {ids}
        </button>
      );
    } else {
      // Edge case: qty is held but there is no open record (usually
      // means it was already handed back but the stage hasn't
      // refreshed). Fall back to a plain informational pill.
      buttons.push(
        <span key="rework-hold" className="locked-pill locked-pending">
          ⚠ {s.reworkQty} in Rework
        </span>
      );
    }
  }

  // ---- QC ----
  if (s.awaitingQcQty > 0) {
    buttons.push(
      <button
        key="qc"
        type="button"
        onClick={() => onOpen(row.assemblyId, s.sequence, "qc")}
        className="btn btn-qc btn-sm"
      >
        ▶ QC Verify ({s.awaitingQcQty})
      </button>
    );
  }

  // ---- Outsourcing vs In-House ----
  if (s.executionType === "Outsourcing") {
    const pendingReturn = s.sentQty - s.receivedQty;

    if (s.pendingOperationQty > 0) {
      buttons.push(
        <button
          key="send-outsourcing"
          type="button"
          onClick={() =>
            onOpen(row.assemblyId, s.sequence, "send-outsourcing")
          }
          className="btn btn-outsource btn-sm"
        >
          🚚 Send to Outsourcing ({s.pendingOperationQty})
        </button>
      );
    }

    if (pendingReturn > 0) {
      buttons.push(
        <button
          key="receive-outsourcing"
          type="button"
          onClick={() =>
            onOpen(row.assemblyId, s.sequence, "receive-outsourcing")
          }
          className="btn btn-primary btn-sm"
        >
          {s.receivedQty > 0
            ? `↩ Receive Remaining (${pendingReturn})`
            : `↩ Receive From Outsourcing (${pendingReturn})`}
        </button>
      );
    }
  } else if (s.pendingOperationQty > 0) {
    buttons.push(
      s.started ? (
        <button
          key="complete"
          type="button"
          onClick={() =>
            onOpen(row.assemblyId, s.sequence, "complete")
          }
          className="btn btn-primary btn-sm"
        >
          ▶ Complete Process
        </button>
      ) : (
        <button
          key="start"
          type="button"
          onClick={() =>
            onOpen(row.assemblyId, s.sequence, "start")
          }
          className="btn btn-primary btn-sm"
        >
          ▶ Start Process
        </button>
      )
    );
  }

  if (buttons.length === 0) {
    return (
      <span className="locked-pill locked-pending">
        Awaiting Next Batch
      </span>
    );
  }

  return <div className="action-stack">{buttons}</div>;
}

/* ============================================================
   STATUS BADGES
   ============================================================ */

function OverallStatusBadge({ status }) {
  const map = {
    Planned: "status-badge-neutral",
    "Material Pending": "status-badge-warning",
    "Ready for Production": "status-badge-info",
    "In Progress": "status-badge-info",
    Outsourcing: "status-badge-purple",
    "Waiting for Return": "status-badge-warning",
    "Partially Received": "status-badge-warning",
    "QC Pending": "status-badge-warning",
    "QC Rejected": "status-badge-danger",
    "Rework Required": "status-badge-danger",
    "Ready for Next Process": "status-badge-purple",
    Completed: "status-badge-success",
  };
  return (
    <span className={`status-badge ${map[status] || ""}`}>
      {status}
    </span>
  );
}

function QcStatusBadge({ status }) {
  const map = {
    "Not Started": "qc-badge-notstarted",
    Pending: "qc-badge-pending",
    Accepted: "qc-badge-accepted",
    Rejected: "qc-badge-rejected",
    "Not Required": "qc-badge-na",
  };
  return (
    <span className={`qc-badge ${map[status] || ""}`}>
      {status}
    </span>
  );
}

/* ============================================================
   PROCESS ROUTE TIMELINE
   ============================================================ */

function ProcessRouteTimeline({ execution }) {
  const currentIndex = getCurrentStageIndex(execution);

  return (
    <ol className="process-chain">
      {execution.stages.map((s, idx) => {
        let stepClass = "process-chain-step";
        let icon = "○";
        let tag = null;

        const fullyReleased = s.releasedQty >= execution.plannedQty;
        const openRework = (s.reworkRecords || []).some(
          (r) =>
            r.status !== "Ready for Next Process" &&
            r.status !== "Available in Material Stock" &&
            r.status !== "Cancelled"
        );

        if (openRework || s.reworkQty > 0) {
          stepClass += " process-chain-rework";
          icon = "⚠";
          tag = "REWORK";
        } else if (fullyReleased) {
          stepClass += " process-chain-done";
          icon = "✓";
        } else if (idx === currentIndex) {
          stepClass += " process-chain-current";
          icon = "●";
          const pendingReturn = s.sentQty - s.receivedQty;
          if (
            s.executionType === "Outsourcing" &&
            pendingReturn > 0
          ) {
            tag =
              s.receivedQty > 0
                ? "PARTIALLY RECEIVED"
                : "WAITING FOR RETURN";
          } else if (
            s.awaitingQcQty > 0 &&
            s.pendingOperationQty === 0
          ) {
            tag = "AWAITING QC";
          } else {
            tag = "CURRENT";
          }
        } else {
          stepClass += " process-chain-locked";
          icon = s.availableQty === 0 ? "🔒" : "○";
        }

        return (
          <li key={s.sequence} className={stepClass}>
            <span className="process-chain-icon">{icon}</span>
            <span className="process-chain-seq">{s.sequence}</span>
            <span className="process-chain-name">{s.name}</span>
            <span className="process-chain-id">{s.processId}</span>
            <span className="process-chain-qty">
              {s.releasedQty}/{execution.plannedQty} released
              {s.reworkQty > 0 ? ` · ${s.reworkQty} in rework` : ""}
              {s.awaitingQcQty > 0
                ? ` · ${s.awaitingQcQty} awaiting QC`
                : ""}
            </span>
            {!s.qcRequired && (
              <span className="process-chain-noqc">
                QC not required
              </span>
            )}
            <span
              className={`process-chain-exec ${
                s.executionType === "Outsourcing"
                  ? "process-chain-exec-outsource"
                  : ""
              }`}
            >
              {s.executionType === "Outsourcing"
                ? `Outsourced — ${s.vendor || "—"}`
                : `In-House — ${s.executionUnit || "Unit 1"}`}
            </span>
            {tag && <span className="process-chain-tag">{tag}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   ACTION MODAL BODY
   ============================================================ */

function ActionModalBody({
  execution,
  stage: s,
  mode,
  form,
  setForm,
  employees,
}) {
  const hasEmployees = employees && employees.length > 0;

  return (
    <>
      <div className="modal-card">
        <h3 className="modal-card-title">Assembly &amp; Process</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Assembly"
            value={execution.assemblyId}
            emphasize
          />
          <ReadonlyField label="Project" value={execution.project} />
          <ReadonlyField label="Process" value={s.name} />
          <ReadonlyField label="Process ID" value={s.processId} />
          <ReadonlyField
            label="Planned Quantity"
            value={execution.plannedQty}
          />
          <ReadonlyField
            label="Available At This Stage"
            value={s.availableQty}
          />
          {s.executionType === "Outsourcing" ? (
            <>
              <ReadonlyField
                label="Execution"
                value="Outsourcing"
                emphasize
              />
              <ReadonlyField
                label="Vendor"
                value={s.vendor || "—"}
              />
            </>
          ) : (
            <ReadonlyField
              label="Execution"
              value={`In-House — ${s.executionUnit || "Unit 1"}`}
            />
          )}
          {mode === "complete" && (
            <ReadonlyField
              label="Pending Operation Qty"
              value={s.pendingOperationQty}
              emphasize
            />
          )}
          {mode === "qc" && (
            <ReadonlyField
              label="Awaiting QC Qty"
              value={s.awaitingQcQty}
              emphasize
            />
          )}
          {mode === "send-outsourcing" && (
            <ReadonlyField
              label="Available To Send"
              value={s.pendingOperationQty}
              emphasize
            />
          )}
          {mode === "receive-outsourcing" && (
            <>
              <ReadonlyField
                label="Sent To Vendor"
                value={s.sentQty}
              />
              <ReadonlyField
                label="Received So Far"
                value={s.receivedQty}
              />
              <ReadonlyField
                label="Pending From Vendor"
                value={s.sentQty - s.receivedQty}
                emphasize
              />
            </>
          )}
        </div>
      </div>

      {mode === "start" && (
        <div className="modal-card">
          <h3 className="modal-card-title">Production Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Started By</label>
              <select
                value={form.startedBy}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    startedBy: e.target.value,
                  }))
                }
              >
                <option value="">Select employee</option>
                {!hasEmployees && (
                  <option value="" disabled>
                    No employees available
                  </option>
                )}
                {employees.map((emp) => (
                  <option key={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Supervisor</label>
              <select
                value={form.supervisedBy}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    supervisedBy: e.target.value,
                  }))
                }
              >
                <option value="">Select employee</option>
                {!hasEmployees && (
                  <option value="" disabled>
                    No employees available
                  </option>
                )}
                {employees.map((emp) => (
                  <option key={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>Remarks</label>
            <textarea
              rows={3}
              placeholder="Optional notes..."
              value={form.remarks}
              onChange={(e) =>
                setForm((f) => ({ ...f, remarks: e.target.value }))
              }
            />
          </div>
        </div>
      )}

      {mode === "complete" && (
        <div className="modal-card">
          <h3 className="modal-card-title">Process Completion</h3>
          <p className="modal-card-subtitle">
            Partial completion is supported. Rejected quantity flows
            into the Rework module — it will not advance until it is
            marked Done there and QC accepts it.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Completed Quantity</label>
              <input
                type="number"
                min="0"
                value={form.completedQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    completedQty: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-field">
              <label>Rejected Quantity (needs rework)</label>
              <input
                type="number"
                min="0"
                value={form.rejectedQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rejectedQty: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-field form-field-full">
              <label>Flagged By (required if rejected &gt; 0)</label>
              <select
                value={form.by}
                onChange={(e) =>
                  setForm((f) => ({ ...f, by: e.target.value }))
                }
              >
                <option value="">Select employee</option>
                {!hasEmployees && (
                  <option value="" disabled>
                    No employees available
                  </option>
                )}
                {employees.map((emp) => (
                  <option key={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>Remarks</label>
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) =>
                setForm((f) => ({ ...f, remarks: e.target.value }))
              }
            />
          </div>
          <p className="modal-card-footnote">
            {s.qcRequired
              ? "Completed quantity moves to QC Pending. Rejected quantity goes to the Rework module."
              : "This process has no QC requirement, so completed quantity is released straight to the next process. Rejected quantity still goes to Rework."}
          </p>
        </div>
      )}

      {mode === "qc" && (
        <div className="modal-card">
          <h3 className="modal-card-title">QC Verification</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Accepted Quantity</label>
              <input
                type="number"
                min="0"
                value={form.acceptedQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    acceptedQty: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-field">
              <label>Rejected Quantity</label>
              <input
                type="number"
                min="0"
                value={form.rejectedQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rejectedQty: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-field form-field-full">
              <label>QC Verified By</label>
              <select
                value={form.verifiedBy}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    verifiedBy: e.target.value,
                  }))
                }
              >
                <option value="">Select employee</option>
                {!hasEmployees && (
                  <option value="" disabled>
                    No employees available
                  </option>
                )}
                {employees.map((emp) => (
                  <option key={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>QC Remarks</label>
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) =>
                setForm((f) => ({ ...f, remarks: e.target.value }))
              }
            />
          </div>
          <p className="modal-card-footnote">
            Accepted quantity is released to{" "}
            <strong>{nextStageName(execution, s.sequence)}</strong>.
            Rejected quantity moves to the Rework module.
          </p>
        </div>
      )}

      {mode === "send-outsourcing" && (
        <div className="modal-card">
          <h3 className="modal-card-title">
            Outsourcing Details (from Assembly)
          </h3>
          <p className="modal-card-subtitle">
            Vendor and location were configured in Production Assembly
            Integration and cannot be changed here.
          </p>
          <div className="readonly-grid">
            <ReadonlyField
              label="Vendor"
              value={s.vendor || "—"}
              emphasize
            />
            <ReadonlyField
              label="Vendor Contact"
              value={s.vendorContact || "—"}
            />
            <ReadonlyField
              label="Vendor Location"
              value={s.vendorLocation || "—"}
            />
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label>Quantity to Send</label>
              <input
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, qty: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Expected Return Date</label>
              <input
                type="date"
                value={form.expectedReturnDate}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expectedReturnDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>Remarks</label>
            <textarea
              rows={3}
              placeholder="Optional notes..."
              value={form.remarks}
              onChange={(e) =>
                setForm((f) => ({ ...f, remarks: e.target.value }))
              }
            />
          </div>
          <p className="modal-card-footnote">
            Saving will <strong>redirect you to the Delivery Challan
            module</strong> with this vendor and quantity pre-filled.
            The stage moves to <strong>Waiting for Return</strong>{" "}
            immediately — the DC is just the paper trail.
          </p>
        </div>
      )}

      {mode === "receive-outsourcing" && (
        <div className="modal-card">
          <h3 className="modal-card-title">
            Receive From Outsourcing
          </h3>
          <p className="modal-card-subtitle">
            Partial returns are supported — enter only what the vendor
            has actually sent back. The remainder stays{" "}
            <strong>Waiting for Return</strong>.
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label>Received Quantity</label>
              <input
                type="number"
                min="0"
                value={form.receivedQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    receivedQty: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label>Remarks</label>
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) =>
                setForm((f) => ({ ...f, remarks: e.target.value }))
              }
            />
          </div>
          <p className="modal-card-footnote">
            {s.qcRequired
              ? "Received quantity moves to QC Pending — it does not advance on its own."
              : "This process has no QC requirement, so received quantity is released straight to the next process."}
          </p>
        </div>
      )}
    </>
  );
}

/* ============================================================
   EYE VIEW BODY
   ============================================================ */

function EyeViewBody({
  execution,
  onJump,
  onGoToRework,
  onGoToDeliveryChallan,
}) {
  const currentIndex = getCurrentStageIndex(execution);
  const currentStage =
    currentIndex === -1 ? null : execution.stages[currentIndex];

  return (
    <>
      {/* 1. Assembly Information */}
      <div className="modal-card">
        <h3 className="modal-card-title">1. Assembly Information</h3>
        <div className="readonly-grid">
          <ReadonlyField
            label="Assembly ID"
            value={execution.assemblyId}
            emphasize
          />
          <ReadonlyField label="Project" value={execution.project} />
          <ReadonlyField
            label="Created Date"
            value={execution.createdDate}
          />
          <ReadonlyField
            label="Planned / Required Quantity"
            value={execution.plannedQty}
          />
          <ReadonlyField
            label="Overall Status"
            value={computeOverallStatus(
              execution,
              currentStage,
              currentIndex
            )}
            emphasize
          />
        </div>
      </div>

      {/* 2. Process Route Timeline */}
      <div className="modal-card">
        <h3 className="modal-card-title">
          2. Assembly Process Timeline
        </h3>
        <p className="modal-card-subtitle">
          Route defined in Production Assembly Integration — executed
          here, never redefined.
        </p>
        <ProcessRouteTimeline execution={execution} />
      </div>

      {/* 3. Current Process */}
      <div className="modal-card">
        <h3 className="modal-card-title">3. Current Process</h3>
        {currentIndex === -1 ? (
          <p className="modal-card-subtitle">
            All planned quantity has cleared every stage.{" "}
            {execution.assemblyId} has reached <strong>Completed</strong>.
          </p>
        ) : (
          <div className="readonly-grid">
            <ReadonlyField
              label="Process"
              value={currentStage.name}
              emphasize
            />
            <ReadonlyField
              label="Process ID"
              value={currentStage.processId}
            />
            <ReadonlyField
              label="Execution"
              value={
                currentStage.executionType === "Outsourcing"
                  ? `Outsourcing — ${currentStage.vendor || "—"}`
                  : `In-House — ${currentStage.executionUnit || "Unit 1"}`
              }
            />
            <ReadonlyField
              label="Available At Stage"
              value={currentStage.availableQty}
            />
            <ReadonlyField
              label="Pending Operation"
              value={currentStage.pendingOperationQty}
            />
            <ReadonlyField
              label="Awaiting QC"
              value={currentStage.awaitingQcQty}
            />
            <ReadonlyField
              label="Released"
              value={currentStage.releasedQty}
            />
          </div>
        )}
      </div>

      {/* 4. Outsourcing (conditional) */}
      {currentIndex !== -1 &&
        currentStage.executionType === "Outsourcing" && (
          <div className="modal-card">
            <h3 className="modal-card-title">4. Outsourcing</h3>
            <div className="readonly-grid">
              <ReadonlyField
                label="Vendor"
                value={currentStage.vendor || "—"}
                emphasize
              />
              <ReadonlyField
                label="Vendor Contact"
                value={currentStage.vendorContact || "—"}
              />
              <ReadonlyField
                label="Vendor Location"
                value={currentStage.vendorLocation || "—"}
              />
              <ReadonlyField
                label="Expected Return"
                value={
                  currentStage.lastOutsourcing?.expectedReturnDate ||
                  currentStage.expectedReturnDate ||
                  "—"
                }
              />
              <ReadonlyField
                label="Sent Qty"
                value={currentStage.sentQty}
              />
              <ReadonlyField
                label="Received Qty"
                value={currentStage.receivedQty}
              />
              <ReadonlyField
                label="Pending From Vendor"
                value={
                  currentStage.sentQty - currentStage.receivedQty
                }
                emphasize
              />
            </div>

            {currentStage.lastOutsourcing?.dcRef && (
              <div style={{ marginTop: 12 }}>
                <p
                  className="modal-card-subtitle"
                  style={{ marginBottom: 6 }}
                >
                  Delivery Challan raised for this process:
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onGoToDeliveryChallan}
                >
                  Open {currentStage.lastOutsourcing.dcRef}
                </button>
              </div>
            )}
          </div>
        )}

      {/* 5. QC Verification */}
      <div className="modal-card">
        <h3 className="modal-card-title">5. QC Verification</h3>
        {currentIndex !== -1 && currentStage.lastQc ? (
          <div className="readonly-grid">
            <ReadonlyField
              label="QC Status"
              value={computeQcStatusLabel(currentStage)}
            />
            <ReadonlyField
              label="QC Verified By"
              value={currentStage.lastQc.verifiedBy}
            />
            <ReadonlyField
              label="Accepted Qty"
              value={currentStage.lastQc.acceptedQty}
            />
            <ReadonlyField
              label="Rejected Qty"
              value={currentStage.lastQc.rejectedQty}
            />
            <ReadonlyField
              label="QC Remarks"
              value={currentStage.lastQc.remarks || "—"}
            />
            <ReadonlyField
              label="QC Date"
              value={currentStage.lastQc.date}
            />
          </div>
        ) : currentIndex !== -1 && !currentStage.qcRequired ? (
          <p className="modal-card-subtitle">
            QC is not required for {currentStage.name}.
          </p>
        ) : (
          <p className="modal-card-subtitle">
            No QC verification recorded yet for this stage.
          </p>
        )}
      </div>

      {/* 6. Rework Information */}
      {currentIndex !== -1 &&
        (currentStage.reworkQty > 0 ||
          (currentStage.reworkRecords || []).length > 0) && (
          <div className="modal-card modal-card-rework">
            <h3 className="modal-card-title">
              6. Rework Information
            </h3>
            <div className="readonly-grid">
              <ReadonlyField
                label="Currently In Rework"
                value={currentStage.reworkQty}
                emphasize
              />
            </div>

            {(currentStage.reworkRecords || []).length > 0 && (
              <>
                <p
                  className="modal-card-subtitle"
                  style={{ marginTop: 12, marginBottom: 6 }}
                >
                  Rework records raised for this stage:
                </p>
                <ul className="history-list">
                  {currentStage.reworkRecords.map((r) => (
                    <li key={r.id} className="history-item">
                      <span className="history-date">
                        {r.reworkId}
                      </span>
                      <span className="history-event">
                        {r.status} — required {r.requiredQty}, done{" "}
                        {r.completedQty}, balance {r.balanceQty}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-rework btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={onGoToRework}
                >
                  Open Rework Module
                </button>
              </>
            )}

            {currentStage.reworkQty > 0 && (
              <p className="modal-card-footnote">
                This quantity cannot proceed to{" "}
                <strong>
                  {nextStageName(execution, currentStage.sequence)}
                </strong>{" "}
                until the Rework module marks it done and QC accepts
                it.
              </p>
            )}
          </div>
        )}

      {/* 7. Production History */}
      <div className="modal-card">
        <h3 className="modal-card-title">7. Production History</h3>
        {!execution.events || execution.events.length === 0 ? (
          <p className="modal-card-subtitle">
            No production history recorded yet.
          </p>
        ) : (
          <ol className="history-list">
            {execution.events.map((h, idx) => (
              <li key={h.id ?? idx} className="history-item">
                <span className="history-date">{h.eventDate}</span>
                <span className="history-event">{h.event}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

/* ============================================================
   SMALL SHARED BITS
   ============================================================ */

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