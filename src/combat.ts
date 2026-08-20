import { ATTRIBUTE_BY_ID, COMBAT_TECHNIQUE_RULES } from "./data";
import type {
  AttributeCode,
  CombatItemKind,
  InitiativeRoll,
  OptolithHero,
  OptolithItem,
} from "./types";

export interface CombatOverview {
  primaryWeaponId?: string;
  primaryWeaponName: string;
  primaryWeaponKind: CombatItemKind | "unarmed";
  combatTechniqueName: string;
  attackLabel: "AT" | "FK";
  attack: number;
  parry?: number;
  dodge: number;
  initiativeBase: number;
  armorModifier: number;
  manualInitiativeModifier: number;
  initiative: number;
}

export const inferCombatItemKind = (item: OptolithItem): CombatItemKind => {
  if (item.itemKind) return item.itemKind;
  if (item.gr === 4 || typeof item.pro === "number") return "armor";
  if (item.combatTechnique === "CT_10") return "shield";
  if (item.gr === 2 || COMBAT_TECHNIQUE_RULES[item.combatTechnique ?? ""]?.range === "ranged") return "ranged";
  if (item.damageDiceSides || item.combatTechnique) return "melee";
  return "equipment";
};

const getAttributeValues = (hero: OptolithHero): Record<AttributeCode, number> => {
  const values: Partial<Record<AttributeCode, number>> = {};
  for (const entry of hero.attr.values) {
    const definition = ATTRIBUTE_BY_ID[entry.id as keyof typeof ATTRIBUTE_BY_ID];
    if (definition && Number.isFinite(entry.value)) values[definition.code] = entry.value;
  }
  return {
    MU: values.MU ?? 0,
    KL: values.KL ?? 0,
    IN: values.IN ?? 0,
    CH: values.CH ?? 0,
    FF: values.FF ?? 0,
    GE: values.GE ?? 0,
    KO: values.KO ?? 0,
    KK: values.KK ?? 0,
  };
};

const attributeCombatBonus = (value: number): number => Math.floor(Math.max(0, value - 8) / 3);

const combatItems = (hero: OptolithHero): Array<[string, OptolithItem]> =>
  Object.entries(hero.belongings?.items ?? {}).filter(([, item]) => {
    const kind = inferCombatItemKind(item);
    return kind === "melee" || kind === "ranged" || kind === "shield";
  });

export const getDefaultPrimaryWeaponId = (hero: OptolithHero): string | undefined => {
  const items = combatItems(hero);
  const equipped = items.filter(([, item]) => item.equipped !== false);
  const candidates = equipped.length ? equipped : items;
  const priority: CombatItemKind[] = ["melee", "ranged", "shield"];
  for (const kind of priority) {
    const match = candidates.find(([, item]) => inferCombatItemKind(item) === kind);
    if (match) return match[0];
  }
  return undefined;
};

const resolvePrimaryWeapon = (
  hero: OptolithHero,
  primaryWeaponId?: string,
): [string, OptolithItem] | undefined => {
  const items = combatItems(hero);
  const selected = primaryWeaponId ? items.find(([id]) => id === primaryWeaponId) : undefined;
  if (selected) return selected;
  const fallbackId = getDefaultPrimaryWeaponId(hero);
  return fallbackId ? items.find(([id]) => id === fallbackId) : undefined;
};

const equippedArmorModifier = (hero: OptolithHero): number => {
  const modifiers = Object.values(hero.belongings?.items ?? {})
    .filter((item) => inferCombatItemKind(item) === "armor" && item.equipped !== false)
    .map((item) => -Math.max(0, Number(item.enc ?? 0)) + Math.min(0, Number(item.initiativePenalty ?? 0)));
  return modifiers.length ? Math.min(...modifiers) : 0;
};

const passiveShieldBonus = (hero: OptolithHero, primaryWeaponId?: string): number =>
  Math.max(
    0,
    ...Object.entries(hero.belongings?.items ?? {})
      .filter(([id, item]) => id !== primaryWeaponId && inferCombatItemKind(item) === "shield" && item.equipped !== false)
      .map(([, item]) => Number(item.pa ?? 0)),
  );

export const calculateCombatOverview = (
  hero: OptolithHero,
  primaryWeaponId?: string,
  manualInitiativeModifier = 0,
): CombatOverview => {
  const attributes = getAttributeValues(hero);
  const resolved = resolvePrimaryWeapon(hero, primaryWeaponId);
  const selectedId = resolved?.[0];
  const weapon = resolved?.[1];
  const kind = weapon ? inferCombatItemKind(weapon) : "unarmed";
  const techniqueId = weapon?.combatTechnique ?? "CT_9";
  const technique = COMBAT_TECHNIQUE_RULES[techniqueId] ?? COMBAT_TECHNIQUE_RULES.CT_9;
  const techniqueValue = Number(hero.ct?.[technique.id] ?? 6);
  const ranged = kind === "ranged" || technique.range === "ranged";
  const attack = ranged
    ? techniqueValue + attributeCombatBonus(attributes.FF)
    : techniqueValue + attributeCombatBonus(attributes.MU) + Number(weapon?.at ?? 0);
  const leadAttribute = Math.max(...technique.primaryAttributes.map((code) => attributes[code]));
  const baseParry = Math.ceil(techniqueValue / 2) + attributeCombatBonus(leadAttribute);
  const parry = ranged
    ? undefined
    : kind === "shield"
      ? baseParry + Number(weapon?.pa ?? 0) * 2
      : baseParry + Number(weapon?.pa ?? 0) + passiveShieldBonus(hero, selectedId);
  const initiativeBase = Math.round((attributes.MU + attributes.GE) / 2);
  const armorModifier = equippedArmorModifier(hero);
  const initiative = Math.max(0, initiativeBase + armorModifier + manualInitiativeModifier);

  return {
    primaryWeaponId: selectedId,
    primaryWeaponName: weapon?.name ?? "Waffenlos",
    primaryWeaponKind: kind,
    combatTechniqueName: technique.name,
    attackLabel: ranged ? "FK" : "AT",
    attack,
    parry,
    dodge: Math.ceil(attributes.GE / 2),
    initiativeBase,
    armorModifier,
    manualInitiativeModifier,
    initiative,
  };
};

export const rollInitiative = (
  overview: CombatOverview,
  random: () => number = Math.random,
): InitiativeRoll => {
  const die = Math.min(6, Math.max(1, Math.floor(random() * 6) + 1));
  return {
    die,
    base: overview.initiativeBase,
    armorModifier: overview.armorModifier,
    manualModifier: overview.manualInitiativeModifier,
    total: Math.max(0, overview.initiative + die),
    rolledAt: new Date().toISOString(),
  };
};
