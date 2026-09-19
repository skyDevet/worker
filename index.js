// ============================================================
// Cloudflare Worker - AGIG NLP + Auth Server
//   GET  /api/health
//   GET  /api/nlp/health
//   GET  /api/nlp/services
//   POST /api/nlp/process
//   POST /api/nlp/reset/:serviceId
//   GET  /auth/fayda/login
//   GET  /auth/fayda/callback
//   GET  /auth/google/login
//   GET  /auth/google/callback
//   GET  /auth/me
//   POST /auth/logout
// ============================================================

import { nlpProcessor } from './services/nlprocessor.js';
import {
  faydaLogin, faydaCallback,
  googleLogin, googleCallback,
  me as authMe, logout as authLogout
} from './routes/auth.js';

let initialized = false;
async function ensureInit() {
  if (initialized) return;
  await nlpProcessor.init();
  initialized = true;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

async function withCors(resPromise, cors) {
  const res = await resPromise;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

const rateBuckets = new Map();
function rateLimit(key, max = 200, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count <= max;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '*';
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const path = url.pathname;
  const sessionId = request.headers.get('X-Session-ID') || 'anonymous';

  try {
    // ---------- API ----------
    if (path === '/api/health' || path === '/api/nlp/health') {
      return json({ status: 'ok', timestamp: Date.now() }, 200, cors);
    }

    if (path === '/api/nlp/services' && request.method === 'GET') {
      await ensureInit();
      const services = await nlpProcessor.getAvailableServices();
      const safe = services.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        initStep: s.initStep
      }));
      return json({ success: true, data: safe }, 200, cors);
    }

    if (path.startsWith('/api/nlp/reset/') && request.method === 'POST') {
      await ensureInit();
      const serviceId = path.split('/').pop();
      nlpProcessor.resetService(serviceId);
      return json({ success: true }, 200, cors);
    }

    if (path === '/api/nlp/process' && request.method === 'POST') {
      if (!rateLimit(sessionId)) {
        return json({ error: 'Too many requests', code: 'RATE_LIMITED' }, 429, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'Invalid JSON body' }, 400, cors); }

      const { text, sessionId: bodySession, language, file } = body || {};
      const sid = bodySession || sessionId;

      if (!sid) return json({ error: 'Missing sessionId', code: 'INVALID_INPUT' }, 400, cors);
      if (!text && !file) return json({ error: 'Missing text or file', code: 'INVALID_INPUT' }, 400, cors);

      await ensureInit();
      if (language) nlpProcessor.setLanguage(language);

      const result = await nlpProcessor.chat(text, file || null, sid);
      return json({ success: true, data: result, timestamp: Date.now() }, 200, cors);
    }

    // ---------- AUTH ----------
    // Redirect endpoints — no CORS needed
    if (path === '/auth/fayda/login'     && request.method === 'GET')  return faydaLogin(request, env);
    if (path === '/auth/fayda/callback'  && request.method === 'GET')  return faydaCallback(request, env);
    if (path === '/auth/google/login'    && request.method === 'GET')  return googleLogin(request, env);
    if (path === '/auth/google/callback' && request.method === 'GET')  return googleCallback(request, env);

    // JSON endpoints — need CORS because frontend calls them with fetch()
    if (path === '/auth/me'     && request.method === 'GET')  return withCors(authMe(request, env), cors);
    if (path === '/auth/logout' && request.method === 'POST') return withCors(authLogout(request, env), cors);

    return json({ error: 'Not found' }, 404, cors);
  } catch (error) {
    console.error('Worker error:', error && error.stack ? error.stack : error);
    return json({ error: 'Internal server error', message: error.message }, 500, cors);
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};