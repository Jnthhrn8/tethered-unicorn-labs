import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/contact-worker.js';

class MemoryKv {
  constructor() { this.values = new Map(); }
  async put(key, value) { this.values.set(key, String(value)); }
  async get(key, type) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }
  async list({ prefix, limit }) {
    return {
      keys: [...this.values.keys()]
        .filter((key) => key.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name })),
    };
  }
  async delete(key) { this.values.delete(key); }
}

const env = () => ({
  ALLOWED_ORIGIN: 'https://tetheredunicorn.com',
  FIELD_CONSOLE_ORIGIN: 'https://jnthhrn8.github.io',
  FORGE_INBOX_TOKEN: 'test-secret',
  CONTACT_QUEUE: new MemoryKv(),
});

const application = {
  name: 'Test Adult',
  email: 'adult@example.test',
  phone: '',
  username: 'testadult',
  reason: 'I want to help test the Forge.',
  consent: true,
  ageConfirmed: true,
  website: '',
  onboarding: {
    goals: 'Test useful workflows',
    communicationStyle: 'Concise and direct',
    experience: 'Frequent user',
    assistantStyle: 'Candid',
    accessibility: '',
  },
  feedback: {
    devices: 'Windows and Android',
    workflows: 'Research and planning',
    frustrations: 'Silent failures',
    mustHave: 'Visible activity',
    privacyComfort: 'Comfortable',
    testingAvailability: 'Two hours weekly',
    other: '',
  },
};

function post(origin, body = application) {
  return new Request('https://messages.tetheredunicorn.com/field-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

test('valid adult field request is queued for the private bridge', async () => {
  const state = env();
  const accepted = await worker.fetch(post(state.FIELD_CONSOLE_ORIGIN), state);
  assert.equal(accepted.status, 201);
  const receipt = await accepted.json();
  assert.match(receipt.reference, /^[A-F0-9]{8}$/i);

  const inbox = await worker.fetch(
    new Request('https://messages.tetheredunicorn.com/forge/inbox', {
      headers: { Authorization: 'Bearer test-secret' },
    }),
    state,
  );
  const queued = await inbox.json();
  assert.equal(queued.accessRequests.length, 1);
  assert.equal(queued.accessRequests[0].username, application.username);
  assert.equal(queued.accessRequests[0].ageConfirmed, true);
});

test('underage or unconfirmed requests are rejected', async () => {
  const state = env();
  const response = await worker.fetch(
    post(state.FIELD_CONSOLE_ORIGIN, { ...application, ageConfirmed: false }),
    state,
  );
  assert.equal(response.status, 400);
});

test('unapproved web origins cannot submit field requests', async () => {
  const response = await worker.fetch(post('https://example.invalid'), env());
  assert.equal(response.status, 403);
});

test('retired public contact endpoint does not touch Workers KV', async () => {
  const state = env();
  state.CONTACT_QUEUE.get = () => { throw new Error('Unexpected KV read'); };
  state.CONTACT_QUEUE.put = () => { throw new Error('Unexpected KV write'); };
  const response = await worker.fetch(new Request('https://messages.tetheredunicorn.com/contact', {
    method: 'POST', headers: { Origin: state.ALLOWED_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'test@example.test', topic: 'general', message: 'Hello', consent: true }),
  }), state);
  assert.equal(response.status, 410);
});
