"use strict";

/**
 * animal.js — Label-Klassifizierung (Person/Tier) und Tier-Profil-Generierung.
 *
 * Extrahiert aus index.js, damit die Logik testbar und wiederverwendbar ist.
 * Deutsche Texte liegen in locales/de/animals.js (i18n-Vorbereitung).
 */

const { loadAnimals } = require("./i18n");

const PERSON_KEYWORDS = [
  "person",
  "people",
  "human",
  "man",
  "woman",
  "boy",
  "girl",
  "child",
  "baby",
  "toddler",
  "infant",
  "face",
  "selfie",
  "portrait",
  "skin",
  "head",
  "smile",
  "beard",
  "hair",
  "eyebrow",
  "forehead",
  "teenager",
  "adolescent",
  "youth",
  "adult",
  "senior",
  "standing",
  "sitting",
  "walking",
  "arm",
  "leg",
  "hand",
  "finger",
  "shoulder",
  "neck",
  "clothing",
  "fashion",
  "outerwear",
  "footwear",
  "jeans",
  "denim",
  "jacket",
  "sweater",
  "shirt",
  "dress",
  "pants",
  "shorts",
  "sneakers",
  "shoe",
  "boot",
  "hat",
  "cap",
];

const ANIMAL_KEYWORDS = [
  "dog",
  "cat",
  "animal",
  "pet",
  "bird",
  "fish",
  "horse",
  "kitten",
  "puppy",
  "rabbit",
  "hamster",
  "turtle",
  "parrot",
  "cow",
  "sheep",
  "goat",
  "deer",
  "wildlife",
  "insect",
  "butterfly",
  "reptile",
  "frog",
  "lizard",
  "snake",
  "rodent",
  "guinea pig",
  "chinchilla",
  "ferret",
  "hedgehog",
  "mouse",
  "rat",
  "pony",
  "donkey",
  "pig",
  "chicken",
  "duck",
  "goose",
  "owl",
  "penguin",
  "dolphin",
  "whale",
  "squirrel",
];

/* Alters-Labels der Vision API sind unzuverlässig und vergiften die
   Profilgenerierung (z.B. "Toddler" für 10-Jährige). Rausfiltern. */
const AGE_LABELS = ["toddler", "baby", "infant", "newborn"];

/* BUG-014: Pre-compiled Word-Boundary-Patterns statt Substring-Matching.
   Verhindert False Positives wie "armchair" → "arm" → hasPerson. */
const PERSON_PATTERNS = PERSON_KEYWORDS.map((kw) => new RegExp(`\\b${kw}\\b`));
const ANIMAL_PATTERNS = ANIMAL_KEYWORDS.map((kw) => new RegExp(`\\b${kw}\\b`));

/**
 * Löst einen typ-spezifischen oder gemeinsamen Wert auf.
 *
 * @param {string|object} data — String (gemeinsam) oder Object mit Typ-Keys + `_` Default
 * @param {string} type — Tier-Typ-Key (z.B. "dog", "cat", "generic")
 * @returns {string}
 */
function resolve(data, type) {
  if (typeof data === "string") return data;
  return data[type] || data._ || "";
}

/**
 * Ersetzt {{placeholder}} in einem Text durch Werte aus vars.
 *
 * @param {string} text — Text mit {{key}}-Platzhaltern
 * @param {object} vars — Key-Value-Paare für die Ersetzung
 * @returns {string}
 */
function fillTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || key);
}

/**
 * Baut ein Profil-Objekt (normal oder boost) aus Locale-Daten.
 *
 * @param {object} modeData — normal- oder boost-Daten aus der Locale-Datei
 * @param {object} labels — Label-Übersetzungen (z.B. { alter: "Alter", ... })
 * @param {object} typeInfo — Typ-Infos (tierName, dein, Dein, deinem)
 * @param {string} type — Tier-Typ-Key
 * @returns {object}
 */
function buildProfile(modeData, labels, typeInfo, type) {
  const categories = {};
  for (const [key, catData] of Object.entries(modeData.categories)) {
    categories[key] = {
      label: labels[key] || key,
      value: catData.values ? resolve(catData.values, type) : catData.value,
      confidence: catData.confidence,
    };
  }
  return {
    categories,
    ad_targeting: modeData.ad_targeting.map((item) => resolve(item, type)),
    manipulation_triggers: modeData.manipulation_triggers.map((item) => {
      const text = resolve(item, type);
      return fillTemplate(text, typeInfo);
    }),
    profileText: fillTemplate(modeData.profileText, typeInfo),
  };
}

/**
 * Klassifiziert rohe Vision-Labels in Person/Tier.
 *
 * @param {string[]} labels — Rohe Label-Strings von der Vision API
 * @returns {{ hasPerson: boolean, hasAnimal: boolean, rawLabelsLower: string[] }}
 */
function classifyLabels(labels) {
  const rawLabelsLower = labels.map((l) => l.toLowerCase());
  const hasPerson = rawLabelsLower.some((l) => PERSON_PATTERNS.some((re) => re.test(l)));
  const hasAnimal = rawLabelsLower.some((l) => ANIMAL_PATTERNS.some((re) => re.test(l)));
  return { hasPerson, hasAnimal, rawLabelsLower };
}

/**
 * Erzeugt das Normal- und Boost-Profil für ein erkanntes Tier.
 *
 * @param {string[]} rawLabelsLower — Bereits klein-geschriebene Labels
 * @returns {{ normalProfile: object, boostProfile: object }}
 */
function buildAnimalProfiles(rawLabelsLower, lang) {
  const animalData = loadAnimals(lang || "de");
  const detectedAnimals = rawLabelsLower.filter((l) => ANIMAL_PATTERNS.some((re) => re.test(l)));
  const isDog = detectedAnimals.some((l) => l.includes("dog") || l.includes("puppy"));
  const isCat = detectedAnimals.some((l) => l.includes("cat") || l.includes("kitten"));
  const isBird = detectedAnimals.some((l) => l.includes("bird") || l.includes("parrot"));
  const isFish = detectedAnimals.some((l) => l.includes("fish"));
  const isHorse = detectedAnimals.some((l) => l.includes("horse"));
  const isRabbit = detectedAnimals.some((l) => l.includes("rabbit") || l.includes("hamster"));

  const type = isDog
    ? "dog"
    : isCat
      ? "cat"
      : isBird
        ? "bird"
        : isFish
          ? "fish"
          : isHorse
            ? "horse"
            : isRabbit
              ? "rabbit"
              : "generic";

  const typeInfo = animalData.types[type];
  const { labels } = animalData;

  const normalProfile = buildProfile(animalData.normal, labels, typeInfo, type);
  const boostProfile = buildProfile(animalData.boost, labels, typeInfo, type);

  return { normalProfile, boostProfile };
}

module.exports = {
  PERSON_KEYWORDS,
  ANIMAL_KEYWORDS,
  AGE_LABELS,
  classifyLabels,
  buildAnimalProfiles,
};
