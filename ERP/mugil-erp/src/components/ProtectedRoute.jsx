
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
  { userType: "admin", prefixes: ["/admin"] },
  { userType: "accounts", prefixes: ["/accounts"] },
  { userType: "hr", prefixes: ["/hr"] },
  { userType: "production", prefixes: ["/production"] },
  { userType: "supervisor", prefixes: ["/supervisor"] },
];

const SHARED_PATHS = ["/welcome", "/profile"];

function getDepartmentFromPath(pathname) {
  const normalizedPath = String(pathname || "").toLowerCase();

  for (const department of DEPARTMENT_PATHS) {
    for (const prefix of department.prefixes) {
      if (
        normalizedPath === prefix ||
        normalizedPath.startsWith(`${prefix}/`)
      ) {
        return department.userType;
      }
    }
  }

  return null;
}

function isSharedPath(pathname) {
  return SHARED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
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

  const userType =
    requestedUserType ||
    getDepartmentFromPath(location.pathname);

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

      // Shared pages can accept any currently authenticated department.
      if (
        isAuthenticated &&
        user &&
        VALID_USER_TYPES.includes(user.user_type) &&
        (isShared || user.user_type === userType)
      ) {
        setChecked(true);
        return;
      }

      // A department-specific route must identify a valid department.
      if (!isShared && !VALID_USER_TYPES.includes(userType)) {
        setChecked(true);
        return;
      }

      try {
        if (isShared) {
          // Shared routes do not identify which department's cookie
          // should be refreshed. Try each department until one succeeds.
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
          return;
        }

        const restored = await restoreSession(userType);

        if (!isCurrentRequest()) return;

        if (!restored) {
          setChecked(true);
          return;
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
    // AuthContext manages its own session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, userType, isShared]);

  if (authLoading || !checked) {
    return <Loading />;
  }

  if (authError || checkError) {
    return <Error />;
  }

  if (!isShared && !VALID_USER_TYPES.includes(userType)) {
    return <Navigate to="/production/login" replace />;
  }

  // If the user is not authenticated, send them to the appropriate login.
  if (!isAuthenticated || !user) {
    const loginPath = isShared
      ? "/production/login"
      : DEPARTMENT_ROUTES[userType];

    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  // Validate the user type returned by Django.
  if (!VALID_USER_TYPES.includes(user.user_type)) {
    return <Navigate to="/production/login" replace />;
  }

  // Shared pages can be accessed by any authenticated department.
  if (isShared) {
    return children;
  }

  // Prevent access to another department's protected routes.
  if (user.user_type !== userType) {
    return (
      <Navigate
        to={DEPARTMENT_ROUTES[user.user_type]}
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}

