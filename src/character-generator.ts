import { ATTRIBUTES, COMBAT_TECHNIQUES, COMBAT_TECHNIQUE_RULES, TALENTS } from "./data";
import { DARKAID_MAGIC_BY_SOURCE_ID } from "./darkaid-data";
import { GRW_CHARACTER_DATA } from "./grw-character-data";
import { improvementCostForTarget } from "./advancement";
import { createManualState, getAttributeValues } from "./importer";
import type {
  AttributeCode,
  BiographyTrait,
  CharacterSheetState,
  ManualSpecies,
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
  readonly page: number;
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly sourceShortLabel: string;
  readonly requiredCultures: readonly string[];
  readonly requiredSex?: string;
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

const experienceById = Object.fromEntries(GRW_EXPERIENCES.map((entry) => [entry.id, entry])) as Record<string, Experience>;
const speciesById = Object.fromEntries(GRW_SPECIES.map((entry) => [entry.id, entry])) as Record<string, Species>;
const raceById = Object.fromEntries(GRW_RACES.map((entry) => [entry.id, entry])) as Record<string, Race>;
const cultureById = Object.fromEntries(GRW_CULTURES.map((entry) => [entry.id, entry])) as Record<string, Culture>;
const professionById = Object.fromEntries(GRW_PROFESSIONS.map((entry) => [entry.id, entry])) as Record<string, Profession>;
const advantageById = Object.fromEntries(GRW_ADVANTAGES.map((entry) => [entry.id, entry])) as Record<string, TraitDefinition>;
const disadvantageById = Object.fromEntries(GRW_DISADVANTAGES.map((entry) => [entry.id, entry])) as Record<string, TraitDefinition>;
const specialAbilityById = Object.fromEntries(GRW_SPECIAL_ABILITIES.map((entry) => [entry.id, entry])) as Record<string, SpecialAbilityDefinition>;

const defaultAttributes = (): Record<AttributeCode, number> => ({
  MU: 14,
  KL: 12,
  IN: 13,
  CH: 12,
  FF: 12,
  GE: 13,
  KO: 12,
  KK: 12,
});

export const createGeneratorDraft = (): GeneratorDraft => {
  const draft: GeneratorDraft = {
    step: 0,
    name: "",
    sex: "d",
    concept: "",
    experienceId: "erfahren",
    raceId: "mittellaender",
    cultureId: "mittelreicher",
    useCulturePackage: true,
    positiveAttribute: "MU",
    negativeAttribute: "KL",
    attributes: defaultAttributes(),
    professionId: "barde",
    combatChoices: {},
    spellChoices: {},
    advantages: [],
    disadvantages: [],
    specialAbilities: [],
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
  professionById[draft.professionId] ?? professionById.barde;

const choiceKey = (profession: Profession, choiceId: string): string => `${profession.id}:${choiceId}`;

export const normalizeGeneratorDraft = (draft: GeneratorDraft): void => {
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
  return "costPerLevel" in definition
    ? Number(definition.costPerLevel) * level
    : Math.max(0, selection.costOverride);
};

export interface RequiredProfessionComponents {
  advantages: Array<{ id: string; name: string; cost: number }>;
  disadvantages: Array<{ id: string; name: string; level: number; variant: string; cost: number }>;
  tradition?: { name: string; cost: number };
}

export const getRequiredProfessionComponents = (draft: GeneratorDraft): RequiredProfessionComponents => {
  const profession = getGeneratorProfession(draft);
  const species = getGeneratorSpecies(draft);
  const advantages: RequiredProfessionComponents["advantages"] = [];
  const disadvantages: RequiredProfessionComponents["disadvantages"] = [];
  if (profession.magical === true && species.id !== "elfen") advantages.push({ id: "zauberer", name: "Zauberer", cost: 25 });
  if (profession.blessed === true) {
    advantages.push({ id: "geweihter", name: "Geweihter", cost: 25 });
    const principleLevel = profession.baseId === "hesindegeweihter" || profession.baseId === "perainegeweihter" || profession.baseId === "phexgeweihter" ? 1 : 2;
    disadvantages.push({ id: "prinzipientreue", name: "Prinzipientreue", level: principleLevel, variant: profession.tradition ?? "Kirche", cost: -10 * principleLevel });
    disadvantages.push({ id: "verpflichtungen", name: "Verpflichtungen", level: 2, variant: "Tempel/Kirche", cost: -20 });
  }
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
  const requiredAdvantages = required.advantages.reduce((sum, entry) => sum + entry.cost, 0);
  const requiredDisadvantages = required.disadvantages.reduce((sum, entry) => sum + entry.cost, 0);
  const specialAbilities = draft.specialAbilities.reduce((sum, entry) => sum + generatorSpecialAbilityCost(entry), 0);
  const breakdown = {
    budget: experience.ap,
    species: species.ap,
    attributes: generatorAttributeCost(draft),
    culture: draft.useCulturePackage ? culture.packageAp : 0,
    profession: profession.ap,
    tradition: required.tradition?.cost ?? 0,
    requiredAdvantages,
    advantages,
    requiredDisadvantages,
    disadvantages,
    specialAbilities,
  };
  const spent = breakdown.species + breakdown.attributes + breakdown.culture + breakdown.profession
    + breakdown.tradition + requiredAdvantages + advantages + requiredDisadvantages + disadvantages + specialAbilities;
  return {
    ...breakdown,
    spent,
    remaining: breakdown.budget - spent,
    advantageLimit: requiredAdvantages + advantages,
    disadvantageLimit: Math.abs(requiredDisadvantages + disadvantages),
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
  if (attributeSum > experience.attributemaximumsum) errors.push(`Die Eigenschaftssumme darf höchstens ${experience.attributemaximumsum} betragen.`);
  for (const attribute of ATTRIBUTES) {
    const value = draft.attributes[attribute.code];
    const maximum = getGeneratorAttributeMaximum(draft, attribute.code);
    if (value < 8 || value > maximum) errors.push(`${attribute.name} muss zwischen 8 und ${maximum} liegen.`);
  }
  if (balance.remaining < 0) errors.push(`Es fehlen ${Math.abs(balance.remaining)} AP.`);
  if (balance.advantageLimit > 80) errors.push("Für Vorteile dürfen höchstens 80 AP ausgegeben werden.");
  if (balance.disadvantageLimit > 80) errors.push("Aus Nachteilen dürfen höchstens 80 AP gewonnen werden.");
  if (balance.remaining > 10) warnings.push(`${balance.remaining} AP sind noch nicht verteilt. Nach Regelwerk dürfen höchstens 10 AP übrig bleiben.`);
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
  const magical = profession.magical === true || species.id === "elfen";
  const sheet = createManualState(draft.name, { species: manualSpeciesFor(species.id), magical });
  sheet.hero.clientVersion = "Regelwerksgenerator 0.10";
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
  sheet.hero.ct = Object.fromEntries(Object.keys(COMBAT_TECHNIQUES).map((id) => [id, 6]));
  for (const entry of selectedCombat(draft, profession)) {
    const id = GRW_CHARACTER_DATA.combatIds[entry.id as keyof typeof GRW_CHARACTER_DATA.combatIds];
    if (id) sheet.hero.ct[id] = Math.max(sheet.hero.ct[id] ?? 6, entry.level);
  }
  sheet.hero.spells = {};
  for (const entry of profession.spells) {
    const definition = DARKAID_MAGIC_BY_SOURCE_ID[entry.id];
    const id = definition?.id ?? `DARKAID_SPELL_${entry.id}`;
    sheet.hero.spells[id] = entry.level;
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
  sheet.hero.belongings.purse = { d: "75", s: "0", h: "0", k: "0" };
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
