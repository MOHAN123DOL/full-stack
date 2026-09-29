import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./Attendance.css";
import "./Payroll.css";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "HALF_DAY",
  "ABSENT",
  "PAID_LEAVE",
  "UNPAID_LEAVE",
  "HOLIDAY",
  "WEEKLY_OFF",
  "WFH",
];

export const STATUS_META = {
  PRESENT: { label: "Present", requiresTime: true },
  HALF_DAY: { label: "Half Day", requiresTime: true },
  WFH: { label: "Work From Home", requiresTime: true },
  ABSENT: { label: "Absent", requiresTime: false },
  UNPAID_LEAVE: { label: "Unpaid Leave", requiresTime: false },
  PAID_LEAVE: { label: "Paid Leave", requiresTime: false },
  HOLIDAY: { label: "Holiday", requiresTime: false },
  WEEKLY_OFF: { label: "Weekly Off", requiresTime: false },
};

export function statusLabel(status) {
  return STATUS_META[status]?.label || status;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatINR(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatHours(hours) {
  return `${(Number(hours) || 0).toFixed(2)} hrs`;
}

export function formatDisplayDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* ==========================================================================
   HOOKS / HELPERS
   ========================================================================== */

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function extractError(err, fallback = "Something went wrong.") {
  const d = err?.response?.data;
  if (!d) return err?.message || fallback;
  if (typeof d === "string") return d;
  if (d.detail) return String(d.detail);
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }
  return fallback;
}

/* ==========================================================================
   DROPDOWN OPTIONS (Title Case to match Django choices)
   ========================================================================== */

const DEPARTMENTS = [
  { value: "", label: "All Departments" },
  { value: "Engineering", label: "Engineering" },
  { value: "Production", label: "Production" },
  { value: "HR", label: "HR" },
  { value: "Sales", label: "Sales" },
  { value: "Accounts", label: "Accounts" },
];

const EMPLOYMENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "Permanent", label: "Permanent" },
  { value: "Probation", label: "Probation" },
  { value: "Contract", label: "Contract" },
  { value: "Temporary", label: "Temporary" },
  { value: "Intern", label: "Intern" },
  { value: "Consultant", label: "Consultant" },
];

const BRANCHES = [
  { value: "", label: "All Branches" },
  { value: "Trichy", label: "Trichy" },
  { value: "Chennai", label: "Chennai" },
  { value: "Coimbatore", label: "Coimbatore" },
  { value: "Madurai", label: "Madurai" },
];

const WORK_LOCATIONS = [
  { value: "", label: "All Locations" },
  { value: "Trichy", label: "Trichy" },
  { value: "Chennai", label: "Chennai" },
  { value: "Coimbatore", label: "Coimbatore" },
  { value: "Madurai", label: "Madurai" },
];

/* ==========================================================================
   ATTENDANCE API HOOK
   ========================================================================== */

function useAttendanceApi() {
  const { accessToken } = useAuth();

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const buildQuery = (params) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) q.append(k, v);
    });
    return q.toString();
  };

  const getEmployees = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
        page: params.page || 1,
        page_size: params.page_size || 25,
      });
      const res = await api.get(`/erp/attendance/employees/?${query}`, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders]
  );

  const getAttendance = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        date: params.date || "",
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
        status: params.status || "",
        employee_id: params.employee_id || "",
        page: params.page || 1,
        page_size: params.page_size || 50,
      });
      const res = await api.get(`/erp/attendance/?${query}`, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders]
  );

  const createAttendance = useCallback(
    async (data) => {
      const res = await api.post("/erp/attendance/", data, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders]
  );

  const updateAttendance = useCallback(
    async (id, data) => {
      const res = await api.patch(`/erp/attendance/${id}/`, data, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders]
  );

  const deleteAttendance = useCallback(
    async (id) => {
      const res = await api.delete(`/erp/attendance/${id}/`, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders]
  );

  const getWeeklySummary = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        date: params.date || "",
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
      });
      const res = await api.get(
        `/erp/attendance/weekly-summary/?${query}`,
        { headers: authHeaders() }
      );
      return res.data;
    },
    [authHeaders]
  );

  const getMonthlySummary = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        month: params.month || "",
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
      });
      const res = await api.get(
        `/erp/attendance/monthly-summary/?${query}`,
        { headers: authHeaders() }
      );
      return res.data;
    },
    [authHeaders]
  );

  const getEmployeeSummary = useCallback(
    async (employeeId) => {
      const res = await api.get(
        `/erp/attendance/employee-summary/?employee=${employeeId}`,
        { headers: authHeaders() }
      );
      return res.data;
    },
    [authHeaders]
  );

  const getWageConfigByEmployee = useCallback(
    async (employeeId) => {
      const res = await api.get(
        `/erp/wage-config/?employee_id=${employeeId}`,
        { headers: authHeaders() }
      );
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.results || res.data?.data || [];
      return list[0] || null;
    },
    [authHeaders]
  );

  const upsertWageConfig = useCallback(
    async (employeeId, data) => {
      const res = await api.post(
        "/erp/wage-config/",
        { employee: employeeId, ...data },
        { headers: authHeaders() }
      );
      return res.data;
    },
    [authHeaders]
  );

  return useMemo(
    () => ({
      getEmployees,
      getAttendance,
      createAttendance,
      updateAttendance,
      deleteAttendance,
      getWeeklySummary,
      getMonthlySummary,
      getEmployeeSummary,
      getWageConfigByEmployee,
      upsertWageConfig,
    }),
    [
      getEmployees,
      getAttendance,
      createAttendance,
      updateAttendance,
      deleteAttendance,
      getWeeklySummary,
      getMonthlySummary,
      getEmployeeSummary,
      getWageConfigByEmployee,
      upsertWageConfig,
    ]
  );
}

/* ==========================================================================
   CONTEXT PROVIDER (kept for backwards compat)
   ========================================================================== */

const AttendanceContext = createContext(null);

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used within AttendanceProvider");
  return ctx;
}

export function AttendanceProvider({ children }) {
  const api = useAttendanceApi();
  const value = useMemo(() => api, [api]);
  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
}

/* ==========================================================================
   UI PRIMITIVES
   ========================================================================== */

function SummaryCard({ label, value, sub }) {
  return (
    <div className="aw-summary-card">
      <span className="aw-summary-label">{label}</span>
      <span className="aw-summary-value">{value}</span>
      {sub && <span className="aw-summary-sub">{sub}</span>}
    </div>
  );
}

function StatusPill({ status }) {
  const cls = status ? status.toLowerCase().replace(/_/g, "-") : "unknown";
  return (
    <span className={`aw-status-pill aw-status-${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

/* ==========================================================================
   SHARED FILTER BAR
   ========================================================================== */

function FilterControls({ filters, onChange, onClear, showStatus = false }) {
  const dirty =
    filters.search ||
    filters.department ||
    filters.branch ||
    filters.employment_type ||
    filters.work_location ||
    (showStatus && filters.status);

  function set(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="aw-toolbar" style={{ marginBottom: 14 }}>
      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Employee Search</span>
        <input
          className="aw-input"
          type="text"
          placeholder="Name / ID…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
      </label>

      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Department</span>
        <select
          className="aw-select"
          value={filters.department}
          onChange={(e) => set("department", e.target.value)}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Branch</span>
        <select
          className="aw-select"
          value={filters.branch}
          onChange={(e) => set("branch", e.target.value)}
        >
          {BRANCHES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Employment Type</span>
        <select
          className="aw-select"
          value={filters.employment_type}
          onChange={(e) => set("employment_type", e.target.value)}
        >
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Work Location</span>
        <select
          className="aw-select"
          value={filters.work_location}
          onChange={(e) => set("work_location", e.target.value)}
        >
          {WORK_LOCATIONS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      {showStatus && (
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Attendance Status</span>
          <select
            className="aw-select"
            value={filters.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">All</option>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      )}

      {dirty && (
        <button
          type="button"
          className="aw-btn-outline aw-btn-sm"
          onClick={onClear}
          style={{ alignSelf: "flex-end" }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

/* ==========================================================================
   EMPLOYEE SEARCH SELECT (server-side, debounced, paginated)
   ========================================================================== */

function EmployeeSearchSelect({ value, onChange, filters }) {
  const { getEmployees } = useAttendance();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const debounced = useDebounce(search, 400);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getEmployees({
          search: debounced,
          department: filters.department,
          branch: filters.branch,
          employment_type: filters.employment_type,
          work_location: filters.work_location,
          page,
          page_size: 25,
        });
        if (!cancelled) {
          const list = data.results || data.data || [];
          setResults(list);
          const total = data.count || list.length;
          setTotalPages(
            data.total_pages || Math.max(1, Math.ceil(total / 25))
          );
        }
      } catch (err) {
        if (!cancelled) setError(extractError(err, "Failed to load employees."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    debounced,
    page,
    reloadKey,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    getEmployees,
  ]);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Hydrate selected when parent value changes
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected && String(selected.id) === String(value)) return;
    const found = results.find((r) => String(r.id) === String(value));
    if (found) {
      setSelected(found);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getEmployees({
          search: "",
          page: 1,
          page_size: 100,
        });
        if (cancelled) return;
        const list = data.results || data.data || [];
        const hit = list.find((r) => String(r.id) === String(value));
        if (hit) setSelected(hit);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, results, selected, getEmployees]);

  const displayValue = selected
    ? `${selected.employee_id} - ${
        selected.full_name ||
        `${selected.first_name || ""} ${selected.last_name || ""}`.trim()
      }`
    : "";

  return (
    <div ref={wrapRef} style={{ position: "relative", minWidth: 280 }}>
      <span className="aw-field-label">Employee</span>
      <input
        className="aw-input"
        type="text"
        value={open ? search : displayValue}
        placeholder="Search employee by name or ID…"
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch("");
          setPage(1);
        }}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid var(--aw-border)",
            borderRadius: "var(--aw-radius-sm)",
            boxShadow: "var(--aw-shadow)",
            maxHeight: 320,
            overflowY: "auto",
            zIndex: 200,
          }}
        >
          {loading && (
            <div style={{ padding: 14, textAlign: "center" }}>
              <Loading />
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: 12 }}>
              <Error onRetry={() => setReloadKey((k) => k + 1)} />
              <div style={{ marginTop: 6, fontSize: 13, color: "#a52626" }}>
                {error}
              </div>
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div
              style={{
                padding: 14,
                textAlign: "center",
                color: "var(--aw-text-muted)",
                fontSize: 13,
              }}
            >
              No employees found.
            </div>
          )}

          {!loading &&
            !error &&
            results.map((emp) => {
              const name =
                emp.full_name ||
                `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
              return (
                <div
                  key={emp.id}
                  onClick={() => {
                    setSelected(emp);
                    onChange(String(emp.id));
                    setOpen(false);
                    setSearch("");
                  }}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--aw-border-light)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--aw-bg)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#fff")
                  }
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {emp.employee_id} - {name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--aw-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {emp.designation || "—"} · {emp.department || "—"} ·{" "}
                    {emp.branch || "—"}
                  </div>
                </div>
              );
            })}

          {!loading && !error && totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "var(--aw-bg)",
                borderTop: "1px solid var(--aw-border-light)",
              }}
            >
              <button
                type="button"
                className="aw-btn-outline aw-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: "var(--aw-text-muted)" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="aw-btn-outline aw-btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   ATTENDANCE FORM MODAL
   ========================================================================== */

function blankForm(employeeId, date) {
  return {
    employeeId: employeeId || "",
    date: date || todayISO(),
    status: "PRESENT",
    loginTime: "09:00",
    logoutTime: "18:00",
    breakHours: 0,
    hourlyRate: "",
    remarks: "",
  };
}

function AttendanceFormModal({
  editRecord,
  presetEmployeeId,
  presetDate,
  onClose,
  onSaved,
}) {
  const {
    createAttendance,
    updateAttendance,
    getWageConfigByEmployee,
  } = useAttendance();

  const [form, setForm] = useState(() =>
    editRecord
      ? {
          employeeId: String(editRecord.employee),
          date: editRecord.date,
          status: editRecord.status,
          loginTime: editRecord.login_time || "09:00",
          logoutTime: editRecord.logout_time || "18:00",
          breakHours: editRecord.break_hours || 0,
          hourlyRate: String(editRecord.hourly_rate ?? ""),
          remarks: editRecord.remarks || "",
        }
      : blankForm(presetEmployeeId, presetDate)
  );

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [employeeFilters, setEmployeeFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });
  const [wageConfig, setWageConfig] = useState(null);

  const meta = STATUS_META[form.status];
  const usesTime = meta?.requiresTime;

  useEffect(() => {
    if (!form.employeeId) {
      setWageConfig(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getWageConfigByEmployee(form.employeeId);
        if (!cancelled) setWageConfig(cfg);
      } catch {
        if (!cancelled) setWageConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.employeeId, getWageConfigByEmployee]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    const next = {};
    if (!form.employeeId) next.employeeId = "Employee is required.";
    if (!form.date) next.date = "Date is required.";
    if (usesTime) {
      if (!form.loginTime) next.loginTime = "Login time is required.";
      if (!form.logoutTime) next.logoutTime = "Logout time is required.";
      if (
        form.loginTime &&
        form.logoutTime &&
        form.loginTime === form.logoutTime
      ) {
        next.logoutTime = "Logout cannot equal login.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSaveError("");
    setDuplicateMsg("");

    try {
      const payload = {
        employee: Number(form.employeeId),
        date: form.date,
        status: form.status,
        login_time: usesTime ? form.loginTime : null,
        logout_time: usesTime ? form.logoutTime : null,
        break_hours: usesTime ? Number(form.breakHours) || 0 : 0,
        remarks: form.remarks || "",
      };
      if (form.hourlyRate !== "") {
        payload.hourly_rate = Number(form.hourlyRate);
      }

      if (editRecord) {
        await updateAttendance(editRecord.id, payload);
      } else {
        await createAttendance(payload);
      }
      onSaved?.();
    } catch (err) {
      if (err?.response?.status === 409) {
        setDuplicateMsg(
          "Attendance already exists for this employee and date."
        );
      } else {
        setSaveError(extractError(err, "Failed to save attendance."));
      }
    } finally {
      setSaving(false);
    }
  }

  const cfg = wageConfig || { hourly_rate: 0 };

  return (
    <div className="aw-modal-overlay" onClick={onClose}>
      <div
        className="aw-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="aw-modal-head">
          <h3>{editRecord ? "Edit Attendance" : "Add Attendance"}</h3>
          <button
            className="aw-icon-btn"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {saveError && (
          <div style={{ paddingBottom: 12 }}>
            <Error onRetry={handleSubmit} />
            <div style={{ marginTop: 6, fontSize: 13, color: "#a52626" }}>
              {saveError}
            </div>
          </div>
        )}

        {duplicateMsg && (
          <div
            style={{
              background: "var(--aw-warning-light)",
              border: "1px solid #fbbf24",
              color: "#78350f",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            {duplicateMsg}
          </div>
        )}

        <form className="aw-form" onSubmit={handleSubmit}>
          <div className="aw-form-grid">
            <div className="aw-field aw-field-wide">
              <EmployeeSearchSelect
                value={form.employeeId}
                onChange={(v) => set("employeeId", v)}
                filters={employeeFilters}
              />
              {errors.employeeId && (
                <span className="aw-error">{errors.employeeId}</span>
              )}
            </div>

            <div className="aw-field aw-field-wide">
              <FilterControls
                filters={employeeFilters}
                onChange={setEmployeeFilters}
                onClear={() =>
                  setEmployeeFilters({
                    search: "",
                    department: "",
                    branch: "",
                    employment_type: "",
                    work_location: "",
                  })
                }
              />
            </div>

            <label className="aw-field">
              <span className="aw-field-label">
                Date<span className="aw-required">*</span>
              </span>
              <input
                className="aw-input"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              {errors.date && <span className="aw-error">{errors.date}</span>}
            </label>

            <label className="aw-field">
              <span className="aw-field-label">
                Status<span className="aw-required">*</span>
              </span>
              <select
                className="aw-select"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="aw-field">
              <span className="aw-field-label">Hourly Rate</span>
              <input
                className="aw-input"
                type="number"
                min="0"
                step="0.01"
                placeholder={String(cfg.hourly_rate || 0)}
                value={form.hourlyRate}
                onChange={(e) => set("hourlyRate", e.target.value)}
              />
              <span className="aw-hint">
                Defaults to the employee's current rate (₹
                {cfg.hourly_rate || 0}/hr).
              </span>
            </label>

            <label
              className={`aw-field ${!usesTime ? "aw-field-disabled" : ""}`}
            >
              <span className="aw-field-label">
                Login Time{usesTime && <span className="aw-required">*</span>}
              </span>
              <input
                className="aw-input"
                type="time"
                disabled={!usesTime}
                value={usesTime ? form.loginTime : ""}
                onChange={(e) => set("loginTime", e.target.value)}
              />
              {errors.loginTime && (
                <span className="aw-error">{errors.loginTime}</span>
              )}
            </label>

            <label
              className={`aw-field ${!usesTime ? "aw-field-disabled" : ""}`}
            >
              <span className="aw-field-label">
                Logout Time{usesTime && <span className="aw-required">*</span>}
              </span>
              <input
                className="aw-input"
                type="time"
                disabled={!usesTime}
                value={usesTime ? form.logoutTime : ""}
                onChange={(e) => set("logoutTime", e.target.value)}
              />
              {errors.logoutTime && (
                <span className="aw-error">{errors.logoutTime}</span>
              )}
            </label>

            <label
              className={`aw-field ${!usesTime ? "aw-field-disabled" : ""}`}
            >
              <span className="aw-field-label">Break (hours)</span>
              <input
                className="aw-input"
                type="number"
                min="0"
                step="0.25"
                disabled={!usesTime}
                value={usesTime ? form.breakHours : 0}
                onChange={(e) => set("breakHours", e.target.value)}
              />
            </label>

            <label className="aw-field aw-field-wide">
              <span className="aw-field-label">Remarks</span>
              <input
                className="aw-input"
                type="text"
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="aw-modal-actions">
            <button
              type="button"
              className="aw-btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="aw-btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editRecord
                ? "Save Changes"
                : "Save Attendance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   DAILY TAB
   ========================================================================== */

function DailyTab({ onAdd, onEdit }) {
  const { getAttendance, deleteAttendance } = useAttendance();

  const [date, setDate] = useState(todayISO());
  const [filters, setFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
    status: "",
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_employees: 0,
    recorded: 0,
    present: 0,
    absent: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const debounced = useDebounce(filters.search, 400);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAttendance({
        date,
        search: debounced,
        department: filters.department,
        branch: filters.branch,
        employment_type: filters.employment_type,
        work_location: filters.work_location,
        status: filters.status,
        page: 1,
        page_size: 200,
      });
      const list = data.results || data.data || [];
      setRows(list);
      setSummary({
        total_employees: list.length,
        recorded: list.length,
        present: list.filter((r) =>
          ["PRESENT", "HALF_DAY", "WFH"].includes(r.status)
        ).length,
        absent: list.filter((r) => r.status === "ABSENT").length,
      });
    } catch (err) {
      setError(extractError(err, "Failed to load attendance."));
    } finally {
      setLoading(false);
    }
  }, [
    date,
    debounced,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    filters.status,
    reloadKey,
    getAttendance,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAttendance(deleteTarget.id);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      setError(extractError(err, "Failed to delete attendance."));
    } finally {
      setDeleting(false);
    }
  }

  function employeeName(r) {
    return (
      r.employee_name ||
      `${r.first_name || ""} ${r.last_name || ""}`.trim() ||
      r.employee_code ||
      "—"
    );
  }

  return (
    <div className="aw-tab">
      <div className="aw-summary-grid">
        <SummaryCard
          label="Present Today"
          value={summary.present}
          sub={`${summary.absent} absent`}
        />
        <SummaryCard label="Records" value={summary.recorded} />
      </div>

      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Date</span>
          <input
            className="aw-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="aw-btn-primary aw-toolbar-add"
          onClick={() => onAdd(null, date)}
        >
          + Add Attendance
        </button>
      </div>

      <FilterControls
        filters={filters}
        onChange={setFilters}
        showStatus
        onClear={() =>
          setFilters({
            search: "",
            department: "",
            branch: "",
            employment_type: "",
            work_location: "",
            status: "",
          })
        }
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loading />
        </div>
      ) : error ? (
        <div style={{ padding: 24 }}>
          <Error onRetry={() => setReloadKey((k) => k + 1)} />
          <div style={{ marginTop: 8, fontSize: 13, color: "#a52626" }}>
            {error}
          </div>
        </div>
      ) : (
        <div className="aw-table-wrap">
          <table className="aw-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Login</th>
                <th>Logout</th>
                <th className="aw-num">Hours</th>
                <th className="aw-num">Rate</th>
                <th className="aw-num">Daily Wage</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="aw-empty-row">
                    No attendance records for this filter.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDisplayDate(r.date)}</td>
                  <td>{employeeName(r)}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>{r.login_time || "—"}</td>
                  <td>{r.logout_time || "—"}</td>
                  <td className="aw-num">
                    {Number(r.working_hours || 0).toFixed(2)}
                  </td>
                  <td className="aw-num">₹{r.hourly_rate}</td>
                  <td className="aw-num">{formatINR(r.daily_wage)}</td>
                  <td className="aw-remarks">{r.remarks || "—"}</td>
                  <td className="aw-row-actions">
                    <button
                      type="button"
                      className="aw-link-btn"
                      onClick={() => onEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="aw-link-btn aw-link-danger"
                      onClick={() => setDeleteTarget(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div
          className="aw-modal-overlay"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="aw-modal aw-modal-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Delete attendance record?</h3>
            <p>
              This removes the record for {employeeName(deleteTarget)} on{" "}
              {formatDisplayDate(deleteTarget.date)}.
            </p>
            <div className="aw-modal-actions">
              <button
                type="button"
                className="aw-btn-outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="aw-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   WEEKLY TAB
   ========================================================================== */

function WeeklyTab() {
  const { getWeeklySummary } = useAttendance();

  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [filters, setFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });
  const [data, setData] = useState({
    start_date: "",
    end_date: "",
    total_hours: 0,
    total_wage: 0,
    employees: 0,
    results: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const debounced = useDebounce(filters.search, 400);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getWeeklySummary({
          date: anchorDate,
          search: debounced,
          department: filters.department,
          branch: filters.branch,
          employment_type: filters.employment_type,
          work_location: filters.work_location,
        });
        if (!cancelled) setData(res || {});
      } catch (err) {
        if (!cancelled) setError(extractError(err, "Failed to load weekly summary."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    anchorDate,
    debounced,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    reloadKey,
    getWeeklySummary,
  ]);

  const rows = data.results || [];

  return (
    <div className="aw-tab">
      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Week of</span>
          <input
            className="aw-input"
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
          />
        </label>
        <span className="aw-hint">
          {data.start_date
            ? `${formatDisplayDate(data.start_date)} – ${formatDisplayDate(
                data.end_date
              )}`
            : ""}
        </span>
      </div>

      <FilterControls
        filters={filters}
        onChange={setFilters}
        onClear={() =>
          setFilters({
            search: "",
            department: "",
            branch: "",
            employment_type: "",
            work_location: "",
          })
        }
      />

      <div className="aw-summary-grid aw-summary-grid-tight">
        <SummaryCard
          label="Total Hours"
          value={formatHours(data.total_hours || 0)}
        />
        <SummaryCard
          label="Total Wage"
          value={formatINR(data.total_wage || 0)}
        />
        <SummaryCard label="Employees" value={data.employees || 0} />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loading />
        </div>
      ) : error ? (
        <div style={{ padding: 24 }}>
          <Error onRetry={() => setReloadKey((k) => k + 1)} />
          <div style={{ marginTop: 8, fontSize: 13, color: "#a52626" }}>
            {error}
          </div>
        </div>
      ) : (
        <div className="aw-table-wrap">
          <table className="aw-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="aw-num">Days Worked</th>
                <th className="aw-num">Total Hours</th>
                <th className="aw-num">Hourly Rate</th>
                <th className="aw-num">Total Wage</th>
                <th className="aw-num">Outstanding Advance</th>
                <th>Status Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="aw-empty-row">
                    No attendance recorded for this week.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.employee_id}>
                  <td>
                    {r.employee_id} · {r.employee_name}
                  </td>
                  <td className="aw-num">{r.days_worked}</td>
                  <td className="aw-num">
                    {Number(r.total_hours || 0).toFixed(2)}
                  </td>
                  <td className="aw-num">₹{r.last_rate || 0}</td>
                  <td className="aw-num">{formatINR(r.total_wage)}</td>
                  <td className="aw-num">
                    {formatINR(r.outstanding_advance)}
                  </td>
                  <td className="aw-status-breakdown">
                    {Object.entries(r.status_counts || {}).map(([s, count]) => (
                      <span key={s} className="aw-mini-pill">
                        {statusLabel(s)}: {count}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   MONTHLY TAB
   ========================================================================== */

function MonthlyTab({ onFixMissing }) {
  const { getMonthlySummary } = useAttendance();

  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [filters, setFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });
  const [data, setData] = useState({
    total_employees: 0,
    total_working_days: 0,
    total_working_hours: 0,
    total_wage: 0,
    missing_attendance_count: 0,
    results: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const debounced = useDebounce(filters.search, 400);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getMonthlySummary({
          month,
          search: debounced,
          department: filters.department,
          branch: filters.branch,
          employment_type: filters.employment_type,
          work_location: filters.work_location,
        });
        if (!cancelled) setData(res || {});
      } catch (err) {
        if (!cancelled)
          setError(extractError(err, "Failed to load monthly summary."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    month,
    debounced,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    reloadKey,
    getMonthlySummary,
  ]);

  const rows = data.results || [];

  return (
    <div className="aw-tab">
      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Month</span>
          <input
            className="aw-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      <FilterControls
        filters={filters}
        onChange={setFilters}
        onClear={() =>
          setFilters({
            search: "",
            department: "",
            branch: "",
            employment_type: "",
            work_location: "",
          })
        }
      />

      <div className="aw-summary-grid aw-summary-grid-tight">
        <SummaryCard
          label="Total Employees"
          value={data.total_employees || 0}
        />
        <SummaryCard
          label="Total Working Days"
          value={data.total_working_days || 0}
        />
        <SummaryCard
          label="Total Working Hours"
          value={formatHours(data.total_working_hours || 0)}
        />
        <SummaryCard
          label="Total Wage Amount"
          value={formatINR(data.total_wage || 0)}
        />
        {data.missing_attendance_count > 0 && (
          <SummaryCard
            label="⚠ Missing Attendance"
            value={data.missing_attendance_count}
            sub="across all employees"
          />
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loading />
        </div>
      ) : error ? (
        <div style={{ padding: 24 }}>
          <Error onRetry={() => setReloadKey((k) => k + 1)} />
          <div style={{ marginTop: 8, fontSize: 13, color: "#a52626" }}>
            {error}
          </div>
        </div>
      ) : (
        <div className="aw-table-wrap">
          <table className="aw-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="aw-num">Days Worked</th>
                <th className="aw-num">Total Hours</th>
                <th className="aw-num">Total Wage</th>
                <th className="aw-num">Outstanding Advance</th>
                <th>Status Breakdown</th>
                <th>Missing</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="aw-empty-row">
                    No attendance recorded for this month.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.employee_id}>
                  <td>
                    {r.employee_id} · {r.employee_name}
                  </td>
                  <td className="aw-num">{r.days_worked}</td>
                  <td className="aw-num">
                    {Number(r.total_hours || 0).toFixed(2)}
                  </td>
                  <td className="aw-num">{formatINR(r.total_wage)}</td>
                  <td className="aw-num">
                    {formatINR(r.outstanding_advance)}
                  </td>
                  <td className="aw-status-breakdown">
                    {Object.entries(r.status_counts || {}).map(([s, count]) => (
                      <span key={s} className="aw-mini-pill">
                        {statusLabel(s)}: {count}
                      </span>
                    ))}
                    {!r.status_counts && "—"}
                  </td>
                  <td>
                    {r.missing_count === 0 ? (
                      "—"
                    ) : (
                      <button
                        type="button"
                        className="aw-link-btn aw-link-warning"
                        onClick={() =>
                          onFixMissing &&
                          onFixMissing(
                            r.employee_id,
                            data.start_date || todayISO()
                          )
                        }
                      >
                        ⚠ {r.missing_count} missing
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   EMPLOYEE SUMMARY TAB (Option A)
   - If an employee is selected: call employee-summary?employee=<id>
   - If no employee selected: fall back to filtered employee list from
     /erp/attendance/employees/ (so users can browse/filter without picking)
   ========================================================================== */

function EmployeeSummaryTab() {
  const { getEmployeeSummary, getEmployees } = useAttendance();

  const [filters, setFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });
  const [employeeId, setEmployeeId] = useState("");

  const [summary, setSummary] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const debounced = useDebounce(filters.search, 400);

  // Fetch: summary if employee chosen, else filtered list
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        if (employeeId) {
          const res = await getEmployeeSummary(employeeId);
          if (!cancelled) {
            setSummary(res || null);
            setList([]);
          }
        } else {
          const res = await getEmployees({
            search: debounced,
            department: filters.department,
            branch: filters.branch,
            employment_type: filters.employment_type,
            work_location: filters.work_location,
            page: 1,
            page_size: 100,
          });
          if (!cancelled) {
            setList(res.results || res.data || []);
            setSummary(null);
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(
            extractError(
              err,
              employeeId
                ? "Failed to load employee summary."
                : "Failed to load employee list."
            )
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    employeeId,
    debounced,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    reloadKey,
    getEmployeeSummary,
    getEmployees,
  ]);

  const week = summary?.week?.summary;
  const month = summary?.month?.summary;
  const emp = summary?.employee;

  return (
    <div className="aw-tab">
      <FilterControls
        filters={filters}
        onChange={setFilters}
        onClear={() =>
          setFilters({
            search: "",
            department: "",
            branch: "",
            employment_type: "",
            work_location: "",
          })
        }
      />

      <div className="aw-toolbar">
        <div style={{ flex: 1 }}>
          <EmployeeSearchSelect
            value={employeeId}
            onChange={(v) => setEmployeeId(v)}
            filters={filters}
          />
        </div>
        {employeeId && (
          <button
            type="button"
            className="aw-btn-outline aw-btn-sm"
            onClick={() => setEmployeeId("")}
            style={{ alignSelf: "flex-end" }}
          >
            Clear Selection
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loading />
        </div>
      ) : error ? (
        <div style={{ padding: 24 }}>
          <Error onRetry={() => setReloadKey((k) => k + 1)} />
          <div style={{ marginTop: 8, fontSize: 13, color: "#a52626" }}>
            {error}
          </div>
        </div>
      ) : employeeId && summary ? (
        <div className="aw-employee-summary">
          <div className="aw-employee-summary-head">
            <h3>{emp?.employee_name || emp?.full_name || "Employee"}</h3>
            <span className="aw-hint">
              {emp?.employee_id} · {emp?.department || "—"} ·{" "}
              {emp?.designation || "—"}
            </span>
          </div>

          <div className="pll-section">
            <h4>Attendance Summary</h4>
            <div className="aw-summary-grid">
              <SummaryCard
                label="This Week"
                value={formatHours(week?.total_hours || 0)}
                sub={formatINR(week?.total_wage || 0)}
              />
              <SummaryCard
                label="This Month"
                value={formatHours(month?.total_hours || 0)}
                sub={formatINR(month?.total_wage || 0)}
              />
              <SummaryCard
                label="Days Worked (Month)"
                value={month?.days_worked || 0}
              />
              <SummaryCard
                label="Outstanding Advance"
                value={formatINR(
                  month?.outstanding_advance || week?.outstanding_advance || 0
                )}
              />
            </div>
          </div>

          <div className="pll-section">
            <h4>Employee Details</h4>
            <dl className="pll-view-grid">
              <dt>Department</dt>
              <dd>{emp?.department || "—"}</dd>
              <dt>Designation</dt>
              <dd>{emp?.designation || "—"}</dd>
              <dt>Branch</dt>
              <dd>{emp?.branch || "—"}</dd>
              <dt>Employment Type</dt>
              <dd>{emp?.employment_type || "—"}</dd>
              <dt>Work Location</dt>
              <dd>{emp?.work_location || "—"}</dd>
            </dl>
          </div>

          {month?.status_counts && (
            <div className="pll-section">
              <h4>Status Breakdown (Month)</h4>
              <div className="aw-status-breakdown">
                {Object.entries(month.status_counts).map(([s, count]) => (
                  <span key={s} className="aw-mini-pill">
                    {statusLabel(s)}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="aw-employee-summary">
          <div className="aw-employee-summary-head">
            <h3>Filtered Employees</h3>
            <span className="aw-hint">
              Pick an employee above to view their summary, or refine filters
              to narrow this list.
            </span>
          </div>

          {list.length === 0 ? (
            <p className="aw-hint">No employees match these filters.</p>
          ) : (
            <div className="aw-table-wrap">
              <table className="aw-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Branch</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id}>
                      <td>{e.employee_id}</td>
                      <td>{e.full_name}</td>
                      <td>{e.department || "—"}</td>
                      <td>{e.designation || "—"}</td>
                      <td>{e.branch || "—"}</td>
                      <td>{e.employment_type || "—"}</td>
                      <td>{e.work_location || "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="aw-link-btn"
                          onClick={() => setEmployeeId(String(e.id))}
                        >
                          View Summary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   WAGE RATES PANEL
   ========================================================================== */

function WageRatesPanel() {
  const {
    getEmployees,
    getWageConfigByEmployee,
    upsertWageConfig,
  } = useAttendance();

  const [filters, setFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });
  const [employeeId, setEmployeeId] = useState("");
  const [draft, setDraft] = useState({
    salaryType: "HOURLY",
    hourlyRate: 0,
    monthlySalary: 0,
    standardHoursPerDay: 8,
    paidLeavePolicy: "UNPAID",
    holidayPolicy: "UNPAID",
    weeklyOffPolicy: "UNPAID",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // Load config whenever employee changes
  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const cfg = await getWageConfigByEmployee(employeeId);
        if (!cancelled) {
          setDraft({
            salaryType: cfg?.salary_type || "HOURLY",
            hourlyRate: cfg?.hourly_rate ?? 0,
            monthlySalary: cfg?.monthly_salary ?? 0,
            standardHoursPerDay: cfg?.standard_hours_per_day ?? 8,
            paidLeavePolicy: cfg?.paid_leave_policy || "UNPAID",
            holidayPolicy: cfg?.holiday_policy || "UNPAID",
            weeklyOffPolicy: cfg?.weekly_off_policy || "UNPAID",
          });
        }
      } catch (err) {
        if (!cancelled) setError(extractError(err, "Failed to load wage config."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, getWageConfigByEmployee]);

  async function handleSave() {
    if (!employeeId) return;
    setSaving(true);
    setError("");
    try {
      await upsertWageConfig(employeeId, {
        salary_type: draft.salaryType,
        hourly_rate: Number(draft.hourlyRate) || 0,
        monthly_salary: Number(draft.monthlySalary) || 0,
        standard_hours_per_day: Number(draft.standardHoursPerDay) || 8,
        paid_leave_policy: draft.paidLeavePolicy,
        holiday_policy: draft.holidayPolicy,
        weekly_off_policy: draft.weeklyOffPolicy,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(extractError(err, "Failed to save wage config."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="aw-panel">
      <div className="aw-panel-head">
        <h3>Wage Configuration</h3>
        <p>
          Set how each employee is paid. Changing a rate here only affects
          future attendance — past records keep the rate stored on them.
        </p>
      </div>

      <FilterControls
        filters={filters}
        onChange={setFilters}
        onClear={() =>
          setFilters({
            search: "",
            department: "",
            branch: "",
            employment_type: "",
            work_location: "",
          })
        }
      />

      <div className="aw-wage-grid">
        <div className="aw-field" style={{ gridColumn: "1 / -1" }}>
          <EmployeeSearchSelect
            value={employeeId}
            onChange={setEmployeeId}
            filters={filters}
          />
        </div>

        {employeeId && (
          <>
            <label className="aw-field">
              <span className="aw-field-label">Salary Type</span>
              <select
                className="aw-select"
                value={draft.salaryType}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, salaryType: e.target.value }))
                }
              >
                <option value="HOURLY">Hourly Wage</option>
                <option value="MONTHLY">Monthly Salary</option>
              </select>
            </label>

            {draft.salaryType === "HOURLY" ? (
              <label className="aw-field">
                <span className="aw-field-label">Hourly Rate (₹/hour)</span>
                <input
                  className="aw-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.hourlyRate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, hourlyRate: e.target.value }))
                  }
                />
              </label>
            ) : (
              <label className="aw-field">
                <span className="aw-field-label">Monthly Salary (₹)</span>
                <input
                  className="aw-input"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.monthlySalary}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, monthlySalary: e.target.value }))
                  }
                />
              </label>
            )}

            <label className="aw-field">
              <span className="aw-field-label">Standard Hours / Day</span>
              <input
                className="aw-input"
                type="number"
                min="1"
                step="0.5"
                value={draft.standardHoursPerDay}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    standardHoursPerDay: e.target.value,
                  }))
                }
              />
            </label>
          </>
        )}
      </div>

      {employeeId && (
        <div className="aw-panel-sub">
          <h4>Leave &amp; Holiday Pay Policy</h4>
          <div className="aw-policy-row">
            {[
              ["paidLeavePolicy", "Paid Leave"],
              ["holidayPolicy", "Holiday"],
              ["weeklyOffPolicy", "Weekly Off"],
            ].map(([key, label]) => (
              <label key={key} className="aw-field">
                <span className="aw-field-label">{label}</span>
                <select
                  className="aw-select"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: e.target.value }))
                  }
                >
                  <option value="UNPAID">Unpaid (₹0)</option>
                  <option value="FULL_DAY">
                    Paid (standard hours × rate)
                  </option>
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12 }}>
          <Error onRetry={handleSave} />
          <div style={{ marginTop: 6, fontSize: 13, color: "#a52626" }}>
            {error}
          </div>
        </div>
      )}

      {employeeId && (
        <div className="aw-panel-actions">
          <button
            type="button"
            className="aw-btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save Rate"}
          </button>
          {loading && <Loading />}
          {savedFlash && <span className="aw-saved-flash">Saved</span>}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   PAGE SHELL
   ========================================================================== */

const TABS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "employee", label: "Employee Summary" },
  { key: "rates", label: "Wage Rates" },
];

export default function AttendanceWages() {
  const [activeTab, setActiveTab] = useState("daily");
  const [modal, setModal] = useState(null);

  const handleBack = () => window.history.back();

  function openAdd(_unused, presetDate) {
    setModal({ editRecord: null, presetDate });
  }
  function openEdit(record) {
    setModal({ editRecord: record });
  }
  function closeModal() {
    setModal(null);
  }
  function handleSaved() {
    setModal(null);
    // Trigger a soft refresh by re-rendering — the tab components
    // re-fetch on mount and on filter change. For the Daily tab, an
    // explicit refresh happens after Create/Edit because the modal
    // closes and DailyTab remounts.
    window.dispatchEvent(new Event("aw-refresh"));
  }
  function handleFixMissing(employeeId, date) {
    setModal({
      editRecord: null,
      presetEmployeeId: employeeId,
      presetDate: date,
    });
  }

  return (
    <>
      <Header
        navLinks={[
          { label: "Employees", path: "/hr/employees" },
          { label: "Attendance & Wages", path: "/hr/attendance" },
          { label: "Salary", path: "/hr/salary" },
        ]}
      />

      <div className="aw-page">
        <div className="aw-page-header">
          <div className="aw-page-header-left">
            <button
              className="aw-back-btn"
              onClick={handleBack}
              aria-label="Go back"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="aw-page-header-titles">
              <h1>HR Attendance &amp; Wages</h1>
              <p>
                Log daily login/logout times, configure hourly rates, and feed
                calculated wages into Salary.
              </p>
            </div>
          </div>
          <div className="aw-page-header-actions">
            <span className="aw-header-badge">v2.0</span>
          </div>
        </div>

        <div className="aw-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`aw-tab-btn ${
                activeTab === t.key ? "aw-tab-btn-active" : ""
              }`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "daily" && (
          <DailyTab onAdd={openAdd} onEdit={openEdit} />
        )}
        {activeTab === "weekly" && <WeeklyTab />}
        {activeTab === "monthly" && <MonthlyTab onFixMissing={handleFixMissing} />}
        {activeTab === "employee" && <EmployeeSummaryTab />}
        {activeTab === "rates" && <WageRatesPanel />}

        {modal && (
          <AttendanceFormModal
            editRecord={modal.editRecord}
            presetEmployeeId={modal.presetEmployeeId}
            presetDate={modal.presetDate}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}
      </div>
    </>
  );
}

/* ==========================================================================
   RE-EXPORTS for other modules (e.g. Payroll.jsx)
   ========================================================================== */

export function monthRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function currentMonthStr() {
  return todayISO().slice(0, 7);
}

export function startOfWeek(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function endOfWeek(iso) {
  const start = new Date(`${startOfWeek(iso)}T00:00:00`);
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}