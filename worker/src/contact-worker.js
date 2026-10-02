const TOPICS = new Set(['general', 'field-testing', 'investor', 'sponsor', 'affiliate', 'technical', 'press']);
const MESSAGE_PREFIX = 'message:';

function cors(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || origin === 'https://www.tetheredunicorn.com';
  return { 'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
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

async function inbox(env) {
  const listed = await env.CONTACT_QUEUE.list({ prefix: MESSAGE_PREFIX, limit: 25 });
  const messages = [];
  for (const key of listed.keys) {
    const value = await env.CONTACT_QUEUE.get(key.name, 'json');
    if (value) messages.push({ key: key.name, ...value });
  }
  return json({ messages }, 200);
}

async function acknowledge(request, env) {
  let data;
  try { data = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const keys = Array.isArray(data.keys) ? data.keys.map(String).filter((key) => key.startsWith(MESSAGE_PREFIX)).slice(0, 25) : [];
  await Promise.all(keys.map((key) => env.CONTACT_QUEUE.delete(key)));
  return json({ acknowledged: keys.length }, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'POST' && url.pathname === '/contact') {
      if (origin !== env.ALLOWED_ORIGIN && origin !== 'https://www.tetheredunicorn.com') return json({ error: 'Origin not allowed.' }, 403, headers);
      return acceptContact(request, env, headers);
    }
    if (url.pathname.startsWith('/forge/') && !authorized(request, env)) return json({ error: 'Unauthorized.' }, 401);
    if (request.method === 'GET' && url.pathname === '/forge/inbox') return inbox(env);
    if (request.method === 'POST' && url.pathname === '/forge/ack') return acknowledge(request, env);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200);
    return json({ error: 'Not found.' }, 404);
  },
};
