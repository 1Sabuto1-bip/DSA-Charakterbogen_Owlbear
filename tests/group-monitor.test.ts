import { describe, expect, it } from "vitest";

import {
  createTokenSheetSummary,
  getHealthPresentation,
  parseTokenSheetSummary,
} from "../src/group-monitor";
import { createManualState } from "../src/importer";

describe("group monitor summaries", () => {
  it("maps life point thresholds to the requested health states", () => {
    expect(getHealthPresentation({ current: 31, max: 31 }).status).toBe("healthy");
    expect(getHealthPresentation({ current: 23, max: 31 }).status).toBe("lightlyInjured");
    expect(getHealthPresentation({ current: 7, max: 31 }).status).toBe("severelyWounded");
    expect(getHealthPresentation({ current: 0, max: 31 }).status).toBe("unconscious");
  });

  it("creates a compact token summary with attributes and combat values", () => {
    const state = createManualState("Rondrik", { species: "dwarf" });
    state.hero.attr.values.forEach((attribute, index) => {
      attribute.value = 10 + index;
    });
    state.runtime.resources.lp = { current: 20, max: 30 };
    const summary = createTokenSheetSummary(state);

    expect(summary.version).toBe(2);
    expect(summary.name).toBe("Rondrik");
    expect(summary.healthStatus).toBe("lightlyInjured");
    expect(summary.attributes).toEqual({ MU: 10, KL: 11, IN: 12, CH: 13, FF: 14, GE: 15, KO: 16, KK: 17 });
    expect(summary.combat).toMatchObject({ attackLabel: "AT", dodge: 8, initiative: 13 });
  });

  it("accepts summaries from older connected tokens", () => {
    const legacy = {
      heroId: "old-hero",
      name: "Alrik",
      lp: { current: 17, max: 30 },
      fate: { current: 2, max: 3 },
      initiative: 14,
      updatedAt: "2026-08-20T12:00:00.000Z",
    };
    expect(parseTokenSheetSummary(legacy)).toEqual(legacy);
  });

  it("rejects unrelated token metadata", () => {
    expect(parseTokenSheetSummary({ name: "Dekoration" })).toBeNull();
  });
});
