import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EmployeeForm from "./Employeeform.jsx";
import "./Employee.css";
import Header from "../../components/Header";
import Loading from "../../components/loading";
import Error from "../../components/error";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

/* =====================================================================+
   CONSTANTS
   ========================================================================== */

export const DEPARTMENTS = [
  "Engineering",
  "Production",
  "HR",
  "Sales",
  "Accounts",
];
export const CITIES = [
  "Trichy",
  "Chennai",
  "Madurai",
  "Coimbatore",
  "Bangalore",
];
export const DESIGNATIONS = [
  "Software Engineer",
  "Senior Engineer",
  "Manager",
  "HR Executive",
  "Production Engineer",
  "Sales Executive",
];
export const SKILLS_LIST = [
  "Python",
  "Django",
  "React",
  "Java",
  "Mechanical",
  "Electrical",
  "Welding",
  "CNC",
];
export const EMPLOYMENT_STATUSES = [
  "Active",
  "Inactive",
  "Resigned",
  "Terminated",
  "On Notice",
];
export const EMPLOYMENT_TYPES = [
  "Permanent",
  "Probation",
  "Contract",
  "Temporary",
  "Intern",
  "Consultant",
];
export const GENDERS = ["Male", "Female", "Other"];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];
export const COUNTRIES = ["India"];
export const STATES = [
  "Tamil Nadu",
  "Karnataka",
  "Kerala",
  "Andhra Pradesh",
  "Telangana",
];
export const DOCUMENT_TYPES = [
  "Resume",
  "Aadhaar",
  "PAN",
  "Offer Letter",
  "Joining Letter",
  "Experience Certificate",
  "Education Certificate",
  "Other",
];

const GENERIC_ERROR = "Something went wrong. Please try again.";

const EMPLOYEES_ENDPOINT = "/erp/employees/";

function avatarUrl(name, seed) {
  const colors = [
    "0F766E",
    "1D4ED8",
    "7C3AED",
    "B45309",
    "0369A1",
    "15803D",
    "BE185D",
  ];
  const bg = colors[seed % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=${bg}&color=fff&size=128&font-size=0.38&bold=true`;
}

/* ==========================================================================
   SHARED STATE
   ========================================================================== */

const EmployeesContext = createContext(null);

export function useEmployees() {
  const ctx = useContext(EmployeesContext);
  if (!ctx)
    throw new Error("useEmployees must be used within EmployeesProvider");
  return ctx;
}

export function EmployeesProvider({ children }) {
  const { accessToken } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setEmployees([]);
      setError("Your session has expired. Please login again.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await api.get(EMPLOYEES_ENDPOINT, {
        headers: authHeaders(),
      });

      const responseData = response.data;
      let list = [];

      if (Array.isArray(responseData)) list = responseData;
      else if (Array.isArray(responseData?.data)) list = responseData.data;
      else if (Array.isArray(responseData?.results))
        list = responseData.results;

      setEmployees(list);
    } catch (err) {
      console.error("Failed to load employees:", err);
      setEmployees([]);
      setError(GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getEmployee = useCallback(
    (id) => employees.find((e) => String(e.id) === String(id)),
    [employees],
  );

  const addEmployee = useCallback(
    async (employee) => {
      const { id, employeeCode, ...rest } = employee;

      const body = {
        ...rest,
        photo:
          employee.photo ||
          avatarUrl(
            `${employee.firstName} ${employee.lastName}`,
            employees.length,
          ),
      };

      const response = await api.post(EMPLOYEES_ENDPOINT, body, {
        headers: authHeaders(),
      });

      if (!response.data?.success || !response.data?.data) {
        throw new Error("bad response");
      }

      const created = response.data.data;
      setEmployees((prev) => [created, ...prev]);
      return created;
    },
    [authHeaders, employees.length],
  );

  const updateEmployee = useCallback(
    async (id, updates, historyEntries = []) => {
      const existing = employees.find((e) => String(e.id) === String(id));
      const mergedHistory = [
        ...historyEntries,
        ...(existing?.employmentHistory || []),
      ];

      const { id: _dropId, employeeCode: _dropCode, ...rest } = updates;

      const body = { ...rest, employmentHistory: mergedHistory };

      const response = await api.patch(`${EMPLOYEES_ENDPOINT}${id}/`, body, {
        headers: authHeaders(),
      });

      if (!response.data?.success || !response.data?.data) {
        throw new Error("bad response");
      }

      const updated = response.data.data;
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(id) ? updated : e)),
      );
      return updated;
    },
    [authHeaders, employees],
  );

  const archiveEmployee = useCallback(
    async (id) => {
      const response = await api.post(
        `${EMPLOYEES_ENDPOINT}${id}/archive/`,
        { archived: true },
        { headers: authHeaders() },
      );

      if (!response.data?.success || !response.data?.data) {
        throw new Error("bad response");
      }

      const updated = response.data.data;
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(id) ? updated : e)),
      );
      return updated;
    },
    [authHeaders],
  );

  const unarchiveEmployee = useCallback(
    async (id) => {
      const response = await api.post(
        `${EMPLOYEES_ENDPOINT}${id}/archive/`,
        { archived: false },
        { headers: authHeaders() },
      );

      if (!response.data?.success || !response.data?.data) {
        throw new Error("bad response");
      }

      const updated = response.data.data;
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(id) ? updated : e)),
      );
      return updated;
    },
    [authHeaders],
  );

  /* ============================================================
     DELETE — permanent, removes the whole employee row
     ============================================================ */
  const deleteEmployee = useCallback(
    async (id) => {
      const response = await api.delete(`${EMPLOYEES_ENDPOINT}${id}/`, {
        headers: authHeaders(),
      });

      if (!response.data?.success) {
        throw new Error("bad response");
      }

      setEmployees((prev) =>
        prev.filter((e) => String(e.id) !== String(id)),
      );

      return true;
    },
    [authHeaders],
  );

  /* ============================================================
     UPLOAD employee photo (HR uploads for any employee)
     ============================================================ */
  const uploadEmployeePhoto = useCallback(
    async (id, file) => {
      const fd = new FormData();
      fd.append("photo", file);

      const response = await api.patch(
        `${EMPLOYEES_ENDPOINT}${id}/photo/`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (!response.data?.success || !response.data?.data) {
        throw new Error("bad response");
      }

      const updated = response.data.data;
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(id) ? updated : e)),
      );
      return updated;
    },
    [accessToken, authHeaders],
  );

  /* ============================================================
     DELETE employee photo (HR removes for any employee)
     ============================================================ */
  const deleteEmployeePhoto = useCallback(
    async (id) => {
      const response = await api.delete(
        `${EMPLOYEES_ENDPOINT}${id}/photo/`,
        { headers: authHeaders() },
      );

      if (!response.data?.success || !response.data?.data) {
        throw new Error("bad response");
      }

      const updated = response.data.data;
      setEmployees((prev) =>
        prev.map((e) => (String(e.id) === String(id) ? updated : e)),
      );
      return updated;
    },
    [authHeaders],
  );

  const value = {
    employees,
    isLoading,
    error,
    refresh,
    getEmployee,
    addEmployee,
    updateEmployee,
    archiveEmployee,
    unarchiveEmployee,
    deleteEmployee,
    uploadEmployeePhoto,
    deleteEmployeePhoto,
  };

  return (
    <EmployeesContext.Provider value={value}>
      {children}
    </EmployeesContext.Provider>
  );
}

export function createBlankEmployee() {
  return {
    employeeId: "",
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    bloodGroup: "",
    maritalStatus: "",
    mobile: "",
    email: "",
    emergencyContactName: "",
    emergencyContactNumber: "",
    department: "",
    designation: "",
    branch: "",
    employmentType: "",
    employmentStatus: "Active",
    reportingManager: "",
    workLocation: "",
    joiningDate: "",
    addressLine1: "",
    addressLine2: "",
    country: "India",
    state: "",
    city: "",
    district: "",
    pincode: "",
    aadhaar: "",
    pan: "",
    uan: "",
    pf: "",
    esi: "",
    passport: "",
    drivingLicense: "",
    skills: [],
    education: [],
    experience: [],
    bankDetails: {
      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },
    documents: [],
    employmentHistory: [],
    archived: false,
  };
}

/* ==========================================================================
   STATUS BADGE
   ========================================================================== */

export function StatusBadge({ status }) {
  const cls = status ? status.toLowerCase().replace(/\s+/g, "-") : "inactive";
  return (
    <span className={`emp-status-badge emp-status-${cls}`}>
      <span className="emp-status-dot" />
      {status}
    </span>
  );
}

/* ==========================================================================
   EMPLOYEE LIST PAGE
   ========================================================================== */

const PAGE_SIZE = 8;

const emptyFilters = {
  department: [],
  city: [],
  designation: [],
  skills: [],
  employmentStatus: [],
  employmentType: [],
};

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function Employees() {
  const { employees, archiveEmployee, isLoading, error, refresh } =
    useEmployees();
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(location.state?.openCreate || false);
  const [editingId, setEditingId] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [flippedIds, setFlippedIds] = useState(() => new Set());

  const toggleCardFlip = useCallback((id) => {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const filtered = employees.filter((e) => {
    if (Boolean(e.archived) !== showArchived) return false;

    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [
        e.employeeId,
        e.employeeCode,
        e.firstName,
        e.lastName,
        e.email,
        e.mobile,
        e.department,
        e.designation,
        e.city,
        ...(e.skills || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.department.length && !filters.department.includes(e.department))
      return false;
    if (filters.city.length && !filters.city.includes(e.city)) return false;
    if (
      filters.designation.length &&
      !filters.designation.includes(e.designation)
    )
      return false;
    if (
      filters.employmentStatus.length &&
      !filters.employmentStatus.includes(e.employmentStatus)
    )
      return false;
    if (
      filters.employmentType.length &&
      !filters.employmentType.includes(e.employmentType)
    )
      return false;
    if (
      filters.skills.length &&
      !filters.skills.some((s) => (e.skills || []).includes(s))
    )
      return false;

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );

  const activeFilterCount = Object.values(filters).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  function updateFilter(group, value) {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [group]: toggleInArray(prev[group], value),
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(1);
  }

  function openCreateForm() {
    setEditingId(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function handleSaved(mode) {
    closeForm();
    showToast(
      mode === "create"
        ? "Employee created successfully."
        : "Employee changes saved.",
    );
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    try {
      await archiveEmployee(archiveTarget.id);
      showToast(
        `${archiveTarget.firstName} ${archiveTarget.lastName} was archived.`,
      );
    } catch {
      showToast(GENERIC_ERROR);
    }
    setArchiveTarget(null);
  }

  const FilterGroup = ({ label, group, options }) => (
    <div className="emp-filter-group">
      <h4>{label}</h4>
      <div className="emp-filter-options">
        {options.map((opt) => (
          <label key={opt} className="emp-filter-checkbox">
            <input
              type="checkbox"
              checked={filters[group].includes(opt)}
              onChange={() => updateFilter(group, opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const filterPanel = (
    <>
      <div className="emp-filter-panel-head">
        <h3>Filters</h3>
        {activeFilterCount > 0 && (
          <button className="emp-link-btn" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      <label className="emp-filter-checkbox emp-filter-archived-toggle">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={() => {
            setShowArchived((v) => !v);
            setPage(1);
          }}
        />
        <span>Show archived employees</span>
      </label>
      <FilterGroup label="Department" group="department" options={DEPARTMENTS} />
      <FilterGroup label="City" group="city" options={CITIES} />
      <FilterGroup
        label="Designation"
        group="designation"
        options={DESIGNATIONS}
      />
      <FilterGroup label="Skills" group="skills" options={SKILLS_LIST} />
      <FilterGroup
        label="Employment status"
        group="employmentStatus"
        options={EMPLOYMENT_STATUSES}
      />
      <FilterGroup
        label="Employment type"
        group="employmentType"
        options={EMPLOYMENT_TYPES}
      />
    </>
  );

  return (
    <>
      <Header
        navLinks={[
          { label: "Employees", path: "/hr/employees" },
          { label: "Attendance & Wages", path: "/hr/attendance" },
          { label: "Salary", path: "/hr/salary" },
        ]}
      />

      <div className="emp-app">
        <div className="emp-page-header">
          <div className="emp-page-header-titles">
            <h1>Employees</h1>
            <p>
              {filtered.length} {showArchived ? "archived" : "active"} record
              {filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="emp-page-header-actions">
            <div className="emp-search">
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path
                  d="M13.6 12.2a6 6 0 1 0-1.4 1.4l3.8 3.8 1.4-1.4-3.8-3.8ZM9 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
                  fill="currentColor"
                />
              </svg>
              <input
                type="text"
                value={search}
                placeholder="Search employees..."
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search employees"
              />
              {search && (
                <button
                  className="emp-search-clear"
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>
            <button
              className="emp-btn-outline emp-mobile-filter-toggle"
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <button
              className="emp-btn-primary"
              type="button"
              onClick={openCreateForm}
            >
              + New Employee
            </button>
          </div>
        </div>

        <div className="emp-layout">
          <aside className="emp-filter-sidebar">{filterPanel}</aside>

          <main className="emp-main">
            {isLoading && (
              <div className="qt-customer-loading">
                <Loading />
              </div>
            )}

            {!isLoading && error && (
              <div className="qt-customer-error">
                <Error onRetry={refresh} />
              </div>
            )}

            {!isLoading && !error && pageItems.length === 0 && (
              <div className="emp-empty-state">
                <div className="emp-empty-icon">🗂️</div>
                <h3>
                  {showArchived
                    ? "No archived employees"
                    : "No employees match your search"}
                </h3>
                <p>
                  {showArchived
                    ? "Employees you archive will show up here."
                    : "Try adjusting your filters or search terms, or add a new employee record."}
                </p>
                {!showArchived && (
                  <button
                    className="emp-btn-primary"
                    type="button"
                    onClick={openCreateForm}
                  >
                    + New Employee
                  </button>
                )}
              </div>
            )}

            {!isLoading && !error && pageItems.length > 0 && (
              <>
                <div className="emp-grid">
                  {pageItems.map((emp) => (
                    <article
                      className={`emp-card emp-card-container emp-card-accent-${emp.employmentStatus
                        .toLowerCase()
                        .replace(/\s+/g, "-")}${
                        flippedIds.has(emp.id) ? " is-flipped" : ""
                      }`}
                      key={emp.id}
                    >
                      <div className="emp-card-flip">
                        <div className="emp-card-front">
                          <div className="emp-card-face-top">
                            <StatusBadge status={emp.employmentStatus} />
                            <div className="emp-menu-wrap">
                              <button
                                className="emp-icon-btn"
                                type="button"
                                aria-label="More actions"
                                onClick={() =>
                                  setOpenMenuId(
                                    openMenuId === emp.id ? null : emp.id,
                                  )
                                }
                              >
                                ⋮
                              </button>
                              {openMenuId === emp.id && (
                                <div className="emp-menu">
                                  {!emp.archived ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setArchiveTarget(emp);
                                      }}
                                    >
                                      Archive employee
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/hr/employees/${emp.id}`);
                                      }}
                                    >
                                      View archived record
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="emp-card-identity"
                            onClick={() => navigate(`/hr/employees/${emp.id}`)}
                          >
                            <div className="emp-card-avatar-wrap">
                              <img
                                className="emp-card-avatar"
                                src={emp.photo}
                                alt=""
                              />
                              <span
                                className="emp-card-avatar-dot"
                                aria-hidden="true"
                              />
                            </div>
                            <h3>
                              {emp.firstName} {emp.lastName}
                            </h3>
                            <p className="emp-card-role">{emp.designation}</p>
                            <span className="emp-card-id">
                              {emp.employeeId}
                            </span>
                            <span className="emp-card-dept-pill">
                              {emp.department}
                            </span>
                          </button>

                          <div className="emp-card-face-footer">
                            <button
                              type="button"
                              className="emp-card-flip-btn"
                              aria-label={
                                flippedIds.has(emp.id)
                                  ? "Show employee identity"
                                  : "Show employee details"
                              }
                              onClick={() => toggleCardFlip(emp.id)}
                            >
                              Details
                            </button>
                          </div>
                        </div>

                        <div className="emp-card-back">
                          <p className="emp-card-back-eyebrow">
                            Employee Details
                          </p>
                          <dl className="emp-card-detail-list">
                            <div>
                              <dt>Department</dt>
                              <dd>{emp.department}</dd>
                            </div>
                            <div>
                              <dt>Designation</dt>
                              <dd>{emp.designation}</dd>
                            </div>
                            <div>
                              <dt>Location</dt>
                              <dd>{emp.city}</dd>
                            </div>
                            <div>
                              <dt>Branch</dt>
                              <dd>{emp.branch}</dd>
                            </div>
                            <div>
                              <dt>Employment Type</dt>
                              <dd>{emp.employmentType}</dd>
                            </div>
                            <div>
                              <dt>Joining Date</dt>
                              <dd>{emp.joiningDate}</dd>
                            </div>
                            <div>
                              <dt>Manager</dt>
                              <dd>{emp.reportingManager || "—"}</dd>
                            </div>
                          </dl>
                          {(emp.skills || []).length > 0 && (
                            <div className="emp-card-skills">
                              {emp.skills.slice(0, 3).map((s) => (
                                <span className="emp-tag" key={s}>
                                  {s}
                                </span>
                              ))}
                              {emp.skills.length > 3 && (
                                <span className="emp-tag emp-tag-more">
                                  +{emp.skills.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            className="emp-card-view-profile"
                            onClick={() => navigate(`/hr/employees/${emp.id}`)}
                          >
                            View Profile →
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav
                    className="emp-pagination"
                    aria-label="Employee list pagination"
                  >
                    <button
                      className="emp-btn-outline"
                      type="button"
                      disabled={pageSafe === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="emp-pagination-status">
                      Page {pageSafe} of {totalPages}
                    </span>
                    <button
                      className="emp-btn-outline"
                      type="button"
                      disabled={pageSafe === totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </main>
        </div>

        {filterDrawerOpen && (
          <div
            className="emp-drawer-overlay"
            onClick={() => setFilterDrawerOpen(false)}
          >
            <div className="emp-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="emp-drawer-head">
                <h3>Filters</h3>
                <button
                  className="emp-icon-btn"
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setFilterDrawerOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="emp-drawer-body">{filterPanel}</div>
              <div className="emp-drawer-foot">
                <button
                  className="emp-btn-primary"
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                >
                  Show {filtered.length} results
                </button>
              </div>
            </div>
          </div>
        )}

        {formOpen && (
          <EmployeeForm
            employeeId={editingId}
            onClose={closeForm}
            onSaved={handleSaved}
          />
        )}

        {archiveTarget && (
          <div
            className="emp-modal-overlay"
            onClick={() => setArchiveTarget(null)}
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
                  {archiveTarget.firstName} {archiveTarget.lastName}
                </strong>
                ? They'll be removed from the active directory but their record
                is kept.
              </p>
              <div className="emp-modal-actions">
                <button
                  className="emp-btn-outline"
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                >
                  Cancel
                </button>
                <button
                  className="emp-btn-danger"
                  type="button"
                  onClick={confirmArchive}
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
    </>
  );
}