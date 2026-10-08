import { useState, useRef } from "react";
import "./ContactUs.css";

import api from "../api/axios";


/* ---------- inline icons ---------- */

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 2L11 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 2L15 22L11 13L2 9L22 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconCheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path
      d="M8 12L11 15L16 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 9V13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M12 17H12.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M10.29 3.86L1.82 18A2 2 0 003.54 21H20.46A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M18 8A6 6 0 006 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.73 21a2 2 0 01-3.46 0"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ---------- static config ---------- */

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

const DEFAULT_PRIORITY = "MEDIUM";

function getPriorityMeta(value) {
  return PRIORITY_OPTIONS.find((p) => p.value === value);
}

/* ---------- payload builder ---------- */

function buildContactPayload({
  employeeId,
  subject,
  message,
  priority,
  informAdmin,
}) {
  return {
    employeeId: employeeId.trim(),
    subject: subject.trim(),
    message: message.trim(),
    priority,
    informAdmin,
  };
}

/* ---------- initial form ---------- */

const INITIAL_FORM = {
  employeeId: "",
  subject: "",
  message: "",
  priority: DEFAULT_PRIORITY,
  informAdmin: false,
};

export default function ContactUs() {
  const [form, setForm] = useState(INITIAL_FORM);

  const [errors, setErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(null);

  const submittingRef = useRef(false);

  const selectedPriority = getPriorityMeta(form.priority);

  /* ============================================================
     CLEAR FIELD ERROR
     ============================================================ */

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };

      delete next[field];

      return next;
    });
  };

  /* ============================================================
     HANDLE INPUT
     ============================================================ */

  const handleChange = (field) => (event) => {
    const value = event.target.value;

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    clearFieldError(field);
  };

  /* ============================================================
     PRIORITY
     ============================================================ */

  const handlePriorityChange = (value) => {
    setForm((prev) => ({
      ...prev,
      priority: value,
    }));

    clearFieldError("priority");
  };

  /* ============================================================
     ADMIN TOGGLE
     ============================================================ */

  const handleInformAdminToggle = () => {
    setForm((prev) => ({
      ...prev,
      informAdmin: !prev.informAdmin,
    }));
  };

  /* ============================================================
     VALIDATION
     ============================================================ */

  const validate = () => {
    const nextErrors = {};

    if (!form.employeeId.trim()) {
      nextErrors.employeeId = "Employee ID is required.";
    }

    if (!form.subject.trim()) {
      nextErrors.subject = "Subject is required.";
    }

    if (!form.message.trim()) {
      nextErrors.message = "Please describe your issue or request.";
    }

    if (!form.priority) {
      nextErrors.priority = "Please select a priority.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  /* ============================================================
     SUBMIT
     ============================================================ */

  const handleSubmit = async (event) => {
    event.preventDefault();

    /*
     * Prevent double submission.
     */
    if (submittingRef.current) {
      return;
    }

    /*
     * Frontend validation.
     */
    if (!validate()) {
      return;
    }

    submittingRef.current = true;

    setSubmitting(true);

    setErrors({});

    const payload = buildContactPayload(form);

    try {
      /*
       * Backend endpoint (baseURL is /api):
       *
       *   POST /api/contact/
       *
       * Payload:
       * {
       *   employeeId,
       *   subject,
       *   message,
       *   priority,
       *   informAdmin
       * }
       */

      const response = await api.post("/erp/contact/", payload);

      const responseData = response?.data;

      /*
       * Backend success.
       */

      if (responseData?.success) {
        setSubmitted({
          ...payload,

          /*
           * Keep request ID if backend returns it.
           */
          requestId:
            responseData?.requestId || responseData?.id || null,
        });

        return;
      }

      /*
       * Unexpected API response.
       */

      setErrors({
        form:
          responseData?.message ||
          "Something went wrong. Please try again.",
      });
    } catch (err) {
      console.error("Contact Us submission failed:", err);

      /*
       * Axios error response.
       */

      const response = err?.response;

      const responseData = response?.data;

      /*
       * -----------------------------------------
       * 400 - Validation error
       * -----------------------------------------
       */

      if (response?.status === 400) {
        const backendErrors = responseData?.errors;

        if (backendErrors && typeof backendErrors === "object") {
          setErrors(backendErrors);
        } else {
          setErrors({
            form:
              responseData?.message ||
              "Please check the information you entered.",
          });
        }

        return;
      }

      /*
       * -----------------------------------------
       * 401 - Unauthorized
       * -----------------------------------------
       */

      if (response?.status === 401) {
        setErrors({
          form:
            responseData?.message ||
            "Your session has expired. Please login again.",
        });

        return;
      }

      /*
       * -----------------------------------------
       * 403 - Forbidden
       * -----------------------------------------
       */

      if (response?.status === 403) {
        setErrors({
          form:
            responseData?.message ||
            "You do not have permission to submit this request.",
        });

        return;
      }

      /*
       * -----------------------------------------
       * 404 - Endpoint not found
       * -----------------------------------------
       */

      if (response?.status === 404) {
        setErrors({
          form: "Contact service is currently unavailable.",
        });

        return;
      }

      /*
       * -----------------------------------------
       * 500 - Backend / Email failure
       * -----------------------------------------
       *
       * The backend may have already saved the
       * ContactRequest but failed to send email.
       */

      if (response?.status >= 500) {
        setErrors({
          form:
            responseData?.message ||
            "Your request could not be processed right now. Please try again later.",
        });

        return;
      }

      /*
       * -----------------------------------------
       * Network error
       * -----------------------------------------
       */

      if (!response) {
        setErrors({
          form:
            "Unable to connect to the server. Please check your internet connection and try again.",
        });

        return;
      }

      /*
       * -----------------------------------------
       * Generic API error
       * -----------------------------------------
       */

      setErrors({
        form:
          responseData?.message ||
          "Something went wrong. Please try again.",
      });
    } finally {
      submittingRef.current = false;

      setSubmitting(false);
    }
  };

  /* ============================================================
     RESET
     ============================================================ */

  const handleReset = () => {
    setForm(INITIAL_FORM);

    setErrors({});

    setSubmitted(null);
  };

  /* ============================================================
     SUCCESS STATE
     ============================================================ */

  if (submitted) {
    const meta = getPriorityMeta(submitted.priority);

    return (
      <div className="contact-page">
        <div className="contact-page-inner">
          <div className="contact-success-card" role="status">
            <div className="contact-success-icon">
              <IconCheckCircle />
            </div>

            <h2 className="contact-success-title">
              Request Submitted Successfully
            </h2>

            <p className="contact-success-subtitle">
              Your request has been submitted to the support team.
            </p>

            {submitted.requestId && (
              <div className="contact-success-row">
                <span className="contact-success-label">Request ID</span>

                <span className="contact-success-value">
                  #{submitted.requestId}
                </span>
              </div>
            )}

            <div className="contact-success-details">
              <div className="contact-success-row">
                <span className="contact-success-label">Priority</span>

                <span
                  className={`contact-success-priority priority-${meta.value.toLowerCase()}`}
                >
                  {meta.label}
                </span>
              </div>

              <div className="contact-success-row">
                <span className="contact-success-label">
                  Expected Response
                </span>

                <span className="contact-success-value">
                  {meta.response}
                </span>
              </div>
            </div>

            {submitted.informAdmin && (
              <div className="contact-admin-note">
                <IconBell />

                <span>The administrator has also been notified.</span>
              </div>
            )}

            <button
              type="button"
              className="contact-btn-secondary"
              onClick={handleReset}
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     FORM STATE
     ============================================================ */

  return (
    <div className="contact-page">
      <div className="contact-page-inner">
        <div className="contact-header">
          <h1 className="contact-title">Contact Us</h1>

          <p className="contact-subtitle">
            Submit your request to our support team and we&rsquo;ll get back
            to you.
          </p>
        </div>

        <form className="contact-card" onSubmit={handleSubmit} noValidate>
          {/* =====================================================
              API ERROR
          ====================================================== */}

          {errors.form && (
            <div className="contact-form-alert" role="alert">
              <IconAlert />

              <span>{errors.form}</span>
            </div>
          )}

          {/* =====================================================
              EMPLOYEE ID + SUBJECT
          ====================================================== */}

          <div className="contact-form-row">
            <div className="contact-form-group">
              <label htmlFor="employeeId">
                Employee ID <span className="contact-required">*</span>
              </label>

              <input
                id="employeeId"
                name="employeeId"
                type="text"
                className={errors.employeeId ? "has-error" : ""}
                placeholder="Enter your employee ID"
                value={form.employeeId}
                onChange={handleChange("employeeId")}
                disabled={submitting}
                aria-invalid={Boolean(errors.employeeId)}
                aria-describedby={
                  errors.employeeId ? "employeeId-error" : undefined
                }
              />

              {errors.employeeId && (
                <p className="contact-field-error" id="employeeId-error">
                  {errors.employeeId}
                </p>
              )}
            </div>

            <div className="contact-form-group">
              <label htmlFor="subject">
                Subject <span className="contact-required">*</span>
              </label>

              <input
                id="subject"
                name="subject"
                type="text"
                className={errors.subject ? "has-error" : ""}
                placeholder="Enter the subject of your request"
                value={form.subject}
                onChange={handleChange("subject")}
                disabled={submitting}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={
                  errors.subject ? "subject-error" : undefined
                }
              />

              {errors.subject && (
                <p className="contact-field-error" id="subject-error">
                  {errors.subject}
                </p>
              )}
            </div>
          </div>

          {/* =====================================================
              MESSAGE
          ====================================================== */}

          <div className="contact-form-group">
            <label htmlFor="message">
              Message <span className="contact-required">*</span>
            </label>

            <textarea
              id="message"
              name="message"
              rows={6}
              className={errors.message ? "has-error" : ""}
              placeholder="Describe your issue or request..."
              value={form.message}
              onChange={handleChange("message")}
              disabled={submitting}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : undefined}
            />

            {errors.message && (
              <p className="contact-field-error" id="message-error">
                {errors.message}
              </p>
            )}
          </div>

          {/* =====================================================
              PRIORITY
          ====================================================== */}

          <div className="contact-form-group">
            <label id="priority-label">
              Priority <span className="contact-required">*</span>
            </label>

            <div
              className="contact-priority-group"
              role="radiogroup"
              aria-labelledby="priority-label"
            >
              {PRIORITY_OPTIONS.map((option) => {
                const isSelected = form.priority === option.value;

                return (
                  <button
                    type="button"
                    key={option.value}
                    role="radio"
                    aria-checked={isSelected}
                    className={`contact-priority-card priority-${option.value.toLowerCase()} ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() => handlePriorityChange(option.value)}
                    disabled={submitting}
                  >
                    <span className="contact-priority-top">
                      <span
                        className="contact-priority-radio"
                        aria-hidden="true"
                      />

                      <span className="contact-priority-text">
                        <span className="contact-priority-name">
                          {option.label}
                        </span>

                        <span className="contact-priority-hint">
                          {option.hint}
                        </span>
                      </span>
                    </span>

                    <span className="contact-priority-response">
                      {option.response}
                    </span>
                  </button>
                );
              })}
            </div>

            {errors.priority && (
              <p className="contact-field-error">{errors.priority}</p>
            )}

            {selectedPriority && (
              <div
                className={`contact-response-banner priority-${selectedPriority.value.toLowerCase()}`}
              >
                <span className="contact-response-banner-label">
                  Priority: {selectedPriority.label}
                </span>

                <span className="contact-response-banner-value">
                  Expected response: {selectedPriority.response}
                </span>
              </div>
            )}
          </div>

          {/* =====================================================
              INFORM ADMIN
          ====================================================== */}

          <div className="contact-form-group">
            <button
              type="button"
              className={`contact-toggle-row ${
                form.informAdmin ? "checked" : ""
              }`}
              onClick={handleInformAdminToggle}
              disabled={submitting}
              role="checkbox"
              aria-checked={form.informAdmin}
            >
              <span className="contact-toggle-box" aria-hidden="true">
                {form.informAdmin && (
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>

              <span className="contact-toggle-label">
                Send this request to Admin
              </span>
            </button>

            {form.informAdmin && (
              <p className="contact-toggle-note">
                <IconBell />
                The administrator will be notified about this request.
              </p>
            )}
          </div>

          {/* =====================================================
              SUBMIT
          ====================================================== */}

          <div className="contact-form-actions">
            <button
              type="submit"
              className="contact-btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="contact-spinner" />
                  Submitting…
                </>
              ) : (
                <>
                  <IconSend />

                  {form.informAdmin
                    ? "Submit & Inform Admin"
                    : "Submit Request"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}