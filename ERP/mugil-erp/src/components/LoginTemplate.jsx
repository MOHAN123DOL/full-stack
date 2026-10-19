import { useEffect, useRef, useState } from "react";
import {
  Settings,
  Users,
  Package,
  Wallet,
  ChevronDown,
  UserRound,
  LockKeyhole,
  ArrowRight,
  AlertTriangle,
  Check,
  Shield,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import industrialImage from "../assets/industrial-login.png";
import mugilLogo from "../assets/mugil-logo.png";
import "../styles/login.css";

const DEPARTMENTS = [
  {
    label: "Admin",
    value: "admin",
    loginPath: "/admin/login",
    icon: Settings,
    description: "Administration",
  },
  {
    label: "HR",
    value: "hr",
    loginPath: "/hr/login",
    icon: Users,
    description: "Human Resources",
  },
  {
    label: "Material Planning",
    value: "material-planning",
    loginPath: "/material-planning/login",
    icon: Package,
    description: "Material & Inventory",
  },
  {
    label: "Accounts",
    value: "accounts",
    loginPath: "/accounts/login",
    icon: Wallet,
    description: "Finance & Accounts",
  },
];

const DEFAULT_DEPARTMENT = DEPARTMENTS[0];
const AUTHENTICATION_DELAY_MS = 500;

function getDepartment(value) {
  return (
    DEPARTMENTS.find((department) => department.value === value) ??
    DEFAULT_DEPARTMENT
  );
}

export default function LoginTemplate({
  currentDepartment = DEFAULT_DEPARTMENT.value,
}) {
  const initialDepartment = getDepartment(currentDepartment);

  // -----------------------------
  // State
  // -----------------------------
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP Flow State
  const [otpRequired, setOtpRequired] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  const [department, setDepartment] = useState(initialDepartment.value);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // -----------------------------
  // Refs
  // -----------------------------
  const mountedRef = useRef(false);
  const dropdownRef = useRef(null);

  // -----------------------------
  // Hooks
  // -----------------------------
  const { login, loginVerifyOTP } = useAuth();
  const navigate = useNavigate();

  const selectedDepartment = getDepartment(department);
  const SelectedDepartmentIcon = selectedDepartment.icon;

  // -----------------------------
  // Component mounted
  // -----------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -----------------------------
  // Resend Timer Effect
  // -----------------------------
  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => {
      setResendSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  // -----------------------------
  // Update department
  // -----------------------------
  useEffect(() => {
    setDepartment(getDepartment(currentDepartment).value);
    setOtpRequired(false);
  }, [currentDepartment]);

  // -----------------------------
  // Page title
  // -----------------------------
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${selectedDepartment.label} Login`;
    return () => {
      document.title = previousTitle;
    };
  }, [selectedDepartment.label]);

  // -----------------------------
  // Close dropdown outside click
  // -----------------------------
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // -----------------------------
  // Close dropdown with Escape
  // -----------------------------
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // -----------------------------
  // Department change
  // -----------------------------
  const handleDepartmentChange = (nextDepartment) => {
    setDepartment(nextDepartment.value);
    setDropdownOpen(false);
    setError("");
    setOtpRequired(false);
    navigate(nextDepartment.loginPath);
  };

  // -----------------------------
  // Login Submit (Step 1: Password)
  // -----------------------------
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, AUTHENTICATION_DELAY_MS));
      if (!mountedRef.current) return;

      const result = await login(normalizedUsername, password, department);

      if (!mountedRef.current) return;

      // -----------------------------
      // Check if Backend requires OTP
      // -----------------------------
      if (result?.otp_required) {
        setOtpRequired(true);
        setResendSeconds(30); // Start 30s cooldown
        setLoading(false);
        return;
      }

      // -----------------------------
      // Successful Login (No OTP)
      // -----------------------------
      if (result?.success) {
        setLoading(false);
        handleRedirect(department);
        return;
      }

      // Login failed
      setPassword("");
      setError(result?.message || "Unable to sign in. Please try again.");
    } catch (err) {
      console.error("Login error:", err);
      if (!mountedRef.current) return;
      setPassword("");
      handleApiError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // -----------------------------
  // OTP Submit (Step 2: Verify)
  // -----------------------------
  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    if (loading || resendLoading) return;

    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await loginVerifyOTP(username, otp);
      if (!mountedRef.current) return;

      if (result?.success) {
        setLoading(false);
        handleRedirect("admin");
        return;
      }

      setOtp("");
      setError(result?.message || "Invalid or expired code.");
    } catch (err) {
      console.error("OTP verify error:", err);
      if (!mountedRef.current) return;
      setOtp("");
      handleApiError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // -----------------------------
  // Resend OTP Handler
  // -----------------------------
  const handleResendOtp = async () => {
    if (resendLoading || resendSeconds > 0) return;
    
    setResendLoading(true);
    setError("");

    try {
      // Re-trigger the login endpoint to generate a new OTP
      const result = await login(username, password, department);

      if (!mountedRef.current) return;

      if (result?.otp_required) {
        setOtp("");
        setResendSeconds(30); // Reset 30s cooldown
      } else {
        setError("Failed to resend code. Please log in again.");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError("Unable to resend code. Please try again.");
    } finally {
      if (mountedRef.current) setResendLoading(false);
    }
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  const handleRedirect = (dept) => {
    if (dept === "material-planning") navigate("/inventory", { replace: true });
    else if (dept === "hr") navigate("/hr/employees", { replace: true });
    else if (dept === "accounts") navigate("/accounts", { replace: true });
    else if (dept === "production") navigate("/inventory", { replace: true });
    else if (dept === "admin") navigate("/admin", { replace: true });
    else navigate("/welcome", { replace: true });
  };

  const handleApiError = (error) => {
    if (error?.response) {
      const responseData = error.response.data;
      let backendMessage = "";

      if (typeof responseData?.message === "string") backendMessage = responseData.message;
      else if (typeof responseData?.detail === "string") backendMessage = responseData.detail;
      else if (responseData?.errors) {
        backendMessage = Object.entries(responseData.errors)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
          .join(" | ");
      }
      setError(backendMessage || `Login failed (${error.response.status}).`);
      return;
    }
    if (error?.request) {
      setError("Unable to connect to the server.");
      return;
    }
    setError(error?.message || "Unable to sign in. Please try again.");
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="login-root" style={{ backgroundImage: `url(${industrialImage})` }}>
      <div className="login-bg-overlay" aria-hidden="true" />

      <section className="login-card-shell">
        <form
          className="uiverse-form"
          onSubmit={otpRequired ? handleVerifyOtp : handleSubmit}
          noValidate
        >
          {/* Logo */}
          <div className="uiverse-logo">
            <img src={mugilLogo} alt="Mugil Engineering Industries" />
          </div>

          {/* Heading */}
          <p className="uiverse-heading">
            {otpRequired ? "Verify Login" : `${selectedDepartment.label} Login`}
          </p>

          <p className="uiverse-subtitle">
            {otpRequired
              ? "Two-step authentication required"
              : "Mugil Industries ERP — Secure Access Portal"}
          </p>

          {/* Department (Hide if OTP required) */}
          {!otpRequired && (
            <div className="department-group">
              <label className="form-label" htmlFor="department-button">
                Department
              </label>

              <div className="department-dropdown" ref={dropdownRef}>
                <button
                  id="department-button"
                  type="button"
                  className={`department-trigger ${dropdownOpen ? "is-open" : ""}`}
                  onClick={() => setDropdownOpen((isOpen) => !isOpen)}
                  disabled={loading}
                  aria-haspopup="listbox"
                  aria-expanded={dropdownOpen}
                >
                  <span className="department-icon">
                    <SelectedDepartmentIcon size={17} />
                  </span>
                  <span className="department-content">
                    <strong>{selectedDepartment.label}</strong>
                    <small>{selectedDepartment.description}</small>
                  </span>
                  <ChevronDown size={17} className="department-chevron" />
                </button>

                <div
                  className={`department-menu ${dropdownOpen ? "department-menu-open" : ""}`}
                  role="listbox"
                  aria-label="Select department"
                >
                  {DEPARTMENTS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = item.value === department;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={`department-option ${isSelected ? "selected" : ""}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleDepartmentChange(item)}
                      >
                        <span className="department-option-icon">
                          <Icon size={17} />
                        </span>
                        <span className="department-option-text">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        {isSelected && <Check size={16} className="department-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="error-alert" id="login-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          {!otpRequired && (
            <div className="uiverse-field">
              <UserRound size={17} className="uiverse-input-icon" />
              <input
                id="username"
                name="username"
                type="text"
                className="uiverse-input"
                placeholder="Username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError("");
                }}
                autoComplete="username"
                spellCheck="false"
                maxLength={128}
                required
                disabled={loading}
                aria-invalid={Boolean(error)}
              />
            </div>
          )}

          {/* Password */}
          {!otpRequired && (
            <div className="uiverse-field">
              <LockKeyhole size={17} className="uiverse-input-icon" />
              <input
                id="password"
                name="password"
                type="password"
                className="uiverse-input"
                placeholder="Password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                maxLength={256}
                required
                disabled={loading}
                aria-invalid={Boolean(error)}
              />
            </div>
          )}

          {/* OTP Input & Resend */}
          {otpRequired && (
            <>
              <div className="uiverse-field">
                <Shield size={17} className="uiverse-input-icon" />
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  className="uiverse-input"
                  placeholder="6-digit Code"
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  disabled={loading || resendLoading}
                  aria-invalid={Boolean(error)}
                />
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "-8px", marginBottom: "12px" }}>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>
                  Code sent to your registered email.
                </p>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendSeconds > 0 || resendLoading || loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendSeconds > 0 ? "#9ca3af" : "#4f46e5",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    cursor: resendSeconds > 0 ? "not-allowed" : "pointer",
                    padding: 0
                  }}
                >
                  {resendLoading ? "Sending..." : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {/* Submit button */}
          <div className="uiverse-btn-wrapper">
            <button type="submit" className="uiverse-btn" disabled={loading || resendLoading}>
              {loading ? (
                <>
                  <span className="login-spinner" />
                  {otpRequired ? "Verifying…" : "Authenticating…"}
                </>
              ) : (
                <>
                  {otpRequired ? "Verify & Sign In" : "Sign in"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>

          {/* Back to Login Button */}
          {otpRequired && (
            <button
              type="button"
              className="uiverse-btn-secondary"
              onClick={() => {
                setOtpRequired(false);
                setOtp("");
                setPassword("");
                setResendSeconds(0);
              }}
              disabled={loading || resendLoading}
              style={{ marginTop: "10px", background: "none", border: "none", color: "#4f46e5", cursor: "pointer", width: "100%", fontWeight: "600" }}
            >
              Back to login
            </button>
          )}

          {/* Footer */}
          <div className="login-footer">
            <span>© {new Date().getFullYear()} Mugil Industries</span>
            <div className="login-footer-links">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <span className="login-footer-divider" aria-hidden="true">|</span>
              <Link to="/contact">Contact Us</Link>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}