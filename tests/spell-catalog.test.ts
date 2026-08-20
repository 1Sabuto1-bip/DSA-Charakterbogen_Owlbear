import { describe, expect, it } from "vitest";

import { CANTRIPS } from "../src/magic-data";
import { ALL_SPELLS, ALL_SPELL_BY_ID, normalizeMagicName } from "../src/spell-catalog";

describe("combined spell catalog", () => {
  it("combines every available Optolith and DarkAid spell without duplicate names", () => {
    const names = ALL_SPELLS.map((definition) => normalizeMagicName(definition.name));
    expect(new Set(names).size).toBe(names.length);
    expect(ALL_SPELLS).toHaveLength(541);
    expect(ALL_SPELLS.filter((definition) => definition.check)).toHaveLength(533);
  });

  it("contains DarkAid-only magic with its rule values", () => {
    const cryptographo = ALL_SPELLS.find((definition) => definition.name === "Cryptographo");
    expect(cryptographo).toMatchObject({
      check: ["KL", "KL", "IN"],
      kind: "Zauber",
      improvementCost: "B",
    });
    expect(cryptographo && ALL_SPELL_BY_ID[cryptographo.id]).toBe(cryptographo);
  });

  it("keeps Zaubertricks in their own catalog", () => {
    const cantripNames = new Set(Object.values(CANTRIPS).map(normalizeMagicName));
    expect(ALL_SPELLS.every((definition) => !cantripNames.has(normalizeMagicName(definition.name)))).toBe(true);
    expect(ALL_SPELLS.some((definition) => definition.name === "Ausziehen von Zauberhand")).toBe(false);
  });

  it("keeps known catalog entries even when the source has no roll check", () => {
    expect(ALL_SPELLS.some((definition) => !definition.check)).toBe(true);
  });
});
