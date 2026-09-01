import { ATTRIBUTES, COMBAT_TECHNIQUES, COMBAT_TECHNIQUE_RULES, TALENTS, suggestInventoryGroup } from "./data";
import { DARKAID_MAGIC_BY_SOURCE_ID } from "./darkaid-data";
import { ARMORY_ITEM_CATALOG, COMPLETE_ARMORY_ITEM_INFO } from "./armory-catalog";
import { GRW_CHARACTER_DATA } from "./grw-character-data";
import { improvementCostForTarget } from "./advancement";
import { createManualState, getAttributeValues } from "./importer";
import { getDefaultPrimaryWeaponId } from "./combat";
import { AVAILABLE_EQUIPMENT_PACKAGES, EQUIPMENT_PACKAGE_BY_ID, EQUIPMENT_PACKAGES } from "./equipment-package-data";
import { ALL_SPELLS, normalizeMagicName } from "./spell-catalog";
import { assignEquipmentToAvailableSlots, calculateEquipmentZones, normalizeEquipmentSlots } from "./equipment-zones";
import type {
  AttributeCode,
  BiographyTrait,
  CharacterSheetState,
  CombatItemKind,
  EquipmentBodySlot,
  EquipmentBodySlots,
  ImprovementCost,
  ManualSpecies,
  OptolithItem,
  SpellDefinition,
} from "./types";

export type GeneratorTraitKind = "advantage" | "disadvantage";

export interface GeneratorTraitSelection {
  id: string;
  level: number;
  variant: string;
  costOverride: number;
}

export interface GeneratorSpecialAbilitySelection {
  id: string;
  level: number;
  variant: string;
  costOverride: number;
}

export interface GeneratorPurchase {
  catalogId: string;
  amount: number;
}

export type GeneratorShopCategory = "weapons" | "armor" | "helmets" | "equipment";

export interface GeneratorShopItem {
  catalogId: string;
  category: GeneratorShopCategory;
  kindLabel: string;
  itemKind: CombatItemKind;
  item: Partial<OptolithItem> & { name: string; price: number };
  info?: import("./armory-data").ArmoryItemInfo;
}

export interface GeneratorShoppingBalance {
  startingCapitalSilver: number;
  spentSilver: number;
  remainingSilver: number;
  itemCount: number;
  totalWeight: number;
}

export interface GeneratorDraft {
  step: number;
  name: string;
  sex: "m" | "f" | "d";
  concept: string;
  experienceId: string;
  raceId: string;
  cultureId: string;
  useCulturePackage: boolean;
  positiveAttribute: AttributeCode;
  negativeAttribute: AttributeCode;
  attributes: Record<AttributeCode, number>;
  professionId: string;
  combatChoices: Record<string, string[]>;
  spellChoices: Record<string, string[]>;
  advantages: GeneratorTraitSelection[];
  disadvantages: GeneratorTraitSelection[];
  specialAbilities: GeneratorSpecialAbilitySelection[];
  talentIncreases: Record<string, number>;
  magicallyGifted: boolean;
  spellIncreases: Record<string, number>;
  purchases: GeneratorPurchase[];
  equipmentSlots: EquipmentBodySlots;
}

export interface GeneratorBalance {
  budget: number;
  species: number;
  attributes: number;
  culture: number;
  profession: number;
  tradition: number;
  requiredAdvantages: number;
  advantages: number;
  requiredDisadvantages: number;
  disadvantages: number;
  specialAbilities: number;
  talents: number;
  spells: number;
  spent: number;
  remaining: number;
  advantageLimit: number;
  disadvantageLimit: number;
}

export interface GeneratorValidation {
  errors: string[];
  warnings: string[];
}

type Experience = (typeof GRW_CHARACTER_DATA.experiences)[number];
type Species = (typeof GRW_CHARACTER_DATA.species)[number];
type Race = (typeof GRW_CHARACTER_DATA.races)[number];
type Culture = (typeof GRW_CHARACTER_DATA.cultures)[number];
interface Profession {
  readonly id: string;
  readonly baseId: string;
  readonly variantId?: string;
  readonly name: string;
  readonly femaleName: string;
  readonly group: string;
  readonly category: "Weltliche" | "Kämpfer" | "Ordensleute" | "Zauberer" | "Geweihte";
  readonly page: number;
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly sourceShortLabel: string;
  readonly requiredCultures: readonly string[];
  readonly requiredSex?: string;
  readonly requiredAdvantages: ReadonlyArray<{ readonly id: string; readonly level: number; readonly variant: string }>;
  readonly requiredDisadvantages: ReadonlyArray<{ readonly id: string; readonly level: number; readonly variant: string }>;
  readonly ap: number;
  readonly skills: ReadonlyArray<{ readonly id: string; readonly level: number }>;
  readonly combat: ReadonlyArray<{ readonly id: string; readonly level: number }>;
  readonly combatChoices: ReadonlyArray<{
    readonly id: string;
    readonly count: number;
    readonly options: ReadonlyArray<{ readonly id: string; readonly level: number }>;
  }>;
  readonly spells: ReadonlyArray<{ readonly id: string; readonly level: number }>;
  readonly spellSelections: ReadonlyArray<{ readonly id: string; readonly count: number; readonly options: readonly string[] }>;
  readonly chants: ReadonlyArray<{ readonly id: string; readonly level: number }>;
  readonly blessings: readonly string[];
  readonly specialAbilities: readonly string[];
  readonly magical?: boolean;
  readonly blessed?: boolean;
  readonly tradition?: string;
  readonly traditionCost?: number;
  readonly primaryAttribute?: string;
}
type TraitDefinition = (typeof GRW_CHARACTER_DATA.advantages)[number] | (typeof GRW_CHARACTER_DATA.disadvantages)[number];
type SpecialAbilityDefinition = (typeof GRW_CHARACTER_DATA.specialAbilities)[number];

export const GENERATOR_STEPS = [
  "Konzept",
  "Erfahrung",
  "Herkunft",
  "Eigenschaften",
  "Profession",
  "Vor- & Nachteile",
  "Sonderfertigkeiten",
  "Rüstkammer",
  "Talente & Zauber",
  "Prüfen",
] as const;

export const GRW_EXPERIENCES = GRW_CHARACTER_DATA.experiences;
export const GRW_SPECIES = GRW_CHARACTER_DATA.species;
export const GRW_RACES = GRW_CHARACTER_DATA.races;
export const GRW_CULTURES = GRW_CHARACTER_DATA.cultures;
export const GRW_PROFESSIONS = GRW_CHARACTER_DATA.professions as readonly Profession[];
export const GRW_ADVANTAGES = GRW_CHARACTER_DATA.advantages;
export const GRW_DISADVANTAGES = GRW_CHARACTER_DATA.disadvantages;
export const GRW_SPECIAL_ABILITIES = GRW_CHARACTER_DATA.specialAbilities;
export const GENERATOR_SOURCES = GRW_CHARACTER_DATA.sources;
export { AVAILABLE_EQUIPMENT_PACKAGES, EQUIPMENT_PACKAGES };

const isGeneratorImprovementCost = (value: string): value is ImprovementCost => ["A", "B", "C", "D"].includes(value);

/** Zauber mit vollständigem Steigerungsfaktor; nicht steigerbare Platzhalter bleiben außen vor. */
export const GENERATOR_SPELLS: readonly SpellDefinition[] = ALL_SPELLS
  .filter((definition) => isGeneratorImprovementCost(definition.improvementCost));

const generatorSpellById = Object.fromEntries(GENERATOR_SPELLS.map((entry) => [entry.id, entry])) as Record<string, SpellDefinition>;
const generatorSpellByName = Object.fromEntries(GENERATOR_SPELLS.map((entry) => [normalizeMagicName(entry.name), entry])) as Record<string, SpellDefinition>;

export const getGeneratorSpellDefinition = (id: string): SpellDefinition | undefined => generatorSpellById[id];

const shopKind = (catalogId: string): Pick<GeneratorShopItem, "category" | "kindLabel" | "itemKind"> | undefined => {
  if (catalogId.startsWith("meleeweapon:")) return { category: "weapons", kindLabel: "Nahkampfwaffe", itemKind: "melee" };
  if (catalogId.startsWith("rangedweapon:")) return { category: "weapons", kindLabel: "Fernkampfwaffe", itemKind: "ranged" };
  if (catalogId.startsWith("shield:")) return { category: "weapons", kindLabel: "Schild", itemKind: "shield" };
  if (catalogId.startsWith("armor:")) return { category: "armor", kindLabel: "Rüstung", itemKind: "armor" };
  if (catalogId.startsWith("helmet:")) return { category: "helmets", kindLabel: "Helm", itemKind: "helmet" };
  if (catalogId.startsWith("equipment:")) return { category: "equipment", kindLabel: "Ausrüstung", itemKind: "equipment" };
  return undefined;
};

export const GENERATOR_SHOP_ITEMS: readonly GeneratorShopItem[] = Object.entries(ARMORY_ITEM_CATALOG)
  .flatMap(([catalogId, item]) => {
    const kind = shopKind(catalogId);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const price = Number(item.price);
    if (!kind || !name || name.includes("%") || !Number.isFinite(price) || price < 0) return [];
    return [{
      catalogId,
      ...kind,
      item: { ...item, name, price },
      info: COMPLETE_ARMORY_ITEM_INFO[catalogId],
    }];
  })
  .sort((a, b) => a.item.name.localeCompare(b.item.name, "de"));

const shopItemById = Object.fromEntries(GENERATOR_SHOP_ITEMS.map((entry) => [entry.catalogId, entry])) as Record<string, GeneratorShopItem>;

export const getGeneratorShopItem = (catalogId: string): GeneratorShopItem | undefined => shopItemById[catalogId];

const experienceById = Object.fromEntries(GRW_EXPERIENCES.map((entry) => [entry.id, entry])) as Record<string, Experience>;
const speciesById = Object.fromEntries(GRW_SPECIES.map((entry) => [entry.id, entry])) as Record<string, Species>;
const raceById = Object.fromEntries(GRW_RACES.map((entry) => [entry.id, entry])) as Record<string, Race>;
const cultureById = Object.fromEntries(GRW_CULTURES.map((entry) => [entry.id, entry])) as Record<string, Culture>;
const professionById = Object.fromEntries(GRW_PROFESSIONS.map((entry) => [entry.id, entry])) as Record<string, Profession>;
const advantageById = Object.fromEntries(GRW_ADVANTAGES.map((entry) => [entry.id, entry])) as Record<string, TraitDefinition>;
const disadvantageById = Object.fromEntries(GRW_DISADVANTAGES.map((entry) => [entry.id, entry])) as Record<string, TraitDefinition>;
const specialAbilityById = Object.fromEntries(GRW_SPECIAL_ABILITIES.map((entry) => [entry.id, entry])) as Record<string, SpecialAbilityDefinition>;

const defaultAttributes = (): Record<AttributeCode, number> => ({
  MU: 8,
  KL: 8,
  IN: 8,
  CH: 8,
  FF: 8,
  GE: 8,
  KO: 8,
  KK: 8,
});

const EMPTY_PROFESSION: Profession = {
  id: "",
  baseId: "",
  name: "Noch keine Profession gewählt",
  femaleName: "Noch keine Profession gewählt",
  group: "",
  category: "Weltliche",
  page: 0,
  sourceId: "",
  sourceLabel: "",
  sourceShortLabel: "",
  requiredCultures: [],
  requiredAdvantages: [],
  requiredDisadvantages: [],
  ap: 0,
  skills: [],
  combat: [],
  combatChoices: [],
  spells: [],
  spellSelections: [],
  chants: [],
  blessings: [],
  specialAbilities: [],
};

export const createGeneratorDraft = (): GeneratorDraft => {
  const draft: GeneratorDraft = {
    step: 0,
    name: "",
    sex: "d",
    concept: "",
    experienceId: "erfahren",
    raceId: "mittellaender",
    cultureId: "mittelreicher",
    useCulturePackage: false,
    positiveAttribute: "MU",
    negativeAttribute: "KL",
    attributes: defaultAttributes(),
    professionId: "",
    combatChoices: {},
    spellChoices: {},
    advantages: [],
    disadvantages: [],
    specialAbilities: [],
    talentIncreases: {},
    magicallyGifted: false,
    spellIncreases: {},
    purchases: [],
    equipmentSlots: {},
  };
  normalizeGeneratorDraft(draft);
  return draft;
};

export const getGeneratorExperience = (draft: GeneratorDraft): Experience =>
  experienceById[draft.experienceId] ?? experienceById.erfahren;

export const getGeneratorRace = (draft: GeneratorDraft): Race =>
  raceById[draft.raceId] ?? raceById.mittellaender;

export const getGeneratorSpecies = (draft: GeneratorDraft): Species =>
  speciesById[getGeneratorRace(draft).speciesId] ?? speciesById.menschen;

export const getGeneratorCulture = (draft: GeneratorDraft): Culture =>
  cultureById[draft.cultureId] ?? cultureById.mittelreicher;

export const getGeneratorProfession = (draft: GeneratorDraft): Profession =>
  professionById[draft.professionId] ?? EMPTY_PROFESSION;

export const isGeneratorMagicAutomatic = (draft: GeneratorDraft): boolean =>
  getGeneratorProfession(draft).magical === true || getGeneratorSpecies(draft).id === "elfen";

export const isGeneratorMagicallyGifted = (draft: GeneratorDraft): boolean =>
  Boolean(draft.magicallyGifted) || isGeneratorMagicAutomatic(draft);

const canonicalProfessionSpell = (sourceId: string): SpellDefinition | undefined => {
  const sourceDefinition = DARKAID_MAGIC_BY_SOURCE_ID[sourceId];
  if (!sourceDefinition) return undefined;
  return generatorSpellByName[normalizeMagicName(sourceDefinition.name)];
};

export const getGeneratorBaseSpellValues = (draft: GeneratorDraft): Record<string, number> => {
  const values: Record<string, number> = {};
  for (const entry of getGeneratorProfession(draft).spells) {
    const definition = canonicalProfessionSpell(entry.id);
    if (definition) values[definition.id] = Math.max(values[definition.id] ?? 0, entry.level);
  }
  return values;
};

export const getGeneratorSpellValue = (draft: GeneratorDraft, spellId: string): number => {
  const base = getGeneratorBaseSpellValues(draft)[spellId] ?? 0;
  return Math.max(base, Number(draft.spellIncreases?.[spellId]) || 0);
};

export const getGeneratorSpellCount = (draft: GeneratorDraft): number => new Set([
  ...Object.keys(getGeneratorBaseSpellValues(draft)),
  ...Object.keys(draft.spellIncreases ?? {}),
]).size;

export const generatorSpellCostFor = (draft: GeneratorDraft, spellId: string): number => {
  const definition = generatorSpellById[spellId];
  if (!definition || !isGeneratorImprovementCost(definition.improvementCost)) return 0;
  const base = getGeneratorBaseSpellValues(draft)[spellId] ?? 0;
  const manuallyActivated = Object.prototype.hasOwnProperty.call(draft.spellIncreases ?? {}, spellId);
  const target = Math.max(base, Math.trunc(Number(draft.spellIncreases?.[spellId]) || 0));
  let cost = base === 0 && manuallyActivated ? improvementCostForTarget(definition.improvementCost, 1) : 0;
  for (let value = base + 1; value <= target; value += 1) cost += improvementCostForTarget(definition.improvementCost, value);
  return cost;
};

export const generatorSpellNextCost = (draft: GeneratorDraft, spellId: string): number => {
  const definition = generatorSpellById[spellId];
  if (!definition || !isGeneratorImprovementCost(definition.improvementCost)) return 0;
  const base = getGeneratorBaseSpellValues(draft)[spellId] ?? 0;
  const manuallyActivated = Object.prototype.hasOwnProperty.call(draft.spellIncreases ?? {}, spellId);
  if (base === 0 && !manuallyActivated) return improvementCostForTarget(definition.improvementCost, 1);
  return improvementCostForTarget(definition.improvementCost, getGeneratorSpellValue(draft, spellId) + 1);
};

export const generatorSpellCost = (draft: GeneratorDraft): number => Object.keys(draft.spellIncreases ?? {})
  .reduce((sum, spellId) => sum + generatorSpellCostFor(draft, spellId), 0);

export const getGeneratorBaseTalentValues = (draft: GeneratorDraft): Record<string, number> => {
  const values = Object.fromEntries(TALENTS.map((entry) => [entry.id, 0])) as Record<string, number>;
  const culture = getGeneratorCulture(draft);
  const profession = getGeneratorProfession(draft);
  if (draft.useCulturePackage) {
    for (const entry of culture.packageSkills) {
      const id = GRW_CHARACTER_DATA.skillIds[entry.id as keyof typeof GRW_CHARACTER_DATA.skillIds];
      if (id) values[id] = (values[id] ?? 0) + entry.level;
    }
  }
  for (const entry of profession.skills) {
    const id = GRW_CHARACTER_DATA.skillIds[entry.id as keyof typeof GRW_CHARACTER_DATA.skillIds];
    if (id) values[id] = (values[id] ?? 0) + entry.level;
  }
  return values;
};

export const getGeneratorTalentValue = (draft: GeneratorDraft, talentId: string): number => {
  const base = getGeneratorBaseTalentValues(draft)[talentId] ?? 0;
  return Math.max(base, Number(draft.talentIncreases?.[talentId]) || base);
};

export const generatorTalentCostFor = (draft: GeneratorDraft, talentId: string, targetValue?: number): number => {
  const definition = TALENTS.find((entry) => entry.id === talentId);
  if (!definition) return 0;
  const base = getGeneratorBaseTalentValues(draft)[talentId] ?? 0;
  const target = Math.max(base, Math.trunc(targetValue ?? getGeneratorTalentValue(draft, talentId)));
  let cost = 0;
  for (let value = base + 1; value <= target; value += 1) cost += improvementCostForTarget(definition.improvementCost, value);
  return cost;
};

export const generatorTalentCost = (draft: GeneratorDraft): number => Object.keys(draft.talentIncreases ?? {})
  .reduce((sum, talentId) => sum + generatorTalentCostFor(draft, talentId), 0);

const choiceKey = (profession: Profession, choiceId: string): string => `${profession.id}:${choiceId}`;

export const normalizeGeneratorDraft = (draft: GeneratorDraft): void => {
  draft.step = Math.max(0, Math.min(GENERATOR_STEPS.length - 1, Math.round(Number(draft.step) || 0)));
  const mergedPurchases = new Map<string, number>();
  for (const purchase of Array.isArray(draft.purchases) ? draft.purchases : []) {
    if (!purchase || !shopItemById[purchase.catalogId]) continue;
    const amount = Math.max(1, Math.min(999, Math.round(Number(purchase.amount) || 1)));
    mergedPurchases.set(purchase.catalogId, Math.min(999, (mergedPurchases.get(purchase.catalogId) ?? 0) + amount));
  }
  draft.purchases = [...mergedPurchases].map(([catalogId, amount]) => ({ catalogId, amount }));
  const purchasedItems = Object.fromEntries(draft.purchases.flatMap((purchase) => {
    const entry = shopItemById[purchase.catalogId];
    return entry ? [[purchase.catalogId, {
      ...entry.item,
      id: purchase.catalogId,
      amount: purchase.amount,
      itemKind: entry.itemKind,
    } as OptolithItem]] : [];
  }));
  draft.equipmentSlots = normalizeEquipmentSlots(draft.equipmentSlots, purchasedItems);
  const experience = getGeneratorExperience(draft);
  const species = getGeneratorSpecies(draft);
  const race = getGeneratorRace(draft);
  if (!race.commonCultures.includes(draft.cultureId as never) && !cultureById[draft.cultureId]) {
    draft.cultureId = race.commonCultures[0] ?? "mittelreicher";
  }
  if (species.id === "elfen" && !["klugheit", "koerperkraft"].includes(draft.negativeAttribute === "KL" ? "klugheit" : draft.negativeAttribute === "KK" ? "koerperkraft" : "")) {
    draft.negativeAttribute = "KL";
  }
  if (species.id === "zwerge" && !["CH", "GE"].includes(draft.negativeAttribute)) draft.negativeAttribute = "CH";
  for (const attribute of ATTRIBUTES) {
    const maximum = getGeneratorAttributeMaximum(draft, attribute.code);
    draft.attributes[attribute.code] = Math.max(8, Math.min(maximum, Math.round(draft.attributes[attribute.code] ?? 8)));
  }
  let sum = Object.values(draft.attributes).reduce((total, value) => total + value, 0);
  while (sum > experience.attributemaximumsum) {
    let changed = false;
    for (const attribute of [...ATTRIBUTES].reverse()) {
      if (sum <= experience.attributemaximumsum) break;
      if (draft.attributes[attribute.code] <= 8) continue;
      draft.attributes[attribute.code] -= 1;
      sum -= 1;
      changed = true;
    }
    if (!changed) break;
  }
  const profession = getGeneratorProfession(draft);
  const baseTalents = getGeneratorBaseTalentValues(draft);
  const normalizedTalentIncreases: Record<string, number> = {};
  for (const [talentId, rawTarget] of Object.entries(draft.talentIncreases ?? {})) {
    if (!TALENTS.some((entry) => entry.id === talentId)) continue;
    const base = baseTalents[talentId] ?? 0;
    const target = Math.max(base, Math.min(experience.skillmaximum, Math.trunc(Number(rawTarget) || base)));
    if (target > base) normalizedTalentIncreases[talentId] = target;
  }
  draft.talentIncreases = normalizedTalentIncreases;
  draft.magicallyGifted = Boolean(draft.magicallyGifted);
  const baseSpells = getGeneratorBaseSpellValues(draft);
  const normalizedSpellIncreases: Record<string, number> = {};
  if (isGeneratorMagicallyGifted(draft)) {
    for (const [spellId, rawTarget] of Object.entries(draft.spellIncreases ?? {})) {
      if (!generatorSpellById[spellId]) continue;
      const base = baseSpells[spellId] ?? 0;
      const target = Math.max(base, Math.min(experience.skillmaximum, Math.trunc(Number(rawTarget) || 0)));
      if (base === 0 || target > base) normalizedSpellIncreases[spellId] = target;
    }
  }
  draft.spellIncreases = normalizedSpellIncreases;
  for (const choice of profession.combatChoices) {
    const key = choiceKey(profession, choice.id);
    const allowed = new Set(choice.options.map((entry) => entry.id));
    const current = (draft.combatChoices[key] ?? []).filter((id) => allowed.has(id as never)).slice(0, choice.count);
    for (const option of choice.options) {
      if (current.length >= choice.count) break;
      if (!current.includes(option.id)) current.push(option.id);
    }
    draft.combatChoices[key] = current;
  }
  for (const choice of profession.spellSelections) {
    const key = choiceKey(profession, choice.id);
    const allowed = new Set(choice.options);
    const current = (draft.spellChoices[key] ?? []).filter((id) => allowed.has(id as never)).slice(0, choice.count);
    for (const option of choice.options) {
      if (current.length >= choice.count) break;
      if (!current.includes(option)) current.push(option);
    }
    draft.spellChoices[key] = current;
  }
};

export const calculateGeneratorShopping = (draft: GeneratorDraft): GeneratorShoppingBalance => {
  const wealthyLevels = draft.advantages
    .filter((entry) => entry.id === "reich")
    .reduce((sum, entry) => sum + Math.max(1, Number(entry.level) || 1), 0);
  const poorLevels = draft.disadvantages
    .filter((entry) => entry.id === "arm")
    .reduce((sum, entry) => sum + Math.max(1, Number(entry.level) || 1), 0);
  const startingCapitalKreuzer = Math.max(0, 75_000 + wealthyLevels * 25_000 - poorLevels * 25_000);
  let spentKreuzer = 0;
  let itemCount = 0;
  let totalWeight = 0;
  for (const purchase of draft.purchases ?? []) {
    const shopItem = shopItemById[purchase.catalogId];
    if (!shopItem) continue;
    const amount = Math.max(1, Math.round(Number(purchase.amount) || 1));
    spentKreuzer += Math.round(shopItem.item.price * 100) * amount;
    itemCount += amount;
    totalWeight += Number(shopItem.item.weight ?? 0) * amount;
  }
  return {
    startingCapitalSilver: startingCapitalKreuzer / 100,
    spentSilver: spentKreuzer / 100,
    remainingSilver: (startingCapitalKreuzer - spentKreuzer) / 100,
    itemCount,
    totalWeight,
  };
};

export const getEquipmentPackageBalance = (packageId: string): Pick<GeneratorShoppingBalance, "spentSilver" | "itemCount" | "totalWeight"> | undefined => {
  const definition = EQUIPMENT_PACKAGE_BY_ID[packageId];
  if (!definition || definition.unavailableReason) return undefined;
  let spentSilver = 0;
  let itemCount = 0;
  let totalWeight = 0;
  for (const packageItem of definition.items) {
    const shopItem = shopItemById[packageItem.catalogId];
    if (!shopItem) continue;
    spentSilver += shopItem.item.price * packageItem.amount;
    totalWeight += Number(shopItem.item.weight ?? 0) * packageItem.amount;
    itemCount += packageItem.amount;
  }
  return {
    spentSilver: Math.round(spentSilver * 100) / 100,
    itemCount,
    totalWeight: Math.round(totalWeight * 1000) / 1000,
  };
};

export const addEquipmentPackageToDraft = (draft: GeneratorDraft, packageId: string): boolean => {
  const definition = EQUIPMENT_PACKAGE_BY_ID[packageId];
  const packageBalance = getEquipmentPackageBalance(packageId);
  if (!definition || !packageBalance || packageBalance.spentSilver > calculateGeneratorShopping(draft).remainingSilver + 0.0001) return false;
  for (const packageItem of definition.items) {
    if (!shopItemById[packageItem.catalogId]) continue;
    const existing = draft.purchases.find((entry) => entry.catalogId === packageItem.catalogId);
    if (existing) existing.amount += packageItem.amount;
    else draft.purchases.push({ ...packageItem });
  }
  normalizeGeneratorDraft(draft);
  return true;
};

const purseFromSilver = (silver: number): Partial<Record<"d" | "s" | "h" | "k", string>> => {
  let kreuzer = Math.max(0, Math.round(silver * 100));
  const d = Math.floor(kreuzer / 1000);
  kreuzer %= 1000;
  const s = Math.floor(kreuzer / 100);
  kreuzer %= 100;
  const h = Math.floor(kreuzer / 10);
  const k = kreuzer % 10;
  return { d: String(d), s: String(s), h: String(h), k: String(k) };
};

const generatorItemId = (catalogId: string): string => `GENERATOR_ITEM_${catalogId.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}`;

const generatorOwnedItems = (draft: GeneratorDraft): Record<string, OptolithItem> => Object.fromEntries(
  (draft.purchases ?? []).flatMap((purchase) => {
    const entry = shopItemById[purchase.catalogId];
    return entry ? [[purchase.catalogId, {
      ...entry.item,
      id: purchase.catalogId,
      amount: purchase.amount,
      itemKind: entry.itemKind,
    } as OptolithItem]] : [];
  }),
);

export const calculateGeneratorEquipmentZones = (draft: GeneratorDraft) =>
  calculateEquipmentZones(generatorOwnedItems(draft), draft.equipmentSlots);

export const assignGeneratorEquipmentSuggestion = (draft: GeneratorDraft, catalogId: string): void => {
  draft.equipmentSlots = assignEquipmentToAvailableSlots(draft.equipmentSlots, catalogId, generatorOwnedItems(draft));
};

const buildPurchasedItems = (draft: GeneratorDraft): Record<string, OptolithItem> => Object.fromEntries(
  (draft.purchases ?? []).flatMap((purchase) => {
    const shopItem = shopItemById[purchase.catalogId];
    if (!shopItem) return [];
    const id = generatorItemId(purchase.catalogId);
    const fallbackGroup = shopItem.itemKind === "armor" || shopItem.itemKind === "helmet" ? 4 : shopItem.itemKind === "ranged" ? 2 : shopItem.itemKind === "equipment" ? 7 : 1;
    const group = shopItem.itemKind === "equipment"
      ? suggestInventoryGroup(shopItem.item.name, Number(shopItem.item.gr ?? fallbackGroup))
      : fallbackGroup;
    return [[id, {
      ...shopItem.item,
      id,
      name: shopItem.item.name,
      gr: group,
      amount: Math.max(1, Math.round(Number(purchase.amount) || 1)),
      itemKind: shopItem.itemKind,
      equipped: Object.values(draft.equipmentSlots ?? {}).includes(purchase.catalogId),
      generatorCatalogId: purchase.catalogId,
    } satisfies OptolithItem]];
  }),
);

export const getGeneratorAttributeMaximum = (draft: GeneratorDraft, code: AttributeCode): number => {
  const base = getGeneratorExperience(draft).attributemaximum;
  const speciesId = getGeneratorSpecies(draft).id;
  if (speciesId === "menschen" || speciesId === "halbelfen") return base + (draft.positiveAttribute === code ? 1 : 0);
  if (speciesId === "elfen") {
    if (code === "IN" || code === "GE") return base + 1;
    if (code === draft.negativeAttribute) return base - 2;
  }
  if (speciesId === "zwerge") {
    if (code === "KO" || code === "KK") return base + 1;
    if (code === draft.negativeAttribute) return base - 2;
  }
  return base;
};

export const generatorAttributeCost = (draft: GeneratorDraft): number => Object.values(draft.attributes)
  .reduce((sum, value) => {
    let cost = 0;
    for (let target = 9; target <= value; target += 1) cost += improvementCostForTarget("E", target);
    return sum + cost;
  }, 0);

export const getGeneratorTraitDefinition = (kind: GeneratorTraitKind, id: string): TraitDefinition | undefined =>
  (kind === "advantage" ? advantageById : disadvantageById)[id];

export const generatorTraitCost = (kind: GeneratorTraitKind, selection: GeneratorTraitSelection): number => {
  const definition = getGeneratorTraitDefinition(kind, selection.id);
  if (!definition) return 0;
  const level = Math.max(1, Math.min(Number(definition.maxLevel ?? 1), selection.level));
  const fixed = "costPerLevel" in definition ? Number(definition.costPerLevel) * level : undefined;
  const variant = "variants" in definition
    ? definition.variants.find((entry) => entry.name === selection.variant && "cost" in entry)
    : undefined;
  const magnitude = fixed ?? (variant && "cost" in variant ? Number(variant.cost) : Math.max(0, selection.costOverride));
  return kind === "advantage" ? magnitude : -magnitude;
};

export const getGeneratorSpecialAbilityDefinition = (id: string): SpecialAbilityDefinition | undefined =>
  specialAbilityById[id];

export const generatorSpecialAbilityCost = (selection: GeneratorSpecialAbilitySelection): number => {
  const definition = getGeneratorSpecialAbilityDefinition(selection.id);
  if (!definition) return 0;
  const level = Math.max(1, Math.min(Number(definition.maxLevel ?? 1), selection.level));
  if ("costByLevel" in definition) return (definition.costByLevel as readonly number[])
    .slice(0, level)
    .reduce((sum: number, cost: number) => sum + Number(cost), 0);
  return "costPerLevel" in definition ? Number(definition.costPerLevel) * level : Math.max(0, selection.costOverride);
};

export interface RequiredProfessionComponents {
  advantages: Array<{ id: string; name: string; cost: number }>;
  disadvantages: Array<{ id: string; name: string; level: number; variant: string; cost: number }>;
  tradition?: { name: string; cost: number };
}

export const getRequiredProfessionComponents = (draft: GeneratorDraft): RequiredProfessionComponents => {
  const profession = getGeneratorProfession(draft);
  const advantages: RequiredProfessionComponents["advantages"] = profession.requiredAdvantages.map((entry) => {
    const definition = advantageById[entry.id];
    const selection = { id: entry.id, level: entry.level, variant: entry.variant, costOverride: 0 };
    return {
      id: entry.id,
      name: definition?.name ?? entry.id,
      cost: generatorTraitCost("advantage", selection),
    };
  });
  const disadvantages: RequiredProfessionComponents["disadvantages"] = profession.requiredDisadvantages.map((entry) => {
    const definition = disadvantageById[entry.id];
    const selection = { id: entry.id, level: entry.level, variant: entry.variant, costOverride: 0 };
    return {
      id: entry.id,
      name: definition?.name ?? entry.id,
      level: entry.level,
      variant: entry.variant,
      cost: generatorTraitCost("disadvantage", selection),
    };
  });
  return {
    advantages,
    disadvantages,
    ...(profession.tradition ? { tradition: { name: `Tradition (${profession.tradition})`, cost: Number(profession.traditionCost ?? 0) } } : {}),
  };
};

const withoutRequired = (
  selections: GeneratorTraitSelection[],
  requiredIds: Set<string>,
): GeneratorTraitSelection[] => selections.filter((entry) => !requiredIds.has(entry.id));

export const calculateGeneratorBalance = (draft: GeneratorDraft): GeneratorBalance => {
  const experience = getGeneratorExperience(draft);
  const species = getGeneratorSpecies(draft);
  const culture = getGeneratorCulture(draft);
  const profession = getGeneratorProfession(draft);
  const required = getRequiredProfessionComponents(draft);
  const requiredAdvantageIds = new Set(required.advantages.map((entry) => entry.id));
  const requiredDisadvantageIds = new Set(required.disadvantages.map((entry) => entry.id));
  const advantages = withoutRequired(draft.advantages, requiredAdvantageIds)
    .reduce((sum, entry) => sum + generatorTraitCost("advantage", entry), 0);
  const disadvantages = withoutRequired(draft.disadvantages, requiredDisadvantageIds)
    .reduce((sum, entry) => sum + generatorTraitCost("disadvantage", entry), 0);
  // Der Regelwiki-AP-Wert eines Professionspakets enthält seine Voraussetzungen
  // (z. B. Zauberer/Geweihter und die Tradition) bereits vollständig.
  // Sie werden deshalb für die 80-AP-Grenzen berücksichtigt, aber nicht ein
  // zweites Mal vom AP-Konto abgezogen bzw. gutgeschrieben.
  const requiredAdvantageLimit = required.advantages.reduce((sum, entry) => sum + entry.cost, 0);
  const requiredDisadvantageLimit = required.disadvantages.reduce((sum, entry) => sum + entry.cost, 0);
  const specialAbilities = draft.specialAbilities.reduce((sum, entry) => sum + generatorSpecialAbilityCost(entry), 0);
  const talents = generatorTalentCost(draft);
  const spells = isGeneratorMagicallyGifted(draft) ? generatorSpellCost(draft) : 0;
  const breakdown = {
    budget: experience.ap,
    species: species.ap,
    attributes: generatorAttributeCost(draft),
    culture: draft.useCulturePackage ? culture.packageAp : 0,
    profession: profession.ap,
    tradition: 0,
    requiredAdvantages: 0,
    advantages,
    requiredDisadvantages: 0,
    disadvantages,
    specialAbilities,
    talents,
    spells,
  };
  const spent = breakdown.species + breakdown.attributes + breakdown.culture + breakdown.profession
    + advantages + disadvantages + specialAbilities + talents + spells;
  return {
    ...breakdown,
    spent,
    remaining: breakdown.budget - spent,
    advantageLimit: requiredAdvantageLimit + advantages,
    disadvantageLimit: Math.abs(requiredDisadvantageLimit + disadvantages),
  };
};

export const validateGeneratorDraft = (draft: GeneratorDraft): GeneratorValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const experience = getGeneratorExperience(draft);
  const race = getGeneratorRace(draft);
  const profession = getGeneratorProfession(draft);
  const balance = calculateGeneratorBalance(draft);
  const attributeSum = Object.values(draft.attributes).reduce((sum, value) => sum + value, 0);
  if (!draft.name.trim()) errors.push("Der Held braucht einen Namen.");
  if (!draft.professionId || !professionById[draft.professionId]) errors.push("Wähle eine Profession.");
  if (attributeSum > experience.attributemaximumsum) errors.push(`Die Eigenschaftssumme darf höchstens ${experience.attributemaximumsum} betragen.`);
  for (const attribute of ATTRIBUTES) {
    const value = draft.attributes[attribute.code];
    const maximum = getGeneratorAttributeMaximum(draft, attribute.code);
    if (value < 8 || value > maximum) errors.push(`${attribute.name} muss zwischen 8 und ${maximum} liegen.`);
  }
  if (balance.remaining < 0) errors.push(`Es fehlen ${Math.abs(balance.remaining)} AP.`);
  if (balance.advantageLimit > 80) errors.push("Für Vorteile dürfen höchstens 80 AP ausgegeben werden.");
  if (balance.disadvantageLimit > 80) errors.push("Aus Nachteilen dürfen höchstens 80 AP gewonnen werden.");
  for (const talent of TALENTS) {
    const value = getGeneratorTalentValue(draft, talent.id);
    if (value > experience.skillmaximum) errors.push(`${talent.name} darf bei diesem Erfahrungsgrad höchstens ${experience.skillmaximum} erreichen.`);
  }
  if (isGeneratorMagicallyGifted(draft)) {
    const spellCount = getGeneratorSpellCount(draft);
    if (spellCount > experience.maxnumberofspellsliturgies) {
      errors.push(`Bei diesem Erfahrungsgrad dürfen höchstens ${experience.maxnumberofspellsliturgies} Zauber und Rituale aktiviert sein.`);
    }
    for (const spellId of new Set([...Object.keys(getGeneratorBaseSpellValues(draft)), ...Object.keys(draft.spellIncreases)])) {
      const definition = generatorSpellById[spellId];
      const value = getGeneratorSpellValue(draft, spellId);
      if (definition && value > experience.skillmaximum) {
        errors.push(`${definition.name} darf bei diesem Erfahrungsgrad höchstens FW ${experience.skillmaximum} erreichen.`);
      }
    }
    const hasWizardAdvantage = getGeneratorSpecies(draft).id === "elfen"
      || profession.requiredAdvantages.some((entry) => entry.id === "zauberer")
      || draft.advantages.some((entry) => entry.id === "zauberer");
    if (draft.magicallyGifted && !hasWizardAdvantage) {
      warnings.push("Für eine frei gewählte magische Begabung fehlen noch der Vorteil „Zauberer“ und eine passende magische Tradition.");
    }
  }
  if (balance.remaining > 10) warnings.push(`${balance.remaining} AP sind noch nicht verteilt. Nach Regelwerk dürfen höchstens 10 AP übrig bleiben.`);
  const shopping = calculateGeneratorShopping(draft);
  if (shopping.remainingSilver < 0) errors.push(`Für den Einkauf fehlen ${Math.abs(shopping.remainingSilver).toLocaleString("de-DE")} Silbertaler.`);
  if (!race.commonCultures.includes(draft.cultureId as never)) warnings.push("Die gewählte Kultur ist für diese Herkunft unüblich und sollte mit dem GM abgestimmt werden.");
  if (profession.requiredCultures.length && !profession.requiredCultures.includes(draft.cultureId)) {
    const names = profession.requiredCultures.map((id) => cultureById[id]?.name ?? id).join(", ");
    errors.push(`Die Profession „${profession.name}“ setzt eine dieser Kulturen voraus: ${names}.`);
  }
  if (profession.requiredSex && profession.requiredSex !== draft.sex) {
    errors.push(`Die Profession „${profession.name}“ ist in diesem Regelpaket an ein anderes Geschlecht gebunden.`);
  }
  if (profession.magical === true && getGeneratorSpecies(draft).id === "zwerge" && profession.tradition !== "Geoden") {
    warnings.push("Diese magische Profession ist für Zwerge unüblich; die geodischen Professionen aus Aventurische Magie III sind die typische Wahl.");
  }
  for (const kind of ["advantage", "disadvantage"] as const) {
    for (const selected of draft[kind === "advantage" ? "advantages" : "disadvantages"]) {
      const definition = getGeneratorTraitDefinition(kind, selected.id);
      if (definition && "variableCost" in definition && definition.variableCost && generatorTraitCost(kind, selected) === 0) {
        errors.push(`Für „${definition.name}“ muss ein AP-Wert eingetragen werden.`);
      }
      if (definition && "variableCost" in definition && definition.variableCost && !selected.variant.trim()) {
        errors.push(`Für „${definition.name}“ muss eine Ausprägung eingetragen werden.`);
      }
    }
  }
  for (const selected of draft.specialAbilities) {
    const definition = getGeneratorSpecialAbilityDefinition(selected.id);
    if (definition && "variableCost" in definition && definition.variableCost && generatorSpecialAbilityCost(selected) === 0) {
      errors.push(`Für die Sonderfertigkeit „${definition.name}“ muss ein AP-Wert eingetragen werden.`);
    }
    if (definition && "variableCost" in definition && definition.variableCost && !selected.variant.trim()) {
      errors.push(`Für die Sonderfertigkeit „${definition.name}“ muss eine Ausprägung eingetragen werden.`);
    }
  }
  const advantageIds = new Set(draft.advantages.map((entry) => entry.id));
  const disadvantageIds = new Set(draft.disadvantages.map((entry) => entry.id));
  const opposites: Array<[string, string]> = [
    ["glueck", "pech"],
    ["hohelebenskraft", "niedrigelebenskraft"],
    ["hoheastralkraft", "niedrigeastralkraft"],
    ["hohekarmaenergie", "niedrigekarmaenergie"],
    ["gutaussehend", "haesslich"],
    ["flink", "behaebig"],
    ["giftresistenz", "giftanfaellig"],
    ["krankheitsresistenz", "krankheitsanfaellig"],
  ];
  for (const [advantage, disadvantage] of opposites) {
    if (advantageIds.has(advantage) && disadvantageIds.has(disadvantage)) {
      const advantageName = advantageById[advantage]?.name ?? advantage;
      const disadvantageName = disadvantageById[disadvantage]?.name ?? disadvantage;
      errors.push(`„${advantageName}“ und „${disadvantageName}“ schließen einander aus.`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
};

const manualSpeciesFor = (speciesId: string): ManualSpecies => ({
  menschen: "human",
  halbelfen: "halfelf",
  elfen: "elf",
  zwerge: "dwarf",
})[speciesId] as ManualSpecies ?? "human";

const biographyTrait = (entry: GeneratorTraitSelection, kind: GeneratorTraitKind): BiographyTrait => {
  const definition = getGeneratorTraitDefinition(kind, entry.id);
  return {
    id: `GRW_${kind === "advantage" ? "ADV" : "DIS"}_${entry.id}`,
    sourceId: entry.id,
    name: definition?.name ?? entry.id,
    ...(entry.level > 1 ? { level: entry.level } : {}),
    ...(entry.variant.trim() ? { variant: entry.variant.trim() } : {}),
  };
};

const uniqueTraits = (entries: BiographyTrait[]): BiographyTrait[] => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.sourceId ?? entry.name}:${entry.variant ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const selectedCombat = (draft: GeneratorDraft, profession: Profession): Array<{ id: string; level: number }> => [
  ...profession.combat,
  ...profession.combatChoices.flatMap((choice) => {
    const selected = new Set(draft.combatChoices[choiceKey(profession, choice.id)] ?? []);
    return choice.options.filter((option) => selected.has(option.id));
  }),
];

export const buildGeneratedCharacter = (draft: GeneratorDraft): CharacterSheetState => {
  normalizeGeneratorDraft(draft);
  const validation = validateGeneratorDraft(draft);
  if (validation.errors.length) throw new Error(validation.errors.join(" "));
  const experience = getGeneratorExperience(draft);
  const species = getGeneratorSpecies(draft);
  const race = getGeneratorRace(draft);
  const culture = getGeneratorCulture(draft);
  const profession = getGeneratorProfession(draft);
  const required = getRequiredProfessionComponents(draft);
  const magical = isGeneratorMagicallyGifted(draft);
  const sheet = createManualState(draft.name, { species: manualSpeciesFor(species.id), magical });
  sheet.hero.clientVersion = "Regelwerksgenerator 0.22.0";
  sheet.hero.el = experience.id;
  sheet.hero.rv = race.id;
  sheet.hero.c = culture.id;
  sheet.hero.p = profession.baseId;
  sheet.hero.pv = profession.variantId;
  sheet.hero.sex = draft.sex;
  sheet.hero.ap = { total: experience.ap };
  sheet.hero.attr.values = ATTRIBUTES.map((attribute) => ({ id: attribute.id, value: draft.attributes[attribute.code] }));
  sheet.hero.talents = Object.fromEntries(TALENTS.map((entry) => [entry.id, 0]));
  if (draft.useCulturePackage) {
    for (const entry of culture.packageSkills) {
      const id = GRW_CHARACTER_DATA.skillIds[entry.id as keyof typeof GRW_CHARACTER_DATA.skillIds];
      if (id) sheet.hero.talents[id] = (sheet.hero.talents[id] ?? 0) + entry.level;
    }
  }
  for (const entry of profession.skills) {
    const id = GRW_CHARACTER_DATA.skillIds[entry.id as keyof typeof GRW_CHARACTER_DATA.skillIds];
    if (id) sheet.hero.talents[id] = (sheet.hero.talents[id] ?? 0) + entry.level;
  }
  for (const [talentId, target] of Object.entries(draft.talentIncreases)) {
    if (talentId in sheet.hero.talents) sheet.hero.talents[talentId] = Math.max(sheet.hero.talents[talentId] ?? 0, target);
  }
  sheet.hero.ct = Object.fromEntries(Object.keys(COMBAT_TECHNIQUES).map((id) => [id, 6]));
  for (const entry of selectedCombat(draft, profession)) {
    const id = GRW_CHARACTER_DATA.combatIds[entry.id as keyof typeof GRW_CHARACTER_DATA.combatIds];
    if (id) sheet.hero.ct[id] = Math.max(sheet.hero.ct[id] ?? 6, entry.level);
  }
  sheet.hero.spells = {};
  for (const entry of profession.spells) {
    const definition = canonicalProfessionSpell(entry.id) ?? DARKAID_MAGIC_BY_SOURCE_ID[entry.id];
    const id = definition?.id ?? `DARKAID_SPELL_${entry.id}`;
    sheet.hero.spells[id] = entry.level;
  }
  for (const [spellId, target] of Object.entries(draft.spellIncreases)) {
    if (generatorSpellById[spellId]) sheet.hero.spells[spellId] = Math.max(sheet.hero.spells[spellId] ?? 0, target);
  }
  sheet.hero.cantrips = profession.spellSelections.flatMap((choice) =>
    (draft.spellChoices[choiceKey(profession, choice.id)] ?? []).map((id) => `DARKAID_CANTRIP_${id}`));
  sheet.hero.liturgies = Object.fromEntries(profession.chants.map((entry) => [`DARKAID_CHANT_${entry.id}`, entry.level]));
  sheet.hero.blessings = profession.blessings.map((id) => `DARKAID_BLESSING_${id}`);
  const automaticAdvantages = species.automaticTraits.map((entry) => ({
    id: `GRW_SPECIES_${entry.id}`,
    sourceId: entry.id,
    name: entry.name,
  }));
  const requiredAdvantages = required.advantages.map((entry) => ({
    id: `GRW_REQUIRED_ADV_${entry.id}`,
    sourceId: entry.id,
    name: entry.name,
  }));
  const requiredDisadvantages = required.disadvantages.map((entry) => ({
    id: `GRW_REQUIRED_DIS_${entry.id}`,
    sourceId: entry.id,
    name: entry.name,
    level: entry.level,
    variant: entry.variant,
  }));
  sheet.hero.biography = {
    species: race.name,
    culture: culture.name,
    profession: draft.sex === "f" ? profession.femaleName : profession.name,
    advantages: uniqueTraits([
      ...automaticAdvantages,
      ...requiredAdvantages,
      ...draft.advantages.map((entry) => biographyTrait(entry, "advantage")),
    ]),
    disadvantages: uniqueTraits([
      ...requiredDisadvantages,
      ...draft.disadvantages.map((entry) => biographyTrait(entry, "disadvantage")),
    ]),
    specialAbilities: uniqueTraits([
      ...(required.tradition ? [{ id: `GRW_TRADITION_${profession.baseId}`, name: required.tradition.name }] : []),
      ...profession.specialAbilities.map((name, index) => ({ id: `GRW_PROFESSION_SA_${index}`, name })),
      ...draft.specialAbilities.map((entry) => {
        const definition = getGeneratorSpecialAbilityDefinition(entry.id);
        return {
          id: `GENERATOR_SA_${entry.id}`,
          sourceId: entry.id,
          name: definition?.name ?? entry.id,
          ...(entry.level > 1 ? { level: entry.level } : {}),
          ...(entry.variant.trim() ? { variant: entry.variant.trim() } : {}),
        };
      }),
      ...(culture.language ? [{ id: `GRW_LANGUAGE_${culture.id}`, name: `Sprache (${culture.language})` }] : []),
      ...(culture.script ? [{ id: `GRW_SCRIPT_${culture.id}`, name: `Schrift (${culture.script})` }] : []),
    ]),
  };
  const balance = calculateGeneratorBalance(draft);
  sheet.runtime.advancement.availableAp = Math.max(0, balance.remaining);
  const attributes = getAttributeValues(sheet.hero);
  const lifeModifier = draft.advantages.filter((entry) => entry.id === "hohelebenskraft").reduce((sum, entry) => sum + entry.level, 0)
    - draft.disadvantages.filter((entry) => entry.id === "niedrigelebenskraft").reduce((sum, entry) => sum + entry.level, 0);
  const lifeMax = Number(species.baseValues.lebensenergie ?? 5) + attributes.KO * 2 + lifeModifier;
  sheet.runtime.resources.lp = { current: lifeMax, max: lifeMax };
  if (magical) {
    const primary = (profession.primaryAttribute ?? "IN") as AttributeCode;
    const astralModifier = draft.advantages.filter((entry) => entry.id === "hoheastralkraft").reduce((sum, entry) => sum + entry.level, 0)
      - draft.disadvantages.filter((entry) => entry.id === "niedrigeastralkraft").reduce((sum, entry) => sum + entry.level, 0);
    const max = 20 + attributes[primary] + astralModifier;
    sheet.runtime.resources.ae = { current: max, max };
  }
  if (profession.blessed === true) {
    const primary = (profession.primaryAttribute ?? "IN") as AttributeCode;
    const karmaModifier = draft.advantages.filter((entry) => entry.id === "hohekarmaenergie").reduce((sum, entry) => sum + entry.level, 0)
      - draft.disadvantages.filter((entry) => entry.id === "niedrigekarmaenergie").reduce((sum, entry) => sum + entry.level, 0);
    const max = 20 + attributes[primary] + karmaModifier;
    sheet.runtime.resources.kp = { current: max, max };
  }
  const fateModifier = draft.advantages.filter((entry) => entry.id === "glueck").reduce((sum, entry) => sum + entry.level, 0)
    - draft.disadvantages.filter((entry) => entry.id === "pech").reduce((sum, entry) => sum + entry.level, 0);
  const fate = Math.max(0, 3 + fateModifier);
  sheet.runtime.resources.fate = { current: fate, max: fate };
  sheet.hero.belongings ??= {};
  const shopping = calculateGeneratorShopping(draft);
  sheet.hero.belongings.items = buildPurchasedItems(draft);
  sheet.runtime.equipmentSlots = Object.fromEntries(Object.entries(draft.equipmentSlots ?? {}).flatMap(([slot, catalogId]) => {
    if (!catalogId || !shopItemById[catalogId]) return [];
    return [[slot as EquipmentBodySlot, generatorItemId(catalogId)]];
  }));
  sheet.hero.belongings.purse = purseFromSilver(shopping.remainingSilver);
  sheet.runtime.combat.primaryWeaponId = getDefaultPrimaryWeaponId(sheet.hero);
  sheet.originalData = {
    generator: {
      rulebook: [
        "DSA5 Regelwerk, dritte Auflage",
        "Aventurisches Kompendium",
        "Aventurische Magie I",
        "Aventurische Magie II",
        "Aventurische Magie III",
      ],
      createdAt: new Date().toISOString(),
      concept: draft.concept,
      draft,
      balance,
      shopping,
      tradition: required.tradition,
      specialAbilities: [
        ...(required.tradition ? [required.tradition.name] : []),
        ...profession.specialAbilities,
        ...draft.specialAbilities.map((entry) => getGeneratorSpecialAbilityDefinition(entry.id)?.name ?? entry.id),
      ],
    },
  };
  return sheet;
};

export const generatorProfessionSummary = (profession: Profession): string => {
  const details = [`${profession.ap} AP`, `${profession.skills.length} Talente`, `${profession.combat.length + profession.combatChoices.length} Kampfwerte`];
  if (profession.spells.length || profession.spellSelections.length) details.push(`${profession.spells.length} Zauber`);
  if (profession.chants.length) details.push(`${profession.chants.length} Liturgien`);
  details.push(profession.sourceShortLabel);
  return details.join(" · ");
};

export const generatorCombatChoiceName = (id: string): string => {
  const mapped = GRW_CHARACTER_DATA.combatIds[id as keyof typeof GRW_CHARACTER_DATA.combatIds];
  return mapped ? COMBAT_TECHNIQUES[mapped] ?? id : id;
};

export const generatorCantripName = (id: string): string =>
  GRW_CHARACTER_DATA.cantripNames[id as keyof typeof GRW_CHARACTER_DATA.cantripNames] ?? id;

export const generatorTraitSummary = (kind: GeneratorTraitKind, selection: GeneratorTraitSelection): string => {
  const definition = getGeneratorTraitDefinition(kind, selection.id);
  if (!definition) return selection.id;
  const cost = Math.abs(generatorTraitCost(kind, selection));
  return `${definition.name}${selection.level > 1 ? ` ${selection.level}` : ""}${selection.variant ? ` (${selection.variant})` : ""} · ${cost || "?"} AP`;
};

export const generatorTalentName = (sourceId: string): string => {
  const targetId = GRW_CHARACTER_DATA.skillIds[sourceId as keyof typeof GRW_CHARACTER_DATA.skillIds];
  return TALENTS.find((entry) => entry.id === targetId)?.name ?? sourceId;
};

export const generatorCombatTechniqueRule = (sourceId: string) => {
  const targetId = GRW_CHARACTER_DATA.combatIds[sourceId as keyof typeof GRW_CHARACTER_DATA.combatIds];
  return targetId ? COMBAT_TECHNIQUE_RULES[targetId] : undefined;
};
