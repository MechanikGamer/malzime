const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { defineSecret } = require("firebase-functions/params");

const { handleAnalyze } = require("./handle-analyze");
const { handleStats } = require("./handle-stats");
const { handleAdmin } = require("./handle-admin");
const { ALLOWED_ORIGINS } = require("./domains");

const adminSecret = defineSecret("ADMIN_SECRET");
const ntfyUrl = defineSecret("NTFY_URL");
const ntfyTopic = defineSecret("NTFY_TOPIC");

initializeApp();

exports.analyze = onRequest(
  {
    region: "europe-west1",
    memory: "512MiB",
    concurrency: 20,
    cors: ALLOWED_ORIGINS,
    invoker: "public",
    maxInstances: 10,
    timeoutSeconds: 120,
    secrets: [ntfyUrl, ntfyTopic, adminSecret],
  },
  (req, res) => handleAnalyze(req, res, { ntfyUrl, ntfyTopic, adminSecret })
);

exports.stats = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    cors: ALLOWED_ORIGINS,
    invoker: "public",
    maxInstances: 5,
  },
  handleStats
);

exports.admin = onRequest(
  {
    region: "europe-west1",
    memory: "256MiB",
    cors: ALLOWED_ORIGINS,
    invoker: "public",
    maxInstances: 2,
    secrets: [adminSecret],
  },
  (req, res) => handleAdmin(req, res, { adminSecret })
);
