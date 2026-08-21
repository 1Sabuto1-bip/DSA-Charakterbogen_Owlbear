import { getHealthPresentation } from "./group-monitor";
import type { TokenSheetSummary } from "./types";

export const STATUS_TOKEN_FRAME = {
  width: 2022,
  height: 778,
  portraitCenter: { x: 380, y: 389 },
  portraitOpeningDiameter: 620,
  fields: {
    lp: { x: 1285, y: 242, width: 510, height: 92, fontSize: 64 },
    condition: { x: 1235, y: 485, width: 720, height: 138, fontSize: 54 },
    initiative: { x: 1815, y: 410, width: 205, height: 130, fontSize: 64 },
  },
} as const;

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  min: Point;
  max: Point;
  center: Point;
}

export interface StatusTokenTextLayout {
  position: Point;
  width: number;
  height: number;
  fontSize: number;
}

interface StatusTokenField {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface StatusTokenLayout {
  scale: number;
  framePosition: Point;
  lp: StatusTokenTextLayout;
  condition: StatusTokenTextLayout;
  initiative: StatusTokenTextLayout;
}

export const createStatusTokenLayout = (bounds: Bounds): StatusTokenLayout => {
  const tokenWidth = Math.max(1, bounds.max.x - bounds.min.x);
  const tokenHeight = Math.max(1, bounds.max.y - bounds.min.y);
  const portraitDiameter = Math.max(64, Math.min(tokenWidth, tokenHeight));
  const scale = portraitDiameter / STATUS_TOKEN_FRAME.portraitOpeningDiameter;
  const framePosition = {
    x: bounds.center.x + (STATUS_TOKEN_FRAME.width / 2 - STATUS_TOKEN_FRAME.portraitCenter.x) * scale,
    y: bounds.center.y + (STATUS_TOKEN_FRAME.height / 2 - STATUS_TOKEN_FRAME.portraitCenter.y) * scale,
  };
  const pointInFrame = (point: Point): Point => ({
    x: framePosition.x + (point.x - STATUS_TOKEN_FRAME.width / 2) * scale,
    y: framePosition.y + (point.y - STATUS_TOKEN_FRAME.height / 2) * scale,
  });
  const textLayout = (field: StatusTokenField): StatusTokenTextLayout => ({
    position: pointInFrame(field),
    width: field.width * scale,
    height: field.height * scale,
    fontSize: Math.max(12, field.fontSize * scale),
  });
  return {
    scale,
    framePosition,
    lp: textLayout(STATUS_TOKEN_FRAME.fields.lp),
    condition: textLayout(STATUS_TOKEN_FRAME.fields.condition),
    initiative: textLayout(STATUS_TOKEN_FRAME.fields.initiative),
  };
};

export const getStatusTokenText = (summary: TokenSheetSummary): {
  lp: string;
  condition: string;
  initiative: string;
} => ({
  lp: `${summary.lp.current} / ${summary.lp.max}`,
  condition: getHealthPresentation(summary.lp).label.toLocaleUpperCase("de"),
  initiative: String(summary.combat?.initiative ?? summary.initiative),
});
