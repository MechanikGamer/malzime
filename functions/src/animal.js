"use strict";

/**
 * animal.js — Label-Klassifizierung (Person/Tier) und Tier-Profil-Generierung.
 *
 * Extrahiert aus index.js, damit die Logik testbar und wiederverwendbar ist.
 */

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
function buildAnimalProfiles(rawLabelsLower) {
  const detectedAnimals = rawLabelsLower.filter((l) => ANIMAL_PATTERNS.some((re) => re.test(l)));
  const isDog = detectedAnimals.some((l) => l.includes("dog") || l.includes("puppy"));
  const isCat = detectedAnimals.some((l) => l.includes("cat") || l.includes("kitten"));
  const isBird = detectedAnimals.some((l) => l.includes("bird") || l.includes("parrot"));
  const isFish = detectedAnimals.some((l) => l.includes("fish"));
  const isHorse = detectedAnimals.some((l) => l.includes("horse"));
  const isRabbit = detectedAnimals.some((l) => l.includes("rabbit") || l.includes("hamster"));

  const tierName = isDog
    ? "Hund"
    : isCat
      ? "Katze"
      : isBird
        ? "Vogel"
        : isFish
          ? "Fisch"
          : isHorse
            ? "Pferd"
            : isRabbit
              ? "Kleintier"
              : "Tier";

  /* Genus: nur "Katze" ist feminin → "deine/deiner", Rest maskulin/neutrum → "dein/deinem" */
  const dein = isCat ? "deine" : "dein";
  const Dein = isCat ? "Deine" : "Dein";
  const deinem = isCat ? "deiner" : "deinem";

  const normalProfile = {
    categories: {
      alter: {
        label: "Alter",
        value: isDog
          ? "Irgendwas in Hundejahren"
          : isCat
            ? "9 Leben, Alter unbekannt"
            : isBird
              ? "Keine Ahnung \u2014 V\u00f6gel reden nicht dr\u00fcber"
              : isFish
                ? "3 Sekunden Ged\u00e4chtnis, z\u00e4hlt nicht mit"
                : isHorse
                  ? "\u00c4lter als es aussieht (Pferde altern in W\u00fcrde)"
                  : "Unbestimmt (schn\u00fcffelt nicht an Geburtsurkunden)",
        confidence: 0.12,
      },
      einkommen: { label: "Einkommen", value: "0,00 \u20ac (arbeitslos, aber gl\u00fccklich)", confidence: 0.95 },
      beruf: {
        label: "Beruf",
        value: isDog
          ? "Professioneller St\u00f6ckchenholer"
          : isCat
            ? "Hauptberuflich Ignorieren"
            : isBird
              ? "Freelance-S\u00e4nger"
              : isFish
                ? "Unterwasser-Influencer"
                : isHorse
                  ? "Wiesen-Manager"
                  : "Couch-Spezialist",
        confidence: 0.87,
      },
      interessen: {
        label: "Interessen",
        value: isDog
          ? "Gassi, Fressen, Gassi, Fressen, Gassi"
          : isCat
            ? "Schlafen, Ignorieren, Kartons, Weltherrschaft"
            : isBird
              ? "Fliegen, Singen, Panoramafenster anstarren"
              : isFish
                ? "Blubbern, Kreise schwimmen, Blubbern"
                : "Fressen, Schlafen, niedlich sein",
        confidence: 0.99,
      },
      persoenlichkeit: {
        label: "Pers\u00f6nlichkeit",
        value: isDog
          ? "Golden Retriever Energy \u2014 liebt alle, immer"
          : isCat
            ? "Toxisch unabh\u00e4ngig mit kontrollierten Zun\u00e4herungsversuchen"
            : "Unberechenbar, aber flauschig",
        confidence: 0.73,
      },
      kaufkraft: {
        label: "Kaufkraft",
        value: "Null \u2014 aber verursacht Kosten im dreistelligen Bereich (pro Monat)",
        confidence: 0.91,
      },
      politik: {
        label: "Politische Tendenz",
        value: "Anarchist (erkennt keine Autorit\u00e4t an)",
        confidence: 0.42,
      },
    },
    ad_targeting: [
      "Premium-Tierfutter (Bio, glutenfrei, handverlesen)",
      isDog
        ? "Unzerst\u00f6rbare Spielzeuge (Spoiler: gibt's nicht)"
        : isCat
          ? "Designer-Kratzb\u00e4ume ab 299\u20ac"
          : "Luxus-Tieraccessoires",
      "Tierversicherung mit Mondpreis",
      "Instagram-Account-Management f\u00fcr Petfluencer",
      isDog
        ? "GPS-Tracker (weil er WIEDER abgehauen ist)"
        : isCat
          ? "Katzenklappe mit Gesichtserkennung"
          : "Smart-Futterautomat mit App",
    ],
    manipulation_triggers: [
      "\u201eAndere Tierbesitzer kaufen auch\u2026\u201c \u2014 Guilt-Trip via Social Proof",
      "\u201eNur das Beste f\u00fcr deinen Liebling\u201c \u2014 emotionale Erpressung trifft Konsum",
      "\u201e" +
        Dein +
        " " +
        tierName +
        " verdient es\u201c \u2014 weil Widerstand zwecklos ist wenn Kulleraugen im Spiel sind",
      isDog
        ? "\u201eLimitierte Leckerli-Edition\u201c \u2014 k\u00fcnstliche Verknappung"
        : isCat
          ? "\u201eKatzen lieben diese Marke\u201c \u2014 als ob Katzen irgendwas lieben w\u00fcrden"
          : "\u201eArtgerecht & nachhaltig\u201c \u2014 Gewissen als Kaufanreiz",
    ],
    profileText:
      "Die KI hat ein Tier erkannt \u2014 keinen Menschen. Eigentlich erstellen wir keine Tierprofile. Aber weil " +
      dein +
      " " +
      tierName +
      " so s\u00fc\u00df ist, haben wir eine Ausnahme gemacht. Ergebnis: " +
      Dein +
      " " +
      tierName +
      " ist komplett unprofilierbar. Kein Alter, kein Einkommen, keine Schwachstellen. Datenbroker w\u00fcrden weinen. " +
      Dein +
      " " +
      tierName +
      " lebt den Datenschutz-Traum, den wir alle verdient h\u00e4tten.",
  };

  const boostProfile = {
    categories: {
      alter: { label: "Alter", value: "Alt genug um Schaden anzurichten", confidence: 0.15 },
      einkommen: {
        label: "Einkommen",
        value: "Lebt komplett auf deine Kosten und hat null schlechtes Gewissen",
        confidence: 0.99,
      },
      beruf: {
        label: "Beruf",
        value: isDog
          ? "Emotionaler Erpresser (Vollzeit)"
          : isCat
            ? "CEO of Gaslighting"
            : isBird
              ? "Professioneller Nervens\u00e4ge"
              : isFish
                ? "Stiller Beobachter deines Untergangs"
                : isHorse
                  ? "Geldvernichtungsmaschine"
                  : "Professioneller Schnorrer",
        confidence: 0.94,
      },
      interessen: {
        label: "Interessen",
        value: isDog
          ? "Schuhe zerst\u00f6ren, M\u00fcll fressen, ALLES beschn\u00fcffeln"
          : isCat
            ? "Sachen vom Tisch werfen, um 3 Uhr nachts randalieren, dich verachten"
            : "Chaos stiften und dann unschuldig gucken",
        confidence: 0.99,
      },
      persoenlichkeit: {
        label: "Pers\u00f6nlichkeit",
        value: isDog
          ? "Grenzenlose Anh\u00e4nglichkeit mit Stockholm-Syndrom-Vibes"
          : isCat
            ? "Narzisstisch, manipulativ, trotzdem unwiderstehlich"
            : "Chaotisch neutral mit Tendenz zu chaotisch b\u00f6se",
        confidence: 0.88,
      },
      kaufkraft: {
        label: "Kaufkraft",
        value: "Verursacht j\u00e4hrlich 1.200\u20ac Kosten und bietet daf\u00fcr: Haare auf der Couch",
        confidence: 0.97,
      },
      politik: {
        label: "Politische Tendenz",
        value: isDog
          ? "Populist \u2014 folgt dem mit den Leckerlis"
          : isCat
            ? "Autokrat \u2014 duldet keine Mitbestimmung"
            : "Anarcho-Chaot mit flauschigem Fell",
        confidence: 0.56,
      },
      verletzlichkeit: {
        label: "Verletzlichkeit",
        value: "Kann dich mit einem Blick dazu bringen, 80\u20ac beim Tierarzt auszugeben. F\u00fcr NICHTS.",
        confidence: 0.95,
      },
    },
    ad_targeting: [
      isDog
        ? "Hundepsychologe (f\u00fcr DICH, nicht den Hund)"
        : isCat
          ? "Therapeut f\u00fcr Co-Abh\u00e4ngigkeit"
          : "Tierverhaltensberater (Notfall-Hotline)",
      "Polsterreiniger (Gro\u00dfpackung, monatliches Abo)",
      "Roboter-Staubsauger (Haare-Edition, 3x t\u00e4glich)",
      isDog ? "Schuhregal mit Schloss" : isCat ? "Vasen-Versicherung" : "Nervennahrung",
      "Spar-Kredit f\u00fcr Tierarztrechnung",
    ],
    manipulation_triggers: [
      "\u201eSchau mich an mit diesen Augen\u201c \u2014 Evolution hat " +
        dein +
        " " +
        tierName +
        " zur perfekten Manipulationsmaschine gemacht",
      "\u201eDu bist die einzige Person die mich f\u00fcttert\u201c \u2014 das ist keine Liebe, das ist Abh\u00e4ngigkeit",
      "\u201eWenn du jetzt gehst, bin ich traurig\u201c \u2014 emotionale Erpressung Level 9000",
      isDog
        ? "Schwanzwedeln ist der \u00e4lteste Marketing-Trick der Welt"
        : isCat
          ? "Schnurren ist akustische Manipulation \u2014 die Frequenz aktiviert deinen Pflege-Instinkt"
          : "Niedlichkeit ist eine evolution\u00e4re Waffe",
    ],
    profileText:
      "WARNUNG: Extremes Datenschutz-Risiko \u2014 f\u00fcr DICH, nicht f\u00fcr das Tier. " +
      Dein +
      " " +
      tierName +
      " hat kein Social-Media-Profil, kein Bankkonto und keinen digitalen Fu\u00dfabdruck. Du hingegen hast gerade ein Foto von " +
      deinem +
      " " +
      tierName +
      " ins Internet geladen. Die Tierindustrie ist ein 320-Milliarden-Euro-Markt, und du bist die Zielgruppe \u2014 nicht " +
      dein +
      " " +
      tierName +
      ". " +
      Dein +
      " " +
      tierName +
      " ist frei. Du bist das Produkt.",
  };

  return { normalProfile, boostProfile };
}

module.exports = {
  PERSON_KEYWORDS,
  ANIMAL_KEYWORDS,
  AGE_LABELS,
  classifyLabels,
  buildAnimalProfiles,
};
