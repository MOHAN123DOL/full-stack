// Profile.jsx - Complete working version
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Profile.css";

/* ---------- helpers ---------- */
const getInitials = (name) => {
  if (!name) return "U";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
};

/* ---------- inline icons ---------- */
const IconArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M19 12H5M12 19L5 12L12 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="7"
      r="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 6L12 13L2 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 16.92V19.92C22.0011 20.5585 21.8466 21.188 21.5509 21.7518C21.2552 22.3156 20.827 22.795 20.3 23.14C19.7862 23.4671 19.2049 23.677 18.5975 23.7541C17.9901 23.8311 17.3748 23.7734 16.79 23.59C14.4291 22.8931 12.2288 21.7461 10.3 20.22C8.41903 18.7521 6.81702 16.9714 5.56 14.95C4.06355 12.8624 2.98805 10.5165 2.4 8.03C2.22801 7.44522 2.18912 6.83311 2.28542 6.23225C2.38172 5.63139 2.61104 5.06124 2.95 4.57C3.30178 4.04867 3.78365 3.63078 4.35 3.36C4.91634 3.08921 5.54375 2.97464 6.17 3.03H9.17C9.68436 2.97611 10.2041 3.08013 10.6575 3.32779C11.111 3.57545 11.4735 3.95397 11.69 4.42L13.14 7.32C13.3493 7.77679 13.4055 8.29598 13.2991 8.79171C13.1927 9.28743 12.9298 9.72567 12.56 10.04L10.86 11.53C11.5629 12.9298 12.5996 14.1457 13.88 15.07L15.37 13.37C15.6843 13.0002 16.1226 12.7373 16.6183 12.6309C17.114 12.5245 17.6332 12.5807 18.09 12.79L21.01 14.24C21.4734 14.458 21.8489 14.8221 22.0953 15.2762C22.3417 15.7303 22.4451 16.2497 22.39 16.76"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="2"
      y="7"
      width="20"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 21V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="4"
      y="2"
      width="16"
      height="20"
      rx="1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 22V18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M15 22V18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M8 6H10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M14 6H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M8 10H10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M14 10H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M8 2V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M16 2V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 6V12L16 14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12L11 14L15 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      x="3"
      y="11"
      width="18"
      height="11"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="2"
      y1="12"
      x2="22"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z"
      stroke="currentColor"
      strokeWidth="2"
    />
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
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
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

/* ---------- reusable components ---------- */
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

function CircularProgress({ value, max, label, sublabel }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((value / max) * 100, 100);
  const offset = circumference - (progress / 100) * circumference;

  const getColor = () => {
    const ratio = value / max;
    if (ratio >= 0.8) return "#2F7A4F";
    if (ratio >= 0.5) return "#C98A1D";
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
        />
      </svg>
      <div className="profile-circular-content">
        <span className="profile-circular-value">{timeDisplay}</span>
        <span className="profile-circular-label">{label}</span>
        {sublabel && (
          <span className="profile-circular-sublabel">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

function WorkHoursCard({ hoursWorked, targetHours }) {
  const isComplete = hoursWorked >= targetHours;
  const progress = Math.min((hoursWorked / targetHours) * 100, 100);

  return (
    <div className="profile-card profile-work-hours-card">
      <div className="profile-work-hours-header">
        <div>
          <h3 className="profile-card-title">Today's Work Hours</h3>
          <p className="profile-card-subtitle">Daily progress tracker</p>
        </div>
        <span
          className={
            "profile-work-status" +
            (isComplete ? " is-complete" : " is-progress")
          }
        >
          {isComplete ? "Target met" : "In progress"}
        </span>
      </div>

      <div className="profile-work-hours-content">
        <CircularProgress
          value={hoursWorked}
          max={targetHours}
          label="Hours worked"
          sublabel={`Target: ${targetHours}h`}
        />

        <div className="profile-work-hours-details">
          <div className="profile-work-hours-stat">
            <span className="profile-work-hours-stat-label">Progress</span>
            <span className="profile-work-hours-stat-value">
              {Math.round(progress)}%
            </span>
            <div className="profile-work-hours-bar">
              <div
                className="profile-work-hours-bar-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <div className="profile-work-hours-stat">
            <span className="profile-work-hours-stat-label">Remaining</span>
            <span className="profile-work-hours-stat-value">
              {Math.max(0, targetHours - hoursWorked).toFixed(1)}h
            </span>
          </div>
          <div className="profile-work-hours-stat">
            <span className="profile-work-hours-stat-label">Status</span>
            <span className="profile-work-hours-stat-value">
              {isComplete ? "Complete" : "Working"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function Profile() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [hoursWorked, setHoursWorked] = useState(0);
  const targetHours = 8;

  useEffect(() => {
    const loginTime = localStorage.getItem("loginTime");
    if (loginTime) {
      const login = new Date(loginTime);
      const now = new Date();
      const diffHours = (now - login) / (1000 * 60 * 60);
      setHoursWorked(Math.min(diffHours, targetHours));
    } else {
      setHoursWorked(Math.round(Math.random() * targetHours * 10) / 10);
    }
  }, []);
  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const handleBack = () => navigate(-1);

  const profileData = {
    username: user?.username || "User",
    accountId: user?.accountId || "Not available",
    email: user?.email || "Not available",
    phone: user?.phone || "Not available",
    role: user?.role || "Not available",
    department: user?.department || "Not available",
    employeeId: user?.employeeId || "Not available",
    joiningDate: user?.joiningDate || "Not available",
    lastLogin: user?.lastLogin || "Not available",
  };

  const initials = getInitials(user?.username);

  const stats = [
    {
      icon: <IconBriefcase />,
      label: "Role",
      value: profileData.role,
      tone: "primary",
    },
    {
      icon: <IconBuilding />,
      label: "Department",
      value: profileData.department,
      tone: "success",
    },
    {
      icon: <IconCalendar />,
      label: "Joined",
      value: profileData.joiningDate,
      tone: "warning",
    },
    {
      icon: <IconClock />,
      label: "Last Login",
      value: profileData.lastLogin,
      tone: "neutral",
    },
  ];

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const openPasswordModal = () => {
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError("");
    setPasswordSuccess(false);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordFieldChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordError) setPasswordError("");
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    if (newPassword === oldPassword) {
      setPasswordError(
        "New password must be different from the current password.",
      );
      return;
    }

    setPasswordError("");
    setPasswordSuccess(true);
  };

  return (
    <div className="profile-page">
      {/* Navbar */}
      <div className="profile-navbar">
        <div className="profile-navbar-inner">
          <button
            type="button"
            className="profile-back-btn"
            onClick={handleBack}
          >
            {/* your existing back icon */}
            Back
          </button>

          <button
            type="button"
            className="profile-logout-btn"
            onClick={handleSignOut}
            title="Logout"
          >
            <div className="profile-logout-sign">
              <svg viewBox="0 0 512 512" aria-hidden="true">
                <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
              </svg>
            </div>

            <span className="profile-logout-text">Logout</span>
          </button>
        </div>
      </div>

      <div className="profile-page-inner">
        {/* Header */}
        <div className="profile-header">
          <div>
            <h1 className="profile-title">Profile</h1>
            <p className="profile-subtitle">
              View your account information and security settings
            </p>
          </div>
        </div>

        {/* Hero */}
        <div className="profile-hero">
          <div className="profile-hero-content">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar">
                <span>{initials}</span>
              </div>
              <span className="profile-status-badge">
                <span className="profile-status-dot"></span>
                Active
              </span>
            </div>
            <div className="profile-hero-info">
              <h2 className="profile-hero-name">{profileData.username}</h2>
              <p
                className={
                  "profile-hero-email" +
                  (profileData.email === "Not available" ? " is-muted" : "")
                }
              >
                {profileData.email}
              </p>
              <div className="profile-hero-tags">
                <span className="profile-tag">ERP Account</span>
                <span className="profile-tag">ID: {profileData.accountId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats-grid">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* Main Grid */}
        <div className="profile-main-grid">
          {/* Personal Information */}
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
                value={profileData.username}
              />
              <InfoItem
                icon={<IconMail />}
                label="Email"
                value={profileData.email}
              />
              <InfoItem
                icon={<IconPhone />}
                label="Phone"
                value={profileData.phone}
              />
              <InfoItem
                icon={<IconBriefcase />}
                label="Role"
                value={profileData.role}
              />
              <InfoItem
                icon={<IconBuilding />}
                label="Department"
                value={profileData.department}
              />
              <InfoItem
                icon={<IconGlobe />}
                label="Employee ID"
                value={profileData.employeeId}
              />
            </div>
            <div className="profile-info-footer">
              <p className="profile-info-note">
                <IconInfo />
                Information is managed by HR/Admin. Contact your HR department
                for updates.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="profile-sidebar">
            {/* Security */}
            <div className="profile-card profile-security-card">
              <div className="profile-card-header">
                <div>
                  <h3 className="profile-card-title">Security</h3>
                  <p className="profile-card-subtitle">Manage your password</p>
                </div>
                <div className="profile-card-icon shield">
                  <IconShield />
                </div>
              </div>

              <div className="profile-security-item">
                <div className="profile-security-icon">
                  <IconLock />
                </div>
                <div className="profile-security-text">
                  <span className="profile-security-label">Password</span>
                  <span className="profile-security-value">••••••••••••</span>
                </div>
              </div>

              <button
                type="button"
                className="profile-change-password-btn"
                onClick={openPasswordModal}
              >
                Change Password
              </button>
            </div>

            {/* Work Hours */}
            <WorkHoursCard
              hoursWorked={hoursWorked}
              targetHours={targetHours}
            />
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div
          className="profile-modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsPasswordModalOpen(false);
          }}
        >
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <div className="profile-modal-header">
              <div className="profile-modal-icon">
                <IconLock />
              </div>
              <h3 id="change-password-title">Change Password</h3>
              <button
                type="button"
                className="profile-modal-close"
                aria-label="Close"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                <IconClose />
              </button>
            </div>

            {passwordSuccess ? (
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
                  />
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
                  />
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
                  />
                </div>
                {passwordError && (
                  <p className="profile-error">{passwordError}</p>
                )}
                <div className="profile-modal-actions">
                  <button
                    type="button"
                    className="profile-btn-secondary"
                    onClick={() => setIsPasswordModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="profile-btn-primary">
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
