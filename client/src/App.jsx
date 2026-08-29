import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, RestaurantAuthProvider, useAdminAuth, useRestaurantAuth } from './lib/AuthContext';

import Landing from './pages/Landing';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Restaurants from './pages/admin/Restaurants';
import Notifications from './pages/admin/Notifications';
import Billing from './pages/admin/Billing';
import AdminSettings from './pages/admin/Settings';

import RestaurantLogin from './pages/restaurant/RestaurantLogin';
import RestaurantLayout from './pages/restaurant/RestaurantLayout';
import RestaurantOverview from './pages/restaurant/Overview';
import Orders from './pages/restaurant/Orders';
import Payments from './pages/restaurant/Payments';
import Products from './pages/restaurant/Products';
import Categories from './pages/restaurant/Categories';
import QrTab from './pages/restaurant/QrTab';

import CustomerOrder from './pages/customer/CustomerOrder';

function RequireAdmin({ children }) {
  const { isAuthed } = useAdminAuth();
  return isAuthed ? children : <Navigate to="/admin/login" replace />;
}

function RequireRestaurant({ children }) {
  const { isAuthed } = useRestaurantAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <RestaurantAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="restaurants" element={<Restaurants />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/login" element={<RestaurantLogin />} />
            <Route
              path="/dashboard"
              element={
                <RequireRestaurant>
                  <RestaurantLayout />
                </RequireRestaurant>
              }
            >
              <Route index element={<Navigate to="orders" replace />} />
              <Route path="overview" element={<RestaurantOverview />} />
              <Route path="orders" element={<Orders />} />
              <Route path="payments" element={<Payments />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="qr" element={<QrTab />} />
            </Route>

            <Route path="/order/:code" element={<CustomerOrder />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RestaurantAuthProvider>
    </AdminAuthProvider>
  );
}
