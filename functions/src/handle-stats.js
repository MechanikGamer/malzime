const { getStats } = require("./counter");

async function handleStats(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const data = await getStats();
  if (!data) {
    res.status(503).json({ error: "Stats unavailable" });
    return;
  }
  res.json(data);
}

module.exports = { handleStats };
