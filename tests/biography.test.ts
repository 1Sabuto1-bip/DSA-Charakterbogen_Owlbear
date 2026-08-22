import { describe, expect, it } from "vitest";
import { BIOGRAPHY_CULTURES, BIOGRAPHY_PROFESSIONS, BIOGRAPHY_SPECIES } from "../src/biography-data";
import { COMPLETE_ADVANTAGES, COMPLETE_DISADVANTAGES } from "../src/biography-catalog";
import { createManualState, importHeroJson, updateManualSpecies } from "../src/importer";

const optolithBiographyHero = {
  clientVersion: "1.5.2",
  id: "H_BIOGRAPHY",
  name: "Isil",
  r: "R_1",
  rv: "RV_5",
  c: "C_14",
  p: "P_13",
  attr: {
    values: [
      { id: "ATTR_1", value: 13 },
      { id: "ATTR_2", value: 12 },
      { id: "ATTR_3", value: 11 },
      { id: "ATTR_4", value: 10 },
      { id: "ATTR_5", value: 9 },
      { id: "ATTR_6", value: 12 },
      { id: "ATTR_7", value: 13 },
      { id: "ATTR_8", value: 14 },
    ],
  },
  talents: {},
  activatable: {
    ADV_5: [{}],
    ADV_25: [{ tier: 1 }],
    DISADV_33: [{ sid: 5 }],
    DISADV_37: [{ sid: 10 }],
  },
};

describe("Biografie", () => {
  it("resolves Optolith IDs for ancestry, culture, profession and traits", () => {
    const state = importHeroJson(JSON.stringify(optolithBiographyHero));
    expect(state.hero.biography).toMatchObject({
      species: "Tulamiden",
      culture: "Südaventurien",
      profession: "Söldner / Söldnerin",
    });
    expect(state.hero.biography?.advantages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Beidhändig" }),
      expect.objectContaining({ name: "Hohe Lebenskraft", level: 1 }),
    ]));
    expect(state.hero.biography?.disadvantages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Persönlichkeitsschwäche", variant: "Unheimlich" }),
      expect.objectContaining({ name: "Schlechte Eigenschaft", variant: "Spielsucht" }),
    ]));
  });

  it("keeps manually entered biography data in backups", () => {
    const state = createManualState("Arbosch", { species: "dwarf" });
    expect(state.hero.biography?.species).toBe("Zwerg");
    state.hero.biography!.culture = "Ambosszwerge";
    state.hero.biography!.profession = "Krieger";
    state.hero.biography!.advantages.push({ id: "manual-1", name: "Richtungssinn" });
    const restored = importHeroJson(JSON.stringify(state));
    expect(restored.hero.biography).toMatchObject({
      species: "Zwerg",
      culture: "Ambosszwerge",
      profession: "Krieger",
      advantages: [expect.objectContaining({ name: "Richtungssinn" })],
    });
    updateManualSpecies(restored, "elf");
    expect(restored.hero.biography?.species).toBe("Elf");
  });

  it("imports readable DarkAid biography and trait variants", () => {
    const state = importHeroJson(JSON.stringify({
      version: 7,
      name: "Nevinia",
      race: "mittellaender",
      culture: "horasier",
      profession: "streuner",
      professionname: "Hochstaplerin",
      attributes: [],
      skills: [],
      advantages: [{ id: "gutaussehend", level: 2 }],
      disadvantages: [{
        id: "persoenlichkeitsschwaeche",
        variant: { name: "Eitelkeit", type: "stringwithcost" },
      }],
    }));
    expect(state.hero.biography).toMatchObject({
      species: "Mittelländer",
      culture: "Horasreich",
      profession: "Hochstaplerin",
      advantages: [expect.objectContaining({ name: "Gutaussehend", level: 2 })],
      disadvantages: [expect.objectContaining({ name: "Persönlichkeitsschwäche", variant: "Eitelkeit" })],
    });
  });

  it("ships the complete searchable biography catalogues", () => {
    expect(BIOGRAPHY_SPECIES).toHaveLength(29);
    expect(BIOGRAPHY_CULTURES).toHaveLength(40);
    expect(BIOGRAPHY_PROFESSIONS).toHaveLength(315);
    expect(COMPLETE_ADVANTAGES).toHaveLength(211);
    expect(COMPLETE_DISADVANTAGES).toHaveLength(104);
    expect(COMPLETE_ADVANTAGES.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      "Allerweltsname",
      "Drachenblut (Einhorndrache)",
      "Kontakt (Tempelvorsteherin)",
    ]));
    expect(COMPLETE_DISADVANTAGES.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      "Böser Namensvetter",
      "Pechmagnet",
      "Yurach",
    ]));
    expect(new Set(COMPLETE_ADVANTAGES.map((entry) => entry.name.toLocaleLowerCase("de"))).size)
      .toBe(COMPLETE_ADVANTAGES.length);
    expect(new Set(COMPLETE_DISADVANTAGES.map((entry) => entry.name.toLocaleLowerCase("de"))).size)
      .toBe(COMPLETE_DISADVANTAGES.length);
  });
});
