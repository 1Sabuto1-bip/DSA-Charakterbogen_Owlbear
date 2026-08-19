import { describe, expect, it } from "vitest";
import { evaluateTalentRoll } from "../src/roll";

describe("DSA 5 talent checks", () => {
  it("spends skill points on exceeded attributes", () => {
    const result = evaluateTalentRoll([15, 12, 17], [13, 13, 13], 8);
    expect(result.differences).toEqual([2, 0, 4]);
    expect(result.remainingSkillPoints).toBe(2);
    expect(result.outcome).toBe("success");
    expect(result.qualityLevel).toBe(1);
  });

  it("applies a positive modifier as a relief", () => {
    const result = evaluateTalentRoll([15, 15, 15], [13, 13, 13], 3, 2);
    expect(result.targets).toEqual([15, 15, 15]);
    expect(result.remainingSkillPoints).toBe(3);
    expect(result.outcome).toBe("success");
  });

  it("recognizes critical successes and botches", () => {
    expect(evaluateTalentRoll([1, 1, 20], [10, 10, 10], 0).outcome).toBe("critical");
    expect(evaluateTalentRoll([20, 20, 1], [18, 18, 18], 20).outcome).toBe("botch");
  });
});
