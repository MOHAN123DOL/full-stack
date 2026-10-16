import {
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
import { Search, Eye, X } from "lucide-react";
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
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) =>
    String(f || "").toLowerCase().includes(q)
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
  err?.response?.data?.message ||
  err?.response?.data?.detail ||
  fallback;

/* ============================================================
   SMALL PRESENTATION COMPONENTS
   ============================================================ */

function AttendancePill({ code, label }) {
  const tone = PILL_TONE[code] || "other";
  const text = label || STATUS_TEXT[code] || code || "—";
  return (
    <span className={`attendance-pill attendance-pill--${tone}`}>
      {text}
    </span>
  );
}

/* ============================================================
   TABLE CELLS / COLUMNS
   ============================================================ */

const personCell = (row) => (
  <>
    <span className="admin-cell-primary">
      {row.employee_name || "—"}
    </span>
    <span className="admin-cell-secondary">
      {row.employee_code || "—"}
    </span>
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
  sortValue: (row) =>
    ATTENDANCE_STATUS_LABEL[row.status] || row.status || "",
  render: (row) => (
    <AdminStatusBadge
      status={
        ATTENDANCE_STATUS_LABEL[row.status] ||
        row.status ||
        "—"
      }
    />
  ),
};

const makePresentDatesColumn = (isRange, windowFrom, windowTo) => ({
  key: "dates",
  header: isRange ? "Dates" : "Date",
  sortValue: (row) =>
    row.from_date || row.date || windowFrom || "",
  render: (row) => {
    const from = row.from_date || row.date || windowFrom;
    const to = row.to_date || row.date || windowTo || from;
    const text = isRange
      ? formatRowDates(from, to)
      : formatISODate(row.date || from);
    return (
      <span
        className="attendance-dates-cell"
        title={formatWindow(from, to)}
      >
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
    const text = isRange
      ? formatRowDates(from, to)
      : formatISODate(from);
    return (
      <span
        className="attendance-dates-cell"
        title={formatWindow(from, to)}
      >
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
    <strong className="attendance-numeric">
      {row.days_worked ?? "—"}
    </strong>
  ),
};

const loginTimeColumn = {
  key: "login_time",
  header: "Login Time",
  render: (row) => (
    <span className="attendance-login-cell">
      {row.login_time || "—"}
    </span>
  ),
};

const makeHoursColumn = (isRange) => ({
  key: "working_hours",
  header: isRange ? "Total Hours" : "Hours",
  align: "right",
  sortValue: (row) => Number(row.working_hours) || 0,
  render: (row) => (
    <span className="attendance-numeric">
      {formatHours(row.working_hours)}
    </span>
  ),
});

const makeWageColumn = (isRange) => ({
  key: "daily_wage",
  header: isRange ? "Total Wage" : "Wage",
  align: "right",
  sortValue: (row) => Number(row.daily_wage) || 0,
  render: (row) => (
    <span className="attendance-numeric">
      {formatCurrency(row.daily_wage)}
    </span>
  ),
});

const reasonColumn = {
  key: "reason",
  header: "Reason for Leave",
  render: (row) => (
    <span
      className={`admin-cell-wrap${
        row.reason ? "" : " admin-cell-muted"
      }`}
    >
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
    <strong className="attendance-numeric">
      {row.leave_days ?? "—"}
    </strong>
  ),
};

/* Monthly (all active employees) columns */
const makeCountColumn = (key, header) => ({
  key,
  header,
  align: "right",
  sortValue: (row) => Number(row[key]) || 0,
  render: (row) => (
    <span className="attendance-numeric">{row[key] ?? 0}</span>
  ),
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
        <strong className="attendance-numeric">
          {row.days_worked ?? 0}
        </strong>
        {Number(row.half_days) > 0 && (
          <span className="admin-cell-secondary">
            {row.half_days} half-day
          </span>
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
    <div
      className="attendance-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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
          <p className="attendance-modal-state">
            Loading daily attendance…
          </p>
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
   MAIN COMPONENT
   ============================================================ */

export default function AdminAttendance() {
  const { accessToken } = useAuth();

  const now = new Date();

  const [date, setDate] = useState(todayISO);
  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(
    String(now.getMonth() + 1).padStart(2, "0"),
  );

  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);

  const [departmentFilter, setDepartmentFilter] =
    useState("all");
  const [attendanceStatusFilter, setAttendanceStatusFilter] =
    useState("all");

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

      if (
        attendanceStatusFilter &&
        attendanceStatusFilter !== "all"
      ) {
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
      if (
        requestId !== requestIdRef.current ||
        isAbortError(err)
      ) {
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
        if (
          requestId !== dailyRequestRef.current ||
          isAbortError(err)
        ) {
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
        departmentFilter === "all" ||
        row.department === departmentFilter;

      let matchesStatus = true;

      /* Monthly rows are already status-filtered by the API. */
      if (attendanceStatusFilter !== "all" && type !== "monthly") {
        if (attendanceStatusFilter === "ON_LEAVE") {
          matchesStatus = type === "leave";
        } else {
          matchesStatus =
            type === "present" &&
            row.status === attendanceStatusFilter;
        }
      }

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus
      );
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
                onChange={(e) =>
                  setDepartmentFilter(e.target.value)
                }
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
                onChange={(e) =>
                  setAttendanceStatusFilter(e.target.value)
                }
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
              <strong>
                {PERIOD_LABEL[windowPeriod] || windowPeriod}
              </strong>
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
          <span>Worked <strong>{dayTotals.days_worked}</strong></span>
          <span>Leave <strong>{dayTotals.leave_days}</strong></span>
          <span>Absent <strong>{dayTotals.absent_days}</strong></span>
          <span>Holiday <strong>{dayTotals.holiday_days}</strong></span>
          <span>Weekly off <strong>{dayTotals.weekly_off_days}</strong></span>
          <span>Not marked <strong>{dayTotals.not_marked_days}</strong></span>
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
        count={
          displayLoading || displayError ? undefined : leave.length
        }
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
            displayLoading || displayError
              ? undefined
              : employees.length
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
    </div>
  );
}