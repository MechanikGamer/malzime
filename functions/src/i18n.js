"use strict";

/**
 * i18n.js — Backend-Loader für sprachspezifische Inhalte.
 *
 * Lädt beim Cold Start das Manifest und stellt Funktionen bereit
 * um die richtige Sprache aufzulösen und Content-Module zu laden.
 */

const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "locales");
const manifest = JSON.parse(fs.readFileSync(path.join(localesDir, "manifest.json"), "utf8"));

/**
 * Löst einen angefragten Sprachcode gegen das Manifest auf.
 * Gibt die Sprache zurück wenn verfügbar, sonst den Default.
 *
 * @param {string|undefined} requestedLang — Sprachcode aus dem Request (z.B. "en")
 * @returns {string} — Aufgelöster Sprachcode (z.B. "de")
 */
function resolveLanguage(requestedLang) {
  if (typeof requestedLang === "string" && manifest.languages.includes(requestedLang)) {
    return requestedLang;
  }
  return manifest.default;
}

/**
 * Lädt das Tier-Profil-Content-Modul für eine Sprache.
 * Fallback auf Default wenn das Modul nicht existiert.
 *
 * @param {string} lang — Aufgelöster Sprachcode
 * @returns {object} — Content-Modul (names, grammar, normal, boost)
 */
function loadAnimals(lang) {
  const modulePath = path.join(localesDir, lang, "animals.js");
  if (fs.existsSync(modulePath)) {
    return require(modulePath);
  }
  return require(path.join(localesDir, manifest.default, "animals.js"));
}

/**
 * Lädt das Prompt-Content-Modul für eine Sprache.
 * Fallback auf Default wenn das Modul nicht existiert.
 *
 * @param {string} lang — Aufgelöster Sprachcode
 * @returns {object} — Content-Modul (describe, systemNormal, systemBoost, jsonSchema, labelPrefixes, ...)
 */
function loadPrompts(lang) {
  const modulePath = path.join(localesDir, lang, "prompts.js");
  if (fs.existsSync(modulePath)) {
    return require(modulePath);
  }
  return require(path.join(localesDir, manifest.default, "prompts.js"));
}

module.exports = { resolveLanguage, loadAnimals, loadPrompts, manifest };
