const { fetch } = require('undici');
const { getWinCaDispatcher } = require('./winCaDispatcher');

const SEND_URL = 'https://smsapi.hormuud.com/api/sms/Send';

// Codes per Hormuud's official SMS API documentation (RESPOND CODES table).
const RESPONSE_MESSAGES = {
  '200': { so: 'Guulaystay', en: 'Success' },
  '201': { so: 'Xaqiijinta credentials-ka way fashilantay', en: 'Authentication Failed' },
  '203': { so: 'Sender ID sax ah lama gelin', en: 'Invalid Sender ID' },
  '204': { so: 'Koontadu waa 0 (Zero Balance - Prepaid Account)', en: 'Zero Balance (Prepaid Account)' },
  '205': { so: 'Koontadu kuma filna (Insufficient Balance - Prepaid Account)', en: 'Insufficient Balance (Prepaid Account)' },
  '206': { so: 'Fariintu way dheer tahay (allowed message parts exceeded)', en: 'The allowed message parts are exceeded' },
  '207': { so: 'Lambarka telefoonka sax ma aha', en: 'Wrong mobile number' },
  '500': { so: 'Khalad aan la garanayn', en: 'Unknown Error' },
};

function describeCode(code, data) {
  const key = String(code || '');
  if (RESPONSE_MESSAGES[key]) return RESPONSE_MESSAGES[key];
  const apiMessage = data && (data.ResponseMessage || data.Message || data.Description || data.responseMessage);
  if (apiMessage) return { so: String(apiMessage), en: String(apiMessage) };
  return { so: `Khalad aan la garanayn (code: ${key || 'madhan'})`, en: `Unknown error (code: ${key || 'none'})` };
}

async function sendSms({ username, password, mobile, message, senderid, refid, validity }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const dispatcher = await getWinCaDispatcher();
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
      ...(dispatcher ? { dispatcher } : {}),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[hormuud] ${SEND_URL} returned non-JSON response (HTTP ${res.status}):`, text.slice(0, 500));
      return {
        ok: false, timeout: false, networkError: true, code: null,
        description: { so: 'Jawaabta Hormuud ma ahayn JSON sax ah', en: 'Hormuud returned an invalid (non-JSON) response' },
        raw: null,
      };
    }
    const code = String(data.ResponseCode ?? '');
    const ok = code === '200';
    if (!ok) {
      console.error(`[hormuud] send failed — HTTP ${res.status}, ResponseCode=${code || 'missing'}, body:`, JSON.stringify(data).slice(0, 500));
    }
    return {
      ok,
      timeout: false,
      networkError: false,
      code,
      description: describeCode(code, data),
      messageId: data.Data?.MessageID || null,
      raw: data,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false, timeout: true, networkError: false, code: null,
        description: { so: 'Waqtiga codsiga ayaa dhammaaday', en: 'Request timed out' },
        raw: null,
      };
    }
    console.error(`[hormuud] request to ${SEND_URL} failed:`, err.cause || err);
    const detail = err.cause?.code || err.cause?.message || err.code || err.message || 'unknown';
    return {
      ok: false, timeout: false, networkError: true, code: null,
      description: { so: `Xiriirka Hormuud waa fashilmay (${detail})`, en: `Failed to connect to Hormuud (${detail})` },
      raw: null, error: err,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendSms, describeCode };
