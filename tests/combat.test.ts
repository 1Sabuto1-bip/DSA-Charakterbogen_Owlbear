import { describe, expect, it } from "vitest";
import { calculateCombatOverview, getDefaultPrimaryWeaponId, rollInitiative } from "../src/combat";
import type { OptolithHero } from "../src/types";

const hero: OptolithHero = {
  clientVersion: "test",
  id: "COMBAT_TEST",
  name: "Arbosch",
  attr: {
    values: [
      { id: "ATTR_1", value: 14 },
      { id: "ATTR_2", value: 10 },
      { id: "ATTR_3", value: 11 },
      { id: "ATTR_4", value: 9 },
      { id: "ATTR_5", value: 11 },
      { id: "ATTR_6", value: 14 },
      { id: "ATTR_7", value: 13 },
      { id: "ATTR_8", value: 12 },
    ],
  },
  talents: {},
  ct: { CT_2: 10, CT_10: 12, CT_12: 12 },
  belongings: {
    items: {
      sword: {
        id: "sword",
        name: "Langschwert",
        itemKind: "melee",
        combatTechnique: "CT_12",
        at: 1,
        pa: 0,
        equipped: true,
      },
      bow: {
        id: "bow",
        name: "Kurzbogen",
        itemKind: "ranged",
        combatTechnique: "CT_2",
        equipped: true,
      },
      shield: {
        id: "shield",
        name: "Holzschild",
        itemKind: "shield",
        combatTechnique: "CT_10",
        at: -4,
        pa: 1,
        equipped: true,
      },
      armor: {
        id: "armor",
        name: "Kettenhemd",
        itemKind: "armor",
        enc: 2,
        equipped: true,
      },
    },
  },
};

describe("combat overview", () => {
  it("selects a useful default primary weapon", () => {
    expect(getDefaultPrimaryWeaponId(hero)).toBe("sword");
  });

  it("calculates AT, PA, dodge and initiative for a melee weapon", () => {
    const result = calculateCombatOverview(hero, "sword", 1);
    expect(result).toMatchObject({
      primaryWeaponName: "Langschwert",
      attackLabel: "AT",
      attack: 15,
      parry: 9,
      dodge: 7,
      initiativeBase: 14,
      armorModifier: -2,
      initiative: 13,
    });
  });

  it("uses FF for ranged combat and doubles a shield's active PA bonus", () => {
    expect(calculateCombatOverview(hero, "bow")).toMatchObject({ attackLabel: "FK", attack: 11, parry: undefined });
    expect(calculateCombatOverview(hero, "shield")).toMatchObject({ attackLabel: "AT", attack: 10, parry: 9 });
  });

  it("rolls initiative as effective initiative plus 1W6", () => {
    const overview = calculateCombatOverview(hero, "sword", 1);
    expect(rollInitiative(overview, () => 0.5)).toMatchObject({ die: 4, total: 17, base: 14, armorModifier: -2, manualModifier: 1 });
  });
});
