import { LayoutDashboard, ClipboardList, ShoppingCart, CreditCard, Wallet, ArrowLeftRight, Receipt, BarChart3, MessageSquare, UtensilsCrossed, FolderOpen, QrCode, Users } from 'lucide-react';

// Pages a staff account can be granted access to. Keep ids in sync with
// server/src/models/Staff.js PAGE_IDS and the route paths under /dashboard/*.
export const NAV_PAGES = [
  { id: 'overview', so: 'Guudmar', en: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', so: 'Dalabyada', en: 'Orders', icon: ClipboardList },
  { id: 'pos', so: 'Dalab macmiil', en: 'POS', icon: ShoppingCart },
  { id: 'payments', so: 'Lacag-bixinada', en: 'Payments', icon: CreditCard },
  { id: 'paymethods', so: 'Xisaabaadka', en: 'Payment Methods', icon: Wallet },
  { id: 'transfers', so: 'Wareejin', en: 'Transfer Payment', icon: ArrowLeftRight },
  { id: 'expenses', so: 'Kharashaadka', en: 'Expenses', icon: Receipt },
  { id: 'reports', so: 'Warbixinno', en: 'Reports', icon: BarChart3 },
  { id: 'sms', so: 'SMS', en: 'SMS', icon: MessageSquare },
  { id: 'products', so: 'Cuntooyinka', en: 'Products', icon: UtensilsCrossed },
  { id: 'categories', so: 'Qaybaha', en: 'Categories', icon: FolderOpen },
  { id: 'qr', so: 'QR Codes', en: 'QR Codes', icon: QrCode },
];

// Owner-only page — never assignable as a staff permission.
export const STAFF_PAGE = { id: 'staff', so: 'Shaqaalaha', en: 'Staff', icon: Users };
