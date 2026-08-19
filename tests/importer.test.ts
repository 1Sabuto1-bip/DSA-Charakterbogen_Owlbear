import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAttributeValues, importHeroJson } from "../src/importer";

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
  });

  it("accepts an Owlbear backup", () => {
    const original = importHeroJson(minimalHero);
    original.runtime.notes = "Testnotiz";
    const restored = importHeroJson(JSON.stringify(original));
    expect(restored.runtime.notes).toBe("Testnotiz");
  });

  it("imports the supplied integration hero when configured", () => {
    const path = process.env.TEST_HERO_JSON;
    if (!path) return;
    const state = importHeroJson(readFileSync(path, "utf8"));
    expect(state.hero.name).toBe("Isil al'Fasir");
    expect(Object.keys(state.hero.talents)).toHaveLength(24);
    expect(state.runtime.resources.lp.max).toBe(31);
  });

  it("rejects unrelated JSON", () => {
    expect(() => importHeroJson('{"hello":"world"}')).toThrow(/Name|Optolith/);
  });
});
