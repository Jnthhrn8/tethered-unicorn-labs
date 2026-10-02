const TOPICS = new Set(['general', 'field-testing', 'investor', 'sponsor', 'affiliate', 'technical', 'press']);
const MESSAGE_PREFIX = 'message:';
const FIELD_REQUEST_PREFIX = 'field-request:';

function allowedOrigins(env) {
  return new Set([
    env.ALLOWED_ORIGIN,
    env.FIELD_CONSOLE_ORIGIN,
    'https://www.tetheredunicorn.com',
  ].filter(Boolean));
}

function cors(origin, env) {
  const allowed = allowedOrigins(env).has(origin);
  return { 'Access-Control-Allow-Origin': allowed ? origin : env.ALLOWED_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

function clean(value, maxLength) {
  return String(value || '').trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, maxLength);
}

function authorized(request, env) {
  return Boolean(env.FORGE_INBOX_TOKEN) && (request.headers.get('Authorization') || '') === `Bearer ${env.FORGE_INBOX_TOKEN}`;
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function acceptContact(request, env, headers) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, headers); }
  if (data.website) return json({ delivered: true, reference: 'accepted' }, 200, headers);
  const name = clean(data.name, 100);
  const email = clean(data.email, 254).toLowerCase();
  const phone = clean(data.phone, 40);
  const topic = clean(data.topic, 40);
  const message = clean(data.message, 5000);
  if (!name || !message || !data.consent || !TOPICS.has(topic) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please complete every required field correctly.' }, 400, headers);
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window = Math.floor(Date.now() / 3_600_000);
  const rateKey = `rate:${await digest(`${address}:${window}`)}`;
  const rate = Number(await env.CONTACT_QUEUE.get(rateKey) || 0);
  if (rate >= 5) return json({ error: 'Too many messages were sent from this connection. Please try again later.' }, 429, headers);
  await env.CONTACT_QUEUE.put(rateKey, String(rate + 1), { expirationTtl: 7200 });
  const reference = crypto.randomUUID().split('-')[0].toUpperCase();
  const receivedAt = new Date().toISOString();
  const key = `${MESSAGE_PREFIX}${String(Date.now()).padStart(13, '0')}:${reference}`;
  await env.CONTACT_QUEUE.put(key, JSON.stringify({ reference, receivedAt, topic, name, email, phone, message }), { expirationTtl: 2_592_000 });
  return json({ delivered: true, reference }, 201, headers);
}

function fieldText(value, maxLength) {
  return clean(value, maxLength);
}

async function acceptFieldRequest(request, env, headers) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, headers); }
  if (data.website) return json({ delivered: true, reference: 'accepted' }, 200, headers);
  const payload = {
    name: fieldText(data.name, 120),
    email: fieldText(data.email, 254).toLowerCase(),
    phone: fieldText(data.phone, 40),
    username: fieldText(data.username, 32).toLowerCase(),
    reason: fieldText(data.reason, 2000),
    deliveryMethod: 'private',
    ageConfirmed: data.ageConfirmed === true,
    onboarding: {
      goals: fieldText(data.onboarding?.goals, 2000),
      communicationStyle: fieldText(data.onboarding?.communicationStyle, 160),
      experience: fieldText(data.onboarding?.experience, 160),
      assistantStyle: fieldText(data.onboarding?.assistantStyle, 800),
      accessibility: fieldText(data.onboarding?.accessibility, 1200),
    },
    feedback: {
      devices: fieldText(data.feedback?.devices, 800),
      workflows: fieldText(data.feedback?.workflows, 1600),
      frustrations: fieldText(data.feedback?.frustrations, 2000),
      mustHave: fieldText(data.feedback?.mustHave, 2000),
      privacyComfort: fieldText(data.feedback?.privacyComfort, 160),
      testingAvailability: fieldText(data.feedback?.testingAvailability, 800),
      other: fieldText(data.feedback?.other, 2000),
    },
  };
  const required = [payload.name, payload.email, payload.username, payload.reason, payload.onboarding.goals, payload.onboarding.communicationStyle, payload.onboarding.experience, payload.feedback.devices, payload.feedback.workflows, payload.feedback.frustrations, payload.feedback.mustHave, payload.feedback.privacyComfort, payload.feedback.testingAvailability];
  if (!data.consent || !payload.ageConfirmed || required.some((value) => !value) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(payload.username)) return json({ error: 'Please complete every required field and confirm that you are at least 18.' }, 400, headers);
  const address = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window = Math.floor(Date.now() / 3_600_000);
  const rateKey = `field-rate:${await digest(`${address}:${window}`)}`;
  const rate = Number(await env.CONTACT_QUEUE.get(rateKey) || 0);
  if (rate >= 3) return json({ error: 'Too many requests were sent from this connection. Please try again later.' }, 429, headers);
  await env.CONTACT_QUEUE.put(rateKey, String(rate + 1), { expirationTtl: 7200 });
  const reference = crypto.randomUUID().split('-')[0].toUpperCase();
  const key = `${FIELD_REQUEST_PREFIX}${String(Date.now()).padStart(13, '0')}:${reference}`;
  await env.CONTACT_QUEUE.put(key, JSON.stringify({ reference, receivedAt: new Date().toISOString(), ...payload }), { expirationTtl: 2_592_000 });
  return json({ delivered: true, reference }, 201, headers);
}

async function inbox(env) {
  const listed = await env.CONTACT_QUEUE.list({ prefix: MESSAGE_PREFIX, limit: 25 });
  const fieldListed = await env.CONTACT_QUEUE.list({ prefix: FIELD_REQUEST_PREFIX, limit: 25 });
  const messages = [];
  for (const key of listed.keys) {
    const value = await env.CONTACT_QUEUE.get(key.name, 'json');
    if (value) messages.push({ key: key.name, ...value });
  }
  const accessRequests = [];
  for (const key of fieldListed.keys) {
    const value = await env.CONTACT_QUEUE.get(key.name, 'json');
    if (value) accessRequests.push({ key: key.name, ...value });
  }
  return json({ messages, accessRequests }, 200);
}

async function acknowledge(request, env) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const keys = Array.isArray(data.keys) ? data.keys.map(String).filter((key) => key.startsWith(MESSAGE_PREFIX) || key.startsWith(FIELD_REQUEST_PREFIX)).slice(0, 50) : [];
  await Promise.all(keys.map((key) => env.CONTACT_QUEUE.delete(key)));
  return json({ acknowledged: keys.length }, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'POST' && url.pathname === '/contact') {
      if (!allowedOrigins(env).has(origin)) return json({ error: 'Origin not allowed.' }, 403, headers);
      return acceptContact(request, env, headers);
    }
    if (request.method === 'POST' && url.pathname === '/field-request') {
      if (!allowedOrigins(env).has(origin)) return json({ error: 'Origin not allowed.' }, 403, headers);
      return acceptFieldRequest(request, env, headers);
    }
    if (url.pathname.startsWith('/forge/') && !authorized(request, env)) return json({ error: 'Unauthorized.' }, 401);
    if (request.method === 'GET' && url.pathname === '/forge/inbox') return inbox(env);
    if (request.method === 'POST' && url.pathname === '/forge/ack') return acknowledge(request, env);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200);
    return json({ error: 'Not found.' }, 404);
  },
};
