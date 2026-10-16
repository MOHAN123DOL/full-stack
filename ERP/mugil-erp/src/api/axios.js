
import axios from "axios";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const API_BASE_URL = "http://localhost:8000/api";
const ERP_AUTH_URL = `${API_BASE_URL}/erp`;

const CSRF_COOKIE_NAME = "csrftoken";

const VALID_USER_TYPES = [
  "admin",
  "accounts",
  "hr",
  "material-planning",
  "production",
  "supervisor",
];

/* ============================================================
   COOKIE READER
   ============================================================ */

function getCookie(name) {
  const escapedName = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = document.cookie.match(
    new RegExp(`(^|;\\s*)${escapedName}=([^;]*)`)
  );

  return match ? decodeURIComponent(match[2]) : null;
}

/* ============================================================
   DEPARTMENT CONTEXT
   ============================================================
   Each browser tab has its own JavaScript runtime.

   AuthContext must call setActiveUserType() before making
   department-specific refresh or logout requests.
   ============================================================ */

let activeUserType = null;

export function setActiveUserType(userType) {
  if (userType && VALID_USER_TYPES.includes(userType)) {
    activeUserType = userType;
  } else {
    activeUserType = null;
  }
}

export function getActiveUserType() {
  return activeUserType;
}

function getDepartmentAuthUrl(action, userType = activeUserType) {
  if (!userType || !VALID_USER_TYPES.includes(userType)) {
    throw new Error(
      "A valid department user_type is required for authentication."
    );
  }

  return `${ERP_AUTH_URL}/${action}/${encodeURIComponent(userType)}/`;
}

/* ============================================================
   ACCESS TOKEN STORE
   ============================================================
   The access token remains in JavaScript memory.
   Do not store it in localStorage or sessionStorage.
   ============================================================ */

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/* ============================================================
   AUTH CALLBACKS
   ============================================================ */

let onTokenRefreshed = null;
let onAuthFailed = null;

export function setAuthHandlers({
  onRefresh,
  onFail,
} = {}) {
  onTokenRefreshed = onRefresh || null;
  onAuthFailed = onFail || null;
}

/* ============================================================
   AXIOS INSTANCE
   ============================================================ */

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

/* ============================================================
   REQUEST INTERCEPTOR
   ============================================================ */

api.interceptors.request.use(
  (config) => {
    if (!config.headers) {
      config.headers = {};
    }

    const setHeader = (key, value) => {
      if (typeof config.headers.set === "function") {
        config.headers.set(key, value);
      } else {
        config.headers[key] = value;
      }
    };

    const method = (config.method || "").toLowerCase();

    // Attach CSRF token to write requests.
    if (
      ["post", "put", "patch", "delete"].includes(method)
    ) {
      const csrfToken = getCookie(CSRF_COOKIE_NAME);

      if (csrfToken) {
        setHeader("X-CSRFToken", csrfToken);
      }
    }

    // Attach the current tab's access token.
    if (accessToken) {
      setHeader("Authorization", `Bearer ${accessToken}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================
   RESPONSE INTERCEPTOR
   ============================================================
   - Refreshes using the active department's endpoint.
   - Prevents duplicate refresh calls for the same department.
   - Retries each original request at most once.
   - Does not refresh login, refresh, or logout requests.
   ============================================================ */

// Separate refresh operations by department.
const refreshInFlight = new Map();

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    const isAuthEndpoint =
      url.includes("/erp/login/") ||
      url.includes("/erp/refresh/") ||
      url.includes("/erp/logout/");

    if (
      status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    // The department is resolved from this tab's auth context.
    const userType = activeUserType;

    if (!userType || !VALID_USER_TYPES.includes(userType)) {
      accessToken = null;
      onAuthFailed?.();

      return Promise.reject(error);
    }

    original._retry = true;

    try {
      let refreshPromise = refreshInFlight.get(userType);

      if (!refreshPromise) {
        const refreshUrl = getDepartmentAuthUrl(
          "refresh",
          userType
        );

        // Use bare axios to avoid recursively invoking this
        // instance's response interceptor.
        refreshPromise = axios
          .post(
            `${API_BASE_URL}${refreshUrl.replace(ERP_AUTH_URL, "/erp")}`,
            null,
            {
              withCredentials: true,
            }
          )
          .then((response) => response.data)
          .finally(() => {
            refreshInFlight.delete(userType);
          });

        refreshInFlight.set(userType, refreshPromise);
      }

      const data = await refreshPromise;

      if (!data?.success || !data?.access) {
        throw new Error("Unable to refresh the access token.");
      }

      // Update the token for this browser tab.
      accessToken = data.access;

      // Keep React authentication state synchronized.
      onTokenRefreshed?.(
        data.access,
        data.user || null
      );

      // Retry the original API request once.
      return api(original);
    } catch (refreshError) {
      accessToken = null;

      onAuthFailed?.();

      return Promise.reject(refreshError);
    }
  }
);

/* ============================================================
   DEPARTMENT AUTH HELPERS
   ============================================================ */

export function refreshDepartmentSession(userType = activeUserType) {
  const refreshUrl = getDepartmentAuthUrl(
    "refresh",
    userType
  );

  return api.post(refreshUrl.replace(API_BASE_URL, ""));
}

export function logoutDepartmentSession(userType = activeUserType) {
  const logoutUrl = getDepartmentAuthUrl(
    "logout",
    userType
  );

  return api.post(logoutUrl.replace(API_BASE_URL, ""));
}

export default api;

