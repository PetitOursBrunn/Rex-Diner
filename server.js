'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, '.data');
const DATA_FILE = path.join(DATA_DIR, 'rexs-diner-data.json');
const PORT = Number(process.env.PORT || 8080);
const BUILD_VERSION = '11.8.0';
const ACCESS_USER = process.env.REXS_ACCESS_USER || 'rex';
const ACCESS_PASSWORD = process.env.REXS_ACCESS_PASSWORD || '';
const REQUIRE_AUTH = ACCESS_PASSWORD.length > 0;

fs.mkdirSync(DATA_DIR, { recursive: true });

let state = null;
let revision = 0;
let clients = new Set();
let writeQueue = Promise.resolve();

function readStored() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    state = parsed.data || parsed;
    revision = Number(parsed.revision || 1);
  } catch (err) {
    console.error('Impossible de lire la base locale :', err.message);
  }
}
readStored();

function timingSafeEqualText(a, b) {
  const crypto = require('crypto');
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function authorized(req) {
  if (!REQUIRE_AUTH) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx < 0) return false;
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    return timingSafeEqualText(user, ACCESS_USER) && timingSafeEqualText(pass, ACCESS_PASSWORD);
  } catch {
    return false;
  }
}

function requestAuth(res) {
  res.writeHead(401, {
    'WWW-Authenticate': "Basic realm=\"Rex's Diner\", charset=\"UTF-8\"",
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end("Accès protégé à Rex's Diner.");
}


function persist() {
  const snapshot = JSON.stringify({ revision, updatedAt: new Date().toISOString(), data: state }, null, 2);
  const temp = DATA_FILE + '.tmp';
  writeQueue = writeQueue.then(async () => {
    await fs.promises.writeFile(temp, snapshot, 'utf8');
    await fs.promises.rename(temp, DATA_FILE);
  }).catch(err => console.error('Erreur de sauvegarde :', err.message));
  return writeQueue;
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function broadcast(clientId) {
  if (!state) return;
  const payload = `data: ${JSON.stringify({ type:'state', clientId, revision, data:state })}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html':'text/html; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.svg':'image/svg+xml',
    '.json':'application/json; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { pathname = '/'; }
  if (pathname === '/') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}.data${path.sep}`)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      return res.end('Fichier introuvable');
    }
    res.writeHead(200, {
      'Content-Type': contentType(file),
      'Cache-Control': (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css'))
        ? 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
        : 'public, max-age=3600',
      'Pragma': (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) ? 'no-cache' : '',
      'Expires': (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) ? '0' : '',
      'Surrogate-Control': (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) ? 'no-store' : '',
      'X-Rex-Build': BUILD_VERSION
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/build') {
    return sendJson(res, 200, {
      build: BUILD_VERSION,
      revision,
      serverTime: Date.now()
    });
  }

  if (url.pathname === '/health') {
    return sendJson(res, 200, { ok:true, initialized:!!state, revision, clients:clients.size });
  }

  if (!authorized(req)) {
    return requestAuth(res);
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    const since = Number(url.searchParams.get('since') || -1);
    const changed = since < revision;
    return sendJson(res, 200, {
      initialized: !!state,
      revision,
      changed,
      data: changed || since < 0 ? state : null,
      serverTime: Date.now()
    });
  }

  if (url.pathname === '/api/bootstrap' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!state) {
        state = body.data;
        revision = 1;
        await persist();
        broadcast(body.clientId || 'bootstrap');
      }
      return sendJson(res, 200, { initialized:true, revision, data:state });
    } catch (err) {
      return sendJson(res, 400, { error:'Données invalides' });
    }
  }

  if (url.pathname === '/api/state' && req.method === 'PUT') {
    try {
      const body = await readJson(req);
      if (!body.data || typeof body.data !== 'object') return sendJson(res, 400, { error:'Données invalides' });
      state = body.data;
      revision += 1;
      await persist();
      broadcast(body.clientId || 'unknown');
      return sendJson(res, 200, { ok:true, revision });
    } catch (err) {
      return sendJson(res, 400, { error:'Données invalides' });
    }
  }

  if (url.pathname === '/api/events' && req.method === 'GET') {
    req.socket.setKeepAlive(true, 10000);
    res.writeHead(200, {
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'Keep-Alive':'timeout=120',
      'X-Accel-Buffering':'no',
      'Content-Encoding':'identity'
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('retry: 2000\n');
    res.write(`data: ${JSON.stringify({type:'hello',revision})}\n\n`);
    clients.add(res);
    const timer = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({type:'ping',revision,time:Date.now()})}\n\n`);
      } catch {}
    }, 10000);
    req.on('close', () => {
      clearInterval(timer);
      clients.delete(res);
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(interfaces)) {
    for (const i of entries || []) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }
  console.log('');
  console.log("======================================================");
  console.log("  REX'S DINER — Serveur temps réel");
  console.log("======================================================");
  console.log(`  Sur ce PC : http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  Réseau local : http://${ip}:${PORT}`);
  console.log('');
  console.log("  Garde cette fenêtre ouverte pendant l'utilisation.");
  console.log(`  Données persistantes : ${DATA_DIR}`);
  console.log(`  Protection web : ${REQUIRE_AUTH ? 'activée' : 'DÉSACTIVÉE'}`);
  console.log("======================================================");
  console.log('');
});
