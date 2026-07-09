# Miis · Restaurant OS — Setup

MERN implementation of the `project/Miis Platform.dc.html` design (see `chats/chat1.md` for the original
design conversation). Two apps: `server/` (Express + Mongoose + Socket.io, MongoDB Atlas) and `client/`
(React + Vite).

## 1. Fix MongoDB Atlas network access (required first)

The server could not connect to your Atlas cluster from the build environment:

```
Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that
you're trying to access the database from an IP that isn't whitelisted.
```

In Atlas → **Network Access**, add `0.0.0.0/0` (allow from anywhere) or the specific IP of
wherever you'll run the server. This is required before anything below will work.

`server/.env` already points at your cluster, but uses its own database name (`miis_platform`)
instead of `finance_management_saas` from the string you gave me — that name looked like it
belonged to a different project on the same cluster, so I isolated this app's data from it.

## 2. Install & seed

```bash
cd server && npm install
npm run seed     # wipes and recreates demo data
npm run dev       # http://localhost:4000
```

```bash
cd client && npm install
npm run dev       # http://localhost:5173
```

## 3. Demo logins (from the seed script)

- **Admin:** `admin` / `admin123`
- **Restaurant** (6 seeded venues, one has full demo orders): `beder` / `restaurant123`
  (others: `xamargrill`, `bluenile`, `salsabil` [suspended], `newtaste`, `marina`, same password)

Open `http://localhost:5173/`, pick a portal, or go to `/dashboard/qr` after logging in as a
restaurant to get a real, scannable QR code per table (and a special Online / Takeaway code) —
scanning it (or opening the printed URL) lands on `/order/:code`, the public customer menu.

## What's implemented

- **Admin:** overview stats/chart/activity, restaurants list (add/suspend/activate/view),
  notification broadcast (all or one restaurant) with live preview, billing page (plans +
  EVC Plus/ZAAD/eDahab shown as "not connected" — intentionally UI-only, per your request).
- **Restaurant:** login, live orders kanban (New/Preparing/Done) with sound toggle + test-order
  button, products + categories, sales (aggregate + per-order table showing the customer's phone
  number), QR tab (per-table QR, add table, Online/Takeaway QR, download PNG/print).
- **Customer:** QR scan → menu → cart → **required phone number** → order placed. This closes out
  the one part of the original design chat that was logic-complete but never got its UI built
  (the phone requirement + printable receipt).
- **Printable receipt:** a "View" button on any order (Orders board or Sales table) opens a
  receipt with the restaurant's logo, itemized order, and a Print button — the piece the design
  session ran out of time to finish.
- **Real-time:** Socket.io pushes new orders to the right restaurant's dashboard instantly (with
  the beep + toast from the original design) and delivers admin broadcast notifications live.

## Verification note

Because this environment can't reach your Atlas cluster (see step 1), I verified every flow
above by running the real client against a temporary in-memory mock of the same API — admin
login/overview/restaurants/notifications, restaurant login/orders/sales/receipt/QR, and the full
customer QR → order → live push → toast path all confirmed working via screenshots. The
Mongoose/Atlas-specific path (actual persistence) is untested end-to-end and should be smoke
tested once you've whitelisted network access.
