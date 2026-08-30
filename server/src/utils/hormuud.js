const { fetch } = require('undici');

const SEND_URL = 'https://smsapi.hormuud.com/api/sms/Send';

const RESPONSE_MESSAGES = {
  '200': { so: 'Guulaystay', en: 'Success' },
  '201': { so: 'Xaqiijinta credentials-ka way fashilantay', en: 'Authentication failed' },
  '203': { so: 'Sender ID sax ah lama gelin', en: 'Invalid sender ID' },
  '204': { so: 'Koontadu waa 0 (Zero balance)', en: 'Zero balance' },
  '205': { so: 'Koontadu kuma filna (Insufficient balance)', en: 'Insufficient balance' },
  '206': { so: 'Fariintu way dheer tahay (message parts exceeded)', en: 'Allowed message parts exceeded' },
  '207': { so: 'Lambarka telefoonka sax ma aha', en: 'Wrong mobile number' },
  '500': { so: 'Khalad aan la garanayn', en: 'Unknown error' },
};

function describeCode(code) {
  const key = String(code || '');
  return RESPONSE_MESSAGES[key] || { so: 'Khalad aan la garanayn', en: 'Unknown error' };
}

async function sendSms({ username, password, mobile, message, senderid, refid, validity }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        refid: refid != null ? String(refid) : '0',
        mobile: String(mobile),
        message: String(message),
        senderid: senderid || '',
        validity: validity ?? 0,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[hormuud] ${SEND_URL} returned non-JSON response:`, text.slice(0, 500));
      return { ok: false, timeout: false, networkError: true, code: null, description: describeCode(null), raw: null };
    }
    const code = String(data.ResponseCode || '');
    const ok = code === '200';
    return {
      ok,
      timeout: false,
      networkError: false,
      code,
      description: describeCode(code),
      messageId: data.Data?.MessageID || null,
      raw: data,
    };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, timeout: true, networkError: false, code: null, description: describeCode(null), raw: null };
    console.error(`[hormuud] request to ${SEND_URL} failed:`, err.cause || err);
    return { ok: false, timeout: false, networkError: true, code: null, description: describeCode(null), raw: null, error: err };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendSms, describeCode };
