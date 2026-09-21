import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import Loading from "../components/loading";
import Error from "../components/error";

export default function ProtectedRoute({ children }) {
  const {
    isAuthenticated,
    restoreSession,
    authLoading,
    authError,
  } = useAuth();

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      if (!isAuthenticated) {
        await restoreSession();
      }

      setChecked(true);
    };

    checkSession();
  }, []);

  if (authLoading || !checked) {
    return <Loading />;
  }

  if (authError) {
    return <Error />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/production/login"
        replace
      />
    );
  }

  return children;
}