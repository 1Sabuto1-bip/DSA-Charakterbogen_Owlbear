import { calculateCombatOverview } from "./combat";
import { calculateCarryingOverview, calculateConditionOverview } from "./conditions";
import { getAttributeValues } from "./importer";
import type {
  CharacterSheetState,
  HealthStatus,
  ResourceValue,
  TokenSheetSummary,
} from "./types";

export interface HealthPresentation {
  status: HealthStatus;
  label: "Gesund" | "Leicht verletzt" | "Schwer verwundet" | "Ohnmächtig";
  color: string;
  ratio: number;
}

export interface GroupHiddenMarker {
  version: 1;
  heroId: string;
  removedAt: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const createGroupHiddenMarker = (
  heroId: string,
  removedAt = new Date().toISOString(),
): GroupHiddenMarker => ({ version: 1, heroId, removedAt });

export const parseGroupHiddenMarker = (value: unknown): GroupHiddenMarker | null => {
  if (
    !isObject(value)
    || value.version !== 1
    || typeof value.heroId !== "string"
    || typeof value.removedAt !== "string"
  ) return null;
  return value as unknown as GroupHiddenMarker;
};

export const isGroupSummaryHidden = (value: unknown, heroId: string): boolean =>
  parseGroupHiddenMarker(value)?.heroId === heroId;

const isResource = (value: unknown): value is ResourceValue =>
  isObject(value)
  && typeof value.current === "number"
  && Number.isFinite(value.current)
  && typeof value.max === "number"
  && Number.isFinite(value.max);

export const getHealthPresentation = (lp: ResourceValue): HealthPresentation => {
  const maximum = Math.max(1, lp.max);
  const ratio = Math.max(0, Math.min(1, lp.current / maximum));
  if (lp.current <= 0) {
    return { status: "unconscious", label: "Ohnmächtig", color: "#4a3f50", ratio: 0 };
  }
  if (ratio > 0.75) {
    return { status: "healthy", label: "Gesund", color: "#2f6f4e", ratio };
  }
  if (ratio > 0.25) {
    return { status: "lightlyInjured", label: "Leicht verletzt", color: "#a96d16", ratio };
  }
  return { status: "severelyWounded", label: "Schwer verwundet", color: "#9f392f", ratio };
};

export const createTokenSheetSummary = (state: CharacterSheetState): TokenSheetSummary => {
  const { resources } = state.runtime;
  const conditions = calculateConditionOverview(state);
  const carrying = calculateCarryingOverview(state);
  const combat = calculateCombatOverview(
    state.hero,
    state.runtime.combat.primaryWeaponId,
    state.runtime.combat.initiativeModifier,
    {
      attackDefensePenalty: conditions.physicalPenalty,
      encumbranceLevel: conditions.encumbrance,
    },
  );
  return {
    version: 3,
    heroId: state.hero.id,
    name: state.hero.name,
    lp: { ...resources.lp },
    ...(resources.ae.max > 0 ? { ae: { ...resources.ae } } : {}),
    ...(resources.kp.max > 0 ? { kp: { ...resources.kp } } : {}),
    fate: { ...resources.fate },
    initiative: combat.initiative,
    healthStatus: getHealthPresentation(resources.lp).status,
    attributes: getAttributeValues(state.hero),
    combat: {
      primaryWeaponName: combat.primaryWeaponName,
      attackLabel: combat.attackLabel,
      attack: combat.attack,
      ...(combat.parry === undefined ? {} : { parry: combat.parry }),
      dodge: combat.dodge,
      initiative: combat.initiative,
    },
    conditions: {
      generalPenalty: conditions.generalPenalty,
      physicalPenalty: conditions.physicalPenalty,
      totalLevels: conditions.totalLevels,
      encumbrance: conditions.encumbrance,
      incapacitated: conditions.potentiallyIncapacitated,
      active: conditions.activeLabels,
    },
    carrying: {
      weight: carrying.countedWeight,
      capacity: carrying.capacity,
    },
    updatedAt: new Date().toISOString(),
  };
};

export const parseTokenSheetSummary = (value: unknown): TokenSheetSummary | null => {
  if (
    !isObject(value)
    || typeof value.heroId !== "string"
    || typeof value.name !== "string"
    || !isResource(value.lp)
    || !isResource(value.fate)
    || typeof value.initiative !== "number"
    || typeof value.updatedAt !== "string"
  ) return null;
  return value as unknown as TokenSheetSummary;
};
