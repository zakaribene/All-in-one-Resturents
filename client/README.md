# Miis · Restaurant OS — Client

React (Vite) frontend for the Miis multi-restaurant platform. Three portals:

- `/admin/*` — Super Admin console
- `/login` + `/dashboard/*` — Restaurant dashboard
- `/order/:code` — Customer QR-scan ordering page (public, no login)

## Development

```bash
npm install
npm run dev
```

The dev server proxies `/api`, `/uploads`, and `/socket.io` to `http://localhost:4000` (see `vite.config.js`), so run the `server` alongside it. See the root `SETUP.md` for full instructions.
