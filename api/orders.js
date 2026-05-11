import fetch from 'node-fetch';

const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
const API_KEY = process.env.FOODTICKET_API_KEY;
const BASE_URL = process.env.FOODTICKET_API_URL || 'https://api.foodticket.net/1';

// Haal straatnamen op voor een batch van unieke postcodes via PDOK (1 request per postcode)
async function lookupPostcodes(postcodes) {
  const map = {};
  await Promise.all(postcodes.map(async (pc) => {
    const clean = pc.replace(/\s/g, '').toUpperCase();
    try {
      const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=postcode:${clean}&rows=1&fl=straatnaam,woonplaatsnaam`;
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      const doc = data?.response?.docs?.[0];
      if (doc?.straatnaam) map[clean] = { street: doc.straatnaam, city: doc.woonplaatsnaam || '' };
    } catch {}
  }));
  return map;
}

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
      streetnumber_raw: streetnumber,
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
    const response = await fetch(url, {
      headers: {
        'X-OrderBuddy-Client-Id': CLIENT_ID,
        'X-OrderBuddy-API-Key': API_KEY,
      },
    });
    const rawText = await response.text();

    let orders = [];
    try {
      const json = JSON.parse(rawText);
      orders = Array.isArray(json) ? json : (json.orders ?? json.data ?? []);
    } catch {
      orders = parseOrders(rawText);
    }

    // Unieke postcodes ophalen die gemaskeerd zijn
    const maskedPcs = [...new Set(
      orders
        .filter(o => o.zipcode && (!o.street_raw || o.street_raw.includes('*')))
        .map(o => o.zipcode.replace(/\s/g, '').toUpperCase())
    )];

    const pcMap = maskedPcs.length > 0 ? await lookupPostcodes(maskedPcs) : {};

    const enriched = orders.map(o => {
      const isMasked = !o.street_raw || o.street_raw.includes('*');
      if (isMasked && o.zipcode) {
        const clean = o.zipcode.replace(/\s/g, '').toUpperCase();
        const pdok = pcMap[clean];
        if (pdok) {
          return {
            ...o,
            street: pdok.street,
            city: pdok.city || o.city,
            address: `${pdok.street}, ${o.zipcode} ${pdok.city || o.city}`,
          };
        }
      }
      return o;
    });

    return res.status(200).json({
      success: true,
      date: today,
      total_orders: enriched.length,
      orders: enriched,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
