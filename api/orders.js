import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';

function xml(tag, str) {
  const m = str.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function parseOrders(xmlStr) {
  const matches = [...xmlStr.matchAll(/<order[\s\S]*?<\/order>/gi)];
  return matches.map(m => {
    const o = m[0];
    const street = xml('street', o);
    const streetnumber = xml('streetnumber', o);
    const zipcode = xml('zipcode', o);
    const city = xml('city', o);
    const address = [street, streetnumber, zipcode, city].filter(Boolean).join(' ') || '';
    const rawDate = xml('date', o);
    return {
      id: xml('id', o),
      date: rawDate ? rawDate.replace(' ', 'T') : '',
      status: xml('status', o) || xml('orderstatus', o),
      firstname: xml('firstname', o),
      lastname: xml('lastname', o),
      address,
      zipcode,
      city,
      street_raw: street,
      delivery_type: xml('delivery_type', o) || xml('ordertype', o),
      total_price: xml('total_price', o) || xml('price', o) || xml('total', o),
      phone: xml('phone', o),
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date().toISOString().slice(0, 10);
  const url = `${BASE_URL}/orders?date=${today}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let rawText;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'X-OrderBuddy-Client-Id': CLIENT_ID,
          'X-OrderBuddy-API-Key': API_KEY,
        },
      });
      rawText = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    let orders = [];
    try {
      const json = JSON.parse(rawText);
      orders = Array.isArray(json) ? json : (json.orders ?? json.data ?? []);
    } catch {
      orders = parseOrders(rawText);
    }

    return res.status(200).json({
      success: true,
      date: today,
      total_orders: orders.length,
      orders,
    });
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Foodticket API timeout' : err.message;
    return res.status(500).json({ success: false, error: msg });
  }
}
