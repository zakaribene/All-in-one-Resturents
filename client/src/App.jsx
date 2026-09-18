import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { AdminAuthProvider, RestaurantAuthProvider, useAdminAuth, useRestaurantAuth } from './lib/AuthContext';
import { NAV_PAGES } from './lib/navPages';

import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Restaurants from './pages/admin/Restaurants';
import Subscriptions from './pages/admin/Subscriptions';
import Notifications from './pages/admin/Notifications';
import Billing from './pages/admin/Billing';
import AdminSms from './pages/admin/Sms';
import AdminSettings from './pages/admin/Settings';
import AdminDataManager from './pages/admin/DataManager';
import AdminActivityLog from './pages/admin/ActivityLog';
import AdminSupportInbox from './pages/admin/SupportInbox';

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
import Customers from './pages/restaurant/Customers';
import Staff from './pages/restaurant/Staff';
import RestaurantSettings from './pages/restaurant/Settings';
import RestaurantActivityLog from './pages/restaurant/ActivityLog';
import RestaurantSupport from './pages/restaurant/Support';

import CustomerOrder from './pages/customer/CustomerOrder';
import SubscriptionExpired from './pages/SubscriptionExpired';

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
  const featureAllowed = (id) => (id === 'payments' ? !!me.paymentsEnabled : id === 'sms' ? !!me.smsEnabled : id === 'support' ? !!me.supportEnabled : id === 'qr' ? me.orderingEnabled !== false : true);
  if (me.role === 'staff') {
    const first = NAV_PAGES.find((p) => me.permissions?.includes(p.id) && featureAllowed(p.id));
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
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="billing" element={<Billing />} />
              <Route path="activity-log" element={<AdminActivityLog />} />
              <Route path="support-inbox" element={<AdminSupportInbox />} />
              <Route path="sms" element={<AdminSms />} />
              <Route path="data" element={<AdminDataManager />} />
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
              <Route path="customers" element={<Customers />} />
              <Route path="activity" element={<RestaurantActivityLog />} />
              <Route path="support" element={<RestaurantSupport />} />
              <Route path="staff" element={<Staff />} />
              <Route path="settings" element={<RestaurantSettings />} />
            </Route>

            <Route path="/order/:code" element={<CustomerOrder />} />
            <Route path="/subscription-expired" element={<SubscriptionExpired />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RestaurantAuthProvider>
    </AdminAuthProvider>
  );
}
