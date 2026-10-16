import { useEffect, useState } from "react";

import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import Loading from "../components/loading";
import Error from "../components/error";

const DEPARTMENT_ROUTES = {
  admin: "/admin/login",
  accounts: "/accounts/login",
  hr: "/hr/login",
  "material-planning": "/material-planning/login",
  production: "/production/login",
  supervisor: "/supervisor/login",
};

const DEPARTMENT_PATHS = [
  {
    userType: "material-planning",
    prefix: "/material-planning",
  },
  {
    userType: "admin",
    prefix: "/admin",
  },
  {
    userType: "accounts",
    prefix: "/accounts",
  },
  {
    userType: "hr",
    prefix: "/hr",
  },
  {
    userType: "production",
    prefix: "/production",
  },
  {
    userType: "supervisor",
    prefix: "/supervisor",
  },
];

function getDepartmentFromPath(pathname) {
  const match = DEPARTMENT_PATHS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return match?.userType || null;
}

export default function ProtectedRoute({
  children,
  userType: requestedUserType,
}) {
  const { isAuthenticated, user, restoreSession, authLoading, authError } =
    useAuth();

  const location = useLocation();

  const userType =
    requestedUserType || getDepartmentFromPath(location.pathname);

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      setChecked(false);

      if (!userType) {
        setChecked(true);
        return;
      }

      // A logged-in user must belong to this department.
      if (isAuthenticated && user?.user_type === userType) {
        setChecked(true);
        return;
      }

      const restored = await restoreSession(userType);

      if (!cancelled) {
        setChecked(true);
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [userType, isAuthenticated, user?.user_type, restoreSession]);

  if (authLoading || !checked) {
    return <Loading />;
  }

  if (authError) {
    return <Error />;
  }

  if (!userType) {
    console.error(
      "ProtectedRoute requires a valid userType prop or a department-specific URL.",
    );

    return <Navigate to="/welcome" replace />;
  }

  if (!isAuthenticated || user?.user_type !== userType) {
    return (
      <Navigate
        to={DEPARTMENT_ROUTES[userType]}
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}
