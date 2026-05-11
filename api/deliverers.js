import fetch from 'node-fetch';

function xmlTag(tag, str) {
  const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function parseDeliverers(xmlStr) {
  const matches = [...xmlStr.matchAll(/<row[\s\S]*?<\/row>/gi)];
  return matches.map(m => {
    const o = m[0];
    const first = xmlTag('firstname', o);
    const last = xmlTag('lastname', o);
    return {
      id: xmlTag('id', o),
      name: [first, last].filter(Boolean).join(' ') || xmlTag('login', o),
      firstname: first,
      lastname: last,
      login: xmlTag('login', o),
      tel: xmlTag('tel', o),
      orders: xmlTag('orders', o),
      color: xmlTag('orders_color', o),
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const base = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';
  const user = process.env.FOODTICKET_USERNAME;
  const pass = process.env.FOODTICKET_PASSWORD;
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');

  try {
    const response = await fetch(`${base}/deliverers`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json, text/xml, */*',
      }
    });
    const rawText = await response.text();

    // Try JSON first
    let deliverers = [];
    try {
      const json = JSON.parse(rawText);
      deliverers = Array.isArray(json) ? json : (json.deliverers ?? json.data ?? []);
    } catch {
      deliverers = parseDeliverers(rawText);
    }

    return res.status(200).json({
      success: true,
      total: deliverers.length,
      deliverers,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
