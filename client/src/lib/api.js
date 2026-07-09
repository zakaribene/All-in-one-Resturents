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

export function apiErrorMessage(err, fallback) {
  return err?.response?.data?.error || fallback || 'Something went wrong';
}
