// src/hr/salaryApi.js
//
// Matches the API pattern used by Employees.jsx exactly:
//   import api from "../../api/axios";
//   const { accessToken } = useAuth();
//   api.get(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } })
//
// Endpoints (all under the /erp/ prefix):
//   GET    /erp/salary/employees/?search=&department=&page=&page_size=
//   GET    /erp/salary-payments/?month=&search=&department=&...=
//   POST   /erp/salary-payments/
//   GET    /erp/salary-payments/<id>/
//   PATCH  /erp/salary-payments/<id>/
//   DELETE /erp/salary-payments/<id>/
//   GET    /erp/advances/?search=&status=&date_from=&...=
//   POST   /erp/advances/
//   GET    /erp/advances/<id>/
//   PATCH  /erp/advances/<id>/
//   DELETE /erp/advances/<id>/

import { useCallback, useMemo } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const SALARY_EMPLOYEES_ENDPOINT = "/erp/salary/employees/";
const SALARY_PAYMENTS_ENDPOINT = "/erp/salary-payments/";
const ADVANCES_ENDPOINT = "/erp/advances/";

/* =========================================================
   HELPER — build query string, skipping empty values
   ========================================================= */

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) {
      q.append(k, v);
    }
  });
  return q.toString();
}

/* =========================================================
   HOOK — all salary + advance API calls
   ========================================================= */

export function useSalaryApi() {
  const { accessToken } = useAuth();

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  /* -------------------------------------------------------
     SALARY EMPLOYEES — server-side search + pagination
     ------------------------------------------------------- */
  const getSalaryEmployees = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
        page: params.page || 1,
        page_size: params.page_size || 25,
      });
      const response = await api.get(
        `${SALARY_EMPLOYEES_ENDPOINT}?${query}`,
        { headers: authHeaders() }
      );
      return response.data;
    },
    [authHeaders]
  );

  /* -------------------------------------------------------
     SALARY PAYMENTS
     ------------------------------------------------------- */
  const getSalaryPayments = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        month: params.month || "",
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
        payment_status: params.payment_status || "",
        page: params.page || 1,
        page_size: params.page_size || 25,
      });
      const response = await api.get(
        `${SALARY_PAYMENTS_ENDPOINT}?${query}`,
        { headers: authHeaders() }
      );
      return response.data;
    },
    [authHeaders]
  );

  const getSalaryPayment = useCallback(
    async (id) => {
      const response = await api.get(`${SALARY_PAYMENTS_ENDPOINT}${id}/`, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  const createSalaryPayment = useCallback(
    async (data) => {
      const response = await api.post(SALARY_PAYMENTS_ENDPOINT, data, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  const updateSalaryPayment = useCallback(
    async (id, data) => {
      const response = await api.patch(
        `${SALARY_PAYMENTS_ENDPOINT}${id}/`,
        data,
        { headers: authHeaders() }
      );
      return response.data;
    },
    [authHeaders]
  );

  const deleteSalaryPayment = useCallback(
    async (id) => {
      const response = await api.delete(
        `${SALARY_PAYMENTS_ENDPOINT}${id}/`,
        { headers: authHeaders() }
      );
      return response.data;
    },
    [authHeaders]
  );

  /* -------------------------------------------------------
     ADVANCES
     ------------------------------------------------------- */
  const getAdvances = useCallback(
    async (params = {}) => {
      const query = buildQuery({
        search: params.search || "",
        department: params.department || "",
        branch: params.branch || "",
        employment_type: params.employment_type || "",
        work_location: params.work_location || "",
        status: params.status || "",
        date_from: params.date_from || "",
        date_to: params.date_to || "",
        page: params.page || 1,
        page_size: params.page_size || 25,
      });
      const response = await api.get(`${ADVANCES_ENDPOINT}?${query}`, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  const getAdvance = useCallback(
    async (id) => {
      const response = await api.get(`${ADVANCES_ENDPOINT}${id}/`, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  const createAdvance = useCallback(
    async (data) => {
      const response = await api.post(ADVANCES_ENDPOINT, data, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  const updateAdvance = useCallback(
    async (id, data) => {
      const response = await api.patch(`${ADVANCES_ENDPOINT}${id}/`, data, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  const deleteAdvance = useCallback(
    async (id) => {
      const response = await api.delete(`${ADVANCES_ENDPOINT}${id}/`, {
        headers: authHeaders(),
      });
      return response.data;
    },
    [authHeaders]
  );

  return useMemo(
    () => ({
      getSalaryEmployees,
      getSalaryPayments,
      getSalaryPayment,
      createSalaryPayment,
      updateSalaryPayment,
      deleteSalaryPayment,
      getAdvances,
      getAdvance,
      createAdvance,
      updateAdvance,
      deleteAdvance,
    }),
    [
      getSalaryEmployees,
      getSalaryPayments,
      getSalaryPayment,
      createSalaryPayment,
      updateSalaryPayment,
      deleteSalaryPayment,
      getAdvances,
      getAdvance,
      createAdvance,
      updateAdvance,
      deleteAdvance,
    ]
  );
}