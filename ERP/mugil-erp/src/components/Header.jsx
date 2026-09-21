
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

import "./Header.css";

export default function Header({ navLinks = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const [supportOpen, setSupportOpen] = useState(false);

  const username = user?.username || "User";

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  const handleSupportToggle = () => {
    setSupportOpen((previous) => !previous);
  };

  const handleHelp = () => {
    setSupportOpen(false);
    navigate("/help");
  };

  const handleContactUs = () => {
  setSupportOpen(false);
  navigate("/contact");
};

  return (
    <header className="erp-header">

      {/* BRAND */}
      <div className="erp-brand">
        <span className="erp-brand-line" />

        <span className="erp-brand-name">
          Mugil Engineering Industry
        </span>
      </div>


      {/* RIGHT SIDE */}
      <div className="erp-user-area">

        {/* CUSTOM PAGE NAVIGATION */}
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

        {navLinks.length > 0 && (
          <span className="erp-action-divider" />
        )}


        {/* PROFILE */}
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

          {/* PROFILE HOVER CARD */}
          <div className="erp-profile-hover-card">
            <div className="erp-profile-card-loader" />

            <div className="erp-profile-card-title">
              {username}
            </div>

            <div className="erp-profile-card-description">
              ERP User
            </div>
          </div>

        </div>


        {/* SUPPORT */}
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


        {/* VERTICAL SEPARATOR */}
        <span className="erp-action-divider" />


        {/* SIGN OUT */}
        <button
          type="button"
          className="erp-header-action erp-signout-action"
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
            Sign Out
          </span>

          <span className="erp-signout-hover-text">
            Thanks!
          </span>
        </button>

      </div>
    </header>
  );
}