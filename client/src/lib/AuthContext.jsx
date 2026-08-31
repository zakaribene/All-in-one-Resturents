import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, setAuthToken, getAuthToken, apiErrorMessage } from './api';

const AdminAuthContext = createContext(null);
const RestaurantAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken('admin'));

  const login = useCallback(async (username, password) => {
    try {
      const { data } = await api.post('/auth/admin/login', { username, password });
      setAuthToken('admin', data.token);
      setToken(data.token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err, 'Login failed') };
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken('admin', null);
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, isAuthed: !!token, login, logout }), [token, login, logout]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

export function RestaurantAuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken('restaurant'));
  const [restaurant, setRestaurant] = useState(null);

  const login = useCallback(async (username, password) => {
    try {
      const { data } = await api.post('/auth/restaurant/login', { username, password });
      setAuthToken('restaurant', data.token);
      setToken(data.token);
      setRestaurant(data.restaurant);
      return { ok: true };
    } catch (err) {
      // Not an owner account — try it as a staff login before giving up.
      try {
        const { data } = await api.post('/auth/staff/login', { username, password });
        setAuthToken('restaurant', data.token);
        setToken(data.token);
        setRestaurant(data.restaurant);
        return { ok: true };
      } catch (staffErr) {
        return { ok: false, error: apiErrorMessage(staffErr, apiErrorMessage(err, 'Login failed')) };
      }
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken('restaurant', null);
    setToken(null);
    setRestaurant(null);
  }, []);

  const value = useMemo(
    () => ({ token, isAuthed: !!token, restaurant, setRestaurant, login, logout }),
    [token, restaurant, login, logout]
  );
  return <RestaurantAuthContext.Provider value={value}>{children}</RestaurantAuthContext.Provider>;
}

export function useRestaurantAuth() {
  return useContext(RestaurantAuthContext);
}
