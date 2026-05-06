import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
  const API_KEY = process.env.FOODTICKET_API_KEY;

  if (!CLIENT_ID || !API_KEY) {
    return res.status(500).json({ error: 'Missing Foodticket credentials in environment variables' });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://api.foodticket.nl/v2/orders?client_id=${CLIENT_ID}&date=${today}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const rawText = await response.text();

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Return raw response for debugging if not JSON
      return res.status(200).json({
        success: false,
        error: 'Foodticket API gaf geen JSON terug',
        status: response.status,
        url: url,
        raw: rawText.slice(0, 500),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Foodticket API fout', details: data });
    }

    return res.status(200).json({
      success: true,
      date: today,
      total_orders: data?.total ?? data?.length ?? (Array.isArray(data) ? data.length : 0),
      orders: Array.isArray(data) ? data.slice(0, 50) : data?.orders?.slice(0, 50) ?? data?.data?.slice(0, 50),
      raw_keys: typeof data === 'object' ? Object.keys(data) : [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verbindingsfout', message: err.message });
  }
}
