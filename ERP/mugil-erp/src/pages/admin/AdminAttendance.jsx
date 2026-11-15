import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function AdminSalaryManagement({
  accessToken,
  initialMonth,
  onAdvancesChanged,
}) {
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
      <div className="nx-pane-head">
        <div>
          <h2>
            <Wallet size={21} /> Salary Management
          </h2>
          <p>
            All active employees · Mon–Sat 8 h/day · Sunday 6 h/day · figures
            calculated by the server
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
    </div>
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
