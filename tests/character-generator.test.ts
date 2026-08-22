import { describe, expect, it } from "vitest";
import {
  GRW_ADVANTAGES,
  GRW_CULTURES,
  GRW_DISADVANTAGES,
  GRW_PROFESSIONS,
  GRW_RACES,
  GRW_SPECIAL_ABILITIES,
  buildGeneratedCharacter,
  calculateGeneratorBalance,
  createGeneratorDraft,
  generatorAttributeCost,
  generatorSpecialAbilityCost,
  generatorTraitCost,
  getGeneratorAttributeMaximum,
  getRequiredProfessionComponents,
  normalizeGeneratorDraft,
  validateGeneratorDraft,
} from "../src/character-generator";
import { DARKAID_MAGIC_BY_SOURCE_ID } from "../src/darkaid-data";

describe("DSA5-Regelwerksgenerator", () => {
  it("enthält die Kataloge aus Grundregelwerk, Kompendium und Magie I bis III", () => {
    expect(GRW_RACES).toHaveLength(12);
    expect(GRW_CULTURES).toHaveLength(32);
    expect(GRW_PROFESSIONS).toHaveLength(271);
    expect(GRW_ADVANTAGES).toHaveLength(68);
    expect(GRW_DISADVANTAGES).toHaveLength(68);
    expect(GRW_SPECIAL_ABILITIES).toHaveLength(482);
  });

  it("berechnet die Eigenschaftskosten über 14 korrekt", () => {
    const draft = createGeneratorDraft();
    draft.experienceId = "kompetent";
    draft.attributes = { MU: 15, KL: 8, IN: 8, CH: 8, FF: 8, GE: 8, KO: 8, KK: 8 };
    expect(generatorAttributeCost(draft)).toBe(120);
  });

  it("wendet die Spezies-Maxima für Elfen und Zwerge an", () => {
    const elf = createGeneratorDraft();
    elf.raceId = "auelfen";
    elf.negativeAttribute = "KL";
    normalizeGeneratorDraft(elf);
    expect(getGeneratorAttributeMaximum(elf, "IN")).toBe(15);
    expect(getGeneratorAttributeMaximum(elf, "GE")).toBe(15);
    expect(getGeneratorAttributeMaximum(elf, "KL")).toBe(12);

    const dwarf = createGeneratorDraft();
    dwarf.raceId = "zwerge";
    dwarf.negativeAttribute = "CH";
    normalizeGeneratorDraft(dwarf);
    expect(getGeneratorAttributeMaximum(dwarf, "KO")).toBe(15);
    expect(getGeneratorAttributeMaximum(dwarf, "KK")).toBe(15);
    expect(getGeneratorAttributeMaximum(dwarf, "CH")).toBe(12);
  });

  it("berücksichtigt Pflichtvorteil und Tradition magischer Professionen", () => {
    const draft = createGeneratorDraft();
    draft.professionId = "katzenhexe";
    const required = getRequiredProfessionComponents(draft);
    expect(required.advantages.map((entry) => entry.id)).toContain("zauberer");
    expect(required.tradition).toEqual({ name: "Tradition (Hexen)", cost: 135 });
  });

  it("berücksichtigt Geoden aus Aventurische Magie III für Zwerge", () => {
    const draft = createGeneratorDraft();
    draft.raceId = "zwerge";
    draft.professionId = "dienerdererdmuttergefaehrtedesfeuers";
    const profession = GRW_PROFESSIONS.find((entry) => entry.id === draft.professionId);
    expect(profession?.sourceShortLabel).toBe("AM III");
    expect(getRequiredProfessionComponents(draft).tradition).toEqual({ name: "Tradition (Geoden)", cost: 130 });
  });

  it("löst alle Zauber der eingebundenen Professionspakete auf", () => {
    const spellIds = [...new Set(GRW_PROFESSIONS.flatMap((profession) => profession.spells.map((spell) => spell.id)))];
    expect(spellIds).toHaveLength(238);
    expect(spellIds.filter((id) => !DARKAID_MAGIC_BY_SOURCE_ID[id])).toEqual([]);
  });

  it("berechnet feste und variable Sonderfertigkeiten", () => {
    expect(generatorSpecialAbilityCost({ id: "abrichter", level: 1, variant: "", costOverride: 0 })).toBe(5);
    const variable = GRW_SPECIAL_ABILITIES.find((entry) => "variableCost" in entry);
    expect(variable).toBeDefined();
    expect(generatorSpecialAbilityCost({ id: variable!.id, level: 1, variant: "Auswahl", costOverride: 7 })).toBe(7);
  });

  it("berechnet feste Vor- und Nachteile mit Stufen", () => {
    expect(generatorTraitCost("advantage", { id: "hohelebenskraft", level: 3, variant: "", costOverride: 0 })).toBe(18);
    expect(generatorTraitCost("disadvantage", { id: "niedrigelebenskraft", level: 3, variant: "", costOverride: 0 })).toBe(-12);
  });

  it("erzeugt einen zwergischen Bogen mit Kultur- und Professionswerten", () => {
    const draft = createGeneratorDraft();
    draft.name = "Arbosch";
    draft.raceId = "zwerge";
    draft.cultureId = "ambosszwerge";
    draft.professionId = "soeldner";
    draft.attributes = { MU: 12, KL: 12, IN: 12, CH: 10, FF: 12, GE: 12, KO: 15, KK: 15 };
    normalizeGeneratorDraft(draft);
    const state = buildGeneratedCharacter(draft);
    expect(state.hero.r).toBe("R_4");
    expect(state.hero.biography?.species).toBe("Zwerge");
    expect(state.hero.biography?.culture).toBe("Ambosszwerge");
    expect(state.runtime.resources.lp.max).toBe(8 + state.hero.attr.values.find((entry) => entry.id === "ATTR_7")!.value * 2);
    expect(state.hero.ct?.CT_1).toBe(10);
    expect(state.runtime.advancement.availableAp).toBe(calculateGeneratorBalance(draft).remaining);
  });

  it("blockiert negative AP und die 80-AP-Grenzen", () => {
    const draft = createGeneratorDraft();
    draft.name = "Alrik";
    draft.professionId = "hesindegeweihter";
    draft.advantages = [{ id: "glueck", level: 3, variant: "", costOverride: 0 }];
    const validation = validateGeneratorDraft(draft);
    expect(validation.errors.some((entry) => entry.includes("Vorteile"))).toBe(true);
  });
});
