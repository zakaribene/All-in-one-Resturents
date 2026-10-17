import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { AdminAuthProvider, RestaurantAuthProvider, useAdminAuth, useRestaurantAuth } from './lib/AuthContext';
import { NAV_PAGES } from './lib/navPages';

// Login and the two layout shells load eagerly — everything else is route content that
// only matters once a layout is already on screen, so it's split into its own chunk and
// fetched on demand. On a slow connection this means the sidebar/header appear and are
// interactive well before, say, the Reports page's charting code has to download.
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import RestaurantLayout from './pages/restaurant/RestaurantLayout';

const Overview = lazy(() => import('./pages/admin/Overview'));
const Restaurants = lazy(() => import('./pages/admin/Restaurants'));
const Subscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const Notifications = lazy(() => import('./pages/admin/Notifications'));
const Billing = lazy(() => import('./pages/admin/Billing'));
const AdminSms = lazy(() => import('./pages/admin/Sms'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminDataManager = lazy(() => import('./pages/admin/DataManager'));
const AdminActivityLog = lazy(() => import('./pages/admin/ActivityLog'));
const AdminSupportInbox = lazy(() => import('./pages/admin/SupportInbox'));

const RestaurantOverview = lazy(() => import('./pages/restaurant/Overview'));
const Orders = lazy(() => import('./pages/restaurant/Orders'));
const Pos = lazy(() => import('./pages/restaurant/Pos'));
const Payments = lazy(() => import('./pages/restaurant/Payments'));
const PayMethods = lazy(() => import('./pages/restaurant/PayMethods'));
const PayTransfer = lazy(() => import('./pages/restaurant/PayTransfer'));
const Expenses = lazy(() => import('./pages/restaurant/Expenses'));
const Reports = lazy(() => import('./pages/restaurant/Reports'));
const RestaurantSms = lazy(() => import('./pages/restaurant/Sms'));
const Products = lazy(() => import('./pages/restaurant/Products'));
const Categories = lazy(() => import('./pages/restaurant/Categories'));
const QrTab = lazy(() => import('./pages/restaurant/QrTab'));
const Customers = lazy(() => import('./pages/restaurant/Customers'));
const Staff = lazy(() => import('./pages/restaurant/Staff'));
const RestaurantSettings = lazy(() => import('./pages/restaurant/Settings'));
const RestaurantActivityLog = lazy(() => import('./pages/restaurant/ActivityLog'));
const RestaurantSupport = lazy(() => import('./pages/restaurant/Support'));

const CustomerOrder = lazy(() => import('./pages/customer/CustomerOrder'));
const SubscriptionExpired = lazy(() => import('./pages/SubscriptionExpired'));

// Shown in place of route content while its chunk downloads — brief on a fast connection,
// but on a slow one it's what stands between a blank page and something.
function RouteLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--muted-3)', fontSize: 13, fontWeight: 600 }}>
      Loading…
    </div>
  );
}

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
          <Suspense fallback={<RouteLoading />}>
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
          </Suspense>
        </BrowserRouter>
      </RestaurantAuthProvider>
    </AdminAuthProvider>
  );
}
