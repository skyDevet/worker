// ============================================================
// worker/routes/auth.js
// Fayda (eSignet) + Google OIDC for Cloudflare Workers
// ============================================================

function cfg(env) {
  return {
    fayda: {
      clientId:    env.FAYDA_CLIENT_ID,
      privateKey:  env.FAYDA_PRIVATE_KEY,
      authUrl:     env.FAYDA_AUTH_URL     || 'https://esignet.ida.fayda.et/v1/esignet/oauth/v2/authorize',
      tokenUrl:    env.FAYDA_TOKEN_URL    || 'https://esignet.ida.fayda.et/v1/esignet/oauth/v2/token',
      userInfoUrl: env.FAYDA_USERINFO_URL || 'https://esignet.ida.fayda.et/v1/esignet/oidc/userihttp://127.0.0.1:4000/auth/google/callbacknfo',
      redirectUri: env.FAYDA_REDIRECT_URI,
      scope:       env.FAYDA_SCOPE        || 'openid profile email phone'
    },
    google: {
      clientId:     env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authUrl:      'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl:     'https://oauth2.googleapis.com/token',
      userInfoUrl:  'https://www.googleapis.com/oauth2/v3/userinfo',
      redirectUri:  env.GOOGLE_REDIRECT_URI,
    },
    sessionSecret: env.SESSION_SECRET || 'change-me',
    appOrigin:     env.APP_ORIGIN     || 'https://localhost:3000'
  };
}

// ---------- encoding ----------
function base64UrlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function jsonToB64Url(obj) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function randomVerifier() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

function randomState() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

async function sha256Challenge(verifier) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(hash);
}

// ---------- session (HMAC-signed) ----------
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(sig);
}

async function createSession(secret, user) {
  const payload = { user, iat: Date.now(), exp: Date.now() + 7 * 24 * 3600 * 1000 };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig  = await hmac(secret, body);
  return `${body}.${sig}`;
}

async function verifySession(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await hmac(secret, body);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload.user;
  } catch {
    return null;
  }
}

// ---------- Fayda RSA client assertion ----------
async function makeClientAssertion(privateJwk, clientId, audience) {
  const header  = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: audience,
    iat: now,
    exp: now + 300,
    jti: randomState()
  };

  const headerB64  = jsonToB64Url(header);
  const payloadB64 = jsonToB64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(sig)}`;
}

// ---------- cookies ----------
function setCookie(name, value, maxAgeSec = 300) {
  return `${name}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAgeSec}`;
}

function readCookie(req, name) {
  const raw = req.headers.get('Cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

// ============================================================
// FAYDA
// ============================================================

export async function faydaLogin(request, env) {
  const c = cfg(env).fayda;
  if (!c.clientId || !c.privateKey || !c.redirectUri) {
    return new Response('Fayda not configured', { status: 500 });
  }

  const verifier  = randomVerifier();
  const challenge = await sha256Challenge(verifier);
  const state     = randomState();

  const url = new URL(c.authUrl);
  url.searchParams.set('client_id', c.clientId);
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', c.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const res = Response.redirect(url.toString(), 302);
  res.headers.append('Set-Cookie', setCookie('fayda_verifier', verifier));
  res.headers.append('Set-Cookie', setCookie('fayda_state', state));
  return res;
}

export async function faydaCallback(request, env) {
  const c = cfg(env).fayda;
  const url = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const savedVerifier = readCookie(request, 'fayda_verifier');
  const savedState    = readCookie(request, 'fayda_state');

  if (!code || !savedVerifier) return new Response('Missing code or verifier', { status: 400 });
  if (!state || state !== savedState) return new Response('State mismatch', { status: 400 });

  try {
    const assertion = await makeClientAssertion(
      JSON.parse(c.privateKey),
      c.clientId,
      c.tokenUrl
    );

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.redirectUri,
      client_id: c.clientId,
      code_verifier: savedVerifier,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion
    });

    const tokenRes = await fetch(c.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) {
      return new Response('Fayda token exchange failed: ' + JSON.stringify(tokens), { status: 400 });
    }

    const userRes = await fetch(c.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await userRes.json();

    const user = {
      id: profile.sub,
      name: profile.name || profile.given_name || 'Fayda User',
      email: profile.email || null,
      phone: profile.phone_number || null,
      provider: 'fayda',
      avatar: null,
      raw: profile
    };

    const session = await createSession(cfg(env).sessionSecret, user);
    const origin = cfg(env).appOrigin;

    return Response.redirect(`${origin}/auth/success?token=${session}`, 302);
  } catch (err) {
    console.error('Fayda callback error:', err);
    return new Response('Fayda login failed', { status: 500 });
  }
}

// ============================================================
// GOOGLE
// ============================================================

export async function googleLogin(request, env) {
  const c = cfg(env).google;
  if (!c.clientId || !c.redirectUri) {
    return new Response('Google not configured', { status: 500 });
  }

  const verifier  = randomVerifier();
  const challenge = await sha256Challenge(verifier);
  const state     = randomState();

  const url = new URL(c.authUrl);
  url.searchParams.set('client_id', c.clientId);
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const res = Response.redirect(url.toString(), 302);
  res.headers.append('Set-Cookie', setCookie('google_verifier', verifier));
  res.headers.append('Set-Cookie', setCookie('google_state', state));
  return res;
}

export async function googleCallback(request, env) {
  const c = cfg(env).google;
  const url = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const savedVerifier = readCookie(request, 'google_verifier');
  const savedState    = readCookie(request, 'google_state');

  if (!code || !savedVerifier) return new Response('Missing code or verifier', { status: 400 });
  if (!state || state !== savedState) return new Response('State mismatch', { status: 400 });

  try {
    const body = new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code,
      code_verifier: savedVerifier,
      grant_type: 'authorization_code',
      redirect_uri: c.redirectUri
    });

    const tokenRes = await fetch(c.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) {
      return new Response('Google token exchange failed: ' + JSON.stringify(tokens), { status: 400 });
    }

    const userRes = await fetch(c.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await userRes.json();

    const user = {
      id: profile.sub,
      name: profile.name || profile.email,
      email: profile.email,
      phone: null,
      provider: 'google',
      avatar: profile.picture || null,
      raw: profile
    };

    const session = await createSession(cfg(env).sessionSecret, user);
    const origin = cfg(env).appOrigin;

    return Response.redirect(`${origin}/auth/success?token=${session}`, 302);
  } catch (err) {
    console.error('Google callback error:', err);
    return new Response('Google login failed', { status: 500 });
  }
}

// ============================================================
// /auth/me + /auth/logout
// ============================================================

export async function me(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const user = await verifySession(cfg(env).sessionSecret, token);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function logout(request, env) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}