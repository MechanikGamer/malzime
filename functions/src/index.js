const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");

const { defineSecret } = require("firebase-functions/params");

const { ALLOWED_MIME, MAX_UPLOAD_BYTES, REQUEST_BUDGET_MS } = require("./config");
const { demoData } = require("./demo-data");
const { getClientIp, checkRateLimit } = require("./middleware");
const { parseMultipart, parseJsonBody } = require("./upload");
const { analyzeWithVision } = require("./vision");
const { buildPrivacyRisks } = require("./privacy");
const { describeImage, buildDescriptionFromLabels, generateBothProfiles, isQuotaError } = require("./gemini");
const { classifyLabels, buildAnimalProfiles, AGE_LABELS } = require("./animal");
const { resolveLanguage, loadPrompts } = require("./i18n");
const { checkAndIncrement, incrementTotals, getStats, boostLimit, resetCounter } = require("./counter");
const { notifyLimitReached } = require("./notify");
const { verifyAdminToken, createNonce, verifyNonce } = require("./auth");

const adminSecret = defineSecret("ADMIN_SECRET");
const ntfyUrl = defineSecret("NTFY_URL");
const ntfyTopic = defineSecret("NTFY_TOPIC");

initializeApp();

exports.analyze = onRequest(
  {
    region: "europe-west1",
    memory: "512MiB",
    concurrency: 20,
    cors: ["https://malzi.me", "https://www.malzi.me", "https://malzime.web.app", "https://malzime.firebaseapp.com"],
    invoker: "public",
    maxInstances: 10,
    timeoutSeconds: 120,
    secrets: [ntfyUrl, ntfyTopic, adminSecret],
  },
  async (req, res) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    const requestStart = Date.now();
    const remainingBudget = () => Math.max(0, REQUEST_BUDGET_MS - (Date.now() - requestStart));
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const ip = getClientIp(req);
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: "Rate limit exceeded" });
        return;
      }

      /* SEC-003: Server-seitige Bot-Heuristik — CORS schützt nicht gegen curl/Bots.
         Requests ohne Origin/Referer von einer erlaubten Domain loggen.
         Nicht blockieren (Rate Limit ist die primäre Defense), nur observieren. */
      const origin = req.headers["origin"] || "";
      const referer = req.headers["referer"] || "";
      const allowedOrigins = [
        "https://malzi.me",
        "https://www.malzi.me",
        "https://malzime.web.app",
        "https://malzime.firebaseapp.com",
      ];
      const hasValidOrigin = allowedOrigins.some((o) => origin.startsWith(o) || referer.startsWith(o));
      if (!hasValidOrigin) {
        /* SEC-007: Keine IP in App-Logs (Datenschutztext verspricht das) */
        /* SEC-008: Nur requestId + warning — Datenschutztext verspricht
           "nur Request-ID und Status" in eigenen App-Logs */
        console.log(JSON.stringify({ requestId, warning: "no-browser-origin" }));
      }

      let demoImageId = "";
      let file = null;
      let multipartFields = null;

      const jsonBody = parseJsonBody(req);
      if (jsonBody) {
        demoImageId = jsonBody.demoImageId || "";
        if (jsonBody.imageBase64) {
          const b64Str = String(jsonBody.imageBase64);
          /* BUG-010: Offensichtlich ungültiges Base64 früh abweisen — spart teure API-Calls */
          if (/[^A-Za-z0-9+/=\s]/.test(b64Str.slice(0, 256))) {
            res.status(400).json({ error: "Invalid image data" });
            return;
          }
          const estimatedBytes = Math.ceil((b64Str.length * 3) / 4);
          if (estimatedBytes > MAX_UPLOAD_BYTES) {
            res.status(413).json({ error: "File too large" });
            return;
          }
          const buffer = Buffer.from(b64Str, "base64");
          file = {
            buffer,
            mimeType: jsonBody.mimeType || "image/jpeg",
            filename: jsonBody.filename || "upload.jpg",
            size: buffer.length,
          };
          if (jsonBody.exif && typeof jsonBody.exif === "object") {
            /* SEC-006: Nur erlaubte Keys durchlassen, Typ + Länge validieren
               SEC-002: dateTimeOriginal wird nicht mehr akzeptiert — bleibt im Browser */
            const raw = jsonBody.exif;
            const safe = {};
            if (typeof raw.make === "string") safe.make = raw.make.slice(0, 100);
            if (typeof raw.model === "string") safe.model = raw.model.slice(0, 100);
            file.clientExif = safe;
          }
        }
      } else {
        const parsed = await parseMultipart(req);
        file = parsed.file;
        multipartFields = parsed.fields;
        demoImageId = multipartFields.demoImageId || "";
      }

      /* i18n: Sprache aus Request auflösen */
      const requestedLang = (jsonBody && jsonBody.lang) || (multipartFields && multipartFields.lang) || "";
      const lang = resolveLanguage(requestedLang);

      /* BUG-004: Honeypot-Check für JSON und Multipart */
      const hpValue = (jsonBody && jsonBody.website) || (multipartFields && multipartFields.website) || "";
      if (hpValue) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      /* ── Demo-Pfad ── */
      if (demoImageId && demoData[demoImageId]) {
        const demo = demoData[demoImageId];
        const exif = demo.exif || {};
        const privacyRisks = buildPrivacyRisks({ ocrText: demo.ocrText || "", exif, labels: demo.labels || [] });
        const np = demo.normalProfile;
        const bp = demo.boostProfile || np;

        res.json({
          profiles: {
            normal: {
              categories: np.categories,
              ad_targeting: np.ad_targeting,
              manipulation_triggers: np.manipulation_triggers,
              profileText: np.profileText,
            },
            boost: {
              categories: bp.categories,
              ad_targeting: bp.ad_targeting,
              manipulation_triggers: bp.manipulation_triggers,
              profileText: bp.profileText,
            },
          },
          privacyRisks,
          exif,
          meta: { requestId, mode: "demo", demoId: demoImageId },
        });
        return;
      }

      /* ── Validierung ── */
      if (!file || !file.buffer) {
        res.status(400).json({ error: "Missing image" });
        return;
      }
      if (!file.mimeType || !ALLOWED_MIME.includes(file.mimeType)) {
        res.status(400).json({ error: "Invalid file type. Allowed: JPEG, PNG, WEBP, GIF" });
        return;
      }

      /* SEC-009: Magic-Byte-Check — Client-MIME gegen tatsächlichen File-Content validieren */
      const magic = file.buffer.slice(0, 4);
      const magicHex = magic.toString("hex");
      const isJpeg = magic[0] === 0xff && magic[1] === 0xd8;
      const isPng = magicHex.startsWith("89504e47");
      const isWebp =
        magic.toString("ascii", 0, 4) === "RIFF" &&
        file.buffer.length > 11 &&
        file.buffer.toString("ascii", 8, 12) === "WEBP";
      const isGif = magicHex.startsWith("47494638");
      if (!isJpeg && !isPng && !isWebp && !isGif) {
        res.status(400).json({ error: "Invalid image data" });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        res.status(413).json({ error: "File too large" });
        return;
      }

      /* ── Globales Stundenlimit (Firestore-Zähler) ──
         Erst NACH Honeypot/Demo/Validierung zählen, damit ungültige Requests
         nicht das Budget aufbrauchen (BUG-001). */
      const counterResult = await checkAndIncrement();

      /* ntfy-Push beim erstmaligen Erreichen des Limits */
      if (counterResult.justReached) {
        notifyLimitReached({
          ntfyUrl: ntfyUrl.value(),
          ntfyTopic: ntfyTopic.value(),
          adminSecret: adminSecret.value(),
          count: counterResult.count,
          limit: counterResult.limit,
        }).catch(() => {});
      }

      if (!counterResult.allowed) {
        res.status(429).json({
          blocked: "limit",
          retryAfterSeconds: counterResult.retryAfterSeconds,
          message: "Stundenlimit erreicht",
        });
        return;
      }

      const imageBuffer = file.buffer;

      /* ── Vision API ── */
      const visionResult = await analyzeWithVision(imageBuffer, remainingBudget());

      /* ── Personen-/Tier-Check (VOR Label-Filterung) ── */
      const { hasPerson, hasAnimal, rawLabelsLower } = classifyLabels(visionResult.labels);

      /* Alters-Labels filtern (unzuverlässig, vergiften Profilgenerierung) */
      visionResult.labels = visionResult.labels.filter((l) => !AGE_LABELS.includes(l.toLowerCase()));

      /* EXIF kommt vom Client (ohne GPS — GPS bleibt im Browser) */
      const exif = file.clientExif || {};

      const privacyRisks = buildPrivacyRisks({
        ocrText: visionResult.ocrText,
        exif,
        labels: visionResult.labels,
      });

      /* Tier-Check: Wenn NUR Tier-Labels und keine Personen-Labels → Easter-Egg-Profil */
      if (!hasPerson && hasAnimal) {
        const { normalProfile, boostProfile } = buildAnimalProfiles(rawLabelsLower, lang);

        /* BUG-007: Privacy-Risks und EXIF auch bei Tier-Fotos durchreichen —
           ein sichtbares Nummernschild im Hintergrund soll trotzdem gemeldet werden */
        incrementTotals().catch(() => {});
        res.json({
          profiles: { normal: normalProfile, boost: boostProfile },
          privacyRisks,
          exif,
          meta: { requestId, mode: "animal" },
        });
        console.log(JSON.stringify({ requestId, status: "ok", mode: "animal" }));
        return;
      }

      /* ── Bildbeschreibung via Gemini ── */
      let imageDescription = null;
      let describeBlocked = false;
      let describeError = false;
      let quotaError = false;
      try {
        imageDescription = await describeImage(imageBuffer, file.mimeType, remainingBudget, lang);
        if (!imageDescription) describeBlocked = true;
        console.log(
          JSON.stringify({
            requestId,
            step: "describe",
            status: imageDescription ? "ok" : "blocked",
            length: imageDescription?.length || 0,
          })
        );
      } catch (err) {
        if (isQuotaError(err)) quotaError = true;
        describeError = true;
        console.log(JSON.stringify({ requestId, warning: "Image description failed", error: err.message }));
      }

      /* ── Fallback: Vision-API-Labels ── */
      let usedFallback = false;
      if (!imageDescription) {
        imageDescription = buildDescriptionFromLabels(visionResult, exif, lang);
        /* Wenn der Safety-Filter die Bildbeschreibung geblockt hat, ist fast immer
         ein Kind oder Jugendlicher im Bild. Dieses Signal an die Profilgenerierung
         weitergeben, damit sie nicht blind "Erwachsener" annimmt. */
        if (describeBlocked && imageDescription) {
          imageDescription += loadPrompts(lang).blockedImageHint;
        }
        if (imageDescription) {
          usedFallback = true;
          console.log(
            JSON.stringify({
              requestId,
              step: "describe-fallback",
              status: "using-labels",
              length: imageDescription.length,
            })
          );
        }
      }

      /* ── Profile generieren ── */
      let profiles = { normal: null, boost: null };
      let profileBlocked = false;
      if (imageDescription) {
        try {
          profiles = await generateBothProfiles(
            imageDescription,
            visionResult.labels,
            exif,
            privacyRisks,
            remainingBudget,
            lang
          );
          profileBlocked = !profiles.normal && !profiles.boost;
          console.log(
            JSON.stringify({ requestId, step: "profiles", normal: !!profiles.normal, boost: !!profiles.boost })
          );
        } catch (err) {
          if (isQuotaError(err)) quotaError = true;
          profileBlocked = true;
          console.log(JSON.stringify({ requestId, warning: "Profile generation failed", error: err.message }));
        }
      }

      /* ── Response ── */
      const hasCategories = (obj) => obj && obj.categories && Object.keys(obj.categories).length > 0;
      const hasAnyProfile = hasCategories(profiles.normal) || hasCategories(profiles.boost);

      if (hasAnyProfile) {
        incrementTotals().catch(() => {});
        const normalData = profiles.normal || {};
        const boostData = profiles.boost || {};
        res.json({
          profiles: {
            normal: {
              categories: normalData.categories || {},
              ad_targeting: normalData.ad_targeting || [],
              manipulation_triggers: normalData.manipulation_triggers || [],
              profileText: normalData.profileText || "",
            },
            boost: {
              categories: boostData.categories || {},
              ad_targeting: boostData.ad_targeting || [],
              manipulation_triggers: boostData.manipulation_triggers || [],
              profileText: boostData.profileText || "",
            },
          },
          privacyRisks,
          exif,
          meta: { requestId, mode: "multimodal" },
        });
      } else {
        let blockedReason;
        if (quotaError) {
          blockedReason = "blocked.overloaded";
        } else if (describeBlocked && !usedFallback) {
          blockedReason = "blocked.safetyFilter";
        } else if (describeBlocked && usedFallback && profileBlocked) {
          blockedReason = "blocked.safetyFilterFallback";
        } else if (describeError) {
          blockedReason = "blocked.apiError";
        } else if (profileBlocked) {
          blockedReason = "blocked.profileBlocked";
        } else if (!imageDescription) {
          blockedReason = "blocked.noContent";
        } else {
          blockedReason = "blocked.generic";
        }

        res.json({
          profiles: null,
          blockedReason,
          privacyRisks,
          exif,
          meta: {
            requestId,
            mode: "blocked",
            reason: describeBlocked
              ? "safety_filter"
              : describeError
                ? "api_error"
                : profileBlocked
                  ? "profile_blocked"
                  : "no_content",
          },
        });
      }

      console.log(JSON.stringify({ requestId, status: "ok" }));
    } catch (err) {
      const status = err.status || 500;
      const code = err.code || "unknown_error";
      console.log(JSON.stringify({ requestId, status: "error", code }));
      res.status(status).json({ error: "Analyze failed", code });
    }
  }
);

/* ── Stats-Endpunkt (öffentlich) ── */
exports.stats = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    cors: ["https://malzi.me", "https://www.malzi.me", "https://malzime.web.app", "https://malzime.firebaseapp.com"],
    invoker: "public",
    maxInstances: 5,
  },
  async (req, res) => {
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
);

/* ── Admin-Endpunkte (nur mit ADMIN_SECRET) ── */

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const ADMIN_PAGE_STYLE = `*,*::before,*::after{box-sizing:border-box;margin:0}
body{font-family:'Inter',system-ui,sans-serif;background:#0a0c10;color:#c8cdd8;
  display:flex;align-items:center;justify-content:center;min-height:100vh;
  position:relative;overflow:hidden}
body::before{content:'';position:fixed;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.015) 2px,rgba(255,255,255,.015) 4px);
  pointer-events:none;z-index:1}
.card{text-align:center;padding:2.5rem 3rem;background:#161921;border:1px solid #1e222d;
  border-radius:12px;position:relative;z-index:2;max-width:400px;width:90%}
.icon{width:64px;height:64px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;
  font-size:1.75rem}
.icon--warn{background:rgba(251,191,36,.12);color:#fbbf24}
.icon--ok{background:rgba(74,222,128,.12);color:#4ade80}
.title{font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:#e8ecf4;margin-bottom:.5rem}
.msg{color:#9ca3af;font-size:.9rem;line-height:1.5;margin-bottom:1.25rem}
.btn{display:inline-block;padding:.6rem 1.5rem;background:rgba(56,189,248,.1);
  border:1px solid rgba(56,189,248,.25);border-radius:6px;color:#38bdf8;
  font-size:.9rem;cursor:pointer;transition:background .2s;font-family:inherit}
.btn:hover{background:rgba(56,189,248,.2)}
.link{display:inline-block;padding:.5rem 1.25rem;background:rgba(56,189,248,.1);
  border:1px solid rgba(56,189,248,.25);border-radius:6px;color:#38bdf8;
  text-decoration:none;font-size:.85rem;transition:background .2s}
.link:hover{background:rgba(56,189,248,.2)}
.redirect{color:#6b7280;font-size:.75rem;margin-top:1rem}
.cancel{color:#6b7280;font-size:.8rem;margin-top:.75rem}
.cancel a{color:#9ca3af;text-decoration:none}
.cancel a:hover{color:#e8ecf4}`;

/**
 * SEC-001: Bestaetigungsseite — zeigt Warnung + POST-Formular mit Nonce.
 * Wird bei GET+HMAC angezeigt, fuehrt KEINE Mutation aus.
 */
function adminConfirmPage(action, title, message, nonce) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeAction = escapeHtml(action);
  const safeNonce = escapeHtml(nonce);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} — malziME</title>
<style>${ADMIN_PAGE_STYLE}</style></head>
<body>
<div class="card">
  <div class="icon icon--warn">&#9888;</div>
  <div class="title">${safeTitle}</div>
  <p class="msg">${safeMessage}</p>
  <form method="POST" action="/${safeAction}">
    <input type="hidden" name="nonce" value="${safeNonce}">
    <button type="submit" class="btn">Bestaetigen</button>
  </form>
  <p class="cancel"><a href="/stats">&larr; Abbrechen</a></p>
</div>
</body></html>`;
}

/**
 * Erfolgsseite — wird nach erfolgreicher Mutation angezeigt.
 */
function adminSuccessPage(title, message) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} — malziME</title><meta http-equiv="refresh" content="3;url=/stats">
<style>${ADMIN_PAGE_STYLE}</style></head>
<body>
<div class="card">
  <div class="icon icon--ok">&#10003;</div>
  <div class="title">${safeTitle}</div>
  <p class="msg">${safeMessage}</p>
  <a href="/stats" class="link">Stats ansehen &rarr;</a>
  <p class="redirect">Automatische Weiterleitung in 3 Sekunden&hellip;</p>
</div>
</body></html>`;
}

exports.admin = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    cors: ["https://malzi.me", "https://www.malzi.me", "https://malzime.web.app", "https://malzime.firebaseapp.com"],
    invoker: "public",
    maxInstances: 2,
    secrets: [adminSecret],
  },
  async (req, res) => {
    const path = req.path || "";
    const action = path.includes("boost") ? "boost" : path.includes("reset") ? "reset" : "";

    /* Auth: Bearer (POST), HMAC (GET → Bestaetigungsseite), oder Nonce (POST → Mutation) */
    const auth = req.headers["authorization"] || "";
    const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const hmacToken = req.query.hmac || "";
    const nonceToken = (req.body && req.body.nonce) || "";

    const isBearerAuth = bearerToken && bearerToken === adminSecret.value();
    const isHmacAuth = hmacToken && action && verifyAdminToken(hmacToken, action, adminSecret.value());
    const isNonceAuth =
      nonceToken && action && req.method === "POST" && verifyNonce(nonceToken, action, adminSecret.value());

    if (!isBearerAuth && !isHmacAuth && !isNonceAuth) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      /* SEC-001: GET+HMAC → Bestaetigungsseite (KEINE Mutation) */
      if (isHmacAuth && req.method === "GET") {
        const nonce = createNonce(action, adminSecret.value());
        if (action === "boost") {
          res
            .type("html")
            .send(adminConfirmPage("boost", "Boost bestaetigen", "Limit um 100 Analysen erhoehen?", nonce));
        } else if (action === "reset") {
          res
            .type("html")
            .send(adminConfirmPage("reset", "Reset bestaetigen", "Stundenzaehler komplett zuruecksetzen?", nonce));
        } else {
          res.status(404).json({ error: "Unknown action" });
        }
        return;
      }

      /* Mutation ausfuehren (POST+Bearer oder POST+Nonce) */
      if (path === "/boost" || path === "/api/admin/boost") {
        /* SEC-002: Nonce-Auth bekommt immer 100. Custom Amount nur per Bearer. */
        const amount = isNonceAuth
          ? 100
          : Math.min(Math.max(Number((req.body && req.body.amount) || 100) || 100, 1), 500);
        await boostLimit(amount);
        const data = await getStats();
        if (isNonceAuth) {
          res
            .type("html")
            .send(adminSuccessPage("Boost", `+100 Analysen hinzugefuegt. Neues Limit: ${data.current.limit}`));
        } else {
          res.json({ ok: true, action: "boost", stats: data });
        }
      } else if (path === "/reset" || path === "/api/admin/reset") {
        await resetCounter();
        const data = await getStats();
        if (isNonceAuth) {
          res.type("html").send(adminSuccessPage("Reset", "Stundenzaehler zurueckgesetzt."));
        } else {
          res.json({ ok: true, action: "reset", stats: data });
        }
      } else {
        res.status(404).json({ error: "Unknown action" });
      }
    } catch (err) {
      console.log(JSON.stringify({ warning: "admin-error", error: err.message }));
      res.status(500).json({ error: "Admin action failed" });
    }
  }
);
