
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowUpRight,
  Building2,
  FileText,
  X,
  CircleCheck,
  Clock3,
  Search,
} from "lucide-react";

import { ADMIN_NAV, adminHref } from "./adminNav";
import Loading from "../../components/loading";
import ErrorState from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "./AdminDashboard.css";

const CONTACT_REQUESTS_ENDPOINT = "/erp/admin/contact-requests/";
const GENERIC_ERROR = "Something went wrong. Please try again.";

const normalizeContactRequest = (contact) => ({
  ...contact,
  employeeId: contact.employee_id || "",
  bugId: contact.bug_id || `BUG-${contact.id}`,
  priority:
    String(contact.priority || "MEDIUM").toUpperCase() === "HIGH"
      ? "High"
      : String(contact.priority || "MEDIUM").toUpperCase() === "LOW"
        ? "Low"
        : "Medium",
  status:
    typeof contact.is_open === "boolean"
      ? contact.is_open
        ? "Open"
        : "Closed"
      : String(contact.issue_status || "OPEN").toUpperCase() === "CLOSED"
        ? "Closed"
        : "Open",
  closedBy:
    String(contact.closed_by || "").toUpperCase() === "ADMIN"
      ? "Admin"
      : String(contact.closed_by || "").toUpperCase() === "NXTGENZ"
        ? "NxtGenZ"
        : contact.closed_by || "",
});

const PRIORITY_OPTIONS = [
  {
    value: "HIGH",
    label: "High",
    response: "Within 24 hours",
    hint: "Urgent — blocking your work",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    response: "Within 72 hours",
    hint: "Important, not blocking",
  },
  {
    value: "LOW",
    label: "Low",
    response: "Within 1 week",
    hint: "General question or request",
  },
];

const getPriorityClass = (priority) => {
  switch (priority) {
    case "High":
      return "dashboard-report-priority dashboard-report-priority-high";

    case "Medium":
      return "dashboard-report-priority dashboard-report-priority-medium";

    case "Low":
      return "dashboard-report-priority dashboard-report-priority-low";

    default:
      return "dashboard-report-priority dashboard-report-priority-medium";
  }
};

const getCardPriorityClass = (priority) => {
  switch (priority) {
    case "High":
      return "dashboard-report-card-priority-high";

    case "Medium":
      return "dashboard-report-card-priority-medium";

    case "Low":
      return "dashboard-report-card-priority-low";

    default:
      return "dashboard-report-card-priority-medium";
  }
};

const getStatusClass = (status) => {
  if (status === "Closed") {
    return "dashboard-report-status dashboard-report-status-closed";
  }

  return "dashboard-report-status dashboard-report-status-open";
};

function ReportStack({
  reports,
  title,
  emptyMessage,
  onOpenReport,
}) {
  const containerRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (reports.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((currentIndex) =>
      Math.min(currentIndex, reports.length - 1),
    );
  }, [reports.length]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const handleWheel = (event) => {
      const rect = container.getBoundingClientRect();

      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!isInside) {
        return;
      }

      if (isAnimating) {
        event.preventDefault();
        return;
      }

      if (reports.length <= 1) {
        return;
      }

      event.preventDefault();

      const direction = event.deltaY > 0 ? 1 : -1;

      setIsAnimating(true);

      setActiveIndex((currentIndex) => {
        let nextIndex = currentIndex + direction;

        if (nextIndex >= reports.length) {
          nextIndex = 0;
        }

        if (nextIndex < 0) {
          nextIndex = reports.length - 1;
        }

        return nextIndex;
      });

      window.setTimeout(() => {
        setIsAnimating(false);
      }, 550);
    };

    container.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [isAnimating, reports.length]);

  return (
    <div className="dashboard-report-panel">
      <div className="dashboard-report-panel-header">
        <div>
          <span className="dashboard-section-eyebrow">
            {title === "Open Reports"
              ? "ACTIVE ATTENTION"
              : "RESOLVED CASES"}
          </span>

          <h3>{title}</h3>

          <p>
            {title === "Open Reports"
              ? "Reports and escalations requiring administrative attention."
              : "Previously resolved reports and completed administrative requests."}
          </p>
        </div>

        <div className="dashboard-report-count">
          <strong>{reports.length}</strong>

          <span>
            {title === "Open Reports"
              ? "Open Requests"
              : "Closed Cases"}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="dashboard-reports-stack-area"
      >
        {reports.length > 0 ? (
          <div className="dashboard-reports-stack">
            {reports.map((report, index) => {
              const relativePosition =
                (index - activeIndex + reports.length) %
                reports.length;

              const isVisible = relativePosition <= 3;
              const isFront = relativePosition === 0;

              if (!isVisible) {
                return null;
              }

              return (
                <button
                  key={report.id}
                  type="button"
                  className={[
                    "dashboard-report-card",
                    getCardPriorityClass(report.priority),
                    isFront
                      ? "dashboard-report-card-active"
                      : "",
                    report.status === "Closed"
                      ? "dashboard-report-card-closed"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    "--report-position": relativePosition,
                    "--report-depth": relativePosition,
                  }}
                  onClick={() => {
                    if (isFront) {
                      onOpenReport(report);
                    }
                  }}
                  aria-label={
                    isFront
                      ? `Open report: ${report.subject}`
                      : undefined
                  }
                  tabIndex={isFront ? 0 : -1}
                >
                  <div className="dashboard-report-card-top">
                    <div className="dashboard-report-card-identity">
                      <span className="dashboard-report-employee">
                        {report.employeeId}
                      </span>

                      <span className="dashboard-report-bug-id">
                        {report.bugId}
                      </span>

                      <span
                        className={getStatusClass(
                          report.status,
                        )}
                      >
                        {report.status === "Open" ? (
                          <Clock3 size={12} />
                        ) : (
                          <CircleCheck size={12} />
                        )}

                        {report.status}
                      </span>
                    </div>

                    <span
                      className={getPriorityClass(
                        report.priority,
                      )}
                    >
                      {report.priority}
                    </span>
                  </div>

                  <div className="dashboard-report-card-content">
                    <span className="dashboard-report-card-label">
                      {report.status === "Open"
                        ? "REQUEST"
                        : "RESOLVED REQUEST"}
                    </span>

                    <h3>{report.subject}</h3>

                    <p>{report.message}</p>
                  </div>

                  <div className="dashboard-report-card-footer">
                    <span>
                      {isFront
                        ? "Click to view details"
                        : "Scroll to bring forward"}
                    </span>

                    <ArrowUpRight
                      size={17}
                      strokeWidth={1.8}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-reports-empty">
            <CircleCheck size={32} strokeWidth={1.5} />

            <h4>No {title.toLowerCase()}</h4>

            <p>{emptyMessage}</p>
          </div>
        )}

        {reports.length > 1 && (
          <div className="dashboard-reports-stack-hint">
            <span className="dashboard-reports-stack-hint-line" />

            <span>
              Scroll inside this area to browse {title.toLowerCase()}
            </span>

            <span className="dashboard-reports-stack-hint-line" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const modules = ADMIN_NAV.filter(
    (item) => item.key !== "dashboard",
  );

  const { accessToken } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadReports = useCallback(async () => {
    if (!accessToken) {
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError("");

      const response = await api.get(CONTACT_REQUESTS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.data?.success) {
        throw new Error("Invalid contact requests response.");
      }

      const results = Array.isArray(response.data.results)
        ? response.data.results
        : [];

      setReports(results.map(normalizeContactRequest));
    } catch (error) {
      console.error("Failed to load admin contact requests:", error);
      setReports([]);
      setLoadError(
        error?.response?.data?.message || GENERIC_ERROR
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);

  const [showCloseField, setShowCloseField] = useState(false);

  const [closedBy, setClosedBy] = useState("");

  const [closeError, setCloseError] = useState("");

  const [isClosing, setIsClosing] = useState(false);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredReports = reports.filter((report) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      report.employeeId
        .toLowerCase()
        .includes(normalizedSearch) ||
      report.bugId
        .toLowerCase()
        .includes(normalizedSearch)
    );
  });

  const openReports = filteredReports.filter(
    (report) => report.status === "Open",
  );

  const closedReports = filteredReports.filter(
    (report) => report.status === "Closed",
  );

  const handleOpenReport = (report) => {
    setSelectedReport(report);
    setShowCloseField(false);
    setClosedBy(report.closedBy || "");
    setCloseError("");
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
    setShowCloseField(false);
    setClosedBy("");
    setCloseError("");
    setIsClosing(false);
  };

  const handleStartCloseRequest = () => {
    setShowCloseField(true);
    setClosedBy("");
    setCloseError("");
  };

  const handleConfirmClose = async () => {
    const trimmedClosedBy = closedBy.trim();

    if (!trimmedClosedBy || !selectedReport) {
      return;
    }

    // Backend expects "ADMIN" or "NXTGENZ"
    const closedByApiValue = trimmedClosedBy
      .replace(/\s+/g, "")
      .toUpperCase();

    if (
      closedByApiValue !== "ADMIN" &&
      closedByApiValue !== "NXTGENZ"
    ) {
      setCloseError("Closed By must be Admin or NxtGenZ.");
      return;
    }

    try {
      setIsClosing(true);
      setCloseError("");

      const response = await api.patch(
        `${CONTACT_REQUESTS_ENDPOINT}${selectedReport.id}/`,
        {
          issue_status: "CLOSED",
          closed_by: closedByApiValue,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            "Failed to close the request.",
        );
      }

      const updatedReport = {
        ...selectedReport,
        status: "Closed",
        closedBy:
          closedByApiValue === "ADMIN" ? "Admin" : "NxtGenZ",
        issue_status: "CLOSED",
        closed_by: closedByApiValue,
      };

      setReports((currentReports) =>
        currentReports.map((report) =>
          report.id === updatedReport.id
            ? updatedReport
            : report,
        ),
      );

      setSelectedReport(updatedReport);
      setClosedBy(updatedReport.closedBy);
      setShowCloseField(false);
    } catch (error) {
      console.error(
        "Failed to close contact request:",
        error,
      );

      setCloseError(
        error?.response?.data?.message ||
          error?.message ||
          GENERIC_ERROR,
      );
    } finally {
      setIsClosing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && selectedReport) {
        handleCloseModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedReport]);

  useEffect(() => {
    if (!selectedReport) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedReport]);

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <span className="dashboard-eyebrow">
            ADMINISTRATION
          </span>

          <h1 className="dashboard-title">
            Admin Dashboard
          </h1>

          <p className="dashboard-subtitle">
            Centralized administration, monitoring and operational
            control.
          </p>

          <div className="dashboard-meta">
            <span className="dashboard-meta-pill">
              <Building2 size={14} />
              Mugil Engineering Industry
            </span>

            <span className="dashboard-meta-pill">
              <FileText size={14} />
              Administration Overview
            </span>
          </div>
        </div>

        <div className="dashboard-hero-decoration" />
      </section>

      <section className="dashboard-modules-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-eyebrow">
              ADMINISTRATION
            </span>

            <h2>Modules</h2>

            <p>
              Access and manage administrative operations from one
              place.
            </p>
          </div>

          <div className="dashboard-module-count">
            <strong>{modules.length}</strong>

            <span>Modules</span>
          </div>
        </div>

        <div className="dashboard-module-grid">
          {modules.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                to={adminHref(item)}
                className="dashboard-module-card"
              >
                <div className="dashboard-module-top">
                  <span className="dashboard-module-icon">
                    <Icon
                      size={20}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>

                  <span className="dashboard-module-arrow">
                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>
                </div>

                <div className="dashboard-module-content">
                  <h3>{item.title}</h3>

                  <p>{item.description}</p>
                </div>

                <div className="dashboard-module-glow" />
              </Link>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="dashboard-admin-loading">
          <Loading />
        </div>
      ) : loadError ? (
        <div className="dashboard-admin-error">
          <ErrorState onRetry={loadReports} />
          <div style={{ marginTop: 8, fontSize: 13 }}>{loadError}</div>
        </div>
      ) : (
        <section className="dashboard-reports-section">
          <div className="dashboard-reports-heading-row">
            <div className="dashboard-section-heading dashboard-reports-heading">
              <div>
                <span className="dashboard-section-eyebrow">
                  ADMINISTRATIVE ATTENTION
                </span>

                <h2>Reports &amp; Escalations</h2>

                <p>
                  Review employee reports, requests and escalations
                  requiring administrative attention.
                </p>
              </div>
            </div>

            <div className="dashboard-report-search">
              <Search
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search Employee ID or Bug ID..."
                aria-label="Search reports by Employee ID or Bug ID"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="dashboard-report-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear report search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="dashboard-reports-columns">
            <ReportStack
              reports={openReports}
              title="Open Reports"
              emptyMessage="There are currently no open reports requiring attention."
              onOpenReport={handleOpenReport}
            />

            <ReportStack
              reports={closedReports}
              title="Closed Cases"
              emptyMessage="No cases have been closed yet."
              onOpenReport={handleOpenReport}
            />
          </div>
        </section>
      )}

      {selectedReport && (
        <div
          className="dashboard-report-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div
            className="dashboard-report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-report-modal-title"
          >
            <div className="dashboard-report-modal-header">
              <div>
                <span className="dashboard-section-eyebrow">
                  REPORT DETAILS
                </span>

                <h2 id="dashboard-report-modal-title">
                  {selectedReport.subject}
                </h2>
              </div>

              <button
                type="button"
                className="dashboard-report-modal-close"
                onClick={handleCloseModal}
                aria-label="Close report details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="dashboard-report-modal-meta">
              <div className="dashboard-report-detail">
                <span>Employee ID</span>

                <strong>
                  {selectedReport.employeeId}
                </strong>
              </div>

              <div className="dashboard-report-detail">
                <span>Priority</span>

                <strong
                  className={getPriorityClass(
                    selectedReport.priority,
                  )}
                >
                  {selectedReport.priority}
                </strong>
              </div>

              <div className="dashboard-report-detail">
                <span>Status</span>

                <strong
                  className={getStatusClass(
                    selectedReport.status,
                  )}
                >
                  {selectedReport.status}
                </strong>
              </div>
            </div>

            <div className="dashboard-report-message">
              <span className="dashboard-report-message-label">
                MESSAGE
              </span>

              <div className="dashboard-report-message-box">
                {selectedReport.message}
              </div>
            </div>

            {selectedReport.status === "Closed" && (
              <div className="dashboard-report-closed-by">
                <span>Closed By</span>

                <strong>
                  {selectedReport.closedBy ||
                    "Not specified"}
                </strong>
              </div>
            )}

            {showCloseField &&
              selectedReport.status !== "Closed" && (
                <div className="dashboard-report-close-form">
                  <label htmlFor="dashboard-closed-by">
                    Closed By
                  </label>

                  <div className="dashboard-report-close-input-row">
                    <select
                      id="dashboard-closed-by"
                      value={closedBy}
                      onChange={(event) =>
                        setClosedBy(event.target.value)
                      }
                      autoFocus
                      disabled={isClosing}
                    >
                      <option value="">
                        Select who closed this issue
                      </option>
                      <option value="Admin">Admin</option>
                      <option value="NxtGenZ">NxtGenZ</option>
                    </select>

                    <button
                      type="button"
                      className="dashboard-report-confirm-close"
                      disabled={!closedBy.trim() || isClosing}
                      onClick={handleConfirmClose}
                    >
                      {isClosing ? "Closing..." : "Confirm Close"}
                    </button>
                  </div>

                  {closeError && (
                    <div
                      className="dashboard-report-close-error"
                      role="alert"
                    >
                      {closeError}
                    </div>
                  )}
                </div>
              )}

            <div className="dashboard-report-modal-actions">
              <button
                type="button"
                className="dashboard-report-modal-secondary"
                onClick={handleCloseModal}
                disabled={isClosing}
              >
                Close
              </button>

              {selectedReport.status === "Open" &&
                !showCloseField && (
                  <button
                    type="button"
                    className="dashboard-report-close-request"
                    onClick={handleStartCloseRequest}
                  >
                    <CircleCheck size={17} />
                    Close Request
                  </button>
                )}

              {selectedReport.status === "Closed" && (
                <div className="dashboard-report-resolved-message">
                  <CircleCheck size={17} />
                  Request Closed
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}