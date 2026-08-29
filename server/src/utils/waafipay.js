const crypto = require('crypto');
const tls = require('tls');
const { Agent, fetch } = require('undici');

// Node's fetch (undici) doesn't read the Windows certificate store the way
// Postman/browsers do. On machines where an antivirus or corporate proxy does
// TLS inspection with a root cert that's only trusted at the OS level, plain
// `fetch` fails with SELF_SIGNED_CERT_IN_CHAIN even though the endpoint is fine.
// We merge Node's default trusted roots with the Windows trust store once,
// lazily, and reuse a dedicated Agent for WaafiPay calls only.
let winAgentPromise = null;
function getDispatcher() {
  if (process.platform !== 'win32') return undefined;
  if (!winAgentPromise) {
    winAgentPromise = new Promise((resolve) => {
      const certs = [];
      try {
        const winca = require('win-ca');
        winca({ format: winca.der2.pem, ondata: (c) => certs.push(c), onend: () => resolve(certs) });
      } catch {
        resolve(certs);
      }
    }).then((certs) => new Agent({ connect: { ca: [...tls.rootCertificates, ...certs] } }));
  }
  return winAgentPromise;
}

function normalizePhoneForWaafiPay(phone) {
  let digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('252')) digits = '252' + digits;
  return digits;
}

function buildAsmUrl(baseUrl) {
  const trimmed = String(baseUrl).trim().replace(/\/+$/, '');
  return trimmed.endsWith('/asm') ? trimmed : `${trimmed}/asm`;
}

async function postToWaafiPay(baseUrl, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const url = buildAsmUrl(baseUrl);
  try {
    const dispatcher = await getDispatcher();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[waafipay] ${url} responded ${res.status}:`, text.slice(0, 500));
      return { data: null, timeout: false, networkError: true };
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[waafipay] ${url} returned non-JSON response:`, text.slice(0, 500));
      return { data: null, timeout: false, networkError: true };
    }
    return { data, timeout: false, networkError: false };
  } catch (err) {
    if (err.name === 'AbortError') return { data: null, timeout: true, networkError: false };
    console.error(`[waafipay] request to ${url} failed:`, err.cause || err);
    return { data: null, timeout: false, networkError: true, error: err };
  } finally {
    clearTimeout(timer);
  }
}

async function chargePurchase(account, { referenceId, invoiceId, amount, phone, description }) {
  const body = {
    schemaVersion: '1.0',
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid: account.merchantUid,
      apiUserId: account.apiUserId,
      apiKey: account.apiKey,
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo: { accountNo: normalizePhoneForWaafiPay(phone) },
      transactionInfo: {
        referenceId: String(referenceId),
        invoiceId: String(invoiceId),
        amount: Number(amount).toFixed(2),
        currency: account.currency || 'USD',
        description: description || '',
      },
    },
  };

  const { data, timeout, networkError } = await postToWaafiPay(account.baseUrl, body);
  if (timeout) return { ok: false, state: null, timeout: true, networkError: false, raw: null };
  if (networkError || !data) return { ok: false, state: null, timeout: false, networkError: true, raw: null };

  const approved = data.responseCode === '2001' && data.params?.state === 'APPROVED';
  return {
    ok: approved,
    state: data.params?.state || null,
    timeout: false,
    networkError: false,
    transactionId: data.params?.transactionId || null,
    issuerTransactionId: data.params?.issuerTransactionId || null,
    raw: data,
  };
}

async function reversePurchase(account, { transactionId, description }) {
  const body = {
    schemaVersion: '1.0',
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_REVERSAL',
    serviceParams: {
      merchantUid: account.merchantUid,
      apiUserId: account.apiUserId,
      apiKey: account.apiKey,
      transactionId: String(transactionId),
      description: description || 'Cancelled',
    },
  };
  const { data, timeout, networkError } = await postToWaafiPay(account.baseUrl, body);
  if (timeout) return { ok: false, timeout: true, networkError: false, raw: null };
  if (networkError || !data) return { ok: false, timeout: false, networkError: true, raw: null };
  const approved = data.responseCode === '2001' && String(data.params?.state || '').toLowerCase() === 'approved';
  return { ok: approved, timeout: false, networkError: false, raw: data };
}

module.exports = { chargePurchase, reversePurchase, normalizePhoneForWaafiPay };
