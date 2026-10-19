import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { loginUser } from "../api/auth";
import api from "../api/axios"; // Make sure you import your axios instance

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
        const message = Array.isArray(value) ? value.join(", ") : String(value);
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

  const restoreSession = useCallback(
    async (userType) => {
      if (!isValidUserType(userType)) {
        console.error("Invalid department:", userType);
        return false;
      }

      if (isAuthenticated && user?.user_type === userType && accessToken) {
        return true;
      }

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
            throw new Error("The refresh response must contain success, access, and user.");
          }

          if (data.user.user_type !== userType) {
            throw new Error("The authenticated department does not match the requested department.");
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

          console.error(`Session restoration failed for ${userType}:`, error);

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
   * Standard Login (Password)
   */
  const login = async (username, password, userType) => {
    if (!isValidUserType(userType)) {
      return { success: false, message: "Invalid department selected." };
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

      // If backend intercepts login and requires OTP
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
        setAxiosAccessToken(null);
        setAccessToken(null);
        return {
          success: false,
          message: "The account does not belong to the selected department.",
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
          ? extractBackendErrorMessage(error.response.data, error.response.status)
          : error.request
            ? "Unable to connect to the server. Check whether Django is running."
            : "Something went wrong. Please try again.",
      };
    } finally {
      setAuthLoading(false);
    }
  };

  /*
   * Login Verify OTP (Two-Step Login)
   */
  const loginVerifyOTP = async (username, otp) => {
    try {
      setAuthLoading(true);
      setAuthError(false);

      // Call the new backend verification endpoint
      const response = await api.post("/erp/login/verify-otp/", { username, otp });
      const data = response.data;

      if (!data?.success || !data?.access || !data?.user) {
        return {
          success: false,
          message: data?.message || "Verification failed.",
        };
      }

      const userType = data.user.user_type;

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
          ? extractBackendErrorMessage(error.response.data, error.response.status)
          : "Unable to verify code. Please try again.",
      };
    } finally {
      setAuthLoading(false);
    }
  };

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
        loginVerifyOTP, // <--- Exposed here
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