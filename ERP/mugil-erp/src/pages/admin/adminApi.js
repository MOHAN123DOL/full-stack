import api from "../../api/axios";

/* ==========================================================================
   ADMIN API
   --------------------------------------------------------------------------
   Follows the existing convention in this codebase: the access token lives
   in AuthContext and is passed explicitly as a Bearer header (see
   Employees.jsx, Attendancewages.jsx, ReceiveGRN.jsx ...).

   Endpoints
     GET /erp/admin/attendance/            NEW  (read-only, admin only)
     GET /erp/admin/pending-payments/      NEW  (read-only, admin only)
     GET /erp/admin/projects/              NEW  (read-only, admin only)
     GET /erp/material/receive/list/       EXISTING — reused as-is for GRN
   ========================================================================== */

const headersFor = (token) => ({ Authorization: `Bearer ${token}` });

/** Turn an axios error into a short, human message. */
export function getAdminApiError(err, fallback = "Something went wrong.") {
  const status = err?.response?.status;

  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "Your account does not have access to this data.";

  const data = err?.response?.data;
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.detail === "string" && data.detail) return data.detail;

  if (err?.request && !err?.response) {
    return "Unable to reach the server. Please check that the backend is running.";
  }

  return fallback;
}

/* --------------------------------------------------------------------------
   ATTENDANCE
   Response: { date, summary:{present,on_leave,not_marked,total_active},
               leave:[...], present:[...] }
   Row field names mirror HR: employee_name, employee_code, designation, ...
   -------------------------------------------------------------------------- */
export async function fetchAdminAttendance(token, date) {
  const res = await api.get("/erp/admin/attendance/", {
    headers: headersFor(token),
    params: date ? { date } : undefined,
  });
  return res.data;
}

/* --------------------------------------------------------------------------
   PO WITH PENDING GRN
   Reuses the Material Planning "Receive GRN" list. Its rows already carry
   poQty / received / balance; the status rule below is identical to
   grnStatusOf() in pages/material-planning/ReceiveGRN.jsx.
   -------------------------------------------------------------------------- */
export const GRN_STATUS = {
  NOT_RECEIVED: "Not Received",
  PARTIALLY_RECEIVED: "Partially Received",
  FULLY_RECEIVED: "Fully Received",
};

export function grnStatusOf(item) {
  if (item.received <= 0) return GRN_STATUS.NOT_RECEIVED;
  if (item.received >= item.poQty) return GRN_STATUS.FULLY_RECEIVED;
  return GRN_STATUS.PARTIALLY_RECEIVED;
}

export async function fetchPendingGrnRows(token) {
  const res = await api.get("/erp/material/receive/list/", {
    headers: headersFor(token),
  });

  const list = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data?.data)
      ? res.data.data
      : [];

  return list
    .map((row) => ({ ...row, grnStatus: grnStatusOf(row) }))
    .filter((row) => row.grnStatus !== GRN_STATUS.FULLY_RECEIVED);
}

/* --------------------------------------------------------------------------
   PENDING CUSTOMER PAYMENTS
   Response: { count, total_outstanding, data:[{ invoice_number,
               customer_name, outstanding_amount, ... }] }
   -------------------------------------------------------------------------- */
export async function fetchPendingPayments(token) {
  const res = await api.get("/erp/admin/pending-payments/", {
    headers: headersFor(token),
  });
  return res.data;
}

/* --------------------------------------------------------------------------
   PROJECT STATUS
   Response: { count, data:[{ name, code, status, progress,
               assemblies_total, assemblies_completed }] }
   `progress` is null when a project has no assemblies yet.
   -------------------------------------------------------------------------- */
export async function fetchAdminProjects(token) {
  const res = await api.get("/erp/admin/projects/", {
    headers: headersFor(token),
  });
  return res.data;
}
