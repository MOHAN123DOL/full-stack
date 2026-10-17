import axios from "axios";

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

function getCookie(name) {
const escapedName = name.replace(
/[.*+?^${}()|[]\]/g,
"\$&"
);

const match = document.cookie.match(
new RegExp(`(^|;\\s*)${escapedName}=([^;]*)`)
);

return match ? decodeURIComponent(match[2]) : null;
}

let activeUserType = null;

export function setActiveUserType(userType) {
activeUserType = VALID_USER_TYPES.includes(userType)
? userType
: null;
}

export function getActiveUserType() {
return activeUserType;
}

function getDepartmentAuthUrl(
action,
userType = activeUserType
) {
if (!VALID_USER_TYPES.includes(userType)) {
throw new Error(
"A valid department user_type is required for authentication."
);
}

return `${ERP_AUTH_URL}/${action}/${encodeURIComponent(userType)}/`;
}

let accessToken = null;

export function setAccessToken(token) {
accessToken = token || null;
}

export function getAccessToken() {
return accessToken;
}

let onTokenRefreshed = null;
let onAuthFailed = null;

export function setAuthHandlers({
onRefresh,
onFail,
} = {}) {
onTokenRefreshed = onRefresh || null;
onAuthFailed = onFail || null;
}

const api = axios.create({
baseURL: API_BASE_URL,
withCredentials: true,
});

api.interceptors.request.use(
(config) => {
const method = (config.method || "").toLowerCase();


if (
  ["post", "put", "patch", "delete"].includes(method)
) {
  const csrfToken = getCookie(CSRF_COOKIE_NAME);

  if (csrfToken) {
    config.headers.set
      ? config.headers.set("X-CSRFToken", csrfToken)
      : (config.headers["X-CSRFToken"] = csrfToken);
  }
}

if (accessToken) {
  config.headers.set
    ? config.headers.set(
        "Authorization",
        `Bearer ${accessToken}`
      )
    : (config.headers.Authorization = `Bearer ${accessToken}`);
}

return config;


},
(error) => Promise.reject(error)
);

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

const userType = activeUserType;

if (!VALID_USER_TYPES.includes(userType)) {
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

    refreshPromise = axios
      .post(refreshUrl, null, {
        withCredentials: true,
      })
      .then((response) => response.data)
      .finally(() => {
        refreshInFlight.delete(userType);
      });

    refreshInFlight.set(userType, refreshPromise);
  }

  const data = await refreshPromise;

  if (
    !data?.success ||
    !data?.access ||
    !data?.user ||
    data.user.user_type !== userType
  ) {
    throw new Error(
      "The refresh response is invalid or belongs to another department."
    );
  }

  accessToken = data.access;

  onTokenRefreshed?.(
    data.access,
    data.user
  );

  return api(original);
} catch (refreshError) {
  accessToken = null;
  onAuthFailed?.();

  return Promise.reject(refreshError);
}


}
);

export function refreshDepartmentSession(
userType = activeUserType
) {
const refreshUrl = getDepartmentAuthUrl(
"refresh",
userType
);

return api.post(
refreshUrl.replace(API_BASE_URL, "")
);
}

export function logoutDepartmentSession(
userType = activeUserType
) {
const logoutUrl = getDepartmentAuthUrl(
"logout",
userType
);

return api.post(
logoutUrl.replace(API_BASE_URL, "")
);
}

export default api;
