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
    const url = `https://api.foodticket.net/1/orders?sdate_start=${today}&sdate_end=${today}`;

    const response = await fetch(url, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY,
        'Accept': 'application/json',
      },
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(200).json({
        success: false,
        error: 'Foodticket API gaf geen JSON terug',
        status: response.status,
        raw: rawText.slice(0, 500),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Foodticket API fout', details: data });
    }

    const orders = Array.isArray(data) ? data : (data?.orders ?? data?.data ?? []);

    return res.status(200).json({
      success: true,
      date: today,
      total_orders: data?.total ?? orders.length,
      orders: orders.slice(0, 50),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verbindingsfout', message: err.message });
  }
}
