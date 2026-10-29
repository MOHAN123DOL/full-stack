import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import Loading from "./loading";
import Error from "./error";

const DEPARTMENT_ROUTES = {
  admin: "/admin/login",
  accounts: "/accounts/login",
  hr: "/hr/login",
  "material-planning": "/material-planning/login",
  production: "/production/login",
  supervisor: "/supervisor/login",
};

const VALID_USER_TYPES = Object.keys(DEPARTMENT_ROUTES);

const DEPARTMENT_PATHS = [
  {
    userType: "material-planning",
    prefixes: ["/inventory", "/material-planning"],
  },
  {
    userType: "admin",
    prefixes: ["/admin"],
  },
  {
    userType: "accounts",
    prefixes: ["/accounts"],
  },
  {
    userType: "hr",
    prefixes: ["/hr"],
  },
  {
    userType: "production",
    prefixes: ["/production"],
  },
  {
    userType: "supervisor",
    prefixes: ["/supervisor"],
  },
];

const SHARED_PATHS = ["/welcome", "/profile"];

/*
 * Specific route access overrides.
 *
 * Delivery Challan can be accessed by:
 * - Accounts
 * - Material Planning
 *
 * Other /accounts routes remain Accounts-only.
 */
const ROUTE_ACCESS_OVERRIDES = {
  "/accounts/deliverychallan": ["accounts", "material-planning"],
};

function normalizePath(pathname) {
  return String(pathname || "").toLowerCase().replace(/\/+$/, "") || "/";
}

function getDepartmentFromPath(pathname) {
  const normalizedPath = normalizePath(pathname);

  for (const department of DEPARTMENT_PATHS) {
    for (const prefix of department.prefixes) {
      const normalizedPrefix = normalizePath(prefix);

      if (
        normalizedPath === normalizedPrefix ||
        normalizedPath.startsWith(`${normalizedPrefix}/`)
      ) {
        return department.userType;
      }
    }
  }

  return null;
}

function getAllowedUserTypesFromPath(pathname) {
  const normalizedPath = normalizePath(pathname);

  // Check specific route overrides first.
  if (ROUTE_ACCESS_OVERRIDES[normalizedPath]) {
    return ROUTE_ACCESS_OVERRIDES[normalizedPath];
  }

  const department = getDepartmentFromPath(normalizedPath);

  return department ? [department] : [];
}

function isSharedPath(pathname) {
  const normalizedPath = normalizePath(pathname);

  return SHARED_PATHS.some((path) => {
    const normalizedSharedPath = normalizePath(path);

    return (
      normalizedPath === normalizedSharedPath ||
      normalizedPath.startsWith(`${normalizedSharedPath}/`)
    );
  });
}

export default function ProtectedRoute({
  children,
  userType: requestedUserType,
}) {
  const location = useLocation();

  const {
    isAuthenticated,
    user,
    restoreSession,
    authLoading,
    authError,
  } = useAuth();

  const isShared = isSharedPath(location.pathname);

  /*
   * If a userType prop is explicitly provided, use it.
   * Otherwise, determine the allowed departments from the route.
   */
  const allowedUserTypes = requestedUserType
    ? [requestedUserType]
    : getAllowedUserTypesFromPath(location.pathname);

  const primaryUserType = allowedUserTypes[0];

  const [checked, setChecked] = useState(false);
  const [checkError, setCheckError] = useState(false);

  // Prevent an older async session check from updating a newer route.
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    async function checkSession() {
      setChecked(false);
      setCheckError(false);

      const isCurrentRequest = () =>
        !cancelled && requestIdRef.current === requestId;

      /*
       * If the current authenticated user is already allowed,
       * there is no need to refresh the session.
       */
      if (
        isAuthenticated &&
        user &&
        VALID_USER_TYPES.includes(user.user_type) &&
        (isShared || allowedUserTypes.includes(user.user_type))
      ) {
        setChecked(true);
        return;
      }

      /*
       * Shared pages can be accessed by any valid department.
       */
      if (isShared) {
        try {
          for (const department of VALID_USER_TYPES) {
            if (!isCurrentRequest()) return;

            const restored = await restoreSession(department);

            if (!isCurrentRequest()) return;

            if (restored) {
              setChecked(true);
              return;
            }
          }

          setChecked(true);
        } catch (error) {
          if (!isCurrentRequest()) return;

          console.error("Shared route session check failed:", error);

          setCheckError(true);
          setChecked(true);
        }

        return;
      }

      /*
       * A protected route must have at least one valid department.
       */
      if (
        !allowedUserTypes.length ||
        !allowedUserTypes.every((type) =>
          VALID_USER_TYPES.includes(type)
        )
      ) {
        setChecked(true);
        return;
      }

      /*
       * Try restoring the session for each department allowed
       * on this route.
       *
       * For Delivery Challan:
       * 1. Try Accounts.
       * 2. If Accounts fails, try Material Planning.
       */
      try {
        for (const department of allowedUserTypes) {
          if (!isCurrentRequest()) return;

          const restored = await restoreSession(department);

          if (!isCurrentRequest()) return;

          if (restored) {
            setChecked(true);
            return;
          }
        }

        setChecked(true);
      } catch (error) {
        if (!isCurrentRequest()) return;

        console.error("Protected route session check failed:", error);

        setCheckError(true);
        setChecked(true);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };

    // Intentionally run the check when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.pathname,
    primaryUserType,
    isShared,
  ]);

  /*
   * Wait until session restoration and route checking finish.
   */
  if (authLoading || !checked) {
    return <Loading />;
  }

  /*
   * Show an error if session restoration failed unexpectedly.
   */
  if (authError || checkError) {
    return <Error />;
  }

  /*
   * Invalid protected route.
   */
  if (!isShared && !allowedUserTypes.length) {
    return <Navigate to="/production/login" replace />;
  }

  /*
   * User is not authenticated.
   */
  if (!isAuthenticated || !user) {
    const loginPath = isShared
      ? "/production/login"
      : DEPARTMENT_ROUTES[primaryUserType];

    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  /*
   * Validate the user type returned by Django.
   */
  if (!VALID_USER_TYPES.includes(user.user_type)) {
    return <Navigate to="/production/login" replace />;
  }

  /*
   * Shared pages can be accessed by any authenticated department.
   */
  if (isShared) {
    return children;
  }

  /*
   * Check whether the current department is allowed
   * to access this specific route.
   */
  if (!allowedUserTypes.includes(user.user_type)) {
    return (
      <Navigate
        to={DEPARTMENT_ROUTES[user.user_type]}
        replace
        state={{ from: location }}
      />
    );
  }

  /*
   * Access granted.
   */
  return children;
}