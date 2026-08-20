import axios from 'axios';

const client = axios.create({
  // Local development keeps the API on port 5000; production routes the
  // same-origin /api requests through Nginx to the backend service.
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

let refreshPromise = null;

const clearSessionAndRedirect = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  if (window.location.pathname !== '/login') window.location.href = '/login';
};

const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return Promise.reject(new Error('No refresh token available'));

  // Use plain axios here so the refresh request cannot enter this interceptor.
  refreshPromise = axios.post(`${client.defaults.baseURL}/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      const tokens = data?.tokens;
      if (!tokens?.accessToken) throw new Error('Invalid refresh response');
      localStorage.setItem('token', tokens.accessToken);
      if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
      return tokens.accessToken;
    })
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
};

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use((response) => response, async (error) => {
  const originalRequest = error.config;
  const isUnauthorized = error.response?.status === 401;
  const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
  const isLoginRequest = originalRequest?.url?.includes('/auth/login');

  if (!isUnauthorized || !originalRequest || isLoginRequest) return Promise.reject(error);

  if (originalRequest._retry || isRefreshRequest) {
    clearSessionAndRedirect();
    return Promise.reject(error);
  }

  originalRequest._retry = true;
  try {
    const accessToken = await refreshAccessToken();
    originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` };
    return client(originalRequest);
  } catch (refreshError) {
    clearSessionAndRedirect();
    return Promise.reject(refreshError);
  }
});

export default client;
