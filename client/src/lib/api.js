import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

export function setAuthToken(role, token) {
  const key = role === 'admin' ? 'miis_admin_token' : 'miis_restaurant_token';
  if (token) localStorage.setItem(key, token);
  else localStorage.removeItem(key);
}

export function getAuthToken(role) {
  const key = role === 'admin' ? 'miis_admin_token' : 'miis_restaurant_token';
  return localStorage.getItem(key);
}

api.interceptors.request.use((config) => {
  const isAdmin = config.url?.startsWith('/admin');
  const token = getAuthToken(isAdmin ? 'admin' : 'restaurant');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 402 from any dashboard call means the subscription (or its grace period) just ran
// out — mid-session, with no page refresh involved. Bounce straight to the "please pay"
// screen; login calls (`/auth/...`) are excluded so the login form shows the same error inline instead.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err?.config?.url || '';
    if (err?.response?.status === 402 && url.startsWith('/restaurant') && window.location.pathname !== '/subscription-expired') {
      try { sessionStorage.setItem('miis_subscription_expired_message', err.response.data?.error || ''); } catch { /* ignore */ }
      setAuthToken('restaurant', null);
      window.location.href = '/subscription-expired';
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err, fallback) {
  return err?.response?.data?.error || fallback || 'Something went wrong';
}
