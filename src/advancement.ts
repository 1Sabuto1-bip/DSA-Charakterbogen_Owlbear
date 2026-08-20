import type {
  AttributeCode,
  CombatTechniqueDefinition,
  ImprovementCost,
  TalentDefinition,
} from "./types";

const BASE_COST: Record<ImprovementCost, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 15,
};

/** AP cost for reaching the supplied target value from the previous value. */
export const improvementCostForTarget = (column: ImprovementCost, targetValue: number): number => {
  const target = Math.max(0, Math.trunc(targetValue));
  const base = BASE_COST[column];
  if (column === "E") return target <= 14 ? base : base * (target - 13);
  return target <= 12 ? base : base * (target - 11);
};

export const talentMaximum = (
  definition: TalentDefinition,
  attributes: Record<AttributeCode, number>,
): number => Math.max(...definition.check.map((attribute) => attributes[attribute])) + 2;

export const combatTechniqueMaximum = (
  definition: CombatTechniqueDefinition,
  attributes: Record<AttributeCode, number>,
): number => Math.max(...definition.primaryAttributes.map((attribute) => attributes[attribute])) + 2;

export const spellMaximum = (hasFeatureKnowledge: boolean): number =>
  hasFeatureKnowledge ? 25 : 14;

