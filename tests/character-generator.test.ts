import { describe, expect, it } from "vitest";
import {
  GRW_ADVANTAGES,
  GRW_CULTURES,
  GRW_DISADVANTAGES,
  GRW_PROFESSIONS,
  GRW_RACES,
  GRW_SPECIAL_ABILITIES,
  GENERATOR_SHOP_ITEMS,
  buildGeneratedCharacter,
  calculateGeneratorBalance,
  calculateGeneratorShopping,
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
  it("enthält den erweiterten Katalog aus allen fünf Regelwiki-Professionsgruppen", () => {
    expect(GRW_RACES).toHaveLength(12);
    expect(GRW_CULTURES).toHaveLength(40);
    expect(GRW_PROFESSIONS).toHaveLength(564);
    expect(GRW_ADVANTAGES).toHaveLength(134);
    expect(GRW_DISADVANTAGES).toHaveLength(88);
    expect(GRW_SPECIAL_ABILITIES).toHaveLength(1_243);
    expect(new Set(GRW_PROFESSIONS.map((entry) => entry.category))).toEqual(new Set([
      "Weltliche", "Kämpfer", "Ordensleute", "Zauberer", "Geweihte",
    ]));
    expect(GRW_PROFESSIONS.some((entry) => entry.id === "adoruschwertkaempfershindai")).toBe(true);
    expect(GRW_PROFESSIONS.some((entry) => entry.id === "adorumagierdorukha")).toBe(true);
    expect(GRW_PROFESSIONS.some((entry) => entry.id === "tahayaschamanin")).toBe(true);
  });

  it("setzt einen neuen Entwurf einschließlich AP-Konto vollständig zurück", () => {
    const draft = createGeneratorDraft();
    expect(draft.professionId).toBe("");
    expect(draft.useCulturePackage).toBe(false);
    expect(new Set(Object.values(draft.attributes))).toEqual(new Set([8]));
    expect(calculateGeneratorBalance(draft)).toMatchObject({
      budget: 1_100,
      spent: 0,
      remaining: 1_100,
    });
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

  it("berechnet Voraussetzungen eines Professionspakets nicht doppelt", () => {
    const draft = createGeneratorDraft();
    draft.professionId = "katzenhexe";
    const balance = calculateGeneratorBalance(draft);
    expect(balance.profession).toBe(285);
    expect(balance.tradition).toBe(0);
    expect(balance.requiredAdvantages).toBe(0);
    expect(balance.spent).toBe(285);
    expect(balance.remaining).toBe(815);
    expect(balance.advantageLimit).toBe(25);
  });

  it("berücksichtigt Geoden aus Aventurische Magie III für Zwerge", () => {
    const draft = createGeneratorDraft();
    draft.raceId = "zwerge";
    draft.professionId = "dienerdererdmuttergefaehrtedesfeuers";
    const profession = GRW_PROFESSIONS.find((entry) => entry.id === draft.professionId);
    expect(profession?.sourceShortLabel).toBe("AM3");
    expect(getRequiredProfessionComponents(draft).tradition).toEqual({ name: "Tradition (Geoden)", cost: 130 });
  });

  it("löst alle Zauber der eingebundenen Professionspakete auf", () => {
    const spellIds = [...new Set(GRW_PROFESSIONS.flatMap((profession) => profession.spells.map((spell) => spell.id)))];
    expect(spellIds).toHaveLength(279);
    expect(spellIds.filter((id) => !DARKAID_MAGIC_BY_SOURCE_ID[id])).toEqual([]);
  });

  it("berechnet feste und variable Sonderfertigkeiten", () => {
    expect(generatorSpecialAbilityCost({ id: "abrichter", level: 1, variant: "", costOverride: 0 })).toBe(5);
    const variable = GRW_SPECIAL_ABILITIES.find((entry) => "variableCost" in entry);
    expect(variable).toBeDefined();
    expect(generatorSpecialAbilityCost({ id: variable!.id, level: 1, variant: "Auswahl", costOverride: 7 })).toBe(7);
  });

  it("liefert Kurzinfo, Voraussetzungen und Regelwiki-Link für Sonderfertigkeiten", () => {
    const abrichten = GRW_SPECIAL_ABILITIES.find((entry) => entry.id === "abrichter");
    expect(abrichten?.shortDescription).toContain("Abrichten");
    expect(abrichten?.prerequisites).toContain("Tierkunde 8");
    expect(abrichten?.regelwikiUrl).toBe("https://dsa.ulisses-regelwiki.de/suche.html?keywords=Abrichter");
  });

  it("berechnet gestaffelte Sonderfertigkeitskosten bis zur gewählten Stufe", () => {
    const finte = GRW_SPECIAL_ABILITIES.find((entry) => entry.id === "finte");
    expect(finte && "costByLevel" in finte ? finte.costByLevel : undefined).toEqual([15, 20, 25]);
    expect(generatorSpecialAbilityCost({ id: "finte", level: 3, variant: "", costOverride: 0 })).toBe(60);
  });

  it("berechnet feste Vor- und Nachteile mit Stufen", () => {
    expect(generatorTraitCost("advantage", { id: "hohelebenskraft", level: 3, variant: "", costOverride: 0 })).toBe(18);
    expect(generatorTraitCost("disadvantage", { id: "niedrigelebenskraft", level: 3, variant: "", costOverride: 0 })).toBe(-12);
  });

  it("stellt einen durchsuchbaren Ausrüstungskatalog mit Preisen und Kampfwerten bereit", () => {
    expect(GENERATOR_SHOP_ITEMS.length).toBeGreaterThan(1_500);
    expect(GENERATOR_SHOP_ITEMS.find((entry) => entry.catalogId === "meleeweapon:dolch")?.item).toMatchObject({
      name: "Dolch",
      price: 45,
      damageDiceSides: 6,
      combatTechnique: "CT_3",
    });
    expect(GENERATOR_SHOP_ITEMS.find((entry) => entry.catalogId === "armor:kettenhemd")?.item).toMatchObject({
      name: "Kettenhemd",
      price: 250,
      pro: 4,
      enc: 2,
    });
  });

  it("berechnet Startkapital sowie Reich und Arm regelkonform", () => {
    const draft = createGeneratorDraft();
    draft.purchases = [
      { catalogId: "meleeweapon:dolch", amount: 1 },
      { catalogId: "armor:kettenhemd", amount: 1 },
    ];
    expect(calculateGeneratorShopping(draft)).toMatchObject({
      startingCapitalSilver: 750,
      spentSilver: 295,
      remainingSilver: 455,
      itemCount: 2,
    });
    draft.advantages = [{ id: "reich", level: 2, variant: "", costOverride: 0 }];
    expect(calculateGeneratorShopping(draft).startingCapitalSilver).toBe(1_250);
    draft.advantages = [];
    draft.disadvantages = [{ id: "arm", level: 3, variant: "", costOverride: 0 }];
    expect(calculateGeneratorShopping(draft).startingCapitalSilver).toBe(0);
  });

  it("übernimmt gekaufte Waffen, Rüstungen und Restgeld in den Heldenbogen", () => {
    const draft = createGeneratorDraft();
    draft.name = "Alrik";
    draft.professionId = "barde";
    draft.purchases = [
      { catalogId: "meleeweapon:dolch", amount: 1 },
      { catalogId: "armor:kettenhemd", amount: 1 },
    ];
    const state = buildGeneratedCharacter(draft);
    const items = Object.values(state.hero.belongings?.items ?? {});
    expect(items.find((item) => item.name === "Dolch")).toMatchObject({ itemKind: "melee", price: 45, amount: 1 });
    expect(items.find((item) => item.name === "Kettenhemd")).toMatchObject({ itemKind: "armor", pro: 4, enc: 2 });
    expect(state.hero.belongings?.purse).toEqual({ d: "45", s: "5", h: "0", k: "0" });
    expect(state.runtime.combat.primaryWeaponId).toContain("meleeweapon_dolch");
  });

  it("verhindert einen Einkauf über dem verfügbaren Startkapital", () => {
    const draft = createGeneratorDraft();
    draft.name = "Alrik";
    draft.purchases = [{ catalogId: "armor:kettenhemdbikini", amount: 1 }];
    expect(validateGeneratorDraft(draft).errors.some((entry) => entry.includes("Einkauf"))).toBe(true);
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
