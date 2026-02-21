export const elements = {
  fileInput: document.getElementById("fileInput"),
  imagePreview: document.getElementById("imagePreview"),
  biasSwitch: document.getElementById("biasSwitch"),
  biasToggleWrap: document.getElementById("biasToggleWrap"),
  dataValue: document.getElementById("dataValue"),
  scanAnim: document.getElementById("scanAnim"),
  scanText: document.getElementById("scanText"),
  status: document.getElementById("status"),
  facts: document.getElementById("facts"),
  privacy: document.getElementById("privacy"),
  gpsMap: document.getElementById("gpsMap"),
  targeting: document.getElementById("targeting"),
  simulation: document.getElementById("simulation"),
  disclaimerModal: document.getElementById("disclaimerModal"),
  disclaimerConfirm: document.getElementById("disclaimerConfirm"),
  exportPdf: document.getElementById("exportPdf"),
  limitBanner: document.getElementById("limitBanner"),
  limitCountdown: document.getElementById("limitCountdown"),
};

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
