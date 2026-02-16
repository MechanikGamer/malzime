function buildPrivacyRisks({ ocrText, labels }) {
  const risks = [];
  const lowerOcr = (ocrText || "").toLowerCase();
  if (ocrText) {
    if (lowerOcr.includes("straße") || lowerOcr.includes("str.") || lowerOcr.includes("schule")) {
      risks.push("Im Bild ist möglicherweise eine Adresse oder ein schulbezogener Hinweis lesbar.");
    }
    const isWatermark = /shutterstock|getty|istock|depositphotos|alamy/i.test(lowerOcr);
    if (!isWatermark && (/\b\d{2,3}[\s/-]?\d{6,8}\b/.test(lowerOcr) || /\b0\d{2,4}[\s/-]?\d{5,8}\b/.test(lowerOcr))) {
      risks.push("Eine Telefonnummer könnte lesbar sein.");
    }
  }
  if (
    labels.some((label) => label.toLowerCase().includes("kennzeichen")) ||
    /\b[A-ZÄÖÜ]{1,3}-[A-Z]{1,2} \d{1,4}\b/.test(ocrText || "")
  ) {
    risks.push("Ein Kennzeichen könnte sichtbar sein.");
  }
  return risks;
}

module.exports = { buildPrivacyRisks };
