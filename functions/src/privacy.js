function buildPrivacyRisks({ ocrText, labels }) {
  const risks = [];
  const lowerOcr = (ocrText || "").toLowerCase();
  if (ocrText) {
    if (lowerOcr.includes("straße") || lowerOcr.includes("str.") || lowerOcr.includes("schule")) {
      risks.push("privacy.address");
    }
    const isWatermark = /shutterstock|getty|istock|depositphotos|alamy/i.test(lowerOcr);
    if (!isWatermark && (/\b\d{2,3}[\s/-]?\d{6,8}\b/.test(lowerOcr) || /\b0\d{2,4}[\s/-]?\d{5,8}\b/.test(lowerOcr))) {
      risks.push("privacy.phone");
    }
  }
  if (
    labels.some((label) => label.toLowerCase().includes("kennzeichen")) ||
    /\b[A-ZÄÖÜ]{1,3}-[A-Z]{1,2} \d{1,4}\b/.test(ocrText || "")
  ) {
    risks.push("privacy.licensePlate");
  }
  return risks;
}

module.exports = { buildPrivacyRisks };
