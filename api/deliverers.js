import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch(`${BASE_URL}/deliverers?format=json`, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY
      }
    });
    const raw = await response.text();

    let deliverers = [];
    try {
      const json = JSON.parse(raw);
      const rows = Array.isArray(json) ? json : (json.rows || json.deliverers || []);
      deliverers = rows.map(d => ({
        id: String(d.id || d.deliverer_id || ''),
        name: d.name || `${d.firstname || ''} ${d.lastname || ''}`.trim(),
        firstname: d.firstname || '',
        tel: d.tel || d.phone || '',
        orders: parseInt(d.orders || 0),
        color: d.orders_color || d.color || '#cccccc',
        // GPS data
        coord: d.coord || null,
        lat: d.coord ? parseFloat(d.coord.split(',')[0]) : null,
        lng: d.coord ? parseFloat(d.coord.split(',')[1]) : null,
        // Status info
        last_ip: d.last_ip || '',
        avg_n: parseInt(d.avg_n || 0), // gemiddelde bezorgtijd in seconden
        last_login: d.last_login || '',
        date_update: d.date_update || '',
        company: d.company || '',
        push: d.push || null,
        avg_interval: parseInt(d.avg_interval || 0),
        // Determine status based on orders count and coord
        status: d.coord ? (parseInt(d.orders || 0) > 0 ? 'delivering' : 'returning') : 'idle'
      }));
    } catch (_) {
      // XML fallback
      function xmlTag(tag, str) {
        const m = str.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return m ? m[1].trim() : '';
      }
      const matches = [...raw.matchAll(/<row[\s\S]*?<\/row>/gi)];
      deliverers = matches.map(m => {
        const o = m[0];
        const coord = xmlTag('coord', o);
        const orders = parseInt(xmlTag('orders', o) || 0);
        return {
          id: xmlTag('id', o),
          name: xmlTag('name', o),
          firstname: xmlTag('firstname', o),
          tel: xmlTag('tel', o),
          orders,
          color: xmlTag('orders_color', o) || '#cccccc',
          coord: coord || null,
          lat: coord ? parseFloat(coord.split(',')[0]) : null,
          lng: coord ? parseFloat(coord.split(',')[1]) : null,
          last_ip: xmlTag('last_ip', o),
          avg_n: parseInt(xmlTag('avg_n', o) || 0),
          last_login: xmlTag('last_login', o),
          date_update: xmlTag('date_update', o),
          company: xmlTag('company', o),
          avg_interval: parseInt(xmlTag('avg_interval', o) || 0),
          status: coord ? (orders > 0 ? 'delivering' : 'returning') : 'idle'
        };
      });
    }

    return res.status(200).json({ success: true, total: deliverers.length, deliverers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
