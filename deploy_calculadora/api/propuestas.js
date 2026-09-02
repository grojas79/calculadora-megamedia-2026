const SB_URL = process.env.SUPABASE_URL || 'https://uourzdgsruvnrnwhmgqf.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdXJ6ZGdzcnV2bnJud2htZ3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDcwNTUsImV4cCI6MjEwMjIyMzA1NX0.asRoJvjgKyL7Mx0GUNXufBKKeB5WCQJTklXMp8WJ6ZQ';
const REST = SB_URL.replace(/\/$/, '') + '/rest/v1/propuestas';

function sbHeaders(extra) {
  return Object.assign({
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

function fechaIsoFrom(p) {
  if (!p) return null;
  if (p.fechaISO) {
    const t = Date.parse(p.fechaISO);
    if (!isNaN(t)) return new Date(t).toISOString();
  }
  const n = +p.id;
  if (n > 1e12) return new Date(n).toISOString();
  return null;
}

function rowFromProposal(p) {
  const fechaIso = fechaIsoFrom(p);
  const now = new Date().toISOString();
  return {
    id: String(p.id),
    data: p,
    ejecutivo: p.ejecutivo || null,
    fecha_iso: fechaIso,
    saved_at: fechaIso,
    updated_at: now,
    updated_by: p.ejecutivo || null,
    deleted: false
  };
}

async function sbFetch(path, opts) {
  const r = await fetch(REST + path, opts);
  const text = await r.text();
  if (!r.ok) throw new Error(text.slice(0, 220) || ('Supabase ' + r.status));
  return text ? JSON.parse(text) : null;
}

async function readStore() {
  const rows = await sbFetch(
    '?deleted=eq.false&select=data,updated_at&order=updated_at.desc&limit=500',
    { headers: sbHeaders(), cache: 'no-store' }
  );
  const list = Array.isArray(rows) ? rows : [];
  const proposals = list.map(row => row && row.data).filter(p => p && p.id != null);
  const updatedAt = list.reduce((max, row) => {
    const t = Date.parse(row && row.updated_at) || 0;
    return t > max ? t : max;
  }, 0);
  return { proposals, updatedAt };
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
      if (body.action === 'upsert' && body.proposal && body.proposal.id != null) {
        await sbFetch('', {
          method: 'POST',
          headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(rowFromProposal(body.proposal))
        });
      } else if (body.action === 'delete' && body.id != null) {
        await sbFetch('?id=eq.' + encodeURIComponent(String(body.id)), {
          method: 'PATCH',
          headers: sbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ deleted: true, updated_at: new Date().toISOString() })
        });
      } else {
        return res.status(400).json({ error: 'Solicitud inválida' });
      }
      const store = await readStore();
      return res.status(200).json({ ok: true, count: store.proposals.length });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'Error de sincronización' });
  }
}
