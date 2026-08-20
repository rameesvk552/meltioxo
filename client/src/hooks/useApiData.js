import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';

const asArray = (value) => (Array.isArray(value) ? value : []);

export default function useApiData(endpoint, { enabled = true, initialData = [] } = {}) {
  const initialDataRef = useRef(initialData);
  const [data, setData] = useState(initialDataRef.current);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled || !endpoint) {
      setLoading(false);
      return initialDataRef.current;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await client.get(endpoint);
      const nextData = Array.isArray(initialDataRef.current)
        ? asArray(response.data)
        : (response.data ?? initialDataRef.current);
      setData(nextData);
      return nextData;
    } catch (requestError) {
      setError(requestError);
      setData(initialDataRef.current);
      return initialDataRef.current;
    } finally {
      setLoading(false);
    }
  }, [enabled, endpoint]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}
