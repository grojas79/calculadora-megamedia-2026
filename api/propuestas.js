const JSONBIN_URL = 'https://jsonbin-zeta.vercel.app/api/bins/uMogXtk4Ar';
const JSONBLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
const GH_REPO = 'grojas79/calculadora-megamedia-2026';
const GH_PATH = 'data/propuestas-equipo.json';
// Se completa en el primer alta exitosa a jsonblob (o vía env JSONBLOB_ID).
const JSONBLOB_ID = process.env.JSONBLOB_ID || '';

function emptyStore() {
  return { proposals: [], updatedAt: 0 };
}

function normalizeStore(data) {
  if (!data || typeof data !== 'object') return null;
  const inner = data.record && typeof data.record === 'object' ? data.record : data;
  const proposals = Array.isArray(inner.proposals) ? inner.proposals
    : (Array.isArray(data.proposals) ? data.proposals : null);
  if (!proposals) return null;
  return {
    proposals: proposals.filter(p => p && p.id != null),
    updatedAt: inner.updatedAt || data.updatedAt || 0
  };
}

function mergeStores(stores) {
  const byId = new Map();
  let updatedAt = 0;
  stores.forEach(store => {
    if (!store) return;
    updatedAt = Math.max(updatedAt, +store.updatedAt || 0);
    (store.proposals || []).forEach(p => {
      if (!p || p.id == null) return;
      const prev = byId.get(p.id);
      if (!prev) {
        byId.set(p.id, p);
        return;
      }
      const newer = String(p.fechaISO || '') >= String(prev.fechaISO || '');
      const richer = (p.formatos && !prev.formatos)
        || (p.ejecutivo && p.ejecutivo !== '—' && (!prev.ejecutivo || prev.ejecutivo === '—'));
      if (newer || richer) byId.set(p.id, Object.assign({}, prev, p));
    });
  });
  return {
    proposals: [...byId.values()].sort((a, b) => String(b.fechaISO || b.fecha || '').localeCompare(String(a.fechaISO || a.fecha || ''))),
    updatedAt
  };
}

async function fetchJson(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    const r = await fetch(url, Object.assign({ cache: 'no-store' }, opts || {}, { signal: ctrl.signal }));
    const text = await r.text();
    return { ok: r.ok, status: r.status, text, headers: r.headers };
  } finally {
    clearTimeout(t);
  }
}

function parseBody(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function ghRawUrl() {
  const ref = process.env.VERCEL_GIT_COMMIT_REF || process.env.PROPOSALS_GH_REF || 'main';
  return 'https://raw.githubusercontent.com/' + GH_REPO + '/' + encodeURIComponent(ref) + '/' + GH_PATH;
}

function blobUrl(id) {
  return JSONBLOB_BASE + '/' + id;
}

function getMem() {
  if (!globalThis.__mgTeamStore) globalThis.__mgTeamStore = { store: null, blobId: JSONBLOB_ID || '' };
  return globalThis.__mgTeamStore;
}

async function readKv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('sin kv');
  const r = await fetchJson(url.replace(/\/$/, '') + '/get/megamedia:propuestas', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!r.ok) throw new Error('kv ' + r.status);
  const body = parseBody(r.text);
  const raw = body && (body.result != null ? body.result : body);
  const parsed = typeof raw === 'string' ? parseBody(raw) : raw;
  const n = normalizeStore(parsed);
  if (!n) throw new Error('kv formato');
  return n;
}

async function writeKv(store) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('sin kv');
  const r = await fetchJson(url.replace(/\/$/, '') + '/set/megamedia:propuestas', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(store)
  });
  if (!r.ok) throw new Error('kv put ' + r.status);
}

async function readJsonbin() {
  const r = await fetchJson(JSONBIN_URL);
  if (!r.ok) throw new Error('jsonbin ' + r.status);
  const n = normalizeStore(parseBody(r.text));
  if (!n) throw new Error('jsonbin formato');
  return n;
}

async function readGithubRaw() {
  const r = await fetchJson(ghRawUrl());
  if (!r.ok) throw new Error('github ' + r.status);
  const n = normalizeStore(parseBody(r.text));
  if (!n) throw new Error('github formato');
  return n;
}

async function readBlob(id) {
  if (!id) throw new Error('sin blob');
  const r = await fetchJson(blobUrl(id), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('jsonblob ' + r.status);
  const n = normalizeStore(parseBody(r.text));
  if (!n) throw new Error('jsonblob formato');
  return n;
}

async function createBlob(store) {
  const r = await fetchJson(JSONBLOB_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(store)
  }, 12000);
  if (!r.ok) throw new Error('jsonblob create ' + r.status);
  const loc = r.headers.get('location') || r.headers.get('Location') || '';
  const id = String(loc).split('/').filter(Boolean).pop() || '';
  if (!id) throw new Error('jsonblob sin id');
  return id;
}

async function writeBlob(id, store) {
  const r = await fetchJson(blobUrl(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(store)
  }, 12000);
  if (!r.ok) throw new Error('jsonblob put ' + r.status);
}

async function writeJsonbin(store) {
  const r = await fetchJson(JSONBIN_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store)
  });
  if (!r.ok) throw new Error('jsonbin put ' + r.status);
}

async function writeGithub(store) {
  const token = process.env.PROPOSALS_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('sin token github');
  const ref = process.env.VERCEL_GIT_COMMIT_REF || 'main';
  const metaUrl = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_PATH + '?ref=' + encodeURIComponent(ref);
  const meta = await fetchJson(metaUrl, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'megamedia-calculadora' }
  });
  const sha = meta.ok ? (parseBody(meta.text) || {}).sha : null;
  const put = await fetchJson('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_PATH, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'megamedia-calculadora'
    },
    body: JSON.stringify({
      message: 'Actualizar registro de propuestas del equipo',
      content: Buffer.from(JSON.stringify(store), 'utf8').toString('base64'),
      sha: sha || undefined,
      branch: ref
    })
  }, 15000);
  if (!put.ok) throw new Error('github put ' + put.status);
}

async function readStore() {
  const mem = getMem();
  const errors = [];
  const found = [];
  let jsonbinOk = false;
  const tryRead = async (name, fn) => {
    try {
      const store = await fn();
      if (store) {
        found.push(store);
        if (name === 'jsonbin') jsonbinOk = true;
      }
    } catch (e) {
      errors.push(name + ': ' + ((e && e.message) || e));
    }
  };
  await tryRead('memoria', async () => mem.store);
  await tryRead('kv', readKv);
  await tryRead('jsonbin', readJsonbin);
  await tryRead('github', async () => {
    const s = await readGithubRaw();
    if ((!s.proposals || !s.proposals.length) && !s.updatedAt) return null;
    return s;
  });
  await tryRead('jsonblob', () => readBlob(mem.blobId || JSONBLOB_ID));
  if (!found.length) {
    const err = new Error('No se pudo leer el registro del equipo');
    err.details = errors;
    throw err;
  }
  const merged = mergeStores(found);
  mem.store = merged;
  mem.jsonbinOk = jsonbinOk;
  return merged;
}

async function writeStore(store) {
  const mem = getMem();
  mem.store = store;
  const errors = [];
  let wrote = false;
  try {
    await writeKv(store);
    wrote = true;
  } catch (e) { errors.push((e && e.message) || e); }
  if (mem.jsonbinOk) {
    try {
      await writeJsonbin(store);
      wrote = true;
    } catch (e) { errors.push((e && e.message) || e); }
  } else {
    errors.push('jsonbin omitido: no se pudo leer (evita borrar el historial si el servicio vuelve)');
  }
  try {
    let id = mem.blobId || JSONBLOB_ID;
    if (!id) {
      id = await createBlob(store);
      mem.blobId = id;
      wrote = true;
    } else {
      await writeBlob(id, store);
      wrote = true;
    }
  } catch (e) { errors.push((e && e.message) || e); }
  try {
    await writeGithub(store);
    wrote = true;
  } catch (e) { errors.push((e && e.message) || e); }
  if (!wrote) {
    const err = new Error('No se pudo guardar el registro del equipo');
    err.details = errors;
    throw err;
  }
  return { blobId: mem.blobId || JSONBLOB_ID || '', errors };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      try {
        const store = await readStore();
        return res.status(200).json(store);
      } catch (e) {
        // Si todos los remotos fallan, no fingir un historial vacío: devolver 503.
        return res.status(503).json({
          error: (e && e.message) || 'No se pudo leer el registro del equipo',
          details: e && e.details,
          proposals: null
        });
      }
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      let store;
      try {
        store = await readStore();
      } catch (e) {
        store = emptyStore();
      }
      if (body.action === 'upsert' && body.proposal && body.proposal.id != null) {
        const i = store.proposals.findIndex(p => p && p.id === body.proposal.id);
        if (i >= 0) store.proposals[i] = Object.assign({}, store.proposals[i], body.proposal);
        else store.proposals.unshift(body.proposal);
        if (store.proposals.length > 500) store.proposals = store.proposals.slice(0, 500);
      } else if (body.action === 'delete' && body.id != null) {
        store.proposals = store.proposals.filter(p => p && p.id !== body.id);
      } else {
        return res.status(400).json({ error: 'Solicitud inválida' });
      }
      store.updatedAt = Date.now();
      const wr = await writeStore(store);
      return res.status(200).json({ ok: true, count: store.proposals.length, storeId: wr.blobId || undefined });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({
      error: (e && e.message) || 'Error de sincronización',
      details: e && e.details
    });
  }
}
