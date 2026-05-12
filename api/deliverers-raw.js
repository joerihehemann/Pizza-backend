import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch(`${BASE_URL}/deliverers?format=json`, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY
      }
    });
    const raw = await response.text();
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(raw);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
