import { useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import { LayoutDashboard } from "lucide-react";

import { useEffect, useState } from "react";

import api from "../api/axios";

import "./Header.css";

export default function Header({ navLinks = [] }) {
  const navigate = useNavigate();

  const location = useLocation();

  const { logout, user, accessToken, isAuthenticated } = useAuth();

  // Show the Admin Dashboard shortcut only to Admin users.

  const userType = String(user?.user_type ?? user?.userType ?? user?.role ?? "")
    .trim()

    .toLowerCase();

  const isAdmin = userType === "admin" || userType === "administrator";

  const [supportOpen, setSupportOpen] = useState(false);

  const [profileData, setProfileData] = useState(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const username = profileData?.username || user?.username || "User";

  /*

   * LOAD PROFILE DATA

   */

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);

        const response = await api.get("/erp/profile/", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (mounted && response.data?.success) {
          setProfileData(response.data.data);
        }
      } catch (error) {
        console.error("Header profile API error:", error);
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, accessToken]);

  /*

   * GENERATED AVATAR

   */

  // Match the employee-directory avatar colours and initials.
  const getAvatarUrl = () => {
    const colors = [
      "0F766E",
      "1D4ED8",
      "7C3AED",
      "B45309",
      "0369A1",
      "15803D",
      "BE185D",
    ];
    const name =
      profileData?.firstName && profileData?.lastName
        ? `${profileData.firstName} ${profileData.lastName}`
        : profileData?.first_name && profileData?.last_name
          ? `${profileData.first_name} ${profileData.last_name}`
          : profileData?.username || user?.username || "User";
    const rawSeed = Number(
      profileData?.id ?? profileData?.employee_id ?? user?.id ?? 0,
    );
    const seed = Number.isFinite(rawSeed) ? Math.abs(rawSeed) : 0;
    const background = colors[seed % colors.length];

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name,
    )}&background=${background}&color=fff&size=128&font-size=0.38&bold=true`;
  };

  /*

   * SIGN OUT

   */

  const getDepartmentLoginPath = () => {
    // Prefer the authenticated user role, then profile API data.

    const rawDepartment =
      user?.user_type ??
      user?.userType ??
      user?.user_type_name ??
      user?.department ??
      user?.role ??
      profileData?.user_type ??
      profileData?.userType ??
      profileData?.user_type_name ??
      profileData?.department ??
      profileData?.role ??
      "";

    const department = String(rawDepartment)
      .trim()

      .toLowerCase()

      .replace(/[_**\\\**&#x73;]+/g, "-");

    // Match role/department names to their own login pages.

    if (department.includes("admin")) return "/admin/login";

    if (department.includes("hr") || department.includes("human-resource")) {
      return "/hr/login";
    }

    if (department.includes("material")) return "/material-planning/login";

    if (department.includes("account") || department.includes("finance")) {
      return "/accounts/login";
    }

    if (department.includes("production")) return "/production/login";

    if (department.includes("supervisor")) return "/supervisor/login";

    // Fallback: infer department from the current URL if user/profile data

    // does not contain a recognizable department.

    const path = location.pathname.toLowerCase();

    if (path.startsWith("/admin")) return "/admin/login";

    if (path.startsWith("/hr")) return "/hr/login";

    if (
      path.startsWith("/material-planning") ||
      path.startsWith("/inventory")
    ) {
      return "/material-planning/login";
    }

    if (path.startsWith("/accounts")) return "/accounts/login";

    if (path.startsWith("/production")) return "/production/login";

    if (path.startsWith("/supervisor")) return "/supervisor/login";

    // Unknown department: return to the department selection/login page.

    return "/welcome";
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;

    const loginPath = getDepartmentLoginPath();
    setIsSigningOut(true);

    // Keep the thank-you state visible briefly before ending the session.
    await new Promise((resolve) => window.setTimeout(resolve, 1000));

    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      navigate(loginPath, { replace: true });
    }
  };

  /*

   * PROFILE

   */

  const handleProfile = () => {
    setSupportOpen(false);

    // Prefer the authenticated user's role. Fall back to profile API data

    // in case the auth object does not include a user type.

    const userType = String(
      user?.user_type ??
        user?.userType ??
        user?.user_type_name ??
        user?.role ??
        profileData?.user_type ??
        profileData?.userType ??
        profileData?.userTypeName ??
        profileData?.role ??
        "",
    )
      .trim()

      .toLowerCase();

    if (userType === "admin" || userType === "administrator") {
      navigate("/admin/profile");
    } else {
      navigate("/profile");
    }
  };

  /*

   * SUPPORT

   */

  const handleSupportToggle = () => {
    setSupportOpen((previous) => !previous);
  };

  /*

   * HELP

   */

  const handleHelp = () => {
    setSupportOpen(false);

    navigate("/help");
  };

  /*

   * CONTACT

   */

  const handleContactUs = () => {
    setSupportOpen(false);

    navigate("/contact");
  };

  return (
    <header className="erp-header">
      {/* BRAND */}

      <div className="erp-brand">
        <span className="erp-brand-line" />

        <span className="erp-brand-name">Mugil Engineering Industry</span>
      </div>

      {/* RIGHT SIDE */}

      <div className="erp-user-area">
        {/* CUSTOM NAVIGATION */}

        {navLinks.length > 0 && (
          <nav className="erp-custom-nav">
            {navLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                className={`erp-custom-nav-button ${
                  location.pathname.startsWith(link.path)
                    ? "erp-custom-nav-button-active"
                    : ""
                }`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            ))}
          </nav>
        )}

        {navLinks.length > 0 && <span className="erp-action-divider" />}

        {/* ADMIN DASHBOARD SHORTCUT — Admin only, hidden on Admin pages */}

        {isAuthenticated &&
          isAdmin &&
          !location.pathname.startsWith("/admin") && (
            <button
              type="button"
              className="erp-header-action erp-admin-dashboard-action"
              onClick={() => navigate("/admin/dashboard")}
              title="Return to Admin Dashboard"
            >
              <LayoutDashboard size={18} />

              <span>Admin Dashboard</span>
            </button>
          )}

        {/* =========================

            PROFILE

        ========================== */}

        <div className="erp-profile-wrapper">
          <button
            type="button"
            className="erp-header-action erp-profile-action"
            onClick={handleProfile}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="3.5" />

              <path d="M5 20c.8-3.4 3.1-5 7-5s6.2 1.6 7 5" />
            </svg>

            <span>Profile</span>
          </button>

          {/* =========================

              PROFILE HOVER CARD

          ========================== */}

          <div className="erp-profile-hover-card">
            {profileLoading ? (
              <div className="erp-profile-loading">Loading profile...</div>
            ) : (
              <>
                {/* PROFILE PHOTO */}

                <div className="erp-profile-card-avatar">
                  <img
                    src={profileData?.profilePhoto || getAvatarUrl()}
                    alt="Profile"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = getAvatarUrl();
                    }}
                  />
                </div>

                {/* USERNAME */}

                <div className="erp-profile-card-title">
                  {profileData?.username || username}
                </div>

                {/* ROLE */}

                <div className="erp-profile-card-role">
                  {profileData?.role || "ERP User"}
                </div>

                {/* DETAILS */}

                <div className="erp-profile-card-details">
                  {profileData?.employeeId && (
                    <div className="erp-profile-card-row">
                      <span>Employee ID</span>

                      <strong>{profileData.employeeId}</strong>
                    </div>
                  )}

                  {profileData?.department && (
                    <div className="erp-profile-card-row">
                      <span>Department</span>

                      <strong>{profileData.department}</strong>
                    </div>
                  )}

                  {profileData?.email && (
                    <div className="erp-profile-card-row">
                      <span>Email</span>

                      <strong>{profileData.email}</strong>
                    </div>
                  )}

                  {profileData?.phone && (
                    <div className="erp-profile-card-row">
                      <span>Phone</span>

                      <strong>{profileData.phone}</strong>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* =========================

            SUPPORT

        ========================== */}

        <div className="erp-support-wrapper">
          <button
            type="button"
            className={`erp-header-action erp-support-action ${
              supportOpen ? "erp-support-action-active" : ""
            }`}
            onClick={handleSupportToggle}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />

              <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.9 1-2 1.3-2 2.5" />

              <path d="M12 17h.01" />
            </svg>

            <span>Support</span>
          </button>

          {/* SUPPORT DROPDOWN */}

          {supportOpen && (
            <div className="erp-support-dropdown">
              <button
                type="button"
                className="erp-support-dropdown-option"
                onClick={handleHelp}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />

                  <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.9 1-2 1.3-2 2.5" />

                  <path d="M12 17h.01" />
                </svg>

                <span>Help</span>
              </button>

              <button
                type="button"
                className="erp-support-dropdown-option"
                onClick={handleContactUs}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />

                  <path d="m3 7 9 6 9-6" />
                </svg>

                <span>Contact Us</span>
              </button>
            </div>
          )}
        </div>

        {/* DIVIDER */}

        <span className="erp-action-divider" />

        {/* SIGN OUT */}

        <button
          type="button"
          className={`erp-header-action erp-signout-action${isSigningOut ? " is-signing-out" : ""}`}
          onClick={handleSignOut}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 17l5-5-5-5" />

            <path d="M15 12H3" />

            <path d="M21 3v18" />
          </svg>

          <span className="erp-signout-text">
            {isSigningOut ? "Thank you!" : "Sign Out"}
          </span>

          <span className="erp-signout-hover-text">Thank you!</span>
        </button>
      </div>
    </header>
  );
}
