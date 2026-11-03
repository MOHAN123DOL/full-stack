import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import Loading from "./loading";
import Error from "./error";

const ACTIVE_DEPARTMENT_KEY = "erp_active_department";

// ============================================================
// DEPARTMENT LOGIN ROUTES
// ============================================================

const DEPARTMENT_ROUTES = {
  admin: "/admin/login",
  accounts: "/accounts/login",
  hr: "/hr/login",
  "material-planning": "/material-planning/login",
  production: "/production/login",
  supervisor: "/supervisor/login",
};

const VALID_USER_TYPES = Object.keys(DEPARTMENT_ROUTES);

// ============================================================
// DEPARTMENT ROUTE CONFIGURATION
// ============================================================

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

// ============================================================
// SHARED ROUTES
// ============================================================

const SHARED_PATHS = ["/welcome", "/profile"];

// ============================================================
// ROUTE ACCESS OVERRIDES
// ============================================================

const ROUTE_ACCESS_OVERRIDES = {
  "/accounts/deliverychallan": [
    "accounts",
    "material-planning",
  ],
};

// ============================================================
// NORMALIZE PATH
// ============================================================

function normalizePath(pathname) {
  return (
    String(pathname || "")
      .toLowerCase()
      .replace(/\/+$/, "") || "/"
  );
}

// ============================================================
// IDENTIFY DEPARTMENT FROM ROUTE
// ============================================================

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

// ============================================================
// GET ALLOWED USER TYPES
// ============================================================

function getAllowedUserTypesFromPath(pathname) {
  const normalizedPath = normalizePath(pathname);

  if (ROUTE_ACCESS_OVERRIDES[normalizedPath]) {
    return ROUTE_ACCESS_OVERRIDES[normalizedPath];
  }

  const department = getDepartmentFromPath(normalizedPath);

  return department ? [department] : [];
}

// ============================================================
// CHECK SHARED ROUTE
// ============================================================

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

// ============================================================
// GET SAVED DEPARTMENT
// ============================================================

function getSavedDepartment() {
  const department = sessionStorage.getItem(
    ACTIVE_DEPARTMENT_KEY
  );

  return VALID_USER_TYPES.includes(department)
    ? department
    : null;
}

// ============================================================
// PROTECTED ROUTE
// ============================================================

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

  const allowedUserTypes = requestedUserType
    ? [requestedUserType]
    : getAllowedUserTypesFromPath(location.pathname);

  const primaryUserType = allowedUserTypes[0];

  const [checked, setChecked] = useState(false);
  const [checkError, setCheckError] = useState(false);

  const requestIdRef = useRef(0);

  // ============================================================
  // SESSION RESTORATION
  // ============================================================

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    let cancelled = false;

    async function checkSession() {
      setChecked(false);
      setCheckError(false);

      const isCurrentRequest = () =>
        !cancelled &&
        requestIdRef.current === requestId;

      // ========================================================
      // STEP 1: VALIDATE EXISTING SESSION
      // ========================================================

      if (
        isAuthenticated &&
        user &&
        VALID_USER_TYPES.includes(user.user_type)
      ) {
        if (
          user.user_type === "admin" ||
          isShared ||
          allowedUserTypes.includes(user.user_type)
        ) {
          setChecked(true);
          return;
        }
      }

      // ========================================================
      // STEP 2: SHARED ROUTES
      // ========================================================
      //
      // For Profile and Welcome:
      // Restore ONLY the department saved during login.
      // Never try all department cookies.
      // ========================================================

      if (isShared) {
        const savedDepartment = getSavedDepartment();

        if (!savedDepartment) {
          setChecked(true);
          return;
        }

        try {
          const restored = await restoreSession(
            savedDepartment
          );

          if (!isCurrentRequest()) return;

          if (!restored) {
            sessionStorage.removeItem(
              ACTIVE_DEPARTMENT_KEY
            );
          }

          setChecked(true);
          return;
        } catch (error) {
          if (!isCurrentRequest()) return;

          console.error(
            "Shared route session restoration failed:",
            error
          );

          setCheckError(true);
          setChecked(true);
          return;
        }
      }

      // ========================================================
      // STEP 3: VALIDATE DEPARTMENT ROUTE
      // ========================================================

      if (
        !allowedUserTypes.length ||
        !allowedUserTypes.every((type) =>
          VALID_USER_TYPES.includes(type)
        )
      ) {
        setChecked(true);
        return;
      }

      // ========================================================
      // STEP 4: RESTORE DEPARTMENT ROUTE
      // ========================================================
      //
      // IMPORTANT:
      //
      // Admin can access every department.
      //
      // When Admin refreshes any department page,
      // restore the Admin session.
      //
      // For normal department users, restore their
      // respective department session.
      // ========================================================

      try {
        const savedDepartment = getSavedDepartment();

        let departmentToRestore;

        // Admin session takes priority for every department.
        if (savedDepartment === "admin") {
          departmentToRestore = "admin";
        }

        // Otherwise, restore the saved department
        // if it is permitted on the current route.
        else if (
          savedDepartment &&
          allowedUserTypes.includes(savedDepartment)
        ) {
          departmentToRestore = savedDepartment;
        }

        // Otherwise, restore the department required
        // by the current route.
        else {
          departmentToRestore = primaryUserType;
        }

        console.log("Current route:", location.pathname);

        console.log(
          "Saved department:",
          savedDepartment
        );

        console.log(
          "Restoring session for:",
          departmentToRestore
        );

        const restored = await restoreSession(
          departmentToRestore
        );

        if (!isCurrentRequest()) return;

        if (restored) {
          setChecked(true);
          return;
        }

        setChecked(true);
      } catch (error) {
        if (!isCurrentRequest()) return;

        console.error(
          "Protected route session check failed:",
          error
        );

        setCheckError(true);
        setChecked(true);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    primaryUserType,
    isShared,
    isAuthenticated,
    user,
    restoreSession,
  ]);

  // ============================================================
  // STEP 5: LOADING
  // ============================================================

  if (authLoading || !checked) {
    return <Loading />;
  }

  // ============================================================
  // STEP 6: AUTHENTICATION ERROR
  // ============================================================

  if (authError || checkError) {
    return <Error />;
  }

  // ============================================================
  // STEP 7: INVALID PROTECTED ROUTE
  // ============================================================

  if (!isShared && !allowedUserTypes.length) {
    return (
      <Navigate
        to="/production/login"
        replace
      />
    );
  }

  // ============================================================
  // STEP 8: USER NOT AUTHENTICATED
  // ============================================================

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

  // ============================================================
  // STEP 9: VALIDATE USER TYPE
  // ============================================================

  if (!VALID_USER_TYPES.includes(user.user_type)) {
    return (
      <Navigate
        to="/production/login"
        replace
      />
    );
  }

  // ============================================================
  // STEP 10: SHARED ROUTES
  // ============================================================

  if (isShared) {
    return children;
  }

  // ============================================================
  // STEP 11: ADMIN FULL ACCESS
  // ============================================================

  if (user.user_type === "admin") {
    return children;
  }

  // ============================================================
  // STEP 12: DEPARTMENT ACCESS VALIDATION
  // ============================================================

  if (!allowedUserTypes.includes(user.user_type)) {
    return (
      <Navigate
        to={DEPARTMENT_ROUTES[user.user_type]}
        replace
        state={{ from: location }}
      />
    );
  }

  // ============================================================
  // STEP 13: ACCESS GRANTED
  // ============================================================

  return children;
}