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
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconMail = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3,7 12,13 21,7" />
  </svg>
);

const IconPhone = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M22 16.92v3a2 2 0 0 1-2.18 2
      19.79 19.79 0 0 1-8.63-3.07
      19.5 19.5 0 0 1-6-6
      19.79 19.79 0 0 1-3.07-8.67
      A2 2 0 0 1 4.11 2h3
      a2 2 0 0 1 2 1.72
      12.84 12.84 0 0 0 .7 2.81
      2 2 0 0 1-.45 2.11L8.09 9.91
      a16 16 0 0 0 6 6l1.27-1.27
      a2 2 0 0 1 2.11-.45
      12.84 12.84 0 0 0 2.81.7
      A2 2 0 0 1 22 16.92z"
    />
  </svg>
);

const IconBriefcase = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
    <path d="M10 12v2h4v-2" />
  </svg>
);

const IconBuilding = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M8 7h2" />
    <path d="M14 7h2" />
    <path d="M8 11h2" />
    <path d="M14 11h2" />
    <path d="M8 15h2" />
    <path d="M14 15h2" />
    <path d="M10 21v-3h4v3" />
  </svg>
);

const IconGlobe = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);

const IconCalendar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconClock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12,7 12,12 15,14" />
  </svg>
);

const IconShield = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path
      d="M12 3l8 4v5c0 5.5-3.5 8.5-8 9
      -4.5-.5-8-3.5-8-9V7l8-4z"
    />
    <polyline points="9,12 11,14 15,10" />
  </svg>
);

const IconLock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconInfo = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <circle cx="12" cy="7" r="0.5" fill="currentColor" />
  </svg>
);

const IconArrowLeft = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12,19 5,12 12,5" />
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 512 512" fill="currentColor">
    <path
      d="
      M377.9 406.1c-6.4 6.4-15 9.9-24 9.9
      c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0
      c-17.7 0-32-14.3-32-32l0-64
      c0-17.7 14.3-32 32-32l128 0 0-62.1
      c0-18.7 15.2-33.9 33.9-33.9
      c9 0 17.6 3.6 24 9.9L512 256 377.9 406.1z
      M160 96L96 96c-17.7 0-32 14.3-32 32l0 256
      c0 17.7 14.3 32 32 32l64 0
      c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0
      c-53 0-96-43-96-96L0 128
      C0 75 43 32 96 32l64 0
      c17.7 0 32 14.3 32 32s-14.3 32-32 32z
    "
    />
  </svg>
);

const IconClose = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPencil = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconTrash = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);


const IconChevronLeft = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15,18 9,12 15,6" />
  </svg>
);

const IconChevronRight = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9,6 15,12 9,18" />
  </svg>
);

/* =========================================================
   ATTENDANCE HELPERS
   (calendar dates are handled as plain YYYY-MM-DD strings so
   that timezones can never shift a date by one day)
========================================================= */

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

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad2 = (value) => String(value).padStart(2, "0");

const toDateKey = (year, month, day) =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const parseDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
};

/* Normalised calendar statuses */
const STATUS_META = {
  PRESENT: { label: "Present", tone: "present" },
  NOT_ENTERED: { label: "Attendance Not Entered", tone: "pending" },
  HALF_DAY: { label: "Half Day", tone: "pending" },
  ABSENT: { label: "Absent", tone: "leave" },
  LEAVE: { label: "Leave", tone: "leave" },
  HOLIDAY: { label: "Holiday", tone: "off" },
  WEEKLY_OFF: { label: "Weekly Off", tone: "off" },
};

/* Exact wording for the details panel, by raw API status */
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

const normalizeStatus = (rawStatus) => {
  switch (String(rawStatus || "").trim().toUpperCase()) {
    case "PRESENT":
    case "WFH":
      return "PRESENT";
    case "HALF_DAY":
      return "HALF_DAY";
    case "ABSENT":
      return "ABSENT";
    case "PAID_LEAVE":
    case "UNPAID_LEAVE":
      return "LEAVE";
    case "HOLIDAY":
      return "HOLIDAY";
    case "WEEKLY_OFF":
      return "WEEKLY_OFF";
    default:
      return "NOT_ENTERED";
  }
};

const formatTime = (value) => {
  if (!value) return "-";

  const match = String(value).match(/^(\d{1,2}):(\d{2})/);

  if (!match) return "-";

  const hours24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${pad2(hours12)}:${minutes} ${suffix}`;
};

const formatHours = (value) => {
  const number = parseFloat(value);

  return Number.isFinite(number) ? `${number.toFixed(2)} h` : "-";
};

const formatCurrency = (value) => {
  const number = parseFloat(value);

  if (!Number.isFinite(number)) return "-";

  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(number)}`;
};

const formatLongDate = (key) => {
  const { year, month, day } = parseDateKey(key);

  /* Local-time constructor with explicit parts: no timezone shift */
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

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You don't have permission to view attendance.";
  }

  if (status === 404) {
    return "The attendance service could not be found.";
  }

  if (status >= 500) {
    return "The server had a problem. Please try again shortly.";
  }

  if (!error?.response) {
    return "Network error. Please check your connection.";
  }

  return error.response?.data?.message || "Something went wrong.";
};

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="profile-stat-card">
      <div className={`profile-stat-icon tone-${tone}`}>{icon}</div>

      <div className="profile-stat-content">
        <span
          className={
            "profile-stat-value" +
            (value === "Not available" ? " is-muted" : "")
          }
        >
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

        <span
          className={
            "profile-info-value" +
            (value === "Not available" ? " is-muted" : "")
          }
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function CircularProgress({ value, max, label, sublabel, muted = false }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min((value / max) * 100, 100);

  const offset = circumference - (progress / 100) * circumference;

  const getColor = () => {
    if (muted) {
      return "#c3ccd4";
    }

    const ratio = value / max;

    if (ratio >= 0.8) {
      return "#2F7A4F";
    }

    if (ratio >= 0.5) {
      return "#C98A1D";
    }

    return "#B23A3A";
  };

  const progressColor = getColor();

  const hours = Math.floor(value);

  const minutes = Math.round((value - hours) * 60);

  const timeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <div className="profile-circular-container">
      <svg className="profile-circular-svg" viewBox="0 0 200 200">
        <circle
          className="profile-circular-bg"
          cx="100"
          cy="100"
          r={radius}
          strokeWidth="12"
          fill="none"
        />

        <circle
          className="profile-circular-progress"
          cx="100"
          cy="100"
          r={radius}
          stroke={progressColor}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
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

        <div className="profile-card-icon clock">
          <IconClock />
        </div>
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
          <div
            key={item.key}
            className={`profile-summary-card tone-${item.key}`}
          >
            <span className="profile-summary-value">
              {unavailable ? "–" : item.value}
            </span>

            <span className="profile-summary-label">{item.label}</span>
          </div>
        ))}
      </div>

      <div
        className={
          "profile-summary-bar" + (unavailable || !total ? " is-empty" : "")
        }
        role="img"
        aria-label={
          unavailable
            ? "Attendance distribution unavailable"
            : items.map((item) => `${item.label} ${item.value}`).join(", ")
        }
      >
        {!unavailable &&
          total > 0 &&
          items
            .filter((item) => item.value > 0)
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
              <button
                type="button"
                className="profile-calendar-retry"
                onClick={onSignIn}
              >
                Sign in again
              </button>
            ) : (
              <button
                type="button"
                className="profile-calendar-retry"
                onClick={onRetry}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="profile-calendar-weekdays" aria-hidden="true">
            {WEEKDAY_HEADERS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>

          <div
            className="profile-calendar-grid"
            aria-busy={loading}
            role="group"
            aria-label={`Days of ${monthLabel}`}
          >
            {cells}
          </div>

          <p
            className={
              "profile-calendar-loading" + (loading ? " is-visible" : "")
            }
            role="status"
          >
            {loading ? "Loading attendance..." : ""}
          </p>
        </>
      )}

      <ul className="profile-calendar-legend" aria-label="Legend">
        <li>
          <span className="profile-legend-dot tone-present" />
          Present
        </li>
        <li>
          <span className="profile-legend-dot tone-pending" />
          Not Entered
        </li>
        <li>
          <span className="profile-legend-dot tone-leave" />
          Leave / Absent
        </li>
        <li>
          <span className="profile-legend-dot tone-off" />
          Holiday / Weekly Off
        </li>
      </ul>
    </section>
  );
}

function AttendanceDetails({ dateKey, record, status }) {
  const { title, subtitle } = formatLongDate(dateKey);

  const meta = STATUS_META[status];

  const rawStatus = record
    ? String(record.status || "").trim().toUpperCase()
    : "";

  const statusLabel = record
    ? RAW_STATUS_LABELS[rawStatus] || rawStatus || meta.label
    : STATUS_META.NOT_ENTERED.label;

  const showTimes =
    record &&
    (status === "PRESENT" || status === "HALF_DAY");

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

        <span className={`profile-status-pill tone-${meta.tone}`}>
          {statusLabel}
        </span>
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

/* =========================================================
   PROFILE
========================================================= */

export default function Profile() {
  const navigate = useNavigate();

  const { logout, accessToken, isAuthenticated, authLoading } = useAuth();

  /* -------------------------------------------------------
     Profile API state
  ------------------------------------------------------- */

  const [profileData, setProfileData] = useState(null);

  const [profileLoading, setProfileLoading] = useState(true);

  const [profileError, setProfileError] = useState(false);

  /* -------------------------------------------------------
     Password state
  ------------------------------------------------------- */

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  /* -------------------------------------------------------
     Work hours
  ------------------------------------------------------- */

  const targetHours = 8;

  /* -------------------------------------------------------
     Attendance (calendar) state
  ------------------------------------------------------- */

  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [attendanceError, setAttendanceError] = useState("");

  const [attendanceErrorStatus, setAttendanceErrorStatus] = useState(null);

  /* Today's record is kept separately so the Work Hours card stays
     correct even while another month is being browsed. */
  const [todayAttendance, setTodayAttendance] = useState(null);

  const [todayAttendanceState, setTodayAttendanceState] = useState("loading");

  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const today = getTodayParts();

    return toDateKey(today.year, today.month, today.day);
  });

  const attendanceRequestId = useRef(0);

  const [activeNav, setActiveNav] = useState("profile");

  const calendarYear = calendarDate.getFullYear();

  const calendarMonth = calendarDate.getMonth() + 1;

  const todayParts = getTodayParts();

  const todayKey = toDateKey(todayParts.year, todayParts.month, todayParts.day);

  /* -------------------------------------------------------
     Work hours (driven by today's attendance record)
  ------------------------------------------------------- */

  const parsedTodayHours = todayAttendance
    ? parseFloat(todayAttendance.working_hours)
    : NaN;

  const hoursWorked = Number.isFinite(parsedTodayHours) ? parsedTodayHours : 0;

  let workHoursSublabel = `Target ${targetHours}h`;

  if (!todayAttendance) {
    if (todayAttendanceState === "loading") {
      workHoursSublabel = "Loading attendance...";
    } else if (todayAttendanceState === "error") {
      workHoursSublabel = "Attendance unavailable";
    } else {
      workHoursSublabel = "Attendance not entered";
    }
  }

  /* -------------------------------------------------------
     Profile photo upload / remove
  ------------------------------------------------------- */

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

        console.log("Access token exists:", !!accessToken);
        console.log("Calling GET /api/erp/profile/");

        const response = await api.get("/erp/profile/", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        console.log("Profile API response:", response.data);

        if (!isMounted) return;

        if (response.data?.success) {
          setProfileData(response.data.data);
        } else {
          setProfileError(true);
        }
      } catch (error) {
        if (!isMounted) return;

        console.error("Profile API error:", error);
        console.error("Status:", error.response?.status);
        console.error("Response:", error.response?.data);

        setProfileError(true);
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    if (!authLoading && isAuthenticated && accessToken) {
      loadProfile();
    } else if (!authLoading) {
      setProfileLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, accessToken]);

  /* =======================================================
     LOAD ATTENDANCE (per month)
  ======================================================= */

  const fetchAttendance = useCallback(
    async (year, month) => {
      if (!accessToken) return;

      attendanceRequestId.current += 1;

      const requestId = attendanceRequestId.current;

      const isCurrentMonth =
        year === getTodayParts().year && month === getTodayParts().month;

      setAttendanceLoading(true);
      setAttendanceError("");
      setAttendanceErrorStatus(null);

      try {
        const response = await api.get("/erp/attendance/my/", {
          params: {
            year,
            month,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        /* A newer request has started: ignore this stale response */
        if (requestId !== attendanceRequestId.current) return;

        const payload = response.data;

        if (!payload?.success) {
          setAttendanceRecords([]);
          setAttendanceError(
            payload?.message || "Attendance could not be retrieved.",
          );

          if (isCurrentMonth) {
            setTodayAttendanceState("error");
          }

          return;
        }

        const records = Array.isArray(payload.data?.records)
          ? payload.data.records
          : [];

        setAttendanceRecords(records);

        if (isCurrentMonth) {
          const today = getTodayParts();

          const todayDateKey = toDateKey(today.year, today.month, today.day);

          setTodayAttendance(
            records.find(
              (record) => String(record.date).slice(0, 10) === todayDateKey,
            ) || null,
          );

          setTodayAttendanceState("ready");
        }
      } catch (error) {
        if (requestId !== attendanceRequestId.current) return;

        console.error("Attendance API error:", error);
        console.error("Status:", error.response?.status);
        console.error("Response:", error.response?.data);

        setAttendanceRecords([]);
        setAttendanceError(getAttendanceErrorMessage(error));
        setAttendanceErrorStatus(error.response?.status ?? null);

        if (isCurrentMonth) {
          setTodayAttendanceState("error");
        }
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

    fetchAttendance(calendarYear, calendarMonth);
  }, [
    authLoading,
    isAuthenticated,
    accessToken,
    calendarYear,
    calendarMonth,
    fetchAttendance,
  ]);

  /* Ignore any in-flight response after the page unmounts */
  useEffect(() => {
    const requestCounter = attendanceRequestId;

    return () => {
      requestCounter.current += 1;
    };
  }, []);

  /* =======================================================
     ATTENDANCE CALENDAR HELPERS
  ======================================================= */

  const recordsByDate = useMemo(() => {
    const map = new Map();

    attendanceRecords.forEach((record) => {
      if (record?.date) {
        map.set(String(record.date).slice(0, 10), record);
      }
    });

    return map;
  }, [attendanceRecords]);

  const getAttendanceRecord = (dateKey) => recordsByDate.get(dateKey) || null;

  /* No record  =>  NOT_ENTERED  (never ABSENT) */
  const getAttendanceStatus = (dateKey) => {
    const record = getAttendanceRecord(dateKey);

    if (!record) return "NOT_ENTERED";

    return normalizeStatus(record.status);
  };

  const getDayInfo = (day) => {
    const dateKey = toDateKey(calendarYear, calendarMonth, day);

    return {
      dateKey,
      status: getAttendanceStatus(dateKey),
    };
  };

  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();

  /* Monday-first grid: Mon = 0 ... Sun = 6 */
  const leadingBlanks =
    (new Date(calendarYear, calendarMonth - 1, 1).getDay() + 6) % 7;

  const attendanceCounts = useMemo(() => {
    const counts = {
      present: 0,
      notEntered: 0,
      leave: 0,
      halfDay: 0,
      off: 0,
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = toDateKey(calendarYear, calendarMonth, day);

      const record = recordsByDate.get(dateKey);

      const status = record ? normalizeStatus(record.status) : "NOT_ENTERED";

      if (status === "PRESENT") counts.present += 1;
      else if (status === "HALF_DAY") counts.halfDay += 1;
      else if (status === "ABSENT" || status === "LEAVE") counts.leave += 1;
      else if (status === "HOLIDAY" || status === "WEEKLY_OFF")
        counts.off += 1;
      else counts.notEntered += 1;
    }

    return counts;
  }, [recordsByDate, calendarYear, calendarMonth, daysInMonth]);

  const changeMonth = (delta) => {
    /* Day 1 avoids month-overflow bugs (e.g. Oct 31 -> "Nov 31") */
    const next = new Date(calendarYear, calendarMonth - 1 + delta, 1);

    const nextYear = next.getFullYear();

    const nextMonth = next.getMonth() + 1;

    const today = getTodayParts();

    setCalendarDate(next);

    setSelectedDateKey(
      nextYear === today.year && nextMonth === today.month
        ? toDateKey(nextYear, nextMonth, today.day)
        : toDateKey(nextYear, nextMonth, 1),
    );
  };

  const handlePrevMonth = () => changeMonth(-1);

  const handleNextMonth = () => changeMonth(1);

  const handleRetryAttendance = () => {
    fetchAttendance(calendarYear, calendarMonth);
  };

  /* =======================================================
     FALLBACK DATA
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

  /* =======================================================
     INITIALS
  ======================================================= */

  const initials = useMemo(() => {
    const username = data.username || "User";

    const parts = username.trim().split(/\s+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return username.slice(0, 2).toUpperCase();
  }, [data.username]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = [
    {
      icon: <IconBriefcase />,
      label: "ROLE",
      value: data.role,
      tone: "blue",
    },
    {
      icon: <IconBuilding />,
      label: "DEPARTMENT",
      value: data.department,
      tone: "green",
    },
    {
      icon: <IconCalendar />,
      label: "JOINED",
      value: data.joiningDate,
      tone: "orange",
    },
    {
      icon: <IconClock />,
      label: "LAST LOGIN",
      value: data.lastLogin,
      tone: "gray",
    },
  ];

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleBack = () => {
    navigate(-1);
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleSignOut = async () => {
    await logout();

    navigate("/material-planning/login", { replace: true });
  };

  /* =======================================================
     PROFILE PHOTO UPLOAD
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

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      setProfileData(response.data.data);

      setPhotoToast("Profile photo updated.");

      setTimeout(() => setPhotoToast(null), 2600);
    } catch (error) {
      console.error("Photo upload failed:", error);

      if (error.response?.status === 401) {
        setPhotoError("Your session has expired. Please sign in again.");
      } else {
        setPhotoError(
          error.response?.data?.message ||
            "Unable to upload photo. Please try again.",
        );
      }
    } finally {
      setPhotoUploading(false);

      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  /* =======================================================
     PROFILE PHOTO REMOVE
  ======================================================= */

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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      setProfileData(response.data.data);

      setPhotoToast("Profile photo removed.");

      setTimeout(() => setPhotoToast(null), 2600);
    } catch (error) {
      console.error("Photo remove failed:", error);

      if (error.response?.status === 401) {
        setPhotoError("Your session has expired. Please sign in again.");
      } else {
        setPhotoError(
          error.response?.data?.message ||
            "Unable to remove photo. Please try again.",
        );
      }
    } finally {
      setPhotoRemoving(false);
    }
  };

  /* =======================================================
     PASSWORD MODAL
  ======================================================= */

  const openPasswordModal = () => {
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setPasswordError("");
    setPasswordFieldErrors({});
    setPasswordUpdated(false);

    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (passwordLoading) {
      return;
    }

    setIsPasswordModalOpen(false);

    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setPasswordError("");
    setPasswordFieldErrors({});
    setPasswordUpdated(false);
  };

  /* =======================================================
     PASSWORD FIELD
  ======================================================= */

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setPasswordError("");

    setPasswordFieldErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  };

  /* =======================================================
     PASSWORD VALIDATION
  ======================================================= */

  const validatePassword = () => {
    const errors = {};

    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword) {
      errors.oldPassword = "Current password is required.";
    }

    if (!newPassword) {
      errors.newPassword = "New password is required.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    }

    if (newPassword && (newPassword.length < 8 || newPassword.length > 32)) {
      errors.newPassword = "Password must be 8–32 characters.";
    }

    if (newPassword && !/[A-Z]/.test(newPassword)) {
      errors.newPassword =
        "Password must contain at least one uppercase letter.";
    }

    if (newPassword && !/[a-z]/.test(newPassword)) {
      errors.newPassword =
        "Password must contain at least one lowercase letter.";
    }

    if (newPassword && !/[0-9]/.test(newPassword)) {
      errors.newPassword = "Password must contain at least one number.";
    }

    if (newPassword && !/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword =
        "Password must contain at least one special character.";
    }

    if (oldPassword && newPassword && oldPassword === newPassword) {
      errors.newPassword =
        "New password must be different from the current password.";
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword =
        "New password and confirm password do not match.";
    }

    setPasswordFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  /* =======================================================
     PASSWORD SUBMIT
  ======================================================= */

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    setPasswordError("");

    if (!validatePassword()) {
      return;
    }

    if (!accessToken) {
      setPasswordError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setPasswordLoading(true);

      console.log("Changing password with access token:", !!accessToken);

      const response = await api.post(
        "/erp/profile/change-password/",
        {
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      console.log("Change password response:", response.data);

      if (response.data?.success) {
        setPasswordUpdated(true);

        setPasswordForm({
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        setPasswordFieldErrors({});
      } else {
        setPasswordError(response.data?.message || "Password change failed.");
      }
    } catch (error) {
      console.error("Change password error:", error);
      console.error("Status:", error.response?.status);
      console.error("Response:", error.response?.data);

      if (error.response?.status === 401) {
        setPasswordError("Your session has expired. Please sign in again.");
        return;
      }

      const responseData = error.response?.data;

      if (responseData?.errors) {
        setPasswordFieldErrors(responseData.errors);
      }

      setPasswordError(
        responseData?.message || "Unable to change password. Please try again.",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  /* =======================================================
     PASSWORD REQUIREMENTS
  ======================================================= */

  const passwordRequirements = [
    {
      label: "8–32 characters",
      valid:
        passwordForm.newPassword.length >= 8 &&
        passwordForm.newPassword.length <= 32,
    },
    {
      label: "One uppercase letter",
      valid: /[A-Z]/.test(passwordForm.newPassword),
    },
    {
      label: "One lowercase letter",
      valid: /[a-z]/.test(passwordForm.newPassword),
    },
    {
      label: "One number",
      valid: /[0-9]/.test(passwordForm.newPassword),
    },
    {
      label: "One special character",
      valid: /[^A-Za-z0-9]/.test(passwordForm.newPassword),
    },
    {
      label: "Different from current password",
      valid:
        Boolean(passwordForm.newPassword) &&
        passwordForm.newPassword !== passwordForm.oldPassword,
    },
  ];

  /* =======================================================
     SIDEBAR NAVIGATION (scroll to sections of this page)
  ======================================================= */

  const scrollToSection = (navKey, elementId) => {
    setActiveNav(navKey);

    const element = document.getElementById(elementId);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* =======================================================
     AUTH / PROFILE LOADING
  ======================================================= */

  if (authLoading || profileLoading) {
    return <Loading />;
  }

  /* =======================================================
     PROFILE ERROR
  ======================================================= */

  if (profileError) {
    return <Error />;
  }

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
              className={
                "profile-nav-item" + (activeNav === "profile" ? " is-active" : "")
              }
              onClick={() => scrollToSection("profile", "profile-top")}
            >
              <IconUser />
              <span>Profile</span>
            </button>

            <button
              type="button"
              className={
                "profile-nav-item" +
                (activeNav === "attendance" ? " is-active" : "")
              }
              onClick={() =>
                scrollToSection("attendance", "profile-attendance-calendar")
              }
            >
              <IconCalendar />
              <span>Attendance</span>
            </button>

            <button
              type="button"
              className={
                "profile-nav-item" + (activeNav === "hours" ? " is-active" : "")
              }
              onClick={() => scrollToSection("hours", "profile-work-hours")}
            >
              <IconClock />
              <span>Work Hours</span>
            </button>

            <button
              type="button"
              className="profile-nav-item"
              onClick={openPasswordModal}
            >
              <IconLock />
              <span>Security</span>
            </button>

            <button
              type="button"
              className="profile-nav-item"
              onClick={handleBack}
            >
              <IconArrowLeft />
              <span>Go Back</span>
            </button>
          </nav>

          <div className="profile-side-promo">
            <div className="profile-side-promo-icon">
              <IconShield />
            </div>

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
          {/* TOP BAR */}
          <div className="profile-topbar">
            <div className="profile-search-bar">
              <button
                type="button"
                className="profile-back-btn"
                onClick={handleBack}
                aria-label="Back"
              >
                <IconArrowLeft />
              </button>

              <div className="profile-search-text">
                <span className="profile-search-title">Profile</span>

                <span className="profile-search-sub">
                  View your account information and attendance
                </span>
              </div>
            </div>
          </div>

          <div className="profile-top-actions">
            <div className="profile-top-user">
              <span className="profile-top-avatar">
                {data.profilePhoto ? (
                  <img src={data.profilePhoto} alt="" />
                ) : (
                  initials
                )}
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

                    {/* Upload (pencil) */}
                    <button
                      type="button"
                      className="profile-avatar-edit"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={photoUploading || photoRemoving}
                      title={
                        photoUploading ? "Uploading…" : "Change profile photo"
                      }
                      aria-label="Change profile photo"
                    >
                      {photoUploading ? (
                        <span className="profile-avatar-spinner" />
                      ) : (
                        <IconPencil />
                      )}
                    </button>

                    {/* Remove (trash) — only when a photo exists */}
                    {data.profilePhoto && (
                      <button
                        type="button"
                        className="profile-avatar-remove"
                        onClick={handlePhotoRemove}
                        disabled={photoUploading || photoRemoving}
                        title={
                          photoRemoving ? "Removing…" : "Remove profile photo"
                        }
                        aria-label="Remove profile photo"
                      >
                        {photoRemoving ? (
                          <span className="profile-avatar-spinner" />
                        ) : (
                          <IconTrash />
                        )}
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

                  {photoError && (
                    <p className="profile-avatar-error">{photoError}</p>
                  )}
                </div>

                <div className="profile-hero-info">
                  <h2 className="profile-hero-name">{data.username}</h2>

                  <p
                    className={
                      "profile-hero-email" +
                      (data.email === "Not available" ? " is-muted" : "")
                    }
                  >
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
              {stats.map((stat, index) => (
                <StatCard key={index} {...stat} />
              ))}
            </div>

            {/* ATTENDANCE SUMMARY (big card, like the reference chart card) */}
            <AttendanceSummary
              monthLabel={`${MONTH_NAMES[calendarMonth - 1]} ${calendarYear}`}
              counts={attendanceCounts}
              unavailable={attendanceLoading || Boolean(attendanceError)}
            />

            {/* BOTTOM ROW: Personal info + Work hours */}
            <div className="profile-main-grid">
              <div className="profile-card profile-info-card">
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
                  <InfoItem
                    icon={<IconUser />}
                    label="Username"
                    value={data.username}
                  />

                  <InfoItem
                    icon={<IconMail />}
                    label="Email"
                    value={data.email}
                  />

                  <InfoItem
                    icon={<IconPhone />}
                    label="Phone"
                    value={data.phone}
                  />

                  <InfoItem
                    icon={<IconBriefcase />}
                    label="Role"
                    value={data.role}
                  />

                  <InfoItem
                    icon={<IconBuilding />}
                    label="Department"
                    value={data.department}
                  />

                  <InfoItem
                    icon={<IconGlobe />}
                    label="Employee ID"
                    value={data.employeeId}
                  />
                </div>

                <div className="profile-info-footer">
                  <p className="profile-info-note">
                    <IconInfo />
                    Information is managed by HR/Admin. Contact your HR
                    department for updates.
                  </p>
                </div>
              </div>

              <div className="profile-sidebar" id="profile-work-hours">
                <WorkHoursCard
                  hoursWorked={hoursWorked}
                  targetHours={targetHours}
                  sublabel={workHoursSublabel}
                  muted={!todayAttendance}
                />
              </div>
            </div>
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
              loading={attendanceLoading}
              error={attendanceError}
              errorStatus={attendanceErrorStatus}
              onRetry={handleRetryAttendance}
              onSignIn={handleSignOut}
            />

            {!attendanceError && !attendanceLoading && (
              <AttendanceDetails
                dateKey={selectedDateKey}
                record={getAttendanceRecord(selectedDateKey)}
                status={getAttendanceStatus(selectedDateKey)}
              />
            )}
          </aside>
        </div>
      </div>

      {/* PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div
          className="profile-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePasswordModal();
            }
          }}
        >
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="profile-modal-header">
              <div>
                <h2 id="change-password-title" className="profile-modal-title">
                  Change Password
                </h2>

                <p className="profile-modal-subtitle">
                  Update your account password
                </p>
              </div>

              {!passwordLoading && (
                <button
                  type="button"
                  className="profile-modal-close"
                  onClick={closePasswordModal}
                  aria-label="Close"
                >
                  <IconClose />
                </button>
              )}
            </div>

            {passwordUpdated ? (
              <div className="profile-modal-success">
                <div className="profile-modal-success-icon">
                  <IconShield />
                </div>

                <p>Password updated successfully!</p>

                <button
                  type="button"
                  className="profile-btn-primary"
                  onClick={() => setIsPasswordModalOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} noValidate>
                <div className="profile-form-group">
                  <label htmlFor="oldPassword">Current Password</label>

                  <input
                    id="oldPassword"
                    type="password"
                    name="oldPassword"
                    value={passwordForm.oldPassword}
                    onChange={handlePasswordFieldChange}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    disabled={passwordLoading}
                  />

                  {passwordFieldErrors.oldPassword && (
                    <p className="profile-field-error">
                      {passwordFieldErrors.oldPassword}
                    </p>
                  )}
                </div>

                <div className="profile-form-group">
                  <label htmlFor="newPassword">New Password</label>

                  <input
                    id="newPassword"
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordFieldChange}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    disabled={passwordLoading}
                  />

                  {passwordFieldErrors.newPassword && (
                    <p className="profile-field-error">
                      {passwordFieldErrors.newPassword}
                    </p>
                  )}
                </div>

                <div className="profile-password-rules">
                  <span>Password requirements</span>

                  <ul>
                    {passwordRequirements.map((requirement, index) => (
                      <li
                        key={index}
                        className={requirement.valid ? "valid" : ""}
                      >
                        {requirement.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="profile-form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>

                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFieldChange}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    disabled={passwordLoading}
                  />

                  {passwordFieldErrors.confirmPassword && (
                    <p className="profile-field-error">
                      {passwordFieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                {passwordError && (
                  <p className="profile-error">{passwordError}</p>
                )}

                <div className="profile-modal-actions">
                  <button
                    type="button"
                    className="profile-btn-secondary"
                    onClick={closePasswordModal}
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-btn-primary"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PHOTO TOAST */}
      {photoToast && (
        <div className="emp-toast" role="status">
          {photoToast}
        </div>
      )}
    </div>
  );
}