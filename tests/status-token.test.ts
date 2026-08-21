import { describe, expect, it } from "vitest";
import { createStatusTokenLayout, getStatusTokenText } from "../src/status-token";
import type { TokenSheetSummary } from "../src/types";

const summary = (current: number, initiative = 14): TokenSheetSummary => ({
  version: 2,
  heroId: "hero-1",
  name: "Testheld",
  lp: { current, max: 40 },
  fate: { current: 3, max: 3 },
  initiative,
  combat: {
    primaryWeaponName: "Schwert",
    attackLabel: "AT",
    attack: 14,
    parry: 9,
    dodge: 7,
    initiative,
  },
  updatedAt: "2026-08-21T10:00:00.000Z",
});

describe("rechteckige Tokenanzeige", () => {
  it("richtet das Profilfenster bei Originalmaß am Charaktertoken aus", () => {
    const layout = createStatusTokenLayout({
      min: { x: -210, y: -110 },
      max: { x: 410, y: 510 },
      center: { x: 100, y: 200 },
    });
    expect(layout.scale).toBe(1);
    expect(layout.framePosition).toEqual({ x: 731, y: 200 });
    expect(layout.lp.position).toEqual({ x: 1005, y: 53 });
    expect(layout.initiative.position).toEqual({ x: 1535, y: 221 });
  });

  it("skaliert Rahmen, Textfelder und Schrift mit kleinen Tokens", () => {
    const layout = createStatusTokenLayout({
      min: { x: 0, y: 0 },
      max: { x: 310, y: 310 },
      center: { x: 155, y: 155 },
    });
    expect(layout.scale).toBe(0.5);
    expect(layout.lp.width).toBe(255);
    expect(layout.condition.fontSize).toBe(27);
  });

  it("liefert LeP, Gesundheitszustand und Kampfinitiative für die Anzeige", () => {
    expect(getStatusTokenText(summary(40, 16))).toEqual({
      lp: "40 / 40",
      condition: "GESUND",
      initiative: "16",
    });
    expect(getStatusTokenText(summary(8))).toMatchObject({ condition: "SCHWER VERWUNDET" });
    expect(getStatusTokenText(summary(0))).toMatchObject({ condition: "OHNMÄCHTIG" });
  });
});
