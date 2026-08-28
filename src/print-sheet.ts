import { ATTRIBUTES, COMBAT_TECHNIQUES, TALENTS } from "./data";
import { inferCombatItemKind } from "./combat";
import type { AttributeCode, BiographyTrait, CharacterSheetState, CombatItemKind } from "./types";

export const PRINTABLE_SHEET_SCHEMA_VERSION = 1 as const;

export interface PrintableValue {
  id: string;
  name: string;
  value: number;
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
}

export interface PrintableCharacterData {
  schemaVersion: typeof PRINTABLE_SHEET_SCHEMA_VERSION;
  identity: {
    name: string;
    species: string;
    culture: string;
    profession: string;
  };
  attributes: Array<PrintableValue & { code: AttributeCode }>;
  resources: {
    life: { current: number; max: number };
    astral: { current: number; max: number };
    karma: { current: number; max: number };
    fate: { current: number; max: number };
  };
  biography: {
    advantages: BiographyTrait[];
    disadvantages: BiographyTrait[];
    specialAbilities: BiographyTrait[];
  };
  talents: PrintableValue[];
  combatTechniques: PrintableValue[];
  equipment: Record<CombatItemKind, PrintableEquipmentEntry[]>;
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

export const buildPrintableCharacterData = (sheet: CharacterSheetState): PrintableCharacterData => {
  const biography = sheet.hero.biography;
  const equipment = emptyEquipment();
  for (const [id, item] of Object.entries(sheet.hero.belongings?.items ?? {})) {
    const kind = inferCombatItemKind(item);
    equipment[kind].push({
      id,
      name: item.name,
      kind,
      amount: Math.max(1, Number(item.amount) || 1),
      weight: Math.max(0, Number(item.weight) || 0),
      price: Math.max(0, Number(item.price) || 0),
      equipped: item.equipped !== false,
      notes: String(item.notes ?? ""),
    });
  }
  for (const entries of Object.values(equipment)) entries.sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    schemaVersion: PRINTABLE_SHEET_SCHEMA_VERSION,
    identity: {
      name: sheet.hero.name,
      species: biography?.species ?? "",
      culture: biography?.culture ?? "",
      profession: biography?.profession ?? "",
    },
    attributes: ATTRIBUTES.map((attribute) => ({
      id: attribute.id,
      code: attribute.code,
      name: attribute.name,
      value: Number(sheet.hero.attr.values.find((entry) => entry.id === attribute.id)?.value) || 0,
    })),
    resources: {
      life: { ...sheet.runtime.resources.lp },
      astral: { ...sheet.runtime.resources.ae },
      karma: { ...sheet.runtime.resources.kp },
      fate: { ...sheet.runtime.resources.fate },
    },
    biography: {
      advantages: [...(biography?.advantages ?? [])],
      disadvantages: [...(biography?.disadvantages ?? [])],
      specialAbilities: [...(biography?.specialAbilities ?? [])],
    },
    talents: TALENTS.map((talent) => ({ id: talent.id, name: talent.name, value: Number(sheet.hero.talents[talent.id]) || 0 })),
    combatTechniques: Object.entries(sheet.hero.ct ?? {})
      .map(([id, value]) => ({ id, name: COMBAT_TECHNIQUES[id] ?? id, value: Number(value) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    equipment,
    notes: sheet.runtime.notes,
    visualSlots: {},
  };
};
