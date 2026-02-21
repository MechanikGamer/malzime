const { createAdminToken } = require("./auth");

/**
 * Sendet eine Push-Benachrichtigung über ntfy wenn das Stundenlimit erreicht wird.
 * Nur 1× pro Limit-Fenster (bei justReached), nicht bei jeder blockierten Anfrage.
 */
async function notifyLimitReached({ ntfyUrl, ntfyTopic, adminSecret, count, limit }) {
  if (!ntfyUrl || !ntfyTopic) return;

  const baseUrl = "https://malzi.me";

  try {
    const boostToken = createAdminToken("boost", adminSecret);
    const resetToken = createAdminToken("reset", adminSecret);

    const res = await fetch(ntfyUrl, {
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
            action: "view",
            label: "+100 Analysen",
            url: `${baseUrl}/api/admin/boost?hmac=${encodeURIComponent(boostToken)}`,
          },
          {
            action: "view",
            label: "Reset",
            url: `${baseUrl}/api/admin/reset?hmac=${encodeURIComponent(resetToken)}`,
          },
          {
            action: "view",
            label: "Stats",
            url: `${baseUrl}/stats`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(JSON.stringify({ warning: "ntfy-failed", status: res.status, body }));
    }
  } catch (err) {
    console.log(JSON.stringify({ warning: "ntfy-error", error: err.message }));
  }
}

module.exports = { notifyLimitReached };
