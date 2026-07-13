import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // required for cookies (refresh tokens)
});

// Add Authorization header to every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.headers && !config.headers['X-Request-ID']) {
    config.headers['X-Request-ID'] = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Auto-refresh token logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const isAuthRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh-token',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/logout',
    ].some((path) => requestUrl.includes(path));

    if (isAuthRequest) {
      return Promise.reject(error);
    }

    // If 401 and retry flag not set, try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Call refresh endpoint
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1"}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        
        const { accessToken } = res.data.data;
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
        }
        
        // Update auth header for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        
        // Retry original request with new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear ALL auth state, then redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('auth-storage');
          // Also clear the accessToken cookie so middleware doesn't block the login page
          try { document.cookie = 'accessToken=; Max-Age=0; path=/;'; } catch {}
          try {
            await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1"}/auth/logout`,
              {},
              { withCredentials: true }
            );
          } catch {}

          const currentPath = `${window.location.pathname}${window.location.search}`;
          const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback']
            .some((path) => window.location.pathname.startsWith(path));

          if (isAuthRoute) {
            window.location.href = '/login';
          } else {
            window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
          }
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
