import { ATTRIBUTES, COMBAT_TECHNIQUE_RULES, TALENTS } from "./data";
import { inferCombatItemKind, calculateCombatOverview } from "./combat";
import { calculateCarryingOverview, calculateConditionOverview, CONDITION_DEFINITIONS } from "./conditions";
import { DARKAID_MAGIC_BY_ID, DARKAID_MAGIC_BY_SOURCE_ID } from "./darkaid-data";
import { GRW_CHARACTER_DATA } from "./grw-character-data";
import { getAttributeValues, isMagicallyGifted } from "./importer";
import { calculateEquipmentZones } from "./equipment-zones";
import { CANTRIPS } from "./magic-data";
import { ALL_SPELL_BY_ID } from "./spell-catalog";
import type {
  AttributeCode,
  BiographyTrait,
  CharacterSheetState,
  CombatItemKind,
  ImprovementCost,
} from "./types";

export const PRINTABLE_SHEET_SCHEMA_VERSION = 3 as const;

export interface PrintableValue {
  id: string;
  name: string;
  value: number;
}

export interface PrintableTalent extends PrintableValue {
  check: [AttributeCode, AttributeCode, AttributeCode];
  category: string;
  improvementCost: ImprovementCost;
}

export interface PrintableCombatTechnique extends PrintableValue {
  primaryAttributes: AttributeCode[];
  improvementCost: "B" | "C" | "D";
  range: "melee" | "ranged";
}

export interface PrintableMagicEntry extends PrintableValue {
  kind: "Zauber" | "Ritual" | "Liturgie";
  check?: [AttributeCode, AttributeCode, AttributeCode];
  improvementCost?: string;
}

export interface PrintableEquipmentEntry {
  id: string;
  name: string;
  kind: CombatItemKind;
  amount: number;
  weight: number;
  price: number;
  equipped: boolean;
  notes: string;
  combatTechnique?: string;
  damage?: string;
  at?: number;
  pa?: number;
  reach?: number;
  reloadTime?: number;
  ranges?: string;
  ammunition?: string;
  protection?: number;
  encumbrance?: number;
  movementPenalty?: number;
  initiativePenalty?: number;
  armorType?: string;
  armorZone?: string;
}

export interface PrintableCharacterData {
  schemaVersion: typeof PRINTABLE_SHEET_SCHEMA_VERSION;
  identity: {
    name: string;
    sex: string;
    species: string;
    culture: string;
    profession: string;
    experience: string;
    concept: string;
  };
  attributes: Array<PrintableValue & { code: AttributeCode }>;
  resources: {
    life: { current: number; max: number };
    astral: { current: number; max: number };
    karma: { current: number; max: number };
    fate: { current: number; max: number };
  };
  adventurePoints: { total: number; spent: number; remaining: number };
  derived: {
    speed: number;
    soulpower: number;
    toughness: number;
    dodge: number;
    initiative: number;
    attack: number;
    parry?: number;
  };
  biography: {
    advantages: BiographyTrait[];
    disadvantages: BiographyTrait[];
    specialAbilities: BiographyTrait[];
  };
  talents: PrintableTalent[];
  combatTechniques: PrintableCombatTechnique[];
  equipment: Record<CombatItemKind, PrintableEquipmentEntry[]>;
  equipmentZones: ReturnType<typeof calculateEquipmentZones>;
  purse: Record<"d" | "s" | "h" | "k", string>;
  carrying: ReturnType<typeof calculateCarryingOverview>;
  conditions: {
    totalLevels: number;
    generalPenalty: number;
    physicalPenalty: number;
    entries: Array<{ id: string; name: string; level: number }>;
  };
  magic: {
    gifted: boolean;
    tradition: string;
    spells: PrintableMagicEntry[];
    cantrips: string[];
  };
  karma: {
    tradition: string;
    liturgies: PrintableMagicEntry[];
    blessings: string[];
  };
  notes: string;
  visualSlots: {
    portrait?: string;
    coatOfArms?: string;
    headerDecoration?: string;
  };
}

const emptyEquipment = (): Record<CombatItemKind, PrintableEquipmentEntry[]> => ({
  melee: [],
  ranged: [],
  shield: [],
  armor: [],
  helmet: [],
  equipment: [],
});

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const humanizeIdentifier = (value: string): string => {
  const clean = value
    .replace(/^DARKAID_(?:CHANT|BLESSING|CANTRIP)_/, "")
    .replaceAll("ae", "ä")
    .replaceAll("oe", "ö")
    .replaceAll("ue", "ü")
    .replace(/[_-]+/g, " ")
    .trim();
  return clean ? clean.charAt(0).toLocaleUpperCase("de") + clean.slice(1) : value;
};

export const formatPrintableTrait = (entry: BiographyTrait): string => [
  entry.name,
  entry.level && entry.level > 1 ? String(entry.level) : "",
  entry.variant ? `(${entry.variant})` : "",
].filter(Boolean).join(" ");

const resolveMagic = (id: string) => {
  const sourceId = id.startsWith("DARKAID_SPELL_") ? id.slice("DARKAID_SPELL_".length) : "";
  return ALL_SPELL_BY_ID[id] ?? DARKAID_MAGIC_BY_ID[id] ?? (sourceId ? DARKAID_MAGIC_BY_SOURCE_ID[sourceId] : undefined);
};

const generatorContext = (sheet: CharacterSheetState): Record<string, unknown> =>
  asObject(sheet.originalData?.generator) ?? {};

const getGeneratorDraft = (sheet: CharacterSheetState): Record<string, unknown> =>
  asObject(generatorContext(sheet).draft) ?? {};

const getSpeciesValues = (sheet: CharacterSheetState) => {
  const draft = getGeneratorDraft(sheet);
  const raceId = typeof draft.raceId === "string" ? draft.raceId : sheet.hero.rv;
  const race = GRW_CHARACTER_DATA.races.find((entry) => entry.id === raceId);
  return GRW_CHARACTER_DATA.species.find((entry) => entry.id === race?.speciesId);
};

const getExperienceName = (sheet: CharacterSheetState): string => {
  const draft = getGeneratorDraft(sheet);
  const id = typeof draft.experienceId === "string" ? draft.experienceId : sheet.hero.el;
  return GRW_CHARACTER_DATA.experiences.find((entry) => entry.id === id)?.name ?? String(id ?? "");
};

const getTraditionName = (sheet: CharacterSheetState): string => {
  const context = generatorContext(sheet);
  const tradition = asObject(context.tradition);
  if (typeof tradition?.name === "string") return tradition.name.replace(/^Tradition \(|\)$/g, "");
  return sheet.hero.biography?.specialAbilities?.find((entry) => entry.name.startsWith("Tradition"))?.name ?? "";
};

const cantripName = (id: string): string => {
  if (CANTRIPS[id]) return CANTRIPS[id];
  const sourceId = id.startsWith("DARKAID_CANTRIP_") ? id.slice("DARKAID_CANTRIP_".length) : id;
  const generatedName = (GRW_CHARACTER_DATA.cantripNames as Record<string, string>)[sourceId];
  return generatedName ?? humanizeIdentifier(sourceId);
};

export const buildPrintableCharacterData = (sheet: CharacterSheetState): PrintableCharacterData => {
  const biography = sheet.hero.biography;
  const equipment = emptyEquipment();
  for (const [id, item] of Object.entries(sheet.hero.belongings?.items ?? {})) {
    const kind = inferCombatItemKind(item);
    const damage = item.damageDiceSides
      ? `${item.damageDiceNumber ?? 1}W${item.damageDiceSides}${Number(item.damageFlat ?? 0) >= 0 ? "+" : ""}${item.damageFlat ?? 0}`
      : undefined;
    equipment[kind].push({
      id,
      name: item.name,
      kind,
      amount: Math.max(1, Number(item.amount) || 1),
      weight: Math.max(0, Number(item.weight) || 0),
      price: Math.max(0, Number(item.price) || 0),
      equipped: item.equipped !== false,
      notes: String(item.notes ?? ""),
      ...(item.combatTechnique ? { combatTechnique: item.combatTechnique } : {}),
      ...(damage ? { damage } : {}),
      ...(typeof item.at === "number" ? { at: item.at } : {}),
      ...(typeof item.pa === "number" ? { pa: item.pa } : {}),
      ...(typeof item.reach === "number" ? { reach: item.reach } : {}),
      ...(typeof item.reloadTime === "number" ? { reloadTime: item.reloadTime } : {}),
      ...(typeof item.rangeShort === "number" ? { ranges: `${item.rangeShort}/${item.rangeMedium ?? "-"}/${item.rangeLong ?? "-"}` } : {}),
      ...(typeof item.ammunition === "string" ? { ammunition: item.ammunition } : {}),
      ...(typeof item.pro === "number" ? { protection: item.pro } : typeof item.zoneProtection === "number" ? { protection: item.zoneProtection } : {}),
      ...(typeof item.enc === "number" ? { encumbrance: item.enc } : {}),
      ...(typeof item.movementPenalty === "number" ? { movementPenalty: item.movementPenalty } : {}),
      ...(typeof item.initiativePenalty === "number" ? { initiativePenalty: item.initiativePenalty } : {}),
      ...(typeof item.armorType === "string" ? { armorType: item.armorType } : {}),
      ...(typeof item.armorZone === "string" ? { armorZone: item.armorZone } : {}),
    });
  }
  for (const entries of Object.values(equipment)) entries.sort((a, b) => a.name.localeCompare(b.name, "de"));

  const attributes = getAttributeValues(sheet.hero);
  const conditionOverview = calculateConditionOverview(sheet);
  const carrying = calculateCarryingOverview(sheet);
  const equipmentZones = calculateEquipmentZones(sheet.hero.belongings?.items ?? {}, sheet.runtime.equipmentSlots);
  const combat = calculateCombatOverview(
    sheet.hero,
    sheet.runtime.combat.primaryWeaponId,
    sheet.runtime.combat.initiativeModifier,
    {
      attackDefensePenalty: conditionOverview.physicalPenalty,
      encumbranceLevel: conditionOverview.encumbrance,
      armorInitiativePenalty: conditionOverview.armorInitiativePenalty,
    },
  );
  const species = getSpeciesValues(sheet);
  const totalAp = Math.max(0, Number(sheet.hero.ap?.total) || 0);
  const remainingAp = Math.max(0, Number(sheet.runtime.advancement.availableAp) || 0);
  const context = generatorContext(sheet);
  const balance = asObject(context.balance);
  const spentAp = typeof balance?.spent === "number" ? balance.spent : Math.max(0, totalAp - remainingAp);
  const draft = getGeneratorDraft(sheet);
  const tradition = getTraditionName(sheet);
  const spells = Object.entries(sheet.hero.spells ?? {}).map(([id, value]) => {
    const definition = resolveMagic(id);
    return {
      id,
      name: definition?.name ?? humanizeIdentifier(id),
      value: Number(value) || 0,
      kind: definition?.kind ?? "Zauber",
      ...(definition?.check ? { check: definition.check } : {}),
      ...(definition?.improvementCost ? { improvementCost: definition.improvementCost } : {}),
    } satisfies PrintableMagicEntry;
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const liturgies = Object.entries(sheet.hero.liturgies ?? {}).map(([id, value]) => ({
    id,
    name: humanizeIdentifier(id),
    value: Number(value) || 0,
    kind: "Liturgie" as const,
  })).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const purse = sheet.hero.belongings?.purse ?? {};

  return {
    schemaVersion: PRINTABLE_SHEET_SCHEMA_VERSION,
    identity: {
      name: sheet.hero.name,
      sex: ({ m: "männlich", f: "weiblich", d: "divers / frei" } as Record<string, string>)[String(sheet.hero.sex ?? "")] ?? String(sheet.hero.sex ?? ""),
      species: biography?.species ?? "",
      culture: biography?.culture ?? "",
      profession: biography?.profession ?? "",
      experience: getExperienceName(sheet),
      concept: typeof draft.concept === "string" ? draft.concept : "",
    },
    attributes: ATTRIBUTES.map((attribute) => ({ id: attribute.id, code: attribute.code, name: attribute.name, value: attributes[attribute.code] })),
    resources: {
      life: { ...sheet.runtime.resources.lp },
      astral: { ...sheet.runtime.resources.ae },
      karma: { ...sheet.runtime.resources.kp },
      fate: { ...sheet.runtime.resources.fate },
    },
    adventurePoints: { total: totalAp, spent: Math.max(0, Number(spentAp) || 0), remaining: remainingAp },
    derived: {
      speed: Number(species?.baseValues.geschwindigkeit ?? 8),
      soulpower: Math.round((attributes.MU + attributes.KL + attributes.IN) / 6) + Number(species?.baseValues.seelenkraft ?? 0),
      toughness: Math.round((attributes.KO + attributes.KO + attributes.KK) / 6) + Number(species?.baseValues.zaehigkeit ?? 0),
      dodge: combat.dodge,
      initiative: combat.initiative,
      attack: combat.attack,
      ...(combat.parry === undefined ? {} : { parry: combat.parry }),
    },
    biography: {
      advantages: [...(biography?.advantages ?? [])],
      disadvantages: [...(biography?.disadvantages ?? [])],
      specialAbilities: [...(biography?.specialAbilities ?? [])],
    },
    talents: TALENTS.map((talent) => ({
      id: talent.id,
      name: talent.name,
      value: Number(sheet.hero.talents[talent.id]) || 0,
      check: talent.check,
      category: talent.category,
      improvementCost: talent.improvementCost,
    })),
    combatTechniques: Object.values(COMBAT_TECHNIQUE_RULES)
      .map((definition) => ({
        id: definition.id,
        name: definition.name,
        value: Number(sheet.hero.ct?.[definition.id] ?? 6),
        primaryAttributes: definition.primaryAttributes,
        improvementCost: definition.improvementCost,
        range: definition.range,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    equipment,
    equipmentZones,
    purse: { d: String(purse.d ?? "0"), s: String(purse.s ?? "0"), h: String(purse.h ?? "0"), k: String(purse.k ?? "0") },
    carrying,
    conditions: {
      totalLevels: conditionOverview.totalLevels,
      generalPenalty: conditionOverview.generalPenalty,
      physicalPenalty: conditionOverview.physicalPenalty,
      entries: CONDITION_DEFINITIONS.map((definition) => ({ id: definition.id, name: definition.name, level: conditionOverview.levels[definition.id] })),
    },
    magic: {
      gifted: isMagicallyGifted(sheet),
      tradition,
      spells,
      cantrips: (sheet.hero.cantrips ?? []).map(cantripName).sort((a, b) => a.localeCompare(b, "de")),
    },
    karma: {
      tradition,
      liturgies,
      blessings: (sheet.hero.blessings ?? []).map(humanizeIdentifier).sort((a, b) => a.localeCompare(b, "de")),
    },
    notes: sheet.runtime.notes,
    visualSlots: {},
  };
};
