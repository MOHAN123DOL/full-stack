import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { loginUser } from "../api/auth";
import api from "../api/axios";

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

const ACTIVE_DEPARTMENT_KEY = "erp_active_department";

const refreshPromises = new Map();

function isValidUserType(userType) {
  return VALID_USER_TYPES.includes(userType);
}

function saveActiveDepartment(userType) {
  if (isValidUserType(userType)) {
    sessionStorage.setItem(ACTIVE_DEPARTMENT_KEY, userType);
  }
}

function getActiveDepartment() {
  const userType = sessionStorage.getItem(ACTIVE_DEPARTMENT_KEY);

  return isValidUserType(userType) ? userType : null;
}

function clearActiveDepartment() {
  sessionStorage.removeItem(ACTIVE_DEPARTMENT_KEY);
}

function extractBackendErrorMessage(responseData, fallbackStatus) {
  if (!responseData || typeof responseData !== "object") {
    return fallbackStatus
      ? `Request failed (${fallbackStatus}).`
      : "Unable to complete the request.";
  }

  if (typeof responseData.message === "string" && responseData.message) {
    return responseData.message;
  }

  if (typeof responseData.detail === "string" && responseData.detail) {
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
   * Axios authentication handlers
   */
  useEffect(() => {
    setAuthHandlers({
      onRefresh: (newAccessToken, refreshedUser) => {
        if (!newAccessToken) {
          return;
        }

        if (
          refreshedUser &&
          !isValidUserType(refreshedUser.user_type)
        ) {
          console.error("Invalid department returned during refresh.");
          return;
        }

        if (refreshedUser) {
          saveActiveDepartment(refreshedUser.user_type);

          setUser(refreshedUser);
          setActiveUserType(refreshedUser.user_type);
        }

        setAxiosAccessToken(newAccessToken);
        setAccessToken(newAccessToken);

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
   * Restore one specific department
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

      if (refreshPromises.has(userType)) {
        return refreshPromises.get(userType);
      }

      const restorePromise = (async () => {
        try {
          setAuthLoading(true);
          setAuthError(false);

          const response = await refreshDepartmentSession(userType);
          const data = response?.data;

          if (!data?.success || !data?.access || !data?.user) {
            throw new Error(
              "Refresh response must contain success, access, and user."
            );
          }

          if (data.user.user_type !== userType) {
            throw new Error(
              "Authenticated department does not match requested department."
            );
          }

          if (!isValidUserType(data.user.user_type)) {
            throw new Error("Invalid department returned by the server.");
          }

          saveActiveDepartment(userType);

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

          if (!status || (status !== 401 && status !== 403)) {
            setAuthError(true);
          }

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
   * Standard Login
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

      setAxiosAccessToken(null);
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);

      const data = await loginUser(username, password, userType);

      if (data?.otp_required) {
        setAuthLoading(false);

        return {
          success: true,
          otp_required: true,
          message: data.message,
        };
      }

      if (!data?.success || !data?.access || !data?.user) {
        return {
          success: false,
          message: data?.message || "Unable to sign in.",
        };
      }

      if (data.user.user_type !== userType) {
        return {
          success: false,
          message: "Account does not belong to the selected department.",
        };
      }

      saveActiveDepartment(userType);

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
   * OTP Login
   */
  const loginVerifyOTP = async (username, otp) => {
    try {
      setAuthLoading(true);
      setAuthError(false);

      const response = await api.post("/erp/login/verify-otp/", {
        username,
        otp,
      });

      const data = response.data;

      if (!data?.success || !data?.access || !data?.user) {
        return {
          success: false,
          message: data?.message || "Verification failed.",
        };
      }

      const userType = data.user.user_type;

      if (!isValidUserType(userType)) {
        return {
          success: false,
          message: "Invalid department returned by the server.",
        };
      }

      saveActiveDepartment(userType);

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
      console.error("OTP Verification error:", error);

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
          : "Unable to verify code. Please try again.",
      };
    } finally {
      setAuthLoading(false);
    }
  };

  /*
   * Logout
   */
  const logout = async () => {
    const department = user?.user_type || getActiveDepartment();

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

      clearActiveDepartment();
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
        loginVerifyOTP,
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