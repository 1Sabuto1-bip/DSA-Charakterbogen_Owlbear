import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createManualState,
  getAttributeValues,
  importHeroJson,
  isMagicallyGifted,
  updateManualMagic,
  updateManualSpecies,
} from "../src/importer";
import { CANTRIPS, SPELLS, SPELL_BY_ID } from "../src/magic-data";

const minimalHero = JSON.stringify({
  clientVersion: "1.5.2",
  id: "H_TEST",
  name: "Testheld",
  r: "R_1",
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
    lp: 0,
    permanentLP: { lost: 0 },
  },
  talents: { TAL_4: 7 },
  ct: {},
  spells: {},
  liturgies: {},
  belongings: { items: {}, purse: {} },
});

describe("Optolith import", () => {
  it("imports base values and derives human life points", () => {
    const state = importHeroJson(minimalHero);
    expect(state.hero.name).toBe("Testheld");
    expect(getAttributeValues(state.hero).KO).toBe(13);
    expect(state.runtime.resources.lp).toEqual({ current: 31, max: 31 });
    expect(Object.keys(state.hero.talents)).toHaveLength(59);
    expect(state.hero.talents.TAL_4).toBe(7);
    expect(state.hero.talents.TAL_59).toBe(0);
  });

  it("accepts an Owlbear backup", () => {
    const original = importHeroJson(minimalHero);
    original.runtime.notes = "Testnotiz";
    const restored = importHeroJson(JSON.stringify(original));
    expect(restored.runtime.notes).toBe("Testnotiz");
  });

  it("creates and restores a complete manual character sheet", () => {
    const manual = createManualState("Alrik");
    expect(manual.source).toBe("manual");
    expect(manual.hero.name).toBe("Alrik");
    expect(Object.keys(manual.hero.talents)).toHaveLength(59);
    expect(Object.keys(manual.hero.ct ?? {})).toHaveLength(21);
    expect(getAttributeValues(manual.hero).MU).toBe(8);
    expect(manual.hero.r).toBe("R_1");
    expect(manual.runtime.resources.lp).toEqual({ current: 21, max: 21 });
    expect(isMagicallyGifted(manual)).toBe(false);
    manual.hero.talents.TAL_4 = 9;
    const restored = importHeroJson(JSON.stringify(manual));
    expect(restored.source).toBe("manual");
    expect(restored.hero.talents.TAL_4).toBe(9);
  });

  it("applies the species bases and automatic elven magic", () => {
    const elf = createManualState("Layariel", { species: "elf" });
    expect(elf.hero.r).toBe("R_2");
    expect(elf.hero.manual).toEqual({ species: "elf", magical: true });
    expect(elf.runtime.resources.lp).toEqual({ current: 18, max: 18 });
    expect(elf.runtime.resources.ae).toEqual({ current: 28, max: 28 });
    expect(isMagicallyGifted(elf)).toBe(true);

    const dwarf = createManualState("Arbosch", { species: "dwarf" });
    expect(dwarf.hero.r).toBe("R_4");
    expect(dwarf.runtime.resources.lp).toEqual({ current: 24, max: 24 });
    expect(isMagicallyGifted(dwarf)).toBe(false);
  });

  it("updates species and manual magical aptitude without losing damage", () => {
    const manual = createManualState("Mirhiban");
    manual.runtime.resources.lp.current = 18;
    updateManualSpecies(manual, "dwarf");
    expect(manual.runtime.resources.lp).toEqual({ current: 21, max: 24 });
    updateManualMagic(manual, true);
    expect(isMagicallyGifted(manual)).toBe(true);
    expect(manual.runtime.resources.ae.max).toBe(28);
    updateManualMagic(manual, false);
    expect(isMagicallyGifted(manual)).toBe(false);
  });

  it("contains the Optolith spell and cantrip catalogue", () => {
    expect(SPELLS).toHaveLength(330);
    expect(SPELL_BY_ID.SPELL_5).toMatchObject({
      name: "Balsam Salabunde",
      check: ["KL", "IN", "FF"],
      kind: "Zauber",
    });
    expect(Object.keys(CANTRIPS)).toHaveLength(97);
  });

  it("recognizes spells in imported magical heroes", () => {
    const hero = JSON.parse(minimalHero);
    hero.spells = { SPELL_5: 8 };
    const magical = importHeroJson(JSON.stringify(hero));
    expect(isMagicallyGifted(magical)).toBe(true);
    expect(magical.runtime.resources.ae.max).toBe(32);
  });

  it("imports the supplied integration hero when configured", () => {
    const path = process.env.TEST_HERO_JSON;
    if (!path) return;
    const state = importHeroJson(readFileSync(path, "utf8"));
    expect(state.hero.name).toBe("Isil al'Fasir");
    expect(Object.keys(state.hero.talents)).toHaveLength(59);
    expect(state.runtime.resources.lp.max).toBe(31);
  });

  it("rejects unrelated JSON", () => {
    expect(() => importHeroJson('{"hello":"world"}')).toThrow(/Name|Optolith/);
  });
});
