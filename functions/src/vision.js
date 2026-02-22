const { ImageAnnotatorClient } = require("@google-cloud/vision");
const { API_TIMEOUT_MS } = require("./config");

let visionClient = null;
function getVisionClient() {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient({ apiEndpoint: "eu-vision.googleapis.com" });
  }
  return visionClient;
}

async function analyzeWithVision(buffer, budgetMs) {
  /* BUG-003: Effektives Timeout ist das Minimum aus API_TIMEOUT_MS und verbleibendem Budget */
  const effectiveTimeout = budgetMs != null ? Math.min(API_TIMEOUT_MS, budgetMs) : API_TIMEOUT_MS;
  if (effectiveTimeout <= 0) {
    return { labels: [], landmarks: [], ocrText: "", ocrTextRaw: "", faces: [], objects: [] };
  }
  let timeoutId;
  try {
    const client = getVisionClient();
    const apiPromise = client.annotateImage({
      image: { content: buffer },
      features: [{ type: "TEXT_DETECTION" }, { type: "LABEL_DETECTION" }],
    });
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Vision API timeout")), effectiveTimeout);
    });
    const [result] = await Promise.race([apiPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    const labels = (result.labelAnnotations || []).map((item) => item.description).filter(Boolean);
    const landmarks = (result.landmarkAnnotations || []).map((item) => item.description).filter(Boolean);
    const ocrTextRaw = result.textAnnotations && result.textAnnotations[0] ? result.textAnnotations[0].description : "";
    let ocrText = ocrTextRaw.slice(0, 10000);
    if (ocrText && /shutterstock|getty|istock|depositphotos|alamy/i.test(ocrText)) {
      ocrText = "";
    }

    /* EU Vision API (eu-vision.googleapis.com) unterstützt NUR TEXT_DETECTION + LABEL_DETECTION.
       FACE_DETECTION und OBJECT_LOCALIZATION sind NICHT verfügbar und würden den gesamten Call
       crashen. faces und objects sind daher immer leer. */
    const faces = [];
    const objects = [];

    return { labels, landmarks, ocrText, ocrTextRaw, faces, objects };
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(JSON.stringify({ warning: "Vision API failed, continuing with multimodal only", error: err.message }));
    return { labels: [], landmarks: [], ocrText: "", ocrTextRaw: "", faces: [], objects: [] };
  }
}

module.exports = { analyzeWithVision };
