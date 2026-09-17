const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Shared by restaurant.js (product/logo images, support attachments) and admin.js
// (support-reply attachments) — one uploads/ dir, one naming scheme. `req.auth.id` is
// whichever actor is authenticated (a restaurant/staff session normalizes to the
// restaurant id; an admin session is the admin's own id) — just a readable prefix, not
// relied on for uniqueness, hence the random suffix.
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const prefix = req.auth?.id || 'anon';
    cb(null, `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload, uploadsDir };
