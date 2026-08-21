import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
import { DARKAID_ITEM_DATA, DARKAID_MAGIC_BY_ID } from "../src/darkaid-data";
import { suggestInventoryGroup } from "../src/data";

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

const darkAidHero = JSON.stringify({
  version: 7,
  name: "Irinja",
  race: "mittellaender",
  culture: "bornlaender",
  profession: "katzenhexe",
  professionname: "Katzenhexe (Schöne der Nacht)",
  purse: "-73100",
  xp: { startinglevel: "erfahren" },
  attributes: [
    { id: "mut", level: 14 },
    { id: "klugheit", level: 10 },
    { id: "intuition", level: 14 },
    { id: "charisma", level: 15 },
    { id: "fingerfertigkeit", level: 12 },
    { id: "gewandtheit", level: 13 },
    { id: "konstitution", level: 13 },
    { id: "koerperkraft", level: 9 },
  ],
  basevalues: [
    { id: "lebensenergie" },
    { id: "astralenergie", bought: 2, losses: [{ source: "bindungdesstabes" }] },
  ],
  skills: [
    { id: "fliegen", level: 7 },
    { id: "brettgluecksspiel", level: 0 },
  ],
  combattechniques: [
    { id: "dolche", level: 10 },
    { id: "raufen", level: 8 },
  ],
  spells: [
    { id: "balsamsalabunde", level: 8 },
    { id: "freundschaftslied", level: 4 },
    { id: "duft" },
  ],
  disadvantages: [{ id: "zauberer" }],
  otherobjects: [
    { amount: 1, ruleelement: { id: "becher", type: "equipment" } },
  ],
  meleeweapons: [
    { amount: 1, ruleelement: { id: "dolch", type: "meleeweapon" } },
  ],
  armor: [],
  rangedweapons: [],
  shields: [],
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
    original.runtime.linkedTokenId = "token-1";
    original.runtime.statusDisplayId = "status-1";
    const restored = importHeroJson(JSON.stringify(original));
    expect(restored.runtime.notes).toBe("Testnotiz");
    expect(restored.runtime.linkedTokenId).toBe("token-1");
    expect(restored.runtime.statusDisplayId).toBe("status-1");
  });

  it("migrates backups from before the advancement feature", () => {
    const original = importHeroJson(minimalHero);
    delete (original.runtime as Partial<typeof original.runtime>).advancement;
    const restored = importHeroJson(JSON.stringify(original));
    expect(restored.runtime.advancement).toEqual({
      availableAp: 0,
      spentAp: 0,
      ignoreLimits: false,
      history: [],
    });
  });

  it("migrates old inventory entries into the new category groups once", () => {
    const original = importHeroJson(minimalHero);
    original.hero.belongings ??= {};
    original.hero.belongings.items = {
      provisions: { id: "provisions", name: "Proviant für einen Tag", gr: 8, itemKind: "equipment" },
    };
    delete (original.runtime as Partial<typeof original.runtime>).inventoryCategoriesMigrated;
    const restored = importHeroJson(JSON.stringify(original));
    expect(restored.hero.belongings?.items?.provisions.gr).toBe(10);
    expect(restored.runtime.inventoryCategoriesMigrated).toBe(true);
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

describe("DarkAid import", () => {
  it("imports a TDC hero with all base talents and resources", () => {
    const state = importHeroJson(darkAidHero);
    expect(state.source).toBe("darkaid");
    expect(state.hero.name).toBe("Irinja");
    expect(state.hero.r).toBe("R_1");
    expect(state.hero.ap?.total).toBe(1100);
    expect(getAttributeValues(state.hero)).toMatchObject({ MU: 14, CH: 15, KO: 13 });
    expect(Object.keys(state.hero.talents)).toHaveLength(59);
    expect(state.hero.talents.TAL_1).toBe(7);
    expect(state.hero.talents.TAL_31).toBe(0);
    expect(state.hero.ct).toMatchObject({ CT_3: 10, CT_9: 8 });
    expect(state.runtime.resources.lp).toEqual({ current: 31, max: 31 });
    expect(state.runtime.resources.ae).toEqual({ current: 36, max: 36 });
    expect(state.hero.belongings?.purse).toEqual({ d: "1", s: "9", h: "0", k: "0" });
  });

  it("maps known and DarkAid-specific magic and readable equipment", () => {
    const state = importHeroJson(darkAidHero);
    expect(state.hero.spells?.SPELL_5).toBe(8);
    expect(state.hero.spells?.DARKAID_SPELL_freundschaftslied).toBe(4);
    expect(DARKAID_MAGIC_BY_ID.DARKAID_SPELL_freundschaftslied).toMatchObject({
      name: "Freundschaftslied",
      check: ["IN", "CH", "CH"],
    });
    expect(state.hero.cantrips).toContain("CANTRIP_3");
    expect(Object.values(state.hero.belongings?.items ?? {}).map((item) => item.name)).toEqual(
      expect.arrayContaining(["Becher", "Dolch"]),
    );
    expect(Object.values(state.hero.belongings?.items ?? {}).find((item) => item.name === "Dolch")?.itemKind).toBe("melee");
  });

  it("includes complete editable combat values in the equipment catalogue", () => {
    expect(DARKAID_ITEM_DATA["meleeweapon:dolch"]).toMatchObject({
      damageDiceNumber: 1,
      damageDiceSides: 6,
      damageFlat: 1,
      damageThreshold: 14,
      combatTechnique: "CT_3",
    });
    expect(DARKAID_ITEM_DATA["rangedweapon:handarmbrust"]).toMatchObject({
      reloadTime: 3,
      rangeShort: 5,
      rangeMedium: 25,
      rangeLong: 40,
      ammunition: "bolzen",
    });
    expect(DARKAID_ITEM_DATA["armor:schwerekleidung"]).toMatchObject({
      pro: 1,
      enc: 0,
      movementPenalty: -1,
      initiativePenalty: -1,
    });
  });

  it("sorts common provisions and documents into useful inventory groups", () => {
    expect(suggestInventoryGroup("Proviant für einen Tag", 8)).toBe(10);
    expect(suggestInventoryGroup("Altes Tagebuch", 7)).toBe(11);
    expect(suggestInventoryGroup("Seil, 10 Schritt", 7)).toBe(7);
  });

  it("imports every available public DarkAid sample hero", () => {
    const sampleRoot = fileURLToPath(new URL("../../darkaid-source/samplecharacters", import.meta.url));
    if (!existsSync(sampleRoot)) return;
    const files = readdirSync(sampleRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".tdc"))
      .map((entry) => `${entry.parentPath}/${entry.name}`);
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      const state = importHeroJson(readFileSync(file, "utf8"));
      expect(state.source, file).toBe("darkaid");
      expect(state.hero.name.length, file).toBeGreaterThan(0);
    }
  });

  it("preserves the original TDC inside an Owlbear backup", () => {
    const state = importHeroJson(darkAidHero);
    expect(state.originalData?.version).toBe(7);
    const restored = importHeroJson(JSON.stringify(state));
    expect(restored.source).toBe("darkaid");
    expect(restored.originalData?.profession).toBe("katzenhexe");
  });

  it("imports a real DarkAid fixture when configured", () => {
    const path = process.env.TEST_DARKAID_TDC;
    if (!path) return;
    const state = importHeroJson(readFileSync(path, "utf8"));
    expect(state.source).toBe("darkaid");
    expect(Object.keys(state.hero.talents)).toHaveLength(59);
    expect(state.hero.name.length).toBeGreaterThan(0);
  });
});
