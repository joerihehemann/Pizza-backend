import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const start = Date.now();

  try {
    // Use correct API params: sdate_start/sdate_end and format=json for fast JSON response
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const url = `${BASE_URL}/orders?sdate_start=${today}&sdate_end=${today}&format=json&perpage=100&page=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const elapsed = Date.now() - start;
    const raw = await response.text();

    // Try JSON parse first (format=json requested)
    let orders = [];
    try {
      const json = JSON.parse(raw);
      // OrderBuddy JSON wraps in { rows: [...] } or returns array
      const rows = Array.isArray(json) ? json : (json.rows || json.orders || json.data || []);
      orders = rows.map(o => ({
        id: o.id || o.order_id || '',
        street: o.street || o.streetname || '',
        streetnumber: o.streetnumber || o.street_number || o.housenumber || '',
        zipcode: o.zipcode || o.zip || o.postcode || '',
        city: o.city || '',
        address: [o.street || o.streetname || '', o.streetnumber || o.street_number || '', o.zipcode || o.zip || '', o.city || ''].filter(Boolean).join(' '),
        name: `${o.firstname || o.first_name || ''} ${o.lastname || o.last_name || ''}`.trim(),
        phone: o.phone || o.telephone || o.tel || '',
        total: parseFloat(o.total || o.total_price || o.price || 0),
        status: o.status || o.status_id || '',
        date: o.date || o.date_create || o.created_at || '',
        deliverer: o.deliverer || o.deliverer_id || o.driver || '',
        payment_method: o.payment_method || o.paymentmethod || '',
        type: o.type || o.order_type || ''
      }));
    } catch (_) {
      // Fallback: XML parsing
      function xmlVal(tag, str) {
        const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return m ? m[1].trim() : '';
      }
      const matches = [...raw.matchAll(/<order[\s\S]*?<\/order>/gi)];
      orders = matches.map(m => {
        const o = m[0];
        const street = xmlVal('street', o);
        const streetnumber = xmlVal('streetnumber', o);
        const zipcode = xmlVal('zipcode', o);
        const city = xmlVal('city', o);
        return {
          id: xmlVal('id', o),
          street,
          streetnumber,
          zipcode,
          city,
          address: [street, streetnumber, zipcode, city].filter(Boolean).join(' ') || xmlVal('address', o),
          name: `${xmlVal('firstname', o)} ${xmlVal('lastname', o)}`.trim(),
          phone: xmlVal('phone', o) || xmlVal('telephone', o),
          total: parseFloat(xmlVal('total', o) || xmlVal('total_price', o) || '0'),
          status: xmlVal('status', o),
          date: xmlVal('date', o) || xmlVal('date_create', o),
          deliverer: xmlVal('deliverer', o) || xmlVal('deliverer_id', o),
          payment_method: xmlVal('payment_method', o),
          type: xmlVal('type', o)
        };
      });
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      elapsed_ms: Date.now() - start,
      orders
    });

  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err.name === 'AbortError'
      ? `Foodticket API timeout after ${elapsed}ms`
      : err.message;
    return res.status(500).json({ success: false, error: msg, elapsed_ms: elapsed });
  }
}
