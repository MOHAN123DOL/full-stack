import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEmployees, StatusBadge } from "./Employees.jsx";
import EmployeeForm from "./Employeeform.jsx";
import "./Employee.css";



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

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getEmployee, archiveEmployee } = useEmployees();
  const employee = getEmployee(id);

  const [activeTab, setActiveTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

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

  function handleArchive() {
    archiveEmployee(employee.id);
    setConfirmArchive(false);
    showToast("Employee archived.");
  }

  return (
    <div className="emp-app">
      <div className="ep-topbar">
        <Link className="ep-back-link" to="/hr/employees">
          ← Back to Employees
        </Link>
      </div>

      <div className="ep-header">
        <img className="ep-avatar" src={employee.photo} alt="" />
        <div className="ep-header-info">
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="ep-header-sub">
            {employee.designation} · {employee.department}
          </p>
          <div className="ep-header-tags">
            <span className="emp-tag emp-tag-mono">{employee.id}</span>
            <span className="emp-tag">{employee.city}</span>
            <StatusBadge status={employee.employmentStatus} />
            {employee.archived && (
              <span className="emp-tag emp-tag-archived">Archived</span>
            )}
          </div>
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
              <InfoRow label="Employee ID" value={employee.id} />
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
            {employee.skills.length === 0 ? (
              <p className="ef-section-note">
                No skills recorded. Use Edit Employee to add some.
              </p>
            ) : (
              <div className="ep-skills-list">
                {employee.skills.map((s) => (
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
            {employee.education.length === 0 ? (
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
                    {employee.education.map((row) => (
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
            {employee.experience.length === 0 ? (
              <p className="ef-section-note">
                No previous employment records on file.
              </p>
            ) : (
              employee.experience.map((row) => (
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
            {employee.documents.length === 0 ? (
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
                    {employee.documents.map((row) => {
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
                              className={`emp-tag ${expired ? "emp-tag-expired" : row.fileName ? "emp-tag-ok" : "emp-tag-pending"}`}
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
              value={employee.bankDetails.accountHolderName}
            />
            <InfoRow label="Bank Name" value={employee.bankDetails.bankName} />
            <div className="ep-info-row">
              <span className="ep-info-label">Account Number</span>
              <span className="ep-info-value ep-account-number">
                {showAccount
                  ? employee.bankDetails.accountNumber || "—"
                  : maskAccountNumber(employee.bankDetails.accountNumber)}
                {employee.bankDetails.accountNumber && (
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
            <InfoRow label="IFSC Code" value={employee.bankDetails.ifsc} />
            <InfoRow label="Branch" value={employee.bankDetails.branch} />
          </section>
        )}

        {activeTab === "Employment History" && (
          <section className="ep-card ep-card-wide">
            <h3>Employment History</h3>
            {employee.employmentHistory.length === 0 ? (
              <p className="ef-section-note">
                No changes recorded yet. Edits to department, designation,
                branch, city, or status are logged here.
              </p>
            ) : (
              <ul className="ep-history-list">
                {employee.employmentHistory.map((h) => (
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

      {toast && (
        <div className="emp-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
