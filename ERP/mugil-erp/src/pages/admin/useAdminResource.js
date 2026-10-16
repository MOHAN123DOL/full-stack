import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminApiError } from "./adminApi";

/**
 * Loads one Admin data source with loading / error / reload handling.
 *
 *   const { data, loading, error, reload } =
 *     useAdminResource((token) => fetchAdminProjects(token));
 *
 * - Passes the AuthContext access token to the loader (existing convention).
 * - Ignores out-of-order responses (e.g. the date changed mid-request).
 * - Pass `deps` to reload when something else changes (e.g. the date).
 */
export default function useAdminResource(loader, deps = []) {
  const { accessToken } = useAuth();

  const [state, setState] = useState({
    data: null,
    loading: true,
    error: "",
  });

  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!accessToken) return;

    const id = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const data = await loader(accessToken);
      if (id === requestId.current) {
        setState({ data, loading: false, error: "" });
      }
    } catch (err) {
      console.error("Admin data load failed:", err);
      if (id === requestId.current) {
        setState({ data: null, loading: false, error: getAdminApiError(err) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, ...deps]);

  useEffect(() => {
    load();
    return () => {
      requestId.current += 1; // invalidate any in-flight request on unmount
    };
  }, [load]);

  return { ...state, reload: load };
}
