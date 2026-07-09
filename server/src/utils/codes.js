const { customAlphabet } = require('nanoid');

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

function makeTableCode() {
  return nano();
}

function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

module.exports = { makeTableCode, slugify };
