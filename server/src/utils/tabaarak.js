const { fetch } = require('undici');
const { getWinCaDispatcher } = require('./winCaDispatcher');

// Tabaarak SMS Gateway — https://sms.tabaarak.com
// Unlike Hormuud (Basic auth per request), Tabaarak needs a login call that
// returns a Bearer token, which is then sent on Send / Balance requests.
const DEFAULT_BASE_URL = 'https://sms.tabaarak.com';

function baseOf(url) {
  return String(url || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

// Tabaarak expects the bare local mobile form, e.g. "615093067" (see API docs:
// "mobile": ["61xxxxxxx"]). Customers often type "0615093067", "+252 61 509 3067"
// or "252615093067" — strip country code / leading zeros so delivery works.
function normalizeMobile(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  d = d.replace(/^0+/, '');            // 0615..., 00252... -> 615... / 252...
  if (d.startsWith('252')) d = d.slice(3);
  d = d.replace(/^0+/, '');            // 252061... -> 61...
  return d;
}

// In-memory token cache. Tabaarak's docs don't publish a token TTL, so we keep
// each token for 45 min and also re-login automatically on a 401.
const tokenCache = new Map(); // key -> { token, expiresAt }
const TOKEN_TTL_MS = 45 * 60 * 1000;

function cacheKey(base, username) {
  return `${base}::${username}`;
}

async function doFetch(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const dispatcher = await getWinCaDispatcher();
    // Send the same everyday headers a normal HTTP client (Postman/browser) sends,
    // so Tabaarak's gateway treats our request identically.
    const headers = {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'MiisRestaurantOS/1.0',
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers, signal: controller.signal, ...(dispatcher ? { dispatcher } : {}) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    return { res, data, text };
  } finally {
    clearTimeout(timer);
  }
}

function errDesc(so, en) {
  return { so, en };
}

async function login({ baseUrl, username, password }) {
  const base = baseOf(baseUrl);
  try {
    const { res, data, text } = await doFetch(`${base}/Auth/SMSLogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Name: username, Password: password }),
    });
    const token = data?.data?.token;
    if (!res.ok || !data?.success || !token) {
      const msg = data?.message || text?.slice(0, 200) || `HTTP ${res.status}`;
      console.error(`[tabaarak] login failed — HTTP ${res.status}:`, msg);
      return { ok: false, description: errDesc('Gelitaanka Tabaarak wuu fashilmay', `Tabaarak login failed: ${msg}`) };
    }
    tokenCache.set(cacheKey(base, username), { token, expiresAt: Date.now() + TOKEN_TTL_MS });
    return { ok: true, token, account: data.data };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, description: errDesc('Waqtiga gelitaanka ayaa dhammaaday', 'Login request timed out') };
    }
    const detail = err.cause?.code || err.cause?.message || err.code || err.message || 'unknown';
    console.error('[tabaarak] login request failed:', err.cause || err);
    return { ok: false, description: errDesc(`Xiriirka Tabaarak wuu fashilmay (${detail})`, `Failed to connect to Tabaarak (${detail})`) };
  }
}

async function getToken({ baseUrl, username, password }, { forceRefresh = false } = {}) {
  const base = baseOf(baseUrl);
  const key = cacheKey(base, username);
  const cached = tokenCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return { ok: true, token: cached.token };
  const r = await login({ baseUrl: base, username, password });
  return r.ok ? { ok: true, token: r.token } : r;
}

// Sends one or more SMS in a single Tabaarak request.
// `mobiles` is an array of phone strings.
async function sendSms({ baseUrl, username, password, message, mobiles }) {
  const base = baseOf(baseUrl);
  const list = [...new Set(
    (Array.isArray(mobiles) ? mobiles : [mobiles]).map(normalizeMobile).filter((d) => d.length >= 7),
  )];
  if (!list.length) return { ok: false, description: errDesc('Lambaro sax ah lama helin', 'No valid recipients') };
  console.log(`[tabaarak] send -> ${base}/Sms/sendsms | mobile=${JSON.stringify(list)} | msg="${String(message).slice(0, 60)}"`);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tok = await getToken({ baseUrl: base, username, password }, { forceRefresh: attempt === 1 });
    if (!tok.ok) return { ok: false, description: tok.description };
    try {
      const { res, data, text } = await doFetch(`${base}/Sms/sendsms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok.token}` },
        body: JSON.stringify({ smsMessage: message, mobile: list }),
      }, 30000);

      if (res.status === 401 && attempt === 0) { tokenCache.delete(cacheKey(base, username)); continue; }

      if (!res.ok || !data?.success) {
        const msg = data?.message || text?.slice(0, 200) || `HTTP ${res.status}`;
        console.error(`[tabaarak] send failed — HTTP ${res.status}:`, msg);
        return { ok: false, description: errDesc(`Diritaanka wuu fashilmay: ${msg}`, `Send failed: ${msg}`), raw: data };
      }
      console.log(`[tabaarak] send response:`, JSON.stringify(data));
      return {
        ok: true,
        acceptedForDelivery: data.data?.acceptedForDelivery ?? true,
        totalNumber: data.data?.totalNumber ?? list.length,
        description: errDesc(data.message || 'La diray', data.message || 'Sent'),
        raw: data,
      };
    } catch (err) {
      if (err.name === 'AbortError') return { ok: false, description: errDesc('Waqtiga diritaanka ayaa dhammaaday', 'Send request timed out') };
      const detail = err.cause?.code || err.cause?.message || err.code || err.message || 'unknown';
      console.error('[tabaarak] send request failed:', err.cause || err);
      return { ok: false, description: errDesc(`Xiriirka Tabaarak wuu fashilmay (${detail})`, `Failed to connect to Tabaarak (${detail})`) };
    }
  }
  return { ok: false, description: errDesc('Diritaanka wuu fashilmay', 'Send failed after re-login') };
}

async function getBalance({ baseUrl, username, password }) {
  const base = baseOf(baseUrl);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tok = await getToken({ baseUrl: base, username, password }, { forceRefresh: attempt === 1 });
    if (!tok.ok) return { ok: false, description: tok.description };
    try {
      const { res, data, text } = await doFetch(`${base}/sms/GetSmsBalance`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${tok.token}` },
      });
      if (res.status === 401 && attempt === 0) { tokenCache.delete(cacheKey(base, username)); continue; }
      if (!res.ok || !data?.success) {
        const msg = data?.message || text?.slice(0, 200) || `HTTP ${res.status}`;
        return { ok: false, description: errDesc(`Hubinta haraaga wuu fashilmay: ${msg}`, `Balance check failed: ${msg}`) };
      }
      return {
        ok: true,
        balance: data.data?.balance ?? null,
        accountType: data.data?.accountType || null,
        description: errDesc(data.message || '', data.message || ''),
      };
    } catch (err) {
      if (err.name === 'AbortError') return { ok: false, description: errDesc('Waqtiga hubinta ayaa dhammaaday', 'Balance request timed out') };
      const detail = err.cause?.code || err.cause?.message || err.code || err.message || 'unknown';
      console.error('[tabaarak] balance request failed:', err.cause || err);
      return { ok: false, description: errDesc(`Xiriirka Tabaarak wuu fashilmay (${detail})`, `Failed to connect to Tabaarak (${detail})`) };
    }
  }
  return { ok: false, description: errDesc('Hubinta haraaga wuu fashilmay', 'Balance check failed after re-login') };
}

module.exports = { login, sendSms, getBalance, DEFAULT_BASE_URL };
