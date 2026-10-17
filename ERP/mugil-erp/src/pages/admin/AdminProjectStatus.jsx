import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, X, ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./AdminProjectStatus.css";

const PROJECT_STATUS_ENDPOINT = "/erp/admin/project-status/";
const assemblyDetailEndpoint = (assemblyId) =>
  `/erp/admin/project-status/${encodeURIComponent(assemblyId)}/`;

const PROJECT_STATUSES = ["Active", "On Hold", "Completed"];
const PROCESS_CLASS = {
  "Not Started": "not-started",
  "Ready to Start": "ready",
  "In Progress": "in-progress",
  "Awaiting QC": "awaiting-qc",
  "In Rework": "in-rework",
  Outsourced: "outsourced",
  Completed: "completed",
  Cancelled: "cancelled",
  Pending: "pending",
};

const text = (value, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : value;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function statusClass(value) {
  const key = String(value || "Pending").trim();
  return PROCESS_CLASS[key] || "pending";
}

function StatusPill({ label, process }) {
  const safeLabel = label || "Pending";
  return (
    <span className={`aps-process aps-process--${statusClass(safeLabel)}`}>
      <span className="aps-process-dot" />
      <span>{process || safeLabel}</span>
      {process && process !== safeLabel && (
        <span className="aps-process-label">{safeLabel}</span>
      )}
    </span>
  );
}

function Quantity({ label, value }) {
  return (
    <div className="aps-quantity">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

function AssemblyDetailModal({ assemblyId, accessToken, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDetail = useCallback(async () => {
    if (!assemblyId) return;
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.get(assemblyDetailEndpoint(assemblyId), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || "Unable to load assembly details.");
      }
      setData(response.data.data || null);
    } catch (err) {
      console.error("Failed to load assembly details:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load assembly details. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [assemblyId, accessToken]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const assembly = data?.assembly;
  const stages = Array.isArray(data?.stages) ? data.stages : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const currentStage = data?.currentStage;

  return (
    <div className="aps-modal-backdrop" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <section
        className="aps-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aps-modal-title"
      >
        <header className="aps-modal-header">
          <div>
            <span className="aps-eyebrow">ASSEMBLY PROCESS TRACKER</span>
            <h2 id="aps-modal-title">{assemblyId}</h2>
            <p>
              {assembly?.projectName || ""}
              {assembly?.projectCode ? ` · ${assembly.projectCode}` : ""}
              {assembly?.dwgDescription ? ` · ${assembly.dwgDescription}` : ""}
            </p>
          </div>
          <button className="aps-close" type="button" onClick={onClose} aria-label="Close assembly details">
            <X size={20} />
          </button>
        </header>

        <div className="aps-modal-content">
          {loading ? (
            <div className="aps-state">
              <span className="aps-spinner" />
              <p>Loading assembly process details…</p>
            </div>
          ) : error ? (
            <div className="aps-state aps-state-error">
              <p>{error}</p>
              <button type="button" className="aps-btn" onClick={loadDetail}>
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          ) : (
            <>
              <div className="aps-detail-summary">
                <div>
                  <span className="aps-summary-label">Assembly status</span>
                  <strong>{text(assembly?.status)}</strong>
                </div>
                <div>
                  <span className="aps-summary-label">Execution status</span>
                  <strong>{text(assembly?.executionStatus)}</strong>
                </div>
                <div>
                  <span className="aps-summary-label">Started</span>
                  <strong>{formatDate(assembly?.startedAt)}</strong>
                </div>
                <div>
                  <span className="aps-summary-label">Completed</span>
                  <strong>{formatDate(assembly?.completedAt)}</strong>
                </div>
              </div>

              <div className="aps-current-stage">
                <div>
                  <span className="aps-summary-label">CURRENT PROCESS</span>
                  <h3>{text(currentStage?.name, "No current process")}</h3>
                  {currentStage?.processId && (
                    <span className="aps-process-id">{currentStage.processId}</span>
                  )}
                </div>
                <StatusPill
                  label={currentStage?.label || "Not Started"}
                  process={currentStage?.name}
                />
              </div>

              <div className="aps-section-heading">
                <div>
                  <h3>Assembly process route</h3>
                  <p>Stages are displayed in planned sequence order.</p>
                </div>
                <span className="aps-count">{stages.length} stages</span>
              </div>

              {stages.length === 0 ? (
                <div className="aps-empty">No process stages have been configured for this assembly.</div>
              ) : (
                <ol className="aps-stage-list">
                  {stages.map((stage, index) => {
                    const movements = Array.isArray(stage.movements) ? stage.movements : [];
                    const sequence = stage.sequence ?? index + 1;
                    return (
                      <li className={`aps-stage aps-stage--${statusClass(stage.status)}`} key={stage.id ?? `${sequence}-${stage.processId || stage.name}`}>
                        <div className="aps-stage-number">{sequence}</div>
                        <div className="aps-stage-main">
                          <div className="aps-stage-heading">
                            <div>
                              <h4>{text(stage.name, "Unnamed process")}</h4>
                              <p>
                                {stage.processId ? `${stage.processId} · ` : ""}
                                {text(stage.executionType, "Execution type not specified")}
                                {stage.executionUnit ? ` · ${stage.executionUnit}` : ""}
                              </p>
                            </div>
                            <StatusPill label={stage.status} />
                          </div>

                          <div className="aps-stage-tags">
                            {stage.qcRequired && <span className="aps-tag aps-tag-qc">QC required</span>}
                            {stage.started && <span className="aps-tag aps-tag-started">Started</span>}
                            {stage.executionType === "Outsourcing" && stage.vendor && (
                              <span className="aps-tag">Vendor: {stage.vendor}</span>
                            )}
                            {stage.expectedReturnDate && (
                              <span className="aps-tag">Expected return: {formatDate(stage.expectedReturnDate)}</span>
                            )}
                          </div>

                          <div className="aps-quantities">
                            <Quantity label="Available" value={stage.availableQty} />
                            <Quantity label="Pending" value={stage.pendingOperationQty} />
                            <Quantity label="Sent" value={stage.sentQty} />
                            <Quantity label="Received" value={stage.receivedQty} />
                            <Quantity label="Awaiting QC" value={stage.awaitingQcQty} />
                            <Quantity label="Rework" value={stage.reworkQty} />
                            <Quantity label="Released" value={stage.releasedQty} />
                          </div>

                          {movements.length > 0 && (
                            <details className="aps-movements">
                              <summary>{movements.length} movement{movements.length === 1 ? "" : "s"} · View movement history</summary>
                              <div className="aps-table-scroll">
                                <table className="aps-movement-table">
                                  <thead>
                                    <tr>
                                      <th>Date / time</th>
                                      <th>Movement</th>
                                      <th>Quantity</th>
                                      <th>Performed by</th>
                                      <th>Supervised by</th>
                                      <th>DC reference</th>
                                      <th>Remarks</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {movements.map((movement, movementIndex) => (
                                      <tr key={movement.id ?? `${sequence}-movement-${movementIndex}`}>
                                        <td>{formatDateTime(movement.createdAt)}</td>
                                        <td>{text(movement.movement)}</td>
                                        <td>{movement.quantity ?? 0}</td>
                                        <td>{text(movement.performedBy)}</td>
                                        <td>{text(movement.supervisedBy)}</td>
                                        <td>{text(movement.dcRef)}</td>
                                        <td>{text(movement.remarks)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {events.length > 0 && (
                <section className="aps-events">
                  <div className="aps-section-heading">
                    <div>
                      <h3>Production history</h3>
                      <p>Assembly-level events returned by Production Operation.</p>
                    </div>
                    <span className="aps-count">{events.length} events</span>
                  </div>
                  <ul>
                    {events.map((event, index) => (
                      <li key={event.id ?? `event-${index}`}>
                        <time>{formatDateTime(event.createdAt || event.date)}</time>
                        <span>{text(event.text, "Production event")}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {assembly?.notes && (
                <div className="aps-notes">
                  <strong>Assembly notes</strong>
                  <p>{assembly.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function AssemblyRows({ project, onViewAssembly }) {
  const [expanded, setExpanded] = useState(false);
  const assemblies = Array.isArray(project.assemblies) ? project.assemblies : [];

  return (
    <>
      <tr className="aps-project-row">
        <td>
          <div className="aps-project-cell">
            <button
              type="button"
              className="aps-expand-btn"
              onClick={() => setExpanded((value) => !value)}
              disabled={assemblies.length === 0}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse assemblies" : "Expand assemblies"}
              title={assemblies.length ? (expanded ? "Collapse assemblies" : "Expand assemblies") : "No assemblies"}
            >
              {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            <div className="aps-project-name">
              <strong>{text(project.name)}</strong>
              <span>{text(project.code, "No project code")}</span>
            </div>
          </div>
        </td>
        <td><span className={`aps-project-status aps-project-status--${String(project.status || "").toLowerCase().replace(/\s+/g, "-")}`}>{text(project.status)}</span></td>
        <td>
          <div className="aps-assembly-counts">
            <span>{project.totalAssemblies ?? assemblies.length} total</span>
            <span className="aps-count-done">{project.completedAssemblies ?? 0} completed</span>
          </div>
        </td>
        <td>{formatDate(project.startDate)}</td>
        <td>{formatDate(project.endDate)}</td>
      </tr>

      {expanded && assemblies.length > 0 && assemblies.map((assembly, index) => (
        <tr className="aps-assembly-row" key={assembly.id ?? assembly.assemblyId ?? index}>
          <td>
            <div className="aps-assembly-identity">
              <span className="aps-subrow-label">ASSEMBLY</span>
              <strong>{text(assembly.assemblyId)}</strong>
              <span>{text(assembly.dwgDescription, "No drawing description")}</span>
            </div>
          </td>
          <td><span className="aps-muted">{text(assembly.status)}</span></td>
          <td><span className="aps-muted">—</span></td>
          <td><span className="aps-muted">—</span></td>
          <td className="aps-action-cell">
            <button
              type="button"
              className="aps-eye-btn"
              onClick={() => onViewAssembly(assembly.assemblyId)}
              disabled={!assembly.assemblyId}
              aria-label={`View process details for ${assembly.assemblyId || "assembly"}`}
              title="View assembly process and history"
            >
              <Eye size={18} />
              <span>View</span>
            </button>
          </td>
        </tr>
      ))}
      {expanded && assemblies.length === 0 && (
        <tr className="aps-assembly-row">
          <td colSpan={5}><div className="aps-empty-inline">No assemblies linked to this project.</div></td>
        </tr>
      )}
    </>
  );
}

export default function AdminProjectStatus() {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAssemblyId, setActiveAssemblyId] = useState(null);

  const loadProjects = useCallback(async () => {
    if (!accessToken) {
      setProjects([]);
      setLoading(false);
      setError("You are not authenticated. Please sign in again.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.get(PROJECT_STATUS_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || "Invalid project status response.");
      }
      const result = Array.isArray(response.data.data) ? response.data.data : [];
      setProjects(result);
    } catch (err) {
      console.error("Failed to load project status:", err);
      setProjects([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load project status. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesStatus = status === "all" || project.status === status;
      const matchesSearch =
        !query ||
        String(project.name || "").toLowerCase().includes(query) ||
        String(project.code || "").toLowerCase().includes(query) ||
        (Array.isArray(project.assemblies) &&
          project.assemblies.some((assembly) =>
            String(assembly.assemblyId || "").toLowerCase().includes(query),
          ));
      return matchesStatus && matchesSearch;
    });
  }, [projects, search, status]);

  const totalAssemblies = projects.reduce(
    (sum, project) => sum + Number(project.totalAssemblies ?? project.assemblies?.length ?? 0),
    0,
  );
  const completedProjects = projects.filter((project) => project.status === "Completed").length;

  return (
    <main className="admin-project-status-page">
      <section className="aps-hero">
        <div>
          <span className="aps-hero-kicker">MUGIL ERP · PROJECT CONTROL</span>
          <h1>Project Status</h1>
          <p>Track every project, assembly, current production process, quantities, quality checks, and movement history.</p>
        </div>
        {/* <button type="button" className="aps-refresh-btn" onClick={loadProjects} disabled={loading}>
          <RefreshCw size={16} className={loading ? "aps-spin-icon" : ""} />
          Refresh
        </button> */}
      </section>

      <section className="aps-stats">
        <div className="aps-stat-card"><span>Total projects</span><strong>{projects.length}</strong></div>
        <div className="aps-stat-card"><span>Total assemblies</span><strong>{totalAssemblies}</strong></div>
        <div className="aps-stat-card"><span>Completed projects</span><strong>{completedProjects}</strong></div>
      </section>

      <section className="aps-table-card">
        <div className="aps-table-header">
          <div>
            <h2>Projects &amp; Assemblies</h2>
            <p>Expand a project, then select the eye button to inspect the assembly route.</p>
          </div>
          <span className="aps-result-count">{filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}</span>
        </div>

        <div className="aps-toolbar">
          <label className="aps-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project, project code, or assembly"
            />
          </label>
          <label className="aps-filter">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="aps-page-state"><span className="aps-spinner" /><p>Loading project status…</p></div>
        ) : error ? (
          <div className="aps-page-state aps-state-error">
            <p>{error}</p>
            <button type="button" className="aps-btn" onClick={loadProjects}><RefreshCw size={15} /> Try again</button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="aps-page-state">
            <p>{projects.length ? "No projects match your search or status filter." : "No projects have been created yet."}</p>
          </div>
        ) : (
          <div className="aps-table-scroll">
            <table className="aps-project-table">
              <thead>
                <tr>
                  <th>Project / Assembly</th>
                  <th>Status</th>
                  <th>Assembly count</th>
                  <th>Start date / Assembly status</th>
                  <th>End date / Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <AssemblyRows
                    key={project.id ?? project.code}
                    project={project}
                    onViewAssembly={setActiveAssemblyId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="aps-footnote">
        Current process and stage quantities are read from the assembly execution data returned by Production Operation.
      </p>

      {activeAssemblyId && (
        <AssemblyDetailModal
          assemblyId={activeAssemblyId}
          accessToken={accessToken}
          onClose={() => setActiveAssemblyId(null)}
        />
      )}
    </main>
  );
}
