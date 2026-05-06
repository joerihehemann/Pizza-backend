import fetch from 'node-fetch';

// Helper: parse XML tag value
function xml(tag, str) {
  const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

// Helper: extract all <order> blocks
function parseOrders(xmlStr) {
  const matches = [...xmlStr.matchAll(/<order[\s\S]*?<\/order>/gi)];
  return matches.map(m => {
    const o = m[0];
    return {
      id: xml('id', o),
      date: xml('date', o),
      status: xml('status', o) || xml('orderstatus', o),
      firstname: xml('firstname', o),
      lastname: xml('lastname', o),
      street: xml('street', o),
      streetnumber: xml('streetnumber', o),
      zipcode: xml('zipcode', o),
      city: xml('city', o),
      delivery_type: xml('delivery_type', o) || xml('ordertype', o),
      total_price: xml('total_price', o) || xml('price', o) || xml('total', o),
      phone: xml('phone', o),
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
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://api.foodticket.net/1/orders?sdate_start=${today}&sdate_end=${today}`;

    const response = await fetch(url, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY,
      },
    });

    const rawText = await response.text();

    // Parse XML orders
    const orders = parseOrders(rawText);
    const total = rawText.match(/<total>(\d+)<\/total>/);

    return res.status(200).json({
      success: true,
      date: today,
      total_orders: total ? parseInt(total[1]) : orders.length,
      orders: orders.slice(0, 50),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verbindingsfout', message: err.message });
  }
}
