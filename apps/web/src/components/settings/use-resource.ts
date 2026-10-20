"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "@/lib/api/settings";

/**
 * Loads a settings resource.
 *
 * The server page passes the first value it already loaded, so the screen
 * renders with data. When there is no value the resource is loaded on the
 * client and the loading and error states are shown.
 */
export function useResource<T>(
  loader: () => Promise<ApiResult<T>>,
  initial: T | null
) {
  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState<boolean>(initial === null);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loaderRef.current();
    setLoading(false);
    if (result.ok && result.data !== null) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error ?? "The settings could not be loaded.");
    }
    return result;
  }, []);

  useEffect(() => {
    if (initial !== null) return;
    let active = true;
    (async () => {
      const result = await loaderRef.current();
      if (!active) return;
      setLoading(false);
      if (result.ok && result.data !== null) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error ?? "The settings could not be loaded.");
      }
    })();
    return () => {
      active = false;
    };
    // The initial value is only used to decide whether the client has to
    // load the resource at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, reload, setData };
}
