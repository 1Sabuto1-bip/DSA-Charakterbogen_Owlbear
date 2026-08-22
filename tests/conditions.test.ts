import { describe, expect, it } from "vitest";

import {
  calculateCarryingOverview,
  calculateConditionOverview,
  calculatePainLevel,
} from "../src/conditions";
import { createManualState } from "../src/importer";

describe("conditions and carrying capacity", () => {
  it("derives pain from the DSA life-point thresholds", () => {
    expect(calculatePainLevel(28, 28)).toBe(0);
    expect(calculatePainLevel(21, 28)).toBe(1);
    expect(calculatePainLevel(14, 28)).toBe(2);
    expect(calculatePainLevel(7, 28)).toBe(3);
    expect(calculatePainLevel(5, 28)).toBe(4);
  });

  it("calculates capacity as strength times two and one load level per four full stone", () => {
    const state = createManualState("Arbosch", { species: "dwarf" });
    state.hero.attr.values.find((entry) => entry.id === "ATTR_8")!.value = 12;
    state.hero.belongings!.items = {
      pack: { id: "pack", name: "Gepäck", weight: 28, amount: 1, itemKind: "equipment" },
    };
    const overview = calculateCarryingOverview(state);
    expect(overview.capacity).toBe(24);
    expect(overview.overload).toBe(4);
    expect(overview.cargoEncumbrance).toBe(1);
  });

  it("does not count equipped armor twice and applies encumbrance reduction", () => {
    const state = createManualState("Arbosch", { species: "dwarf" });
    state.hero.attr.values.find((entry) => entry.id === "ATTR_8")!.value = 10;
    state.hero.belongings!.items = {
      pack: { id: "pack", name: "Gepäck", weight: 24, amount: 1, itemKind: "equipment" },
      armor: { id: "armor", name: "Kettenhemd", weight: 10, amount: 1, itemKind: "armor", enc: 2, equipped: true },
    };
    state.runtime.conditions.encumbranceReduction = 1;
    const overview = calculateCarryingOverview(state);
    expect(overview.inventoryWeight).toBe(34);
    expect(overview.ignoredArmorWeight).toBe(10);
    expect(overview.countedWeight).toBe(24);
    expect(overview.cargoEncumbrance).toBe(1);
    expect(overview.armorEncumbrance).toBe(2);
    expect(overview.encumbrance).toBe(2);
  });

  it("caps summed penalties at five and marks eight total levels as incapacitating", () => {
    const state = createManualState("Geron");
    state.runtime.conditions.automaticPain = false;
    state.runtime.conditions.levels = {
      stun: 2,
      rapture: 0,
      fear: 1,
      paralysis: 2,
      pain: 0,
      confusion: 3,
    };
    const overview = calculateConditionOverview(state);
    expect(overview.generalPenalty).toBe(5);
    expect(overview.physicalPenalty).toBe(5);
    expect(overview.totalLevels).toBe(8);
    expect(overview.incapacitated).toBe(true);
  });
});
