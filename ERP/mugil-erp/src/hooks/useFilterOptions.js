import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

/**
 * Fetch dropdown options for a given page.
 *
 *   const { options, refresh } = useFilterOptions("material-receive");
 *   options.thickness   // ["6", "8", "10"]
 *   options.project     // [...]
 *
 * Response keys are surfaced as-is. Missing keys become {}.
 */
export default function useFilterOptions(source, { enabled = true } = {}) {
  const { accessToken } = useAuth();
  const [options, setOptions] = useState({});

  const refresh = useCallback(async () => {
    if (!enabled || !accessToken || !source) return;

    try {
      const res = await api.get(
        `/erp/filter-options/?source=${encodeURIComponent(source)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const data = res.data?.data;
      setOptions(data && typeof data === "object" ? data : {});
    } catch (err) {
      console.error(`Failed to load filter options for "${source}":`, err);
      setOptions({});
    }
  }, [source, accessToken, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { options, refresh };
}