import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';
const POLL_INTERVAL = 5000; // ms

function normalizeDeliverer(d) {
  const coord = d.coord || null;
  const lat = coord ? parseFloat(coord.split(',')[0]) : null;
  const lng = coord ? parseFloat(coord.split(',')[1]) : null;
  const orders = parseInt(d.orders || 0);
  let status = 'idle';
  if (coord && orders > 0) status = 'delivering';
  else if (coord && orders === 0) status = 'returning';
  return {
    id: String(d.id || d.deliverer_id || ''),
    name: `${d.firstname || ''} ${d.lastname || ''}`.trim() || d.login || '',
    login: d.login || '',
    orders,
    color: d.orders_color || '#cccccc',
    coord,
    lat,
    lng,
    last_login: d.last_login || null,
    date_update: d.date_update || null,
    coord_update: d.coord_update || null,
    has_tracking_activated: d.has_tracking_activated,
    avg_interval: parseInt(d.avg_interval || 0),
    google_directions_mode: d.google_directions_mode || '',
    status
  };
}

async function fetchDeliverers() {
  const response = await fetch(`${BASE_URL}/deliverers?format=json`, {
    headers: {
      'X-OrderBuddy-Client-Id': CLIENT_ID,
      'X-OrderBuddy-API-Key': API_KEY
    }
  });
  const json = await response.json();
  const rows = Array.isArray(json) ? json : (json.rows || json.deliverers || []);
  return rows.map(normalizeDeliverer);
}

function sendEvent(res, eventName, data, id) {
  if (id !== undefined) res.write(`id: ${id}\n`);
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export const config = { maxDuration: 25 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let prevById = new Map();
  let eventId = 0;
  let closed = false;

  req.on('close', () => { closed = true; });

  // Stuur initieel snapshot
  try {
    const deliverers = await fetchDeliverers();
    deliverers.forEach(d => prevById.set(d.id, d));
    sendEvent(res, 'snapshot', { deliverers }, eventId++);
  } catch (err) {
    sendEvent(res, 'error', { message: err.message });
  }

  // Poll loop
  const loop = setInterval(async () => {
    if (closed) { clearInterval(loop); return; }
    try {
      // Heartbeat elke ronde
      res.write(`: heartbeat\n\n`);

      const deliverers = await fetchDeliverers();
      const updates = [];

      deliverers.forEach(d => {
        const prev = prevById.get(d.id);
        if (!prev) {
          updates.push({ type: 'added', deliverer: d });
        } else {
          const changed =
            prev.orders !== d.orders ||
            prev.status !== d.status ||
            prev.coord !== d.coord ||
            prev.date_update !== d.date_update ||
            prev.coord_update !== d.coord_update;
          if (changed) updates.push({ type: 'updated', deliverer: d });
        }
        prevById.set(d.id, d);
      });

      if (updates.length > 0) {
        sendEvent(res, 'deliverers-update', { updates }, eventId++);
      }
    } catch (err) {
      if (!closed) sendEvent(res, 'error', { message: err.message });
    }
  }, POLL_INTERVAL);

  // Sluit na max 24s (Vercel timeout buffer)
  setTimeout(() => {
    if (!closed) {
      clearInterval(loop);
      sendEvent(res, 'reconnect', { message: 'Reconnect please' });
      res.end();
    }
  }, 24000);
}
