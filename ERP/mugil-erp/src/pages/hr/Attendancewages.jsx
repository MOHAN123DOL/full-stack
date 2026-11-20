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
import Header from "../../components/Header";
import Loading from "../../components/loading";
// Renamed from `Error` so it never shadows the global Error constructor.
import ErrorState from "../../components/error";

/* ==========================================================================
   CONSTANTS & SHARED HELPERS
   (several are re-exported for other modules such as Payroll.jsx)
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

export const WORKED_STATUSES = ["PRESENT", "HALF_DAY", "WFH"];

export function statusLabel(status) {
  if (status === "NOT_MARKED") return "Not Marked";
  return STATUS_META[status]?.label || status;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Local-calendar ISO date. (toISOString() is UTC and shifts the day in IST.) */
export function toLocalISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO() {
  return toLocalISO(new Date());
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

// Kept ONLY because Payroll.jsx imports it. Not used anywhere in HR Attendance.
export function formatINR(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatHours(hours) {
  return `${(Number(hours) || 0).toFixed(2)} hrs`;
}

export function formatDisplayDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

export function monthRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${monthStr}-${pad2(lastDay)}`;
  return { start, end };
}

export function currentMonthStr() {
  return todayISO().slice(0, 7);
}

export function startOfWeek(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalISO(d);
}

export function endOfWeek(iso) {
  return addDays(startOfWeek(iso), 6);
}

const fmt2 = (n) => (Number(n) || 0).toFixed(2);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

/* ==========================================================================
   SHIFT & HOURLY-SLOT LOGIC
   Mirrors attendance_services.py. Used for LIVE PREVIEW only — the backend
   recalculates everything from the checked slots on save.
   ========================================================================== */

const LUNCH_HOUR = 13;

export function shiftFor(dateISO) {
  const isSunday = dateISO ? parseISO(dateISO).getDay() === 0 : false;
  return isSunday
    ? {
        isSunday: true,
        start: 6 * 60,
        end: 12 * 60,
        startHHMM: "06:00",
        endHHMM: "12:00",
        maxNormal: 6,
        title: "Sunday shift",
        window: "6:00 AM – 12:00 PM",
      }
    : {
        isSunday: false,
        start: 9 * 60,
        end: 18 * 60,
        startHHMM: "09:00",
        endHHMM: "18:00",
        maxNormal: 8,
        title: "Monday – Saturday shift",
        window: "9:00 AM – 6:00 PM",
      };
}

function toMin(value) {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 24 || m < 0 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

const overlap = (a1, a2, b1, b2) =>
  Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

function clockPart(hour24) {
  const h = ((hour24 % 24) + 24) % 24;
  return { n: h % 12 === 0 ? 12 : h % 12, suffix: h >= 12 ? "PM" : "AM" };
}

function slotLabel(hour) {
  const a = clockPart(hour);
  const b = clockPart(hour + 1);
  return a.suffix === b.suffix
    ? `${a.n}–${b.n} ${a.suffix}`
    : `${a.n} ${a.suffix}–${b.n} ${b.suffix}`;
}

export function validateTimes(login, logout) {
  const li = toMin(login);
  const lo = toMin(logout);
  if (li === null || lo === null) return "Enter valid login and logout times.";
  if (lo <= li) return "Logout time must be later than login time.";
  return "";
}

/** One slot per clock hour touched by [login, logout]. */
export function buildSlots(login, logout, dateISO) {
  const li = toMin(login);
  const lo = toMin(logout);
  if (li === null || lo === null || lo <= li) return [];
  const shift = shiftFor(dateISO);
  const slots = [];
  for (let h = Math.floor(li / 60); h <= Math.floor((lo - 1) / 60); h++) {
    const s0 = Math.max(h * 60, li);
    const s1 = Math.min(h * 60 + 60, lo);
    const isLunch = !shift.isSunday && h === LUNCH_HOUR;
    const paidMin = s1 - s0;
    const normalMin = overlap(s0, s1, shift.start, shift.end);
    slots.push({
      hour: h,
      label: slotLabel(h),
      isLunch,
      partial: s1 - s0 < 60,
      paidMin,
      normalMin,
      otMin: paidMin - normalMin,
    });
  }
  return slots;
}

/** Hours from CHECKED slots only. Unchecked slots add 0. */
export function calcHours(slots, isChecked, dateISO) {
  const shift = shiftFor(dateISO);
  let normalMin = 0;
  let otMin = 0;
  let slotCount = 0;
  slots.forEach((s) => {
    if (!isChecked(s.hour)) return;
    slotCount += 1;
    normalMin += s.normalMin;
    otMin += s.otMin;
  });
  const excessNormalMin = Math.max(0, normalMin - shift.maxNormal * 60);
  normalMin -= excessNormalMin;
  otMin += excessNormalMin;
  return {
    normal: round2(normalMin / 60),
    suggestedOT: round2(otMin / 60),
    slotCount,
  };
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

/**
 * Shared data-loading hook.
 *  - `fetcher` MUST be memoised. A new fetcher identity means the user
 *    changed a filter: the old data is dropped and the loading state shows,
 *    so stale rows from a previous period/date are never displayed.
 *  - `refreshKey` changes after a confirmed save: the SAME fetcher is called
 *    again silently (table stays on screen, filters preserved).
 *  - The `cancelled` flag stops a slow old response overwriting a newer one.
 */
function useRefreshableQuery(fetcher, refreshKey, fallbackError) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    refreshing: false,
    error: "",
  });
  const [retryKey, setRetryKey] = useState(0);
  const lastRefresh = useRef(refreshKey);
  const lastRetry = useRef(retryKey);

  useEffect(() => {
    let cancelled = false;

    const silent =
      lastRefresh.current !== refreshKey && lastRetry.current === retryKey;
    lastRefresh.current = refreshKey;
    lastRetry.current = retryKey;

    setState((prev) =>
      silent
        ? { ...prev, refreshing: true, error: "" }
        : { data: null, loading: true, refreshing: false, error: "" },
    );

    fetcher()
      .then((res) => {
        if (cancelled) return;
        setState({ data: res, loading: false, refreshing: false, error: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: extractError(err, fallbackError),
        }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, refreshKey, retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);
  return { ...state, retry };
}

/** Page number that automatically resets to 1 whenever the filter signature changes. */
function usePageForSignature(signature) {
  const [pageState, setPageState] = useState({ signature, page: 1 });
  const page = pageState.signature === signature ? pageState.page : 1;
  const setPage = useCallback(
    (p) => setPageState({ signature, page: p }),
    [signature],
  );
  return [page, setPage];
}

function QueryError({ error, onRetry, stale }) {
  return (
    <div style={{ padding: 24 }}>
      <ErrorState onRetry={onRetry} />
      <div style={{ marginTop: 8, fontSize: 13, color: "#a52626" }}>
        {error}
        {stale ? " Showing the last loaded data." : ""}
      </div>
    </div>
  );
}

function RefreshIndicator({ show }) {
  return (
    <div aria-live="polite" style={{ minHeight: 18 }}>
      {show && (
        <span className="aw-hint" style={{ fontWeight: 600 }}>
          Updating latest data…
        </span>
      )}
    </div>
  );
}

const DEPARTMENTS = [
  { value: "", label: "All Departments" },
  { value: "Engineering", label: "Engineering" },
  { value: "Production", label: "Production" },
  { value: "HR", label: "HR" },
  { value: "Sales", label: "Sales" },
  { value: "Accounts", label: "Accounts" },
];

const MONTH_NAMES = [
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

const FIRST_YEAR = 2020;

/* ==========================================================================
   ATTENDANCE API HOOK  (attendance only — no wage endpoints)
   ========================================================================== */

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) q.append(k, v);
  });
  return q.toString();
}

function useAttendanceApi() {
  const { accessToken } = useAuth();

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  const getDailyRoster = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        date: params.date || "",
        search: params.search || "",
        department: params.department || "",
        page: params.page || 1,
        page_size: params.page_size || 25,
      });
      const res = await api.get(`/erp/attendance/daily-roster/?${query}`, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders],
  );

  const createAttendance = useCallback(
    async (data) => {
      const res = await api.post("/erp/attendance/", data, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders],
  );

  // Change this URL only if your Django urls.py uses a different route.
  const createOvernightAttendance = useCallback(
    async (data) => {
      const res = await api.post("/erp/attendance/", data, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders],
  );

  const updateAttendance = useCallback(
    async (id, data) => {
      const res = await api.patch(`/erp/attendance/${id}/`, data, {
        headers: authHeaders(),
      });
      return res.data;
    },
    [authHeaders],
  );

  const getHoursSummary = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        period: params.period || "monthly",
        date: params.date || "",
        month: params.month || "",
        year: params.year || "",
        search: params.search || "",
        department: params.department || "",
        page: params.page || 1,
        page_size: params.page_size || 50,
      });
      const res = await api.get(
        `/erp/attendance/employee-hours-summary/?${query}`,
        { headers: authHeaders() },
      );
      return res.data;
    },
    [authHeaders],
  );

  const getEmployeeHoursDetail = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        employee: params.employee || "",
        period: params.period || "monthly",
        date: params.date || "",
        month: params.month || "",
        year: params.year || "",
      });
      const res = await api.get(
        `/erp/attendance/employee-hours-detail/?${query}`,
        { headers: authHeaders() },
      );
      return res.data;
    },
    [authHeaders],
  );

  return useMemo(
    () => ({
      getDailyRoster,
      createAttendance,
      createOvernightAttendance,
      updateAttendance,
      getHoursSummary,
      getEmployeeHoursDetail,
    }),
    [
      getDailyRoster,
      createAttendance,
      createOvernightAttendance,
      updateAttendance,
      getHoursSummary,
      getEmployeeHoursDetail,
    ],
  );
}

/* ==========================================================================
   CONTEXT PROVIDER
   ========================================================================== */

const AttendanceContext = createContext(null);

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx)
    throw new Error("useAttendance must be used within AttendanceProvider");
  return ctx;
}

export function AttendanceProvider({ children }) {
  const endpoints = useAttendanceApi();
  return (
    <AttendanceContext.Provider value={endpoints}>
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

function Pagination({ page, totalPages, count, pageSize, onPage, onPageSize }) {
  return (
    <div className="aw-pagination">
      <span className="aw-hint">
        {count} employee{count === 1 ? "" : "s"}
      </span>
      <div className="aw-pagination-controls">
        <label className="aw-page-size">
          <span>Rows</span>
          <select
            className="aw-select"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="aw-btn-outline aw-btn-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Prev
        </button>
        <span className="aw-page-indicator">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="aw-btn-outline aw-btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EmployeeFilterBar({
  search,
  onSearch,
  department,
  onDepartment,
  onClear,
}) {
  const dirty = search || department;
  return (
    <div className="aw-toolbar">
      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Employee Search</span>
        <input
          className="aw-input"
          type="text"
          placeholder="Employee ID or name…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <label className="aw-field aw-field-inline">
        <span className="aw-field-label">Department</span>
        <select
          className="aw-select"
          value={department}
          onChange={(e) => onDepartment(e.target.value)}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
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
   ATTENDANCE FORM MODAL  (hourly-slot based)
   ========================================================================== */

function initForm(editRecord, presetDate) {
  if (editRecord) {
    const legacy =
      WORKED_STATUSES.includes(editRecord.status) &&
      editRecord.selected_slots == null;
    const login = hhmm(editRecord.login_time) || shiftFor(editRecord.date).startHHMM;
    const logout = hhmm(editRecord.logout_time) || shiftFor(editRecord.date).endHHMM;
    const checked = {};
    if (Array.isArray(editRecord.selected_slots)) {
      buildSlots(login, logout, editRecord.date).forEach((s) => {
        checked[s.hour] = editRecord.selected_slots.includes(s.hour);
      });
    }
    return {
      date: editRecord.date,
      status: editRecord.status,
      loginTime: login,
      logoutTime: logout,
      checked,
      legacy, // legacy rows: no slot data, so nothing is pre-checked
      otOverride: editRecord.ot_manually_edited
        ? String(Number(editRecord.approved_ot_hours))
        : null,
      remarks: editRecord.remarks || "",
    };
  }
  const date = presetDate || todayISO();
  return {
    date,
    status: "PRESENT",
    loginTime: shiftFor(date).startHHMM,
    logoutTime: shiftFor(date).endHHMM,
    checked: {},
    legacy: false,
    otOverride: null,
    remarks: "",
  };
}

/** An overnight session is entered once and split by the server into two calendar days. */
function buildOvernightPreview(startDate, startTime, endDate, endTime) {
  if (!startDate || !endDate || !startTime || !endTime) {
    return [];
  }

  if (endDate !== addDays(startDate, 1)) {
    return [];
  }

  const startMin = toMin(startTime);
  const endMin = toMin(endTime);

  if (startMin === null || endMin === null) {
    return [];
  }

  const duration = 1440 - startMin + endMin;

  if (duration <= 0 || duration > 1440) {
    return [];
  }

  const firstDaySlots = buildSlots(startTime, "24:00", startDate).map(
    (slot) => ({
      ...slot,
      dateISO: startDate,
    }),
  );

  const secondDaySlots = buildSlots("00:00", endTime, endDate).map((slot) => ({
    ...slot,
    dateISO: endDate,
  }));

  return [...firstDaySlots, ...secondDaySlots];
}

/** Display AM/PM while keeping HH:mm (24-hour) values for the Django API. */
function Time12Picker({ value, onChange, label }) {
  const [rawHour = "09", rawMinute = "00"] = String(value || "09:00").split(
    ":",
  );
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? "PM" : "AM";
  const change = (hour, min, ampm) => {
    const converted = (Number(hour) % 12) + (ampm === "PM" ? 12 : 0);
    onChange(`${pad2(converted)}:${pad2(min)}`);
  };
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}
    >
      <select
        className="aw-select"
        style={{ flex: 1, minWidth: 0 }}
        aria-label={`${label} hour`}
        value={hour12}
        onChange={(e) => change(e.target.value, minute, period)}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {pad2(h)}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        className="aw-select"
        style={{ flex: 1, minWidth: 0 }}
        aria-label={`${label} minute`}
        value={minute}
        onChange={(e) => change(hour12, e.target.value, period)}
      >
        {Array.from({ length: 60 }, (_, i) => i).map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
      <select
        className="aw-select"
        style={{ flex: 1, minWidth: 0 }}
        aria-label={`${label} AM/PM`}
        value={period}
        onChange={(e) => change(hour12, minute, e.target.value)}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

function OvernightAttendanceModal({ employee, presetDate, onClose, onSaved }) {
  const { createOvernightAttendance } = useAttendance();
  const [startDate, setStartDate] = useState(presetDate || todayISO());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("06:00");
  const [status, setStatus] = useState("PRESENT");
  const [checked, setChecked] = useState({});
  const [otByDate, setOtByDate] = useState({});
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const endDate = startDate ? addDays(startDate, 1) : "";
  const slots = useMemo(
    () => buildOvernightPreview(startDate, startTime, endDate, endTime),
    [startDate, startTime, endDate, endTime],
  );
  const keyFor = (slot) => `${slot.dateISO}:${slot.hour}`;
  const isChecked = (slot) =>
    Object.prototype.hasOwnProperty.call(checked, keyFor(slot))
      ? checked[keyFor(slot)]
      : !slot.isLunch;
  const perDate = useMemo(() => {
    const output = {};
    [startDate, endDate].forEach((date) => {
      const daySlots = slots.filter((slot) => slot.dateISO === date);
      const selectedHours = new Set(daySlots.filter(isChecked).map((slot) => slot.hour));
      const calculated = calcHours(daySlots, (hour) => selectedHours.has(hour), date);
      output[date] = calculated;
    });
    return output;
    // checked is replaced immutably on each toggle
  }, [slots, checked, startDate, endDate]);
  const usesTime = WORKED_STATUSES.includes(status);
  const startMinutes = toMin(startTime);
  const endMinutes = toMin(endTime);
  const duration = startMinutes === null || endMinutes === null ? NaN : 1440 - startMinutes + endMinutes;

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!startDate || !endDate) return setError("Select the starting date.");
    if (usesTime && (!slots.length || duration <= 0 || duration > 1440))
      return setError("Choose a valid overnight interval of at most 24 hours.");
    if (usesTime && !slots.some(isChecked))
      return setError("Select at least one worked slot.");
    const approved = {};
    for (const date of [startDate, endDate]) {
      const suggestion = perDate[date]?.suggestedOT || 0;
      const value =
        otByDate[date] === undefined ? suggestion : Number(otByDate[date]);
      if (!Number.isFinite(value) || value < 0 || value > suggestion + 0.0001)
        return setError(
          `Approved OT for ${formatDisplayDate(date)} must be between 0 and ${fmt2(suggestion)}.`,
        );
      approved[date] = round2(value);
    }
    const selected = {};
    [startDate, endDate].forEach((date) => {
      selected[date] = usesTime
        ? slots
            .filter((slot) => slot.dateISO === date && isChecked(slot))
            .map((slot) => slot.hour)
        : [];
    });
    const payload = {
      attendance_mode: "DATE_TO_DATE",
      employee: employee.id,
      status,
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      end_time: endTime,
      selected_slots_by_date: selected,
      approved_ot_by_date: approved,
      remarks,
    };
    setSaving(true);
    try {
      await createOvernightAttendance(payload);
      onSaved?.({
        edited: false,
        date: startDate,
        employeeLabel: `${employee.employee_id} – ${employee.employee_name}`,
      });
    } catch (err) {
      setError(
        extractError(
          err,
          "Could not save overnight attendance. Check the attendance API response.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="aw-modal-overlay" onClick={saving ? undefined : onClose}>
      <div
        className="aw-modal aw-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Date to date attendance"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aw-modal-head">
          <h3>Date to Date Attendance</h3>
          <button
            type="button"
            className="aw-icon-btn"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form className="aw-form" onSubmit={save}>
          <div className="aw-employee-chip">
            <div>
              <span className="aw-field-label">Employee</span>
              <div className="aw-employee-chip-name">
                {employee.employee_id} – {employee.employee_name}
              </div>
            </div>
          </div>
          <div className="aw-alert aw-alert-info">
            One continuous overnight shift. Hours are split between the two
            actual calendar dates for summaries and payroll. The end date is
            automatically the next day.
          </div>
          {error && (
            <div className="aw-alert aw-alert-error" role="alert">
              {error}
            </div>
          )}
          <div className="aw-form-grid">
            <label className="aw-field">
              <span className="aw-field-label">Start Date</span>
              <input
                className="aw-input"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setChecked({});
                  setOtByDate({});
                }}
                required
              />
            </label>
            <label className="aw-field">
              <span className="aw-field-label">End Date (next day)</span>
              <input
                className="aw-input"
                type="date"
                value={endDate}
                readOnly
              />
            </label>
            <label className="aw-field">
              <span className="aw-field-label">Attendance Status</span>
              <select
                className="aw-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            {usesTime && (
              <>
                <label className="aw-field">
                  <span className="aw-field-label">Start Time</span>
                  <Time12Picker
                    label="Start Time"
                    value={startTime}
                    onChange={(v) => {
                      setStartTime(v);
                      setChecked({});
                      setOtByDate({});
                    }}
                  />
                </label>
                <label className="aw-field">
                  <span className="aw-field-label">End Time (next day)</span>
                  <Time12Picker
                    label="End Time"
                    value={endTime}
                    onChange={(v) => {
                      setEndTime(v);
                      setChecked({});
                      setOtByDate({});
                    }}
                  />
                </label>
              </>
            )}
          </div>
          {usesTime && (
            <div className="aw-panel aw-slot-panel">
              <div className="aw-slot-head">
                <div>
                  <h4>Hourly Breakup by Date</h4>
                  <p className="aw-hint">
                    Select actual worked hours. Sunday has no lunch;
                    Monday–Saturday lunch is optional.
                  </p>
                </div>
                <div className="aw-slot-bulk">
                  <button
                    className="aw-link-btn"
                    type="button"
                    onClick={() =>
                      setChecked(
                        Object.fromEntries(
                          slots.map((slot) => [keyFor(slot), true]),
                        ),
                      )
                    }
                  >
                    Tick all
                  </button>
                  <button
                    className="aw-link-btn"
                    type="button"
                    onClick={() =>
                      setChecked(
                        Object.fromEntries(
                          slots.map((slot) => [keyFor(slot), false]),
                        ),
                      )
                    }
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="aw-table-wrap">
                <table className="aw-table aw-slot-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time Slot</th>
                      <th className="aw-center">Worked</th>
                      <th className="aw-center">Type</th>
                      <th className="aw-num">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr
                        key={keyFor(slot)}
                        className={slot.isLunch ? "aw-slot-lunch" : ""}
                      >
                        <td>{formatDisplayDate(slot.dateISO)}</td>
                        <td>
                          {slot.label}
                          {slot.partial && (
                            <span className="aw-hint"> (partial)</span>
                          )}
                        </td>
                        <td className="aw-center">
                          <input
                            className="aw-checkbox"
                            type="checkbox"
                            checked={isChecked(slot)}
                            disabled={saving}
                            onChange={() =>
                              setChecked((prev) => ({
                                ...prev,
                                [keyFor(slot)]: !isChecked(slot),
                              }))
                            }
                          />
                        </td>
                        <td className="aw-center">
                          {slot.isLunch
                            ? "Lunch"
                            : slot.otMin > 0
                              ? "OT"
                              : "Normal"}
                        </td>
                        <td className="aw-num">
                          {isChecked(slot) ? fmt2(slot.paidMin / 60) : "0.00"}{" "}
                          hr
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {usesTime && (
            <div className="aw-panel" style={{ padding: 16 }}>
              <h4>Daily Hours Preview</h4>
              <div className="aw-table-wrap">
                <table className="aw-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Normal</th>
                      <th>Suggested OT</th>
                      <th>Approved OT</th>
                      <th>Total Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[startDate, endDate].map((date) => (
                      <tr key={date}>
                        <td>{formatDisplayDate(date)}</td>
                        <td>{fmt2(perDate[date]?.normal)}</td>
                        <td>{fmt2(perDate[date]?.suggestedOT)}</td>
                        <td>
                          <input
                            className="aw-input"
                            type="number"
                            min="0"
                            step="0.25"
                            style={{ maxWidth: 110 }}
                            value={
                              otByDate[date] ?? fmt2(perDate[date]?.suggestedOT)
                            }
                            onChange={(e) =>
                              setOtByDate((prev) => ({
                                ...prev,
                                [date]: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td>
                          {fmt2(
                            (perDate[date]?.normal || 0) +
                              Number(
                                otByDate[date] ??
                                  perDate[date]?.suggestedOT ??
                                  0,
                              ),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <label className="aw-field" style={{ marginTop: 14 }}>
            <span className="aw-field-label">Remarks</span>
            <input
              className="aw-input"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="aw-modal-actions">
            <button
              className="aw-btn-outline"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="aw-btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Date to Date Attendance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttendanceModeModal(props) {
  const [mode, setMode] = useState("SINGLE_DATE");
  if (props.editRecord) return <AttendanceFormModal {...props} />;
  return (
    <>
      {mode === "SINGLE_DATE" ? (
        <AttendanceFormModal
          {...props}
          modeSwitcher={
            <button
              type="button"
              className="aw-btn-outline aw-btn-sm"
              onClick={() => setMode("DATE_TO_DATE")}
            >
              Switch to Date to Date
            </button>
          }
        />
      ) : (
        <OvernightAttendanceModal {...props} />
      )}
    </>
  );
}

function AttendanceFormModal({
  employee,
  editRecord,
  presetDate,
  onClose,
  onSaved,
  modeSwitcher,
}) {
  const { createAttendance, updateAttendance } = useAttendance();

  const [form, setForm] = useState(() => initForm(editRecord, presetDate));
  const [timesTouched, setTimesTouched] = useState(!!editRecord);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [duplicateMsg, setDuplicateMsg] = useState("");

  const usesTime = !!STATUS_META[form.status]?.requiresTime;
  const shift = shiftFor(form.date);

  const slots = useMemo(
    () =>
      usesTime ? buildSlots(form.loginTime, form.logoutTime, form.date) : [],
    [usesTime, form.loginTime, form.logoutTime, form.date],
  );

  const isChecked = useCallback(
    (hour) => (hour in form.checked ? form.checked[hour] : !form.legacy && !(hour === LUNCH_HOUR && !shift.isSunday)),
    [form.checked, form.legacy, shift.isSunday],
  );

  const calc = useMemo(() => calcHours(slots, isChecked, form.date), [slots, isChecked, form.date]);
  const timeError = usesTime
    ? validateTimes(form.loginTime, form.logoutTime)
    : "";

  // ---- OT: suggested vs HR-approved --------------------------------------
  const otOverridden = form.otOverride !== null;
  const otNumber = otOverridden ? Number(form.otOverride) : calc.suggestedOT;
  let otError = "";
  if (usesTime && otOverridden) {
    if (form.otOverride === "" || Number.isNaN(otNumber)) {
      otError = "Enter a valid number of hours.";
    } else if (otNumber < 0) {
      otError = "Approved OT cannot be negative.";
    } else if (otNumber - calc.suggestedOT > 0.0001) {
      otError = `Approved OT cannot exceed the suggested ${fmt2(calc.suggestedOT)} hrs.`;
    }
  }
  const approvedOT = usesTime && !otError ? round2(otNumber) : 0;
  const totalApproved = usesTime ? round2(calc.normal + approvedOT) : 0;
  const suggestedChanged =
    otOverridden && !otError && Math.abs(otNumber - calc.suggestedOT) > 0.0001;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setDate(value) {
    setForm((prev) => ({
      ...prev,
      date: value,
      // Untouched times follow the date-specific Sunday / weekday shift.
      loginTime: !timesTouched && value ? shiftFor(value).startHHMM : prev.loginTime,
      logoutTime: !timesTouched && value ? shiftFor(value).endHHMM : prev.logoutTime,
      checked: {},
      otOverride: null,
    }));
  }

  function setTime(field, value) {
    setTimesTouched(true);
    set(field, value);
  }

  function toggleSlot(hour) {
    setForm((prev) => {
      const current = hour in prev.checked ? prev.checked[hour] : !prev.legacy && !(hour === LUNCH_HOUR && !shift.isSunday);
      return { ...prev, checked: { ...prev.checked, [hour]: !current } };
    });
  }

  function setAllSlots(value) {
    setForm((prev) => {
      const next = { ...prev.checked };
      slots.forEach((s) => {
        next[s.hour] = value;
      });
      return { ...prev, checked: next };
    });
  }

  function validate() {
    const next = {};
    if (!form.date) next.date = "Date is required.";
    if (usesTime) {
      if (!form.loginTime) next.loginTime = "In time is required.";
      if (!form.logoutTime) next.logoutTime = "Out time is required.";
      if (timeError) next.logoutTime = timeError;
      else if (form.loginTime && form.logoutTime && calc.slotCount === 0) {
        next.slots = "Select at least one hourly slot.";
      }
      if (otError) next.ot = otError;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    setSaveError("");
    setDuplicateMsg("");

    try {
      const payload = {
        employee: employee.id,
        date: form.date,
        status: form.status,
        login_time: usesTime ? form.loginTime : null,
        logout_time: usesTime ? form.logoutTime : null,
        selected_slots: usesTime
          ? slots
              .filter((s) => isChecked(s.hour))
              .map((s) => s.hour)
          : [],
        // null => backend keeps approved OT equal to the suggested OT.
        approved_ot_hours: usesTime && otOverridden ? round2(otNumber) : null,
        remarks: form.remarks || "",
      };

      if (editRecord) {
        await updateAttendance(editRecord.id, payload);
      } else {
        await createAttendance(payload);
      }
      // Reached only when the backend confirmed the write.
      onSaved?.({
        edited: !!editRecord,
        date: form.date,
        employeeLabel: `${employee.employee_id} – ${employee.employee_name}`,
      });
    } catch (err) {
      if (err?.response?.status === 409) {
        setDuplicateMsg(
          "Attendance already exists for this employee and date.",
        );
      } else {
        setSaveError(extractError(err, "Failed to save attendance."));
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  return (
    <div className="aw-modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="aw-modal aw-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editRecord ? "Edit attendance" : "Add attendance"}
      >
        <div className="aw-modal-head">
          <div>
            <h3>{editRecord ? "Edit Attendance" : "Single Date Attendance"}</h3>
            {modeSwitcher}
          </div>
          <button
            className="aw-icon-btn"
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        {saveError && (
          <div className="aw-alert aw-alert-error" role="alert">
            {saveError}
          </div>
        )}
        {duplicateMsg && (
          <div className="aw-alert aw-alert-warning" role="alert">
            {duplicateMsg}
          </div>
        )}
        {editRecord && form.legacy && (
          <div className="aw-alert aw-alert-info">
            This record was saved before hourly slots existed, so no slots are
            pre-selected. Tick the slots that were actually worked, then save.
          </div>
        )}

        <form className="aw-form" onSubmit={handleSubmit} noValidate>
          <div className="aw-employee-chip">
            <div>
              <span className="aw-field-label">Employee</span>
              <div className="aw-employee-chip-name">
                {employee.employee_id} – {employee.employee_name}
              </div>
            </div>
            <span className="aw-mini-pill">{employee.department || "—"}</span>
          </div>

          <div className="aw-form-grid">
            <label className="aw-field">
              <span className="aw-field-label">
                Attendance Date<span className="aw-required">*</span>
              </span>
              <input
                className="aw-input"
                type="date"
                value={form.date}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <span className="aw-error">{errors.date}</span>}
              {form.date && (
                <span className="aw-hint">
                  {parseISO(form.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                  })}
                  {shift.isSunday ? " — Sunday shift applies" : ""}
                </span>
              )}
            </label>

            <label className="aw-field">
              <span className="aw-field-label">
                Attendance Status<span className="aw-required">*</span>
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

            {usesTime && (
              <>
                <label className="aw-field">
                  <span className="aw-field-label">
                    In Time<span className="aw-required">*</span>
                  </span>
                  <Time12Picker
                    label="In Time"
                    value={form.loginTime}
                    onChange={(value) => setTime("loginTime", value)}
                  />
                  {errors.loginTime && (
                    <span className="aw-error">{errors.loginTime}</span>
                  )}
                </label>

                <label className="aw-field">
                  <span className="aw-field-label">
                    Out Time<span className="aw-required">*</span>
                  </span>
                  <Time12Picker
                    label="Out Time"
                    value={form.logoutTime}
                    onChange={(value) => setTime("logoutTime", value)}
                  />
                  {errors.logoutTime && (
                    <span className="aw-error">{errors.logoutTime}</span>
                  )}
                </label>
              </>
            )}
          </div>

          {!usesTime && (
            <div className="aw-alert aw-alert-info">
              No working times are needed for {statusLabel(form.status)}. Normal
              and OT hours are saved as 0.
            </div>
          )}

          {usesTime && (
            <div className="aw-panel aw-slot-panel">
              <div className="aw-slot-head">
                <div>
                  <h4>Hourly Breakup</h4>
                  <p className="aw-hint">
                    {shift.title}: {shift.window} ·{" "}
                    {shift.isSunday ? "No lunch" : "Lunch 1:00 PM – 2:00 PM (selectable)"} ·
                    Max {shift.maxNormal} normal hours. Only ticked slots are
                    counted.
                  </p>
                </div>
                {slots.length > 0 && (
                  <div className="aw-slot-bulk">
                    <button
                      type="button"
                      className="aw-link-btn"
                      onClick={() => setAllSlots(true)}
                    >
                      Tick all
                    </button>
                    <button
                      type="button"
                      className="aw-link-btn"
                      onClick={() => setAllSlots(false)}
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {slots.length === 0 ? (
                <p className="aw-hint">
                  Enter a valid In Time and Out Time to generate hourly slots.
                </p>
              ) : (
                <div className="aw-table-wrap">
                  <table className="aw-table aw-slot-table">
                    <thead>
                      <tr>
                        <th>Time Slot</th>
                        <th className="aw-center">Worked</th>
                        <th className="aw-center">Type</th>
                        <th className="aw-num">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((s) => {
                        const checked = isChecked(s.hour);
                        const type = s.isLunch
                          ? "Lunch"
                          : s.otMin > 0
                            ? "OT"
                            : "Normal";
                        return (
                          <tr
                            key={s.hour}
                            className={s.isLunch ? "aw-slot-lunch" : ""}
                          >
                            <td>
                              {s.label}
                              {s.partial && (
                                <span className="aw-hint aw-hint-inline">
                                  {" "}
                                  (partial)
                                </span>
                              )}
                            </td>
                            <td className="aw-center">
                              <input
                                type="checkbox"
                                className="aw-checkbox"
                                checked={checked}
                                disabled={saving}
                                onChange={() => toggleSlot(s.hour)}
                                aria-label={`Worked ${s.label}`}
                              />
                            </td>
                            <td className="aw-center">
                              <span
                                className={`aw-slot-type aw-slot-type-${type.toLowerCase()}`}
                              >
                                {type}
                              </span>
                            </td>
                            <td className="aw-num">
                              {checked ? `${fmt2(s.paidMin / 60)} hr` : "0 hr"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {errors.slots && <span className="aw-error">{errors.slots}</span>}
            </div>
          )}

          {usesTime && (
            <div className="aw-hours-grid">
              <div className="aw-hours-box">
                <span className="aw-summary-label">Normal Working Hours</span>
                <strong>{fmt2(calc.normal)} hrs</strong>
              </div>
              <div className="aw-hours-box">
                <span className="aw-summary-label">Suggested OT Hours</span>
                <strong>{fmt2(calc.suggestedOT)} hrs</strong>
              </div>
              <div className="aw-hours-box aw-hours-box-edit">
                <label className="aw-field">
                  <span className="aw-summary-label">Approved OT Hours</span>
                  <input
                    className="aw-input"
                    type="number"
                    min="0"
                    step="0.25"
                    value={
                      otOverridden ? form.otOverride : fmt2(calc.suggestedOT)
                    }
                    onChange={(e) => set("otOverride", e.target.value)}
                    aria-invalid={!!otError}
                  />
                </label>
                <button
                  type="button"
                  className="aw-link-btn"
                  onClick={() => set("otOverride", null)}
                  disabled={!otOverridden}
                >
                  Reset to Suggested
                </button>
              </div>
              <div className="aw-hours-box aw-hours-box-total">
                <span className="aw-summary-label">Total Approved Hours</span>
                <strong>{fmt2(totalApproved)} hrs</strong>
              </div>
            </div>
          )}
          {errors.ot && <span className="aw-error">{errors.ot}</span>}
          {!errors.ot && otError && <span className="aw-error">{otError}</span>}
          {suggestedChanged && (
            <p className="aw-hint">
              Your approved OT ({fmt2(otNumber)} hrs) is kept. Suggested OT is
              now {fmt2(calc.suggestedOT)} hrs — use “Reset to Suggested” to
              follow it again.
            </p>
          )}

          <label className="aw-field" style={{ marginTop: 14 }}>
            <span className="aw-field-label">Remarks</span>
            <input
              className="aw-input"
              type="text"
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Optional"
            />
          </label>

          <div className="aw-modal-actions">
            <button
              type="button"
              className="aw-btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="aw-btn-primary" disabled={saving}>
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
   PAGE 1 — ADD ATTENDANCE
   ========================================================================== */

function AddAttendanceTab({ refreshKey, onAdd, onEdit }) {
  const { getDailyRoster } = useAttendance();

  const [date, setDate] = useState(todayISO());
  const [searchInput, setSearchInput] = useState("");
  const [department, setDepartment] = useState("");
  const [pageSize, setPageSize] = useState(25);

  const search = useDebounce(searchInput, 400);
  const [page, setPage] = usePageForSignature(
    JSON.stringify([date, search, department, pageSize]),
  );

  const fetcher = useCallback(
    () =>
      getDailyRoster({
        date,
        search,
        department,
        page,
        page_size: pageSize,
      }),
    [getDailyRoster, date, search, department, page, pageSize],
  );

  const { data, loading, refreshing, error, retry } = useRefreshableQuery(
    fetcher,
    refreshKey,
    "Failed to load employees and attendance.",
  );

  const rows = data?.results || [];
  const count = data?.count || 0;
  const marked = data?.marked_count || 0;
  const shift = shiftFor(date);

  return (
    <div className="aw-tab">
      <div className="aw-summary-grid aw-summary-grid-tight">
        <SummaryCard label="Employees" value={loading && !data ? "…" : count} />
        <SummaryCard label="Marked" value={loading && !data ? "…" : marked} />
        <SummaryCard
          label="Not Marked"
          value={loading && !data ? "…" : Math.max(0, count - marked)}
        />
      </div>

      <div className="aw-toolbar">
        <label className="aw-field aw-field-inline">
          <span className="aw-field-label">Attendance Date</span>
          <input
            className="aw-input"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <div className="aw-shift-note">
          <strong>{shift.title}</strong>
          <span>
            {shift.window} · {shift.isSunday ? "No lunch" : "Lunch 1–2 PM (selectable)"} · Max {shift.maxNormal} normal hrs
          </span>
        </div>
      </div>

      <EmployeeFilterBar
        search={searchInput}
        onSearch={setSearchInput}
        department={department}
        onDepartment={setDepartment}
        onClear={() => {
          setSearchInput("");
          setDepartment("");
        }}
      />

      <RefreshIndicator show={refreshing} />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loading />
        </div>
      ) : (
        <>
          {error && <QueryError error={error} onRetry={retry} stale={!!data} />}
          {(!error || data) && (
            <>
              <div className="aw-table-wrap">
                <table className="aw-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th className="aw-num">Normal Hours</th>
                      <th className="aw-num">OT Hours</th>
                      <th className="aw-num">Total Hours</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="aw-empty-row">
                          No employees found for this filter.
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => {
                      const rec = row.attendance;
                      return (
                        <tr key={row.id}>
                          <td>{row.employee_id}</td>
                          <td>{row.employee_name || "—"}</td>
                          <td>{row.department || "—"}</td>
                          <td>
                            <StatusPill
                              status={rec ? rec.status : "NOT_MARKED"}
                            />
                          </td>
                          <td className="aw-num">
                            {rec ? fmt2(rec.normal_hours) : "—"}
                          </td>
                          <td className="aw-num">
                            {rec ? fmt2(rec.approved_ot_hours) : "—"}
                          </td>
                          <td className="aw-num">
                            {rec ? fmt2(rec.total_hours) : "—"}
                          </td>
                          <td className="aw-row-actions">
                            {rec ? (
                              <button
                                type="button"
                                className="aw-link-btn"
                                onClick={() => onEdit(row, rec)}
                              >
                                Edit Attendance
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="aw-btn-primary aw-btn-sm"
                                onClick={() => onAdd(row, date)}
                              >
                                + Add Attendance
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={data?.page || page}
                totalPages={data?.total_pages || 1}
                count={count}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   EMPLOYEE DETAIL MODAL  (daily breakdown for the selected period)
   ========================================================================== */

function EmployeeHoursDetailModal({ target, onClose }) {
  const { getEmployeeHoursDetail } = useAttendance();
  const [hideUnmarked, setHideUnmarked] = useState(false);

  // `target` is a snapshot taken when the row was opened, so the employee id
  // and the date range always match what the summary table was showing.
  const fetcher = useCallback(
    () =>
      getEmployeeHoursDetail({
        employee: target.employee.id,
        ...target.params,
      }),
    [getEmployeeHoursDetail, target],
  );

  const { data, loading, error, retry } = useRefreshableQuery(
    fetcher,
    0,
    "Failed to load employee attendance details.",
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = data?.days || [];
  const visibleDays = hideUnmarked ? days.filter((d) => d.is_marked) : days;
  const summary = data?.summary;
  const emp = data?.employee || target.employee;

  return (
    <div className="aw-modal-overlay" onClick={onClose}>
      <div
        className="aw-modal aw-modal-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Employee attendance details"
      >
        <div className="aw-modal-head">
          <div>
            <h3>
              {emp.employee_id} – {emp.employee_name}
            </h3>
            <span className="aw-hint">
              {emp.department || "—"} · {target.label}
            </span>
          </div>
          <button
            className="aw-icon-btn"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Loading />
          </div>
        ) : error ? (
          <QueryError error={error} onRetry={retry} stale={false} />
        ) : (
          <>
            <div className="aw-summary-grid aw-summary-grid-tight">
              <SummaryCard
                label="Days Worked"
                value={summary?.days_worked ?? 0}
              />
              <SummaryCard
                label="Normal Hours"
                value={fmt2(summary?.normal_hours)}
              />
              <SummaryCard label="OT Hours" value={fmt2(summary?.ot_hours)} />
              <SummaryCard
                label="Total Hours"
                value={fmt2(summary?.total_hours)}
              />
              <SummaryCard
                label="Not Marked Days"
                value={summary?.missing_days ?? 0}
              />
            </div>

            <label className="aw-toggle">
              <input
                type="checkbox"
                className="aw-checkbox"
                checked={hideUnmarked}
                onChange={(e) => setHideUnmarked(e.target.checked)}
              />
              <span>Hide Not Marked days</span>
            </label>

            <div className="aw-table-wrap aw-detail-scroll">
              <table className="aw-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th className="aw-num">Normal Hours</th>
                    <th className="aw-num">OT Hours</th>
                    <th className="aw-num">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDays.length === 0 && (
                    <tr>
                      <td colSpan={8} className="aw-empty-row">
                        No dates to show for this period.
                      </td>
                    </tr>
                  )}
                  {visibleDays.map((d) => (
                    <tr
                      key={d.date}
                      className={d.day_name === "Sun" ? "aw-row-sunday" : ""}
                    >
                      <td>{formatDisplayDate(d.date)}</td>
                      <td>{d.day_name}</td>
                      <td>
                        <StatusPill status={d.status} />
                      </td>
                      <td>{d.login_time || "—"}</td>
                      <td>{d.logout_time || "—"}</td>
                      <td className="aw-num">
                        {d.is_marked ? fmt2(d.normal_hours) : "—"}
                      </td>
                      <td className="aw-num">
                        {d.is_marked ? fmt2(d.ot_hours) : "—"}
                      </td>
                      <td className="aw-num">
                        {d.is_marked ? fmt2(d.total_hours) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="aw-hint" style={{ marginTop: 10 }}>
              Not Marked days have no saved record and are never counted as
              worked. Saved Absent / Leave records show 0.00 hours.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   PAGE 2 — EMPLOYEE SUMMARY  (weekly / monthly / yearly)
   ========================================================================== */

const EMPTY_SUMMARY = {
  label: "",
  totals: {
    total_employees: 0,
    employees_marked: 0,
    total_normal_hours: 0,
    total_ot_hours: 0,
    total_hours: 0,
  },
  count: 0,
  total_pages: 1,
  results: [],
};

const PERIOD_MODES = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

function EmployeeSummaryTab({ refreshKey }) {
  const { getHoursSummary } = useAttendance();

  const now = new Date();
  const [mode, setMode] = useState("monthly");
  const [weekDate, setWeekDate] = useState(todayISO());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [year, setYear] = useState(now.getFullYear());

  const [searchInput, setSearchInput] = useState("");
  const [department, setDepartment] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [detailTarget, setDetailTarget] = useState(null);

  const search = useDebounce(searchInput, 400);

  const yearOptions = useMemo(() => {
    const out = [];
    for (let y = now.getFullYear() + 1; y >= FIRST_YEAR; y--) out.push(y);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodParams = useMemo(() => {
    if (mode === "weekly") return { period: "weekly", date: weekDate };
    if (mode === "monthly")
      return { period: "monthly", month: `${monthYear}-${pad2(month)}` };
    return { period: "yearly", year: String(year) };
  }, [mode, weekDate, month, monthYear, year]);

  const [page, setPage] = usePageForSignature(
    JSON.stringify([periodParams, search, department, pageSize]),
  );

  const fetcher = useCallback(
    () =>
      getHoursSummary({
        ...periodParams,
        search,
        department,
        page,
        page_size: pageSize,
      }),
    [getHoursSummary, periodParams, search, department, page, pageSize],
  );

  const { data, loading, refreshing, error, retry } = useRefreshableQuery(
    fetcher,
    refreshKey,
    "Failed to load employee summary.",
  );

  const view = data || EMPTY_SUMMARY;
  const rows = view.results || [];
  const totals = view.totals || EMPTY_SUMMARY.totals;
  const waiting = loading && !data;
  const card = (v) => (waiting ? "…" : v);

  const weekLabel = `${formatDisplayDate(startOfWeek(weekDate))} – ${formatDisplayDate(
    endOfWeek(weekDate),
  )}`;

  function openDetail(row) {
    setDetailTarget({
      employee: row,
      params: { ...periodParams },
      label: view.label || "",
    });
  }

  return (
    <div className="aw-tab">
      {/* ---- period mode + selectors ---- */}
      <div className="aw-toolbar aw-period-bar">
        <div className="aw-field">
          <span className="aw-field-label">Period</span>
          <div
            className="aw-segmented"
            role="tablist"
            aria-label="Summary period"
          >
            {PERIOD_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                className={`aw-segmented-btn ${
                  mode === m.key ? "aw-segmented-btn-active" : ""
                }`}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "weekly" && (
          <>
            <div className="aw-field">
              <span className="aw-field-label">Week (Mon – Sun)</span>
              <div className="aw-week-picker">
                <button
                  type="button"
                  className="aw-btn-outline aw-btn-sm"
                  onClick={() => setWeekDate(addDays(weekDate, -7))}
                  aria-label="Previous week"
                >
                  ‹
                </button>
                <input
                  className="aw-input"
                  type="date"
                  value={weekDate}
                  onChange={(e) =>
                    e.target.value && setWeekDate(e.target.value)
                  }
                  aria-label="Any date within the week"
                />
                <button
                  type="button"
                  className="aw-btn-outline aw-btn-sm"
                  onClick={() => setWeekDate(addDays(weekDate, 7))}
                  aria-label="Next week"
                >
                  ›
                </button>
                <button
                  type="button"
                  className="aw-btn-outline aw-btn-sm"
                  onClick={() => setWeekDate(todayISO())}
                >
                  This Week
                </button>
              </div>
            </div>
            <span className="aw-period-label">{weekLabel}</span>
          </>
        )}

        {mode === "monthly" && (
          <>
            <label className="aw-field aw-field-inline">
              <span className="aw-field-label">Month</span>
              <select
                className="aw-select"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="aw-field aw-field-inline">
              <span className="aw-field-label">Year</span>
              <select
                className="aw-select"
                value={monthYear}
                onChange={(e) => setMonthYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {mode === "yearly" && (
          <label className="aw-field aw-field-inline">
            <span className="aw-field-label">Year</span>
            <select
              className="aw-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <EmployeeFilterBar
        search={searchInput}
        onSearch={setSearchInput}
        department={department}
        onDepartment={setDepartment}
        onClear={() => {
          setSearchInput("");
          setDepartment("");
        }}
      />

      {/* ---- company-wide cards for the selected period ---- */}
      <div className="aw-summary-grid">
        <SummaryCard
          label="Total Employees"
          value={card(totals.total_employees)}
          sub={view.label || undefined}
        />
        <SummaryCard
          label="Attendance Marked"
          value={card(totals.employees_marked)}
          sub="employees with records"
        />
        <SummaryCard
          label="Total Normal Hours"
          value={card(fmt2(totals.total_normal_hours))}
        />
        <SummaryCard
          label="Total Approved OT"
          value={card(fmt2(totals.total_ot_hours))}
        />
        <SummaryCard
          label="Total Approved Hours"
          value={card(fmt2(totals.total_hours))}
        />
      </div>

      <RefreshIndicator show={refreshing} />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loading />
        </div>
      ) : (
        <>
          {error && <QueryError error={error} onRetry={retry} stale={!!data} />}
          {(!error || data) && (
            <>
              <div className="aw-table-wrap">
                <table className="aw-table aw-summary-centered">
                  <thead>
                    <tr>
                      <th className="aw-left">Employee</th>
                      <th>Days Worked</th>
                      <th>Normal Hours</th>
                      <th>OT Hours</th>
                      <th>Total Hours</th>
                      <th>Missing Days</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="aw-empty-row">
                          No employees match these filters.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="aw-row-click"
                        tabIndex={0}
                        onClick={() => openDetail(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openDetail(r);
                        }}
                      >
                        <td className="aw-left">
                          <div className="aw-emp-cell">
                            <strong>
                              {r.employee_id} – {r.employee_name}
                            </strong>
                            <span className="aw-hint">
                              {r.department || "—"}
                            </span>
                          </div>
                        </td>
                        {r.has_attendance ? (
                          <>
                            <td>{r.days_worked}</td>
                            <td>{fmt2(r.normal_hours)}</td>
                            <td>{fmt2(r.ot_hours)}</td>
                            <td>
                              <strong>{fmt2(r.total_hours)}</strong>
                            </td>
                          </>
                        ) : (
                          <td colSpan={4}>
                            <StatusPill status="NOT_MARKED" />
                          </td>
                        )}
                        <td>
                          {r.missing_days > 0 ? (
                            <span className="aw-missing-pill">
                              {r.missing_days} missing
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="aw-link-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(r);
                            }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="aw-hint">
                Hours are summed from each employee’s own saved records. Missing
                days (no record up to today) are never counted as worked.
              </p>

              <Pagination
                page={view.page || page}
                totalPages={view.total_pages || 1}
                count={view.count || 0}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            </>
          )}
        </>
      )}

      {detailTarget && (
        <EmployeeHoursDetailModal
          target={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   PAGE SHELL — exactly two tabs
   ========================================================================== */

const TABS = [
  { key: "add", label: "Add Attendance" },
  { key: "summary", label: "Employee Summary" },
];

const ATTENDANCE_ACTIVE_TAB_KEY = "hrAttendanceWages.activeTab";

function getSavedAttendanceTab() {
  try {
    const saved = window.localStorage.getItem(ATTENDANCE_ACTIVE_TAB_KEY);
    return TABS.some((tab) => tab.key === saved) ? saved : "add";
  } catch {
    return "add";
  }
}

export default function AttendanceWages() {
  const [activeTab, setActiveTab] = useState(getSavedAttendanceTab);
  // Tabs stay mounted after first visit so their filters and dates persist.
  const [visited, setVisited] = useState(() => ({
    [getSavedAttendanceTab()]: true,
  }));
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  // Bumped ONLY after the backend confirmed a create / update.
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleBack = () => window.history.back();

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function selectTab(key) {
    if (!TABS.some((tab) => tab.key === key)) return;
    setActiveTab(key);
    setVisited((v) => (v[key] ? v : { ...v, [key]: true }));
    try {
      window.localStorage.setItem(ATTENDANCE_ACTIVE_TAB_KEY, key);
    } catch {
      // Tab still works for this session if storage is blocked.
    }
  }

  const openAdd = useCallback((employee, date) => {
    setModal({ employee, editRecord: null, presetDate: date });
  }, []);
  const openEdit = useCallback((employee, record) => {
    setModal({ employee, editRecord: record, presetDate: record.date });
  }, []);
  const closeModal = useCallback(() => setModal(null), []);

  function handleSaved(info) {
    setModal(null);
    bumpRefresh(); // Add Attendance + Employee Summary refetch
    setToast(
      `Attendance ${info.edited ? "updated" : "saved"} for ${info.employeeLabel} on ${formatDisplayDate(info.date)}.`,
    );
  }

  return (
    <>
      <Header
        navLinks={[
          { label: "Employees", path: "/hr/employees" },
          { label: "Attendance", path: "/hr/attendance" },
          { label: "Advance", path: "/hr/salary" },
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
              <h1>HR Attendance</h1>
              <p>
                Record attendance with hourly slots and review employee-wise
                normal and overtime hours.
              </p>
            </div>
          </div>
          <div className="aw-page-header-actions">
            <span className="aw-header-badge">v3.0</span>
          </div>
        </div>

        <div className="aw-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`aw-tab-btn ${
                activeTab === t.key ? "aw-tab-btn-active" : ""
              }`}
              onClick={() => selectTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {visited.add && (
          <div hidden={activeTab !== "add"}>
            <AddAttendanceTab
              refreshKey={refreshKey}
              onAdd={openAdd}
              onEdit={openEdit}
            />
          </div>
        )}
        {visited.summary && (
          <div hidden={activeTab !== "summary"}>
            <EmployeeSummaryTab refreshKey={refreshKey} />
          </div>
        )}

        {modal && (
          <AttendanceModeModal
            employee={modal.employee}
            editRecord={modal.editRecord}
            presetDate={modal.presetDate}
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}

        {toast && (
          <div className="aw-toast" role="status" aria-live="polite">
            <span>✓</span> {toast}
          </div>
        )}
      </div>
    </>
  );
}
