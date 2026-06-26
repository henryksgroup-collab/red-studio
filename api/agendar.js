const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, vehicle, date, time, services, obs } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const booking = {
    id,
    status: 'pendente',
    name: String(name).trim(),
    phone: String(phone).trim(),
    vehicle: String(vehicle || '').trim(),
    date: String(date || '').trim(),
    time: String(time || '').trim(),
    services: Array.isArray(services) ? services : (services ? [services] : []),
    obs: String(obs || '').trim(),
    price: '',
    note: '',
    createdAt: new Date().toISOString(),
  };

  await redis(['SET', `rs:booking:${id}`, JSON.stringify(booking), 'EX', 7776000]); // 90 days
  await redis(['LPUSH', 'rs:bookings', id]);

  return res.status(200).json({ success: true, id });
}
