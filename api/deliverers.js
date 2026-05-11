import fetch from 'node-fetch';

function xml(tag, str) {
  const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function parseDeliverers(xmlStr) {
  const matches = [...xmlStr.matchAll(/<deliverer[\s\S]*?<\/deliverer>/gi)];
  return matches.map(m => {
    const o = m[0];
    return {
      id: xml('id', o),
      name: xml('name', o) || [xml('firstname', o), xml('lastname', o)].filter(Boolean).join(' '),
      firstname: xml('firstname', o),
      lastname: xml('lastname', o),
      phone: xml('phone', o),
      active: xml('active', o),
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
  const API_KEY = process.env.FOODTICKET_API_KEY;

  if (!CLIENT_ID || !API_KEY) {
    return res.status(500).json({ error: 'Missing Foodticket credentials' });
  }

  try {
    const response = await fetch(`https://api.foodticket.net/1/deliverers`, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY,
      },
    });

    const rawText = await response.text();

    // Try JSON first
    let deliverers = [];
    try {
      const json = JSON.parse(rawText);
      deliverers = Array.isArray(json) ? json : (json.deliverers ?? json.data ?? []);
    } catch {
      // Try XML
      deliverers = parseDeliverers(rawText);
      // If no XML deliverers found, return raw for debug
      if (deliverers.length === 0) {
        return res.status(200).json({
          success: false,
          raw: rawText.slice(0, 800),
        });
      }
    }

    return res.status(200).json({
      success: true,
      total: deliverers.length,
      deliverers,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verbindingsfout', message: err.message });
  }
}
