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

      /* ── Globales Stundenlimit (Firestore-Zähler) ── */
      const counterResult = await checkAndIncrement();
      if (!counterResult.allowed) {
        /* ntfy-Push nur beim erstmaligen Erreichen (justReached) */
        if (counterResult.justReached) {
          notifyLimitReached({
            ntfyUrl: ntfyUrl.value(),
            ntfyTopic: ntfyTopic.value(),
            adminSecret: adminSecret.value(),
            count: counterResult.count,
            limit: counterResult.limit,
          }).catch(() => {});
        }
        res.status(429).json({
          blocked: "limit",
          retryAfterSeconds: counterResult.retryAfterSeconds,
          message: "Stundenlimit erreicht",
        });
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
exports.admin = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    cors: true,
    invoker: "public",
    maxInstances: 2,
    secrets: [adminSecret],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    /* Auth prüfen */
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token !== adminSecret.value()) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const path = req.path || "";
    try {
      if (path === "/boost") {
        const amount = (req.body && req.body.amount) || 100;
        await boostLimit(Math.min(Math.max(Number(amount) || 100, 1), 10000));
        const data = await getStats();
        res.json({ ok: true, action: "boost", stats: data });
      } else if (path === "/reset") {
        await resetCounter();
        const data = await getStats();
        res.json({ ok: true, action: "reset", stats: data });
      } else {
        res.status(404).json({ error: "Unknown action" });
      }
    } catch (err) {
      console.log(JSON.stringify({ warning: "admin-error", error: err.message }));
      res.status(500).json({ error: "Admin action failed" });
    }
  }
);
