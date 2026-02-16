"use strict";

const { classifyLabels, buildAnimalProfiles } = require("../animal");

describe("classifyLabels", () => {
  test("detects person labels", () => {
    const { hasPerson, hasAnimal } = classifyLabels(["Person", "Sky", "Tree"]);
    expect(hasPerson).toBe(true);
    expect(hasAnimal).toBe(false);
  });

  test("detects animal labels", () => {
    const { hasPerson, hasAnimal } = classifyLabels(["Dog", "Grass", "Park"]);
    expect(hasPerson).toBe(false);
    expect(hasAnimal).toBe(true);
  });

  test("detects both person and animal", () => {
    const { hasPerson, hasAnimal } = classifyLabels(["Person", "Dog"]);
    expect(hasPerson).toBe(true);
    expect(hasAnimal).toBe(true);
  });

  test("detects neither", () => {
    const { hasPerson, hasAnimal } = classifyLabels(["Sky", "Mountain", "Cloud"]);
    expect(hasPerson).toBe(false);
    expect(hasAnimal).toBe(false);
  });

  /* BUG-014: False Positives durch Substring-Matching */

  test("does NOT match 'armchair' as person (arm)", () => {
    const { hasPerson } = classifyLabels(["Armchair", "Furniture", "Room"]);
    expect(hasPerson).toBe(false);
  });

  test("does NOT match 'necklace' as person (neck)", () => {
    const { hasPerson } = classifyLabels(["Necklace", "Jewelry", "Gold"]);
    expect(hasPerson).toBe(false);
  });

  test("does NOT match 'headlight' as person (head)", () => {
    const { hasPerson } = classifyLabels(["Headlight", "Car", "Vehicle"]);
    expect(hasPerson).toBe(false);
  });

  test("does NOT match 'skincare' as person (skin)", () => {
    const { hasPerson } = classifyLabels(["Skincare", "Bottle", "Product"]);
    expect(hasPerson).toBe(false);
  });

  test("does NOT match 'caterpillar' as animal (cat)", () => {
    const { hasAnimal } = classifyLabels(["Caterpillar", "Leaf", "Plant"]);
    expect(hasAnimal).toBe(false);
  });

  test("does NOT match 'pigment' as animal (pig)", () => {
    const { hasAnimal } = classifyLabels(["Pigment", "Paint", "Art"]);
    expect(hasAnimal).toBe(false);
  });

  test("does NOT match 'cowl' as animal (cow)", () => {
    const { hasAnimal } = classifyLabels(["Cowl", "Clothing", "Fabric"]);
    expect(hasAnimal).toBe(false);
  });

  /* Positive Compound-Labels die weiterhin matchen sollen */

  test("still matches 'black cat' as animal", () => {
    const { hasAnimal } = classifyLabels(["Black cat", "Night"]);
    expect(hasAnimal).toBe(true);
  });

  test("still matches 'human face' as person", () => {
    const { hasPerson } = classifyLabels(["Human face", "Close-up"]);
    expect(hasPerson).toBe(true);
  });

  test("still matches 'guinea pig' as animal", () => {
    const { hasAnimal } = classifyLabels(["Guinea pig", "Cage"]);
    expect(hasAnimal).toBe(true);
  });

  test("lowercases labels correctly", () => {
    const { rawLabelsLower } = classifyLabels(["PERSON", "Dog"]);
    expect(rawLabelsLower).toEqual(["person", "dog"]);
  });
});

describe("buildAnimalProfiles", () => {
  test("returns normalProfile and boostProfile", () => {
    const { normalProfile, boostProfile } = buildAnimalProfiles(["dog", "park"]);
    expect(normalProfile).toBeDefined();
    expect(boostProfile).toBeDefined();
    expect(normalProfile.categories).toBeDefined();
    expect(normalProfile.ad_targeting).toBeDefined();
    expect(normalProfile.manipulation_triggers).toBeDefined();
    expect(normalProfile.profileText).toBeDefined();
  });

  test("detects dog correctly", () => {
    const { normalProfile } = buildAnimalProfiles(["dog", "grass"]);
    expect(normalProfile.categories.beruf.value).toContain("Stöckchen");
  });

  test("detects cat correctly with feminine grammar", () => {
    const { normalProfile } = buildAnimalProfiles(["cat", "sofa"]);
    expect(normalProfile.profileText).toContain("deine Katze");
  });

  test("returns generic Tier for unknown animal", () => {
    const { normalProfile } = buildAnimalProfiles(["animal", "nature"]);
    expect(normalProfile.profileText).toContain("Tier");
  });
});
