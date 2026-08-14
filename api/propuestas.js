const BIN_URL = 'https://jsonbin-zeta.vercel.app/api/bins/uMogXtk4Ar';

async function readStore() {
  const r = await fetch(BIN_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error('No se pudo leer el registro del equipo');
  const data = await r.json();
  const proposals = Array.isArray(data && data.proposals) ? data.proposals : [];
  return { proposals, updatedAt: (data && data.updatedAt) || 0 };
}

async function writeStore(store) {
  const r = await fetch(BIN_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store)
  });
  if (!r.ok) throw new Error('No se pudo guardar el registro del equipo');
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const store = await readStore();
      return res.status(200).json(store);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const store = await readStore();
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
      await writeStore(store);
      return res.status(200).json({ ok: true, count: store.proposals.length });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Error de sincronización' });
  }
}
