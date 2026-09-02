import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { AdminAuthProvider, RestaurantAuthProvider, useAdminAuth, useRestaurantAuth } from './lib/AuthContext';
import { NAV_PAGES } from './lib/navPages';

import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Restaurants from './pages/admin/Restaurants';
import Notifications from './pages/admin/Notifications';
import Billing from './pages/admin/Billing';
import AdminSms from './pages/admin/Sms';
import AdminSettings from './pages/admin/Settings';

import RestaurantLayout from './pages/restaurant/RestaurantLayout';
import RestaurantOverview from './pages/restaurant/Overview';
import Orders from './pages/restaurant/Orders';
import Pos from './pages/restaurant/Pos';
import Payments from './pages/restaurant/Payments';
import PayMethods from './pages/restaurant/PayMethods';
import PayTransfer from './pages/restaurant/PayTransfer';
import Expenses from './pages/restaurant/Expenses';
import Reports from './pages/restaurant/Reports';
import RestaurantSms from './pages/restaurant/Sms';
import Products from './pages/restaurant/Products';
import Categories from './pages/restaurant/Categories';
import QrTab from './pages/restaurant/QrTab';
import Staff from './pages/restaurant/Staff';

import CustomerOrder from './pages/customer/CustomerOrder';

function RequireAdmin({ children }) {
  const { isAuthed } = useAdminAuth();
  return isAuthed ? children : <Navigate to="/" replace />;
}

function RequireRestaurant({ children }) {
  const { isAuthed } = useRestaurantAuth();
  return isAuthed ? children : <Navigate to="/" replace />;
}

// Lands on the first page the signed-in account is actually allowed to see —
// 'orders' for the owner, or a staff account's first granted permission.
function DashboardIndex() {
  const { me } = useOutletContext();
  if (!me) return null;
  if (me.role === 'staff') {
    const first = NAV_PAGES.find((p) => me.permissions?.includes(p.id));
    return <Navigate to={first ? first.id : 'orders'} replace />;
  }
  return <Navigate to="orders" replace />;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <RestaurantAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />

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
              <Route path="sms" element={<AdminSms />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route
              path="/dashboard"
              element={
                <RequireRestaurant>
                  <RestaurantLayout />
                </RequireRestaurant>
              }
            >
              <Route index element={<DashboardIndex />} />
              <Route path="overview" element={<RestaurantOverview />} />
              <Route path="orders" element={<Orders />} />
              <Route path="pos" element={<Pos />} />
              <Route path="payments" element={<Payments />} />
              <Route path="paymethods" element={<PayMethods />} />
              <Route path="transfers" element={<PayTransfer />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="reports" element={<Reports />} />
              <Route path="sms" element={<RestaurantSms />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="qr" element={<QrTab />} />
              <Route path="staff" element={<Staff />} />
            </Route>

            <Route path="/order/:code" element={<CustomerOrder />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RestaurantAuthProvider>
    </AdminAuthProvider>
  );
}
