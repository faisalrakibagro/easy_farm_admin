import axios from 'axios';

// Build-time fallback — overridden at runtime by public/config.js → window.__FARM_CONFIG__.apiUrl
const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: BUILD_TIME_API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true,
  // Workaround for a hosting-environment bug: the LiteSpeed/LSAPI proxy on
  // api.easyfarm.live prepends a stray '<' byte to every response body and
  // rewrites Content-Type to text/html, so axios's default JSON transform
  // can't parse the body. Strip anything before the first '{'/'[' first.
  transformResponse: [(data) => {
    if (typeof data === 'string') {
      const start = data.search(/[{[]/);
      if (start > 0) {
        data = data.slice(start);
      }
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }],
});

api.interceptors.request.use((config) => {
  // Remove default Content-Type for FormData so the browser/axios sets
  // multipart/form-data with the correct boundary automatically
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  if (typeof window !== 'undefined') {
    // Runtime config (public/config.js) takes priority over build-time env var.
    // This allows changing the API URL on the server without rebuilding.
    const runtimeUrl = (window as unknown as { __FARM_CONFIG__?: { apiUrl?: string } }).__FARM_CONFIG__?.apiUrl;
    if (runtimeUrl) {
      config.baseURL = runtimeUrl;
    }
    const locale = localStorage.getItem('farmLang') ?? 'en';
    // Only set if not already specified per-request (allows explicit locale override)
    if (!config.headers['X-Locale']) {
      config.headers['X-Locale'] = locale;
    }
    // Fallback auth: some hosting environments strip the Set-Cookie header on the way
    // out, so the HttpOnly auth_token cookie never reaches the browser even though
    // login succeeds. The login response also returns a plain-text token — send it as
    // a Bearer header so auth still works when the cookie never got set.
    const token = localStorage.getItem('auth_token');
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // /auth/me 401 is handled by AuthContext itself — skip redirect for it
    // to avoid a full-page-reload loop on initial load.
    const isAuthMe = err.config?.url?.includes('/auth/me');
    if (
      err.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/login') &&
      !isAuthMe
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
