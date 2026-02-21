/**
 * Sendet eine Push-Benachrichtigung über ntfy wenn das Stundenlimit erreicht wird.
 * Nur 1× pro Limit-Fenster (bei justReached), nicht bei jeder blockierten Anfrage.
 */
async function notifyLimitReached({ ntfyUrl, ntfyTopic, adminSecret, count, limit }) {
  if (!ntfyUrl || !ntfyTopic) return;

  const baseUrl = "https://malzi.me";

  try {
    await fetch(ntfyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        topic: ntfyTopic,
        title: "malziME: Stundenlimit erreicht",
        message: `${count}/${limit} Analysen in dieser Stunde. Analyse deaktiviert.`,
        priority: 4,
        tags: ["warning"],
        actions: [
          {
            action: "http",
            label: "+100 Analysen",
            url: `${baseUrl}/api/admin/boost`,
            method: "POST",
            headers: { Authorization: `Bearer ${adminSecret}` },
          },
          {
            action: "http",
            label: "Reset",
            url: `${baseUrl}/api/admin/reset`,
            method: "POST",
            headers: { Authorization: `Bearer ${adminSecret}` },
          },
          {
            action: "view",
            label: "Stats",
            url: `${baseUrl}/stats`,
          },
        ],
      }),
    });
  } catch (err) {
    console.log(JSON.stringify({ warning: "ntfy-error", error: err.message }));
  }
}

module.exports = { notifyLimitReached };
