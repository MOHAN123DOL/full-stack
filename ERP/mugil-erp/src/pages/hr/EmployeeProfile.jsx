import { useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEmployees, StatusBadge } from "./Employees.jsx";
import EmployeeForm from "./Employeeform.jsx";
import Loading from "../../components/loading";
import Error from "../../components/error";
import "./Employee.css";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const TABS = [
  "Overview",
  "Work Information",
  "Skills",
  "Education",
  "Experience",
  "Documents",
  "Bank Details",
  "Employment History",
];

function maskAccountNumber(num) {
  if (!num) return "—";
  const last4 = num.slice(-4);
  return `XXXX XXXX ${last4}`;
}

function InfoRow({ label, value }) {
  return (
    <div className="ep-info-row">
      <span className="ep-info-label">{label}</span>
      <span className="ep-info-value">{value || "—"}</span>
    </div>
  );
}

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

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getEmployee,
    archiveEmployee,
    deleteEmployee,
    uploadEmployeePhoto,
    deleteEmployeePhoto,
    isLoading,
    error,
    refresh,
  } = useEmployees();

  const employee = getEmployee(id);

  const [activeTab, setActiveTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [toast, setToast] = useState(null);

  /* ----------------- photo upload state ----------------- */
  const avatarInputRef = useRef(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);
  const [photoError, setPhotoError] = useState("");

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  /* ---------------------------------------------------------
     LOADING
     --------------------------------------------------------- */
  if (isLoading) {
    return (
      <div className="emp-app">
        <div className="qt-customer-loading" style={{ padding: "60px 0" }}>
          <Loading />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------
     LOAD ERROR
     --------------------------------------------------------- */
  if (error) {
    return (
      <div className="emp-app">
        <div className="qt-customer-error" style={{ padding: "40px 0" }}>
          <Error onRetry={refresh} />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------
     NOT FOUND
     --------------------------------------------------------- */
  if (!employee) {
    return (
      <div className="emp-app">
        <div className="ep-not-found">
          <h2>Employee not found</h2>
          <p>This employee record may have been removed.</p>
          <Link className="emp-btn-primary" to="/hr/employees">
            Back to Employees
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------
     ARCHIVE / DELETE EMPLOYEE
     --------------------------------------------------------- */
  async function handleArchive() {
    try {
      await archiveEmployee(employee.id);
      setConfirmArchive(false);
      showToast("Employee archived.");
    } catch {
      setConfirmArchive(false);
      showToast(GENERIC_ERROR);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteEmployee(employee.id);
      setConfirmDelete(false);
      navigate("/hr/employees");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      showToast(GENERIC_ERROR);
    }
  }

  /* ---------------------------------------------------------
     PHOTO UPLOAD
     --------------------------------------------------------- */
  async function handlePhotoChange(event) {
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

    setPhotoError("");

    try {
      setPhotoUploading(true);
      await uploadEmployeePhoto(employee.id, file);
      showToast("Employee photo updated.");
    } catch (err) {
      setPhotoError(
        err.response?.data?.message ||
          "Unable to upload photo. Please try again.",
      );
    } finally {
      setPhotoUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  }

  /* ---------------------------------------------------------
     PHOTO REMOVE
     --------------------------------------------------------- */
  async function handleRemovePhoto() {
    if (!window.confirm("Remove this employee's profile photo?")) return;

    setPhotoError("");

    try {
      setPhotoRemoving(true);
      await deleteEmployeePhoto(employee.id);
      showToast("Employee photo removed.");
    } catch (err) {
      setPhotoError(
        err.response?.data?.message ||
          "Unable to remove photo. Please try again.",
      );
    } finally {
      setPhotoRemoving(false);
    }
  }

  // Safety nets for JSON fields that may be missing
  const skills = employee.skills || [];
  const education = employee.education || [];
  const experience = employee.experience || [];
  const documents = employee.documents || [];
  const employmentHistory = employee.employmentHistory || [];
  const bank = employee.bankDetails || {};

  return (
    <div className="emp-app">
      <div className="ep-topbar">
        <Link className="ep-back-link" to="/hr/employees">
          ← Back to Employees
        </Link>
      </div>

      <div className="ep-header">
        <div className="ep-avatar-wrap">
          {employee.photo ? (
            <img className="ep-avatar" src={employee.photo} alt="" />
          ) : (
            <div className="ep-avatar ep-avatar-placeholder">
              {employee.firstName?.[0] || "?"}
              {employee.lastName?.[0] || ""}
            </div>
          )}

          {/* Pencil (upload) */}
          <button
            type="button"
            className="ep-avatar-edit"
            onClick={() => avatarInputRef.current?.click()}
            disabled={photoUploading || photoRemoving}
            title={photoUploading ? "Uploading…" : "Change employee photo"}
            aria-label="Change employee photo"
          >
            {photoUploading ? "…" : <IconPencil />}
          </button>

          {/* Trash (remove) — only when a photo exists */}
          {employee.photo && (
            <button
              type="button"
              className="ep-avatar-remove"
              onClick={handleRemovePhoto}
              disabled={photoUploading || photoRemoving}
              title={photoRemoving ? "Removing…" : "Remove employee photo"}
              aria-label="Remove employee photo"
            >
              {photoRemoving ? "…" : <IconTrash />}
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

        <div className="ep-header-info">
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="ep-header-sub">
            {employee.designation} · {employee.department}
          </p>
          <div className="ep-header-tags">
            <span className="emp-tag emp-tag-mono">{employee.employeeId}</span>
            <span className="emp-tag">{employee.city}</span>
            <StatusBadge status={employee.employmentStatus} />
            {employee.archived && (
              <span className="emp-tag emp-tag-archived">Archived</span>
            )}
          </div>
          {photoError && <p className="ep-avatar-error">{photoError}</p>}
        </div>

        <div className="ep-header-actions">
          <button
            className="emp-btn-outline"
            type="button"
            onClick={() => setEditing(true)}
          >
            Edit Employee
          </button>
          {!employee.archived && (
            <button
              className="emp-btn-danger"
              type="button"
              onClick={() => setConfirmArchive(true)}
            >
              Archive Employee
            </button>
          )}
          <button
            className="emp-btn-danger"
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete Employee"}
          </button>
        </div>
      </div>

      <div className="ep-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`ep-tab${activeTab === tab ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="ep-tab-panel">
        {activeTab === "Overview" && (
          <div className="ep-overview-grid">
            <section className="ep-card">
              <h3>Personal Information</h3>
              <InfoRow label="Employee ID" value={employee.employeeId} />
              <InfoRow label="Employee Code" value={employee.employeeCode} />
              <InfoRow
                label="Name"
                value={`${employee.firstName} ${employee.lastName}`}
              />
              <InfoRow label="Gender" value={employee.gender} />
              <InfoRow label="Date of Birth" value={employee.dob} />
              <InfoRow label="Phone" value={employee.mobile} />
              <InfoRow label="Email" value={employee.email} />
            </section>
            <section className="ep-card">
              <h3>Employment Information</h3>
              <InfoRow label="Department" value={employee.department} />
              <InfoRow label="Designation" value={employee.designation} />
              <InfoRow label="Branch" value={employee.branch} />
              <InfoRow label="Location" value={employee.workLocation} />
              <InfoRow label="Joining Date" value={employee.joiningDate} />
              <InfoRow
                label="Employment Type"
                value={employee.employmentType}
              />
              <InfoRow
                label="Employment Status"
                value={employee.employmentStatus}
              />
              <InfoRow
                label="Reporting Manager"
                value={employee.reportingManager}
              />
            </section>
            <section className="ep-card">
              <h3>Address</h3>
              <InfoRow
                label="Address"
                value={[employee.addressLine1, employee.addressLine2]
                  .filter(Boolean)
                  .join(", ")}
              />
              <InfoRow label="City" value={employee.city} />
              <InfoRow label="State" value={employee.state} />
              <InfoRow label="Country" value={employee.country} />
              <InfoRow label="Pincode" value={employee.pincode} />
            </section>
          </div>
        )}

        {activeTab === "Work Information" && (
          <section className="ep-card ep-card-wide">
            <h3>Work Information</h3>
            <div className="ep-overview-grid">
              <div>
                <InfoRow label="Department" value={employee.department} />
                <InfoRow label="Designation" value={employee.designation} />
                <InfoRow label="Branch" value={employee.branch} />
                <InfoRow
                  label="Employment Type"
                  value={employee.employmentType}
                />
              </div>
              <div>
                <InfoRow
                  label="Employment Status"
                  value={employee.employmentStatus}
                />
                <InfoRow label="Joining Date" value={employee.joiningDate} />
                <InfoRow
                  label="Reporting Manager"
                  value={employee.reportingManager}
                />
                <InfoRow label="Work Location" value={employee.workLocation} />
              </div>
            </div>
          </section>
        )}

        {activeTab === "Skills" && (
          <section className="ep-card ep-card-wide">
            <h3>Skills</h3>
            {skills.length === 0 ? (
              <p className="ef-section-note">
                No skills recorded. Use Edit Employee to add some.
              </p>
            ) : (
              <div className="ep-skills-list">
                {skills.map((s) => (
                  <span className="emp-tag emp-tag-lg" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            )}
            <button
              className="emp-link-btn"
              type="button"
              onClick={() => setEditing(true)}
            >
              Edit skills
            </button>
          </section>
        )}

        {activeTab === "Education" && (
          <section className="ep-card ep-card-wide">
            <h3>Education</h3>
            {education.length === 0 ? (
              <p className="ef-section-note">No education records on file.</p>
            ) : (
              <div className="ep-table-wrap">
                <table className="ep-table">
                  <thead>
                    <tr>
                      <th>Degree</th>
                      <th>Institution</th>
                      <th>Specialization</th>
                      <th>Years</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {education.map((row) => (
                      <tr key={row.id}>
                        <td>{row.degree || "—"}</td>
                        <td>{row.institution || "—"}</td>
                        <td>{row.specialization || "—"}</td>
                        <td>
                          {row.startYear || "—"}–{row.endYear || "—"}
                        </td>
                        <td>{row.grade || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "Experience" && (
          <section className="ep-card ep-card-wide">
            <h3>Work Experience</h3>
            {experience.length === 0 ? (
              <p className="ef-section-note">
                No previous employment records on file.
              </p>
            ) : (
              experience.map((row) => (
                <div className="ep-experience-card" key={row.id}>
                  <div className="ep-experience-head">
                    <strong>{row.designation || "Role"}</strong>
                    <span>{row.company}</span>
                  </div>
                  <p className="ep-experience-dates">
                    {row.startDate || "—"} – {row.endDate || "—"} ·{" "}
                    {row.years || "—"} yrs
                  </p>
                  {row.responsibilities && (
                    <p className="ep-experience-desc">{row.responsibilities}</p>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "Documents" && (
          <section className="ep-card ep-card-wide">
            <h3>Documents</h3>
            {documents.length === 0 ? (
              <p className="ef-section-note">No documents uploaded yet.</p>
            ) : (
              <div className="ep-table-wrap">
                <table className="ep-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Number</th>
                      <th>Issue Date</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((row) => {
                      const expired =
                        row.expiryDate && new Date(row.expiryDate) < new Date();
                      return (
                        <tr key={row.id}>
                          <td>{row.fileName || "Not uploaded"}</td>
                          <td>{row.type}</td>
                          <td>{row.number || "—"}</td>
                          <td>{row.issueDate || "—"}</td>
                          <td>{row.expiryDate || "—"}</td>
                          <td>
                            <span
                              className={`emp-tag ${
                                expired
                                  ? "emp-tag-expired"
                                  : row.fileName
                                    ? "emp-tag-ok"
                                    : "emp-tag-pending"
                              }`}
                            >
                              {expired
                                ? "Expired"
                                : row.fileName
                                  ? "On file"
                                  : "Pending"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="emp-link-btn"
                              type="button"
                              onClick={() => setEditing(true)}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "Bank Details" && (
          <section className="ep-card ep-card-wide">
            <h3>Bank Details</h3>
            <InfoRow
              label="Account Holder Name"
              value={bank.accountHolderName}
            />
            <InfoRow label="Bank Name" value={bank.bankName} />
            <div className="ep-info-row">
              <span className="ep-info-label">Account Number</span>
              <span className="ep-info-value ep-account-number">
                {showAccount
                  ? bank.accountNumber || "—"
                  : maskAccountNumber(bank.accountNumber)}
                {bank.accountNumber && (
                  <button
                    className="emp-link-btn ep-show-toggle"
                    type="button"
                    onClick={() => setShowAccount((v) => !v)}
                  >
                    {showAccount ? "Hide" : "Show"}
                  </button>
                )}
              </span>
            </div>
            <InfoRow label="IFSC Code" value={bank.ifsc} />
            <InfoRow label="Branch" value={bank.branch} />
          </section>
        )}

        {activeTab === "Employment History" && (
          <section className="ep-card ep-card-wide">
            <h3>Employment History</h3>
            {employmentHistory.length === 0 ? (
              <p className="ef-section-note">
                No changes recorded yet. Edits to department, designation,
                branch, city, or status are logged here.
              </p>
            ) : (
              <ul className="ep-history-list">
                {employmentHistory.map((h) => (
                  <li key={h.id}>
                    <span className="ep-history-date">{h.date}</span>
                    <span className="ep-history-type">{h.changeType}</span>
                    <span className="ep-history-change">
                      {h.previousValue} → {h.newValue}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {editing && (
        <EmployeeForm
          employeeId={employee.id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            showToast("Employee changes saved.");
          }}
        />
      )}

      {/* ARCHIVE CONFIRM */}
      {confirmArchive && (
        <div
          className="emp-modal-overlay"
          onClick={() => setConfirmArchive(false)}
        >
          <div
            className="emp-modal emp-modal-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Archive employee?</h3>
            <p>
              Are you sure you want to archive{" "}
              <strong>
                {employee.firstName} {employee.lastName}
              </strong>
              ? They'll be removed from the active directory but their record is
              kept.
            </p>
            <div className="emp-modal-actions">
              <button
                className="emp-btn-outline"
                type="button"
                onClick={() => setConfirmArchive(false)}
              >
                Cancel
              </button>
              <button
                className="emp-btn-danger"
                type="button"
                onClick={handleArchive}
              >
                Archive Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div
          className="emp-modal-overlay"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="emp-modal emp-modal-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>Delete employee?</h3>
            <p>
              This will <strong>permanently remove</strong>{" "}
              <strong>
                {employee.firstName} {employee.lastName}
              </strong>{" "}
              ({employee.employeeId}). This action cannot be undone. Consider
              archiving instead if you only want to hide the record.
            </p>
            <div className="emp-modal-actions">
              <button
                className="emp-btn-outline"
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="emp-btn-danger"
                type="button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="emp-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
