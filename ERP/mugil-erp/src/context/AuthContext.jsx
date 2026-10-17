
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { loginUser } from "../api/auth";

import {
  setAccessToken as setAxiosAccessToken,
  setActiveUserType,
  setAuthHandlers,
  refreshDepartmentSession,
  logoutDepartmentSession,
} from "../api/axios";

const AuthContext = createContext(null);

const VALID_USER_TYPES = [
  "admin",
  "accounts",
  "hr",
  "material-planning",
  "production",
  "supervisor",
];

// Avoid duplicate refresh requests for the same department.
const refreshPromises = new Map();

function isValidUserType(userType) {
  return VALID_USER_TYPES.includes(userType);
}

function extractBackendErrorMessage(responseData, fallbackStatus) {
  if (!responseData || typeof responseData !== "object") {
    return fallbackStatus
      ? `Request failed (${fallbackStatus}).`
      : "Unable to complete the request.";
  }

  if (
    typeof responseData.message === "string" &&
    responseData.message
  ) {
    return responseData.message;
  }

  if (
    typeof responseData.detail === "string" &&
    responseData.detail
  ) {
    return responseData.detail;
  }

  const errors = responseData.errors || responseData;

  if (typeof errors === "object") {
    const messages = Object.entries(errors)
      .map(([field, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value);

        return `${field}: ${message}`;
      })
      .join(" | ");

    if (messages) {
      return messages;
    }
  }

  return fallbackStatus
    ? `Request failed (${fallbackStatus}).`
    : "Unable to complete the request.";
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  /*
   * Keep Axios and React authentication state synchronized
   * when the Axios interceptor refreshes an access token.
   */
  useEffect(() => {
    setAuthHandlers({
      onRefresh: (newAccessToken, refreshedUser) => {
        setAxiosAccessToken(newAccessToken);
        setAccessToken(newAccessToken);

        if (refreshedUser) {
          setUser(refreshedUser);
          setActiveUserType(refreshedUser.user_type);
        }

        setIsAuthenticated(true);
        setAuthError(false);
      },

      onFail: () => {
        setAxiosAccessToken(null);
        setAccessToken(null);
        setUser(null);
        setIsAuthenticated(false);
      },
    });

    return () => {
      setAuthHandlers({
        onRefresh: null,
        onFail: null,
      });
    };
  }, []);

  /*
   * Restore a department-specific session using its HttpOnly
   * refresh cookie.
   */
  const restoreSession = useCallback(
    async (userType) => {
      if (!isValidUserType(userType)) {
        console.error("Invalid department:", userType);
        return false;
      }

      if (
        isAuthenticated &&
        user?.user_type === userType &&
        accessToken
      ) {
        return true;
      }

      // Reuse an in-progress refresh for this department.
      if (refreshPromises.has(userType)) {
        return refreshPromises.get(userType);
      }

      const restorePromise = (async () => {
        try {
          setAuthLoading(true);
          setAuthError(false);
          setActiveUserType(userType);

          const response = await refreshDepartmentSession(userType);
          const data = response?.data;

          if (!data?.success || !data?.access || !data?.user) {
            throw new Error(
              "The refresh response must contain success, access, and user."
            );
          }

          if (data.user.user_type !== userType) {
            throw new Error(
              "The authenticated department does not match the requested department."
            );
          }

          setActiveUserType(userType);
          setAxiosAccessToken(data.access);

          setAccessToken(data.access);
          setUser(data.user);
          setIsAuthenticated(true);
          setAuthError(false);

          return true;
        } catch (error) {
          const status = error?.response?.status;

          console.error(
            `Session restoration failed for ${userType}:`,
            error
          );

          /*
           * A 401/403 normally means this department has no
           * valid session. A network/server error is different.
           */
          if (!status || (status !== 401 && status !== 403)) {
            setAuthError(true);
          }

          /*
           * Clear authentication only if the current state belongs
           * to the department whose refresh failed. A failed attempt
           * for another department must not erase a valid session.
           */
          if (user?.user_type === userType) {
            setAxiosAccessToken(null);
            setAccessToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }

          return false;
        } finally {
          setAuthLoading(false);
        }
      })();

      refreshPromises.set(userType, restorePromise);

      try {
        return await restorePromise;
      } finally {
        if (refreshPromises.get(userType) === restorePromise) {
          refreshPromises.delete(userType);
        }
      }
    },
    [isAuthenticated, user, accessToken]
  );

  /*
   * Login
   */
  const login = async (username, password, userType) => {
    if (!isValidUserType(userType)) {
      return {
        success: false,
        message: "Invalid department selected.",
      };
    }

    try {
      setAuthLoading(true);
      setAuthError(false);

      setActiveUserType(userType);

      // Remove any previous access token before changing departments.
      setAxiosAccessToken(null);
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);

      const data = await loginUser(username, password, userType);

      if (!data?.success || !data?.access || !data?.user) {
        return {
          success: false,
          message: data?.message || "Unable to sign in.",
        };
      }

      if (data.user.user_type !== userType) {
        setAxiosAccessToken(null);
        setAccessToken(null);

        return {
          success: false,
          message:
            "The account does not belong to the selected department.",
        };
      }

      setActiveUserType(userType);
      setAxiosAccessToken(data.access);

      setAccessToken(data.access);
      setUser(data.user);
      setIsAuthenticated(true);
      setAuthError(false);

      return {
        success: true,
        user: data.user,
        accessToken: data.access,
      };
    } catch (error) {
      console.error("Login error:", error);

      setAxiosAccessToken(null);
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);

      return {
        success: false,
        message: error.response
          ? extractBackendErrorMessage(
              error.response.data,
              error.response.status
            )
          : error.request
            ? "Unable to connect to the server. Check whether Django is running."
            : "Something went wrong. Please try again.",
      };
    } finally {
      setAuthLoading(false);
    }
  };

  /*
   * Logout from the current department.
   */
  const logout = async () => {
    const department = user?.user_type;

    try {
      if (isValidUserType(department)) {
        await logoutDepartmentSession(department);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAxiosAccessToken(null);
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(false);
      setActiveUserType(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        accessToken,
        authLoading,
        authError,
        login,
        restoreSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

