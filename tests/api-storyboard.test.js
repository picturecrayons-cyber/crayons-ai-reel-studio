import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/storyboard.js';

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body; return body; }
  };
}

function makeRequest(ip, body = { prompt: 'A short film about sunrise' }) {
  return {
    method: 'POST',
    headers: {
      origin: 'https://studio.example',
      host: 'studio.example',
      'x-forwarded-for': ip
    },
    body
  };
}

const previousKey = process.env.GEMINI_API_KEY;
const previousConfirm = process.env.GEMINI_FREE_TIER_CONFIRMED;
const previousFetch = globalThis.fetch;

test.afterEach(() => {
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousKey;
  if (previousConfirm === undefined) delete process.env.GEMINI_FREE_TIER_CONFIRMED;
  else process.env.GEMINI_FREE_TIER_CONFIRMED = previousConfirm;
  globalThis.fetch = previousFetch;
});

test('does not call an AI provider unless free-tier confirmation is set', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_FREE_TIER_CONFIRMED;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('should not call'); };
  const res = makeResponse();
  await handler(makeRequest('198.51.100.11'), res);
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).code, 'FREE_AI_NOT_CONFIGURED');
  assert.equal(calls, 0);
});

test('falls back to the second allowlisted model only after a quota response', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_FREE_TIER_CONFIRMED = 'true';
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (urls.length === 1) return { ok: false, status: 429, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota exhausted' } }) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ scenes: [{ title: 'Start', caption: 'Hello', visual: 'Sunrise', seconds: 5 }] }) }] } }] })
    };
  };
  const res = makeResponse();
  await handler(makeRequest('198.51.100.12'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /gemini-3\.8-flash/);
  assert.match(urls[1], /gemini-3\.6-flash/);
  assert.equal(JSON.parse(res.body).provider, 'gemini-3.6-flash');
});

test('does not try another model after a non-quota provider outage', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_FREE_TIER_CONFIRMED = 'true';
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 503, json: async () => ({ error: { message: 'service temporarily unavailable' } }) };
  };
  const res = makeResponse();
  await handler(makeRequest('198.51.100.13'), res);
  assert.equal(res.statusCode, 503);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(res.body).code, 'AI_PROVIDER_ERROR');
});

test('rejects missing or cross-origin Origin headers', async () => {
  const res = makeResponse();
  await handler({ ...makeRequest('198.51.100.14'), headers: { host: 'studio.example' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.body).code, 'ORIGIN_REQUIRED');
});
