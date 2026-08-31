'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { RexDiscordBot } = require('./discord-bot');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, '.data');
const DATA_FILE = path.join(DATA_DIR, 'rexs-diner-data.json');
const PORT = Number(process.env.PORT || 8080);
const BUILD_VERSION = '11.22.0';
const ACCESS_USER = process.env.REXS_ACCESS_USER || 'rex';
const ACCESS_PASSWORD = process.env.REXS_ACCESS_PASSWORD || '';
const REQUIRE_AUTH = ACCESS_PASSWORD.length > 0;

fs.mkdirSync(DATA_DIR, { recursive: true });

let state = null;
let revision = 0;
let clients = new Set();
let writeQueue = Promise.resolve();
let discordBot = null;

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


function normalizePayrollState(target) {
  if (!target || typeof target !== 'object') return target;
  if (!Array.isArray(target.employees)) target.employees = [];
  if (!Array.isArray(target.drawerMovements)) target.drawerMovements = [];
  if (!Array.isArray(target.journal)) target.journal = [];
  if (!Array.isArray(target.payrollTransactions)) target.payrollTransactions = [];
  target.payrollAppliedTotalPesos = Math.max(0, Number(target.payrollAppliedTotalPesos) || 0);
  target.cashDrawerPesos = Number(target.cashDrawerPesos) || 0;
  for (const e of target.employees) {
    e.salaryPesos = Math.max(0, Number(e.salaryPesos) || 0);
    e.payrollIntervalMinutes = Math.max(1, Number(e.payrollIntervalMinutes) || 60);
    e.inService = !!e.inService;
    e.serviceStartedAt = e.serviceStartedAt || null;
    e.nextPayrollAt = e.nextPayrollAt || null;
  }
  return target;
}
if (state) normalizePayrollState(state);

let payrollProcessing = false;
async function processPayroll() {
  if (payrollProcessing || !state) return false;
  payrollProcessing = true;
  try {
    normalizePayrollState(state);
    const now = Date.now();
    const processed = new Set(state.payrollTransactions.map(t => String(t.key || '')));
    let changed = false;
    for (const emp of state.employees) {
      if (!emp.inService) continue;
      const intervalMs = Math.max(1, Number(emp.payrollIntervalMinutes) || 60) * 60000;
      if (!emp.nextPayrollAt) {
        emp.nextPayrollAt = new Date(now + intervalMs).toISOString();
        changed = true;
        continue;
      }
      let due = new Date(emp.nextPayrollAt).getTime();
      if (!Number.isFinite(due)) due = now + intervalMs;
      let safety = 0;
      while (due <= now && safety++ < 500) {
        const key = `${emp.id}:${due}`;
        const salary = Math.max(0, Number(emp.salaryPesos) || 0);
        if (!processed.has(key)) {
          const before = Number(state.cashDrawerPesos) || 0;
          const after = before - salary;
          state.cashDrawerPesos = after;
          state.payrollAppliedTotalPesos += salary;
          state.payrollTransactions.unshift({ key, employeeId:emp.id, employee:emp.name, amountPesos:salary, date:new Date(due).toISOString() });
          state.payrollTransactions = state.payrollTransactions.slice(0,1000);
          state.drawerMovements.unshift({id:Date.now()+Math.random(),date:new Date().toISOString(),employee:'Système',currency:'MXN',type:'salary',amount:salary,before,after,reason:`Salaire de ${emp.name}`,originalCurrency:'MXN',originalAmount:salary});
          state.drawerMovements = state.drawerMovements.slice(0,500);
          const payrollJournalEntry={id:Date.now()+Math.random(),date:new Date().toISOString(),employee:'Système',action:'Salaire',detail:`${emp.name} • ${salary} pesos déduits du fond de caisse`};
          state.journal.unshift(payrollJournalEntry);
          state.journal = state.journal.slice(0,500);
          if(discordBot) discordBot.notifyJournal(payrollJournalEntry,state).catch(err=>console.error('Discord salaire :',err.message));
          processed.add(key);
        }
        due += intervalMs;
        emp.nextPayrollAt = new Date(due).toISOString();
        changed = true;
      }
    }
    if (changed) {
      revision += 1;
      await persist();
      broadcast('payroll');
    }
    return changed;
  } finally {
    payrollProcessing = false;
  }
}

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


async function mutateStateFromDiscord({ actor='Discord', action=null, detail=null, mutator, silent=false }) {
  if (!state || typeof mutator !== 'function') throw new Error('État Rex non initialisé');
  const previousState = JSON.parse(JSON.stringify(state));
  await mutator(state);
  normalizePayrollState(state);
  if (!silent && action) {
    if (!Array.isArray(state.journal)) state.journal = [];
    state.journal.unshift({
      id: Date.now() + Math.random(),
      date: new Date().toISOString(),
      employee: actor || 'Discord',
      action,
      detail: detail || 'Action effectuée depuis Discord'
    });
    state.journal = state.journal.slice(0, 500);
  }
  revision += 1;
  await persist();
  broadcast('discord-bot');
  if (discordBot && !silent) {
    discordBot.handleStateChange(previousState, state).catch(err => console.error('Discord mutation logs :', err.message));
  }
  return { ok:true, revision, state };
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
    return sendJson(res, 200, { ok:true, initialized:!!state, revision, clients:clients.size, discord:{enabled:!!discordBot?.enabled?.(),ready:!!discordBot?.ready} });
  }

  if (!authorized(req)) {
    return requestAuth(res);
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    await processPayroll();
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
        state = normalizePayrollState(body.data);
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
      const previousState = state;
      const incoming = normalizePayrollState(body.data);
      if (state) {
        normalizePayrollState(state);
        const currentApplied = Number(state.payrollAppliedTotalPesos) || 0;
        const incomingApplied = Number(incoming.payrollAppliedTotalPesos) || 0;
        const missingPayroll = Math.max(0, currentApplied - incomingApplied);
        if (missingPayroll > 0) incoming.cashDrawerPesos = (Number(incoming.cashDrawerPesos) || 0) - missingPayroll;
        incoming.payrollAppliedTotalPesos = currentApplied;
        const tx = new Map([...(incoming.payrollTransactions||[]), ...(state.payrollTransactions||[])].map(t=>[String(t.key||`${t.employeeId}:${t.date}`),t]));
        incoming.payrollTransactions = [...tx.values()].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,1000);
      }
      state = incoming;
      revision += 1;
      await persist();
      await processPayroll();
      broadcast(body.clientId || 'unknown');
      if(discordBot && previousState) discordBot.handleStateChange(previousState,state).catch(err=>console.error('Discord logs :',err.message));
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

setInterval(() => { processPayroll().catch(err => console.error('Erreur salaire :', err.message)); }, 1000);

discordBot = new RexDiscordBot({ getState:()=>state, mutateState:mutateStateFromDiscord, buildVersion:BUILD_VERSION });
discordBot.start().catch(err=>console.error('Erreur bot Discord :',err.message));

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
  console.log(`  Bot Discord : ${discordBot?.enabled() ? 'activation en cours' : 'désactivé'}`);
  console.log("======================================================");
  console.log('');
});
