import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';

// Strict tag match: <tag> or <tag > but NOT <tag_something>
function xmlTag(tag, str) {
  const m = str.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tag}>`, 'i'));
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

  try {
    const response = await fetch(`${BASE_URL}/deliverers`, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY,
      }
    });
    const rawText = await response.text();

    if (req.query.debug) {
      return res.status(200).json({ raw: rawText.slice(0, 2000) });
    }

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
