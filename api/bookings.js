const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

async function redis(cmd) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  return data.result;
}

function auth(req) {
  const t = req.headers['x-admin-token'] || req.query.token;
  return t === ADMIN_TOKEN;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all bookings
  if (req.method === 'GET') {
    const ids = (await redis(['LRANGE', 'rs:bookings', 0, 200])) || [];
    if (!ids.length) return res.status(200).json([]);
    const raws = await Promise.all(ids.map(id => redis(['GET', `rs:booking:${id}`])));
    const bookings = raws.map(r => { try { return r ? JSON.parse(r) : null; } catch { return null; } }).filter(Boolean);
    return res.status(200).json(bookings);
  }

  // PUT — update booking fields
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const raw = await redis(['GET', `rs:booking:${id}`]);
    if (!raw) return res.status(404).json({ error: 'Booking not found' });
    const booking = { ...JSON.parse(raw), ...updates, updatedAt: new Date().toISOString() };
    await redis(['SET', `rs:booking:${id}`, JSON.stringify(booking), 'EX', 7776000]);
    return res.status(200).json(booking);
  }

  // DELETE — remove booking
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await redis(['DEL', `rs:booking:${id}`]);
    await redis(['LREM', 'rs:bookings', 0, id]);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
