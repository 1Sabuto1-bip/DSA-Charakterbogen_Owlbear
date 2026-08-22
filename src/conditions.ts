import { inferCombatItemKind } from "./combat";
import type {
  CarryingRuntimeState,
  CharacterSheetState,
  ConditionId,
  ConditionLevels,
  ConditionRuntimeState,
} from "./types";

export interface ConditionDefinition {
  id: ConditionId;
  name: string;
  recovery: string;
  stageEffects: [string, string, string, string, string];
}

export const CONDITION_DEFINITIONS: ConditionDefinition[] = [
  {
    id: "stun",
    name: "Betäubung",
    recovery: "Ohne andere Angabe sinkt sie nach 3 Stunden Ruhe um 1 Stufe.",
    stageEffects: [
      "keine Auswirkung",
      "leicht angeschlagen · alle Proben −1",
      "angeschlagen · alle Proben −2",
      "schwer angeschlagen · alle Proben −3",
      "handlungsunfähig",
    ],
  },
  {
    id: "rapture",
    name: "Entrückung",
    recovery: "Sie sinkt gewöhnlich jede Stunde um 1 Stufe.",
    stageEffects: [
      "keine Auswirkung",
      "Talente und Zauber −1, sofern nicht gottgefällig",
      "gottgefällig +1 · andere Proben −2",
      "gottgefällig +2 · andere Proben −3",
      "gottgefällig +3 · andere Proben −4",
    ],
  },
  {
    id: "fear",
    name: "Furcht",
    recovery: "Ohne Auslöser sinkt sie gewöhnlich alle 5 Minuten um 1 Stufe.",
    stageEffects: [
      "keine Auswirkung",
      "beunruhigt · alle Proben −1",
      "verängstigt · alle Proben −2",
      "in Panik · alle Proben −3",
      "katatonisch · handlungsunfähig",
    ],
  },
  {
    id: "paralysis",
    name: "Paralyse",
    recovery: "Ohne andere Angabe sinkt sie jede halbe Stunde um 1 Stufe.",
    stageEffects: [
      "keine Auswirkung",
      "Bewegung/Sprache −1 · GS 75 %",
      "Bewegung/Sprache −2 · GS 50 %",
      "Bewegung/Sprache −3 · GS 25 %",
      "bewegungsunfähig",
    ],
  },
  {
    id: "pain",
    name: "Schmerz",
    recovery: "Der Bogen kann die Stufe automatisch aus den LeP bestimmen.",
    stageEffects: [
      "keine Auswirkung",
      "leichte Schmerzen · alle Proben −1 · GS −1",
      "ablenkende Schmerzen · alle Proben −2 · GS −2",
      "starke Schmerzen · alle Proben −3 · GS −3",
      "handlungsunfähig; mit Selbstbeherrschung alle Proben −4",
    ],
  },
  {
    id: "confusion",
    name: "Verwirrung",
    recovery: "Ohne andere Angabe sinkt sie jede Stunde um 1 Stufe.",
    stageEffects: [
      "keine Auswirkung",
      "leicht verwirrt · alle Proben −1",
      "verwirrt · alle Proben −2",
      "alle Proben −3 · keine komplexen magischen oder Wissenstätigkeiten",
      "handlungsunfähig",
    ],
  },
];

export const CONDITION_BY_ID = Object.fromEntries(
  CONDITION_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<ConditionId, ConditionDefinition>;

export const createConditionLevels = (): ConditionLevels => ({
  stun: 0,
  rapture: 0,
  fear: 0,
  paralysis: 0,
  pain: 0,
  confusion: 0,
});

export const createConditionRuntimeState = (): ConditionRuntimeState => ({
  levels: createConditionLevels(),
  automaticPain: true,
  manualEncumbrance: 0,
  encumbranceReduction: 0,
});

export const createCarryingRuntimeState = (): CarryingRuntimeState => ({
  additionalWeight: 0,
  capacityModifier: 0,
});

const clampStage = (value: number): number => Math.max(0, Math.min(4, Math.round(value)));

export const calculatePainLevel = (current: number, maximum: number): number => {
  if (maximum <= 0 || current >= maximum) return 0;
  let level = 0;
  if (current <= maximum * 0.75) level += 1;
  if (current <= maximum * 0.5) level += 1;
  if (current <= maximum * 0.25) level += 1;
  if (current <= 5) level += 1;
  return clampStage(level);
};

const itemWeight = (weight: unknown, amount: unknown): number =>
  Math.max(0, Number(weight) || 0) * Math.max(0, Number(amount) || 1);

export interface CarryingOverview {
  inventoryWeight: number;
  ignoredArmorWeight: number;
  additionalWeight: number;
  countedWeight: number;
  baseCapacity: number;
  capacityModifier: number;
  capacity: number;
  overload: number;
  cargoEncumbrance: number;
  armorEncumbrance: number;
  manualEncumbrance: number;
  encumbranceReduction: number;
  encumbrance: number;
  nextEncumbranceAt?: number;
}

export const calculateCarryingOverview = (sheet: CharacterSheetState): CarryingOverview => {
  const items = Object.values(sheet.hero.belongings?.items ?? {});
  const inventoryWeight = items.reduce((sum, item) => sum + itemWeight(item.weight, item.amount), 0);
  const equippedArmor = items.filter((item) =>
    inferCombatItemKind(item) === "armor" && item.equipped !== false,
  );
  const ignoredArmorWeight = equippedArmor.reduce(
    (sum, item) => sum + itemWeight(item.weight, item.amount),
    0,
  );
  const additionalWeight = Math.max(0, Number(sheet.runtime.carrying.additionalWeight) || 0);
  const countedWeight = Math.max(0, inventoryWeight - ignoredArmorWeight + additionalWeight);
  const strength = Number(sheet.hero.attr.values.find((attribute) => attribute.id === "ATTR_8")?.value) || 0;
  const baseCapacity = Math.max(0, strength * 2);
  const capacityModifier = Number(sheet.runtime.carrying.capacityModifier) || 0;
  const capacity = Math.max(0, baseCapacity + capacityModifier);
  const overload = Math.max(0, countedWeight - capacity);
  const cargoEncumbrance = clampStage(Math.floor(overload / 4));
  const armorEncumbrance = clampStage(Math.max(0, ...equippedArmor.map((item) => Number(item.enc) || 0)));
  const manualEncumbrance = clampStage(sheet.runtime.conditions.manualEncumbrance);
  const encumbranceReduction = clampStage(sheet.runtime.conditions.encumbranceReduction);
  const encumbrance = clampStage(
    cargoEncumbrance + armorEncumbrance + manualEncumbrance - encumbranceReduction,
  );
  const nextCargoStage = cargoEncumbrance >= 4 ? undefined : capacity + (cargoEncumbrance + 1) * 4;

  return {
    inventoryWeight,
    ignoredArmorWeight,
    additionalWeight,
    countedWeight,
    baseCapacity,
    capacityModifier,
    capacity,
    overload,
    cargoEncumbrance,
    armorEncumbrance,
    manualEncumbrance,
    encumbranceReduction,
    encumbrance,
    nextEncumbranceAt: nextCargoStage,
  };
};

export interface ConditionOverview {
  levels: ConditionLevels;
  encumbrance: number;
  generalPenalty: number;
  physicalPenalty: number;
  totalLevels: number;
  incapacitated: boolean;
  potentiallyIncapacitated: boolean;
  activeLabels: string[];
}

export const calculateConditionOverview = (sheet: CharacterSheetState): ConditionOverview => {
  const levels = { ...createConditionLevels(), ...sheet.runtime.conditions.levels };
  for (const id of Object.keys(levels) as ConditionId[]) levels[id] = clampStage(levels[id]);
  if (sheet.runtime.conditions.automaticPain) {
    levels.pain = calculatePainLevel(
      sheet.runtime.resources.lp.current,
      sheet.runtime.resources.lp.max,
    );
  }
  const encumbrance = calculateCarryingOverview(sheet).encumbrance;
  const generalPenalty = Math.min(
    5,
    levels.stun + levels.rapture + levels.fear + levels.pain + levels.confusion,
  );
  const physicalPenalty = Math.min(5, generalPenalty + levels.paralysis + encumbrance);
  const totalLevels = Object.values(levels).reduce((sum, level) => sum + level, 0) + encumbrance;
  const hardIncapacity = levels.stun >= 4
    || levels.fear >= 4
    || levels.confusion >= 4
    || encumbrance >= 4
    || totalLevels >= 8;
  const painIncapacity = levels.pain >= 4;
  const activeLabels = CONDITION_DEFINITIONS
    .filter((definition) => levels[definition.id] > 0)
    .map((definition) => `${definition.name} ${levels[definition.id]}`);
  if (encumbrance > 0) activeLabels.push(`Belastung ${encumbrance}`);

  return {
    levels,
    encumbrance,
    generalPenalty,
    physicalPenalty,
    totalLevels,
    incapacitated: hardIncapacity,
    potentiallyIncapacitated: hardIncapacity || painIncapacity,
    activeLabels,
  };
};
