import { describe, expect, it } from "vitest";
import {
  allowedEquipmentSlots,
  assignEquipmentToAvailableSlots,
  calculateEquipmentZones,
  equipmentProtectionForSlot,
  normalizeEquipmentSlots,
} from "../src/equipment-zones";
import type { OptolithItem } from "../src/types";

const item = (id: string, protection: number): OptolithItem => ({
  id,
  name: id,
  itemKind: "armor",
  pro: protection,
});

describe("Trefferzonen-Ausrüstung", () => {
  it("berechnet das abgestimmte Beispiel mit Belastungswert 42", () => {
    const items = {
      helm: { ...item("helm", 0), name: "Sturmhaube", itemKind: "helmet" as const, zoneProtection: 2 },
      torso: { ...item("torso", 4), name: "Kettenhemd" },
      left: { ...item("left", 4), name: "Metallarmschiene", armorZone: "Arme" as const },
      right: { ...item("right", 2), name: "Lederarmschiene", armorZone: "Arme" as const },
      legs: { ...item("legs", 2), name: "Lederbeinschutz", armorZone: "Beine" as const },
      boots: { ...item("boots", 9), name: "Reisestiefel", itemKind: "equipment" as const },
    };
    const result = calculateEquipmentZones(items, {
      head: "helm", torso: "torso", leftArm: "left", rightArm: "right", legs: "legs", footwear: "boots",
    });
    expect(result.entries.map((entry) => entry.protection)).toEqual([2, 4, 4, 2, 2, 0]);
    expect(result.protectionScore).toBe(42);
    expect(result.encumbrance).toBe(1);
    expect(result.movementPenalty).toBe(1);
    expect(result.initiativePenalty).toBe(1);
  });

  it("wendet die Grenzen der Trefferzonen-Belastung an", () => {
    const torso = (protection: number) => calculateEquipmentZones({ armor: item("armor", protection) }, { torso: "armor" });
    expect(torso(0)).toMatchObject({ protectionScore: 0, encumbrance: 0, movementPenalty: 0 });
    expect(torso(2)).toMatchObject({ protectionScore: 10, encumbrance: 0, movementPenalty: 1 });
    expect(torso(3)).toMatchObject({ protectionScore: 15, encumbrance: 1, movementPenalty: 0 });
    expect(torso(6)).toMatchObject({ protectionScore: 30, encumbrance: 1, movementPenalty: 1 });
    expect(torso(9)).toMatchObject({ protectionScore: 45, encumbrance: 2, movementPenalty: 0 });
  });

  it("lässt ungültige Zuordnungen weg und legt den Rest in den Rucksack", () => {
    const items = { armor: { ...item("armor", 3), name: "Kettenhemd" }, rope: { ...item("rope", 0), name: "Seil", itemKind: "equipment" as const } };
    expect(normalizeEquipmentSlots({ torso: "missing", head: "armor" }, items)).toEqual({});
    const result = calculateEquipmentZones(items, { torso: "armor" });
    expect(result.assignedItemIds).toEqual(["armor"]);
    expect(result.backpackItemIds).toEqual(["rope"]);
    expect(equipmentProtectionForSlot(items.armor, "footwear")).toBe(0);
  });

  it("bietet Gegenstände nur in ihrer vorgesehenen Körperzone an", () => {
    expect(allowedEquipmentSlots({ ...item("chain", 4), name: "Kettenhemd" })).toEqual(["torso"]);
    expect(allowedEquipmentSlots({ ...item("helmet", 2), name: "Topfhelm", itemKind: "helmet" })).toEqual(["head"]);
    expect(allowedEquipmentSlots({ ...item("arm", 2), name: "Lederarmschiene" })).toEqual(["leftArm", "rightArm"]);
    expect(allowedEquipmentSlots({ ...item("leg", 2), name: "Beinschiene" })).toEqual(["legs"]);
    expect(allowedEquipmentSlots({ ...item("shoe", 0), name: "Reisestiefel", itemKind: "equipment" })).toEqual(["footwear"]);
    expect(allowedEquipmentSlots({ ...item("rope", 0), name: "Seil", itemKind: "equipment" })).toEqual([]);
  });

  it("benötigt für beide Arme auch zwei einzelne Armschienen", () => {
    const single = { arm: { ...item("arm", 2), name: "Metallarmschiene", amount: 1 } };
    expect(normalizeEquipmentSlots({ leftArm: "arm", rightArm: "arm" }, single)).toEqual({ leftArm: "arm" });
    expect(assignEquipmentToAvailableSlots({}, "arm", single)).toEqual({ leftArm: "arm" });
    const pair = { arm: { ...single.arm, amount: 2 } };
    expect(assignEquipmentToAvailableSlots({}, "arm", pair)).toEqual({ leftArm: "arm", rightArm: "arm" });
  });
});
