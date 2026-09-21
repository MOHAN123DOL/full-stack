import { useEffect, useMemo, useState } from "react";
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

function CircularProgress({ value, max, label, sublabel }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min((value / max) * 100, 100);

  const offset = circumference - (progress / 100) * circumference;

  const getColor = () => {
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

function WorkHoursCard({ hoursWorked, targetHours }) {
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
        sublabel={`Target ${targetHours}h`}
      />
    </div>
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

  const [hoursWorked] = useState(0);

  const targetHours = 8;

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

        if (response.data?.success) {
          setProfileData(response.data.data);
        } else {
          setProfileError(true);
        }
      } catch (error) {
        console.error("Profile API error:", error);
        console.error("Status:", error.response?.status);
        console.error("Response:", error.response?.data);

        setProfileError(true);
      } finally {
        setProfileLoading(false);
      }
    };

    /*
     * Do NOT call the profile API until:
     *
     * 1. Auth restore has completed
     * 2. User is authenticated
     * 3. Access token exists
     */
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
    setPasswordError(
      "Your session has expired. Please sign in again."
    );
    return;
  }

  try {
    setPasswordLoading(true);

    console.log(
      "Changing password with access token:",
      !!accessToken
    );

    const response = await api.post(
      "/erp/profile/change-password/",
      {
        oldPassword:
          passwordForm.oldPassword,

        newPassword:
          passwordForm.newPassword,

        confirmPassword:
          passwordForm.confirmPassword,
      },
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

    console.log(
      "Change password response:",
      response.data
    );

    if (response.data?.success) {
      setPasswordUpdated(true);

      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordFieldErrors({});
    } else {
      setPasswordError(
        response.data?.message ||
          "Password change failed."
      );
    }
  } catch (error) {
    console.error(
      "Change password error:",
      error
    );

    console.error(
      "Status:",
      error.response?.status
    );

    console.error(
      "Response:",
      error.response?.data
    );

    if (error.response?.status === 401) {
      setPasswordError(
        "Your session has expired. Please sign in again."
      );
      return;
    }

    const responseData =
      error.response?.data;

    if (responseData?.errors) {
      setPasswordFieldErrors(
        responseData.errors
      );
    }

    setPasswordError(
      responseData?.message ||
        "Unable to change password. Please try again."
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
      {/* =================================================
          TOP BAR
      ================================================= */}

      <div className="profile-topbar">
        <button type="button" className="profile-back-btn" onClick={handleBack}>
          <IconArrowLeft />
          <span>Back</span>
        </button>

        <button
          type="button"
          className="profile-logout-btn"
          onClick={handleSignOut}
          title="Logout"
        >
          <IconLogout />
        </button>
      </div>

      {/* =================================================
          PAGE INNER
      ================================================= */}

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

        {/* =================================================
            HERO
        ================================================= */}

        <div className="profile-hero">
          <div className="profile-hero-content">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar">
                {data.profilePhoto ? (
                  <img src={data.profilePhoto} alt="Profile" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              <span className="profile-status-badge">
                <span className="profile-status-dot"></span>
                Active
              </span>
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

                <span className="profile-tag">ID: {data.accountId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            STATS
        ================================================= */}

        <div className="profile-stats-grid">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div className="profile-main-grid">
          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

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

              <InfoItem icon={<IconMail />} label="Email" value={data.email} />

              <InfoItem icon={<IconPhone />} label="Phone" value={data.phone} />

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
                Information is managed by HR/Admin. Contact your HR department
                for updates.
              </p>
            </div>
          </div>

          {/* =================================================
              SIDEBAR
          ================================================= */}

          <div className="profile-sidebar">
            {/* SECURITY */}

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

            {/* WORK HOURS */}

            <WorkHoursCard
              hoursWorked={hoursWorked}
              targetHours={targetHours}
            />
          </div>
        </div>
      </div>

      {/* =================================================
          PASSWORD MODAL
      ================================================= */}

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
            {/* Modal header */}

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

            {/* =================================================
                SUCCESS
            ================================================= */}

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
              /* =================================================
                 PASSWORD FORM
              ================================================= */

              <form onSubmit={handlePasswordSubmit} noValidate>
                {/* Current password */}

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

                {/* New password */}

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

                {/* Password requirements */}

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

                {/* Confirm password */}

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

                {/* General error */}

                {passwordError && (
                  <p className="profile-error">{passwordError}</p>
                )}

                {/* Actions */}

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
    </div>
  );
}
