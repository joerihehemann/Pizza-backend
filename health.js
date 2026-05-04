export default function handler(req, res) {
  const CLIENT_ID = process.env.FOODTICKET_CLIENT_ID;
  const API_KEY   = process.env.FOODTICKET_API_KEY;
  res.status(200).json({
    status: "ok",
    foodticket_client_id: CLIENT_ID ? `${CLIENT_ID} ✓` : "MISSING ✗",
    foodticket_api_key: API_KEY ? `${API_KEY.slice(0,6)}... ✓` : "MISSING ✗",
    timestamp: new Date().toISOString(),
  });
}
