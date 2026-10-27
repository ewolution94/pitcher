// Production server: serves the built page from ../dist, the relay to YouTube (relay.mjs, Fermata's)
// and the Census forwarder. No dependencies and no state: the audio is fetched through the relay,
// decoded and played in the page, and kept nowhere.
//
//   PORT=8080 HOST=0.0.0.0 node server/server.mjs
//
// Environment:
//   PORT, HOST          where to listen (default 0.0.0.0:8080)
//   PITCHER_IPV4=1      only talk to YouTube over IPv4 (stream URLs are bound to the IP that asked)
//   PITCHER_CENSUS      Census's ingest origin for visit counts, e.g. http://census:4901 (default: off)

import dns from 'node:dns';
import http from 'node:http';
import net from 'node:net';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createCensus } from './census.mjs';
import { createRelay } from './relay.mjs';

const portFlag = process.argv.indexOf('--port');
const PORT = Number(portFlag > -1 ? process.argv[portFlag + 1] : (process.env.PORT ?? 8080));
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));

// YouTube signs stream URLs for the IP that requested them. On dual-stack hosts, mixing IPv4 and
// IPv6 between the metadata request and the download gets you 403s; pinning one family avoids it.
if (process.env.PITCHER_IPV4 === '1') {
  dns.setDefaultResultOrder('ipv4first');
  net.setDefaultAutoSelectFamily(false);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.wasm']);

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'content-security-policy': [
    "default-src 'self'",
    // 'unsafe-eval': YouTube's signature cipher is JavaScript that has to be run (youtubei.js).
    // blob: and 'wasm-unsafe-eval': the time-stretch runs as WebAssembly in an audio worklet that
    // Signalsmith Stretch loads from a blob: URL.
    "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
    "worker-src 'self' blob:",
    // Svelte writes style="" attributes; the shared elements use constructable stylesheets.
    "style-src 'self' 'unsafe-inline'",
    // Thumbnails come through the relay; a dropped file's picture would be a blob:.
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

// Visits are counted by Census (server/census.mjs). Off unless PITCHER_CENSUS is set, so a local
// `npm start` counts nothing; the NAS stack sets it.
const census = createCensus({ target: process.env.PITCHER_CENSUS ?? '', site: 'pitcher' });
const relay = createRelay();
const compressed = new Map();

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.join(DIST, path.normalize(decoded));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return null;
  try {
    const info = await stat(file);
    if (info.isFile()) return { file, size: info.size, mtime: info.mtime };
  } catch {}
  return null;
}

async function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  let entry = await resolveFile(pathname);
  // The page is one document: / serves it, and so does any path without a file extension, so
  // swapping youtube.com for the Pitcher host in a link (/watch?v=…, /shorts/…) opens it here.
  // A missing file with an extension stays a 404, so an old /assets/ name never gets the HTML.
  if (!entry && !path.extname(pathname)) entry = await resolveFile('/index.html');
  if (!entry) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }

  const ext = path.extname(entry.file);
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'last-modified': entry.mtime.toUTCString(),
  };

  const accept = req.headers['accept-encoding'] ?? '';
  const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (encoding && COMPRESSIBLE.has(ext) && entry.size < 8 * 1024 * 1024) {
    const key = `${entry.file}:${entry.mtime.getTime()}:${encoding}`;
    let body = compressed.get(key);
    if (!body) {
      const raw = await readFile(entry.file);
      body = encoding === 'br' ? zlib.brotliCompressSync(raw) : zlib.gzipSync(raw);
      compressed.set(key, body);
    }
    res.writeHead(200, { ...headers, 'content-encoding': encoding, 'content-length': body.length, vary: 'accept-encoding' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }

  res.writeHead(200, { ...headers, 'content-length': entry.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(entry.file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') return res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

  try {
    if (await census(req, res)) return;
    await relay(req, res, async () => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      await serveStatic(req, res);
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end('Internal error');
    else res.destroy();
  }
});

// Docker stops containers with SIGTERM, which Node ignores as PID 1 unless handled; without
// this, every Watchtower update waits out the 10 s grace period and then kills us.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Pitcher listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
