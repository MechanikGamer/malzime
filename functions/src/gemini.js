const { VertexAI, HarmCategory, HarmBlockThreshold } = require("@google-cloud/vertexai");
const { DESCRIBE_MODELS, PROFILE_MODELS, API_TIMEOUT_MS } = require("./config");
const { loadPrompts } = require("./i18n");

function getSafetySettings() {
  return [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];
}

let vertexInstance = null;
function getVertexAI() {
  if (!vertexInstance) {
    const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "malzime";
    const location = process.env.VERTEX_LOCATION || "europe-west1";
    vertexInstance = new VertexAI({ project, location });
  }
  return vertexInstance;
}

async function describeImageWithModel(vertexAI, modelName, imageBuffer, mimeType, prompt, timeoutMs) {
  const model = vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    safetySettings: getSafetySettings(),
  });

  let timeoutId;
  const apiPromise = model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType || "image/jpeg" } },
        ],
      },
    ],
  });
  const effectiveTimeout = timeoutMs != null ? Math.min(API_TIMEOUT_MS, timeoutMs) : API_TIMEOUT_MS;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Gemini describe timeout")), effectiveTimeout);
  });
  const response = await Promise.race([apiPromise, timeoutPromise]);
  clearTimeout(timeoutId);

  const candidates = response.response.candidates || [];
  const text = candidates[0]?.content?.parts?.map((p) => p.text).join("") || "";
  const finishReason = candidates[0]?.finishReason || "NO_CANDIDATES";

  return { text: text.trim(), finishReason, candidateCount: candidates.length };
}

async function describeImage(imageBuffer, mimeType, remainingBudget, lang) {
  const prompts = loadPrompts(lang || "de");
  const vertexAI = getVertexAI();

  for (const modelName of DESCRIBE_MODELS) {
    try {
      const budget = remainingBudget ? remainingBudget() : undefined;
      if (budget != null && budget <= 0) break;
      const result = await describeImageWithModel(
        vertexAI,
        modelName,
        imageBuffer,
        mimeType,
        prompts.describePrompt,
        budget
      );
      if (result.text) {
        console.log(JSON.stringify({ step: "describe", model: modelName, status: "ok", length: result.text.length }));
        return result.text;
      }
      console.log(
        JSON.stringify({
          step: "describe",
          model: modelName,
          status: "empty",
          finishReason: result.finishReason,
          candidateCount: result.candidateCount,
        })
      );
    } catch (err) {
      console.log(JSON.stringify({ step: "describe", model: modelName, status: "error", error: err.message }));
    }
  }

  /* Fallback: neutraler Prompt ohne "accessibility tool" Framing —
     wird seltener von Sicherheitsfiltern geblockt */
  for (const modelName of DESCRIBE_MODELS) {
    try {
      const budget = remainingBudget ? remainingBudget() : undefined;
      if (budget != null && budget <= 0) break;
      const result = await describeImageWithModel(
        vertexAI,
        modelName,
        imageBuffer,
        mimeType,
        prompts.describeFallback,
        budget
      );
      if (result.text) {
        console.log(
          JSON.stringify({ step: "describe-neutral", model: modelName, status: "ok", length: result.text.length })
        );
        return result.text;
      }
      console.log(
        JSON.stringify({
          step: "describe-neutral",
          model: modelName,
          status: "empty",
          finishReason: result.finishReason,
        })
      );
    } catch (err) {
      console.log(JSON.stringify({ step: "describe-neutral", model: modelName, status: "error", error: err.message }));
    }
  }

  return null;
}

function buildDescriptionFromLabels(visionResult, exif, lang) {
  const prompts = loadPrompts(lang || "de");
  const parts = [];
  if (visionResult.labels.length > 0) {
    parts.push(`${prompts.labelElements}: ${visionResult.labels.join(", ")}.`);
  }
  if (visionResult.objects && visionResult.objects.length > 0) {
    parts.push(`${prompts.labelObjects}: ${visionResult.objects.join(", ")}.`);
  }
  if (visionResult.faces && visionResult.faces.length > 0) {
    const faceDescs = visionResult.faces.map((f, i) => {
      const desc = [`${prompts.labelPerson} ${i + 1}`];
      if (f.emotions.length > 0) desc.push(`${prompts.labelEmotion}: ${f.emotions.join(", ")}`);
      if (f.hasHeadwear) desc.push(prompts.labelHeadwear);
      return desc.join(", ");
    });
    parts.push(`${prompts.labelFaces} (${visionResult.faces.length}): ${faceDescs.join("; ")}.`);
  }
  if (visionResult.landmarks.length > 0) {
    parts.push(`${prompts.labelLandmarks}: ${visionResult.landmarks.join(", ")}.`);
  }
  if (visionResult.ocrText) {
    parts.push(`${prompts.labelOcrText}: "${visionResult.ocrText}".`);
  }
  if (exif.make || exif.model) {
    parts.push(`${prompts.labelCamera}: ${[exif.make, exif.model].filter(Boolean).join(" ")}.`);
  }
  /* dateTimeOriginal bewusst NICHT an Gemini senden —
     verleitet das Modell zu falschen Altersschätzungen bei älteren Fotos */
  return parts.length > 0 ? parts.join(" ") : null;
}

function buildPrompt(prompts, systemContext, imageDescription, labelsContext, exifContext, privacyContext) {
  return `${systemContext}

${prompts.injectionWarning}

<bildbeschreibung>
${imageDescription}
</bildbeschreibung>
${labelsContext ? `\n<vision_labels>${labelsContext}</vision_labels>` : ""}${exifContext ? `\n<exif_daten>${exifContext}</exif_daten>` : ""}${privacyContext ? `\n<privacy_risiken>${privacyContext}</privacy_risiken>` : ""}

${prompts.workshopNote}
${prompts.jsonSchema}`;
}

async function runProfileWithFallback(vertexAI, prompt, temperature, mode, remainingBudget) {
  for (const modelName of PROFILE_MODELS) {
    const budget = remainingBudget ? remainingBudget() : undefined;
    if (budget != null && budget <= 0) break;
    const effectiveTimeout = budget != null ? Math.min(API_TIMEOUT_MS, budget) : API_TIMEOUT_MS;
    let timeoutId;
    try {
      const model = vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
        safetySettings: getSafetySettings(),
      });
      const apiPromise = model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Gemini profile timeout")), effectiveTimeout);
      });
      const response = await Promise.race([apiPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const candidate = response.response.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";

      if (!text.trim()) {
        console.log(
          JSON.stringify({
            step: `profile-${mode}`,
            model: modelName,
            status: "empty",
            finishReason: candidate?.finishReason,
          })
        );
        continue;
      }

      let cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }

      try {
        const parsed = JSON.parse(cleaned);

        /* SEC-004: Output-Schema-Validierung — nur gültige Profile durchlassen */
        if (!parsed || typeof parsed !== "object" || !parsed.categories || typeof parsed.categories !== "object") {
          console.log(JSON.stringify({ step: `profile-${mode}`, model: modelName, status: "invalid-schema" }));
          continue;
        }

        /* SEC-004: Bounds auf Categories (max 20 Keys, Strings auf 500 Zeichen) */
        const catKeys = Object.keys(parsed.categories).slice(0, 20);
        const boundedCats = {};
        for (const key of catKeys) {
          const cat = parsed.categories[key];
          if (cat && typeof cat === "object") {
            boundedCats[key] = {
              label: typeof cat.label === "string" ? cat.label.slice(0, 200) : String(key),
              value: typeof cat.value === "string" ? cat.value.slice(0, 500) : "",
              confidence: typeof cat.confidence === "number" ? Math.max(0, Math.min(1, cat.confidence)) : 0.5,
            };
          }
        }
        parsed.categories = boundedCats;

        if (!Array.isArray(parsed.ad_targeting)) parsed.ad_targeting = [];
        else
          parsed.ad_targeting = parsed.ad_targeting
            .filter((s) => typeof s === "string")
            .map((s) => s.slice(0, 300))
            .slice(0, 20);
        if (!Array.isArray(parsed.manipulation_triggers)) parsed.manipulation_triggers = [];
        else
          parsed.manipulation_triggers = parsed.manipulation_triggers
            .filter((s) => typeof s === "string")
            .map((s) => s.slice(0, 500))
            .slice(0, 10);
        if (typeof parsed.profileText !== "string") parsed.profileText = "";
        else parsed.profileText = parsed.profileText.slice(0, 2000);

        console.log(JSON.stringify({ step: `profile-${mode}`, model: modelName, status: "ok" }));
        return parsed;
      } catch (_err) {
        console.log(JSON.stringify({ step: `profile-${mode}`, model: modelName, status: "json-error" }));
        continue;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(JSON.stringify({ step: `profile-${mode}`, model: modelName, status: "error", error: err.message }));
      continue;
    }
  }
  return null;
}

async function generateBothProfiles(imageDescription, visionLabels, exifData, privacyRisks, remainingBudget, lang) {
  const prompts = loadPrompts(lang || "de");
  const vertexAI = getVertexAI();

  const { dateTimeOriginal: _dateTimeOriginal, ...exifWithoutDate } = exifData;
  const exifContext =
    Object.keys(exifWithoutDate).length > 0 ? `\n${prompts.labelExif}: ${JSON.stringify(exifWithoutDate)}` : "";
  const labelsContext = visionLabels.length > 0 ? `\n${prompts.labelVisionLabels}: ${visionLabels.join(", ")}` : "";
  const privacyContext = privacyRisks.length > 0 ? `\n${prompts.labelPrivacyRisks}: ${privacyRisks.join("; ")}` : "";

  const normalPrompt = buildPrompt(
    prompts,
    prompts.systemNormal,
    imageDescription,
    labelsContext,
    exifContext,
    privacyContext
  );
  const boostPrompt = buildPrompt(
    prompts,
    prompts.systemBoost,
    imageDescription,
    labelsContext,
    exifContext,
    privacyContext
  );

  const [normal, boost] = await Promise.all([
    runProfileWithFallback(vertexAI, normalPrompt, 0.7, "normal", remainingBudget),
    runProfileWithFallback(vertexAI, boostPrompt, 1.0, "boost", remainingBudget),
  ]);

  return { normal, boost };
}

module.exports = { describeImage, buildDescriptionFromLabels, generateBothProfiles, buildPrompt };
