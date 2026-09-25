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

/* ============================================================
   AXIOS INSTANCE
   ============================================================ */
const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

/* ============================================================
   REQUEST INTERCEPTOR — attach CSRF token on write requests
   ============================================================ */
api.interceptors.request.use(
  (config) => {
    const method = (config.method || "").toLowerCase();

    if (["post", "put", "patch", "delete"].includes(method)) {
      const csrfToken = getCookie("csrftoken");

      if (csrfToken) {
        config.headers = config.headers || {};
        config.headers["X-CSRFToken"] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;