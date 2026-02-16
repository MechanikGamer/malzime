const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");

const { ALLOWED_MIME, MAX_UPLOAD_BYTES, REQUEST_BUDGET_MS } = require("./config");
const { demoData } = require("./demo-data");
const { getClientIp, checkRateLimit } = require("./middleware");
const { parseMultipart, parseJsonBody } = require("./upload");
const { analyzeWithVision } = require("./vision");
const { buildPrivacyRisks } = require("./privacy");
const { describeImage, buildDescriptionFromLabels, generateBothProfiles } = require("./gemini");
const { classifyLabels, buildAnimalProfiles, AGE_LABELS } = require("./animal");

initializeApp();

exports.analyze = onRequest(
  {
    region: "europe-west1",
    cors: ["https://malzi.me", "https://www.malzi.me", "https://malzime.web.app", "https://malzime.firebaseapp.com"],
    invoker: "public",
    maxInstances: 10,
    timeoutSeconds: 120,
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
        const { normalProfile, boostProfile } = buildAnimalProfiles(rawLabelsLower);

        /* BUG-007: Privacy-Risks und EXIF auch bei Tier-Fotos durchreichen —
           ein sichtbares Nummernschild im Hintergrund soll trotzdem gemeldet werden */
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
      try {
        imageDescription = await describeImage(imageBuffer, file.mimeType, remainingBudget);
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
        describeError = true;
        console.log(JSON.stringify({ requestId, warning: "Image description failed", error: err.message }));
      }

      /* ── Fallback: Vision-API-Labels ── */
      let usedFallback = false;
      if (!imageDescription) {
        imageDescription = buildDescriptionFromLabels(visionResult, exif);
        /* Wenn der Safety-Filter die Bildbeschreibung geblockt hat, ist fast immer
         ein Kind oder Jugendlicher im Bild. Dieses Signal an die Profilgenerierung
         weitergeben, damit sie nicht blind "Erwachsener" annimmt. */
        if (describeBlocked && imageDescription) {
          imageDescription +=
            " WICHTIG: Die detaillierte Bildbeschreibung wurde von Googles Sicherheitsfiltern blockiert. Das passiert typischerweise bei Fotos von Kindern oder Jugendlichen. Schätze das Alter vorsichtig — gehe eher von einem Kind oder Jugendlichen aus, NICHT von einem Erwachsenen.";
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
            remainingBudget
          );
          profileBlocked = !profiles.normal && !profiles.boost;
          console.log(
            JSON.stringify({ requestId, step: "profiles", normal: !!profiles.normal, boost: !!profiles.boost })
          );
        } catch (err) {
          profileBlocked = true;
          console.log(JSON.stringify({ requestId, warning: "Profile generation failed", error: err.message }));
        }
      }

      /* ── Response ── */
      const hasCategories = (obj) => obj && obj.categories && Object.keys(obj.categories).length > 0;
      const hasAnyProfile = hasCategories(profiles.normal) || hasCategories(profiles.boost);

      if (hasAnyProfile) {
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
        if (describeBlocked && !usedFallback) {
          blockedReason =
            "Die KI hat das Bild nicht analysiert, weil der Inhalt als sensibel eingestuft wurde \u2014 z.\u00a0B. weil Kinder oder Jugendliche erkannt wurden, oder weil das Bild als gesch\u00fctzt gilt. Googles Sicherheitsfilter blockieren die Auswertung in solchen F\u00e4llen automatisch.";
        } else if (describeBlocked && usedFallback && profileBlocked) {
          blockedReason =
            "Die KI durfte das Bild nicht direkt ansehen (Sicherheitsfilter von Google). Die Analyse \u00fcber erkannte Bildelemente wurde ebenfalls blockiert \u2014 der Bildinhalt wurde als zu sensibel eingestuft.";
        } else if (describeError) {
          blockedReason =
            "Bei der Bildanalyse ist ein technischer Fehler aufgetreten. Das kann an einer vor\u00fcbergehenden Serverst\u00f6rung liegen. Versuch es in ein paar Sekunden nochmal.";
        } else if (profileBlocked) {
          blockedReason =
            "Das Bild wurde erkannt, aber die KI hat die Profilerstellung verweigert. Das passiert, wenn der Bildinhalt als zu sensibel f\u00fcr eine Auswertung eingestuft wird.";
        } else if (!imageDescription) {
          blockedReason =
            "Im Bild wurde nichts Auswertbares erkannt \u2014 kein Gesicht, keine Objekte, kein Text. Versuch es mit einem anderen Foto.";
        } else {
          blockedReason = "Die Analyse konnte nicht abgeschlossen werden. Versuch es mit einem anderen Foto.";
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
