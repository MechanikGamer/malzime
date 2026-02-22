const { getStats, getMaintenanceStatus } = require("./counter");

async function handleStats(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const [data, maintenance] = await Promise.all([getStats(), getMaintenanceStatus()]);
  if (!data) {
    res.status(503).json({ error: "Stats unavailable" });
    return;
  }
  res.json({ ...data, maintenance });
}

module.exports = { handleStats };
