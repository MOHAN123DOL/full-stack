import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/Profile.css";

import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/axios";

import Loading from "./loading.jsx";
import Error from "./error.jsx";

/* =========================================================
   ICONS
========================================================= */

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3,7 12,13 21,7" />
  </svg>
);

const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
    <path d="M10 12v2h4v-2" />
  </svg>
);

const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M8 7h2" /><path d="M14 7h2" />
    <path d="M8 11h2" /><path d="M14 11h2" />
    <path d="M8 15h2" /><path d="M14 15h2" />
    <path d="M10 21v-3h4v3" />
  </svg>
);

const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12,7 12,12 15,14" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 4v5c0 5.5-3.5 8.5-8 9-4.5-.5-8-3.5-8-9V7l8-4z" />
    <polyline points="9,12 11,14 15,10" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <circle cx="12" cy="7" r="0.5" fill="currentColor" />
  </svg>
);

const IconArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12,19 5,12 12,5" />
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 512 512" fill="currentColor">
    <path d="M377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9L512 256 377.9 406.1zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPencil = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,18 9,12 15,6" />
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,6 15,12 9,18" />
  </svg>
);

/* =========================================================
   HELPERS
========================================================= */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad2 = (v) => String(v).padStart(2, "0");

const toDateKey = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;

const parseDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
};

const STATUS_META = {
  PRESENT:     { label: "Present",                    tone: "present" },
  NOT_ENTERED: { label: "Attendance Not Entered",     tone: "pending" },
  HALF_DAY:    { label: "Half Day",                   tone: "pending" },
  ABSENT:      { label: "Absent",                     tone: "leave" },
  LEAVE:       { label: "Leave",                      tone: "leave" },
  HOLIDAY:     { label: "Holiday",                    tone: "off" },
  WEEKLY_OFF:  { label: "Weekly Off",                 tone: "off" },
};

const RAW_STATUS_LABELS = {
  PRESENT: "Present",
  WFH: "Work From Home",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  PAID_LEAVE: "Paid Leave",
  UNPAID_LEAVE: "Unpaid Leave",
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly Off",
};

const normalizeStatus = (raw) => {
  switch (String(raw || "").trim().toUpperCase()) {
    case "PRESENT":
    case "WFH": return "PRESENT";
    case "HALF_DAY": return "HALF_DAY";
    case "ABSENT": return "ABSENT";
    case "PAID_LEAVE":
    case "UNPAID_LEAVE": return "LEAVE";
    case "HOLIDAY": return "HOLIDAY";
    case "WEEKLY_OFF": return "WEEKLY_OFF";
    default: return "NOT_ENTERED";
  }
};

const formatTime = (value) => {
  if (!value) return "-";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "-";
  const h24 = Number(match[1]);
  const m = match[2];
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${pad2(h12)}:${m} ${suffix}`;
};

const formatHours = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} h` : "-";
};

const formatCurrency = (value) => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "-";
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;
};

const formatLongDate = (key) => {
  const { year, month, day } = parseDateKey(key);
  const weekday = WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()];
  return {
    title: `${MONTH_NAMES[month - 1]} ${day}`,
    subtitle: `${weekday}, ${year}`,
  };
};

const getTodayParts = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
};

const getAttendanceErrorMessage = (error) => {
  const status = error?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to view attendance.";
  if (status === 404) return "The attendance service could not be found.";
  if (status >= 500) return "The server had a problem. Please try again shortly.";
  if (!error?.response) return "Network error. Please check your connection.";
  return error.response?.data?.message || "Something went wrong.";
};

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="profile-stat-card">
      <div className={`profile-stat-icon tone-${tone}`}>{icon}</div>
      <div className="profile-stat-content">
        <span className={"profile-stat-value" + (value === "Not available" ? " is-muted" : "")}>
          {value}
        </span>
        <span className="profile-stat-label">{label}</span>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="profile-info-item">
      <div className="profile-info-icon">{icon}</div>
      <div className="profile-info-content">
        <span className="profile-info-label">{label}</span>
        <span className={"profile-info-value" + (value === "Not available" ? " is-muted" : "")}>
          {value}
        </span>
      </div>
    </div>
  );
}

function CircularProgress({ value, max, label, sublabel, muted = false }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const safeMax = max > 0 ? max : 1;
  const progress = Math.min((value / safeMax) * 100, 100);
  const offset = circumference - (progress / 100) * circumference;

  const getColor = () => {
    if (muted) return "#c3ccd4";
    const ratio = value / safeMax;
    if (ratio >= 0.8) return "#2F7A4F";
    if (ratio >= 0.5) return "#C98A1D";
    return "#B23A3A";
  };

  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  const timeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <div className="profile-circular-container">
      <svg className="profile-circular-svg" viewBox="0 0 200 200">
        <circle className="profile-circular-bg" cx="100" cy="100" r={radius} strokeWidth="12" fill="none" />
        <circle
          className="profile-circular-progress"
          cx="100" cy="100" r={radius}
          stroke={getColor()} strokeWidth="12" fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="profile-circular-content">
        <strong>{timeDisplay}</strong>
        <span>{label}</span>
      </div>
      <p className="profile-circular-sublabel">{sublabel}</p>
    </div>
  );
}

function WorkHoursCard({ hoursWorked, targetHours, sublabel, muted = false }) {
  return (
    <div className="profile-card profile-work-card">
      <div className="profile-card-header">
        <div>
          <h3 className="profile-card-title">Work Hours</h3>
          <p className="profile-card-subtitle">Today's attendance</p>
        </div>
        <div className="profile-card-icon clock"><IconClock /></div>
      </div>
      <CircularProgress
        value={hoursWorked}
        max={targetHours}
        label="Worked"
        sublabel={sublabel || `Target ${targetHours}h`}
        muted={muted}
      />
    </div>
  );
}

function AttendanceSummary({ monthLabel, counts, unavailable }) {
  const items = [
    { key: "present", label: "Present", value: counts.present },
    { key: "pending", label: "Not Entered", value: counts.notEntered },
    { key: "leave", label: "Leave / Absent", value: counts.leave },
    { key: "half", label: "Half Day", value: counts.halfDay },
    { key: "off", label: "Holiday / Off", value: counts.off },
  ];

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <section
      id="profile-attendance-summary"
      className="profile-card profile-attendance-summary"
      aria-label={`Attendance summary for ${monthLabel}`}
    >
      <div className="profile-summary-head">
        <h3 className="profile-card-title">Attendance Summary</h3>
        <span className="profile-summary-month">{monthLabel}</span>
      </div>

      <div className="profile-summary-grid">
        {items.map((item) => (
          <div key={item.key} className={`profile-summary-card tone-${item.key}`}>
            <span className="profile-summary-value">{unavailable ? "–" : item.value}</span>
            <span className="profile-summary-label">{item.label}</span>
          </div>
        ))}
      </div>

      <div
        className={"profile-summary-bar" + (unavailable || !total ? " is-empty" : "")}
        role="img"
        aria-label={
          unavailable
            ? "Attendance distribution unavailable"
            : items.map((i) => `${i.label} ${i.value}`).join(", ")
        }
      >
        {!unavailable && total > 0 &&
          items
            .filter((i) => i.value > 0)
            .map((item) => (
              <span
                key={item.key}
                className={`profile-summary-bar-seg tone-${item.key}`}
                style={{ width: `${(item.value / total) * 100}%` }}
                title={`${item.label}: ${item.value}`}
              />
            ))}
      </div>
    </section>
  );
}

function AttendanceCalendarCard({
  year,
  month,
  daysInMonth,
  leadingBlanks,
  getDayInfo,
  selectedDateKey,
  todayKey,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  loading,
  error,
  errorStatus,
  onRetry,
  onSignIn,
  adminMode = false,
  adminDayCounts = null,
}) {
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const cells = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push(<span key={`blank-${i}`} className="profile-cal-blank" />);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const { dateKey, status } = getDayInfo(day);
    const meta = STATUS_META[status];
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDateKey;

    /* ---------- ADMIN MODE: company-wide counts ---------- */
    if (adminMode) {
      const counts = adminDayCounts?.[dateKey];
      const present = counts?.present ?? 0;
      const absent = counts?.absent ?? 0;
      const leave = counts?.leave ?? 0;

      let tone = "pending";
      if (counts) {
        if (absent > 0 && absent >= present) tone = "leave";
        else if (leave > 0 && leave > present) tone = "leave";
        else if (present > 0) tone = "present";
      }

      const tooltip = counts
        ? `${day} ${MONTH_NAMES[month - 1]} ${year}\nPresent: ${present}\nAbsent: ${absent}${leave ? `\nLeave: ${leave}` : ""}`
        : `${day} ${MONTH_NAMES[month - 1]} ${year}\nNo data`;

      const accessibleLabel =
        `${day} ${MONTH_NAMES[month - 1]} ${year}: ${present} present, ${absent} absent` +
        (isToday ? " (today)" : "");

      cells.push(
        <button
          key={dateKey}
          type="button"
          className={
            `profile-cal-day tone-${loading ? "loading" : tone}` +
            (isToday ? " is-today" : "") +
            (isSelected ? " is-selected" : "") +
            " is-admin"
          }
          aria-label={accessibleLabel}
          aria-pressed={isSelected}
          title={tooltip}
          onClick={() => onSelectDate(dateKey)}
        >
          {day}
        </button>,
      );
      continue;
    }

    /* ---------- NORMAL MODE: personal attendance ---------- */
    const accessibleLabel =
      `${day} ${MONTH_NAMES[month - 1]} ${year}: ${meta.label}` +
      (isToday ? " (today)" : "");

    cells.push(
      <button
        key={dateKey}
        type="button"
        className={
          `profile-cal-day tone-${loading ? "loading" : meta.tone}` +
          (isToday ? " is-today" : "") +
          (isSelected ? " is-selected" : "")
        }
        data-status={status}
        aria-label={accessibleLabel}
        aria-pressed={isSelected}
        title={`${meta.label}${isToday ? " • Today" : ""}`}
        onClick={() => onSelectDate(dateKey)}
      >
        {day}
      </button>,
    );
  }

  return (
    <section
      id="profile-attendance-calendar"
      className="profile-calendar-card"
      aria-label="Attendance calendar"
    >
      <div className="profile-calendar-header">
        <h3 className="profile-calendar-title" aria-live="polite">
          {monthLabel}
        </h3>
        <div className="profile-calendar-nav">
          <button
            type="button"
            className="profile-calendar-nav-btn"
            onClick={onPrevMonth}
            aria-label="Previous month"
            title="Previous month"
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="profile-calendar-nav-btn"
            onClick={onNextMonth}
            aria-label="Next month"
            title="Next month"
          >
            <IconChevronRight />
          </button>
        </div>
      </div>

      {error ? (
        <div className="profile-calendar-state is-error" role="alert">
          <strong>Unable to load attendance.</strong>
          <p>{error}</p>
          <div className="profile-calendar-state-actions">
            {errorStatus === 401 ? (
              <button type="button" className="profile-calendar-retry" onClick={onSignIn}>
                Sign in again
              </button>
            ) : (
              <button type="button" className="profile-calendar-retry" onClick={onRetry}>
                Try Again
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="profile-calendar-weekdays" aria-hidden="true">
            {WEEKDAY_HEADERS.map((name) => <span key={name}>{name}</span>)}
          </div>
          <div
            className="profile-calendar-grid"
            aria-busy={loading}
            role="group"
            aria-label={`Days of ${monthLabel}`}
          >
            {cells}
          </div>
          <p className={"profile-calendar-loading" + (loading ? " is-visible" : "")} role="status">
            {loading ? "Loading attendance..." : ""}
          </p>
        </>
      )}

      {adminMode ? (
        <ul className="profile-calendar-legend" aria-label="Legend">
          <li><span className="profile-legend-dot tone-present" />Present</li>
          <li><span className="profile-legend-dot tone-leave" />Absent / Leave</li>
          <li><span className="profile-legend-dot tone-pending" />Not entered</li>
        </ul>
      ) : (
        <ul className="profile-calendar-legend" aria-label="Legend">
          <li><span className="profile-legend-dot tone-present" />Present</li>
          <li><span className="profile-legend-dot tone-pending" />Not Entered</li>
          <li><span className="profile-legend-dot tone-leave" />Leave / Absent</li>
          <li><span className="profile-legend-dot tone-off" />Holiday / Weekly Off</li>
        </ul>
      )}
    </section>
  );
}

function AttendanceDetails({ dateKey, record, status }) {
  const { title, subtitle } = formatLongDate(dateKey);
  const meta = STATUS_META[status];
  const rawStatus = record ? String(record.status || "").trim().toUpperCase() : "";
  const statusLabel = record
    ? RAW_STATUS_LABELS[rawStatus] || rawStatus || meta.label
    : STATUS_META.NOT_ENTERED.label;

  const showTimes = record && (status === "PRESENT" || status === "HALF_DAY");

  const rows = [];
  if (record) {
    if (showTimes) {
      rows.push(["Login", formatTime(record.login_time)]);
      rows.push(["Logout", formatTime(record.logout_time)]);
      rows.push(["Working Hours", formatHours(record.working_hours)]);
      rows.push(["Break", formatHours(record.break_hours)]);
    }
    rows.push(["Daily Wage", formatCurrency(record.daily_wage)]);
    rows.push(["Remarks", record.remarks ? record.remarks : "-"]);
  }

  return (
    <section
      className="profile-day-details"
      aria-label={`Attendance details for ${title}`}
      aria-live="polite"
    >
      <div className="profile-day-details-head">
        <div>
          <h3>{title}</h3>
          <span>{subtitle}</span>
        </div>
        <span className={`profile-status-pill tone-${meta.tone}`}>{statusLabel}</span>
      </div>

      {record ? (
        <dl className="profile-day-details-list">
          {rows.map(([label, value]) => (
            <div key={label} className="profile-day-details-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="profile-day-details-empty">
          Attendance has not been entered for this date.
        </p>
      )}
    </section>
  );
}

function AdminDayDetails({ dateKey, counts }) {
  const { title, subtitle } = formatLongDate(dateKey);

  return (
    <section
      className="profile-day-details"
      aria-label={`Company attendance for ${title}`}
      aria-live="polite"
    >
      <div className="profile-day-details-head">
        <div>
          <h3>{title}</h3>
          <span>{subtitle}</span>
        </div>
        <span className="profile-status-pill tone-present">Company</span>
      </div>

      {counts ? (
        <dl className="profile-day-details-list">
          <div className="profile-day-details-row">
            <dt>Present</dt><dd>{counts.present}</dd>
          </div>
          <div className="profile-day-details-row">
            <dt>Absent</dt><dd>{counts.absent}</dd>
          </div>
          <div className="profile-day-details-row">
            <dt>On Leave</dt><dd>{counts.leave}</dd>
          </div>
          {counts.holiday > 0 && (
            <div className="profile-day-details-row">
              <dt>Holiday</dt><dd>{counts.holiday}</dd>
            </div>
          )}
          {counts.weekly_off > 0 && (
            <div className="profile-day-details-row">
              <dt>Weekly Off</dt><dd>{counts.weekly_off}</dd>
            </div>
          )}
          <div className="profile-day-details-row">
            <dt>Not Marked</dt><dd>{counts.not_marked}</dd>
          </div>
          <div className="profile-day-details-row">
            <dt>Total Active</dt><dd>{counts.total}</dd>
          </div>
        </dl>
      ) : (
        <p className="profile-day-details-empty">
          No company attendance data for this date.
        </p>
      )}
    </section>
  );
}

function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={
        "profile-switch" +
        (checked ? " is-on" : "") +
        (disabled ? " is-disabled" : "")
      }
      onClick={() => { if (!disabled) onChange(!checked); }}
    >
      <span className="profile-switch-thumb" />
    </button>
  );
}

/* =========================================================
   PROFILE
========================================================= */

export default function Profile() {
  const navigate = useNavigate();
  const { logout, accessToken, isAuthenticated, authLoading } = useAuth();

  /* ---- Profile state ---- */
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  /* ---- Password state ---- */
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    otp: "",
  });
  const [passwordOtpRequired, setPasswordOtpRequired] = useState(false);
  const [passwordOtpLoading, setPasswordOtpLoading] = useState(false);
  const [passwordOtpError, setPasswordOtpError] = useState("");

  /* ---- Admin security state ---- */
  const [twoStepEnabled, setTwoStepEnabled] = useState(false);
  const [passwordOtpEnabled, setPasswordOtpEnabled] = useState(false);
  const [loginOtpEnabled, setLoginOtpEnabled] = useState(false);

  const [securitySaving, setSecuritySaving] = useState({
    twoStep: false,
    passwordOtp: false,
    loginOtp: false,
  });
  const [securityError, setSecurityError] = useState("");

  /* ---- Two-step modal ---- */
  const [isTwoStepModalOpen, setIsTwoStepModalOpen] = useState(false);
  const [twoStepStep, setTwoStepStep] = useState("send"); // send | verify | done
  const [twoStepEmail, setTwoStepEmail] = useState("");   // user-editable
  const [twoStepOtp, setTwoStepOtp] = useState("");
  const [twoStepLoading, setTwoStepLoading] = useState(false);
  const [twoStepError, setTwoStepError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => {
      setResendSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  /* ---- Work hours ---- */
  const targetHours = 8;

  /* ---- Attendance (personal) ---- */
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceErrorStatus, setAttendanceErrorStatus] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [todayAttendanceState, setTodayAttendanceState] = useState("loading");

  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const t = getTodayParts();
    return toDateKey(t.year, t.month, t.day);
  });

  const attendanceRequestId = useRef(0);

  /* ---- Admin company-wide per-day counts ---- */
  const [adminDayCounts, setAdminDayCounts] = useState(null);
  const [adminCountsLoading, setAdminCountsLoading] = useState(false);
  const adminCountsRequestId = useRef(0);

  const [activeNav, setActiveNav] = useState("profile");

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth() + 1;

  const todayParts = getTodayParts();
  const todayKey = toDateKey(todayParts.year, todayParts.month, todayParts.day);

  /* ---- Work hours derived ---- */
  const parsedTodayHours = todayAttendance
    ? parseFloat(todayAttendance.working_hours)
    : NaN;
  const hoursWorked = Number.isFinite(parsedTodayHours) ? parsedTodayHours : 0;

  let workHoursSublabel = `Target ${targetHours}h`;
  if (!todayAttendance) {
    if (todayAttendanceState === "loading") workHoursSublabel = "Loading attendance...";
    else if (todayAttendanceState === "error") workHoursSublabel = "Attendance unavailable";
    else workHoursSublabel = "Attendance not entered";
  }

  /* ---- Photo state ---- */
  const avatarInputRef = useRef(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoToast, setPhotoToast] = useState(null);

  /* =======================================================
     LOAD PROFILE
  ======================================================= */
  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        setProfileError(false);

        const response = await api.get("/erp/profile/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!isMounted) return;

        if (response.data?.success) {
          setProfileData(response.data.data);
        } else {
          setProfileError(true);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Profile API error:", error);
        setProfileError(true);
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    if (!authLoading && isAuthenticated && accessToken) {
      loadProfile();
    } else if (!authLoading) {
      setProfileLoading(false);
    }

    return () => { isMounted = false; };
  }, [authLoading, isAuthenticated, accessToken]);

  /* =======================================================
     HYDRATE SECURITY STATE
  ======================================================= */
  useEffect(() => {
    const security = profileData?.security;
    if (!security) {
      setTwoStepEnabled(false);
      setPasswordOtpEnabled(false);
      setLoginOtpEnabled(false);
      return;
    }
    setTwoStepEnabled(Boolean(security.two_step_enabled));
    setPasswordOtpEnabled(Boolean(security.password_otp_enabled));
    setLoginOtpEnabled(Boolean(security.login_otp_enabled));
    
    // Pre-fill 2FA email if we have it
    if (security.verification_email) {
      setTwoStepEmail(security.verification_email);
    }
  }, [profileData]);

  /* =======================================================
     FALLBACK DATA + ADMIN FLAG
  ======================================================= */
  const data = profileData || {
    username: "User",
    accountId: "Not available",
    profilePhoto: null,
    email: "Not available",
    phone: "Not available",
    role: "Not available",
    department: "Not available",
    employeeId: "Not available",
    joiningDate: "Not available",
    lastLogin: "Not available",
  };

  const userType = String(
    profileData?.usertype ?? profileData?.userType ?? profileData?.user_type ?? "",
  ).trim().toLowerCase();
  const isAdmin = userType === "admin";

  const hasValidProfileEmail =
    Boolean(data.email) && data.email !== "Not available" && isValidEmail(data.email);

  /* =======================================================
     LOAD PERSONAL ATTENDANCE (non-admin only)
  ======================================================= */
  const fetchAttendance = useCallback(
    async (year, month) => {
      if (!accessToken) return;

      attendanceRequestId.current += 1;
      const requestId = attendanceRequestId.current;

      const now = getTodayParts();
      const isCurrentMonth = year === now.year && month === now.month;

      setAttendanceLoading(true);
      setAttendanceError("");
      setAttendanceErrorStatus(null);

      try {
        const response = await api.get("/erp/attendance/my/", {
          params: { year, month },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (requestId !== attendanceRequestId.current) return;

        const payload = response.data;

        if (!payload?.success) {
          setAttendanceRecords([]);
          setAttendanceError(payload?.message || "Attendance could not be retrieved.");
          if (isCurrentMonth) setTodayAttendanceState("error");
          return;
        }

        const records = Array.isArray(payload.data?.records) ? payload.data.records : [];
        setAttendanceRecords(records);

        if (isCurrentMonth) {
          const t = getTodayParts();
          const todayDateKey = toDateKey(t.year, t.month, t.day);
          setTodayAttendance(
            records.find((r) => String(r.date).slice(0, 10) === todayDateKey) || null,
          );
          setTodayAttendanceState("ready");
        }
      } catch (error) {
        if (requestId !== attendanceRequestId.current) return;

        console.error("Attendance API error:", error);
        setAttendanceRecords([]);
        setAttendanceError(getAttendanceErrorMessage(error));
        setAttendanceErrorStatus(error.response?.status ?? null);
        if (isCurrentMonth) setTodayAttendanceState("error");
      } finally {
        if (requestId === attendanceRequestId.current) {
          setAttendanceLoading(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated || !accessToken) return;
    if (isAdmin) return; // admin doesn't fetch personal attendance
    fetchAttendance(calendarYear, calendarMonth);
  }, [
    authLoading, isAuthenticated, accessToken,
    calendarYear, calendarMonth, fetchAttendance, isAdmin,
  ]);

  useEffect(() => {
    const counter = attendanceRequestId;
    return () => { counter.current += 1; };
  }, []);

  /* =======================================================
     LOAD ADMIN COMPANY-WIDE COUNTS (admin only)
  ======================================================= */
  useEffect(() => {
    if (!isAdmin) {
      setAdminDayCounts(null);
      return;
    }
    if (!accessToken) return;

    adminCountsRequestId.current += 1;
    const reqId = adminCountsRequestId.current;

    const load = async () => {
      setAdminCountsLoading(true);
      try {
        const response = await api.get("/erp/admin/attendance/daily-counts/", {
          params: { year: calendarYear, month: calendarMonth },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (reqId !== adminCountsRequestId.current) return;

        if (response.data?.success) {
          setAdminDayCounts(response.data.days || {});
        } else {
          setAdminDayCounts({});
        }
      } catch (err) {
        if (reqId !== adminCountsRequestId.current) return;
        console.error("Admin daily-counts failed:", err);
        setAdminDayCounts({});
      } finally {
        if (reqId === adminCountsRequestId.current) {
          setAdminCountsLoading(false);
        }
      }
    };

    load();
  }, [isAdmin, accessToken, calendarYear, calendarMonth]);

  /* =======================================================
     CALENDAR HELPERS
  ======================================================= */
  const recordsByDate = useMemo(() => {
    const map = new Map();
    attendanceRecords.forEach((r) => {
      if (r?.date) map.set(String(r.date).slice(0, 10), r);
    });
    return map;
  }, [attendanceRecords]);

  const getAttendanceRecord = (k) => recordsByDate.get(k) || null;

  const getAttendanceStatus = (k) => {
    const r = getAttendanceRecord(k);
    if (!r) return "NOT_ENTERED";
    return normalizeStatus(r.status);
  };

  const getDayInfo = (day) => {
    const dateKey = toDateKey(calendarYear, calendarMonth, day);
    return { dateKey, status: getAttendanceStatus(dateKey) };
  };

  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
  const leadingBlanks = (new Date(calendarYear, calendarMonth - 1, 1).getDay() + 6) % 7;

  const attendanceCounts = useMemo(() => {
    const counts = { present: 0, notEntered: 0, leave: 0, halfDay: 0, off: 0 };
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = toDateKey(calendarYear, calendarMonth, day);
      const record = recordsByDate.get(dateKey);
      const status = record ? normalizeStatus(record.status) : "NOT_ENTERED";

      if (status === "PRESENT") counts.present += 1;
      else if (status === "HALF_DAY") counts.halfDay += 1;
      else if (status === "ABSENT" || status === "LEAVE") counts.leave += 1;
      else if (status === "HOLIDAY" || status === "WEEKLY_OFF") counts.off += 1;
      else counts.notEntered += 1;
    }
    return counts;
  }, [recordsByDate, calendarYear, calendarMonth, daysInMonth]);

  const changeMonth = (delta) => {
    const next = new Date(calendarYear, calendarMonth - 1 + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    const t = getTodayParts();
    setCalendarDate(next);
    setSelectedDateKey(
      nextYear === t.year && nextMonth === t.month
        ? toDateKey(nextYear, nextMonth, t.day)
        : toDateKey(nextYear, nextMonth, 1),
    );
  };

  const handlePrevMonth = () => changeMonth(-1);
  const handleNextMonth = () => changeMonth(1);

  const handleRetryAttendance = () => {
    if (isAdmin) return; // handled via adminCounts effect
    fetchAttendance(calendarYear, calendarMonth);
  };

  /* =======================================================
     INITIALS + STATS
  ======================================================= */
  const initials = useMemo(() => {
    const username = data.username || "User";
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return username.slice(0, 2).toUpperCase();
  }, [data.username]);

  const stats = [
    { icon: <IconBriefcase />, label: "ROLE",       value: data.role,       tone: "blue"   },
    { icon: <IconBuilding />,  label: "DEPARTMENT", value: data.department, tone: "green"  },
    { icon: <IconCalendar />,  label: "JOINED",     value: data.joiningDate, tone: "orange" },
    { icon: <IconClock />,     label: "LAST LOGIN", value: data.lastLogin,   tone: "gray"   },
  ];

  /* =======================================================
     NAVIGATION / LOGOUT
  ======================================================= */
  const handleBack = () => navigate(-1);

  const handleSignOut = async () => {
    await logout();
    navigate("/material-planning/login", { replace: true });
  };

  /* =======================================================
     PHOTO UPLOAD / REMOVE
  ======================================================= */
  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image must be 5 MB or smaller.");
      return;
    }
    if (!accessToken) {
      setPhotoError("Your session has expired. Please sign in again.");
      return;
    }

    setPhotoError("");
    try {
      setPhotoUploading(true);
      const formData = new FormData();
      formData.append("profile_photo", file);

      const response = await api.patch("/erp/profile/", formData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (!response.data?.success) throw new Error("bad response");
      setProfileData(response.data.data);
      setPhotoToast("Profile photo updated.");
      setTimeout(() => setPhotoToast(null), 2600);
    } catch (error) {
      console.error("Photo upload failed:", error);
      if (error.response?.status === 401) {
        setPhotoError("Your session has expired. Please sign in again.");
      } else {
        setPhotoError(
          error.response?.data?.message || "Unable to upload photo. Please try again.",
        );
      }
    } finally {
      setPhotoUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    if (!accessToken) {
      setPhotoError("Your session has expired. Please sign in again.");
      return;
    }
    if (!window.confirm("Remove your profile photo?")) return;

    setPhotoError("");
    try {
      setPhotoRemoving(true);
      const response = await api.delete("/erp/profile/photo/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.data?.success) throw new Error("bad response");
      setProfileData(response.data.data);
      setPhotoToast("Profile photo removed.");
      setTimeout(() => setPhotoToast(null), 2600);
    } catch (error) {
      console.error("Photo remove failed:", error);
      if (error.response?.status === 401) {
        setPhotoError("Your session has expired. Please sign in again.");
      } else {
        setPhotoError(
          error.response?.data?.message || "Unable to remove photo. Please try again.",
        );
      }
    } finally {
      setPhotoRemoving(false);
    }
  };

  /* =======================================================
     SECURITY: PATCH helper
  ======================================================= */
  const patchSecurity = useCallback(
    async (payload) => {
      if (!accessToken) throw new Error("no-token");

      const response = await api.patch("/erp/profile/", payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || "patch-failed");
      }

      const security = response.data?.data?.security;
      if (security) {
        setTwoStepEnabled(Boolean(security.two_step_enabled));
        setPasswordOtpEnabled(Boolean(security.password_otp_enabled));
        setLoginOtpEnabled(Boolean(security.login_otp_enabled));
      }
      return security || null;
    },
    [accessToken],
  );

  /* =======================================================
     TWO-STEP MODAL
  ======================================================= */
  const openTwoStepModal = () => {
    setTwoStepStep("send");
    setTwoStepOtp("");
    setTwoStepError("");
    setResendSeconds(0);
    setTwoStepEmail(hasValidProfileEmail ? data.email : "");
    setIsTwoStepModalOpen(true);
  };

  const closeTwoStepModal = () => {
    if (twoStepLoading) return;
    setIsTwoStepModalOpen(false);
    setTwoStepOtp("");
    setTwoStepError("");
  };

  const handleTwoStepToggle = async (nextValue) => {
    if (nextValue) { openTwoStepModal(); return; }

    setSecurityError("");
    setSecuritySaving((p) => ({ ...p, twoStep: true }));

    try {
      await patchSecurity({ two_step_enabled: false });
    } catch (error) {
      console.error("Disable two-step failed:", error);
      setSecurityError(
        error?.response?.data?.message ||
          "Unable to disable two-step authentication. Please try again.",
      );
    } finally {
      setSecuritySaving((p) => ({ ...p, twoStep: false }));
    }
  };

  const handleSendTwoStepOtp = async () => {
    const email = twoStepEmail.trim();

    if (!email) {
      setTwoStepError("Enter an email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setTwoStepError("Enter a valid email address.");
      return;
    }
    if (!accessToken) {
      setTwoStepError("Your session has expired. Please sign in again.");
      return;
    }

    setTwoStepLoading(true);
    setTwoStepError("");

    try {
      const response = await api.post(
        "/erp/profile/security/two-step/send-otp/",
        { email },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || "send-failed");
      }

      setTwoStepOtp("");
      setTwoStepStep("verify");
      setResendSeconds(response.data?.data?.retry_after ?? 30);
    } catch (error) {
      console.error("Send two-step OTP failed:", error);
      setTwoStepError(
        error?.response?.data?.message || "Unable to send OTP. Please try again.",
      );
      const retryAfter = error?.response?.data?.retry_after;
      if (retryAfter) setResendSeconds(retryAfter);
    } finally {
      setTwoStepLoading(false);
    }
  };

  const handleVerifyTwoStepOtp = async (event) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(twoStepOtp)) {
      setTwoStepError("Enter the 6-digit OTP sent to your email.");
      return;
    }
    if (!accessToken) {
      setTwoStepError("Your session has expired. Please sign in again.");
      return;
    }

    setTwoStepLoading(true);
    setTwoStepError("");

    try {
      const response = await api.post(
        "/erp/profile/security/two-step/verify-otp/",
        { otp: twoStepOtp },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || "verify-failed");
      }

      const security = response.data?.data?.security;
      if (security) {
        setTwoStepEnabled(Boolean(security.two_step_enabled));
        setPasswordOtpEnabled(Boolean(security.password_otp_enabled));
        setLoginOtpEnabled(Boolean(security.login_otp_enabled));
      } else {
        setTwoStepEnabled(true);
      }

      setTwoStepStep("done");
    } catch (error) {
      console.error("Verify two-step OTP failed:", error);
      setTwoStepError(
        error?.response?.data?.message || "Invalid or expired OTP. Please try again.",
      );
    } finally {
      setTwoStepLoading(false);
    }
  };

  const handlePasswordOtpToggle = async (nextValue) => {
    setSecurityError("");
    setSecuritySaving((p) => ({ ...p, passwordOtp: true }));
    const prev = passwordOtpEnabled;
    setPasswordOtpEnabled(nextValue);
    try {
      await patchSecurity({ password_otp_enabled: nextValue });
    } catch (error) {
      console.error("Update password-OTP failed:", error);
      setPasswordOtpEnabled(prev);
      setSecurityError(
        error?.response?.data?.message || "Unable to update password OTP preference.",
      );
    } finally {
      setSecuritySaving((p) => ({ ...p, passwordOtp: false }));
    }
  };

  const handleLoginOtpToggle = async (nextValue) => {
    setSecurityError("");
    setSecuritySaving((p) => ({ ...p, loginOtp: true }));
    const prev = loginOtpEnabled;
    setLoginOtpEnabled(nextValue);
    try {
      await patchSecurity({ login_otp_enabled: nextValue });
    } catch (error) {
      console.error("Update login-OTP failed:", error);
      setLoginOtpEnabled(prev);
      setSecurityError(
        error?.response?.data?.message || "Unable to update login OTP preference.",
      );
    } finally {
      setSecuritySaving((p) => ({ ...p, loginOtp: false }));
    }
  };

  /* =======================================================
     PASSWORD MODAL & OTP LOGIC
  ======================================================= */
  const openPasswordModal = () => {
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "", otp: "" });
    setPasswordError("");
    setPasswordFieldErrors({});
    setPasswordUpdated(false);
    setPasswordOtpRequired(false);
    setPasswordOtpError("");
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (passwordLoading) return;
    setIsPasswordModalOpen(false);
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "", otp: "" });
    setPasswordError("");
    setPasswordFieldErrors({});
    setPasswordUpdated(false);
    setPasswordOtpRequired(false);
    setPasswordOtpError("");
  };

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((p) => ({ ...p, [name]: value }));
    setPasswordError("");
    setPasswordOtpError("");
    setPasswordFieldErrors((p) => ({ ...p, [name]: undefined }));
  };

  const validatePassword = () => {
    const errors = {};
    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword) errors.oldPassword = "Current password is required.";
    if (!newPassword) errors.newPassword = "New password is required.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your new password.";

    if (newPassword && (newPassword.length < 8 || newPassword.length > 32)) {
      errors.newPassword = "Password must be 8–32 characters.";
    }
    if (newPassword && !/[A-Z]/.test(newPassword)) {
      errors.newPassword = "Password must contain at least one uppercase letter.";
    }
    if (newPassword && !/[a-z]/.test(newPassword)) {
      errors.newPassword = "Password must contain at least one lowercase letter.";
    }
    if (newPassword && !/[0-9]/.test(newPassword)) {
      errors.newPassword = "Password must contain at least one number.";
    }
    if (newPassword && !/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword = "Password must contain at least one special character.";
    }
    if (oldPassword && newPassword && oldPassword === newPassword) {
      errors.newPassword = "New password must be different from the current password.";
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = "New password and confirm password do not match.";
    }

    setPasswordFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRequestPasswordOTP = async () => {
    if (!accessToken) return;
    setPasswordOtpLoading(true);
    setPasswordOtpError("");

    try {
      await api.post("/erp/profile/security/password-change/send-otp/", {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (error) {
      setPasswordOtpError(
        error?.response?.data?.message || "Unable to send OTP. Please try again."
      );
    } finally {
      setPasswordOtpLoading(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    if (!validatePassword()) return;
    if (!accessToken) {
      setPasswordError("Your session has expired. Please sign in again.");
      return;
    }

    // If Admin & OTP is enabled & we haven't shown the OTP field yet, show it now
    if (isAdmin && passwordOtpEnabled && !passwordOtpRequired) {
      setPasswordOtpRequired(true);
      handleRequestPasswordOTP();
      return;
    }

    // If OTP is required but empty, block
    if (passwordOtpRequired && !passwordForm.otp) {
      setPasswordOtpError("Please enter the 6-digit OTP.");
      return;
    }

    try {
      setPasswordLoading(true);
      const payload = {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      };

      // Only send OTP if required
      if (passwordOtpRequired) {
        payload.otp = passwordForm.otp;
      }

      const response = await api.post(
        "/erp/profile/change-password/",
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (response.data?.success) {
        setPasswordUpdated(true);
        setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "", otp: "" });
        setPasswordFieldErrors({});
        setPasswordOtpRequired(false);
      } else {
        setPasswordError(response.data?.message || "Password change failed.");
      }
    } catch (error) {
      console.error("Change password error:", error);
      
      const responseData = error.response?.data;
      
      if (responseData?.errors) {
        setPasswordFieldErrors(responseData.errors);
      }
      
      // If backend suddenly demands OTP
      if (responseData?.otp_required) {
        setPasswordOtpRequired(true);
        if (!passwordOtpRequired) handleRequestPasswordOTP();
      }

      if (error.response?.status === 401) {
        setPasswordError("Your session has expired. Please sign in again.");
      } else {
        setPasswordError(responseData?.message || "Unable to change password. Please try again.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const passwordRequirements = [
    { label: "8–32 characters", valid: passwordForm.newPassword.length >= 8 && passwordForm.newPassword.length <= 32 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(passwordForm.newPassword) },
    { label: "One lowercase letter", valid: /[a-z]/.test(passwordForm.newPassword) },
    { label: "One number", valid: /[0-9]/.test(passwordForm.newPassword) },
    { label: "One special character", valid: /[^A-Za-z0-9]/.test(passwordForm.newPassword) },
    { label: "Different from current password", valid: Boolean(passwordForm.newPassword) && passwordForm.newPassword !== passwordForm.oldPassword },
  ];

  /* =======================================================
     SIDEBAR SCROLL
  ======================================================= */
  const scrollToSection = (navKey, elementId) => {
    setActiveNav(navKey);
    const element = document.getElementById(elementId);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* =======================================================
     RENDER GUARDS
  ======================================================= */
  if (authLoading || profileLoading) return <Loading />;
  if (profileError) return <Error />;

  const calendarLoading = isAdmin ? adminCountsLoading : attendanceLoading;
  const calendarError = isAdmin ? "" : attendanceError;

  /* =======================================================
     PAGE
  ======================================================= */
  return (
    <div className="profile-page">
      <div className="profile-shell">
        {/* ================= LEFT SIDEBAR ================= */}
        <aside className="profile-sidebar-nav" aria-label="Profile navigation">
          <div className="profile-brand">
            <span className="profile-brand-logo">M</span>
            <span className="profile-brand-name">Mugil ERP</span>
          </div>

          <nav className="profile-nav">
            <button
              type="button"
              className={"profile-nav-item" + (activeNav === "profile" ? " is-active" : "")}
              onClick={() => scrollToSection("profile", "profile-top")}
            >
              <IconUser /><span>Profile</span>
            </button>

            <button
              type="button"
              className={"profile-nav-item" + (activeNav === "attendance" ? " is-active" : "")}
              onClick={() => scrollToSection("attendance", "profile-attendance-calendar")}
            >
              <IconCalendar /><span>{isAdmin ? "Company Attendance" : "Attendance"}</span>
            </button>

            {!isAdmin && (
              <button
                type="button"
                className={"profile-nav-item" + (activeNav === "hours" ? " is-active" : "")}
                onClick={() => scrollToSection("hours", "profile-work-hours")}
              >
                <IconClock /><span>Work Hours</span>
              </button>
            )}

            <button type="button" className="profile-nav-item" onClick={openPasswordModal}>
              <IconLock /><span>Security</span>
            </button>

            <button type="button" className="profile-nav-item" onClick={handleBack}>
              <IconArrowLeft /><span>Go Back</span>
            </button>
          </nav>

          <div className="profile-side-promo">
            <div className="profile-side-promo-icon"><IconShield /></div>
            <h4>Keep your account secure</h4>
            <p>Update your password regularly to protect your ERP account.</p>
            <button
              type="button"
              className="profile-side-promo-btn"
              onClick={openPasswordModal}
              aria-label="Change password"
              title="Change password"
            >
              <IconChevronRight />
            </button>
          </div>
        </aside>

        {/* ================= CONTENT ================= */}
        <div className="profile-content" id="profile-top">
          <div className="profile-topbar">
            <div className="profile-search-bar">
              <button type="button" className="profile-back-btn" onClick={handleBack} aria-label="Back">
                <IconArrowLeft />
              </button>
              <div className="profile-search-text">
                <span className="profile-search-title">Profile</span>
                <span className="profile-search-sub">
                  {isAdmin
                    ? "View your account information and company attendance"
                    : "View your account information and attendance"}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-top-actions">
            <div className="profile-top-user">
              <span className="profile-top-avatar">
                {data.profilePhoto ? <img src={data.profilePhoto} alt="" /> : initials}
              </span>
            </div>
            <button
              type="button"
              className="profile-logout-btn"
              onClick={handleSignOut}
              title="Logout"
              aria-label="Logout"
            >
              <IconLogout />
            </button>
          </div>

          {/* MAIN COLUMN */}
          <div className="profile-dashboard-main">
            {/* HERO BANNER */}
            <div className="profile-hero">
              <div className="profile-hero-content">
                <div className="profile-avatar-wrapper">
                  <div className="profile-avatar">
                    {data.profilePhoto ? (
                      <img src={data.profilePhoto} alt="Profile" />
                    ) : (
                      <span>{initials}</span>
                    )}

                    <button
                      type="button"
                      className="profile-avatar-edit"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={photoUploading || photoRemoving}
                      title={photoUploading ? "Uploading…" : "Change profile photo"}
                      aria-label="Change profile photo"
                    >
                      {photoUploading ? <span className="profile-avatar-spinner" /> : <IconPencil />}
                    </button>

                    {data.profilePhoto && (
                      <button
                        type="button"
                        className="profile-avatar-remove"
                        onClick={handlePhotoRemove}
                        disabled={photoUploading || photoRemoving}
                        title={photoRemoving ? "Removing…" : "Remove profile photo"}
                        aria-label="Remove profile photo"
                      >
                        {photoRemoving ? <span className="profile-avatar-spinner" /> : <IconTrash />}
                      </button>
                    )}

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handlePhotoChange}
                    />
                  </div>

                  <span className="profile-status-badge">
                    <span className="profile-status-dot"></span>
                    Active
                  </span>

                  {photoError && <p className="profile-avatar-error">{photoError}</p>}
                </div>

                <div className="profile-hero-info">
                  <h2 className="profile-hero-name">{data.username}</h2>
                  <p className={"profile-hero-email" + (data.email === "Not available" ? " is-muted" : "")}>
                    {data.email}
                  </p>
                  <div className="profile-hero-tags">
                    <span className="profile-tag">ERP Account</span>
                    <span className="profile-tag">ID: {data.employeeId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STATS */}
            <div className="profile-stats-grid">
              {stats.map((stat, index) => <StatCard key={index} {...stat} />)}
            </div>

            {/* ATTENDANCE SUMMARY — NON-ADMIN ONLY */}
            {!isAdmin && (
              <AttendanceSummary
                monthLabel={`${MONTH_NAMES[calendarMonth - 1]} ${calendarYear}`}
                counts={attendanceCounts}
                unavailable={attendanceLoading || Boolean(attendanceError)}
              />
            )}

            {/* BOTTOM ROW: Personal info + (work hours for non-admin) */}
            <div 
              className="profile-main-grid" 
              style={{ display: "flex", flexDirection: "column", width: "100%", gap: "24px" }}
            >
              <div className="profile-card profile-info-card" style={{ width: "100%" }}>
                <div className="profile-card-header">
                  <div>
                    <h3 className="profile-card-title">Personal Information</h3>
                    <p className="profile-card-subtitle">
                      Your account details and contact information
                    </p>
                  </div>
                  <span className="profile-view-only-badge">View only</span>
                </div>

                <div className="profile-info-grid">
                  <InfoItem icon={<IconUser />} label="Username" value={data.username} />
                  <InfoItem icon={<IconMail />} label="Email" value={data.email} />
                  <InfoItem icon={<IconPhone />} label="Phone" value={data.phone} />
                  <InfoItem icon={<IconBriefcase />} label="Role" value={data.role} />
                  <InfoItem icon={<IconBuilding />} label="Department" value={data.department} />
                  <InfoItem icon={<IconGlobe />} label="Employee ID" value={data.employeeId} />
                </div>

                <div className="profile-info-footer">
                  <p className="profile-info-note">
                    <IconInfo />
                    Information is managed by HR/Admin. Contact your HR department for updates.
                  </p>
                </div>
              </div>

              {!isAdmin && (
                <div className="profile-sidebar" id="profile-work-hours">
                  <WorkHoursCard
                    hoursWorked={hoursWorked}
                    targetHours={targetHours}
                    sublabel={workHoursSublabel}
                    muted={!todayAttendance}
                  />
                </div>
              )}
            </div>

            {/* ADMIN ONLY: EXTRA SECURITY OPTIONS */}
            {isAdmin && (
              <div className="profile-card profile-admin-card" id="profile-admin-security">
                <div className="profile-card-header">
                  <div>
                    <h3 className="profile-card-title">Admin Security</h3>
                    <p className="profile-card-subtitle">
                      Extra protection options available for administrators
                    </p>
                  </div>
                  <span className="profile-view-only-badge">Admin only</span>
                </div>

                <div className="profile-admin-options">
                  <div className="profile-admin-option">
                    <span className="profile-admin-option-icon"><IconShield /></span>
                    <div className="profile-admin-option-text">
                      <h4>Two-Step Authentication</h4>
                      <p>
                        {twoStepEnabled
                          ? "Enabled. Your email is verified."
                          : "Verify your email with an OTP to turn this on."}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={twoStepEnabled}
                      onChange={handleTwoStepToggle}
                      disabled={securitySaving.twoStep}
                      label="Two-step authentication"
                    />
                  </div>

                  {twoStepEnabled && (
                    <>
                      <div className="profile-admin-option">
                        <span className="profile-admin-option-icon"><IconLock /></span>
                        <div className="profile-admin-option-text">
                          <h4>Change Password with OTP</h4>
                          <p>Ask for an email OTP when changing your password.</p>
                        </div>
                        <ToggleSwitch
                          checked={passwordOtpEnabled}
                          onChange={handlePasswordOtpToggle}
                          disabled={securitySaving.passwordOtp}
                          label="Change password with OTP"
                        />
                      </div>

                      <div className="profile-admin-option">
                        <span className="profile-admin-option-icon"><IconMail /></span>
                        <div className="profile-admin-option-text">
                          <h4>Login with OTP</h4>
                          <p>Ask for an email OTP every time you sign in.</p>
                        </div>
                        <ToggleSwitch
                          checked={loginOtpEnabled}
                          onChange={handleLoginOtpToggle}
                          disabled={securitySaving.loginOtp}
                          label="Login with OTP"
                        />
                      </div>
                    </>
                  )}
                </div>

                {securityError && (
                  <p className="profile-error" role="alert">{securityError}</p>
                )}

                <div className="profile-info-footer">
                  <p className="profile-info-note">
                    <IconInfo />
                    These options are visible to admin accounts only.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — CALENDAR + SELECTED DAY */}
          <aside className="profile-dashboard-aside">
            <AttendanceCalendarCard
              year={calendarYear}
              month={calendarMonth}
              daysInMonth={daysInMonth}
              leadingBlanks={leadingBlanks}
              getDayInfo={getDayInfo}
              selectedDateKey={selectedDateKey}
              todayKey={todayKey}
              onSelectDate={setSelectedDateKey}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              loading={calendarLoading}
              error={calendarError}
              errorStatus={attendanceErrorStatus}
              onRetry={handleRetryAttendance}
              onSignIn={handleSignOut}
              adminMode={isAdmin}
              adminDayCounts={adminDayCounts}
            />

            {isAdmin ? (
              <AdminDayDetails
                dateKey={selectedDateKey}
                counts={adminDayCounts?.[selectedDateKey] || null}
              />
            ) : (
              !attendanceError && !attendanceLoading && (
                <AttendanceDetails
                  dateKey={selectedDateKey}
                  record={getAttendanceRecord(selectedDateKey)}
                  status={getAttendanceStatus(selectedDateKey)}
                />
              )
            )}
          </aside>
        </div>
      </div>

      {/* PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div
          className="profile-modal-overlay"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closePasswordModal(); }}
        >
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <div>
                <h2 id="change-password-title" className="profile-modal-title">
                  Change Password
                </h2>
                <p className="profile-modal-subtitle">Update your account password</p>
              </div>
              {!passwordLoading && (
                <button type="button" className="profile-modal-close" onClick={closePasswordModal} aria-label="Close">
                  <IconClose />
                </button>
              )}
            </div>

            {passwordUpdated ? (
              <div className="profile-modal-success">
                <div className="profile-modal-success-icon"><IconShield /></div>
                <p>Password updated successfully!</p>
                <button type="button" className="profile-btn-primary" onClick={() => setIsPasswordModalOpen(false)}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} noValidate>
                <div className="profile-form-group">
                  <label htmlFor="oldPassword">Current Password</label>
                  <input
                    id="oldPassword" type="password" name="oldPassword"
                    value={passwordForm.oldPassword} onChange={handlePasswordFieldChange}
                    placeholder="Enter current password" autoComplete="current-password"
                    disabled={passwordLoading}
                  />
                  {passwordFieldErrors.oldPassword && (
                    <p className="profile-field-error">{passwordFieldErrors.oldPassword}</p>
                  )}
                </div>

                <div className="profile-form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    id="newPassword" type="password" name="newPassword"
                    value={passwordForm.newPassword} onChange={handlePasswordFieldChange}
                    placeholder="Enter new password" autoComplete="new-password"
                    disabled={passwordLoading}
                  />
                  {passwordFieldErrors.newPassword && (
                    <p className="profile-field-error">{passwordFieldErrors.newPassword}</p>
                  )}
                </div>

                <div className="profile-password-rules">
                  <span>Password requirements</span>
                  <ul>
                    {passwordRequirements.map((req, i) => (
                      <li key={i} className={req.valid ? "valid" : ""}>{req.label}</li>
                    ))}
                  </ul>
                </div>

                <div className="profile-form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    id="confirmPassword" type="password" name="confirmPassword"
                    value={passwordForm.confirmPassword} onChange={handlePasswordFieldChange}
                    placeholder="Confirm new password" autoComplete="new-password"
                    disabled={passwordLoading}
                  />
                  {passwordFieldErrors.confirmPassword && (
                    <p className="profile-field-error">{passwordFieldErrors.confirmPassword}</p>
                  )}
                </div>

                {/* --- OTP FIELD (shows if admin requires OTP) --- */}
                {passwordOtpRequired && (
                  <div className="profile-form-group" style={{ marginTop: "16px" }}>
                    <label htmlFor="otp">Verification Code (OTP)</label>
                    <input
                      id="otp" type="text" name="otp"
                      value={passwordForm.otp} onChange={handlePasswordFieldChange}
                      placeholder="Enter 6-digit code" maxLength={6}
                      disabled={passwordLoading}
                    />
                    <p className="profile-admin-modal-hint">
                      A code was sent to your verified email address.
                    </p>
                    {passwordOtpError && <p className="profile-field-error">{passwordOtpError}</p>}
                  </div>
                )}

                {passwordError && <p className="profile-error">{passwordError}</p>}

                <div className="profile-modal-actions">
                  <button type="button" className="profile-btn-secondary" onClick={closePasswordModal} disabled={passwordLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="profile-btn-primary" disabled={passwordLoading || passwordOtpLoading}>
                    {passwordLoading ? "Updating..." : passwordOtpLoading ? "Sending OTP..." : "Update Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TWO-STEP AUTH MODAL (ADMIN ONLY) — email is user-editable */}
      {isAdmin && isTwoStepModalOpen && (
        <div
          className="profile-modal-overlay"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeTwoStepModal(); }}
        >
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="two-step-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <div>
                <h2 id="two-step-title" className="profile-modal-title">
                  Enable Two-Step Authentication
                </h2>
                <p className="profile-modal-subtitle">
                  {twoStepStep === "verify"
                    ? "Enter the code we sent you"
                    : "Verify your email to continue"}
                </p>
              </div>
              {!twoStepLoading && (
                <button type="button" className="profile-modal-close" onClick={closeTwoStepModal} aria-label="Close">
                  <IconClose />
                </button>
              )}
            </div>

            {/* ---------- STEP 1: EMAIL (editable) ---------- */}
            {twoStepStep === "send" && (
              <div>
                <p className="profile-admin-modal-text">
                  Enter the email address where you want to receive the OTP:
                </p>

                <div className="profile-form-group">
                  <label htmlFor="twoStepEmail">Email</label>
                  <input
                    id="twoStepEmail"
                    type="email"
                    value={twoStepEmail}
                    onChange={(e) => {
                      setTwoStepEmail(e.target.value);
                      setTwoStepError("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={twoStepLoading}
                  />
                </div>

                {twoStepError && <p className="profile-error">{twoStepError}</p>}

                <div className="profile-modal-actions">
                  <button type="button" className="profile-btn-secondary" onClick={closeTwoStepModal} disabled={twoStepLoading}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="profile-btn-primary"
                    onClick={handleSendTwoStepOtp}
                    disabled={twoStepLoading || !twoStepEmail.trim() || !isValidEmail(twoStepEmail)}
                  >
                    {twoStepLoading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </div>
            )}

            {/* ---------- STEP 2: OTP ---------- */}
            {twoStepStep === "verify" && (
              <form onSubmit={handleVerifyTwoStepOtp} noValidate>
                <div className="profile-form-group">
                  <label htmlFor="twoStepOtp">Enter OTP</label>
                  <input
                    id="twoStepOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="profile-otp-input"
                    value={twoStepOtp}
                    onChange={(e) => {
                      setTwoStepOtp(e.target.value.replace(/\D/g, ""));
                      setTwoStepError("");
                    }}
                    placeholder="______"
                    disabled={twoStepLoading}
                  />
                  <p className="profile-admin-modal-hint">Code sent to {twoStepEmail}</p>
                </div>

                {twoStepError && <p className="profile-error">{twoStepError}</p>}

                <div className="profile-admin-resend">
                  {resendSeconds > 0 ? (
                    <span>Resend OTP in {resendSeconds}s</span>
                  ) : (
                    <button
                      type="button"
                      className="profile-admin-link-btn"
                      onClick={handleSendTwoStepOtp}
                      disabled={twoStepLoading}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <div className="profile-modal-actions">
                  <button type="button" className="profile-btn-secondary" onClick={closeTwoStepModal} disabled={twoStepLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="profile-btn-primary" disabled={twoStepLoading}>
                    {twoStepLoading ? "Verifying..." : "Verify & Enable"}
                  </button>
                </div>
              </form>
            )}

            {/* ---------- STEP 3: DONE ---------- */}
            {twoStepStep === "done" && (
              <div className="profile-modal-success">
                <div className="profile-modal-success-icon"><IconShield /></div>
                <p>Two-step authentication enabled!</p>
                <button type="button" className="profile-btn-primary" onClick={closeTwoStepModal}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHOTO TOAST */}
      {photoToast && <div className="emp-toast" role="status">{photoToast}</div>}
    </div>
  );
}