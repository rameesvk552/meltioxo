import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';

const asArray = (value) => (Array.isArray(value) ? value : []);

export default function useApiData(endpoint, { enabled = true, initialData = [] } = {}) {
  const initialDataRef = useRef(initialData);
  const [data, setData] = useState(initialDataRef.current);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);
  const controllerRef = useRef(null);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    controllerRef.current?.abort();
    if (!enabled || !endpoint) {
      setLoading(false);
      return initialDataRef.current;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await client.get(endpoint, { signal: controller.signal });
      const nextData = Array.isArray(initialDataRef.current)
        ? asArray(response.data)
        : (response.data ?? initialDataRef.current);
      if (requestId === requestRef.current) setData(nextData);
      return nextData;
    } catch (requestError) {
      if (requestId === requestRef.current && !controller.signal.aborted) {
        setError(requestError);
        setData(initialDataRef.current);
      }
      return initialDataRef.current;
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [enabled, endpoint]);

  useEffect(() => {
    reload();
    return () => { requestRef.current += 1; controllerRef.current?.abort(); };
  }, [reload]);

  return { data, setData, loading, error, reload };
}
