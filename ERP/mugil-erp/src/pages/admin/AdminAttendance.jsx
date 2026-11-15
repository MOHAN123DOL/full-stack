import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import AdminStatStrip from "./components/AdminStatStrip";
import AdminStatusBadge from "./components/AdminStatusBadge";
import AdminToolbar from "./components/AdminToolbar";
import {
  Search,
  Eye,
  X,
  Download,
  Wallet,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Settings2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Users,
  Banknote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./AdminAttendance.css";

/* ============================================================
   CONSTANTS
   ============================================================ */

const ATTENDANCE_ENDPOINT = "/erp/admin/attendance/";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const DAILY_ERROR = "Unable to load daily attendance.";

/* ============================================================
   DATE / FORMAT HELPERS
   ============================================================ */

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const parseISO = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
};

/* 15 Oct 2026 */
const formatISODate = (iso) => {
  const p = parseISO(iso);
  if (!p) return "—";
  return `${String(p.d).padStart(2, "0")} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
};

/* 15 Oct (no year) */
const formatShortDate = (iso) => {
  const p = parseISO(iso);
  if (!p) return "—";
  return `${String(p.d).padStart(2, "0")} ${MONTHS_SHORT[p.m - 1]}`;
};

/*
  Compact range used inside table rows:
   - same day            → 15 Oct 2026
   - same year           → 01 Oct – 31 Oct
   - spans different yrs → 20 Dec 2025 – 05 Jan 2026
*/
const formatRowDates = (fromISO, toISO) => {
  const a = parseISO(fromISO);
  const b = parseISO(toISO || fromISO);
  if (!a && !b) return "—";
  if (!a) return formatISODate(toISO);
  if (!b) return formatISODate(fromISO);
  if (fromISO === toISO || !toISO) return formatISODate(fromISO);
  if (a.y !== b.y) {
    return `${formatISODate(fromISO)} – ${formatISODate(toISO)}`;
  }
  return `${formatShortDate(fromISO)} – ${formatShortDate(toISO)}`;
};

/* Full range used in the caption: 01 Oct 2026 → 31 Oct 2026 */
const formatWindow = (fromISO, toISO) => {
  if (!fromISO && !toISO) return "—";
  if (!toISO || fromISO === toISO) return formatISODate(fromISO);
  return `${formatISODate(fromISO)} → ${formatISODate(toISO)}`;
};

const daysBetween = (fromISO, toISO) => {
  if (!fromISO || !toISO) return 0;
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  return Math.max(Math.round((b - a) / 86400000) + 1, 0);
};

const formatHours = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(2)} h`;
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `₹ ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const matchesQuery = (query, ...fields) => {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return true;
  return fields.some((f) =>
    String(f || "")
      .toLowerCase()
      .includes(q),
  );
};

/* ============================================================
   LABELS / OPTIONS
   ============================================================ */

const ATTENDANCE_STATUS_LABEL = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  WFH: "Work From Home",
};

const STATUS_TEXT = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  WFH: "Work From Home",
  PAID_LEAVE: "Paid Leave",
  UNPAID_LEAVE: "Unpaid Leave",
  ON_LEAVE: "On Leave",
  ABSENT: "Absent",
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly Off",
  NOT_MARKED: "Not Marked",
};

const PILL_TONE = {
  PRESENT: "present",
  HALF_DAY: "half",
  WFH: "wfh",
  PAID_LEAVE: "leave",
  UNPAID_LEAVE: "leave",
  ON_LEAVE: "leave",
  ABSENT: "absent",
  HOLIDAY: "holiday",
  WEEKLY_OFF: "weekly",
  NOT_MARKED: "notmarked",
};

const PERIOD_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

const PERIOD_LABEL = PERIOD_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const DEPARTMENT_OPTIONS = [
  { value: "all", label: "All Departments" },
  { value: "Projects", label: "Projects" },
  { value: "Accounts", label: "Accounts" },
  { value: "Engineering", label: "Engineering" },
  { value: "Operations", label: "Operations" },
  { value: "HR", label: "HR" },
  { value: "Purchase", label: "Purchase" },
  { value: "Stores", label: "Stores" },
];

const ATTENDANCE_STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "WFH", label: "Work From Home" },
  { value: "ON_LEAVE", label: "On Leave" },
];

const MONTH_OPTIONS = MONTHS_LONG.map((label, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label,
}));

/* Year dropdown: current year −10 … +2 (newest first). */
const buildYearOptions = () => {
  const current = new Date().getFullYear();
  const out = [];
  for (let y = current + 2; y >= current - 10; y -= 1) {
    out.push({ value: String(y), label: String(y) });
  }
  return out;
};

const isAbortError = (err) =>
  err?.code === "ERR_CANCELED" ||
  err?.name === "CanceledError" ||
  err?.name === "AbortError";

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.detail || fallback;

/* ============================================================
   SMALL PRESENTATION COMPONENTS
   ============================================================ */

function AttendancePill({ code, label }) {
  const tone = PILL_TONE[code] || "other";
  const text = label || STATUS_TEXT[code] || code || "—";
  return (
    <span className={`attendance-pill attendance-pill--${tone}`}>{text}</span>
  );
}

/* ============================================================
   TABLE CELLS / COLUMNS
   ============================================================ */

const personCell = (row) => (
  <>
    <span className="admin-cell-primary">{row.employee_name || "—"}</span>
    <span className="admin-cell-secondary">{row.employee_code || "—"}</span>
  </>
);

const roleColumn = {
  key: "designation",
  header: "Job Role",
  render: (row) => row.designation || "—",
};

const departmentColumn = {
  key: "department",
  header: "Department",
  render: (row) => row.department || "—",
};

const statusColumn = {
  key: "status",
  header: "Status",
  sortValue: (row) => ATTENDANCE_STATUS_LABEL[row.status] || row.status || "",
  render: (row) => (
    <AdminStatusBadge
      status={ATTENDANCE_STATUS_LABEL[row.status] || row.status || "—"}
    />
  ),
};

const makePresentDatesColumn = (isRange, windowFrom, windowTo) => ({
  key: "dates",
  header: isRange ? "Dates" : "Date",
  sortValue: (row) => row.from_date || row.date || windowFrom || "",
  render: (row) => {
    const from = row.from_date || row.date || windowFrom;
    const to = row.to_date || row.date || windowTo || from;
    const text = isRange
      ? formatRowDates(from, to)
      : formatISODate(row.date || from);
    return (
      <span className="attendance-dates-cell" title={formatWindow(from, to)}>
        {text}
      </span>
    );
  },
});

const makeLeaveDatesColumn = (isRange, windowFrom, windowTo) => ({
  key: "dates",
  header: isRange ? "Dates" : "Date",
  sortValue: (row) => row.from_date || windowFrom || "",
  render: (row) => {
    const from = row.from_date || windowFrom;
    const to = row.to_date || row.from_date || windowTo;
    const text = isRange ? formatRowDates(from, to) : formatISODate(from);
    return (
      <span className="attendance-dates-cell" title={formatWindow(from, to)}>
        {text}
      </span>
    );
  },
});

const daysWorkedColumn = {
  key: "days_worked",
  header: "Days Worked",
  align: "right",
  sortValue: (row) => Number(row.days_worked) || 0,
  render: (row) => (
    <strong className="attendance-numeric">{row.days_worked ?? "—"}</strong>
  ),
};

const loginTimeColumn = {
  key: "login_time",
  header: "Login Time",
  render: (row) => (
    <span className="attendance-login-cell">{row.login_time || "—"}</span>
  ),
};

const makeHoursColumn = (isRange) => ({
  key: "working_hours",
  header: isRange ? "Total Hours" : "Hours",
  align: "right",
  sortValue: (row) => Number(row.working_hours) || 0,
  render: (row) => (
    <span className="attendance-numeric">{formatHours(row.working_hours)}</span>
  ),
});

const makeWageColumn = (isRange) => ({
  key: "daily_wage",
  header: isRange ? "Total Wage" : "Wage",
  align: "right",
  sortValue: (row) => Number(row.daily_wage) || 0,
  render: (row) => (
    <span className="attendance-numeric">{formatCurrency(row.daily_wage)}</span>
  ),
});

const reasonColumn = {
  key: "reason",
  header: "Reason for Leave",
  render: (row) => (
    <span className={`admin-cell-wrap${row.reason ? "" : " admin-cell-muted"}`}>
      {row.reason || "Not specified"}
    </span>
  ),
};

const leaveDaysColumn = {
  key: "leave_days",
  header: "Leave Days",
  align: "right",
  sortValue: (row) => Number(row.leave_days) || 0,
  render: (row) => (
    <strong className="attendance-numeric">{row.leave_days ?? "—"}</strong>
  ),
};

/* Monthly (all active employees) columns */
const makeCountColumn = (key, header) => ({
  key,
  header,
  align: "right",
  sortValue: (row) => Number(row[key]) || 0,
  render: (row) => <span className="attendance-numeric">{row[key] ?? 0}</span>,
});

const makeMonthlyColumns = (onView) => [
  { key: "employee_name", header: "Employee Name", render: personCell },
  roleColumn,
  departmentColumn,
  {
    key: "status",
    header: "Status",
    sortValue: (row) => row.status_label || row.status || "",
    render: (row) => (
      <AttendancePill code={row.status} label={row.status_label} />
    ),
  },
  {
    key: "days_worked",
    header: "Days Worked",
    align: "right",
    sortValue: (row) => Number(row.days_worked) || 0,
    render: (row) => (
      <>
        <strong className="attendance-numeric">{row.days_worked ?? 0}</strong>
        {Number(row.half_days) > 0 && (
          <span className="admin-cell-secondary">{row.half_days} half-day</span>
        )}
      </>
    ),
  },
  makeCountColumn("leave_days", "Leave"),
  makeCountColumn("absent_days", "Absent"),
  makeCountColumn("not_marked_days", "Not Marked"),
  makeHoursColumn(true),
  makeWageColumn(true),
  {
    key: "daily_view",
    header: "Daily View",
    align: "right",
    render: (row) => (
      <span className="attendance-eye-cell">
        <button
          type="button"
          className="attendance-eye-button"
          title="View daily attendance"
          aria-label={`View daily attendance for ${
            row.employee_name || "employee"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onView(row);
          }}
        >
          <Eye size={16} strokeWidth={2} />
        </button>
      </span>
    ),
  },
];

/* ============================================================
   DAILY ATTENDANCE MODAL
   ============================================================ */

function DailyAttendanceModal({
  target,
  data,
  loading,
  error,
  onClose,
  onRetry,
}) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const { employee, year, month } = target;
  const monthLabel = `${MONTHS_LONG[Number(month) - 1]} ${year}`;

  const person = data?.employee || employee;
  const rows = data?.daily_attendance ?? [];
  const totals = data?.totals;
  const showLogout = Boolean(data?.supports_logout);
  const colCount = showLogout ? 7 : 6;

  const chips = totals
    ? [
        ["Worked", totals.days_worked, "present"],
        ["Leave", totals.leave_days, "leave"],
        ["Absent", totals.absent_days, "absent"],
        ["Holiday", totals.holiday_days, "holiday"],
        ["Weekly Off", totals.weekly_off_days, "weekly"],
        ["Not Marked", totals.not_marked_days, "notmarked"],
      ]
    : [];

  return createPortal(
    <div className="attendance-modal-backdrop" role="presentation">
      <section
        className="attendance-daily-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-daily-title"
      >
        <header className="attendance-daily-modal-header">
          <div>
            <h2 id="attendance-daily-title">
              {person?.employee_name || "Employee"}
              <span className="attendance-daily-code">
                {person?.employee_code || "—"}
              </span>
            </h2>
            <p>
              {[person?.designation, person?.department]
                .filter(Boolean)
                .join(" · ") || "—"}
              {" · "}
              <strong>{monthLabel}</strong>
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            className="attendance-modal-close"
            onClick={onClose}
            aria-label="Close daily attendance"
          >
            <X size={18} />
          </button>
        </header>

        {chips.length > 0 && !loading && !error && (
          <div className="attendance-daily-chips">
            {chips.map(([label, value, tone]) => (
              <span
                key={label}
                className={`attendance-chip attendance-chip--${tone}`}
              >
                {label}
                <strong>{value ?? 0}</strong>
              </span>
            ))}
            <span className="attendance-chip attendance-chip--hours">
              Hours
              <strong>{formatHours(totals.total_hours)}</strong>
            </span>
            <span className="attendance-chip attendance-chip--hours">
              Wage
              <strong>{formatCurrency(totals.total_wage)}</strong>
            </span>
          </div>
        )}

        {loading ? (
          <p className="attendance-modal-state">Loading daily attendance…</p>
        ) : error ? (
          <div className="attendance-modal-state attendance-modal-error">
            <p>{error}</p>
            <button
              type="button"
              className="attendance-modal-retry"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="attendance-daily-table-wrap">
            <table className="attendance-daily-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Status</th>
                  <th>Login Time</th>
                  {showLogout && <th>Logout Time</th>}
                  <th className="attendance-th-right">Working Hours</th>
                  <th className="attendance-th-right">Daily Wage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.date}
                    className={`attendance-daily-row attendance-daily-row--${
                      PILL_TONE[item.status] || "other"
                    }`}
                  >
                    <td>{formatISODate(item.date)}</td>
                    <td>{item.day_name || "—"}</td>
                    <td>
                      <AttendancePill
                        code={item.status}
                        label={item.status_label}
                      />
                      {item.note && (
                        <span className="attendance-daily-note">
                          {item.note}
                        </span>
                      )}
                    </td>
                    <td>{item.login_time || "—"}</td>
                    {showLogout && <td>{item.logout_time || "—"}</td>}
                    <td className="attendance-td-right">
                      {formatHours(item.working_hours)}
                    </td>
                    <td className="attendance-td-right">
                      {formatCurrency(item.daily_wage)}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={colCount} className="attendance-modal-state">
                      No daily records returned for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="attendance-daily-modal-footer">
          <button
            type="button"
            className="attendance-modal-done"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

/* ============================================================
   NXT GENZ — SALARY + ADVANCE MANAGEMENT (all inside this file)
   ============================================================ */

const SALARY_API = {
  employees: "/erp/salary/employees/",
  configs: "/erp/wage-config/",
  advances: "/erp/advances/",
  advance: (id) => `/erp/advances/${id}/`,
  advancesOutstanding: "/erp/advances/outstanding/",
  repayments: "/erp/advances/repayments/",
  payments: "/erp/salary-payments/",
  payment: (id) => `/erp/salary-payments/${id}/`,
  preview: "/erp/admin/salary/calculate/",
  confirm: (id) => `/erp/admin/salary/${id}/confirm/`,
  paid: (id) => `/erp/admin/salary/${id}/mark-paid/`,
};

const PAGE_SIZE = 10;

const listData = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : [];
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const moneyText = (value) =>
  `₹${num(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const idOf = (value) => String(value?.id ?? value ?? "");
const salaryError = (err) => {
  const body = err?.response?.data;
  if (typeof body === "string")
    return body.length > 300
      ? "The server returned an unexpected response."
      : body;
  if (body?.detail) return String(body.detail);
  if (body?.message) return String(body.message);
  if (body && typeof body === "object") {
    return Object.entries(body)
      .map(
        ([field, messages]) =>
          `${field}: ${Array.isArray(messages) ? messages.join(", ") : typeof messages === "object" ? JSON.stringify(messages) : messages}`,
      )
      .join(" | ");
  }
  return err?.message || "Unable to complete the request.";
};
const employeeLabel = (person) =>
  person?.employee_name ||
  person?.full_name ||
  [person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
  person?.name ||
  `Employee #${person?.id}`;
const employeeCode = (person) =>
  person?.employee_id ?? person?.employee_code ?? "";

/* Excel-compatible CSV. Text starting with formula characters is escaped
   so employee-provided text cannot execute as a spreadsheet formula. */
const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@\-]/.test(text) && !/^-?\d+(?:\.\d+)?$/.test(text.trim()))
    text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvDownload = (filename, rows) => {
  const csv =
    "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* Walks every DRF page so nothing is silently truncated. */
const getAllPages = async (endpoint, auth, params = {}) => {
  const output = [];
  let next = endpoint;
  let options = { ...auth, params: { ...params, page_size: 100 } };
  const seen = new Set();
  while (next) {
    const key = new URL(next, window.location.origin).href;
    if (seen.has(key)) throw new Error("Pagination loop detected.");
    seen.add(key);
    const response = await api.get(next, options);
    const payload = response.data;
    if (!Array.isArray(payload) && !Array.isArray(payload?.results)) {
      throw new Error("Unexpected API list response.");
    }
    output.push(...listData(payload));
    next = Array.isArray(payload) ? null : payload?.next || null;
    options = { ...auth }; // `next` already carries its own query string
  }
  return output;
};

const WORKED_STATUSES = ["PRESENT", "HALF_DAY", "WFH"];
/* Day-level figures supplied by the server in calculation_snapshot.days[]
   (the preview response carries the same snapshot). Hour/day totals only. */
const snapshotStats = (record) => {
  const days = record?.calculation_snapshot?.days;
  if (!Array.isArray(days)) return null;
  const worked = days.filter((d) => WORKED_STATUSES.includes(d.status));
  const sum = (key) => worked.reduce((t, d) => t + num(d[key]), 0);
  return {
    daysWorked: worked.length,
    halfDays: worked.filter((d) => d.status === "HALF_DAY").length,
    normalHours: sum("normal_hours"),
    otHours: sum("approved_ot_hours"),
  };
};

const WORKFLOW_LABEL = {
  NOT_GENERATED: "Not Generated",
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
};
const workflowOf = (payment) => {
  if (!payment) return "NOT_GENERATED";
  if (payment.payment_status === "PAID") return "PAID";
  if (payment.payroll_status === "CONFIRMED") return "CONFIRMED";
  return "DRAFT";
};

/* Advance field accessors — tolerant of serializer naming. */
const advAmount = (a) =>
  num(a?.amount ?? a?.advance_amount ?? a?.original_amount ?? a?.total_amount);
const advOutstanding = (a) =>
  num(a?.outstanding_amount ?? a?.outstanding ?? a?.balance);
const advRepaid = (a) => {
  const direct = a?.repaid_amount ?? a?.total_repaid ?? a?.repaid;
  return direct != null
    ? num(direct)
    : Math.max(advAmount(a) - advOutstanding(a), 0);
};
const advRef = (a) =>
  a?.reference_number || a?.advance_number || a?.reference || `ADV-${a?.id}`;
/* Installment plan (fields added by the backend patch). Null when the advance has no plan. */
const advPlan = (a) => {
  const count = Math.floor(num(a?.installment_count));
  const each = num(a?.installment_amount);
  if (count < 1 || each <= 0) return null;
  const paid = Math.max(Math.floor(num(a?.installments_paid)), 0);
  const next = paid + 1;
  const outstanding = advOutstanding(a);
  const isLast = next >= count;
  /* The final installment clears whatever is left, so rounding never strands a few paise. */
  const suggested = Math.min(isLast ? outstanding : each, outstanding);
  return { count, each, paid, next, isLast, done: paid >= count, suggested };
};
const planText = (a) => {
  const plan = advPlan(a);
  return plan ? `${plan.count} × ${moneyText(plan.each)}` : "";
};
const advStatusKey = (a) => {
  if (advOutstanding(a) <= 0.0001) return "REPAID";
  if (advRepaid(a) > 0.0001) return "PARTIAL";
  return "OUTSTANDING";
};
const ADV_STATUS_LABEL = {
  OUTSTANDING: "Outstanding",
  PARTIAL: "Partially Repaid",
  REPAID: "Fully Repaid",
};
const advEmployeeName = (a, peopleById) =>
  a?.employee_name ||
  (a?.employee && typeof a.employee === "object"
    ? employeeLabel(a.employee)
    : "") ||
  (peopleById.get(idOf(a?.employee))
    ? employeeLabel(peopleById.get(idOf(a.employee)))
    : `Employee #${idOf(a?.employee)}`);

const isPositiveMoney = (value) => {
  const n = Number(value);
  return (
    Number.isFinite(n) &&
    n > 0 &&
    /^\d+(\.\d{1,2})?$/.test(String(value).trim())
  );
};

/* ------------------------------------------------------------
   Shared building blocks
   ------------------------------------------------------------ */

function NxStatus({ tone, children }) {
  return <span className={`nx-badge nx-badge--${tone}`}>{children}</span>;
}

function NxModal({
  title,
  subtitle,
  onClose,
  busy,
  wide,
  drawer,
  children,
  footer,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, busy]);

  return createPortal(
    <div
      className={`nx-backdrop${drawer ? " nx-backdrop--drawer" : ""}`}
      role="presentation"
    >
      <section
        className={`nx-dialog${wide ? " nx-dialog--wide" : ""}${drawer ? " nx-dialog--drawer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="nx-dialog-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="nx-icon-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>
        <div className="nx-dialog-body">{children}</div>
        {footer && <footer className="nx-dialog-foot">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}

function NxPager({ page, pageCount, total, onPage }) {
  if (total <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="nx-pager">
      <span>
        {from}–{to} of {total}
      </span>
      <div>
        <button
          type="button"
          className="nx-icon-btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <strong>
          {page} / {pageCount}
        </strong>
        <button
          type="button"
          className="nx-icon-btn"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function usePaging(items) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage],
  );
  return { page: safePage, setPage, pageCount, slice };
}

function NxSummaryCard({ icon, label, value, tone }) {
  return (
    <div className={`nx-card nx-card--${tone}`}>
      <span className="nx-card-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

/* ============================================================
   DAILY RATE MODAL
   ============================================================ */

const POLICY_OPTIONS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "FULL_DAY", label: "Full day paid" },
];

function RateModal({ row, auth, onClose, onSaved }) {
  const { person, config } = row;
  const [rate, setRate] = useState(
    config?.daily_rate == null ? "" : String(config.daily_rate),
  );
  const [policies, setPolicies] = useState({
    paid_leave_policy: config?.paid_leave_policy || "UNPAID",
    holiday_policy: config?.holiday_policy || "UNPAID",
    weekly_off_policy: config?.weekly_off_policy || "UNPAID",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const valid = Number.isFinite(Number(rate)) && Number(rate) > 0;
  const close = useCallback(() => onClose(), [onClose]);

  const save = async () => {
    if (lock.current) return;
    if (!valid) {
      setError("Enter a daily rate greater than zero.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const body = {
        employee: person.id,
        salary_type: "DAILY",
        daily_rate: String(rate),
        ...policies,
      };
      if (config?.id)
        await api.patch(`${SALARY_API.configs}${config.id}/`, body, auth);
      else await api.post(SALARY_API.configs, body, auth);
      await onSaved("Daily rate saved.");
    } catch (err) {
      setError(salaryError(err));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <NxModal
      title={config ? "Edit Daily Rate" : "Set Daily Rate"}
      subtitle="Salary type: DAILY"
      onClose={close}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            className="nx-btn nx-btn--ghost"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--primary"
            onClick={save}
            disabled={busy || !valid}
          >
            {busy
              ? "Saving…"
              : config
                ? "Update Daily Rate"
                : "Save Daily Rate"}
          </button>
        </>
      }
    >
      {error && (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      )}
      <div className="nx-grid nx-grid--2">
        <label className="nx-field">
          Employee name
          <input value={employeeLabel(person)} readOnly />
        </label>
        <label className="nx-field">
          Employee ID
          <input value={employeeCode(person) || person.id} readOnly />
        </label>
        <label className="nx-field nx-field--full">
          Daily rate (₹)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="1000.00"
            autoFocus
          />
        </label>
        {[
          ["paid_leave_policy", "Paid leave policy"],
          ["holiday_policy", "Holiday policy"],
          ["weekly_off_policy", "Weekly off policy"],
        ].map(([key, label]) => (
          <label className="nx-field" key={key}>
            {label}
            <select
              value={policies[key]}
              onChange={(e) =>
                setPolicies((old) => ({ ...old, [key]: e.target.value }))
              }
            >
              {POLICY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="nx-hint">
        {valid ? (
          <>
            Monday–Saturday: <strong>{moneyText(Number(rate) / 8)}</strong> /
            hour (rate ÷ 8) · Sunday:{" "}
            <strong>{moneyText(Number(rate) / 6)}</strong> / hour (rate ÷ 6)
          </>
        ) : (
          "Enter a daily rate to see the hourly rates."
        )}
      </div>
    </NxModal>
  );
}

/* ============================================================
   SALARY DRAWER (Add / Manage / View salary)
   ============================================================ */

const DEDUCTION_FIELDS = [
  ["allowances", "Allowances"],
  ["pf", "PF"],
  ["esi", "ESI"],
  ["tax", "Tax"],
  ["other_deductions", "Other deductions"],
];

const BREAKDOWN_ROWS = [
  ["attendance_wage", "Attendance wages"],
  ["overtime", "Overtime earnings"],
  ["allowances", "Allowances"],
  ["gross_earnings", "Gross salary"],
  ["pf", "PF"],
  ["esi", "ESI"],
  ["tax", "Tax"],
  ["other_deductions", "Other deductions"],
  ["advance_deduction", "Advance installments"],
  ["total_deductions", "Total deductions"],
  ["net_salary", "Net salary"],
];

function SalaryDrawer({
  rowFor,
  employeeKey,
  month,
  auth,
  onClose,
  onChanged,
}) {
  const row = rowFor(employeeKey);
  const { person, config, payment: saved } = row;
  const workflow = workflowOf(saved);
  const locked = workflow === "CONFIRMED" || workflow === "PAID";
  const rateOk = config?.salary_type === "DAILY" && num(config?.daily_rate) > 0;

  const [form, setForm] = useState(() => ({
    allowances: String(saved?.allowances ?? "0"),
    pf: String(saved?.pf ?? "0"),
    esi: String(saved?.esi ?? "0"),
    tax: String(saved?.tax ?? "0"),
    other_deductions: String(saved?.other_deductions ?? "0"),
    remarks: saved?.remarks ?? "",
  }));
  const [installments, setInstallments] = useState(() => {
    const snap = saved?.calculation_snapshot;
    const src =
      saved?.installments ??
      saved?.advance_installments ??
      saved?.advance_deductions ??
      snap?.installments ??
      snap?.advance_installments;
    const out = {};
    if (Array.isArray(src)) {
      src.forEach((item) => {
        const advance = idOf(item.advance ?? item.advance_id);
        if (advance)
          out[advance] = String(item.amount ?? item.installment_amount ?? "");
      });
    }
    return out;
  });
  const [advances, setAdvances] = useState([]);
  const [advLoading, setAdvLoading] = useState(true);
  const [advError, setAdvError] = useState("");
  const [advReload, setAdvReload] = useState(0);
  const [repayTarget, setRepayTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [lastStats, setLastStats] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const prefilled = useRef(false);

  /* Outstanding advances for this employee: GET /erp/advances/?employee=<id> */
  useEffect(() => {
    let alive = true;
    setAdvLoading(true);
    setAdvError("");
    getAllPages(SALARY_API.advances, auth, { employee: person.id })
      .then((items) => {
        if (!alive) return;
        const mine = items.filter(
          (a) =>
            idOf(a.employee) === String(person.id) &&
            advOutstanding(a) > 0.0001,
        );
        setAdvances(mine);
        /* New salary: pre-fill this month's scheduled installment (visible, editable, saved only with the draft). */
        if (!prefilled.current && !saved) {
          prefilled.current = true;
          const planned = {};
          mine.forEach((a) => {
            const plan = advPlan(a);
            if (plan && plan.suggested > 0)
              planned[a.id] = plan.suggested.toFixed(2);
          });
          if (Object.keys(planned).length) setInstallments(planned);
        }
      })
      .catch((err) => alive && setAdvError(salaryError(err)))
      .finally(() => alive && setAdvLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, person.id, advReload]);

  const changeField = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setPreview(null);
    setDirty(true);
  };
  const changeInstallment = (id, value) => {
    setInstallments((old) => ({ ...old, [id]: value }));
    setPreview(null);
    setDirty(true);
  };

  const fillInstallments = (mode) => {
    setInstallments(() => {
      const out = {};
      advances.forEach((a) => {
        if (mode === "full") out[a.id] = advOutstanding(a).toFixed(2);
        if (mode === "plan" && advPlan(a))
          out[a.id] = advPlan(a).suggested.toFixed(2);
      });
      return out;
    });
    setPreview(null);
    setDirty(true);
  };

  const installmentTotal = advances.reduce(
    (s, a) => s + (num(installments[a.id]) > 0 ? num(installments[a.id]) : 0),
    0,
  );

  const validate = () => {
    for (const [key, label] of DEDUCTION_FIELDS) {
      const raw = form[key];
      if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0))
        return `${label} must be 0 or more.`;
    }
    for (const a of advances) {
      const raw = installments[a.id];
      if (raw === "" || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0)
        return `Installment for ${advRef(a)} must be 0 or more.`;
      if (n > advOutstanding(a) + 0.0001) {
        return `Installment for ${advRef(a)} (${moneyText(n)}) exceeds its outstanding ${moneyText(advOutstanding(a))}.`;
      }
    }
    return "";
  };

  const payload = () => ({
    employee: person.id,
    salary_month: `${month}-01`,
    ...Object.fromEntries(
      DEDUCTION_FIELDS.map(([key]) => [
        key,
        String(form[key] === "" ? "0" : form[key]),
      ]),
    ),
    remarks: form.remarks,
    installments: advances
      .filter((a) => num(installments[a.id]) > 0)
      .map((a) => ({ advance: a.id, amount: String(installments[a.id]) })),
  });

  const run = async (key, action, success, { validateFirst = false } = {}) => {
    if (lock.current) return null;
    if (validateFirst) {
      const problem = validate();
      if (problem) {
        setError(problem);
        return null;
      }
    }
    lock.current = true;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setNotice(success);
      return result;
    } catch (err) {
      setError(salaryError(err));
      return null;
    } finally {
      lock.current = false;
      setBusy("");
    }
  };

  const calculate = async () => {
    const res = await run(
      "preview",
      () => api.post(SALARY_API.preview, payload(), auth),
      "Salary calculated by the server. Nothing has been saved.",
      { validateFirst: true },
    );
    if (res) {
      setPreview(res.data);
      const st = snapshotStats(res.data);
      if (st) setLastStats(st);
    }
  };

  /* Load attendance figures as soon as the panel opens (read-only server preview; nothing is saved). */
  useEffect(() => {
    if (rateOk && !locked && !saved) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveDraft = async () => {
    const res = await run(
      "draft",
      () =>
        saved?.id
          ? api.patch(SALARY_API.payment(saved.id), payload(), auth)
          : api.post(SALARY_API.payments, payload(), auth),
      "Draft saved. Advance balances are unchanged until the salary is confirmed.",
      { validateFirst: true },
    );
    if (res) {
      setPreview(null);
      setDirty(false);
      await onChanged();
    }
  };
  const confirmSalary = async () => {
    if (!saved?.id || workflow !== "DRAFT" || dirty) return;
    if (
      !window.confirm(
        `Confirm salary for ${employeeLabel(person)} (${month})?\n\nThe server will post the selected advance installments as repayments. Confirmed salary cannot be edited here.`,
      )
    )
      return;
    const res = await run(
      "confirm",
      () => api.post(SALARY_API.confirm(saved.id), {}, auth),
      "Salary confirmed. Advance installments were posted by the server.",
    );
    if (res) {
      setPreview(null);
      await onChanged({ advances: true });
    }
  };
  const markPaid = async () => {
    if (!saved?.id || workflow !== "CONFIRMED") return;
    if (
      !window.confirm(
        `Mark ${employeeLabel(person)}'s ${month} salary as paid?`,
      )
    )
      return;
    const res = await run(
      "paid",
      () => api.post(SALARY_API.paid(saved.id), {}, auth),
      "Salary marked as paid.",
    );
    if (res) await onChanged();
  };

  const shown = preview ? preview.totals || preview.salary || preview : saved;
  const fmt = (key) => {
    const v = shown?.[key] ?? shown?.totals?.[key];
    return v == null || v === "" ? "—" : moneyText(v);
  };
  const stats = snapshotStats(preview || saved) || lastStats;
  const hours = (v) => (stats ? `${Number(v.toFixed(2))} h` : "—");
  const busyAny = Boolean(busy);
  const splitUnknown =
    Boolean(saved) &&
    !locked &&
    num(saved.advance_deduction) > 0 &&
    Object.keys(installments).length === 0;

  return (
    <NxModal
      drawer
      wide
      title={`${locked ? "Salary details" : saved ? "Manage salary" : "Add salary"} — ${employeeLabel(person)}`}
      subtitle={`${employeeCode(person) || "ID " + person.id}${person.department ? " · " + person.department : ""} · ${month}`}
      onClose={onClose}
      busy={busyAny || Boolean(repayTarget)}
      footer={
        <>
          <button
            type="button"
            className="nx-btn nx-btn--ghost"
            onClick={onClose}
            disabled={busyAny}
          >
            Close
          </button>
          {!locked && (
            <>
              <button
                type="button"
                className="nx-btn nx-btn--outline"
                onClick={calculate}
                disabled={busyAny || !rateOk}
              >
                {busy === "preview" ? "Calculating…" : "Calculate Salary"}
              </button>
              <button
                type="button"
                className="nx-btn nx-btn--primary"
                onClick={saveDraft}
                disabled={busyAny || !rateOk}
              >
                {busy === "draft"
                  ? "Saving…"
                  : saved
                    ? "Update Draft"
                    : "Save Draft"}
              </button>
              <button
                type="button"
                className="nx-btn nx-btn--success"
                onClick={confirmSalary}
                disabled={busyAny || workflow !== "DRAFT" || dirty}
                title={dirty ? "Save the draft before confirming" : undefined}
              >
                <CheckCircle2 size={15} />{" "}
                {busy === "confirm" ? "Confirming…" : "Confirm Salary"}
              </button>
            </>
          )}
          {workflow === "CONFIRMED" && (
            <button
              type="button"
              className="nx-btn nx-btn--primary"
              onClick={markPaid}
              disabled={busyAny}
            >
              {busy === "paid" ? "Updating…" : "Mark Paid"}
            </button>
          )}
        </>
      }
    >
      {error && (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="nx-alert nx-alert--success" role="status">
          {notice}
        </div>
      )}

      <div className="nx-workflow" aria-label="Salary workflow">
        {["NOT_GENERATED", "DRAFT", "CONFIRMED", "PAID"].map((step, i) => {
          const order = ["NOT_GENERATED", "DRAFT", "CONFIRMED", "PAID"];
          const state =
            order.indexOf(step) < order.indexOf(workflow)
              ? "done"
              : step === workflow
                ? "current"
                : "todo";
          return (
            <span key={step} className={`nx-step nx-step--${state}`}>
              <i>{i + 1}</i>
              {WORKFLOW_LABEL[step]}
            </span>
          );
        })}
      </div>

      {!rateOk && (
        <div className="nx-alert nx-alert--error">
          No valid daily rate is configured for this employee. Close this panel
          and use “Set Daily Rate” first.
        </div>
      )}
      {locked && (
        <div className="nx-alert nx-alert--info">
          This salary is {WORKFLOW_LABEL[workflow].toLowerCase()} and read-only.
        </div>
      )}

      <section className="nx-section">
        <h3>Attendance & earnings</h3>
        <div className="nx-facts">
          <div>
            <span>Daily rate</span>
            <strong>{rateOk ? moneyText(config.daily_rate) : "—"}</strong>
          </div>
          <div>
            <span>Days worked</span>
            <strong>
              {stats
                ? `${stats.daysWorked}${stats.halfDays ? ` (${stats.halfDays} half-day)` : ""}`
                : "—"}
            </strong>
          </div>
          <div>
            <span>Normal hours</span>
            <strong>{stats ? hours(stats.normalHours) : "—"}</strong>
          </div>
          <div>
            <span>Approved OT hours</span>
            <strong>{stats ? hours(stats.otHours) : "—"}</strong>
          </div>
          <div>
            <span>Attendance wages</span>
            <strong>{fmt("attendance_wage")}</strong>
          </div>
          <div>
            <span>Overtime earnings</span>
            <strong>{fmt("overtime")}</strong>
          </div>
        </div>
        {!stats && (
          <p className="nx-muted">
            {busy === "preview"
              ? "Loading attendance from the server…"
              : rateOk
                ? "Attendance details could not be loaded yet — press “Calculate Salary”."
                : "Set a daily rate first to load attendance details."}
          </p>
        )}
      </section>

      <section className="nx-section">
        <h3>Allowances & deductions</h3>
        <div className="nx-grid nx-grid--3">
          {DEDUCTION_FIELDS.map(([key, label]) => (
            <label className="nx-field" key={key}>
              {label} (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form[key]}
                disabled={locked || busyAny}
                onChange={(e) => changeField(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="nx-section">
        <h3>Advance repayment</h3>
        <p className="nx-muted nx-gap">
          Two separate ways to repay: enter a <strong>salary deduction</strong>{" "}
          (applied when the salary is confirmed) or use{" "}
          <strong>Repay now</strong> to record a manual repayment immediately.
        </p>
        {advLoading ? (
          <p className="nx-muted">Loading outstanding advances…</p>
        ) : advError ? (
          <div className="nx-alert nx-alert--error">{advError}</div>
        ) : advances.length ? (
          <>
            {!locked && (
              <div className="nx-quickfill">
                {advances.some((a) => advPlan(a)) && (
                  <button
                    type="button"
                    className="nx-btn nx-btn--sm nx-btn--primary"
                    disabled={busyAny}
                    onClick={() => fillInstallments("plan")}
                  >
                    Apply this month&apos;s installments
                  </button>
                )}
                <button
                  type="button"
                  className="nx-btn nx-btn--sm nx-btn--outline"
                  disabled={busyAny}
                  onClick={() => fillInstallments("full")}
                >
                  Deduct full balance of all
                </button>
                <button
                  type="button"
                  className="nx-btn nx-btn--sm nx-btn--ghost"
                  disabled={busyAny}
                  onClick={() => fillInstallments("clear")}
                >
                  Clear
                </button>
                <span className="nx-muted">
                  The server rejects deductions larger than the gross salary.
                </span>
              </div>
            )}
            <div className="nx-table-scroll">
              <table className="nx-table nx-table--compact">
                <thead>
                  <tr>
                    <th>Advance</th>
                    <th>Date</th>
                    <th className="nx-right">Outstanding</th>
                    <th className="nx-right">Salary deduction (₹)</th>
                    <th className="nx-right">Manual repayment</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{advRef(a)}</strong>
                        {advPlan(a) && (
                          <small className="nx-sub">
                            {advPlan(a).done
                              ? `Plan complete (${advPlan(a).count} of ${advPlan(a).count})`
                              : `Installment ${advPlan(a).next} of ${advPlan(a).count} · ${moneyText(advPlan(a).suggested)}`}
                          </small>
                        )}
                      </td>
                      <td>{formatISODate(a.advance_date)}</td>
                      <td className="nx-right">
                        {moneyText(advOutstanding(a))}
                      </td>
                      <td className="nx-right">
                        <input
                          className="nx-input-inline"
                          type="number"
                          min="0"
                          max={advOutstanding(a)}
                          step="0.01"
                          value={installments[a.id] ?? ""}
                          placeholder="0.00"
                          disabled={locked || busyAny}
                          onChange={(e) =>
                            changeInstallment(a.id, e.target.value)
                          }
                          aria-label={`Deduction for ${advRef(a)}`}
                        />
                        {!locked && advPlan(a) && (
                          <button
                            type="button"
                            className="nx-link nx-link--inline"
                            disabled={busyAny}
                            onClick={() =>
                              changeInstallment(
                                a.id,
                                advPlan(a).suggested.toFixed(2),
                              )
                            }
                          >
                            Plan
                          </button>
                        )}
                        {!locked && (
                          <button
                            type="button"
                            className="nx-link nx-link--inline"
                            disabled={busyAny}
                            onClick={() =>
                              changeInstallment(
                                a.id,
                                advOutstanding(a).toFixed(2),
                              )
                            }
                          >
                            Full
                          </button>
                        )}
                      </td>
                      <td className="nx-right">
                        <button
                          type="button"
                          className="nx-btn nx-btn--sm nx-btn--outline"
                          disabled={locked || busyAny}
                          onClick={() => setRepayTarget(a)}
                        >
                          Repay now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total salary deduction</td>
                    <td className="nx-right">
                      <strong>{moneyText(installmentTotal)}</strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <p className="nx-muted">
            {locked
              ? "Installments were applied when this salary was confirmed."
              : "This employee has no outstanding advances."}
          </p>
        )}
        {splitUnknown && (
          <div className="nx-alert nx-alert--info">
            This draft has a saved advance deduction of{" "}
            {moneyText(saved.advance_deduction)}, but the API does not return
            the per-advance split. Re-enter the installments before updating the
            draft, or the deduction will be cleared.
          </div>
        )}
        {!locked && (
          <p className="nx-muted">
            Saving a draft never changes an advance balance. Repayments are
            posted only when the salary is confirmed.
          </p>
        )}
      </section>

      <section className="nx-section">
        <label className="nx-field">
          Remarks
          <textarea
            rows="2"
            value={form.remarks}
            disabled={locked || busyAny}
            onChange={(e) => changeField("remarks", e.target.value)}
            placeholder="Optional payroll notes"
          />
        </label>
      </section>

      {repayTarget && (
        <RepaymentModal
          advance={repayTarget}
          auth={auth}
          onClose={() => setRepayTarget(null)}
          onSaved={async (message) => {
            setRepayTarget(null);
            setPreview(null);
            setNotice(
              `${message} Balances updated — re-check the salary deduction amounts and recalculate before saving the draft.`,
            );
            setAdvReload((n) => n + 1);
            await onChanged({ advances: true });
          }}
        />
      )}

      <section className="nx-section">
        <h3>
          {preview
            ? "Server calculation (preview)"
            : saved
              ? "Saved salary"
              : "Salary breakdown"}
        </h3>
        {shown ? (
          <div className="nx-breakdown">
            {BREAKDOWN_ROWS.map(([key, label]) => (
              <div
                key={key}
                className={
                  key === "net_salary"
                    ? "nx-breakdown-net"
                    : key === "gross_earnings" || key === "total_deductions"
                      ? "nx-breakdown-strong"
                      : ""
                }
              >
                <span>{label}</span>
                <strong>{fmt(key)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="nx-muted">No server figures yet.</p>
        )}
        <p className="nx-formula">
          Gross salary − Total deductions = Net salary (calculated by the
          server)
        </p>
        {saved && !preview && (
          <p className="nx-muted">
            Payroll: {saved.payroll_status || "DRAFT"} · Payment:{" "}
            {saved.payment_status || "PENDING"}
            {saved.paid_date
              ? ` · Paid on ${formatISODate(saved.paid_date)}`
              : ""}
          </p>
        )}
        {dirty && !locked && (
          <p className="nx-muted">
            You have unsaved changes — save the draft before confirming.
          </p>
        )}
      </section>
    </NxModal>
  );
}

/* ============================================================
   SALARY MANAGEMENT TAB
   ============================================================ */

const SALARY_FILTER_OPTIONS = [
  { value: "all", label: "All salary status" },
  { value: "NOT_GENERATED", label: "Not Generated" },
  { value: "DRAFT", label: "Draft" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PAID", label: "Paid" },
];
const WORKFLOW_TONE = {
  NOT_GENERATED: "neutral",
  DRAFT: "warning",
  CONFIRMED: "info",
  PAID: "success",
};

/* Custom Salary Report — kept in AdminAttendance.jsx; server filters and exports all rows. */
/* ============================================================
   CUSTOM SALARY REPORT
   ------------------------------------------------------------
   Navigation is ONE explicit state object (`nav`):
     { view: "employees" | "months" | "days", employee, month }
   Only one view can ever be active, and detail rows are rendered
   only when they belong to the exact request that is currently
   on screen (see `detailRequest.key`), so stale rows from a
   previous level can never reach the wrong table.
   ============================================================ */

const SALARY_PERIODS = [
  { value: "today", label: "Today" },
  { value: "selected_date", label: "Specific Date" },
  { value: "this_month", label: "This Month" },
  { value: "selected_month", label: "Specific Month" },
  { value: "this_year", label: "This Year" },
  { value: "selected_year", label: "Specific Year" },
  { value: "custom", label: "Custom Date Range" },
];
const SALARY_LIST_PAGE_SIZE = 25;
const SALARY_DETAIL_PAGE_SIZE = 100;
const INITIAL_SALARY_NAV = { view: "employees", employee: null, month: null };

const isValidISODate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
  !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
const isYearMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
const monthStartISO = (ym) => `${ym}-01`;
const monthEndISO = (ym) => {
  const last = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0);
  return `${ym}-${String(last.getDate()).padStart(2, "0")}`;
};
const monthLabel = (ym) => {
  const name = MONTHS_LONG[Number(String(ym || "").slice(5, 7)) - 1];
  return name ? `${name} ${String(ym).slice(0, 4)}` : String(ym || "—");
};
const minISO = (a, b) => (a < b ? a : b);
const maxISO = (a, b) => (a > b ? a : b);

const readBlobError = async (blob) => {
  try {
    const text = await blob.text();
    try {
      const body = JSON.parse(text);
      return body.detail || body.message || "Export failed.";
    } catch {
      return "The server returned an unexpected response.";
    }
  } catch {
    return "Export failed.";
  }
};

/* Catches render errors in the report, logs them (never swallowed)
   and offers a recovery button instead of a blank page. */
class SalaryReportBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Custom Salary Report crashed:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="nx-pane">
        <div className="nx-alert nx-alert--error" role="alert">
          The salary report hit an unexpected error:{" "}
          {String(this.state.error?.message || this.state.error)}
        </div>
        <button
          type="button"
          className="nx-btn nx-btn--primary"
          onClick={() => this.setState({ error: null })}
        >
          <RefreshCw size={15} /> Reload report
        </button>
      </div>
    );
  }
}

function SalaryDayTable({ rows, showEmployee = true }) {
  const safe = Array.isArray(rows) ? rows.filter(Boolean) : [];
  return (
    <div className="nx-table-scroll nx-salary-day-scroll">
      <table className="nx-table nx-salary-day-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            {showEmployee && <th>Employee</th>}
            <th>Attendance</th>
            <th>Login</th>
            <th>Logout</th>
            <th className="nx-right">Hours</th>
            <th className="nx-right">Daily wage</th>
          </tr>
        </thead>
        <tbody>
          {safe.map((r, i) => (
            <tr key={r.id ?? `${r.employee_pk ?? "e"}-${r.date ?? "d"}-${i}`}>
              <td className="nx-salary-date">{formatISODate(r.date)}</td>
              {showEmployee && <td>{r.employee_name || "—"}</td>}
              <td>
                <AttendancePill code={r.status} />
              </td>
              <td>{r.login_time || "—"}</td>
              <td>{r.logout_time || "—"}</td>
              <td className="nx-right">{formatHours(r.working_hours)}</td>
              <td className="nx-right">{moneyText(r.daily_wage)}</td>
            </tr>
          ))}
          {!safe.length && (
            <tr>
              <td colSpan={showEmployee ? 7 : 6} className="nx-empty">
                No saved attendance wages for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminCustomSalaryReport({ accessToken }) {
  const today = todayISO();
  const currentYear = today.slice(0, 4);
  const [period, setPeriod] = useState("selected_date");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(currentYear);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState("");
  const [nav, setNav] = useState(INITIAL_SALARY_NAV);
  const [detailState, setDetailState] = useState(null);
  const [detailPage, setDetailPage] = useState(1);
  const requestSeq = useRef(0);
  const detailSeq = useRef(0);
  const detailCache = useRef(new Map());
  const auth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  /* Normalise every period option into one API-ready range. Current periods
     are clamped to today so future dates are never sent to the server. */
  const range = useMemo(() => {
    const invalid = (message) => ({
      message,
      from: "",
      to: "",
      isYear: false,
      api: {},
    });
    const ok = (from, to, api, extra = {}) => ({
      message: "",
      from,
      to,
      isYear: false,
      api,
      ...extra,
    });
    const custom = (from, to) =>
      ok(from, to, { period: "custom", date_from: from, date_to: to });
    switch (period) {
      case "today":
        return custom(today, today);
      case "selected_date":
        if (!isValidISODate(selectedDate))
          return invalid("Select an attendance date.");
        if (selectedDate > today) return invalid("Future dates are not allowed.");
        return ok(selectedDate, selectedDate, {
          period: "selected_date",
          date: selectedDate,
        });
      case "this_month":
        return custom(monthStartISO(today.slice(0, 7)), today);
      case "selected_month":
        if (!isYearMonth(selectedMonth)) return invalid("Select a valid month.");
        if (selectedMonth > today.slice(0, 7))
          return invalid("Future months are not allowed.");
        return custom(
          monthStartISO(selectedMonth),
          minISO(monthEndISO(selectedMonth), today),
        );
      case "this_year":
      case "selected_year": {
        const y = period === "this_year" ? currentYear : year;
        if (!/^\d{4}$/.test(String(y)) || String(y) > currentYear)
          return invalid("Select a valid year.");
        return ok(
          `${y}-01-01`,
          String(y) === currentYear ? today : `${y}-12-31`,
          { period: "year", year: String(y) },
          { isYear: true, year: String(y) },
        );
      }
      case "custom":
        if (!isValidISODate(dateFrom) || !isValidISODate(dateTo))
          return invalid("Select both dates.");
        if (dateFrom > dateTo)
          return invalid("From date must be before To date.");
        if (dateTo > today) return invalid("Future dates are not allowed.");
        return custom(dateFrom, dateTo);
      default:
        return invalid("Select a report type.");
    }
  }, [period, selectedDate, selectedMonth, year, dateFrom, dateTo, today, currentYear]);

  const validationMessage = range.message;
  const isDay = !range.isYear && !!range.from && range.from === range.to;
  /* Year and multi-month ranges drill Employee → Months → Days.
     A single month (or a single date) skips the pointless month screen. */
  const hasMonthStep =
    !isDay &&
    !!range.from &&
    (range.isYear || range.from.slice(0, 7) !== range.to.slice(0, 7));

  const filterParams = useMemo(
    () => ({
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(status ? { status } : {}),
      require_attendance: true,
      require_wage: true,
    }),
    [department, status],
  );
  const params = useMemo(
    () => ({
      ...range.api,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...filterParams,
    }),
    [range, search, filterParams],
  );

  /* Any filter/period change safely leaves drill-down. */
  useEffect(() => {
    setPage(1);
    setNav(INITIAL_SALARY_NAV);
    setDetailPage(1);
    setDetailState(null);
    detailCache.current.clear();
  }, [params]);

  /* Level 1 data: employee list (or day rows for a single date). */
  useEffect(() => {
    const seq = ++requestSeq.current;
    if (!accessToken || validationMessage) {
      setReport(null);
      setLoading(false);
      setError(!accessToken ? "Session expired. Please sign in again." : "");
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get("/erp/admin/salary/custom-report/", {
        ...auth,
        params: {
          ...params,
          view: isDay ? "days" : "employees",
          page,
          page_size: SALARY_LIST_PAGE_SIZE,
        },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (seq !== requestSeq.current) return;
        if (!Array.isArray(data?.results))
          throw new Error("Invalid report response from server.");
        setReport(data);
      })
      .catch((err) => {
        if (seq === requestSeq.current && !isAbortError(err)) {
          setReport(null);
          setError(salaryError(err));
        }
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, auth, params, page, refresh, validationMessage, isDay]);

  /* The exact request for the level currently on screen. */
  const detailRequest = useMemo(() => {
    const pk = nav.employee?.employee_pk;
    if (nav.view === "employees" || pk == null || validationMessage) return null;
    const base = { ...filterParams, employee_pk: pk };
    let query;
    if (nav.view === "months") {
      query = {
        ...range.api,
        ...base,
        view: "months",
        page: 1,
        page_size: SALARY_DETAIL_PAGE_SIZE,
      };
    } else if (nav.month && isYearMonth(nav.month)) {
      const from = maxISO(monthStartISO(nav.month), range.from);
      const to = minISO(minISO(monthEndISO(nav.month), range.to), today);
      query = {
        period: "custom",
        date_from: from,
        date_to: to,
        ...base,
        view: "days",
        page: detailPage,
        page_size: SALARY_DETAIL_PAGE_SIZE,
      };
    } else {
      query = {
        ...range.api,
        ...base,
        view: "days",
        page: detailPage,
        page_size: SALARY_DETAIL_PAGE_SIZE,
      };
    }
    return { key: JSON.stringify(query), params: query };
  }, [nav, range, filterParams, detailPage, validationMessage, today]);

  /* Levels 2 and 3 data. Results are cached per request so going back
     (Days → Months) is instant and never re-requests the server. */
  useEffect(() => {
    if (!detailRequest || !accessToken) return undefined;
    const { key, params: query } = detailRequest;
    const cached = detailCache.current.get(key);
    if (cached) {
      setDetailState({ key, data: cached, error: "" });
      return undefined;
    }
    const seq = ++detailSeq.current;
    const controller = new AbortController();
    api
      .get("/erp/admin/salary/custom-report/", {
        ...auth,
        params: query,
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (seq !== detailSeq.current) return;
        if (!Array.isArray(data?.results))
          throw new Error("Invalid employee details response.");
        detailCache.current.set(key, data);
        setDetailState({ key, data, error: "" });
      })
      .catch((err) => {
        if (seq === detailSeq.current && !isAbortError(err))
          setDetailState({ key, data: null, error: salaryError(err) });
      });
    return () => controller.abort();
  }, [detailRequest, accessToken, auth, refresh]);

  const activeDetail =
    detailRequest && detailState?.key === detailRequest.key ? detailState : null;
  const detailLoading = !!detailRequest && !activeDetail;
  const detailError = activeDetail?.error || "";
  const detailData = activeDetail?.data || null;
  const detailRows = Array.isArray(detailData?.results) ? detailData.results : [];
  const monthRows =
    nav.view === "months"
      ? detailRows.filter((r) => r && isYearMonth(String(r.month || "")))
      : [];
  const dayRows = nav.view === "days" ? detailRows.filter(Boolean) : [];

  const openEmployee = (row) => {
    if (!row || row.employee_pk == null) return;
    setDetailPage(1);
    setNav({
      view: hasMonthStep ? "months" : "days",
      employee: row,
      month: null,
    });
  };
  const openMonth = (ym) => {
    if (!isYearMonth(ym)) return;
    setDetailPage(1);
    setNav((n) => (n.employee ? { view: "days", employee: n.employee, month: ym } : n));
  };
  const backToMonths = () => {
    setDetailPage(1);
    setNav((n) =>
      n.employee ? { view: "months", employee: n.employee, month: null } : INITIAL_SALARY_NAV,
    );
  };
  const backToEmployees = () => {
    setDetailPage(1);
    setNav(INITIAL_SALARY_NAV);
  };
  const reload = () => {
    detailCache.current.clear();
    setDetailState(null);
    setRefresh((v) => v + 1);
  };

  const periodLabel = range.from
    ? range.isYear
      ? range.year
      : formatWindow(range.from, range.to)
    : "—";

  const exportFile = async (format) => {
    if (validationMessage || !accessToken || exporting) return;
    if (!isDay && !Number(report?.count || 0)) {
      setError("There are no records to export for these filters.");
      return;
    }
    setExporting(format);
    setError("");
    try {
      /* No page/page_size: the server exports every matching record. */
      const response = await api.get("/erp/admin/salary/custom-report/", {
        ...auth,
        params: { ...params, export: format },
        responseType: "blob",
      });
      if (!(response.data instanceof Blob) || !response.data.size)
        throw new Error("Empty export returned by server.");
      if (/json|html/.test(response.data.type || ""))
        throw new Error(await readBlobError(response.data));
      const label = range.isYear
        ? range.year
        : isDay
          ? range.from
          : `${range.from}_to_${range.to}`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `NXT_GENZ_Salary_${label}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      if (err?.response?.data instanceof Blob)
        setError(await readBlobError(err.response.data));
      else setError(salaryError(err));
    } finally {
      setExporting("");
    }
  };

  const records = Array.isArray(report?.results) ? report.results.filter(Boolean) : [];
  const summary = report?.summary || {};
  const total = Number(report?.count || 0);
  const totalPages = Math.max(1, Math.ceil(total / SALARY_LIST_PAGE_SIZE));

  const detailTotals = (() => {
    const rows = nav.view === "months" ? monthRows : dayRows;
    const s = detailData?.summary || {};
    return {
      days:
        s.records ??
        rows.reduce((a, r) => a + (nav.view === "months" ? num(r.days) : 1), 0),
      hours:
        s.total_working_hours ??
        rows.reduce(
          (a, r) => a + num(nav.view === "months" ? r.hours : r.working_hours),
          0,
        ),
      wage:
        s.total_wage ??
        rows.reduce(
          (a, r) => a + num(nav.view === "months" ? r.total_wage : r.daily_wage),
          0,
        ),
    };
  })();

  const crumb = nav.employee
    ? `${nav.employee.employee_name || "Employee"}${nav.employee.employee_code ? ` (${nav.employee.employee_code})` : ""}`
    : "";

  return (
    <div className="nx-pane">
      <div className="nx-pane-head">
        <div>
          <h2>
            <Banknote size={21} /> Custom Salary Report
          </h2>
          <p>
            Pick a period, then use the eye icon to drill into an employee&apos;s
            monthly and day-wise wages.
          </p>
        </div>
        <div className="nx-pane-actions">
          <button
            type="button"
            className="nx-btn nx-btn--outline"
            disabled={!!validationMessage || loading || !!exporting}
            onClick={() => exportFile("csv")}
          >
            <Download size={15} /> {exporting === "csv" ? "Exporting…" : "CSV"}
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--primary"
            disabled={!!validationMessage || loading || !!exporting}
            onClick={() => exportFile("xlsx")}
          >
            <Download size={15} />{" "}
            {exporting === "xlsx" ? "Exporting…" : "Excel - Employee Sheets"}
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--outline"
            disabled={loading}
            onClick={reload}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      <div className="nx-toolbar nx-salary-filters" style={{ flexWrap: "wrap" }}>
        <label className="nx-field">
          Report type
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {SALARY_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {period === "selected_date" && (
          <label className="nx-field">
            Choose date
            <input
              type="date"
              max={today}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
        )}
        {period === "selected_month" && (
          <label className="nx-field">
            Choose month
            <input
              type="month"
              max={today.slice(0, 7)}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </label>
        )}
        {period === "selected_year" && (
          <label className="nx-field">
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {Array.from({ length: 10 }, (_, i) => Number(currentYear) - i).map(
                (y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
        {period === "custom" && (
          <>
            <label className="nx-field">
              From
              <input
                type="date"
                max={today}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="nx-field">
              To
              <input
                type="date"
                max={today}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="nx-field nx-field--grow">
          Search employee
          <span className="nx-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee name or ID"
            />
          </span>
        </label>
        <label className="nx-field">
          Department
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="All departments"
          />
        </label>
        <label className="nx-field">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All worked statuses</option>
            <option value="PRESENT">Present</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="WFH">Work From Home</option>
          </select>
        </label>
      </div>

      {validationMessage && (
        <div className="nx-alert nx-alert--error" role="alert">
          {validationMessage}
        </div>
      )}
      {error && (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="nx-cards">
        <NxSummaryCard
          tone="navy"
          icon={<CalendarDays size={18} />}
          label="Attendance days"
          value={summary.records ?? total}
        />
        <NxSummaryCard
          tone="teal"
          icon={<Users size={18} />}
          label="Employees"
          value={summary.employees ?? "—"}
        />
        <NxSummaryCard
          tone="cyan"
          icon={<CalendarDays size={18} />}
          label="Working hours"
          value={`${num(summary.total_working_hours).toFixed(2)} h`}
        />
        <NxSummaryCard
          tone="green"
          icon={<Banknote size={18} />}
          label="Total saved wages"
          value={moneyText(summary.total_wage)}
        />
      </div>
      {report?.filters ? (
        <p className="nx-muted">
          Report period:{" "}
          {formatWindow(report.filters.date_from, report.filters.date_to)}
        </p>
      ) : (
        !validationMessage && <p className="nx-muted">Report period: {periodLabel}</p>
      )}

      <div className="nx-panel">
        {nav.view !== "employees" && nav.employee ? (
          <div className="nx-salary-detail">
            <div className="nx-salary-detail-head">
              <nav className="nx-salary-crumbs" aria-label="Report location">
                <button type="button" className="nx-link-btn" onClick={backToEmployees}>
                  Employees
                </button>
                <span aria-hidden="true">›</span>
                {nav.month ? (
                  <>
                    {hasMonthStep ? (
                      <button type="button" className="nx-link-btn" onClick={backToMonths}>
                        {crumb}
                      </button>
                    ) : (
                      <span>{crumb}</span>
                    )}
                    <span aria-hidden="true">›</span>
                    <strong>{monthLabel(nav.month)}</strong>
                  </>
                ) : (
                  <strong>{crumb}</strong>
                )}
              </nav>
              <div className="nx-pane-actions">
                {nav.view === "days" && nav.month && hasMonthStep && (
                  <button type="button" className="nx-btn nx-btn--outline" onClick={backToMonths}>
                    <ChevronLeft size={15} /> Back to Months
                  </button>
                )}
                <button type="button" className="nx-btn nx-btn--outline" onClick={backToEmployees}>
                  <ChevronLeft size={15} /> Back to Employees
                </button>
              </div>
            </div>
            <h3 className="nx-salary-detail-title">
              {nav.view === "months"
                ? `Month-wise salary — ${periodLabel}`
                : `${nav.month ? monthLabel(nav.month) : periodLabel} — Day-wise records`}
            </h3>
            {!detailLoading && !detailError && (
              <div className="nx-salary-chips">
                <span>
                  {nav.view === "months" ? "Worked days" : "Records"}
                  <b>{detailTotals.days}</b>
                </span>
                <span>
                  Hours<b>{num(detailTotals.hours).toFixed(2)} h</b>
                </span>
                <span>
                  Total wages<b>{moneyText(detailTotals.wage)}</b>
                </span>
              </div>
            )}
            {detailError && (
              <div className="nx-state nx-state--error" role="alert">
                <p>{detailError}</p>
                <button type="button" className="nx-btn nx-btn--outline" onClick={reload}>
                  <RefreshCw size={15} /> Retry
                </button>
              </div>
            )}
            {detailLoading ? (
              <div className="nx-state">
                <span className="nx-spinner" /> Loading employee history…
              </div>
            ) : detailError ? null : nav.view === "months" ? (
              <div className="nx-table-scroll">
                <table className="nx-table nx-table--months">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="nx-right">Worked days</th>
                      <th className="nx-right">Hours</th>
                      <th className="nx-right">Monthly salary</th>
                      <th>Day-wise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map((r) => (
                      <tr key={r.month}>
                        <td>{monthLabel(r.month)}</td>
                        <td className="nx-right">{r.days ?? "—"}</td>
                        <td className="nx-right">{formatHours(r.hours)}</td>
                        <td className="nx-right">{moneyText(r.total_wage)}</td>
                        <td>
                          <button
                            type="button"
                            className="nx-icon-btn"
                            title={`View ${monthLabel(r.month)} day-wise attendance`}
                            aria-label={`View ${monthLabel(r.month)} day-wise attendance`}
                            onClick={() => openMonth(r.month)}
                          >
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!monthRows.length && (
                      <tr>
                        <td colSpan={5} className="nx-empty">
                          No monthly records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <SalaryDayTable rows={dayRows} showEmployee />
                {Number(detailData?.count || 0) > SALARY_DETAIL_PAGE_SIZE && (
                  <div className="nx-pager">
                    <span>
                      Page {detailPage} of{" "}
                      {Math.ceil(Number(detailData.count) / SALARY_DETAIL_PAGE_SIZE)}
                    </span>
                    <div>
                      <button
                        type="button"
                        className="nx-icon-btn"
                        aria-label="Previous page"
                        disabled={detailPage <= 1}
                        onClick={() => setDetailPage((v) => Math.max(1, v - 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="nx-icon-btn"
                        aria-label="Next page"
                        disabled={
                          detailPage >=
                          Math.ceil(Number(detailData.count) / SALARY_DETAIL_PAGE_SIZE)
                        }
                        onClick={() => setDetailPage((v) => v + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : loading ? (
          <div className="nx-state">
            <span className="nx-spinner" /> Loading report…
          </div>
        ) : isDay ? (
          <SalaryDayTable rows={records} showEmployee />
        ) : (
          <div className="nx-table-scroll">
            <table className="nx-table nx-salary-employee-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th className="nx-right">Worked days</th>
                  <th className="nx-right">Hours</th>
                  <th className="nx-right">Total salary</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.employee_pk ?? `${r.employee_code ?? "emp"}-${i}`}>
                    <td className="nx-mono">{r.employee_code || "—"}</td>
                    <td>
                      <strong>{r.employee_name || "—"}</strong>
                    </td>
                    <td>{r.department || "—"}</td>
                    <td className="nx-right">{r.days ?? "—"}</td>
                    <td className="nx-right">{formatHours(r.hours)}</td>
                    <td className="nx-right">{moneyText(r.total_wage)}</td>
                    <td>
                      <button
                        type="button"
                        className="nx-icon-btn"
                        disabled={r.employee_pk == null}
                        title={`View ${r.employee_name || "employee"} salary details`}
                        aria-label={`View ${r.employee_name || "employee"} salary details`}
                        onClick={() => openEmployee(r)}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!records.length && (
                  <tr>
                    <td colSpan={7} className="nx-empty">
                      {error || validationMessage
                        ? "Fix the issue above to see the report."
                        : "No employee wages match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {nav.view === "employees" && !loading && totalPages > 1 && (
          <div className="nx-pager">
            <span>
              {total} matching {isDay ? "records" : "employees"}
            </span>
            <div>
              <button
                type="button"
                className="nx-icon-btn"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <strong>
                {page} / {totalPages}
              </strong>
              <button
                type="button"
                className="nx-icon-btn"
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminSalaryManagement({
  accessToken,
  initialMonth,
  onAdvancesChanged,
}) {
  const [salarySubTab, setSalarySubTab] = useState("existing");
  const [month, setMonth] = useState(initialMonth);
  const [people, setPeople] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rateTarget, setRateTarget] = useState(null);
  const [salaryTarget, setSalaryTarget] = useState(null);
  const seq = useRef(0);

  const auth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );

  const load = useCallback(async () => {
    if (!accessToken || !month) return;
    const id = ++seq.current;
    setLoading(true);
    setLoadError("");
    try {
      const [roster, wageConfigs, salaryPayments] = await Promise.all([
        getAllPages(SALARY_API.employees, auth),
        getAllPages(SALARY_API.configs, auth),
        getAllPages(SALARY_API.payments, auth, { month }),
      ]);
      if (id !== seq.current) return;
      setPeople(roster.filter((p) => p.is_active !== false));
      setConfigs(wageConfigs);
      setPayments(
        salaryPayments.filter(
          (p) => String(p.salary_month || "").slice(0, 7) === month,
        ),
      );
    } catch (err) {
      if (id === seq.current) setLoadError(salaryError(err));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [accessToken, auth, month]);

  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const rows = useMemo(() => {
    const configBy = new Map(configs.map((c) => [idOf(c.employee), c]));
    const paymentBy = new Map(payments.map((p) => [idOf(p.employee), p]));
    return people.map((person) => {
      const key = String(person.id);
      const config = configBy.get(key) || null;
      const payment = paymentBy.get(key) || null;
      return { key, person, config, payment, workflow: workflowOf(payment) };
    });
  }, [people, configs, payments]);
  const rowFor = useCallback(
    (key) =>
      rows.find((r) => r.key === key) || {
        person: { id: key },
        config: null,
        payment: null,
      },
    [rows],
  );

  const departments = useMemo(
    () => [...new Set(people.map((p) => p.department).filter(Boolean))].sort(),
    [people],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesQuery(
            search,
            employeeLabel(r.person),
            employeeCode(r.person),
            r.person.department,
          ) &&
          (department === "all" || r.person.department === department) &&
          (statusFilter === "all" || r.workflow === statusFilter),
      ),
    [rows, search, department, statusFilter],
  );
  const paging = usePaging(filtered);
  useEffect(() => paging.setPage(1), [search, department, statusFilter, month]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Summaries come from the complete datasets, not the visible page. */
  const summary = useMemo(
    () => ({
      employees: rows.length,
      rates: rows.filter(
        (r) =>
          r.config?.salary_type === "DAILY" && num(r.config?.daily_rate) > 0,
      ).length,
      drafts: rows.filter((r) => r.workflow === "DRAFT").length,
      confirmed: rows.filter(
        (r) => r.workflow === "CONFIRMED" || r.workflow === "PAID",
      ).length,
      net: rows.reduce((s, r) => s + num(r.payment?.net_salary), 0),
    }),
    [rows],
  );

  const afterChange = useCallback(
    async (opts = {}) => {
      await load();
      if (opts.advances) onAdvancesChanged?.();
    },
    [load, onAdvancesChanged],
  );

  const downloadReport = async () => {
    if (exporting || !month) return;
    setExporting(true);
    setExportError("");
    setNotice("");
    try {
      const [year, mm] = month.split("-");
      const attendanceResponse = await api.get(ATTENDANCE_ENDPOINT, {
        ...auth,
        params: {
          period: "month",
          date: `${month}-01`,
          month: Number(mm),
          year: Number(year),
        },
      });
      if (
        !attendanceResponse.data?.success ||
        !Array.isArray(attendanceResponse.data?.employees)
      ) {
        throw new Error(
          "Monthly attendance could not be loaded, so the export was cancelled to avoid an incomplete report.",
        );
      }
      const attendanceBy = new Map(
        attendanceResponse.data.employees.map((item) => [
          String(item.id ?? item.employee?.id ?? item.employee),
          item,
        ]),
      );
      const headings = [
        "Employee ID",
        "Employee Name",
        "Department",
        "Daily Rate (INR)",
        "Weekday Hourly Rate (INR)",
        "Sunday Hourly Rate (INR)",
        "Days Worked",
        "Normal Hours",
        "Approved OT Hours",
        "Total Working Hours",
        "Attendance Wage (INR)",
        "Overtime Pay (INR)",
        "Allowances (INR)",
        "Gross Salary (INR)",
        "PF (INR)",
        "ESI (INR)",
        "Tax (INR)",
        "Other Deductions (INR)",
        "Advance Deduction (INR)",
        "Total Deductions (INR)",
        "Net Salary (INR)",
        "Payroll Status",
        "Payment Status",
        "Paid Date",
      ];
      const data = rows.map(({ key, person, config, payment }) => {
        const att = attendanceBy.get(key);
        const stats = snapshotStats(payment);
        const rate =
          config?.salary_type === "DAILY" ? Number(config.daily_rate) : NaN;
        const money = (field) => payment?.[field] ?? "";
        return [
          employeeCode(person),
          employeeLabel(person),
          person.department ?? "",
          Number.isFinite(rate) ? config.daily_rate : "",
          Number.isFinite(rate) ? (rate / 8).toFixed(4) : "",
          Number.isFinite(rate) ? (rate / 6).toFixed(4) : "",
          stats ? stats.daysWorked : (att?.days_worked ?? ""),
          stats ? stats.normalHours.toFixed(2) : (att?.normal_hours ?? ""),
          stats ? stats.otHours.toFixed(2) : (att?.approved_ot_hours ?? ""),
          att?.working_hours ??
            att?.total_hours ??
            (stats ? (stats.normalHours + stats.otHours).toFixed(2) : ""),
          money("attendance_wage"),
          money("overtime"),
          money("allowances"),
          money("gross_earnings"),
          money("pf"),
          money("esi"),
          money("tax"),
          money("other_deductions"),
          money("advance_deduction"),
          money("total_deductions"),
          money("net_salary"),
          payment?.payroll_status ?? "NOT GENERATED",
          payment?.payment_status ?? "",
          payment?.paid_date ?? "",
        ];
      });
      csvDownload(`NXT_GENZ_Employee_Salary_${month}.csv`, [headings, ...data]);
      setNotice(
        `Downloaded ${data.length} employees for ${month}. Blank cells mean the server has no value for that employee.`,
      );
    } catch (err) {
      setExportError(salaryError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="nx-pane">
      <div
        className="nx-actions"
        style={{ marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap" }}
        role="tablist"
        aria-label="Salary subsections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={salarySubTab === "existing"}
          className={`nx-btn ${salarySubTab === "existing" ? "nx-btn--primary" : "nx-btn--outline"}`}
          onClick={() => setSalarySubTab("existing")}
        >
          Existing Salary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={salarySubTab === "report"}
          className={`nx-btn ${salarySubTab === "report" ? "nx-btn--primary" : "nx-btn--outline"}`}
          onClick={() => setSalarySubTab("report")}
        >
          Custom Salary Report
        </button>
      </div>
      {salarySubTab === "report" ? (
        <SalaryReportBoundary>
          <AdminCustomSalaryReport accessToken={accessToken} />
        </SalaryReportBoundary>
      ) : (
        <>
          <div className="nx-pane-head">
            <div>
              <h2>
                <Wallet size={21} /> Salary Management
              </h2>
              <p>
                All active employees · Mon–Sat 8 h/day · Sunday 6 h/day ·
                figures calculated by the server
              </p>
            </div>
            <div className="nx-pane-actions">
              <button
                type="button"
                className="nx-btn nx-btn--primary"
                onClick={downloadReport}
                disabled={loading || exporting || !rows.length}
              >
                <Download size={15} />{" "}
                {exporting ? "Preparing CSV…" : "Download Salary Report"}
              </button>
              <button
                type="button"
                className="nx-btn nx-btn--outline"
                onClick={() => load()}
                disabled={loading}
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          </div>

          <div className="nx-cards">
            <NxSummaryCard
              tone="navy"
              icon={<Users size={18} />}
              label="Total employees"
              value={summary.employees}
            />
            <NxSummaryCard
              tone="teal"
              icon={<Settings2 size={18} />}
              label="Daily rates configured"
              value={`${summary.rates} / ${summary.employees}`}
            />
            <NxSummaryCard
              tone="amber"
              icon={<CalendarDays size={18} />}
              label="Salary drafts"
              value={summary.drafts}
            />
            <NxSummaryCard
              tone="cyan"
              icon={<CheckCircle2 size={18} />}
              label="Confirmed salaries"
              value={summary.confirmed}
            />
            <NxSummaryCard
              tone="green"
              icon={<Banknote size={18} />}
              label="Total net payroll"
              value={moneyText(summary.net)}
            />
          </div>

          <div className="nx-toolbar">
            <label className="nx-field">
              Salary month
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </label>
            <label className="nx-field nx-field--grow">
              Search employee
              <span className="nx-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, employee ID or department"
                />
              </span>
            </label>
            <label className="nx-field">
              Department
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="nx-field">
              Salary status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {SALARY_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {notice && (
            <div className="nx-alert nx-alert--success" role="status">
              {notice}
            </div>
          )}
          {exportError && (
            <div className="nx-alert nx-alert--error" role="alert">
              {exportError}
            </div>
          )}

          <div className="nx-panel">
            {loadError ? (
              <div className="nx-state nx-state--error">
                <p>{loadError}</p>
                <button
                  type="button"
                  className="nx-btn nx-btn--outline"
                  onClick={() => load()}
                >
                  Retry
                </button>
              </div>
            ) : loading && !rows.length ? (
              <div className="nx-state">
                <span className="nx-spinner" /> Loading employees…
              </div>
            ) : !rows.length ? (
              <div className="nx-state">
                No active employees were returned by the server.
              </div>
            ) : (
              <>
                <div className="nx-table-scroll">
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>Employee ID</th>
                        <th>Employee name</th>
                        <th>Department</th>
                        <th className="nx-right">Daily rate</th>
                        <th>Salary status</th>
                        <th className="nx-right">Net salary</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paging.slice.map((r) => {
                        const hasRate =
                          r.config?.salary_type === "DAILY" &&
                          num(r.config?.daily_rate) > 0;
                        return (
                          <tr key={r.key}>
                            <td className="nx-mono">
                              {employeeCode(r.person) || "—"}
                            </td>
                            <td>
                              <strong>{employeeLabel(r.person)}</strong>
                              {r.person.designation && (
                                <small className="nx-sub">
                                  {r.person.designation}
                                </small>
                              )}
                            </td>
                            <td>{r.person.department || "—"}</td>
                            <td className="nx-right">
                              {hasRate ? (
                                moneyText(r.config.daily_rate)
                              ) : (
                                <span className="nx-muted">Not set</span>
                              )}
                            </td>
                            <td>
                              <NxStatus tone={WORKFLOW_TONE[r.workflow]}>
                                {WORKFLOW_LABEL[r.workflow]}
                              </NxStatus>
                            </td>
                            <td className="nx-right">
                              {r.payment?.net_salary != null
                                ? moneyText(r.payment.net_salary)
                                : "—"}
                            </td>
                            <td>
                              <div className="nx-actions">
                                <button
                                  type="button"
                                  className="nx-btn nx-btn--sm nx-btn--outline"
                                  onClick={() => setRateTarget(r.key)}
                                >
                                  {hasRate ? "Edit Rate" : "Set Rate"}
                                </button>
                                <button
                                  type="button"
                                  className="nx-btn nx-btn--sm nx-btn--primary"
                                  onClick={() => setSalaryTarget(r.key)}
                                >
                                  {r.workflow === "NOT_GENERATED"
                                    ? "Add Salary"
                                    : r.workflow === "DRAFT"
                                      ? "Manage Salary"
                                      : "View Salary"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!filtered.length && (
                        <tr>
                          <td colSpan={7} className="nx-empty">
                            No employees match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <NxPager
                  page={paging.page}
                  pageCount={paging.pageCount}
                  total={filtered.length}
                  onPage={paging.setPage}
                />
              </>
            )}
          </div>

          {rateTarget && (
            <RateModal
              row={rowFor(rateTarget)}
              auth={auth}
              onClose={() => setRateTarget(null)}
              onSaved={async (message) => {
                setRateTarget(null);
                setNotice(message);
                await load();
              }}
            />
          )}
          {salaryTarget && (
            <SalaryDrawer
              rowFor={rowFor}
              employeeKey={salaryTarget}
              month={month}
              auth={auth}
              onClose={() => setSalaryTarget(null)}
              onChanged={afterChange}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   ADVANCE MANAGEMENT TAB
   ============================================================ */

const ADV_STATUS_TONE = {
  OUTSTANDING: "warning",
  PARTIAL: "info",
  REPAID: "success",
};
const ADV_FILTER_OPTIONS = [
  { value: "all", label: "All status" },
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "PARTIAL", label: "Partially Repaid" },
  { value: "REPAID", label: "Fully Repaid" },
];

function AdvanceFormModal({ people, advance, auth, onClose, onSaved }) {
  const editing = Boolean(advance);
  const [employeeId, setEmployeeId] = useState(
    editing ? idOf(advance.employee) : "",
  );
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(
    editing ? advance.advance_date || todayISO() : todayISO(),
  );
  const [amount, setAmount] = useState(
    editing ? String(advAmount(advance)) : "",
  );
  const [reason, setReason] = useState(editing ? advance.reason || "" : "");
  const [instCount, setInstCount] = useState(
    editing && advance.installment_count
      ? String(advance.installment_count)
      : "",
  );
  const [instAmount, setInstAmount] = useState(
    editing && advance.installment_amount
      ? String(advance.installment_amount)
      : "",
  );
  const [instTouched, setInstTouched] = useState(
    editing && Boolean(advance.installment_amount),
  );
  const [remarks, setRemarks] = useState(editing ? advance.remarks || "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const selected = people.find((p) => String(p.id) === String(employeeId));
  const matches = useMemo(
    () =>
      people
        .filter((p) =>
          matchesQuery(query, employeeLabel(p), employeeCode(p), p.department),
        )
        .slice(0, 8),
    [people, query],
  );

  const save = async () => {
    if (lock.current) return;
    if (!employeeId) return setError("Select an employee.");
    if (!date) return setError("Select the advance date.");
    if (!isPositiveMoney(amount))
      return setError("Enter a positive amount (up to 2 decimals).");
    if (!reason.trim()) return setError("Enter the reason for this advance.");
    if (instCount !== "" || instAmount !== "") {
      if (
        !/^\d+$/.test(instCount) ||
        Number(instCount) < 1 ||
        Number(instCount) > 120
      )
        return setError(
          "Number of installments must be a whole number from 1 to 120.",
        );
      if (!isPositiveMoney(instAmount))
        return setError("Enter a positive monthly installment amount.");
      if (Number(instAmount) > Number(amount) + 0.0001)
        return setError(
          "Monthly installment cannot exceed the advance amount.",
        );
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const body = {
        advance_date: date,
        amount: String(amount),
        reason: reason.trim(),
        remarks: remarks.trim(),
      };
      if (instCount !== "") {
        body.installment_count = Number(instCount);
        body.installment_amount = String(instAmount);
      }
      if (editing) await api.patch(SALARY_API.advance(advance.id), body, auth);
      else
        await api.post(
          SALARY_API.advances,
          { employee: Number(employeeId), ...body },
          auth,
        );
      await onSaved(editing ? "Advance updated." : "Advance saved.");
    } catch (err) {
      setError(salaryError(err));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <NxModal
      title={editing ? "Edit Advance" : "Add Advance"}
      subtitle={editing ? advRef(advance) : "Issue an advance to an employee"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            className="nx-btn nx-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--primary"
            onClick={save}
            disabled={busy}
          >
            {busy ? "Saving…" : editing ? "Update Advance" : "Save Advance"}
          </button>
        </>
      }
    >
      {error && (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      )}
      <div className="nx-field">
        Employee
        {editing ? (
          <input
            value={
              selected
                ? employeeLabel(selected)
                : advEmployeeName(advance, new Map())
            }
            readOnly
          />
        ) : selected ? (
          <div className="nx-picked">
            <span>
              <strong>{employeeLabel(selected)}</strong>{" "}
              <small>
                {employeeCode(selected)}
                {selected.department ? ` · ${selected.department}` : ""}
              </small>
            </span>
            <button
              type="button"
              className="nx-link"
              onClick={() => setEmployeeId("")}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <span className="nx-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee by name or ID"
                autoFocus
              />
            </span>
            <ul className="nx-picklist" role="listbox" aria-label="Employees">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => setEmployeeId(String(p.id))}
                  >
                    <strong>{employeeLabel(p)}</strong>
                    <small>
                      {employeeCode(p)}
                      {p.department ? ` · ${p.department}` : ""}
                    </small>
                  </button>
                </li>
              ))}
              {!matches.length && (
                <li className="nx-muted nx-picklist-empty">
                  No employees match.
                </li>
              )}
            </ul>
          </>
        )}
      </div>
      <div className="nx-grid nx-grid--2">
        <label className="nx-field">
          Advance date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="nx-field">
          Advance amount (₹)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000.00"
          />
        </label>
        <label className="nx-field">
          Number of installments
          <input
            type="number"
            min="1"
            max="120"
            step="1"
            value={instCount}
            placeholder="e.g. 5"
            onChange={(e) => {
              const v = e.target.value;
              setInstCount(v);
              if (
                !instTouched &&
                /^\d+$/.test(v) &&
                Number(v) > 0 &&
                Number(amount) > 0
              )
                setInstAmount(
                  (Math.ceil((Number(amount) / Number(v)) * 100) / 100).toFixed(
                    2,
                  ),
                );
            }}
          />
        </label>
        <label className="nx-field">
          Monthly installment (₹)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={instAmount}
            placeholder="auto"
            onChange={(e) => {
              setInstTouched(true);
              setInstAmount(e.target.value);
            }}
          />
        </label>
        <label className="nx-field nx-field--full">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Personal advance"
          />
        </label>
        <label className="nx-field nx-field--full">
          Remarks
          <textarea
            rows="2"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
      {!editing && (
        <p className="nx-muted">
          Issuing an advance does not create a repayment. Repayments come from
          confirmed salary or the manual repayment form.
        </p>
      )}
    </NxModal>
  );
}

function RepaymentModal({ advance, auth, onClose, onSaved }) {
  const [debtors, setDebtors] = useState([]); // /erp/advances/outstanding/ → one row per employee
  const [debtorsLoading, setDebtorsLoading] = useState(!advance);
  const [empId, setEmpId] = useState("");
  const [options, setOptions] = useState([]); // that employee's advances with a balance
  const [optLoading, setOptLoading] = useState(false);
  const [pickedId, setPickedId] = useState(advance ? String(advance.id) : "");
  const [fresh, setFresh] = useState(advance || null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  /* No advance preselected → employees who still owe money (aggregate endpoint). */
  useEffect(() => {
    if (advance) return undefined;
    let alive = true;
    getAllPages(SALARY_API.advancesOutstanding, auth)
      .then(
        (items) =>
          alive &&
          setDebtors(items.filter((r) => num(r.outstanding_amount) > 0.0001)),
      )
      .catch((err) => alive && setError(salaryError(err)))
      .finally(() => alive && setDebtorsLoading(false));
    return () => {
      alive = false;
    };
  }, [advance, auth]);

  /* Then that employee's individual advances (the "advance reference"). */
  useEffect(() => {
    if (advance) return undefined;
    setOptions([]);
    setPickedId("");
    if (!empId) return undefined;
    let alive = true;
    setOptLoading(true);
    getAllPages(SALARY_API.advances, auth, { employee: empId })
      .then(
        (items) =>
          alive &&
          setOptions(
            items.filter(
              (a) =>
                idOf(a.employee) === String(empId) &&
                advOutstanding(a) > 0.0001,
            ),
          ),
      )
      .catch((err) => alive && setError(salaryError(err)))
      .finally(() => alive && setOptLoading(false));
    return () => {
      alive = false;
    };
  }, [advance, empId, auth]);

  /* Always re-read the chosen advance so the outstanding balance is current. */
  useEffect(() => {
    if (!pickedId) {
      setFresh(null);
      return undefined;
    }
    let alive = true;
    api
      .get(SALARY_API.advance(pickedId), auth)
      .then((res) => alive && setFresh(res.data))
      .catch((err) => alive && setError(salaryError(err)));
    return () => {
      alive = false;
    };
  }, [pickedId, auth]);

  const outstanding = fresh ? advOutstanding(fresh) : 0;
  const nameOf = (a) =>
    a?.employee_name ||
    (a?.employee && typeof a.employee === "object"
      ? employeeLabel(a.employee)
      : `Employee #${idOf(a?.employee)}`);

  const save = async () => {
    if (lock.current) return;
    if (!fresh) return setError("Select an advance.");
    if (!isPositiveMoney(amount))
      return setError("Enter a positive repayment amount (up to 2 decimals).");
    if (Number(amount) > outstanding + 0.0001)
      return setError(
        `Repayment cannot exceed the outstanding ${moneyText(outstanding)}.`,
      );
    if (!date) return setError("Select the repayment date.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post(
        SALARY_API.repayments,
        { advance: fresh.id, amount: String(amount), date },
        auth,
      );
      await onSaved("Repayment recorded.");
    } catch (err) {
      setError(salaryError(err));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <NxModal
      title="Record Repayment"
      subtitle="Manual repayment outside payroll"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            className="nx-btn nx-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--primary"
            onClick={save}
            disabled={busy || !fresh || outstanding <= 0}
          >
            {busy ? "Saving…" : "Record Repayment"}
          </button>
        </>
      }
    >
      {error && (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      )}
      {!advance && (
        <div className="nx-grid nx-grid--2">
          <label className="nx-field">
            Employee
            <select
              value={empId}
              onChange={(e) => {
                setError("");
                setEmpId(e.target.value);
              }}
              disabled={debtorsLoading}
            >
              <option value="">
                {debtorsLoading
                  ? "Loading…"
                  : debtors.length
                    ? "Select employee"
                    : "No outstanding advances"}
              </option>
              {debtors.map((r) => (
                <option key={r.employee} value={r.employee}>
                  {r.employee_name} ({r.employee_code}) ·{" "}
                  {moneyText(r.outstanding_amount)} owed
                </option>
              ))}
            </select>
          </label>
          <label className="nx-field">
            Advance reference
            <select
              value={pickedId}
              onChange={(e) => {
                setError("");
                setPickedId(e.target.value);
              }}
              disabled={!empId || optLoading}
            >
              <option value="">
                {optLoading ? "Loading…" : "Select advance"}
              </option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {advRef(a)} · {formatISODate(a.advance_date)} ·{" "}
                  {moneyText(advOutstanding(a))} outstanding
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {fresh && (
        <div className="nx-facts nx-facts--spaced">
          <div>
            <span>Employee</span>
            <strong>{nameOf(fresh)}</strong>
          </div>
          <div>
            <span>Advance reference</span>
            <strong>{advRef(fresh)}</strong>
          </div>
          <div>
            <span>Original advance</span>
            <strong>{moneyText(advAmount(fresh))}</strong>
          </div>
          <div>
            <span>Outstanding</span>
            <strong>{moneyText(outstanding)}</strong>
          </div>
        </div>
      )}
      <div className="nx-grid nx-grid--2">
        <label className="nx-field">
          Repayment amount (₹)
          <input
            type="number"
            min="0.01"
            max={outstanding || undefined}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!fresh}
            placeholder="0.00"
          />
        </label>
        <label className="nx-field">
          Repayment date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <p className="nx-muted">
        This is separate from salary deduction. Confirming a salary never
        creates a manual repayment.
      </p>
    </NxModal>
  );
}

function AdvanceDetailModal({
  advanceId,
  peopleById,
  auth,
  onClose,
  onEdit,
  onRepay,
  onDelete,
}) {
  const [advance, setAdvance] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get(SALARY_API.advance(advanceId), auth),
      getAllPages(SALARY_API.repayments, auth, { advance: advanceId }),
    ])
      .then(([detail, history]) => {
        if (!alive) return;
        setAdvance(detail.data);
        setRepayments(
          history.filter((r) => idOf(r.advance) === String(advanceId)),
        );
      })
      .catch((err) => alive && setError(salaryError(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [advanceId, auth]);

  const canEdit = advance ? advance.can_edit !== false : false;
  const canDelete = advance ? advance.can_delete !== false : false;
  const outstanding = advance ? advOutstanding(advance) : 0;

  return (
    <NxModal
      wide
      title={advance ? `Advance ${advRef(advance)}` : "Advance details"}
      subtitle={advance ? advEmployeeName(advance, peopleById) : undefined}
      onClose={onClose}
      busy={busy}
      footer={
        advance && (
          <>
            <button
              type="button"
              className="nx-btn nx-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Close
            </button>
            <button
              type="button"
              className="nx-btn nx-btn--danger"
              disabled={busy || !canDelete}
              title={
                canDelete
                  ? undefined
                  : "The server does not allow deleting this advance."
              }
              onClick={async () => {
                setBusy(true);
                await onDelete(advance);
                setBusy(false);
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              type="button"
              className="nx-btn nx-btn--outline"
              disabled={busy || !canEdit}
              title={
                canEdit
                  ? undefined
                  : "The server does not allow editing this advance."
              }
              onClick={() => onEdit(advance)}
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              type="button"
              className="nx-btn nx-btn--primary"
              disabled={busy || outstanding <= 0}
              onClick={() => onRepay(advance)}
            >
              Record Repayment
            </button>
          </>
        )
      }
    >
      {loading ? (
        <div className="nx-state">
          <span className="nx-spinner" /> Loading…
        </div>
      ) : error ? (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      ) : (
        <>
          <div className="nx-facts nx-facts--spaced">
            <div>
              <span>Advance date</span>
              <strong>{formatISODate(advance.advance_date)}</strong>
            </div>
            <div>
              <span>Advance amount</span>
              <strong>{moneyText(advAmount(advance))}</strong>
            </div>
            <div>
              <span>Repaid</span>
              <strong>{moneyText(advRepaid(advance))}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>{moneyText(outstanding)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{ADV_STATUS_LABEL[advStatusKey(advance)]}</strong>
            </div>
            <div>
              <span>Reason</span>
              <strong>{advance.reason || "—"}</strong>
            </div>
            <div>
              <span>Installment plan</span>
              <strong>
                {advPlan(advance)
                  ? `${planText(advance)} · ${advPlan(advance).paid} of ${advPlan(advance).count} paid`
                  : "Not set"}
              </strong>
            </div>
          </div>
          {advance.remarks && (
            <p className="nx-muted">Remarks: {advance.remarks}</p>
          )}
          {(!canEdit || !canDelete) && (
            <p className="nx-muted">
              The server has restricted editing or deleting this advance (it
              likely has linked repayments).
            </p>
          )}
          <h3 className="nx-subhead">Repayment history</h3>
          <div className="nx-table-scroll">
            <table className="nx-table nx-table--compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="nx-right">Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {repayments.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {formatISODate(
                        r.repayment_date ||
                          r.date ||
                          r.created_at?.slice(0, 10),
                      )}
                    </td>
                    <td className="nx-right">{moneyText(r.amount)}</td>
                    <td>
                      {r.source ||
                        r.repayment_type ||
                        (r.salary_payment || r.salary
                          ? "Salary deduction"
                          : "Manual")}
                    </td>
                  </tr>
                ))}
                {!repayments.length && (
                  <tr>
                    <td colSpan={3} className="nx-empty">
                      No repayments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </NxModal>
  );
}

function AdminAdvanceManagement({ accessToken, version, onAdvancesChanged }) {
  const [people, setPeople] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null); // {type, advance?}
  const seq = useRef(0);

  const auth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );
  const peopleById = useMemo(
    () => new Map(people.map((p) => [String(p.id), p])),
    [people],
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    const id = ++seq.current;
    setLoading(true);
    setLoadError("");
    try {
      const [roster, list, moves] = await Promise.all([
        getAllPages(SALARY_API.employees, auth),
        getAllPages(SALARY_API.advances, auth),
        getAllPages(SALARY_API.repayments, auth),
      ]);
      if (id !== seq.current) return;
      setPeople(roster.filter((p) => p.is_active !== false));
      setAdvances(list);
      setRepayments(
        [...moves].sort(
          (a, b) =>
            String(b.date || "").localeCompare(String(a.date || "")) ||
            num(b.id) - num(a.id),
        ),
      );
    } catch (err) {
      if (id === seq.current) setLoadError(salaryError(err));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [accessToken, auth]);

  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load, version]);

  const summary = useMemo(
    () => ({
      issued: advances.reduce((s, a) => s + advAmount(a), 0),
      repaid: advances.reduce((s, a) => s + advRepaid(a), 0),
      outstanding: advances.reduce((s, a) => s + advOutstanding(a), 0),
    }),
    [advances],
  );

  const filtered = useMemo(
    () =>
      advances.filter(
        (a) =>
          matchesQuery(
            search,
            advEmployeeName(a, peopleById),
            a.employee_code,
            a.reason,
            advRef(a),
          ) &&
          (statusFilter === "all" || advStatusKey(a) === statusFilter),
      ),
    [advances, search, statusFilter, peopleById],
  );
  const paging = usePaging(filtered);
  useEffect(() => paging.setPage(1), [search, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const movePaging = usePaging(repayments);
  const advanceById = useMemo(
    () => new Map(advances.map((a) => [String(a.id), a])),
    [advances],
  );

  /* After any change: reload the list and tell the parent so Salary Management refreshes. */
  const saved = async (message) => {
    setModal(null);
    setNotice(message);
    setActionError("");
    await load();
    onAdvancesChanged?.();
  };

  const remove = async (advance) => {
    if (advance.can_delete === false) return;
    if (
      !window.confirm(
        `Delete advance ${advRef(advance)} for ${advEmployeeName(advance, peopleById)}?`,
      )
    )
      return;
    try {
      await api.delete(SALARY_API.advance(advance.id), auth);
      await saved("Advance deleted.");
    } catch (err) {
      setModal(null);
      setActionError(salaryError(err));
    }
  };

  return (
    <div className="nx-pane">
      <div className="nx-pane-head">
        <div>
          <h2>
            <CreditCard size={21} /> Advance Management
          </h2>
          <p>
            Issue advances, track outstanding balances and record manual
            repayments
          </p>
        </div>
        <div className="nx-pane-actions">
          <button
            type="button"
            className="nx-btn nx-btn--primary"
            onClick={() => setModal({ type: "add" })}
            disabled={loading && !people.length}
          >
            <Plus size={15} /> Add Advance
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--outline"
            onClick={() => setModal({ type: "repay" })}
          >
            Record Repayment
          </button>
          <button
            type="button"
            className="nx-btn nx-btn--outline"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      <div className="nx-cards nx-cards--3">
        <NxSummaryCard
          tone="navy"
          icon={<Banknote size={18} />}
          label="Total advances issued"
          value={moneyText(summary.issued)}
        />
        <NxSummaryCard
          tone="green"
          icon={<CheckCircle2 size={18} />}
          label="Total repaid"
          value={moneyText(summary.repaid)}
        />
        <NxSummaryCard
          tone="amber"
          icon={<Wallet size={18} />}
          label="Total outstanding"
          value={moneyText(summary.outstanding)}
        />
      </div>

      <div className="nx-toolbar">
        <label className="nx-field nx-field--grow">
          Search advances
          <span className="nx-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee, ID, reason or reference"
            />
          </span>
        </label>
        <label className="nx-field">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {ADV_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <div className="nx-alert nx-alert--success" role="status">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="nx-alert nx-alert--error" role="alert">
          {actionError}
        </div>
      )}

      <div className="nx-panel">
        {loadError ? (
          <div className="nx-state nx-state--error">
            <p>{loadError}</p>
            <button
              type="button"
              className="nx-btn nx-btn--outline"
              onClick={() => load()}
            >
              Retry
            </button>
          </div>
        ) : loading && !advances.length ? (
          <div className="nx-state">
            <span className="nx-spinner" /> Loading advances…
          </div>
        ) : (
          <>
            <div className="nx-table-scroll">
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Advance date</th>
                    <th className="nx-right">Advance amount</th>
                    <th className="nx-right">Repaid</th>
                    <th className="nx-right">Outstanding</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.slice.map((a) => {
                    const status = advStatusKey(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{advEmployeeName(a, peopleById)}</strong>
                          <small className="nx-sub">
                            {advRef(a)}
                            {a.reason ? ` · ${a.reason}` : ""}
                            {advPlan(a)
                              ? ` · Plan ${planText(a)} (${advPlan(a).paid} paid)`
                              : ""}
                          </small>
                        </td>
                        <td>{formatISODate(a.advance_date)}</td>
                        <td className="nx-right">{moneyText(advAmount(a))}</td>
                        <td className="nx-right">{moneyText(advRepaid(a))}</td>
                        <td className="nx-right">
                          <strong>{moneyText(advOutstanding(a))}</strong>
                        </td>
                        <td>
                          <NxStatus tone={ADV_STATUS_TONE[status]}>
                            {ADV_STATUS_LABEL[status]}
                          </NxStatus>
                        </td>
                        <td>
                          <div className="nx-actions">
                            <button
                              type="button"
                              className="nx-btn nx-btn--sm nx-btn--outline"
                              onClick={() =>
                                setModal({ type: "view", id: a.id })
                              }
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              type="button"
                              className="nx-btn nx-btn--sm nx-btn--outline"
                              disabled={a.can_edit === false}
                              title={
                                a.can_edit === false
                                  ? "The server does not allow editing this advance."
                                  : undefined
                              }
                              onClick={() =>
                                setModal({ type: "edit", advance: a })
                              }
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="nx-btn nx-btn--sm nx-btn--primary"
                              disabled={advOutstanding(a) <= 0}
                              onClick={() =>
                                setModal({ type: "repay", advance: a })
                              }
                            >
                              Repay
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={7} className="nx-empty">
                        {advances.length
                          ? "No advances match the current filters."
                          : "No advances have been issued yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <NxPager
              page={paging.page}
              pageCount={paging.pageCount}
              total={filtered.length}
              onPage={paging.setPage}
            />
          </>
        )}
      </div>

      <div className="nx-panel nx-panel--gap">
        <div className="nx-panel-head">
          <h3>Repayment movement</h3>
          <span className="nx-muted">
            Every repayment — salary deductions posted on confirmation and
            manual repayments
          </span>
        </div>
        <div className="nx-table-scroll">
          <table className="nx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Advance</th>
                <th className="nx-right">Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {movePaging.slice.map((r) => {
                const adv = advanceById.get(idOf(r.advance));
                return (
                  <tr key={r.id}>
                    <td>{formatISODate(r.date)}</td>
                    <td>
                      <strong>
                        {r.employee_name || `Employee #${idOf(r.employee)}`}
                      </strong>
                    </td>
                    <td>{adv ? advRef(adv) : `#${idOf(r.advance)}`}</td>
                    <td className="nx-right">{moneyText(r.amount)}</td>
                    <td>
                      <NxStatus tone={r.salary_payment ? "info" : "neutral"}>
                        {r.salary_payment ? "Salary deduction" : "Manual"}
                      </NxStatus>
                    </td>
                  </tr>
                );
              })}
              {!repayments.length && (
                <tr>
                  <td colSpan={5} className="nx-empty">
                    No repayments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <NxPager
          page={movePaging.page}
          pageCount={movePaging.pageCount}
          total={repayments.length}
          onPage={movePaging.setPage}
        />
      </div>

      {modal?.type === "add" && (
        <AdvanceFormModal
          people={people}
          auth={auth}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal?.type === "edit" && (
        <AdvanceFormModal
          people={people}
          advance={modal.advance}
          auth={auth}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal?.type === "repay" && (
        <RepaymentModal
          advance={modal.advance}
          auth={auth}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal?.type === "view" && (
        <AdvanceDetailModal
          advanceId={modal.id}
          peopleById={peopleById}
          auth={auth}
          onClose={() => setModal(null)}
          onEdit={(advance) => setModal({ type: "edit", advance })}
          onRepay={(advance) => setModal({ type: "repay", advance })}
          onDelete={remove}
        />
      )}
      <AdminAdvanceReports accessToken={accessToken} version={version} />
    </div>
  );
}

/* ============================================================
   ADVANCE REPORTS + EMPLOYEE EYE HISTORY — SAME JSX FILE
   ============================================================ */
const ADV_REPORT_API = {
  advances: "/erp/admin/advances/report/",
  repayments: "/erp/admin/advances/repayment-history/",
  employee: (id) => `/erp/admin/advances/employees/${id}/history/`,
};
const ADV_REPORT_PERIODS = [
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["year", "This Year"],
  ["custom", "Custom"],
  ["all", "All History"],
];
const ADV_REPORT_STATUSES = [
  ["all", "All statuses"],
  ["OUTSTANDING", "Outstanding"],
  ["PARTIALLY_REPAID", "Partially Repaid"],
  ["FULLY_REPAID", "Fully Repaid"],
];
function AdvanceEmployeeHistory({ employeeId, auth, onClose }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get(ADV_REPORT_API.employee(employeeId), {
        ...auth,
        signal: controller.signal,
      })
      .then((res) => setPayload(res.data))
      .catch((err) => {
        if (!isAbortError(err)) setError(salaryError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [employeeId, auth]);
  const advances = payload?.advances || [];
  return (
    <NxModal
      title="Complete Employee Advance History"
      subtitle={
        payload?.employee
          ? `${payload.employee.employee_name} · ${payload.employee.employee_code || ""}`
          : `Employee #${employeeId}`
      }
      wide
      onClose={onClose}
    >
      {loading ? (
        <div className="nx-state">Loading full advance history…</div>
      ) : error ? (
        <div className="nx-alert nx-alert--error">{error}</div>
      ) : (
        <>
          <div className="nx-cards nx-cards--3">
            <NxSummaryCard
              tone="navy"
              icon={<Banknote size={17} />}
              label="Total advanced"
              value={moneyText(payload?.summary?.total_advanced)}
            />
            <NxSummaryCard
              tone="green"
              icon={<CheckCircle2 size={17} />}
              label="Total repaid"
              value={moneyText(payload?.summary?.total_repaid)}
            />
            <NxSummaryCard
              tone="amber"
              icon={<Wallet size={17} />}
              label="Outstanding"
              value={moneyText(payload?.summary?.total_outstanding)}
            />
          </div>
          {advances.map((a) => (
            <section className="nx-history-advance" key={a.id}>
              <div className="nx-history-heading">
                <div>
                  <strong>{advRef(a)}</strong> · {formatISODate(a.advance_date)}
                  <small className="nx-sub">
                    {a.reason || "No reason entered"}
                  </small>
                </div>
                <NxStatus
                  tone={
                    a.status === "FULLY_REPAID"
                      ? "success"
                      : a.status === "PARTIALLY_REPAID"
                        ? "info"
                        : "warning"
                  }
                >
                  {String(a.status || "").replaceAll("_", " ")}
                </NxStatus>
              </div>
              <div className="nx-history-metrics">
                <span>
                  Issued <b>{moneyText(a.amount)}</b>
                </span>
                <span>
                  Repaid <b>{moneyText(a.total_repaid)}</b>
                </span>
                <span>
                  Balance <b>{moneyText(a.outstanding_amount)}</b>
                </span>
                <span>
                  Installments{" "}
                  <b>
                    {a.completed_installments ?? 0}
                    {a.installment_count ? ` / ${a.installment_count}` : ""}
                  </b>
                </span>
              </div>
              {a.first_installment_completed_on && (
                <p className="nx-muted">
                  First salary installment completed:{" "}
                  {formatISODate(a.first_installment_completed_on)}
                </p>
              )}
              <div className="nx-table-scroll">
                <table className="nx-table nx-table--compact">
                  <thead>
                    <tr>
                      <th>Repayment date</th>
                      <th>Type</th>
                      <th>Installment</th>
                      <th className="nx-right">Paid</th>
                      <th className="nx-right">Balance after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(a.repayment_history || []).map((r) => (
                      <tr key={r.repayment_id}>
                        <td>{formatISODate(r.date)}</td>
                        <td>
                          {r.type === "SALARY_INSTALLMENT"
                            ? "Salary deduction"
                            : "Manual repayment"}
                        </td>
                        <td>
                          {r.installment_number
                            ? `#${r.installment_number} completed`
                            : "—"}
                        </td>
                        <td className="nx-right">{moneyText(r.amount)}</td>
                        <td className="nx-right">
                          {moneyText(r.balance_after)}
                        </td>
                      </tr>
                    ))}
                    {!a.repayment_history?.length && (
                      <tr>
                        <td colSpan={5} className="nx-empty">
                          No repayments yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          {!advances.length && (
            <div className="nx-state">
              This employee has no advance history.
            </div>
          )}
        </>
      )}
    </NxModal>
  );
}
function AdminAdvanceReports({ accessToken, version }) {
  const [kind, setKind] = useState("advances");
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");
  const [historyId, setHistoryId] = useState(null);
  const auth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${accessToken}` } }),
    [accessToken],
  );
  const endpoint =
    kind === "advances" ? ADV_REPORT_API.advances : ADV_REPORT_API.repayments;
  const params = useMemo(
    () => ({
      period,
      ...(period === "custom" ? { date_from: from, date_to: to } : {}),
      ...(employee ? { employee } : {}),
      ...(kind === "advances" && status !== "all" ? { status } : {}),
      page,
      page_size: 50,
    }),
    [period, from, to, employee, status, kind, page],
  );
  const invalidDates = period === "custom" && (!from || !to || from > to);
  useEffect(() => {
    setPage(1);
  }, [kind, period, from, to, status, employee]);
  useEffect(() => {
    if (!accessToken || invalidDates) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get(endpoint, { ...auth, params, signal: controller.signal })
      .then((res) => setData(res.data))
      .catch((err) => {
        if (!isAbortError(err)) {
          setData(null);
          setError(salaryError(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, endpoint, auth, params, invalidDates, version]);
  const results = data?.results || [];
  const visible = results.filter((r) =>
    matchesQuery(
      search,
      r.employee_name,
      r.employee_code,
      r.reason,
      r.id,
      r.advance_id,
    ),
  );
  const pages = Math.max(1, Math.ceil((data?.count || 0) / 50));
  const exportReport = async (format) => {
    if (exporting || invalidDates) return;
    setExporting(format);
    setError("");
    try {
      const response = await api.get(endpoint, {
        ...auth,
        params: {
          ...params,
          export: format,
          page: undefined,
          page_size: undefined,
        },
        responseType: "blob",
      });
      if (response.data?.type?.includes("json")) {
        const message = JSON.parse(await response.data.text());
        throw new Error(message.detail || "Export failed.");
      }
      const blob = new Blob([response.data], {
        type:
          format === "csv"
            ? "text/csv;charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `NXT_GENZ_${kind === "advances" ? "Advance_Report" : "Repayment_History"}_${period}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(salaryError(err));
    } finally {
      setExporting("");
    }
  };
  return (
    <section className="nx-advance-report">
      <div className="nx-pane-head">
        <div>
          <h2>
            <CalendarDays size={20} /> Advance Filtering & History
          </h2>
          <p>
            Issue-date reports and repayment-date history, including fully
            repaid advances.
          </p>
        </div>
        <div className="nx-pane-actions">
          <button
            className="nx-btn nx-btn--outline"
            type="button"
            disabled={Boolean(exporting) || invalidDates}
            onClick={() => exportReport("csv")}
          >
            <Download size={15} /> CSV
          </button>
          <button
            className="nx-btn nx-btn--primary"
            type="button"
            disabled={Boolean(exporting) || invalidDates}
            onClick={() => exportReport("xlsx")}
          >
            <Download size={15} />{" "}
            {exporting === "xlsx" ? "Exporting…" : "Excel"}
          </button>
        </div>
      </div>
      <div className="nx-report-switch">
        <button
          type="button"
          className={`nx-btn ${kind === "advances" ? "nx-btn--primary" : "nx-btn--outline"}`}
          onClick={() => setKind("advances")}
        >
          Advance Report
        </button>
        <button
          type="button"
          className={`nx-btn ${kind === "repayments" ? "nx-btn--primary" : "nx-btn--outline"}`}
          onClick={() => setKind("repayments")}
        >
          Repayment / Installment History
        </button>
      </div>
      <div className="nx-toolbar nx-report-filters">
        <label className="nx-field">
          Period
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {ADV_REPORT_PERIODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="nx-field">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="nx-field">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
        {kind === "advances" && (
          <label className="nx-field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {ADV_REPORT_STATUSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="nx-field">
          Employee database ID
          <input
            type="number"
            min="1"
            value={employee}
            placeholder="All employees"
            onChange={(e) => setEmployee(e.target.value)}
          />
        </label>
        <label className="nx-field nx-field--grow">
          Search visible rows
          <span className="nx-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, reference"
            />
          </span>
        </label>
      </div>
      {invalidDates && (
        <div className="nx-alert nx-alert--error">
          Choose valid From and To dates.
        </div>
      )}
      {error && (
        <div className="nx-alert nx-alert--error" role="alert">
          {error}
        </div>
      )}
      {data && !loading && (
        <div className="nx-history-metrics nx-report-totals">
          <span>
            Records <b>{data.count ?? 0}</b>
          </span>
          {kind === "advances" ? (
            <>
              <span>
                Issued <b>{moneyText(data.summary?.total_advanced)}</b>
              </span>
              <span>
                Repaid to date{" "}
                <b>{moneyText(data.summary?.total_repaid_to_date)}</b>
              </span>
              <span>
                Outstanding <b>{moneyText(data.summary?.total_outstanding)}</b>
              </span>
            </>
          ) : (
            <span>
              Repaid in period <b>{moneyText(data.total_repaid_in_period)}</b>
            </span>
          )}
        </div>
      )}
      <div className="nx-panel">
        {loading ? (
          <div className="nx-state">Loading report…</div>
        ) : !data ? (
          <div className="nx-state">Select filters to load the report.</div>
        ) : (
          <div className="nx-table-scroll">
            <table className="nx-table">
              <thead>
                {kind === "advances" ? (
                  <tr>
                    <th>Employee</th>
                    <th>Advance date</th>
                    <th>Reference</th>
                    <th className="nx-right">Issued</th>
                    <th className="nx-right">Repaid</th>
                    <th className="nx-right">Balance</th>
                    <th>Installments</th>
                    <th>Status</th>
                    <th>History</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Employee</th>
                    <th>Repayment date</th>
                    <th>Advance ID</th>
                    <th>Repayment type</th>
                    <th>Installment</th>
                    <th className="nx-right">Paid</th>
                    <th className="nx-right">Balance after</th>
                    <th>History</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {visible.map((r) =>
                  kind === "advances" ? (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.employee_name}</strong>
                        <small className="nx-sub">{r.employee_code}</small>
                      </td>
                      <td>{formatISODate(r.advance_date)}</td>
                      <td>ADV-{r.id}</td>
                      <td className="nx-right">{moneyText(r.amount)}</td>
                      <td className="nx-right">{moneyText(r.total_repaid)}</td>
                      <td className="nx-right">
                        {moneyText(r.outstanding_amount)}
                      </td>
                      <td>
                        {r.completed_installments ?? 0}
                        {r.installment_count ? ` / ${r.installment_count}` : ""}
                      </td>
                      <td>
                        <NxStatus
                          tone={
                            r.status === "FULLY_REPAID"
                              ? "success"
                              : r.status === "PARTIALLY_REPAID"
                                ? "info"
                                : "warning"
                          }
                        >
                          {String(r.status).replaceAll("_", " ")}
                        </NxStatus>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="nx-btn nx-btn--sm nx-btn--outline"
                          onClick={() => setHistoryId(r.employee)}
                        >
                          <Eye size={14} /> History
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.repayment_id}>
                      <td>
                        <strong>{r.employee_name}</strong>
                        <small className="nx-sub">{r.employee_code}</small>
                      </td>
                      <td>{formatISODate(r.date)}</td>
                      <td>ADV-{r.advance_id}</td>
                      <td>
                        {r.type === "SALARY_INSTALLMENT"
                          ? "Salary deduction"
                          : "Manual repayment"}
                      </td>
                      <td>
                        {r.installment_number
                          ? `#${r.installment_number} completed`
                          : "—"}
                      </td>
                      <td className="nx-right">{moneyText(r.amount)}</td>
                      <td className="nx-right">{moneyText(r.balance_after)}</td>
                      <td>
                        <button
                          type="button"
                          className="nx-btn nx-btn--sm nx-btn--outline"
                          onClick={() => setHistoryId(r.employee)}
                        >
                          <Eye size={14} /> History
                        </button>
                      </td>
                    </tr>
                  ),
                )}
                {!visible.length && (
                  <tr>
                    <td
                      colSpan={kind === "advances" ? 9 : 8}
                      className="nx-empty"
                    >
                      No matching records on this page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="nx-report-pagination">
          <span>
            Page {page} of {pages} · {data?.count ?? 0} total records
          </span>
          <div className="nx-actions">
            <button
              type="button"
              className="nx-btn nx-btn--sm nx-btn--outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="nx-btn nx-btn--sm nx-btn--outline"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {historyId != null && (
        <AdvanceEmployeeHistory
          employeeId={historyId}
          auth={auth}
          onClose={() => setHistoryId(null)}
        />
      )}
    </section>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function AdminAttendance() {
  const { accessToken } = useAuth();

  const now = new Date();

  const [adminTab, setAdminTab] = useState("attendance");
  /* Bumped whenever advances change so the Advance tab reloads. */
  const [advanceVersion, setAdvanceVersion] = useState(0);
  const bumpAdvances = useCallback(() => setAdvanceVersion((v) => v + 1), []);
  const [date, setDate] = useState(todayISO);
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(
    String(now.getMonth() + 1).padStart(2, "0"),
  );

  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");

  const [leaveSearch, setLeaveSearch] = useState("");
  const [presentSearch, setPresentSearch] = useState("");
  const [monthlySearch, setMonthlySearch] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Daily modal */
  const [dailyTarget, setDailyTarget] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState("");

  /* Stale-response guards */
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const dailyRequestRef = useRef(0);
  const dailyAbortRef = useRef(null);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  /* ==========================================================
     FETCH — list
     ========================================================== */

  const loadAttendance = useCallback(async () => {
    if (!accessToken) {
      setData(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("period", period);

      if (period === "year") {
        params.set("date", `${year}-01-01`);
      } else if (period === "month") {
        params.set("date", `${year}-${month}-01`);
        params.set("month", String(Number(month)));
        params.set("year", year);
      } else if (period === "custom") {
        params.set("date", fromDate);
        params.set("from", fromDate);
        params.set("to", toDate);
      } else {
        params.set("date", date);
      }

      if (departmentFilter && departmentFilter !== "all") {
        params.set("department", departmentFilter);
      }

      if (attendanceStatusFilter && attendanceStatusFilter !== "all") {
        params.set("status", attendanceStatusFilter);
      }

      const url = `${ATTENDANCE_ENDPOINT}?${params.toString()}`;

      const response = await api.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;

      if (!response.data?.success) {
        throw new Error("Invalid attendance response.");
      }

      setData(response.data);
    } catch (err) {
      if (requestId !== requestIdRef.current || isAbortError(err)) {
        return;
      }
      console.error("Failed to load admin attendance:", err);
      setData(null);
      setError(errorMessage(err, GENERIC_ERROR));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    accessToken,
    date,
    period,
    year,
    month,
    fromDate,
    toDate,
    departmentFilter,
    attendanceStatusFilter,
  ]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  /* Abort anything in flight on unmount */
  useEffect(
    () => () => {
      abortRef.current?.abort();
      dailyAbortRef.current?.abort();
    },
    [],
  );

  /* ==========================================================
     FETCH — one employee's calendar (Eye button)
     ========================================================== */

  const fetchDaily = useCallback(
    async (target) => {
      if (!accessToken) return;

      dailyAbortRef.current?.abort();
      const controller = new AbortController();
      dailyAbortRef.current = controller;
      const requestId = ++dailyRequestRef.current;

      setDailyData(null);
      setDailyError("");
      setDailyLoading(true);

      try {
        const params = new URLSearchParams({
          period: "month",
          date: `${target.year}-${target.month}-01`,
          month: String(Number(target.month)),
          year: target.year,
          employee_id: String(target.employee.id),
        });

        const response = await api.get(
          `${ATTENDANCE_ENDPOINT}?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          },
        );

        if (requestId !== dailyRequestRef.current) return;

        if (!response.data?.success) {
          throw new Error(DAILY_ERROR);
        }

        setDailyData(response.data);
      } catch (err) {
        if (requestId !== dailyRequestRef.current || isAbortError(err)) {
          return;
        }
        setDailyError(errorMessage(err, DAILY_ERROR));
      } finally {
        if (requestId === dailyRequestRef.current) {
          setDailyLoading(false);
        }
      }
    },
    [accessToken],
  );

  const openDaily = useCallback(
    (row) => {
      /* Month/year are captured now so the modal always matches
         the month that was on screen when the Eye was clicked. */
      const target = { employee: row, year, month };
      setDailyTarget(target);
      fetchDaily(target);
    },
    [fetchDaily, year, month],
  );

  const closeDaily = useCallback(() => {
    dailyRequestRef.current += 1; // invalidate in-flight request
    dailyAbortRef.current?.abort();
    setDailyTarget(null);
    setDailyData(null);
    setDailyError("");
    setDailyLoading(false);
  }, []);

  /* ==========================================================
     DATA SOURCE
     ========================================================== */

  const leave = data?.leave ?? [];
  const present = data?.present ?? [];
  const employees = data?.employees ?? [];
  const summary = data?.summary;
  const dayTotals = data?.day_totals;
  const config = data?.config;

  const displayLoading = loading;
  const displayError = error || null;

  /* Window is whatever the API resolved — never guessed locally. */
  const windowFrom = data?.from || "";
  const windowTo = data?.to || "";
  const windowPeriod = data?.period || period;
  const windowDays = daysBetween(windowFrom, windowTo);
  const hasWindow = Boolean(windowFrom && windowTo);

  const isRangePeriod = windowPeriod !== "day";

  /* Month view swaps the Present card for the all-employee list. */
  const isMonthView = data?.period
    ? data.period === "month"
    : period === "month";

  const presentColumns = useMemo(() => {
    const base = [
      { key: "employee_name", header: "Employee Name", render: personCell },
      roleColumn,
      departmentColumn,
      statusColumn,
      makePresentDatesColumn(isRangePeriod, windowFrom, windowTo),
    ];

    base.push(isRangePeriod ? daysWorkedColumn : loginTimeColumn);
    base.push(makeHoursColumn(isRangePeriod));
    base.push(makeWageColumn(isRangePeriod));
    return base;
  }, [isRangePeriod, windowFrom, windowTo]);

  const leaveColumns = useMemo(
    () => [
      { key: "employee_name", header: "Employee Name", render: personCell },
      roleColumn,
      departmentColumn,
      reasonColumn,
      makeLeaveDatesColumn(isRangePeriod, windowFrom, windowTo),
      leaveDaysColumn,
    ],
    [isRangePeriod, windowFrom, windowTo],
  );

  const monthlyColumns = useMemo(
    () => makeMonthlyColumns(openDaily),
    [openDaily],
  );

  /* ==========================================================
     SEARCH + LOCAL FILTER
     ========================================================== */

  const filterRows = (rows, query, type) =>
    rows.filter((row) => {
      const matchesSearch = matchesQuery(
        query,
        row.employee_name,
        row.employee_code,
        row.designation,
        row.department,
      );

      const matchesDepartment =
        departmentFilter === "all" || row.department === departmentFilter;

      let matchesStatus = true;

      /* Monthly rows are already status-filtered by the API. */
      if (attendanceStatusFilter !== "all" && type !== "monthly") {
        if (attendanceStatusFilter === "ON_LEAVE") {
          matchesStatus = type === "leave";
        } else {
          matchesStatus =
            type === "present" && row.status === attendanceStatusFilter;
        }
      }

      return matchesSearch && matchesDepartment && matchesStatus;
    });

  const leaveRows = useMemo(
    () => filterRows(leave, leaveSearch, "leave"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leave, leaveSearch, departmentFilter, attendanceStatusFilter],
  );

  const presentRows = useMemo(
    () => filterRows(present, presentSearch, "present"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [present, presentSearch, departmentFilter, attendanceStatusFilter],
  );

  const monthlyRows = useMemo(
    () => filterRows(employees, monthlySearch, "monthly"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, monthlySearch, departmentFilter],
  );

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="admin-attendance-page">
      <div
        className="salary-main-tabs"
        role="tablist"
        aria-label="Admin attendance sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "attendance"}
          className={adminTab === "attendance" ? "active" : ""}
          onClick={() => setAdminTab("attendance")}
        >
          <CalendarDays size={17} /> Attendance
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "salary"}
          className={adminTab === "salary" ? "active" : ""}
          onClick={() => setAdminTab("salary")}
        >
          <Wallet size={17} /> Salary Management
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "advance"}
          className={adminTab === "advance" ? "active" : ""}
          onClick={() => setAdminTab("advance")}
        >
          <CreditCard size={17} /> Advance Management
        </button>
      </div>
      {adminTab === "salary" ? (
        <AdminSalaryManagement
          accessToken={accessToken}
          initialMonth={`${year}-${month}`}
          onAdvancesChanged={bumpAdvances}
        />
      ) : adminTab === "advance" ? (
        <AdminAdvanceManagement
          accessToken={accessToken}
          version={advanceVersion}
          onAdvancesChanged={bumpAdvances}
        />
      ) : (
        <>
          {/* TOOLBAR */}
          <AdminToolbar>
            <div className="attendance-toolbar-filters">
              {/* PERIOD */}
              <div className="attendance-period-filter">
                {PERIOD_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`attendance-period-button ${
                      period === item.value
                        ? "attendance-period-button-active"
                        : ""
                    }`}
                    onClick={() => setPeriod(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* FILTERS ROW (wraps cleanly) */}
              <div className="attendance-filter-row">
                {/* DEPARTMENT */}
                <label className="attendance-select-field">
                  <span>Department</span>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    {DEPARTMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* STATUS */}
                <label className="attendance-select-field">
                  <span>Status</span>
                  <select
                    value={attendanceStatusFilter}
                    onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                  >
                    {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="attendance-period-slot">
                  {/* YEAR (period === "year") */}
                  {period === "year" && (
                    <label className="attendance-select-field attendance-year-select">
                      <span>Year</span>
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                      >
                        {yearOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {/* MONTH + YEAR (period === "month") */}
                  {period === "month" && (
                    <>
                      <label className="attendance-select-field attendance-month-select">
                        <span>Month</span>
                        <select
                          value={month}
                          onChange={(e) => setMonth(e.target.value)}
                        >
                          {MONTH_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="attendance-select-field attendance-year-select">
                        <span>Year</span>
                        <select
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                        >
                          {yearOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  {/* SINGLE DATE (day / week / quarter) */}
                  {period !== "custom" &&
                    period !== "year" &&
                    period !== "month" && (
                      <label className="admin-field attendance-date-field">
                        Date
                        <input
                          type="date"
                          value={date}
                          max={todayISO()}
                          onChange={(e) => {
                            if (e.target.value) setDate(e.target.value);
                          }}
                        />
                      </label>
                    )}

                  {/* CUSTOM RANGE */}
                  {period === "custom" && (
                    <div className="attendance-custom-date-range">
                      <label className="admin-field attendance-date-field">
                        From
                        <input
                          type="date"
                          value={fromDate}
                          max={toDate || todayISO()}
                          onChange={(e) => {
                            if (e.target.value) setFromDate(e.target.value);
                          }}
                        />
                      </label>

                      <span className="attendance-date-range-arrow">→</span>

                      <label className="admin-field attendance-date-field">
                        To
                        <input
                          type="date"
                          value={toDate}
                          min={fromDate}
                          max={todayISO()}
                          onChange={(e) => {
                            if (e.target.value) setToDate(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AdminToolbar>

          {/* RESOLVED WINDOW CAPTION */}
          {!displayError && (
            <div
              className={`attendance-window-caption${
                displayLoading && hasWindow
                  ? " attendance-window-caption--loading"
                  : ""
              }`}
              role="status"
              aria-live="polite"
            >
              {hasWindow ? (
                <>
                  <span className="attendance-window-label">Showing:</span>{" "}
                  <strong>{formatWindow(windowFrom, windowTo)}</strong>
                  <span className="attendance-window-sep">·</span>
                  {windowDays} {windowDays === 1 ? "day" : "days"}
                  <span className="attendance-window-sep">·</span>
                  Period:{" "}
                  <strong>{PERIOD_LABEL[windowPeriod] || windowPeriod}</strong>
                </>
              ) : (
                <span className="attendance-window-label">
                  {displayLoading
                    ? "Resolving date window…"
                    : "Date window unavailable."}
                </span>
              )}
            </div>
          )}

          {/* Day totals + rule hint (range periods only) */}
          {!displayError && hasWindow && isRangePeriod && dayTotals && (
            <div className="attendance-day-totals">
              <span>Employee-days in this window:</span>
              <span>
                Worked <strong>{dayTotals.days_worked}</strong>
              </span>
              <span>
                Leave <strong>{dayTotals.leave_days}</strong>
              </span>
              <span>
                Absent <strong>{dayTotals.absent_days}</strong>
              </span>
              <span>
                Holiday <strong>{dayTotals.holiday_days}</strong>
              </span>
              <span>
                Weekly off <strong>{dayTotals.weekly_off_days}</strong>
              </span>
              <span>
                Not marked <strong>{dayTotals.not_marked_days}</strong>
              </span>
              {config && config.rules_configured === false && (
                <em>
                  Holidays / weekly offs are not configured, so dates with no
                  record are shown as Not Marked.
                </em>
              )}
            </div>
          )}

          {/* KPI STRIP */}
          <AdminStatStrip
            items={[
              {
                label: "Present",
                value: summary?.present ?? 0,
                tone: "success",
              },
              {
                label: "On Leave",
                value: summary?.on_leave ?? 0,
                tone: "warning",
              },
              {
                label: "Not Marked",
                value: summary?.not_marked ?? 0,
                tone: "neutral",
              },
              {
                label: "Active Employees",
                value: summary?.total_active ?? 0,
                tone: "info",
              },
            ]}
          />

          {/* ON LEAVE */}
          <AdminCard
            title="On Leave"
            tone="warning"
            count={displayLoading || displayError ? undefined : leave.length}
            subtitle={
              <div className="attendance-table-search">
                <Search size={15} strokeWidth={2} />
                <input
                  type="text"
                  value={leaveSearch}
                  onChange={(e) => setLeaveSearch(e.target.value)}
                  placeholder="Search employee..."
                  aria-label="Search employees on leave"
                />
              </div>
            }
          >
            <AdminDataTable
              columns={leaveColumns}
              rows={leaveRows}
              totalCount={leave.length}
              rowKey="id"
              loading={displayLoading}
              error={displayError}
              onRetry={loadAttendance}
              emptyTitle="No one is on leave"
              emptyMessage={
                leaveSearch
                  ? "No leave records match your search."
                  : "No employee is marked on leave for this period."
              }
              minWidth={980}
            />
          </AdminCard>

          {/* MONTH VIEW: ALL ACTIVE EMPLOYEES */}
          {isMonthView ? (
            <AdminCard
              title="Monthly Attendance"
              tone="success"
              count={
                displayLoading || displayError ? undefined : employees.length
              }
              subtitle={
                <div className="attendance-table-search">
                  <Search size={15} strokeWidth={2} />
                  <input
                    type="text"
                    value={monthlySearch}
                    onChange={(e) => setMonthlySearch(e.target.value)}
                    placeholder="Search employee..."
                    aria-label="Search monthly attendance"
                  />
                </div>
              }
            >
              <AdminDataTable
                columns={monthlyColumns}
                rows={monthlyRows}
                totalCount={employees.length}
                rowKey="id"
                loading={displayLoading}
                error={displayError}
                onRetry={loadAttendance}
                emptyTitle="No employees found"
                emptyMessage={
                  monthlySearch
                    ? "No employees match your search."
                    : "No active employees match the selected filters."
                }
                minWidth={1240}
              />
            </AdminCard>
          ) : (
            /* PRESENT (day / week / quarter / year / custom) */
            <AdminCard
              title="Present"
              tone="success"
              count={
                displayLoading || displayError ? undefined : present.length
              }
              subtitle={
                <div className="attendance-table-search">
                  <Search size={15} strokeWidth={2} />
                  <input
                    type="text"
                    value={presentSearch}
                    onChange={(e) => setPresentSearch(e.target.value)}
                    placeholder="Search employee..."
                    aria-label="Search present employees"
                  />
                </div>
              }
            >
              <AdminDataTable
                columns={presentColumns}
                rows={presentRows}
                totalCount={present.length}
                rowKey="id"
                loading={displayLoading}
                error={displayError}
                onRetry={loadAttendance}
                emptyTitle="No one marked present"
                emptyMessage={
                  presentSearch
                    ? "No present employees match your search."
                    : "No attendance has been marked present for this period."
                }
                minWidth={1080}
              />
            </AdminCard>
          )}

          {/* DAILY MODAL */}
          {dailyTarget && (
            <DailyAttendanceModal
              target={dailyTarget}
              data={dailyData}
              loading={dailyLoading}
              error={dailyError}
              onClose={closeDaily}
              onRetry={() => fetchDaily(dailyTarget)}
            />
          )}
        </>
      )}
    </div>
  );
}