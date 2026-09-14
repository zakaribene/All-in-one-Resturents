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
      // A 401 just means this username isn't an owner account — worth trying it as
      // staff. A 402/403 (subscription expired, account suspended) is a definitive
      // answer about a real account and must be shown as-is, not masked by whatever
      // generic "no such staff" error the fallback attempt below would produce.
      if (err?.response?.status !== 401) {
        return { ok: false, error: apiErrorMessage(err, 'Login failed') };
      }
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

  // Used by the super admin's "Login as store" action: adopts a token issued by
  // POST /admin/restaurants/:id/login-as without going through a password login.
  const loginWithToken = useCallback((newToken, restaurantData) => {
    setAuthToken('restaurant', newToken);
    setToken(newToken);
    setRestaurant(restaurantData);
  }, []);

  const value = useMemo(
    () => ({ token, isAuthed: !!token, restaurant, setRestaurant, login, logout, loginWithToken }),
    [token, restaurant, login, logout, loginWithToken]
  );
  return <RestaurantAuthContext.Provider value={value}>{children}</RestaurantAuthContext.Provider>;
}

export function useRestaurantAuth() {
  return useContext(RestaurantAuthContext);
}
