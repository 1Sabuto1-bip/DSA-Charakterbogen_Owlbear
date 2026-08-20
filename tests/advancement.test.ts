import { describe, expect, it } from "vitest";

import {
  combatTechniqueMaximum,
  improvementCostForTarget,
  talentMaximum,
} from "../src/advancement";
import type { CombatTechniqueDefinition, TalentDefinition } from "../src/types";

describe("DSA-5-Steigerungskosten", () => {
  it("berechnet die Spalten A bis D bis 12 und darüber", () => {
    expect(improvementCostForTarget("A", 12)).toBe(1);
    expect(improvementCostForTarget("B", 13)).toBe(4);
    expect(improvementCostForTarget("C", 14)).toBe(9);
    expect(improvementCostForTarget("D", 16)).toBe(20);
  });

  it("berechnet Eigenschaftskosten nach Spalte E", () => {
    expect(improvementCostForTarget("E", 14)).toBe(15);
    expect(improvementCostForTarget("E", 15)).toBe(30);
    expect(improvementCostForTarget("E", 16)).toBe(45);
    expect(improvementCostForTarget("E", 25)).toBe(180);
  });
});

describe("DSA-5-Maximalwerte", () => {
  const attributes = { MU: 12, KL: 13, IN: 14, CH: 10, FF: 11, GE: 15, KO: 12, KK: 14 };

  it("nutzt für Talente die höchste beteiligte Eigenschaft plus 2", () => {
    const talent: TalentDefinition = {
      id: "TAL_TEST",
      name: "Test",
      check: ["MU", "GE", "KK"],
      category: "Körper",
      improvementCost: "C",
    };
    expect(talentMaximum(talent, attributes)).toBe(17);
  });

  it("nutzt für Kampftechniken die höchste Leiteigenschaft plus 2", () => {
    const technique: CombatTechniqueDefinition = {
      id: "CT_TEST",
      name: "Test",
      improvementCost: "C",
      primaryAttributes: ["GE", "KK"],
      range: "melee",
    };
    expect(combatTechniqueMaximum(technique, attributes)).toBe(17);
  });
});
