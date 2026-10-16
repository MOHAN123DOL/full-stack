import { useMemo, useState } from "react";

import AdminCard from "./components/AdminCard";
import AdminDataTable from "./components/AdminDataTable";
import AdminStatusBadge from "./components/AdminStatusBadge";
import AdminToolbar from "./components/AdminToolbar";
import useAdminResource from "./useAdminResource";

import { fetchAdminProjects } from "./adminApi";
import { matchesQuery } from "./adminUtils";

import "./AdminProjectStatus.css";

// =========================================================
// PROJECT STATUS VALUES
// =========================================================

const PROJECT_STATUSES = [
  "Active",
  "On Hold",
  "Completed",
];

// =========================================================
// CURRENT PROCESS
// =========================================================

function getCurrentProcess(row) {
  if (row.current_process) {
    return row.current_process;
  }

  const progress = Number(row.progress ?? 0);

  if (progress >= 100) return "Completed";
  if (progress >= 80) return "Inspection";
  if (progress >= 60) return "Painting";
  if (progress >= 40) return "Assembly";
  if (progress >= 20) return "Welding";

  return "Cutting";
}

// =========================================================
// CURRENT PROCESS COMPONENT
// =========================================================

function CurrentProcess({ row }) {
  const process = getCurrentProcess(row);

  const processClass = process
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <div
      className={`project-process project-process--${processClass}`}
    >
      <span className="project-process-dot" />

      <span className="project-process-name">
        {process}
      </span>
    </div>
  );
}

// =========================================================
// TABLE COLUMNS
// =========================================================

const COLUMNS = [
  {
    key: "name",
    header: "Project Name",

    render: (row) => (
      <div className="project-name-cell">
        <span className="admin-cell-primary">
          {row.name || "—"}
        </span>

        {row.customer_name && (
          <span className="admin-cell-secondary">
            {row.customer_name}
          </span>
        )}
      </div>
    ),
  },

  {
    key: "code",
    header: "Project Code",
    mono: true,

    render: (row) => (
      <span className="project-code">
        {row.code || "—"}
      </span>
    ),
  },

  {
    key: "status",
    header: "Status",

    render: (row) => (
      <AdminStatusBadge
        status={row.status}
      />
    ),
  },

  {
    key: "current_process",
    header: "Current Process",

    sortValue: (row) =>
      getCurrentProcess(row),

    render: (row) => (
      <CurrentProcess row={row} />
    ),
  },
];

// =========================================================
// PREVIEW DATA
// =========================================================
//
// Set to false when you want to use the API.
// =========================================================

const PREVIEW_MODE = true;

const SAMPLE_PROJECTS = [
  {
    id: 1,
    name: "Industrial Control Panel",
    code: "MEI-PRJ-026",
    customer_name: "ABC Industrial Supplies",
    status: "Active",
    progress: 46,
    current_process: "Welding",
  },

  {
    id: 2,
    name: "Electrical Distribution Unit",
    code: "MEI-PRJ-025",
    customer_name: "Metro Electricals",
    status: "Active",
    progress: 68,
    current_process: "Painting",
  },

  {
    id: 3,
    name: "MCC Panel Fabrication",
    code: "MEI-PRJ-024",
    customer_name: "Classic Electricals",
    status: "Active",
    progress: 31,
    current_process: "Cutting",
  },

  {
    id: 4,
    name: "Power Distribution Panel",
    code: "MEI-PRJ-023",
    customer_name: "Sri Balaji Hardware",
    status: "On Hold",
    progress: 54,
    current_process: "Assembly",
  },

  {
    id: 5,
    name: "Automation Control Cabinet",
    code: "MEI-PRJ-022",
    customer_name: "Kaveri Enterprises",
    status: "Active",
    progress: 82,
    current_process: "Inspection",
  },

  {
    id: 6,
    name: "LT Panel Manufacturing",
    code: "MEI-PRJ-021",
    customer_name: "Trichy Steel Mart",
    status: "Completed",
    progress: 100,
    current_process: "Completed",
  },

  {
    id: 7,
    name: "Motor Control Centre",
    code: "MEI-PRJ-020",
    customer_name: "Vijay Hardware",
    status: "Active",
    progress: 57,
    current_process: "Assembly",
  },

  {
    id: 8,
    name: "Industrial Feeder Panel",
    code: "MEI-PRJ-019",
    customer_name: "Sri Murugan Steels",
    status: "On Hold",
    progress: 24,
    current_process: "Welding",
  },
];

// =========================================================
// PAGE
// =========================================================

export default function AdminProjectStatus() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const {
    data,
    loading,
    error,
    reload,
  } = useAdminResource(fetchAdminProjects);

  // =======================================================
  // DATA SOURCE
  // =======================================================

  const all = PREVIEW_MODE
    ? SAMPLE_PROJECTS
    : data?.data ?? [];

  // =======================================================
  // FILTER
  // =======================================================

  const rows = useMemo(
    () =>
      all.filter(
        (project) =>
          (status === "all" ||
            project.status === status) &&
          matchesQuery(
            search,
            project.name,
            project.code,
            project.customer_name,
            project.current_process
          )
      ),
    [all, search, status]
  );

  // =======================================================
  // PAGE STATES
  // =======================================================

  const pageLoading = PREVIEW_MODE
    ? false
    : loading;

  const pageError = PREVIEW_MODE
    ? null
    : error;

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="admin-project-status-page">

      {/* =================================================
          HERO
      ================================================= */}

      <section className="project-status-hero">

        <div className="project-status-hero-content">

          <span className="project-status-eyebrow">
            PROJECT CONTROL
          </span>

          <h1>
            Project Status
          </h1>

          <p>
            Monitor manufacturing progress and current
            production stages across active projects.
          </p>

        </div>

      </section>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search project name or code"
      >

        <label className="admin-field">

          Status

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >

            <option value="all">
              All statuses
            </option>

            {PROJECT_STATUSES.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}

          </select>

        </label>

      </AdminToolbar>

      {/* =================================================
          TABLE
      ================================================= */}

      <AdminCard>

        <div className="project-table-heading">

          <div>

            <h2>
              Project Status
            </h2>

            <p>
              Current manufacturing progress and production stage
            </p>

          </div>

          <span className="project-count">

            {rows.length}{" "}

            {rows.length === 1
              ? "project"
              : "projects"}

          </span>

        </div>

        <AdminDataTable
          columns={COLUMNS}
          rows={rows}
          totalCount={all.length}
          rowKey="id"
          loading={pageLoading}
          error={pageError}
          onRetry={reload}
          emptyTitle="No projects"
          emptyMessage={
            all.length
              ? "No projects match your filters."
              : "No projects have been created yet."
          }
          minWidth={980}
          defaultSort={{
            key: "name",
            direction: "asc",
          }}
        />

      </AdminCard>

      {/* =================================================
          FOOTER NOTE
      ================================================= */}

      <p className="admin-note">
        Current process represents the latest
        manufacturing stage recorded for each project.
      </p>

    </div>
  );
}