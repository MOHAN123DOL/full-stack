import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  currentMonthStr,
  formatINR,
  formatHours,
} from "./Attendancewages.jsx";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import {
  PaymentStatusBadge,
  AdvanceStatusBadge,
  Banner,
  ConfirmDialog,
  ExportBar,
  salaryMonthLabel,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  printRecords,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  ADVANCE_STATUSES,
  ADVANCE_STATUS_LABELS,
  formatDisplayDate,
} from "./Payroll.jsx";
import { useSalaryApi } from "./salaryApi.js";
import "./Salary.css";
import "./Payroll.css";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";

/* ==========================================================================
   CONSTANTS — values match Django choices (Title Case)
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

const TABS = [
  { key: "calculator", label: "Salary" },
  { key: "history", label: "Salary History" },
  { key: "advances", label: "Advance Management" },
];

/* ==========================================================================
   HELPERS
   ========================================================================== */

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function monthLabel(monthStr) {
  return salaryMonthLabel(monthStr);
}

// "2026-09" → "2026-09-01"  (Django DateField expects the 1st)
function toBackendMonth(yyyyMm) {
  if (!yyyyMm) return "";
  return yyyyMm.length === 7 ? `${yyyyMm}-01` : yyyyMm;
}

function extractError(err, fallback = "Something went wrong.") {
  const d = err?.response?.data;
  if (!d) return err?.message || fallback;
  if (typeof d === "string") return d;
  if (d.detail) return String(d.detail);
  for (const key of Object.keys(d)) {
    const v = d[key];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }
  return fallback;
}

/* ==========================================================================
   SMALL UI PIECES
   ========================================================================== */

function NumberField({ label, value, onChange, hint, error }) {
  return (
    <label className="sal-field">
      <span className="sal-field-label">{label}</span>
      <input
        className="sal-input"
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="pll-error">{error}</span>}
      {!error && hint && <span className="sal-hint">{hint}</span>}
    </label>
  );
}

function FilterControls({ filters, onChange, onClear }) {
  const dirty =
    filters.department ||
    filters.branch ||
    filters.employment_type ||
    filters.work_location;

  function set(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="sal-toolbar" style={{ marginTop: 0 }}>
      <label className="sal-field">
        <span className="sal-field-label">Department</span>
        <select
          className="sal-select"
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

      <label className="sal-field">
        <span className="sal-field-label">Branch</span>
        <select
          className="sal-select"
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

      <label className="sal-field">
        <span className="sal-field-label">Employment Type</span>
        <select
          className="sal-select"
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

      <label className="sal-field">
        <span className="sal-field-label">Work Location</span>
        <select
          className="sal-select"
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

      {dirty && (
        <button
          type="button"
          className="pll-btn-outline pll-btn-sm"
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

function EmployeeSearchSelect({
  value,
  onChange,
  filters,
  placeholder = "Search employee by name or ID…",
}) {
  const { getSalaryEmployees } = useSalaryApi();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebounce(search, 400);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSalaryEmployees({
          search: debouncedSearch,
          department: filters.department,
          branch: filters.branch,
          employment_type: filters.employment_type,
          work_location: filters.work_location,
          page,
          page_size: 25,
        });
        if (!cancelled) {
          setResults(data.results || []);
          setTotalPages(data.total_pages || 1);
          setTotalCount(data.count || 0);
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
    debouncedSearch,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    page,
    reloadKey,
    getSalaryEmployees,
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

  // Hydrate selected when parent sets `value`
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
        const data = await getSalaryEmployees({
          search: "",
          page: 1,
          page_size: 100,
        });
        if (cancelled) return;
        const hit = (data.results || []).find(
          (r) => String(r.id) === String(value)
        );
        if (hit) setSelected(hit);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, results, selected, getSalaryEmployees]);

  const displayValue = selected
    ? `${selected.employee_id} - ${selected.name}`
    : "";

  function pick(emp) {
    setSelected(emp);
    onChange(String(emp.id));
    setOpen(false);
    setSearch("");
  }

  function clearPick() {
    setSelected(null);
    onChange("");
    setSearch("");
    setPage(1);
  }

  return (
    <div
      className="sal-field"
      ref={wrapRef}
      style={{ position: "relative", minWidth: 280 }}
    >
      <span className="sal-field-label">Employee</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="sal-input"
          type="text"
          value={open ? search : displayValue}
          placeholder={placeholder}
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
          style={{ flex: 1 }}
        />
        {selected && (
          <button
            type="button"
            className="pll-btn-outline pll-btn-sm"
            onClick={clearPick}
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid var(--sal-border)",
            borderRadius: "var(--sal-radius-sm)",
            boxShadow: "var(--sal-shadow)",
            maxHeight: 340,
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
                color: "var(--sal-text-muted)",
                fontSize: 13,
              }}
            >
              No employees found.
            </div>
          )}

          {!loading &&
            !error &&
            results.map((emp) => {
              const isActive = String(emp.id) === String(value);
              return (
                <div
                  key={emp.id}
                  onClick={() => pick(emp)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--sal-border-light)",
                    background: isActive ? "var(--sal-accent-glow)" : "#fff",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--sal-bg)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = isActive
                      ? "var(--sal-accent-glow)"
                      : "#fff")
                  }
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {emp.employee_id} - {emp.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--sal-text-muted)",
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
                background: "var(--sal-bg)",
                borderTop: "1px solid var(--sal-border-light)",
              }}
            >
              <button
                type="button"
                className="pll-btn-outline pll-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: "var(--sal-text-muted)" }}>
                {page} / {totalPages}
                {totalCount ? ` · ${totalCount} total` : ""}
              </span>
              <button
                type="button"
                className="pll-btn-outline pll-btn-sm"
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
   SALARY CALCULATOR TAB
   ========================================================================== */

function SalaryCalculatorTab({
  employeeId,
  setEmployeeId,
  month,
  setMonth,
  onSaved,
  onViewExisting,
  onRefreshCounts,
}) {
  const {
    getSalaryEmployees,
    getSalaryPayments,
    createSalaryPayment,
    updateSalaryPayment,
    getAdvances,
  } = useSalaryApi();

  const { accessToken } = useAuth();
  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const [filters, setFilters] = useState({
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });

  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [wageConfig, setWageConfig] = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [loadingCalc, setLoadingCalc] = useState(false);

  const [components, setComponents] = useState({
    allowances: 0,
    overtime: 0,
    pf: 0,
    esi: 0,
    tax: 0,
    otherDeductions: 0,
    advanceDeduction: 0,
  });

  const [outstandingAdvance, setOutstandingAdvance] = useState(0);
  const [loadingAdvance, setLoadingAdvance] = useState(false);

  const [saveDialog, setSaveDialog] = useState(null);
  const [statusChoice, setStatusChoice] = useState("PAID");
  const [remarksInput, setRemarksInput] = useState("");
  const [negativeAck, setNegativeAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Resolve selected employee display info
  useEffect(() => {
    if (!employeeId) {
      setEmployeeInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getSalaryEmployees({
          search: "",
          page: 1,
          page_size: 100,
        });
        const found = (data.results || []).find(
          (e) => String(e.id) === String(employeeId)
        );
        if (!cancelled) setEmployeeInfo(found || null);
      } catch {
        if (!cancelled) setEmployeeInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, getSalaryEmployees]);

  // Fetch wage config + month attendance summary from backend
  useEffect(() => {
    if (!employeeId || !month) {
      setWageConfig(null);
      setMonthSummary(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoadingCalc(true);
      try {
        const empCode = employeeInfo?.employee_id || "";

        const [cfgRes, summaryRes] = await Promise.all([
          empCode
            ? api.get(
                `/erp/wage-config/?employee_id=${empCode}`,
                { headers: authHeaders() }
              )
            : Promise.resolve({ data: [] }),
          api.get(
            `/erp/attendance/monthly-summary/?month=${month}&employee=${employeeId}`,
            { headers: authHeaders() }
          ),
        ]);

        const cfgList = Array.isArray(cfgRes.data)
          ? cfgRes.data
          : cfgRes.data?.results || [];
        const cfg = cfgList[0] || null;

        const monthData = summaryRes.data || {};
        const monthRow =
          Array.isArray(monthData.results) && monthData.results.length
            ? monthData.results[0]
            : null;

        if (!cancelled) {
          setWageConfig(cfg);
          setMonthSummary(monthRow);
        }
      } catch {
        if (!cancelled) {
          setWageConfig(null);
          setMonthSummary(null);
        }
      } finally {
        if (!cancelled) setLoadingCalc(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId, month, employeeInfo, authHeaders]);

  // Outstanding advance for selected employee
  useEffect(() => {
    if (!employeeId || !employeeInfo) {
      setOutstandingAdvance(0);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoadingAdvance(true);
      try {
        const data = await getAdvances({
          search: employeeInfo.employee_id || "",
          status: "OUTSTANDING",
          page: 1,
          page_size: 100,
        });
        if (!cancelled) {
          const total = (data.results || [])
            .filter((a) => String(a.employee) === String(employeeId))
            .reduce(
              (sum, a) => sum + Number(a.outstanding_amount || 0),
              0
            );
          setOutstandingAdvance(total);
        }
      } catch {
        if (!cancelled) setOutstandingAdvance(0);
      } finally {
        if (!cancelled) setLoadingAdvance(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId, employeeInfo, getAdvances]);

  const salaryType = wageConfig?.salary_type || "MONTHLY";
  const isHourly = salaryType === "HOURLY";
  const hourlyRate = Number(wageConfig?.hourly_rate || 0);
  const monthlySalary = Number(wageConfig?.monthly_salary || 0);

  const summary = {
    daysWorked: monthSummary?.days_worked || 0,
    totalHours: Number(monthSummary?.total_hours || 0),
    totalWage: Number(monthSummary?.total_wage || 0),
    statusCounts: monthSummary?.status_counts || {},
  };

  const baseAmount = isHourly ? summary.totalWage : monthlySalary;

  const allowances = Number(components.allowances) || 0;
  const overtime = Number(components.overtime) || 0;
  const pf = Number(components.pf) || 0;
  const esi = Number(components.esi) || 0;
  const tax = Number(components.tax) || 0;
  const otherDeductions = Number(components.otherDeductions) || 0;
  const advanceDeduction = Number(components.advanceDeduction) || 0;

  const grossEarnings = baseAmount + allowances + overtime;
  const normalDeductions = pf + esi + tax + otherDeductions;
  const totalDeductions = normalDeductions + advanceDeduction;
  const netSalary = grossEarnings - totalDeductions;

  const advanceExceeds = advanceDeduction > outstandingAdvance;
  const remainingAfter = Math.max(0, outstandingAdvance - advanceDeduction);

  function updateComponent(field, value) {
    setComponents((prev) => ({
      ...prev,
      [field]: value === "" ? 0 : Number(value),
    }));
  }

  async function openSaveFlow() {
    if (!employeeId) {
      alert("Select an employee first.");
      return;
    }
    if (!month) {
      alert("Select a salary month first.");
      return;
    }
    if (advanceExceeds) {
      alert(
        `Advance deduction (${formatINR(advanceDeduction)}) cannot exceed outstanding advance (${formatINR(outstandingAdvance)}).`
      );
      return;
    }

    try {
      const data = await getSalaryPayments({
        month,
        page: 1,
        page_size: 100,
      });
      const existing = (data.salary_records || []).find(
        (r) => String(r.employee) === String(employeeId)
      );

      setStatusChoice(existing?.payment_status || "PAID");
      setRemarksInput(existing?.remarks || "");
      setNegativeAck(false);

      if (existing) {
        setSaveDialog({ mode: "duplicate", existing });
      } else {
        setSaveDialog({ mode: "confirm" });
      }
    } catch {
      setSaveDialog({ mode: "confirm" });
    }
  }

  async function confirmSave(isUpdate) {
    setSaving(true);
    setSaveError("");

    try {
      const payload = {
        employee: Number(employeeId),
        salary_month: toBackendMonth(month),
        base_salary: isHourly ? 0 : monthlySalary,
        attendance_wage: isHourly ? summary.totalWage : 0,
        allowances,
        overtime,
        pf,
        esi,
        tax,
        other_deductions: otherDeductions,
        advance_deduction: advanceDeduction,
        payment_status: statusChoice,
        paid_date:
          statusChoice === "PAID"
            ? new Date().toISOString().slice(0, 10)
            : null,
        remarks: remarksInput,
      };

      let saved;
      if (isUpdate && saveDialog?.existing) {
        saved = await updateSalaryPayment(saveDialog.existing.id, payload);
      } else {
        saved = await createSalaryPayment(payload);
      }

      setSaveDialog(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 3500);

      setComponents({
        allowances: 0,
        overtime: 0,
        pf: 0,
        esi: 0,
        tax: 0,
        otherDeductions: 0,
        advanceDeduction: 0,
      });

      onSaved?.(saved);
      onRefreshCounts?.();
    } catch (err) {
      setSaveError(extractError(err, "Failed to save salary."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {flash && (
        <Banner kind="success" onClose={() => setFlash(false)}>
          Salary saved successfully.
        </Banner>
      )}

      {saveError && (
        <Banner kind="danger" onClose={() => setSaveError("")}>
          {saveError}
        </Banner>
      )}

      <div className="sal-toolbar">
        <EmployeeSearchSelect
          value={employeeId}
          onChange={setEmployeeId}
          filters={filters}
        />
        <label className="sal-field">
          <span className="sal-field-label">Salary Period</span>
          <input
            className="sal-input"
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
            department: "",
            branch: "",
            employment_type: "",
            work_location: "",
          })
        }
      />

      {employeeId && (
        <div className="sal-card" style={{ marginTop: 16 }}>
          <div className="sal-card-head">
            <div>
              <h2>{employeeInfo ? employeeInfo.name : "Selected employee"}</h2>
              <span className="sal-hint">
                {employeeInfo?.employee_id || employeeId} ·{" "}
                {employeeInfo?.designation || "—"} · {monthLabel(month)}
              </span>
            </div>
            <span
              className={`sal-type-pill ${
                isHourly ? "sal-type-hourly" : "sal-type-monthly"
              }`}
            >
              {isHourly ? "Hourly Wage" : "Monthly Salary"}
            </span>
          </div>

          {loadingCalc ? (
            <div style={{ padding: 30, textAlign: "center" }}>
              <Loading />
            </div>
          ) : isHourly ? (
            <div className="sal-section">
              <h3>Attendance Summary</h3>
              <div className="sal-attendance-grid">
                <div>
                  <span className="sal-mini-label">Working Days</span>
                  <span className="sal-mini-value">{summary.daysWorked}</span>
                </div>
                <div>
                  <span className="sal-mini-label">Total Hours</span>
                  <span className="sal-mini-value">
                    {formatHours(summary.totalHours)}
                  </span>
                </div>
                <div>
                  <span className="sal-mini-label">Hourly Wage</span>
                  <span className="sal-mini-value">₹{hourlyRate}</span>
                </div>
                <div>
                  <span className="sal-mini-label">Attendance Wage</span>
                  <span className="sal-mini-value">
                    {formatINR(summary.totalWage)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="sal-section">
              <h3>Base Salary</h3>
              <div className="sal-attendance-grid">
                <div>
                  <span className="sal-mini-label">Monthly Salary</span>
                  <span className="sal-mini-value">
                    {formatINR(monthlySalary)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="sal-section">
            <h3>Salary Components</h3>
            <div className="sal-components-grid">
              <NumberField
                label="Allowances"
                value={components.allowances}
                onChange={(v) => updateComponent("allowances", v)}
              />
              <NumberField
                label="Overtime"
                value={components.overtime}
                onChange={(v) => updateComponent("overtime", v)}
              />
              <NumberField
                label="PF Deduction"
                value={components.pf}
                onChange={(v) => updateComponent("pf", v)}
              />
              <NumberField
                label="ESI Deduction"
                value={components.esi}
                onChange={(v) => updateComponent("esi", v)}
              />
              <NumberField
                label="Tax (TDS)"
                value={components.tax}
                onChange={(v) => updateComponent("tax", v)}
              />
              <NumberField
                label="Other Deductions"
                value={components.otherDeductions}
                onChange={(v) => updateComponent("otherDeductions", v)}
              />
            </div>
          </div>

          <div className="pll-section">
            <h3>Advance Summary</h3>
            {loadingAdvance ? (
              <Loading />
            ) : (
              <div className="pll-advance-summary">
                <div className="pll-advance-summary-row">
                  <span>Outstanding Advance</span>
                  <strong>{formatINR(outstandingAdvance)}</strong>
                </div>
                <div className="pll-advance-summary-row">
                  <span>This Month Deduction</span>
                  <strong>{formatINR(advanceDeduction)}</strong>
                </div>
                <div className="pll-advance-summary-row pll-advance-remaining">
                  <span>Remaining After Deduction</span>
                  <strong>{formatINR(remainingAfter)}</strong>
                </div>
              </div>
            )}
            <div className="sal-components-grid" style={{ marginTop: 12 }}>
              <NumberField
                label="Advance Deduction"
                value={components.advanceDeduction}
                onChange={(v) => updateComponent("advanceDeduction", v)}
                hint={
                  outstandingAdvance > 0
                    ? `Up to ${formatINR(outstandingAdvance)} outstanding.`
                    : "No outstanding advance for this employee."
                }
                error={
                  advanceExceeds
                    ? `Cannot exceed ${formatINR(outstandingAdvance)}.`
                    : undefined
                }
              />
            </div>
          </div>

          <div className="sal-totals">
            <div className="sal-totals-row">
              <span>{isHourly ? "Attendance Wage" : "Basic Salary"}</span>
              <span>{formatINR(baseAmount)}</span>
            </div>
            <div className="sal-totals-row">
              <span>Allowances + Overtime</span>
              <span>+ {formatINR(allowances + overtime)}</span>
            </div>
            <div className="sal-totals-row sal-totals-sub">
              <span>Gross Earnings</span>
              <span>{formatINR(grossEarnings)}</span>
            </div>
            <div className="sal-totals-row">
              <span>PF + ESI + Tax + Other</span>
              <span>− {formatINR(normalDeductions)}</span>
            </div>
            <div className="sal-totals-row">
              <span>Advance Deduction</span>
              <span>− {formatINR(advanceDeduction)}</span>
            </div>
            <div className="sal-totals-row sal-totals-net">
              <span>Net Salary</span>
              <span>{formatINR(netSalary)}</span>
            </div>
            {netSalary < 0 && (
              <Banner kind="warning">
                Deductions exceed earnings — net salary is negative. You'll
                need to confirm explicitly to save.
              </Banner>
            )}
          </div>

          <div className="sal-section" style={{ textAlign: "right" }}>
            <button
              type="button"
              className="pll-btn-primary"
              onClick={openSaveFlow}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Salary"}
            </button>
          </div>
        </div>
      )}

      {saveDialog?.mode === "duplicate" && (
        <ConfirmDialog
          title="Salary already saved"
          message={`Salary already saved for this employee for ${monthLabel(
            month
          )}.`}
          confirmLabel="Update Salary"
          cancelLabel="Cancel"
          onCancel={() => setSaveDialog(null)}
          onConfirm={() =>
            setSaveDialog({
              mode: "confirm",
              existing: saveDialog.existing,
              isUpdate: true,
            })
          }
        >
          <button
            type="button"
            className="pll-btn-outline pll-btn-sm"
            style={{ marginBottom: 10 }}
            onClick={() => {
              const ex = saveDialog.existing;
              setSaveDialog(null);
              onViewExisting?.(ex);
            }}
          >
            View Saved Salary
          </button>
        </ConfirmDialog>
      )}

      {saveDialog?.mode === "confirm" && (
        <ConfirmDialog
          title={saveDialog.isUpdate ? "Update saved salary?" : "Save salary?"}
          message={`${
            saveDialog.isUpdate ? "Update" : "Save"
          } salary for ${employeeInfo?.name || "this employee"} for ${monthLabel(
            month
          )}?`}
          confirmLabel={saveDialog.isUpdate ? "Update Salary" : "Save Salary"}
          busy={saving}
          onCancel={() => setSaveDialog(null)}
          onConfirm={() => {
            if (netSalary < 0 && !negativeAck) return;
            confirmSave(!!saveDialog.isUpdate);
          }}
        >
          <div className="pll-modal-form-grid">
            <label className="pll-field">
              <span className="pll-field-label">Payment Status</span>
              <select
                className="pll-select"
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value)}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Remarks (optional)</span>
              <input
                className="pll-input"
                type="text"
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
              />
            </label>
          </div>
          {netSalary < 0 && (
            <label
              className="pll-hint"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <input
                type="checkbox"
                checked={negativeAck}
                onChange={(e) => setNegativeAck(e.target.checked)}
              />
              I understand net salary for this record is negative and want to
              save it anyway.
            </label>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

/* ==========================================================================
   SALARY HISTORY TAB
   ========================================================================== */

function SalaryHistoryTab({ onEdit, onView }) {
  const { getSalaryPayments, deleteSalaryPayment } = useSalaryApi();

  const [filters, setFilters] = useState({
    month: currentMonthStr(),
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
    payment_status: "",
  });

  const [data, setData] = useState({
    total_employees: 0,
    saved_entries: 0,
    missing_entries: 0,
    missing_employees: [],
    salary_records: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebounce(filters.search, 400);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getSalaryPayments({
        month: filters.month,
        search: debouncedSearch,
        department: filters.department,
        branch: filters.branch,
        employment_type: filters.employment_type,
        work_location: filters.work_location,
        payment_status: filters.payment_status,
        page: 1,
        page_size: 200,
      });
      setData({
        total_employees: result.total_employees || 0,
        saved_entries: result.saved_entries || 0,
        missing_entries: result.missing_entries || 0,
        missing_employees: result.missing_employees || [],
        salary_records: result.salary_records || [],
      });
    } catch (err) {
      setError(extractError(err, "Failed to load salary data."));
    } finally {
      setLoading(false);
    }
  }, [
    filters.month,
    debouncedSearch,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    filters.payment_status,
    reloadKey,
    getSalaryPayments,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function setFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters({
      month: currentMonthStr(),
      search: "",
      department: "",
      branch: "",
      employment_type: "",
      work_location: "",
      payment_status: "",
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSalaryPayment(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setError(extractError(err, "Failed to delete salary record."));
    } finally {
      setDeleting(false);
    }
  }

  const records = data.salary_records || [];

  const totals = records.reduce(
    (acc, r) => ({
      gross: acc.gross + Number(r.gross_earnings || 0),
      advance: acc.advance + Number(r.advance_deduction || 0),
      other:
        acc.other +
        Number(r.pf || 0) +
        Number(r.esi || 0) +
        Number(r.tax || 0) +
        Number(r.other_deductions || 0),
      net: acc.net + Number(r.net_salary || 0),
    }),
    { gross: 0, advance: 0, other: 0, net: 0 }
  );

  const exportHeaders = [
    "Employee",
    "Employee ID",
    "Salary Month",
    "Gross Salary",
    "Advance Deduction",
    "Other Deductions",
    "Net Salary",
    "Payment Status",
    "Paid Date",
  ];

  function exportRows() {
    return records.map((r) => [
      r.employee_name,
      r.employee_code,
      salaryMonthLabel(r.salary_month?.slice(0, 7)),
      r.gross_earnings,
      r.advance_deduction,
      Number(r.pf || 0) +
        Number(r.esi || 0) +
        Number(r.tax || 0) +
        Number(r.other_deductions || 0),
      r.net_salary,
      PAYMENT_STATUS_LABELS[r.payment_status] || r.payment_status,
      formatDisplayDate(r.paid_date),
    ]);
  }

  return (
    <div>
      <div className="pll-summary-grid">
        <div className="pll-summary-card">
          <span className="pll-summary-label">Total Employees</span>
          <span className="pll-summary-value">{data.total_employees}</span>
        </div>
        <div className="pll-summary-card">
          <span className="pll-summary-label">Salary Saved</span>
          <span className="pll-summary-value">{data.saved_entries}</span>
        </div>
        <div className="pll-summary-card">
          <span className="pll-summary-label">Missing Salary</span>
          <span
            className="pll-summary-value"
            style={{ color: "var(--sal-danger)" }}
          >
            {data.missing_entries}
          </span>
        </div>
      </div>

      {data.missing_entries > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="pll-btn-outline pll-btn-sm"
            onClick={() => setShowMissing(true)}
          >
            View Missing Employees ({data.missing_entries})
          </button>
        </div>
      )}

      <div className="pll-filter-bar">
        <div className="pll-filter-row">
          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Salary Month</span>
            <input
              className="pll-input"
              type="month"
              value={filters.month}
              onChange={(e) => setFilter("month", e.target.value)}
            />
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Employee Search</span>
            <input
              className="pll-input"
              type="text"
              placeholder="Name / ID…"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Department</span>
            <select
              className="pll-select"
              value={filters.department}
              onChange={(e) => setFilter("department", e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Branch</span>
            <select
              className="pll-select"
              value={filters.branch}
              onChange={(e) => setFilter("branch", e.target.value)}
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Employment Type</span>
            <select
              className="pll-select"
              value={filters.employment_type}
              onChange={(e) => setFilter("employment_type", e.target.value)}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Work Location</span>
            <select
              className="pll-select"
              value={filters.work_location}
              onChange={(e) => setFilter("work_location", e.target.value)}
            >
              {WORK_LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Payment Status</span>
            <select
              className="pll-select"
              value={filters.payment_status}
              onChange={(e) => setFilter("payment_status", e.target.value)}
            >
              <option value="">All</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="pll-btn-outline pll-btn-sm"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <ExportBar
        onExportExcel={() =>
          exportToExcel("salary-history.xls", exportHeaders, exportRows())
        }
        onExportCsv={() =>
          exportToCSV("salary-history.csv", exportHeaders, exportRows())
        }
        onExportPdf={() =>
          exportToPDF({
            title: "Salary Payment History",
            meta: [
              `Month: ${salaryMonthLabel(filters.month)}`,
              `Records: ${records.length}`,
            ],
            headers: exportHeaders,
            rows: exportRows(),
          })
        }
        onPrint={() =>
          printRecords({
            title: "Salary Payment History",
            headers: exportHeaders,
            rows: exportRows(),
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
        <div className="pll-table-wrap">
          <table className="pll-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Salary Month</th>
                <th className="pll-num">Gross Salary</th>
                <th className="pll-num">Advance Deduction</th>
                <th className="pll-num">Other Deductions</th>
                <th className="pll-num">Net Salary</th>
                <th>Payment Status</th>
                <th>Paid Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={10} className="pll-empty-row">
                    No salary payment records match this filter.
                  </td>
                </tr>
              )}
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee_name}</td>
                  <td>{r.employee_code}</td>
                  <td>{salaryMonthLabel(r.salary_month?.slice(0, 7))}</td>
                  <td className="pll-num">{formatINR(r.gross_earnings)}</td>
                  <td className="pll-num">{formatINR(r.advance_deduction)}</td>
                  <td className="pll-num">
                    {formatINR(
                      Number(r.pf || 0) +
                        Number(r.esi || 0) +
                        Number(r.tax || 0) +
                        Number(r.other_deductions || 0)
                    )}
                  </td>
                  <td className="pll-num">{formatINR(r.net_salary)}</td>
                  <td>
                    <PaymentStatusBadge status={r.payment_status} />
                  </td>
                  <td>{formatDisplayDate(r.paid_date)}</td>
                  <td className="pll-row-actions">
                    <button
                      type="button"
                      className="pll-link-btn"
                      onClick={() => onView(r)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="pll-link-btn"
                      onClick={() => onEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="pll-link-btn pll-link-danger"
                      onClick={() => setDeleteTarget(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Totals</td>
                  <td className="pll-num">{formatINR(totals.gross)}</td>
                  <td className="pll-num">{formatINR(totals.advance)}</td>
                  <td className="pll-num">{formatINR(totals.other)}</td>
                  <td className="pll-num">{formatINR(totals.net)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete salary record?"
          message={`This permanently removes the ${salaryMonthLabel(
            deleteTarget.salary_month?.slice(0, 7)
          )} salary record for ${deleteTarget.employee_name}.`}
          confirmLabel="Delete"
          danger
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {showMissing && (
        <div
          className="pll-modal-overlay"
          onClick={() => setShowMissing(false)}
        >
          <div
            className="pll-modal pll-modal-wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Missing Salary Employees</h3>
            <p className="pll-modal-message">
              {data.missing_entries} employees have no salary record for{" "}
              {salaryMonthLabel(filters.month)}.
            </p>
            <div
              className="pll-table-wrap"
              style={{ maxHeight: 420, overflowY: "auto" }}
            >
              <table className="pll-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Branch</th>
                    <th>Type</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {data.missing_employees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="pll-empty-row">
                        No missing employees.
                      </td>
                    </tr>
                  )}
                  {data.missing_employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.employee_id}</td>
                      <td>{emp.name}</td>
                      <td>{emp.department}</td>
                      <td>{emp.designation}</td>
                      <td>{emp.branch}</td>
                      <td>{emp.employment_type}</td>
                      <td>{emp.work_location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pll-modal-actions">
              <button
                type="button"
                className="pll-btn-primary"
                onClick={() => setShowMissing(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   VIEW SALARY MODAL
   ========================================================================== */

function ViewSalaryModal({ record, onClose }) {
  if (!record) return null;
  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div
        className="pll-modal pll-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>
          {record.employee_name} —{" "}
          {salaryMonthLabel(record.salary_month?.slice(0, 7))}
        </h3>
        <p className="pll-modal-message">
          Saved payroll snapshot. Values are frozen at time of payment and
          don't change if wage rates or attendance are edited later.
        </p>
        <dl className="pll-view-grid">
          <dt>Base Salary</dt>
          <dd>{formatINR(record.base_salary)}</dd>
          <dt>Attendance Wage</dt>
          <dd>{formatINR(record.attendance_wage)}</dd>
          <dt>Allowances</dt>
          <dd>{formatINR(record.allowances)}</dd>
          <dt>Overtime</dt>
          <dd>{formatINR(record.overtime)}</dd>
          <dt>Gross Earnings</dt>
          <dd>{formatINR(record.gross_earnings)}</dd>
          <dt>PF</dt>
          <dd>{formatINR(record.pf)}</dd>
          <dt>ESI</dt>
          <dd>{formatINR(record.esi)}</dd>
          <dt>Tax</dt>
          <dd>{formatINR(record.tax)}</dd>
          <dt>Other Deductions</dt>
          <dd>{formatINR(record.other_deductions)}</dd>
          <dt>Advance Deduction</dt>
          <dd>{formatINR(record.advance_deduction)}</dd>
          <dt>Total Deductions</dt>
          <dd>{formatINR(record.total_deductions)}</dd>
          <dt>Net Salary</dt>
          <dd>{formatINR(record.net_salary)}</dd>
          <dt>Payment Status</dt>
          <dd>
            <PaymentStatusBadge status={record.payment_status} />
          </dd>
          <dt>Paid Date</dt>
          <dd>{formatDisplayDate(record.paid_date)}</dd>
          {record.remarks && (
            <>
              <dt>Remarks</dt>
              <dd>{record.remarks}</dd>
            </>
          )}
        </dl>
        <div className="pll-modal-actions">
          <button type="button" className="pll-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ADVANCE — CREATE MODAL
   ========================================================================== */

function AdvanceFormModal({ onClose, onSaved }) {
  const { createAdvance } = useSalaryApi();

  const [form, setForm] = useState({
    employeeId: "",
    advanceDate: new Date().toISOString().slice(0, 10),
    amount: "",
    reason: "",
    remarks: "",
  });
  const [employeeFilters, setEmployeeFilters] = useState({
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.employeeId) return setError("Employee is required.");
    if (!amount || amount <= 0)
      return setError("Advance amount must be greater than 0.");

    setSaving(true);
    setError("");
    try {
      await createAdvance({
        employee: Number(form.employeeId),
        advance_date: form.advanceDate,
        amount,
        reason: form.reason,
        remarks: form.remarks,
      });
      onSaved?.();
    } catch (err) {
      setError(extractError(err, "Failed to create advance."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div
        className="pll-modal pll-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>Give Advance</h3>
        <form onSubmit={handleSubmit}>
          <div className="pll-modal-form-grid">
            <div className="pll-modal-field-wide">
              <EmployeeSearchSelect
                value={form.employeeId}
                onChange={(id) => set("employeeId", id)}
                filters={employeeFilters}
              />
            </div>
            <div className="pll-modal-field-wide">
              <FilterControls
                filters={employeeFilters}
                onChange={setEmployeeFilters}
                onClear={() =>
                  setEmployeeFilters({
                    department: "",
                    branch: "",
                    employment_type: "",
                    work_location: "",
                  })
                }
              />
            </div>
            <label className="pll-field">
              <span className="pll-field-label">
                Advance Date<span className="pll-required">*</span>
              </span>
              <input
                className="pll-input"
                type="date"
                value={form.advanceDate}
                onChange={(e) => set("advanceDate", e.target.value)}
              />
            </label>
            <label className="pll-field">
              <span className="pll-field-label">
                Advance Amount (₹)<span className="pll-required">*</span>
              </span>
              <input
                className="pll-input"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Reason</span>
              <input
                className="pll-input"
                type="text"
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                placeholder="e.g. Medical emergency"
              />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Remarks</span>
              <input
                className="pll-input"
                type="text"
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          {error && <span className="pll-error">{error}</span>}
          <div className="pll-modal-actions">
            <button
              type="button"
              className="pll-btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pll-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Advance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   ADVANCE — EDIT MODAL
   ========================================================================== */

function EditAdvanceModal({ advance, onClose, onSaved }) {
  const { updateAdvance } = useSalaryApi();
  const [form, setForm] = useState({
    advanceDate: advance.advance_date,
    amount: advance.amount,
    reason: advance.reason || "",
    remarks: advance.remarks || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const locked = Number(advance.total_repaid || 0) > 0;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateAdvance(advance.id, {
        advance_date: form.advanceDate,
        amount: locked ? advance.amount : Number(form.amount),
        reason: form.reason,
        remarks: form.remarks,
      });
      onSaved?.();
    } catch (err) {
      setError(extractError(err, "Failed to update advance."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div
        className="pll-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>Edit Advance</h3>
        {locked && (
          <p className="pll-modal-message">
            ₹{advance.total_repaid} has already been repaid against this
            advance, so the amount is locked. You can still update date,
            reason, and remarks.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="pll-modal-form-grid">
            <label className="pll-field">
              <span className="pll-field-label">Advance Date</span>
              <input
                className="pll-input"
                type="date"
                value={form.advanceDate}
                onChange={(e) => set("advanceDate", e.target.value)}
              />
            </label>
            <label className="pll-field">
              <span className="pll-field-label">Advance Amount (₹)</span>
              <input
                className="pll-input"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                disabled={locked}
                onChange={(e) => set("amount", e.target.value)}
              />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Reason</span>
              <input
                className="pll-input"
                type="text"
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
              />
            </label>
            <label className="pll-field pll-modal-field-wide">
              <span className="pll-field-label">Remarks</span>
              <input
                className="pll-input"
                type="text"
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
              />
            </label>
          </div>
          {error && <span className="pll-error">{error}</span>}
          <div className="pll-modal-actions">
            <button
              type="button"
              className="pll-btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pll-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   ADVANCE — VIEW MODAL
   ========================================================================== */

function AdvanceDetailModal({ advance, onClose }) {
  return (
    <div className="pll-modal-overlay" onClick={onClose}>
      <div
        className="pll-modal pll-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>
          {advance.employee_name} — Advance on{" "}
          {formatDisplayDate(advance.advance_date)}
        </h3>
        <dl className="pll-view-grid">
          <dt>Advance Amount</dt>
          <dd>{formatINR(advance.amount)}</dd>
          <dt>Total Repaid</dt>
          <dd>{formatINR(advance.total_repaid)}</dd>
          <dt>Outstanding</dt>
          <dd>{formatINR(advance.outstanding_amount)}</dd>
          <dt>Status</dt>
          <dd>
            <AdvanceStatusBadge status={advance.status} />
          </dd>
          {advance.reason && (
            <>
              <dt>Reason</dt>
              <dd>{advance.reason}</dd>
            </>
          )}
          {advance.remarks && (
            <>
              <dt>Remarks</dt>
              <dd>{advance.remarks}</dd>
            </>
          )}
        </dl>
        <div className="pll-modal-actions">
          <button type="button" className="pll-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ADVANCE MANAGEMENT TAB
   ========================================================================== */

function AdvanceManagementTab() {
  const { getAdvances, deleteAdvance } = useSalaryApi();

  const [filters, setFilters] = useState({
    search: "",
    department: "",
    branch: "",
    employment_type: "",
    work_location: "",
    status: "",
    date_from: "",
    date_to: "",
  });

  const [data, setData] = useState({ count: 0, results: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [flash, setFlash] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 400);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdvances({
        search: debouncedSearch,
        department: filters.department,
        branch: filters.branch,
        employment_type: filters.employment_type,
        work_location: filters.work_location,
        status: filters.status,
        date_from: filters.date_from,
        date_to: filters.date_to,
        page: 1,
        page_size: 200,
      });
      setData({
        count: result.count || 0,
        results: result.results || [],
      });
    } catch (err) {
      setError(extractError(err, "Failed to load advances."));
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    filters.department,
    filters.branch,
    filters.employment_type,
    filters.work_location,
    filters.status,
    filters.date_from,
    filters.date_to,
    reloadKey,
    getAdvances,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function setFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      department: "",
      branch: "",
      employment_type: "",
      work_location: "",
      status: "",
      date_from: "",
      date_to: "",
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdvance(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setError(extractError(err, "Failed to delete advance."));
    } finally {
      setDeleting(false);
    }
  }

  const rows = data.results || [];

  const exportHeaders = [
    "Employee",
    "Employee ID",
    "Advance Date",
    "Amount",
    "Repaid",
    "Outstanding",
    "Reason",
    "Status",
  ];

  function exportRows() {
    return rows.map((r) => [
      r.employee_name,
      r.employee_code,
      formatDisplayDate(r.advance_date),
      r.amount,
      r.total_repaid,
      r.outstanding_amount,
      r.reason || "",
      ADVANCE_STATUS_LABELS[r.status] || r.status,
    ]);
  }

  return (
    <div>
      {flash && (
        <Banner kind="success" onClose={() => setFlash(false)}>
          Advance saved successfully.
        </Banner>
      )}

      <div
        className="pll-toolbar"
        style={{ justifyContent: "space-between" }}
      >
        <h3 style={{ margin: 0 }}>Employee Advances</h3>
        <button
          type="button"
          className="pll-btn-primary"
          onClick={() => setShowForm(true)}
        >
          + Give Advance
        </button>
      </div>

      <div className="pll-filter-bar">
        <div className="pll-filter-row">
          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Employee Search</span>
            <input
              className="pll-input"
              type="text"
              placeholder="Name / ID…"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Department</span>
            <select
              className="pll-select"
              value={filters.department}
              onChange={(e) => setFilter("department", e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Branch</span>
            <select
              className="pll-select"
              value={filters.branch}
              onChange={(e) => setFilter("branch", e.target.value)}
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Employment Type</span>
            <select
              className="pll-select"
              value={filters.employment_type}
              onChange={(e) => setFilter("employment_type", e.target.value)}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Work Location</span>
            <select
              className="pll-select"
              value={filters.work_location}
              onChange={(e) => setFilter("work_location", e.target.value)}
            >
              {WORK_LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Advance Status</span>
            <select
              className="pll-select"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="">All</option>
              {ADVANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ADVANCE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Date From</span>
            <input
              className="pll-input"
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilter("date_from", e.target.value)}
            />
          </label>

          <label className="pll-field pll-field-inline">
            <span className="pll-field-label">Date To</span>
            <input
              className="pll-input"
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilter("date_to", e.target.value)}
            />
          </label>

          <button
            type="button"
            className="pll-btn-outline pll-btn-sm"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <ExportBar
        onExportExcel={() =>
          exportToExcel("advance-history.xls", exportHeaders, exportRows())
        }
        onExportCsv={() =>
          exportToCSV("advance-history.csv", exportHeaders, exportRows())
        }
        onExportPdf={() =>
          exportToPDF({
            title: "Employee Advance History",
            meta: [`Records: ${rows.length}`],
            headers: exportHeaders,
            rows: exportRows(),
          })
        }
        onPrint={() =>
          printRecords({
            title: "Employee Advance History",
            headers: exportHeaders,
            rows: exportRows(),
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
        <div className="pll-table-wrap">
          <table className="pll-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th className="pll-num">Advance Amount</th>
                <th className="pll-num">Repaid</th>
                <th className="pll-num">Outstanding</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="pll-empty-row">
                    No advance records match this filter.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDisplayDate(r.advance_date)}</td>
                  <td>{r.employee_name}</td>
                  <td className="pll-num">{formatINR(r.amount)}</td>
                  <td className="pll-num">{formatINR(r.total_repaid)}</td>
                  <td className="pll-num">
                    {formatINR(r.outstanding_amount)}
                  </td>
                  <td>{r.reason || "—"}</td>
                  <td>
                    <AdvanceStatusBadge status={r.status} />
                  </td>
                  <td className="pll-row-actions">
                    <button
                      type="button"
                      className="pll-link-btn"
                      onClick={() => setViewTarget(r)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="pll-link-btn"
                      onClick={() => setEditTarget(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="pll-link-btn pll-link-danger"
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

      {showForm && (
        <AdvanceFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setFlash(true);
            setTimeout(() => setFlash(false), 3000);
            fetchData();
          }}
        />
      )}

      {editTarget && (
        <EditAdvanceModal
          advance={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            setFlash(true);
            setTimeout(() => setFlash(false), 3000);
            fetchData();
          }}
        />
      )}

      {viewTarget && (
        <AdvanceDetailModal
          advance={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete advance record?"
          message={
            Number(deleteTarget.total_repaid || 0) > 0
              ? `This advance has ${formatINR(
                  deleteTarget.total_repaid
                )} repaid against it and can't be deleted.`
              : `Remove the ${formatINR(
                  deleteTarget.amount
                )} advance for ${deleteTarget.employee_name} dated ${formatDisplayDate(
                  deleteTarget.advance_date
                )}?`
          }
          confirmLabel="Delete"
          danger
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   PAGE SHELL
   ========================================================================== */

export default function Salary() {
  const [activeTab, setActiveTab] = useState("calculator");
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(currentMonthStr());
  const [viewRecord, setViewRecord] = useState(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  const handleBack = () => window.history.back();

  function goEditRecord(record) {
    setEmployeeId(String(record.employee));
    setMonth(record.salary_month?.slice(0, 7) || currentMonthStr());
    setActiveTab("calculator");
  }

  function goViewRecord(record) {
    setViewRecord(record);
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

      <div className="sal-page">
        <div className="sal-page-header">
          <div className="sal-page-header-left">
            <button
              className="sal-back-btn"
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
            <div>
              <h1>Employee Salary</h1>
              <p>
                Attendance-based wages flow in automatically for hourly
                employees; monthly-salary employees are unaffected.
              </p>
            </div>
          </div>
          <div className="sal-page-header-actions">
            <span className="sal-header-badge">Payroll</span>
          </div>
        </div>

        <div className="pll-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`pll-tab-btn ${
                activeTab === t.key ? "pll-tab-btn-active" : ""
              }`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "calculator" && (
          <SalaryCalculatorTab
            employeeId={employeeId}
            setEmployeeId={setEmployeeId}
            month={month}
            setMonth={setMonth}
            onSaved={() => setHistoryReloadKey((k) => k + 1)}
            onViewExisting={goViewRecord}
            onRefreshCounts={() => setHistoryReloadKey((k) => k + 1)}
          />
        )}

        {activeTab === "history" && (
          <SalaryHistoryTab
            key={historyReloadKey}
            onEdit={goEditRecord}
            onView={goViewRecord}
          />
        )}

        {activeTab === "advances" && <AdvanceManagementTab />}

        {viewRecord && (
          <ViewSalaryModal
            record={viewRecord}
            onClose={() => setViewRecord(null)}
          />
        )}
      </div>
    </>
  );
}