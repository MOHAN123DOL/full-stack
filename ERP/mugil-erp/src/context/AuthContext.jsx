import {
  createContext,
  useContext,
  useState,
} from "react";

import { loginUser } from "../api/auth";
import api from "../api/axios";

const AuthContext = createContext(null);

// Prevent multiple refresh requests at the same time
let refreshPromise = null;

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  /**
   * =========================================================
   * RESTORE SESSION
   * =========================================================
   *
   * Refresh token:
   * - Stored in HttpOnly cookie
   * - JavaScript cannot read it
   * - Browser automatically sends it to Django
   *
   * Django:
   * - Reads refresh cookie
   * - Validates refresh token
   * - Rotates refresh token
   * - Returns a new access token
   */
  const restoreSession = async () => {
    // Prevent duplicate refresh requests
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        setAuthLoading(true);
        setAuthError(false);

        console.log("Restoring authentication session...");

        const response = await api.post("/erp/refresh/");

        console.log(
          "Refresh response:",
          response.data
        );

        /*
         * Expected response:
         *
         * {
         *   success: true,
         *   access: "...",
         *   user: {
         *     id: 1,
         *     username: "mohan",
         *     user_type: "material-planning"
         *   }
         * }
         */

        if (
          response.data?.success &&
          response.data?.access
        ) {
          const newAccessToken =
            response.data.access;

          const authenticatedUser =
            response.data.user || null;

          // Store new access token in React memory
          setAccessToken(newAccessToken);

          // Store authenticated user
          setUser(authenticatedUser);

          // Mark authentication as successful
          setIsAuthenticated(true);

          console.log(
            "Session restored successfully."
          );

          return true;
        }

        // Invalid refresh response
        console.warn(
          "Refresh response did not contain a valid access token."
        );

        setAccessToken(null);
        setUser(null);
        setIsAuthenticated(false);

        return false;
      } catch (error) {
        console.error(
          "Session restore error:",
          error
        );

        /*
         * 401 means:
         * - Refresh token missing
         * - Refresh token expired
         * - Refresh token invalid
         * - Refresh token blacklisted
         */
        if (error.response?.status === 401) {
          console.warn(
            "Refresh token is invalid or expired."
          );

          setAccessToken(null);
          setUser(null);
          setIsAuthenticated(false);

          return false;
        }

        /*
         * Other errors:
         * - Server unavailable
         * - Network problem
         * - Django error
         */
        setAuthError(true);

        return false;
      } finally {
        setAuthLoading(false);

        // Allow another refresh request later
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  /**
   * =========================================================
   * LOGIN
   * =========================================================
   */
  const login = async (
    username,
    password,
    userType
  ) => {
    try {
      const data = await loginUser(
        username,
        password,
        userType
      );

      /*
       * Expected login response:
       *
       * {
       *   success: true,
       *   access: "...",
       *   user: {...}
       * }
       *
       * Refresh token is NOT returned here.
       * It is stored in an HttpOnly cookie by Django.
       */

      if (!data?.success) {
        return {
          success: false,
          message:
            data?.message ||
            "Unable to sign in.",
        };
      }

      // Store access token in React memory
      setAccessToken(data.access);

      // Store user information
      setUser(data.user || null);

      // Mark authenticated
      setIsAuthenticated(true);

      // Clear previous auth error
      setAuthError(false);

      return {
        success: true,
        user: data.user,
        accessToken: data.access,
      };
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      /*
       * Django returned an HTTP error
       */
      if (error.response) {
        return {
          success: false,
          message:
            error.response.data?.message ||
            "Unable to sign in.",
        };
      }

      /*
       * Request was sent but no response received
       */
      if (error.request) {
        return {
          success: false,
          message:
            "Unable to connect to the server.",
        };
      }

      /*
       * Something happened while creating
       * the request
       */
      return {
        success: false,
        message:
          "Something went wrong. Please try again.",
      };
    }
  };

  /**
   * =========================================================
   * LOGOUT
   * =========================================================
   */
  const logout = async () => {
    try {
      /*
       * Django receives the refresh cookie,
       * blacklists the refresh token,
       * and deletes the cookie.
       */
      await api.post("/erp/logout/");
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    } finally {
      /*
       * Always clear frontend authentication state,
       * even if the backend logout request fails.
       */
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      setAuthError(false);
    }
  };

  /**
   * =========================================================
   * AUTH CONTEXT
   * =========================================================
   */
  return (
    <AuthContext.Provider
      value={{
        // Authentication state
        isAuthenticated,

        // Current logged-in user
        user,

        // Short-lived JWT access token
        accessToken,

        // Authentication loading state
        authLoading,

        // Authentication/server error state
        authError,

        // Functions
        login,
        restoreSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * =========================================================
 * USE AUTH HOOK
 * =========================================================
 */
export function useAuth() {
  return useContext(AuthContext);
}