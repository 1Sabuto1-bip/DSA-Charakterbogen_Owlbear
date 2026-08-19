import type { TalentRollResult } from "./types";

const d20 = (): number => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] % 20) + 1;
};

export const evaluateTalentRoll = (
  rolls: [number, number, number],
  attributeValues: [number, number, number],
  skillPoints: number,
  modifier = 0,
): TalentRollResult => {
  const targets = attributeValues.map((value) => value + modifier) as [number, number, number];
  const differences = rolls.map((roll, index) => Math.max(0, roll - targets[index])) as [
    number,
    number,
    number,
  ];
  const remainingSkillPoints = skillPoints - differences.reduce((sum, value) => sum + value, 0);
  const ones = rolls.filter((value) => value === 1).length;
  const twenties = rolls.filter((value) => value === 20).length;

  if (ones >= 2) {
    const doubled = Math.max(5, Math.max(0, remainingSkillPoints) * 2);
    return {
      rolls,
      targets,
      differences,
      initialSkillPoints: skillPoints,
      remainingSkillPoints: doubled,
      qualityLevel: Math.min(6, Math.max(1, Math.ceil(doubled / 3))),
      outcome: "critical",
    };
  }

  if (twenties >= 2) {
    return {
      rolls,
      targets,
      differences,
      initialSkillPoints: skillPoints,
      remainingSkillPoints,
      qualityLevel: 0,
      outcome: "botch",
    };
  }

  const success = remainingSkillPoints >= 0;
  return {
    rolls,
    targets,
    differences,
    initialSkillPoints: skillPoints,
    remainingSkillPoints,
    qualityLevel: success ? Math.min(6, Math.max(1, Math.ceil(remainingSkillPoints / 3))) : 0,
    outcome: success ? "success" : "failure",
  };
};

export const rollTalent = (
  attributeValues: [number, number, number],
  skillPoints: number,
  modifier = 0,
): TalentRollResult =>
  evaluateTalentRoll([d20(), d20(), d20()], attributeValues, skillPoints, modifier);
