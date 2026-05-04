import fetch from "node-fetch";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
  const API_KEY   = process.env.FOODTICKET_API_KEY;

  if (!CLIENT_ID || !API_KEY) {
    return res.status(500).json({ error: "Missing Foodticket credentials in environment variables" });
  }

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const response = await fetch(
      `https://api.foodticket.nl/v2/orders?client_id=${CLIENT_ID}&date=${today}`,
      {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "Foodticket API fout", details: errText });
    }

    const data = await response.json();

    // Return simplified order count + list
    return res.status(200).json({
      success: true,
      date: today,
      total_orders: data?.total || data?.length || (Array.isArray(data) ? data.length : 0),
      orders: Array.isArray(data) ? data.slice(0, 50) : data?.orders?.slice(0, 50) || [],
    });

  } catch (err) {
    return res.status(500).json({ error: "Verbindingsfout", message: err.message });
  }
}
