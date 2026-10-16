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

/*
|--------------------------------------------------------------------------
| Supported departments
|--------------------------------------------------------------------------
*/

const VALID_USER_TYPES = [
  "admin",
  "accounts",
  "hr",
  "material-planning",
  "production",
  "supervisor",
];

/*
|--------------------------------------------------------------------------
| Prevent duplicate refresh requests for the same department
|--------------------------------------------------------------------------
*/

const refreshPromises = new Map();

function isValidUserType(userType) {
  return VALID_USER_TYPES.includes(userType);
}

/*
|--------------------------------------------------------------------------
| Extract backend error messages
|--------------------------------------------------------------------------
*/

function extractBackendErrorMessage(
  responseData,
  fallbackStatus
) {
  if (
    !responseData ||
    typeof responseData !== "object"
  ) {
    return fallbackStatus
      ? `Login failed (${fallbackStatus}).`
      : "Unable to sign in. Please try again.";
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

  if (
    responseData.errors &&
    typeof responseData.errors === "object"
  ) {
    return Object.entries(responseData.errors)
      .map(([field, messages]) => {
        const message = Array.isArray(messages)
          ? messages.join(", ")
          : String(messages);

        return `${field}: ${message}`;
      })
      .join(" | ");
  }

  return (
    `Unable to sign in${
      fallbackStatus
        ? ` (${fallbackStatus})`
        : ""
    }.`
  );
}

/*
|--------------------------------------------------------------------------
| Auth Provider
|--------------------------------------------------------------------------
*/

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  const [user, setUser] = useState(null);

  const [accessToken, setAccessToken] =
    useState(null);

  // Used for login and session restoration requests.
  const [authLoading, setAuthLoading] =
    useState(false);

  const [authError, setAuthError] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Synchronize Axios authentication callbacks
  |--------------------------------------------------------------------------
  |
  | When Axios refreshes an expired access token, it notifies
  | this context so React state remains synchronized.
  |
  */

  useEffect(() => {
    setAuthHandlers({
      onRefresh: (newAccessToken, refreshedUser) => {
        setAxiosAccessToken(newAccessToken);
        setAccessToken(newAccessToken);

        if (refreshedUser) {
          setUser(refreshedUser);
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
  |--------------------------------------------------------------------------
  | RESTORE SESSION
  |--------------------------------------------------------------------------
  |
  | Called by ProtectedRoute after a browser refresh.
  |
  | The access token is stored in memory, so it disappears
  | when the page reloads.
  |
  | The backend must use the department-specific HttpOnly
  | refresh cookie to issue a new access token.
  |
  */

  const restoreSession = useCallback(
    async (userType) => {
      if (!isValidUserType(userType)) {
        console.error(
          "Invalid department passed to restoreSession:",
          userType
        );

        return false;
      }

      /*
       * If this department is already authenticated,
       * do not make another refresh request.
       */

      if (
        isAuthenticated &&
        user?.user_type === userType &&
        accessToken
      ) {
        return true;
      }

      /*
       * Avoid simultaneous refresh requests for the
       * same department.
       */

      if (refreshPromises.has(userType)) {
        return refreshPromises.get(userType);
      }

      const restorePromise = (async () => {
        try {
          setAuthLoading(true);
          setAuthError(false);

          setActiveUserType(userType);

          const response =
            await refreshDepartmentSession(userType);

          const data = response?.data;

          if (
            !data?.success ||
            !data?.access ||
            !data?.user
          ) {
            throw new Error(
              "The refresh endpoint must return success, access, and user."
            );
          }

          const authenticatedUser = data.user;

          /*
           * Never accept a session belonging to another
           * department.
           */

          if (
            authenticatedUser.user_type !== userType
          ) {
            throw new Error(
              "The authenticated department does not match the requested department."
            );
          }

          /*
           * Restore the access token and user in React
           * and Axios.
           */

          setActiveUserType(userType);
          setAxiosAccessToken(data.access);

          setAccessToken(data.access);
          setUser(authenticatedUser);

          setIsAuthenticated(true);
          setAuthError(false);

          return true;
        } catch (error) {
          console.error(
            `Session restoration failed for ${userType}:`,
            error
          );

          setAxiosAccessToken(null);
          setAccessToken(null);

          setUser(null);
          setIsAuthenticated(false);

          /*
           * A missing or expired refresh cookie means
           * the user must log in again.
           *
           * Other server errors are exposed through
           * authError for troubleshooting.
           */

          if (
            error.response &&
            error.response.status !== 401 &&
            error.response.status !== 403
          ) {
            setAuthError(true);
          } else if (!error.response) {
            setAuthError(true);
          }

          return false;
        } finally {
          setAuthLoading(false);
        }
      })();

      refreshPromises.set(
        userType,
        restorePromise
      );

      try {
        return await restorePromise;
      } finally {
        if (
          refreshPromises.get(userType) ===
          restorePromise
        ) {
          refreshPromises.delete(userType);
        }
      }
    },
    [
      isAuthenticated,
      user,
      accessToken,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  const login = async (
    username,
    password,
    userType
  ) => {
    if (!isValidUserType(userType)) {
      return {
        success: false,
        message: "Invalid department selected.",
      };
    }

    try {
      setAuthLoading(true);
      setAuthError(false);

      /*
       * Select the department before the login request.
       */

      setActiveUserType(userType);

      /*
       * Remove any previous in-memory token.
       */

      setAxiosAccessToken(null);
      setAccessToken(null);

      const data = await loginUser(
        username,
        password,
        userType
      );

      if (
        !data?.success ||
        !data?.access ||
        !data?.user
      ) {
        return {
          success: false,
          message:
            data?.message ||
            "Unable to sign in.",
        };
      }

      /*
       * Verify the department returned by Django.
       */

      if (
        data.user.user_type !== userType
      ) {
        setAxiosAccessToken(null);
        setAccessToken(null);

        setUser(null);
        setIsAuthenticated(false);

        return {
          success: false,
          message:
            "The account does not belong to the selected department.",
        };
      }

      /*
       * Save authentication state.
       *
       * The backend must also set the appropriate
       * department-specific refresh cookie.
       */

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
            ? "Unable to connect to the server. Check whether the backend is running."
            : "Something went wrong. Please try again.",
      };
    } finally {
      setAuthLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  const logout = async () => {
    const department = user?.user_type;

    try {
      if (
        department &&
        isValidUserType(department)
      ) {
        await logoutDepartmentSession(
          department
        );
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAxiosAccessToken(null);
      setAccessToken(null);

      setUser(null);
      setIsAuthenticated(false);

      setAuthError(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | CONTEXT
  |--------------------------------------------------------------------------
  */

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

/*
|--------------------------------------------------------------------------
| Auth Hook
|--------------------------------------------------------------------------
*/

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}