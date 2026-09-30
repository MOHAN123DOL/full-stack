import axios from "axios";

/* ============================================================
   COOKIE READER
   ============================================================ */
function getCookie(name) {
  const match = document.cookie.match(
    new RegExp("(^|;\\s*)" + name + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[2]) : null;
}

// Keep this in sync with Django's CSRF_COOKIE_NAME setting.
const CSRF_COOKIE_NAME = "csrftoken";

/* ============================================================
   ACCESS TOKEN STORE (in-memory)
   ============================================================
   AuthContext owns the token and pushes it here so the request
   interceptor can attach it without prop-drilling or globals.
*/
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/* ============================================================
   AUTH CALLBACKS — injected from AuthContext
   ============================================================
   onTokenRefreshed(access, user) → AuthContext updates state
   onAuthFailed()                 → AuthContext clears state
*/
let onTokenRefreshed = null;
let onAuthFailed = null;

export function setAuthHandlers({ onRefresh, onFail }) {
  onTokenRefreshed = onRefresh;
  onAuthFailed = onFail;
}

/* ============================================================
   AXIOS INSTANCE
   ============================================================
   NOTE: Do NOT set a default Content-Type here.
   Axios automatically picks the right one per request:
     - plain object  → application/json
     - FormData      → multipart/form-data (with boundary)
     - URLSearchParams → application/x-www-form-urlencoded
   Hard-coding application/json breaks file uploads
   (e.g. the employee `photo` field).
*/
const api = axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true,
});

/* ============================================================
   REQUEST INTERCEPTOR
   ============================================================
   1. Attach X-CSRFToken on write methods (POST/PUT/PATCH/DELETE)
   2. Attach Authorization: Bearer <accessToken> when available
*/
api.interceptors.request.use(
  (config) => {
    // Axios 1.x always passes an AxiosHeaders instance here, but
    // guard in case it's a plain object.
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

    // CSRF token for write requests
    if (["post", "put", "patch", "delete"].includes(method)) {
      const csrfToken = getCookie(CSRF_COOKIE_NAME);
      if (csrfToken) {
        setHeader("X-CSRFToken", csrfToken);
      }
    }

    // Bearer token for authenticated requests
    if (accessToken) {
      setHeader("Authorization", `Bearer ${accessToken}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================
   RESPONSE INTERCEPTOR — refresh access token on 401
   ============================================================
   - Single-flight: parallel 401s share one refresh request.
   - Retries the original request exactly once.
   - Skips refresh for the refresh endpoint itself.
*/
let refreshInFlight = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    const isRefreshCall = url.includes("/erp/refresh/");
    const isLoginCall = url.includes("/erp/login/");

    // Don't retry refresh or login calls, don't retry twice.
    if (
      status !== 401 ||
      !original ||
      original._retry ||
      isRefreshCall ||
      isLoginCall
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshInFlight) {
        // Use a *bare* axios call (not `api`) so we don't recurse
        // through this interceptor.
        refreshInFlight = axios
          .post(
            "http://localhost:8000/api/erp/refresh/",
            null,
            { withCredentials: true }
          )
          .then((res) => res.data)
          .finally(() => {
            // Clear after the current microtask so concurrent
            // awaiters still receive the same result.
            queueMicrotask(() => {
              refreshInFlight = null;
            });
          });
      }

      const data = await refreshInFlight;

      if (!data?.success || !data?.access) {
        throw new Error("Refresh failed");
      }

      // Update the local token store immediately so the retried
      // request picks it up from the request interceptor.
      accessToken = data.access;

      // Notify AuthContext so React state stays in sync.
      onTokenRefreshed?.(data.access, data.user || null);

      // Replay the original request.
      // (The request interceptor will re-attach the new Bearer token.)
      return api(original);
    } catch (refreshErr) {
      onAuthFailed?.();
      return Promise.reject(refreshErr);
    }
  }
);

export default api;