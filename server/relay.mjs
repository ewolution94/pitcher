// The relay, copied from Fermata's (fermata/server/relay.mjs): Pitcher's only server-side logic.
// Browsers can't talk to YouTube directly (no CORS headers, and stream URLs are bound to the IP
// that requested them), so the client sends requests here as /relay/<host>/<path>?<query> and we
// forward them to an allowlist of YouTube hosts. We never parse, store, or transform anything:
// bytes in, bytes out. The audio is decoded in the page and kept nowhere.

import { Readable } from 'node:stream';

export const RELAY_PREFIX = '/relay/';

const ALLOWED_HOSTS = [
  /^(?:[a-z0-9-]+\.)*youtube\.com$/,
  /^(?:[a-z0-9-]+\.)*youtube-nocookie\.com$/,
  /^(?:[a-z0-9-]+\.)*googlevideo\.com$/,
  /^(?:[a-z0-9-]+\.)*ytimg\.com$/,
  /^(?:[a-z0-9-]+\.)*ggpht\.com$/,
  /^youtubei\.googleapis\.com$/,
];

// Headers that describe the browser's connection to us rather than a request to YouTube.
// `authorization` in particular must never leave.
const DROP_REQUEST_HEADERS = new Set([
  'host', 'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te',
  'trailer', 'content-length', 'accept-encoding', 'cookie', 'origin', 'referer', 'authorization',
  'proxy-authorization', 'forwarded', 'via', 'dnt', 'priority', 'x-real-ip', 'cache-control', 'pragma',
]);
const DROP_REQUEST_PREFIXES = ['sec-', 'x-forwarded-', 'cf-', 'x-relay-'];

// Browsers silently drop some headers from fetch(); the client smuggles them as x-relay-<name>.
const RESTORE_PREFIX = 'x-relay-';

const PASS_RESPONSE_HEADERS = [
  'content-type', 'content-length', 'content-range', 'accept-ranges',
  'cache-control', 'expires', 'last-modified', 'etag',
];

const MAX_BODY_BYTES = 1 << 20;
const MAX_REDIRECTS = 5;
const HEADERS_TIMEOUT_MS = 30_000;

export const isAllowedHost = (host) => ALLOWED_HOSTS.some((re) => re.test(host));

/**
 * Connect-style middleware: handles /relay/* and passes everything else to `next`.
 * @param {{ corsOrigin?: string }} [options]
 *   corsOrigin: set when the app is served from a different origin than the relay (e.g. static
 *   hosting + a separate relay box).
 */
export function createRelay({ corsOrigin } = {}) {
  return async function relay(req, res, next) {
    if (!req.url?.startsWith(RELAY_PREFIX)) return next?.();

    if (corsOrigin) {
      res.setHeader('access-control-allow-origin', corsOrigin);
      res.setHeader('access-control-expose-headers', 'content-length, content-range, content-type, x-pitcher-relay');
      res.setHeader('vary', 'origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('access-control-allow-methods', 'GET, HEAD, POST');
        res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] ?? '*');
        res.setHeader('access-control-max-age', '86400');
        res.writeHead(204).end();
        return;
      }
    }

    let target;
    try {
      target = new URL(`https://${req.url.slice(RELAY_PREFIX.length)}`);
    } catch {
      return fail(res, 400, 'Malformed relay URL');
    }
    if (target.username || target.password || target.port || !isAllowedHost(target.hostname)) {
      return fail(res, 403, `Host not allowed: ${target.hostname}`);
    }
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) return fail(res, 405, 'Method not allowed');

    let body;
    if (req.method === 'POST') {
      try {
        body = await readBody(req);
      } catch (err) {
        return fail(res, 413, err.message);
      }
    }

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    let upstream;
    let method = req.method;
    let url = target;
    const headers = upstreamHeaders(req.headers, target.hostname);
    const timer = setTimeout(() => controller.abort(new Error('Upstream timed out')), HEADERS_TIMEOUT_MS);
    try {
      for (let hop = 0; ; hop++) {
        upstream = await fetch(url, { method, headers, body, redirect: 'manual', signal: controller.signal });
        const location = upstream.headers.get('location');
        if (upstream.status < 300 || upstream.status >= 400 || !location) break;
        if (hop >= MAX_REDIRECTS) return fail(res, 502, 'Too many redirects');
        const next = new URL(location, url);
        if (next.protocol !== 'https:' || !isAllowedHost(next.hostname)) {
          return fail(res, 502, `Redirect to disallowed host: ${next.hostname}`);
        }
        await upstream.body?.cancel();
        if (upstream.status === 303 || ((upstream.status === 301 || upstream.status === 302) && method === 'POST')) {
          method = 'GET';
          body = undefined;
        }
        url = next;
      }
    } catch (err) {
      if (controller.signal.aborted && res.destroyed) return;
      return fail(res, 502, `Upstream request failed: ${err.cause?.code ?? err.message}`);
    } finally {
      clearTimeout(timer);
    }

    const out = {};
    for (const name of PASS_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) out[name] = value;
    }
    // fetch() already decoded any content-encoding, so the upstream length no longer applies.
    if (upstream.headers.get('content-encoding')) delete out['content-length'];
    res.writeHead(upstream.status, out);

    if (method === 'HEAD' || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body)
      .on('error', () => res.destroy())
      .pipe(res);
  };
}

function upstreamHeaders(incoming, host) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming)) {
    if (value == null) continue;
    if (DROP_REQUEST_HEADERS.has(name) || DROP_REQUEST_PREFIXES.some((p) => name.startsWith(p))) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  for (const [name, value] of Object.entries(incoming)) {
    if (value != null && name.startsWith(RESTORE_PREFIX)) {
      headers.set(name.slice(RESTORE_PREFIX.length), Array.isArray(value) ? value.join(', ') : value);
    }
  }
  // InnerTube expects an origin matching the API host, as a first-party client would send.
  if (!headers.has('origin') && /(?:^|\.)(?:youtube\.com|googleapis\.com)$/.test(host)) {
    headers.set('origin', `https://${host}`);
  }
  return headers;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Marked so the client can tell the relay's own failures apart from YouTube's responses.
function fail(res, status, message) {
  if (res.headersSent) return res.destroy();
  res.writeHead(status, { 'content-type': 'application/json', 'x-pitcher-relay': 'error' });
  res.end(JSON.stringify({ error: message }));
}
