import { useEffect, useRef, useState } from "react";
import {
  Factory,
  Settings,
  Users,
  Package,
  ShieldCheck,
  Wallet,
  ChevronDown,
  UserRound,
  LockKeyhole,
  ArrowRight,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import industrialImage from "../assets/industrial-login.png";
import mugilLogo from "../assets/mugil-logo.png";
import "../styles/login.css";

const DEPARTMENTS = [
  {
    label: "Production",
    value: "production",
    loginPath: "/production/login",
    icon: Factory,
    description: "Production & Operations",
  },
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
    label: "Supervisor",
    value: "supervisor",
    loginPath: "/supervisor/login",
    icon: ShieldCheck,
    description: "Supervision & Control",
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
    DEPARTMENTS.find(
      (department) => department.value === value,
    ) ?? DEFAULT_DEPARTMENT
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [department, setDepartment] = useState(
    initialDepartment.value,
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // -----------------------------
  // Refs
  // -----------------------------

  const mountedRef = useRef(false);
  const dropdownRef = useRef(null);

  // -----------------------------
  // Hooks
  // -----------------------------

  const { login } = useAuth();
  const navigate = useNavigate();

  const selectedDepartment = getDepartment(department);

  const SelectedDepartmentIcon =
    selectedDepartment.icon;

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
  // Update department
  // -----------------------------

  useEffect(() => {
    setDepartment(
      getDepartment(currentDepartment).value,
    );
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  // -----------------------------
  // Close dropdown with Escape
  // -----------------------------

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, []);

  // -----------------------------
  // Department change
  // -----------------------------

  const handleDepartmentChange = (nextDepartment) => {
    setDepartment(nextDepartment.value);
    setDropdownOpen(false);
    setError("");

    navigate(nextDepartment.loginPath);
  };

  // -----------------------------
  // Login
  // -----------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedUsername = username.trim();

    // Validate username/password
    if (
      !normalizedUsername ||
      !password.trim()
    ) {
      setError(
        "Please enter both username and password.",
      );

      return;
    }

    setLoading(true);
    setError("");

    try {
      // Small UI delay
      await new Promise((resolve) => {
        window.setTimeout(
          resolve,
          AUTHENTICATION_DELAY_MS,
        );
      });

      if (!mountedRef.current) {
        return;
      }

      /*
       * IMPORTANT
       *
       * Send:
       * username
       * password
       * department/user_type
       *
       * to Django through AuthContext.
       */
      const result = await login(
        normalizedUsername,
        password,
        department,
      );

      if (!mountedRef.current) {
        return;
      }

      // -----------------------------
      // Successful login
      // -----------------------------

      if (result?.success) {
        setLoading(false);

        if (department === "material-planning") {
          navigate("/inventory", {
            replace: true,
          });
        } else if (department === "hr") {
          navigate("/hr/employees", {
            replace: true,
          });
        } else if (department === "accounts") {
          navigate("/accounts", {
            replace: true,
          });
        } else if (department === "production") {
          navigate("/inventory", {
            replace: true,
          });
        } else if (department === "supervisor") {
          navigate("/inventory", {
            replace: true,
          });
        } else {
          navigate("/welcome", {
            replace: true,
          });
        }

        return;
      }

      // -----------------------------
      // Login failed
      // -----------------------------

      setPassword("");

      setError(
        typeof result?.message === "string"
          ? result.message
          : "Unable to sign in. Please try again.",
      );
    } catch (error) {
      console.error("Login error:", error);

      if (mountedRef.current) {
        setPassword("");
        setError(
          "Unable to sign in. Please try again.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <div
      className="login-root"
      style={{
        backgroundImage: `url(${industrialImage})`,
      }}
    >
      <div
        className="login-bg-overlay"
        aria-hidden="true"
      />

      <section className="login-card-shell">
        <form
          className="uiverse-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Logo */}

          <div className="uiverse-logo">
            <img
              src={mugilLogo}
              alt="Mugil Engineering Industries"
            />
          </div>

          {/* Heading */}

          <p className="uiverse-heading">
            {selectedDepartment.label} Login
          </p>

          <p className="uiverse-subtitle">
            Mugil Industries ERP — Secure Access Portal
          </p>

          {/* Department */}

          <div className="department-group">
            <label
              className="form-label"
              htmlFor="department-button"
            >
              Department
            </label>

            <div
              className="department-dropdown"
              ref={dropdownRef}
            >
              <button
                id="department-button"
                type="button"
                className={`department-trigger ${
                  dropdownOpen ? "is-open" : ""
                }`}
                onClick={() =>
                  setDropdownOpen(
                    (isOpen) => !isOpen,
                  )
                }
                disabled={loading}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <span className="department-icon">
                  <SelectedDepartmentIcon
                    size={17}
                  />
                </span>

                <span className="department-content">
                  <strong>
                    {selectedDepartment.label}
                  </strong>

                  <small>
                    {selectedDepartment.description}
                  </small>
                </span>

                <ChevronDown
                  size={17}
                  className="department-chevron"
                />
              </button>

              {/* Department menu */}

              <div
                className={`department-menu ${
                  dropdownOpen
                    ? "department-menu-open"
                    : ""
                }`}
                role="listbox"
                aria-label="Select department"
              >
                {DEPARTMENTS.map((item) => {
                  const Icon = item.icon;

                  const isSelected =
                    item.value === department;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`department-option ${
                        isSelected
                          ? "selected"
                          : ""
                      }`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        handleDepartmentChange(item)
                      }
                    >
                      <span className="department-option-icon">
                        <Icon size={17} />
                      </span>

                      <span className="department-option-text">
                        <strong>
                          {item.label}
                        </strong>

                        <small>
                          {item.description}
                        </small>
                      </span>

                      {isSelected && (
                        <Check
                          size={16}
                          className="department-check"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Error */}

          {error && (
            <div
              className="error-alert"
              id="login-error"
              role="alert"
            >
              <AlertTriangle size={16} />

              <span>{error}</span>
            </div>
          )}

          {/* Username */}

          <div className="uiverse-field">
            <UserRound
              size={17}
              className="uiverse-input-icon"
            />

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
              aria-describedby={
                error
                  ? "login-error"
                  : undefined
              }
            />
          </div>

          {/* Password */}

          <div className="uiverse-field">
            <LockKeyhole
              size={17}
              className="uiverse-input-icon"
            />

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
              aria-describedby={
                error
                  ? "login-error"
                  : undefined
              }
            />
          </div>

          {/* Login button */}

          <div className="uiverse-btn-wrapper">
            <button
              type="submit"
              className="uiverse-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />

                  Authenticating…
                </>
              ) : (
                <>
                  Sign in

                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>

          {/* Footer */}

          <div className="login-footer">
            <span>
              © {new Date().getFullYear()} Mugil
              Industries
            </span>

            <a href="/privacy-policy">
              Privacy Policy
            </a>
          </div>
        </form>
      </section>
    </div>
  );
}