import { COMBAT_TECHNIQUES } from "./data";
import { buildPrintableCharacterData, formatPrintableTrait } from "./print-sheet";
import andalusDataUrl from "./assets/andlso.ttf?inline";
import gentiumBoldDataUrl from "./assets/GenBasB.ttf?inline";
import gentiumItalicDataUrl from "./assets/GenBasI.ttf?inline";
import gentiumRegularDataUrl from "./assets/GenBasR.ttf?inline";
import type {
  PrintableCharacterData,
  PrintableCombatTechnique,
  PrintableEquipmentEntry,
  PrintableTalent,
} from "./print-sheet";
import type { CharacterSheetState } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_LEFT = 40;
const PAGE_RIGHT = 555.28;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT;

type FontKey = "andalus" | "gentium" | "gentiumBold" | "gentiumItalic";
type Align = "left" | "center" | "right";
type RGB = [number, number, number];

const COLORS = {
  ink: [0.15, 0.13, 0.09] as RGB,
  forest: [0.09, 0.25, 0.21] as RGB,
  forestLight: [0.88, 0.93, 0.90] as RGB,
  gold: [0.72, 0.54, 0.21] as RGB,
  goldLight: [0.96, 0.92, 0.80] as RGB,
  paper: [1, 0.995, 0.965] as RGB,
  paperDeep: [0.96, 0.93, 0.86] as RGB,
  line: [0.55, 0.50, 0.40] as RGB,
  muted: [0.38, 0.35, 0.29] as RGB,
  white: [1, 1, 1] as RGB,
};

const ATTRIBUTE_COLORS: Record<string, RGB> = {
  MU: [0.65, 0.18, 0.16],
  KL: [0.38, 0.24, 0.53],
  IN: [0.18, 0.48, 0.25],
  CH: [0.15, 0.15, 0.15],
  FF: [0.67, 0.53, 0.12],
  GE: [0.20, 0.43, 0.61],
  KO: [0.34, 0.34, 0.31],
  KK: [0.50, 0.32, 0.13],
};

const fmt = (value: number): string => Number(value.toFixed(3)).toString();
const color = ([r, g, b]: RGB): string => `${fmt(r)} ${fmt(g)} ${fmt(b)}`;

const CP1252: Record<string, number> = {
  "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135,
  "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145,
  "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152,
  "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159,
};

const CP1252_UNICODE: Record<number, number> = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 134: 0x2020,
  135: 0x2021, 136: 0x02c6, 137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152,
  142: 0x017d, 145: 0x2018, 146: 0x2019, 147: 0x201c, 148: 0x201d, 149: 0x2022,
  150: 0x2013, 151: 0x2014, 152: 0x02dc, 153: 0x2122, 154: 0x0161, 155: 0x203a,
  156: 0x0153, 158: 0x017e, 159: 0x0178,
};

const normalizeText = (value: unknown): string => String(value ?? "")
  .replaceAll("−", "-")
  .replaceAll(" ", " ")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const winAnsi = (value: string): string => Array.from(normalizeText(value)).map((character) => {
  const codePoint = character.codePointAt(0) ?? 63;
  if (codePoint <= 255) return String.fromCharCode(codePoint);
  return String.fromCharCode(CP1252[character] ?? 63);
}).join("");

const pdfLiteral = (value: unknown): string => `(${winAnsi(normalizeText(value))
  .replaceAll("\\", "\\\\")
  .replaceAll("(", "\\(")
  .replaceAll(")", "\\)")})`;

const bytes = (value: string): Uint8Array => {
  const result = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) result[index] = value.charCodeAt(index) & 0xff;
  return result;
};

const byteString = (value: Uint8Array): string => {
  let result = "";
  for (let offset = 0; offset < value.length; offset += 8_192) {
    result += String.fromCharCode(...value.subarray(offset, Math.min(value.length, offset + 8_192)));
  }
  return result;
};

interface TtfTable {
  offset: number;
  length: number;
}

interface PdfFontDefinition {
  resource: "F1" | "F2" | "F3" | "F4";
  baseName: string;
  data: Uint8Array;
  widths: number[];
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
  flags: number;
  stemV: number;
}

const decodeFontDataUrl = (dataUrl: string): Uint8Array => {
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Eingebettete Schriftdatei ist ungültig.");
  const binary = atob(dataUrl.slice(separator + 1));
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
};

const fontTables = (view: DataView): Record<string, TtfTable> => {
  const tables: Record<string, TtfTable> = {};
  const tableCount = view.getUint16(4, false);
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(
      view.getUint8(record), view.getUint8(record + 1), view.getUint8(record + 2), view.getUint8(record + 3),
    );
    tables[tag] = { offset: view.getUint32(record + 8, false), length: view.getUint32(record + 12, false) };
  }
  return tables;
};

const cmapGlyph = (view: DataView, cmap: TtfTable, codePoint: number): number => {
  const candidates: Array<{ offset: number; priority: number }> = [];
  const count = view.getUint16(cmap.offset + 2, false);
  for (let index = 0; index < count; index += 1) {
    const record = cmap.offset + 4 + index * 8;
    const platform = view.getUint16(record, false);
    const encoding = view.getUint16(record + 2, false);
    const offset = cmap.offset + view.getUint32(record + 4, false);
    const format = view.getUint16(offset, false);
    if (format !== 4 && format !== 12) continue;
    const priority = format === 12 ? 50 : platform === 3 && encoding === 1 ? 40 : platform === 0 ? 30 : 10;
    candidates.push({ offset, priority });
  }
  candidates.sort((a, b) => b.priority - a.priority);
  for (const candidate of candidates) {
    const format = view.getUint16(candidate.offset, false);
    if (format === 12) {
      const groupCount = view.getUint32(candidate.offset + 12, false);
      for (let index = 0; index < groupCount; index += 1) {
        const group = candidate.offset + 16 + index * 12;
        const start = view.getUint32(group, false);
        const end = view.getUint32(group + 4, false);
        if (codePoint >= start && codePoint <= end) return view.getUint32(group + 8, false) + codePoint - start;
      }
    } else {
      const segmentCount = view.getUint16(candidate.offset + 6, false) / 2;
      const endCodes = candidate.offset + 14;
      const startCodes = endCodes + segmentCount * 2 + 2;
      const deltas = startCodes + segmentCount * 2;
      const rangeOffsets = deltas + segmentCount * 2;
      for (let index = 0; index < segmentCount; index += 1) {
        const end = view.getUint16(endCodes + index * 2, false);
        if (codePoint > end) continue;
        const start = view.getUint16(startCodes + index * 2, false);
        if (codePoint < start) break;
        const delta = view.getInt16(deltas + index * 2, false);
        const rangeOffsetAddress = rangeOffsets + index * 2;
        const rangeOffset = view.getUint16(rangeOffsetAddress, false);
        if (!rangeOffset) return (codePoint + delta) & 0xffff;
        const glyphAddress = rangeOffsetAddress + rangeOffset + (codePoint - start) * 2;
        if (glyphAddress + 2 > view.byteLength) return 0;
        const glyph = view.getUint16(glyphAddress, false);
        return glyph ? (glyph + delta) & 0xffff : 0;
      }
    }
  }
  return 0;
};

const scaledMetric = (value: number, unitsPerEm: number): number => Math.round(value * 1_000 / unitsPerEm);

const createFontDefinition = (
  resource: PdfFontDefinition["resource"],
  baseName: string,
  dataUrl: string,
  options: { bold?: boolean; italic?: boolean; script?: boolean } = {},
): PdfFontDefinition => {
  const data = decodeFontDataUrl(dataUrl);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tables = fontTables(view);
  const head = tables.head;
  const hhea = tables.hhea;
  const hmtx = tables.hmtx;
  const cmap = tables.cmap;
  if (!head || !hhea || !hmtx || !cmap) throw new Error(`Die Schrift ${baseName} enthält nicht alle benötigten TrueType-Tabellen.`);
  const unitsPerEm = view.getUint16(head.offset + 18, false);
  const metricCount = view.getUint16(hhea.offset + 34, false);
  const advances: number[] = [];
  for (let index = 0; index < metricCount; index += 1) advances.push(view.getUint16(hmtx.offset + index * 4, false));
  const fallbackGlyph = cmapGlyph(view, cmap, 63);
  const widths: number[] = [];
  for (let code = 32; code <= 255; code += 1) {
    const unicode = CP1252_UNICODE[code] ?? code;
    const glyph = cmapGlyph(view, cmap, unicode) || fallbackGlyph;
    widths.push(scaledMetric(advances[Math.min(glyph, advances.length - 1)] ?? unitsPerEm / 2, unitsPerEm));
  }
  const post = tables.post;
  const os2 = tables["OS/2"];
  const italicAngle = post && post.length >= 8 ? view.getInt32(post.offset + 4, false) / 65_536 : 0;
  const ascent = scaledMetric(view.getInt16(hhea.offset + 4, false), unitsPerEm);
  const descent = scaledMetric(view.getInt16(hhea.offset + 6, false), unitsPerEm);
  const capHeight = os2 && os2.length >= 90
    ? scaledMetric(view.getInt16(os2.offset + 88, false), unitsPerEm)
    : Math.round(ascent * 0.72);
  return {
    resource,
    baseName,
    data,
    widths,
    bbox: [
      scaledMetric(view.getInt16(head.offset + 36, false), unitsPerEm),
      scaledMetric(view.getInt16(head.offset + 38, false), unitsPerEm),
      scaledMetric(view.getInt16(head.offset + 40, false), unitsPerEm),
      scaledMetric(view.getInt16(head.offset + 42, false), unitsPerEm),
    ],
    ascent,
    descent,
    capHeight,
    italicAngle,
    flags: 32 | 2 | (options.script ? 8 : 0) | (options.italic ? 64 : 0) | (options.bold ? 262_144 : 0),
    stemV: options.bold ? 120 : 80,
  };
};

const PDF_FONTS: Record<FontKey, PdfFontDefinition> = {
  gentium: createFontDefinition("F1", "GentiumBasic", gentiumRegularDataUrl),
  gentiumBold: createFontDefinition("F2", "GentiumBasic-Bold", gentiumBoldDataUrl, { bold: true }),
  gentiumItalic: createFontDefinition("F3", "GentiumBasic-Italic", gentiumItalicDataUrl, { italic: true }),
  andalus: createFontDefinition("F4", "Andalus", andalusDataUrl, { script: true }),
};

const approximateWidth = (text: string, size: number, font: FontKey): number => {
  const encoded = winAnsi(normalizeText(text));
  return Array.from(encoded).reduce((total, character) => {
    const code = character.charCodeAt(0);
    return total + (PDF_FONTS[font].widths[code - 32] ?? 500);
  }, 0) * size / 1_000;
};

const truncateText = (text: string, width: number, size: number, font: FontKey): string => {
  const normalized = normalizeText(text);
  if (approximateWidth(normalized, size, font) <= width) return normalized;
  let shortened = normalized;
  while (shortened.length > 1 && approximateWidth(`${shortened}…`, size, font) > width) shortened = shortened.slice(0, -1);
  return `${shortened.trimEnd()}…`;
};

const wrapText = (text: string, width: number, size: number, font: FontKey): string[] => {
  const paragraphs = normalizeText(text).split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || approximateWidth(candidate, size, font) <= width) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
};

class PdfCanvas {
  readonly commands: string[] = [];
  readonly subtitle: string;

  constructor(subtitle: string) {
    this.subtitle = subtitle;
  }

  fillRect(x: number, top: number, width: number, height: number, fill: RGB): void {
    this.commands.push(`${color(fill)} rg ${fmt(x)} ${fmt(PAGE_HEIGHT - top - height)} ${fmt(width)} ${fmt(height)} re f`);
  }

  strokeRect(x: number, top: number, width: number, height: number, stroke: RGB = COLORS.line, lineWidth = 0.6): void {
    this.commands.push(`${color(stroke)} RG ${fmt(lineWidth)} w ${fmt(x)} ${fmt(PAGE_HEIGHT - top - height)} ${fmt(width)} ${fmt(height)} re S`);
  }

  line(x1: number, top1: number, x2: number, top2: number, stroke: RGB = COLORS.line, lineWidth = 0.5): void {
    this.commands.push(`${color(stroke)} RG ${fmt(lineWidth)} w ${fmt(x1)} ${fmt(PAGE_HEIGHT - top1)} m ${fmt(x2)} ${fmt(PAGE_HEIGHT - top2)} l S`);
  }

  circle(cx: number, topCenter: number, radius: number, stroke: RGB, fill?: RGB, lineWidth = 0.8): void {
    const cy = PAGE_HEIGHT - topCenter;
    const k = radius * 0.5522847498;
    const path = `${fmt(cx + radius)} ${fmt(cy)} m ${fmt(cx + radius)} ${fmt(cy + k)} ${fmt(cx + k)} ${fmt(cy + radius)} ${fmt(cx)} ${fmt(cy + radius)} c ${fmt(cx - k)} ${fmt(cy + radius)} ${fmt(cx - radius)} ${fmt(cy + k)} ${fmt(cx - radius)} ${fmt(cy)} c ${fmt(cx - radius)} ${fmt(cy - k)} ${fmt(cx - k)} ${fmt(cy - radius)} ${fmt(cx)} ${fmt(cy - radius)} c ${fmt(cx + k)} ${fmt(cy - radius)} ${fmt(cx + radius)} ${fmt(cy - k)} ${fmt(cx + radius)} ${fmt(cy)} c`;
    this.commands.push(`${fill ? `${color(fill)} rg ` : ""}${color(stroke)} RG ${fmt(lineWidth)} w ${path} ${fill ? "B" : "S"}`);
  }

  text(value: unknown, x: number, top: number, options: {
    font?: FontKey;
    size?: number;
    fill?: RGB;
    align?: Align;
    width?: number;
  } = {}): void {
    const font = options.font ?? "gentium";
    const size = options.size ?? 8;
    const fill = options.fill ?? COLORS.ink;
    const width = options.width ?? 0;
    const text = width > 0 ? truncateText(normalizeText(value), width, size, font) : normalizeText(value);
    const textWidth = approximateWidth(text, size, font);
    const tx = options.align === "center" ? x + (width - textWidth) / 2 : options.align === "right" ? x + width - textWidth : x;
    const fontResource = PDF_FONTS[font].resource;
    this.commands.push(`BT /${fontResource} ${fmt(size)} Tf ${color(fill)} rg 1 0 0 1 ${fmt(tx)} ${fmt(PAGE_HEIGHT - top - size)} Tm ${pdfLiteral(text)} Tj ET`);
  }

  wrappedText(value: unknown, x: number, top: number, width: number, options: {
    font?: FontKey;
    size?: number;
    fill?: RGB;
    lineHeight?: number;
    maxLines?: number;
  } = {}): number {
    const font = options.font ?? "gentium";
    const size = options.size ?? 8;
    const lineHeight = options.lineHeight ?? size * 1.3;
    const allLines = wrapText(normalizeText(value), width, size, font);
    const maxLines = Math.max(1, options.maxLines ?? allLines.length);
    const visible = allLines.slice(0, maxLines);
    if (allLines.length > maxLines && visible.length) visible[visible.length - 1] = truncateText(`${visible[visible.length - 1]}…`, width, size, font);
    visible.forEach((line, index) => this.text(line, x, top + index * lineHeight, { font, size, fill: options.fill, width }));
    return visible.length * lineHeight;
  }
}

class PdfDocument {
  readonly pages: PdfCanvas[] = [];

  addPage(subtitle: string): PdfCanvas {
    const page = new PdfCanvas(subtitle);
    this.pages.push(page);
    return page;
  }

  build(title: string): Uint8Array {
    const objects: string[] = [];
    const addObject = (value: string): number => {
      objects.push(value);
      return objects.length;
    };
    const catalogId = addObject("");
    const pagesId = addObject("");
    const fontObjectIds: Record<PdfFontDefinition["resource"], number> = { F1: 0, F2: 0, F3: 0, F4: 0 };
    Object.values(PDF_FONTS).forEach((font) => {
      const fontFileId = addObject(`<< /Length ${font.data.length} /Length1 ${font.data.length} >>\nstream\n${byteString(font.data)}\nendstream`);
      const descriptorId = addObject(`<< /Type /FontDescriptor /FontName /${font.baseName} /Flags ${font.flags} /FontBBox [${font.bbox.join(" ")}] /ItalicAngle ${fmt(font.italicAngle)} /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV ${font.stemV} /MissingWidth 500 /FontFile2 ${fontFileId} 0 R >>`);
      fontObjectIds[font.resource] = addObject(`<< /Type /Font /Subtype /TrueType /Name /${font.resource} /BaseFont /${font.baseName} /FirstChar 32 /LastChar 255 /Widths [${font.widths.join(" ")}] /FontDescriptor ${descriptorId} 0 R /Encoding /WinAnsiEncoding >>`);
    });
    const fontResources = Object.values(PDF_FONTS)
      .map((font) => `/${font.resource} ${fontObjectIds[font.resource]} 0 R`)
      .join(" ");
    const pageIds: number[] = [];
    this.pages.forEach((page) => {
      const stream = page.commands.join("\n");
      const contentId = addObject(`<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream`);
      pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /Resources << /ProcSet [/PDF /Text] /Font << ${fontResources} >> >> /MediaBox [0 0 ${fmt(PAGE_WIDTH)} ${fmt(PAGE_HEIGHT)}] /Contents ${contentId} 0 R >>`));
    });
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} /MediaBox [0 0 ${fmt(PAGE_WIDTH)} ${fmt(PAGE_HEIGHT)}] >>`;
    const infoId = addObject(`<< /Title ${pdfLiteral(title)} /Author ${pdfLiteral("Aventurischer Heldenbogen")} /Creator ${pdfLiteral("Regelwerksgenerator 0.22.0")} >>`);

    let output = `%PDF-1.4\n%${String.fromCharCode(226, 227, 207, 211)}\n`;
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(bytes(output).length);
      output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = bytes(output).length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return bytes(output);
  }
}

const drawCorner = (page: PdfCanvas, x: number, top: number, flipX: number, flipY: number): void => {
  page.line(x, top, x + 18 * flipX, top, COLORS.gold, 1.1);
  page.line(x, top, x, top + 18 * flipY, COLORS.gold, 1.1);
  page.line(x + 4 * flipX, top + 4 * flipY, x + 13 * flipX, top + 4 * flipY, COLORS.forest, 0.8);
  page.line(x + 4 * flipX, top + 4 * flipY, x + 4 * flipX, top + 13 * flipY, COLORS.forest, 0.8);
  page.circle(x + 4 * flipX, top + 4 * flipY, 1.8, COLORS.gold, COLORS.paper, 0.6);
};

const drawPageChrome = (page: PdfCanvas, name: string, subtitle: string): void => {
  page.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.paper);
  page.strokeRect(25, 24, PAGE_WIDTH - 50, PAGE_HEIGHT - 48, COLORS.forest, 1.25);
  page.strokeRect(29, 28, PAGE_WIDTH - 58, PAGE_HEIGHT - 56, COLORS.gold, 0.55);
  drawCorner(page, 36, 35, 1, 1);
  drawCorner(page, PAGE_WIDTH - 36, 35, -1, 1);
  drawCorner(page, 36, PAGE_HEIGHT - 35, 1, -1);
  drawCorner(page, PAGE_WIDTH - 36, PAGE_HEIGHT - 35, -1, -1);
  page.text("AVENTURISCHER HELDENBOGEN", PAGE_LEFT, 34, { font: "andalus", size: 17.5, fill: COLORS.forest, width: CONTENT_WIDTH, align: "center" });
  page.text(subtitle.toLocaleUpperCase("de"), PAGE_LEFT, 55, { font: "andalus", size: 9, fill: COLORS.gold, width: CONTENT_WIDTH, align: "center" });
  page.line(PAGE_LEFT, 69, PAGE_RIGHT, 69, COLORS.gold, 1.1);
  page.line(PAGE_LEFT + 70, 72, PAGE_RIGHT - 70, 72, COLORS.forest, 0.4);
  page.text(name, 60, 804, { font: "gentiumItalic", size: 5.5, fill: COLORS.muted, width: 140 });
}

const sectionTitle = (page: PdfCanvas, x: number, top: number, width: number, title: string): number => {
  page.fillRect(x, top, width, 17, COLORS.forest);
  page.fillRect(x, top, 4, 17, COLORS.gold);
  page.text(title, x + 10, top + 3, { font: "gentiumBold", size: 8.2, fill: COLORS.white, width: width - 15 });
  return top + 17;
};

const field = (page: PdfCanvas, x: number, top: number, width: number, label: string, value: unknown, height = 31): void => {
  page.fillRect(x, top, width, height, COLORS.paperDeep);
  page.strokeRect(x, top, width, height, COLORS.line, 0.45);
  page.text(label.toLocaleUpperCase("de"), x + 6, top + 4, { font: "gentiumBold", size: 5.2, fill: COLORS.muted, width: width - 12 });
  page.text(value || "-", x + 6, top + 14, { font: "gentiumBold", size: 9, fill: COLORS.ink, width: width - 12 });
};

const drawAttributes = (page: PdfCanvas, data: PrintableCharacterData, top: number, compact = false): number => {
  const gap = 4;
  const cardWidth = (CONTENT_WIDTH - gap * 7) / 8;
  const height = compact ? 34 : 54;
  data.attributes.forEach((attribute, index) => {
    const x = PAGE_LEFT + index * (cardWidth + gap);
    page.fillRect(x, top, cardWidth, height, index % 2 ? COLORS.paperDeep : COLORS.paper);
    page.strokeRect(x, top, cardWidth, height, COLORS.line, 0.5);
    const radius = compact ? 10 : 11.5;
    page.circle(x + cardWidth / 2, top + radius + 4, radius, ATTRIBUTE_COLORS[attribute.code] ?? COLORS.forest, COLORS.paper, 1.15);
    page.text(attribute.code, x, top + (compact ? 7 : 8), { font: "gentiumBold", size: compact ? 7.2 : 8, fill: ATTRIBUTE_COLORS[attribute.code] ?? COLORS.forest, width: cardWidth, align: "center" });
    page.text(attribute.value, x, top + (compact ? 21 : 25), { font: "gentiumBold", size: compact ? 8 : 11, fill: COLORS.ink, width: cardWidth, align: "center" });
    if (!compact) page.text(attribute.name, x + 2, top + 42, { font: "gentium", size: 4.7, fill: COLORS.muted, width: cardWidth - 4, align: "center" });
  });
  return top + height;
};

const drawStats = (page: PdfCanvas, data: PrintableCharacterData, top: number): number => {
  const stats: Array<[string, string]> = [
    ["LeP", `${data.resources.life.current} / ${data.resources.life.max}`],
    ...(data.magic.gifted ? [["AsP", `${data.resources.astral.current} / ${data.resources.astral.max}`] as [string, string]] : []),
    ...(data.resources.karma.max > 0 ? [["KaP", `${data.resources.karma.current} / ${data.resources.karma.max}`] as [string, string]] : []),
    ["Schip", `${data.resources.fate.current} / ${data.resources.fate.max}`],
    ["GS", String(data.derived.speed)],
    ["INI", String(data.derived.initiative)],
    ["AW", String(data.derived.dodge)],
    ["SK", String(data.derived.soulpower)],
    ["ZK", String(data.derived.toughness)],
  ];
  const width = CONTENT_WIDTH / stats.length;
  stats.forEach(([label, value], index) => {
    const x = PAGE_LEFT + index * width;
    page.fillRect(x, top, width, 36, index % 2 ? COLORS.paperDeep : COLORS.goldLight);
    page.strokeRect(x, top, width, 36, COLORS.line, 0.45);
    page.text(label, x, top + 4, { font: "gentiumBold", size: 5.2, fill: COLORS.muted, width, align: "center" });
    page.text(value, x, top + 15, { font: "gentiumBold", size: 9.5, fill: COLORS.forest, width, align: "center" });
  });
  return top + 36;
};

const drawListBox = (page: PdfCanvas, x: number, top: number, width: number, height: number, title: string, items: string[], columns = 1): void => {
  sectionTitle(page, x, top, width, title);
  page.strokeRect(x, top + 17, width, height - 17, COLORS.line, 0.55);
  const padding = 8;
  const columnGap = 8;
  const columnWidth = (width - padding * 2 - columnGap * (columns - 1)) / columns;
  const lineHeight = 10.2;
  const maxLines = Math.max(1, Math.floor((height - 27) / lineHeight));
  const maxItems = maxLines * columns;
  const visible = items.slice(0, maxItems);
  visible.forEach((item, index) => {
    const columnIndex = Math.floor(index / maxLines);
    const rowIndex = index % maxLines;
    const tx = x + padding + columnIndex * (columnWidth + columnGap);
    const ty = top + 23 + rowIndex * lineHeight;
    page.circle(tx + 2, ty + 3.5, 1.2, COLORS.gold, COLORS.gold, 0.4);
    page.text(item, tx + 7, ty, { font: "gentium", size: 6.7, fill: COLORS.ink, width: columnWidth - 7 });
  });
  if (items.length > maxItems) {
    page.text(`+ ${items.length - maxItems} weitere`, x + width - columnWidth, top + height - 12, { font: "gentiumBold", size: 6, fill: COLORS.gold, width: columnWidth - padding, align: "right" });
  }
};

const drawTable = (
  page: PdfCanvas,
  x: number,
  top: number,
  widths: number[],
  headers: string[],
  rows: Array<Array<string | number>>,
  options: { rowHeight?: number; headerHeight?: number; fontSize?: number; alignments?: Align[]; blankRows?: number } = {},
): number => {
  const rowHeight = options.rowHeight ?? 15;
  const headerHeight = options.headerHeight ?? 18;
  const fontSize = options.fontSize ?? 6.8;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  page.fillRect(x, top, totalWidth, headerHeight, COLORS.forest);
  let cursorX = x;
  headers.forEach((header, index) => {
    page.text(header, cursorX + 3, top + 5, { font: "gentiumBold", size: 5.8, fill: COLORS.white, width: widths[index] - 6, align: options.alignments?.[index] ?? "left" });
    cursorX += widths[index];
  });
  const bodyRows = [...rows, ...Array.from({ length: Math.max(0, options.blankRows ?? 0) }, () => headers.map(() => ""))];
  bodyRows.forEach((row, rowIndex) => {
    const rowTop = top + headerHeight + rowIndex * rowHeight;
    page.fillRect(x, rowTop, totalWidth, rowHeight, rowIndex % 2 ? COLORS.paperDeep : COLORS.paper);
    page.line(x, rowTop + rowHeight, x + totalWidth, rowTop + rowHeight, COLORS.line, 0.3);
    let cellX = x;
    row.forEach((value, index) => {
      page.text(value, cellX + 3, rowTop + 4, { font: index === 0 ? "gentiumBold" : "gentium", size: fontSize, fill: COLORS.ink, width: widths[index] - 6, align: options.alignments?.[index] ?? "left" });
      cellX += widths[index];
    });
  });
  let verticalX = x;
  page.strokeRect(x, top, totalWidth, headerHeight + bodyRows.length * rowHeight, COLORS.line, 0.5);
  for (let index = 0; index < widths.length - 1; index += 1) {
    verticalX += widths[index];
    page.line(verticalX, top, verticalX, top + headerHeight + bodyRows.length * rowHeight, COLORS.line, 0.3);
  }
  return top + headerHeight + bodyRows.length * rowHeight;
};

const drawPersonalPage = (document: PdfDocument, data: PrintableCharacterData): void => {
  const page = document.addPage("Persönliche Daten");
  drawPageChrome(page, data.identity.name, "Persönliche Daten");
  page.text(data.identity.name || "Unbenannter Held", PAGE_LEFT, 78, { font: "andalus", size: 24, fill: COLORS.forest, width: CONTENT_WIDTH });
  page.line(PAGE_LEFT, 108, PAGE_RIGHT, 108, COLORS.gold, 0.65);
  const fieldWidth = CONTENT_WIDTH / 4;
  [
    ["Spezies", data.identity.species],
    ["Kultur", data.identity.culture],
    ["Profession", data.identity.profession],
    ["Erfahrung", data.identity.experience],
  ].forEach(([label, value], index) => field(page, PAGE_LEFT + index * fieldWidth, 116, fieldWidth, label, value));
  field(page, PAGE_LEFT, 149, fieldWidth, "Geschlecht", data.identity.sex, 29);
  field(page, PAGE_LEFT + fieldWidth, 149, fieldWidth * 3, "Konzept", data.identity.concept || "-", 29);
  sectionTitle(page, PAGE_LEFT, 186, CONTENT_WIDTH, "Eigenschaften");
  drawAttributes(page, data, 206);
  sectionTitle(page, PAGE_LEFT, 268, CONTENT_WIDTH, "Grund- und Spielwerte");
  drawStats(page, data, 288);
  const apTop = 329;
  const apWidth = CONTENT_WIDTH / 3;
  [["AP gesamt", data.adventurePoints.total], ["AP ausgegeben", data.adventurePoints.spent], ["AP übrig", data.adventurePoints.remaining]].forEach(([label, value], index) => {
    field(page, PAGE_LEFT + index * apWidth, apTop, apWidth, String(label), value, 30);
  });
  const traitsTop = 369;
  const halfWidth = (CONTENT_WIDTH - 10) / 2;
  drawListBox(page, PAGE_LEFT, traitsTop, halfWidth, 135, "Vorteile", data.biography.advantages.map(formatPrintableTrait));
  drawListBox(page, PAGE_LEFT + halfWidth + 10, traitsTop, halfWidth, 135, "Nachteile", data.biography.disadvantages.map(formatPrintableTrait));
  drawListBox(page, PAGE_LEFT, traitsTop + 145, CONTENT_WIDTH, 205, "Allgemeine Sonderfertigkeiten", data.biography.specialAbilities.map(formatPrintableTrait), 2);
  if (data.notes.trim()) {
    sectionTitle(page, PAGE_LEFT, 729, CONTENT_WIDTH, "Notizen");
    page.strokeRect(PAGE_LEFT, 746, CONTENT_WIDTH, 50, COLORS.line, 0.5);
    page.wrappedText(data.notes, PAGE_LEFT + 7, 752, CONTENT_WIDTH - 14, { font: "gentiumItalic", size: 6.3, lineHeight: 8.5, maxLines: 5 });
  }
};

const drawTalentColumn = (page: PdfCanvas, talents: PrintableTalent[], categories: string[], x: number, top: number, width: number): void => {
  let cursor = top;
  for (const category of categories) {
    const rows = talents.filter((talent) => talent.category === category);
    page.fillRect(x, cursor, width, 14, COLORS.goldLight);
    page.strokeRect(x, cursor, width, 14, COLORS.line, 0.4);
    page.text(category, x + 5, cursor + 3, { font: "gentiumBold", size: 7.4, fill: COLORS.forest, width: width - 10 });
    cursor += 14;
    cursor = drawTable(page, x, cursor, [width - 118, 63, 30, 25], ["Talent", "Probe", "FW", "SF"], rows.map((talent) => [
      talent.name,
      talent.check.join("/"),
      talent.value,
      talent.improvementCost,
    ]), { rowHeight: 14, headerHeight: 16, fontSize: 6.2, alignments: ["left", "center", "center", "center"] });
  }
};

const drawTalentsPage = (document: PdfDocument, data: PrintableCharacterData): void => {
  const page = document.addPage("Talente");
  drawPageChrome(page, data.identity.name, "Talente");
  drawAttributes(page, data, 80, true);
  sectionTitle(page, PAGE_LEFT, 122, CONTENT_WIDTH, "Talente und Fertigkeitswerte");
  const gap = 10;
  const columnWidth = (CONTENT_WIDTH - gap) / 2;
  drawTalentColumn(page, data.talents, ["Körper", "Gesellschaft", "Natur"], PAGE_LEFT, 145, columnWidth);
  drawTalentColumn(page, data.talents, ["Wissen", "Handwerk"], PAGE_LEFT + columnWidth + gap, 145, columnWidth);
  page.fillRect(PAGE_LEFT, 763, CONTENT_WIDTH, 30, COLORS.forestLight);
  page.text("Qualitätsstufen", PAGE_LEFT + 8, 770, { font: "gentiumBold", size: 6.5, fill: COLORS.forest, width: 90 });
  page.text("FW 0-3: QS 1   ·   FW 4-6: QS 2   ·   FW 7-9: QS 3   ·   FW 10-12: QS 4   ·   FW 13-15: QS 5   ·   FW 16+: QS 6", PAGE_LEFT + 95, 770, { font: "gentium", size: 6.2, fill: COLORS.ink, width: CONTENT_WIDTH - 103 });
}

const combatRows = (entries: PrintableCombatTechnique[]): Array<Array<string | number>> => entries.map((entry) => [
  entry.name,
  entry.primaryAttributes.join("/"),
  entry.improvementCost,
  entry.value,
]);

const itemType = (item: PrintableEquipmentEntry): string => ({
  melee: "Nahkampf",
  ranged: "Fernkampf",
  shield: "Schild",
  armor: "Rüstung",
  helmet: "Helm",
  equipment: "Ausrüstung",
})[item.kind];

const drawCombatPage = (document: PdfDocument, data: PrintableCharacterData): void => {
  const page = document.addPage("Kampfwerte");
  drawPageChrome(page, data.identity.name, "Kampfwerte");
  drawStats(page, data, 80);
  sectionTitle(page, PAGE_LEFT, 124, CONTENT_WIDTH, "Kampftechniken");
  const half = (CONTENT_WIDTH - 10) / 2;
  const midpoint = Math.ceil(data.combatTechniques.length / 2);
  drawTable(page, PAGE_LEFT, 145, [half - 105, 48, 25, 32], ["Technik", "Leit", "SF", "KTW"], combatRows(data.combatTechniques.slice(0, midpoint)), { rowHeight: 13, headerHeight: 16, fontSize: 6.2, alignments: ["left", "center", "center", "center"] });
  drawTable(page, PAGE_LEFT + half + 10, 145, [half - 105, 48, 25, 32], ["Technik", "Leit", "SF", "KTW"], combatRows(data.combatTechniques.slice(midpoint)), { rowHeight: 13, headerHeight: 16, fontSize: 6.2, alignments: ["left", "center", "center", "center"] });
  let top = 322;
  sectionTitle(page, PAGE_LEFT, top, CONTENT_WIDTH, "Nahkampfwaffen");
  const melee = data.equipment.melee.slice(0, 6).map((item) => [item.name, COMBAT_TECHNIQUES[item.combatTechnique ?? ""] ?? "-", item.damage ?? "-", `${item.at ?? 0}/${item.pa ?? 0}`, item.reach ?? "-", item.weight]);
  top = drawTable(page, PAGE_LEFT, top + 17, [172, 105, 60, 55, 55, 68], ["Waffe", "Technik", "TP", "AT/PA", "RW", "Gewicht"], melee, { rowHeight: 17, blankRows: Math.max(0, 4 - melee.length), alignments: ["left", "left", "center", "center", "center", "right"] });
  sectionTitle(page, PAGE_LEFT, top + 9, CONTENT_WIDTH, "Fernkampfwaffen");
  const ranged = data.equipment.ranged.slice(0, 5).map((item) => [item.name, COMBAT_TECHNIQUES[item.combatTechnique ?? ""] ?? "-", item.damage ?? "-", item.reloadTime ?? "-", item.ranges ?? "-", item.ammunition ?? "-", item.weight]);
  top = drawTable(page, PAGE_LEFT, top + 26, [145, 86, 52, 55, 73, 55, 49], ["Waffe", "Technik", "TP", "LZ", "RW", "Mun.", "Gew."], ranged, { rowHeight: 17, blankRows: Math.max(0, 3 - ranged.length), fontSize: 6.2, alignments: ["left", "left", "center", "center", "center", "center", "right"] });
  const armorTop = top + 9;
  sectionTitle(page, PAGE_LEFT, armorTop, 325, "Rüstung, Helme und Schilde");
  const defensive = [...data.equipment.armor, ...data.equipment.helmet, ...data.equipment.shield].slice(0, 6).map((item) => [item.name, itemType(item), item.protection ?? "-", item.encumbrance ?? "-", item.weight]);
  drawTable(page, PAGE_LEFT, armorTop + 17, [125, 76, 38, 38, 48], ["Gegenstand", "Art", "RS", "BE", "Gew."], defensive, { rowHeight: 17, blankRows: Math.max(0, 5 - defensive.length), fontSize: 6.2, alignments: ["left", "left", "center", "center", "right"] });
  sectionTitle(page, PAGE_LEFT + 335, armorTop, CONTENT_WIDTH - 335, "Zustände");
  const conditionRows = [...data.conditions.entries, { id: "encumbrance", name: "Belastung", level: data.carrying.encumbrance }].map((entry) => [entry.name, entry.level || "-"]);
  drawTable(page, PAGE_LEFT + 335, armorTop + 17, [CONTENT_WIDTH - 380, 45], ["Zustand", "Stufe"], conditionRows, { rowHeight: 15, headerHeight: 17, fontSize: 6.3, alignments: ["left", "center"] });
};

const inventoryEntries = (data: PrintableCharacterData): PrintableEquipmentEntry[] => [
  ...data.equipment.equipment,
  ...data.equipment.melee,
  ...data.equipment.ranged,
  ...data.equipment.shield,
  ...data.equipment.armor,
  ...data.equipment.helmet,
].filter((item) => data.equipmentZones.backpackItemIds.includes(item.id))
  .sort((a, b) => a.name.localeCompare(b.name, "de"));

const drawEquipmentPlacement = (page: PdfCanvas, data: PrintableCharacterData): number => {
  sectionTitle(page, PAGE_LEFT, 80, CONTENT_WIDTH, "Getragene Ausrüstung und Rucksack");
  const bodyWidth = 330;
  const bagX = PAGE_LEFT + bodyWidth + 10;
  const bagWidth = CONTENT_WIDTH - bodyWidth - 10;
  const cellWidth = bodyWidth / 2;
  const cellHeight = 43;
  data.equipmentZones.entries.forEach((entry, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_LEFT + column * cellWidth;
    const top = 98 + row * cellHeight;
    page.fillRect(x, top, cellWidth, cellHeight, index % 2 ? COLORS.paper : COLORS.paperDeep);
    page.strokeRect(x, top, cellWidth, cellHeight, COLORS.line, .45);
    page.text(entry.slot.label, x + 7, top + 6, { font: "gentiumBold", size: 7.1, fill: COLORS.forest, width: 65 });
    page.text(entry.item?.name ?? "nicht belegt", x + 7, top + 20, { font: "gentium", size: 6.2, fill: entry.item ? COLORS.ink : COLORS.muted, width: cellWidth - 52 });
    page.text(entry.slot.id === "footwear" ? "ohne RS" : `${entry.slot.protectionLabel} ${entry.protection}`, x + cellWidth - 48, top + 15, { font: "gentiumBold", size: 6.1, fill: entry.slot.id === "footwear" ? COLORS.muted : COLORS.gold, align: "right", width: 41 });
  });
  page.fillRect(bagX, 98, bagWidth, cellHeight * 3, COLORS.forest);
  page.strokeRect(bagX, 98, bagWidth, cellHeight * 3, COLORS.gold, .8);
  page.text("Rucksack", bagX + 8, 105, { font: "andalus", size: 12, fill: COLORS.goldLight, width: bagWidth - 16 });
  const backpack = inventoryEntries(data);
  page.text(`${backpack.reduce((sum, item) => sum + item.amount, 0)} Gegenstände`, bagX + 8, 121, { font: "gentiumItalic", size: 5.7, fill: COLORS.white, width: bagWidth - 16 });
  backpack.slice(0, 8).forEach((item, index) => {
    page.text(`${item.amount > 1 ? `${item.amount}x ` : ""}${item.name}`, bagX + 8, 137 + index * 10.5, { font: "gentium", size: 5.5, fill: COLORS.white, width: bagWidth - 55 });
    page.text(`${(item.weight * item.amount).toLocaleString("de-DE", { maximumFractionDigits: 2 })} St`, bagX + bagWidth - 45, 137 + index * 10.5, { font: "gentium", size: 5.2, fill: COLORS.goldLight, align: "right", width: 37 });
  });
  if (backpack.length > 8) page.text(`+ ${backpack.length - 8} weitere Positionen`, bagX + 8, 223, { font: "gentiumItalic", size: 5.2, fill: COLORS.goldLight, width: bagWidth - 16 });

  const summaryTop = 234;
  const summaryWidths = [88, 70, 76, 153, 128];
  const summaryValues = [
    ["Belastungswert", String(data.equipmentZones.protectionScore)],
    ["Rüstungs-BE", String(data.equipmentZones.encumbrance)],
    ["GS / INI", data.equipmentZones.movementPenalty ? `-${data.equipmentZones.movementPenalty} / -${data.equipmentZones.initiativePenalty}` : "- / -"],
    ["Traglast", `${data.carrying.countedWeight.toLocaleString("de-DE", { maximumFractionDigits: 2 })} / ${data.carrying.capacity.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Stein`],
    ["Geld", `${data.purse.d} D · ${data.purse.s} S · ${data.purse.h} H · ${data.purse.k} K`],
  ];
  let summaryX = PAGE_LEFT;
  summaryValues.forEach(([label, value], index) => {
    const width = summaryWidths[index];
    page.fillRect(summaryX, summaryTop, width, 39, index < 3 ? COLORS.forestLight : COLORS.goldLight);
    page.strokeRect(summaryX, summaryTop, width, 39, COLORS.line, .4);
    page.text(label, summaryX + 6, summaryTop + 6, { font: "gentiumBold", size: 5.2, fill: COLORS.muted, width: width - 12 });
    page.text(value, summaryX + 6, summaryTop + 18, { font: "gentiumBold", size: index < 3 ? 9 : 7.2, fill: COLORS.forest, width: width - 12 });
    summaryX += width;
  });
  page.text("Kein addierter Gesamt-RS: Bei Treffern gilt der RS der getroffenen Zone. Der Beinwert gilt für jedes Bein; Schuhwerk zählt nicht zum RS.", PAGE_LEFT, 278, { font: "gentiumItalic", size: 5.4, fill: COLORS.muted, width: CONTENT_WIDTH });
  return 292;
};

const drawInventoryPages = (document: PdfDocument, data: PrintableCharacterData): void => {
  const entries = inventoryEntries(data);
  const chunks: PrintableEquipmentEntry[][] = [];
  chunks.push(entries.slice(0, 25));
  for (let index = 25; index < entries.length; index += 32) chunks.push(entries.slice(index, index + 32));
  chunks.forEach((chunk, chunkIndex) => {
    const page = document.addPage(chunks.length > 1 ? `Ausrüstung ${chunkIndex + 1}/${chunks.length}` : "Ausrüstung");
    drawPageChrome(page, data.identity.name, chunks.length > 1 ? `Ausrüstung ${chunkIndex + 1}/${chunks.length}` : "Ausrüstung");
    const tableTop = chunkIndex === 0 ? drawEquipmentPlacement(page, data) : 82;
    sectionTitle(page, PAGE_LEFT, tableTop, CONTENT_WIDTH, chunkIndex === 0 ? "Rucksack und weiteres Inventar" : "Weiteres Inventar");
    const rows = chunk.map((item) => [
      item.name,
      itemType(item),
      item.amount,
      item.weight.toLocaleString("de-DE", { maximumFractionDigits: 2 }),
      item.equipped ? "ja" : "nein",
      (item.price * item.amount).toLocaleString("de-DE", { maximumFractionDigits: 2 }),
    ]);
    const blankTarget = chunkIndex === 0 ? 25 : 32;
    const blankRows = chunkIndex === chunks.length - 1 ? Math.max(0, blankTarget - rows.length) : 0;
    drawTable(page, PAGE_LEFT, tableTop + 17, [217, 82, 42, 61, 50, 63], ["Gegenstand", "Art", "Anz.", "Gewicht", "getragen", "Wert S"], rows, { rowHeight: 18, headerHeight: 19, fontSize: 6.5, blankRows, alignments: ["left", "left", "center", "right", "center", "right"] });
  });
};

const filterAbilities = (data: PrintableCharacterData, pattern: RegExp): string[] => data.biography.specialAbilities
  .map(formatPrintableTrait)
  .filter((entry) => pattern.test(entry));

const drawMagicPage = (document: PdfDocument, data: PrintableCharacterData): void => {
  if (!data.magic.gifted && !data.magic.spells.length) return;
  const page = document.addPage("Zauber und Rituale");
  drawPageChrome(page, data.identity.name, "Zauber und Rituale");
  drawAttributes(page, data, 80, true);
  field(page, PAGE_LEFT, 122, 130, "Astralenergie", `${data.resources.astral.current} / ${data.resources.astral.max}`, 34);
  field(page, PAGE_LEFT + 135, 122, 190, "Tradition", data.magic.tradition || "-", 34);
  field(page, PAGE_LEFT + 330, 122, CONTENT_WIDTH - 330, "Magische Begabung", data.magic.gifted ? "aktiv" : "nicht aktiv", 34);
  sectionTitle(page, PAGE_LEFT, 166, CONTENT_WIDTH, "Zauber und Rituale");
  const rows = data.magic.spells.slice(0, 20).map((spell) => [spell.name, spell.kind, spell.check?.join("/") ?? "-", spell.value, spell.improvementCost ?? "-", ""]);
  const spellTableBottom = drawTable(page, PAGE_LEFT, 183, [175, 62, 78, 35, 35, 130], ["Zauber/Ritual", "Art", "Probe", "FW", "SF", "Notiz"], rows, { rowHeight: 17, headerHeight: 19, fontSize: 6.4, blankRows: Math.max(0, 20 - rows.length), alignments: ["left", "left", "center", "center", "center", "left"] });
  const bottomTop = Math.min(650, spellTableBottom + 12);
  const half = (CONTENT_WIDTH - 10) / 2;
  drawListBox(page, PAGE_LEFT, bottomTop, half, 145, "Magische Sonderfertigkeiten", filterAbilities(data, /Zauber|Magie|Hex|Astral|Ritual|Merkmal|Tradition|Stab|Bann/i));
  drawListBox(page, PAGE_LEFT + half + 10, bottomTop, half, 145, "Zaubertricks", data.magic.cantrips);
};

const drawKarmaPage = (document: PdfDocument, data: PrintableCharacterData): void => {
  if (data.resources.karma.max <= 0 && !data.karma.liturgies.length && !data.karma.blessings.length) return;
  const page = document.addPage("Liturgien und Zeremonien");
  drawPageChrome(page, data.identity.name, "Liturgien und Zeremonien");
  drawAttributes(page, data, 80, true);
  field(page, PAGE_LEFT, 122, 130, "Karmaenergie", `${data.resources.karma.current} / ${data.resources.karma.max}`, 34);
  field(page, PAGE_LEFT + 135, 122, 250, "Tradition", data.karma.tradition || "-", 34);
  field(page, PAGE_LEFT + 390, 122, CONTENT_WIDTH - 390, "Liturgien", data.karma.liturgies.length, 34);
  sectionTitle(page, PAGE_LEFT, 166, CONTENT_WIDTH, "Liturgien und Zeremonien");
  const rows = data.karma.liturgies.slice(0, 20).map((entry) => [entry.name, entry.value, "", "", ""]);
  const tableBottom = drawTable(page, PAGE_LEFT, 183, [200, 45, 85, 85, 100], ["Liturgie/Zeremonie", "FW", "Probe", "Aspekt", "Notiz"], rows, { rowHeight: 17, headerHeight: 19, fontSize: 6.5, blankRows: Math.max(0, 20 - rows.length), alignments: ["left", "center", "center", "left", "left"] });
  const bottomTop = Math.min(650, tableBottom + 12);
  const half = (CONTENT_WIDTH - 10) / 2;
  drawListBox(page, PAGE_LEFT, bottomTop, half, 145, "Klerikale Sonderfertigkeiten", filterAbilities(data, /Liturg|Predigt|Zeremon|Geweih|Karma|Tradition|Segen/i));
  drawListBox(page, PAGE_LEFT + half + 10, bottomTop, half, 145, "Segnungen", data.karma.blessings);
};

const addFooters = (document: PdfDocument): void => {
  const total = document.pages.length;
  document.pages.forEach((page, index) => {
    page.text("Regelwerksgenerator 0.22.0", 200, 804, { font: "gentiumItalic", size: 5.3, fill: COLORS.line, width: 195, align: "center" });
    page.text(`Seite ${index + 1} / ${total}`, 455, 804, { font: "gentiumItalic", size: 5.5, fill: COLORS.muted, width: 80, align: "right" });
  });
};

export const createPrintableCharacterPdf = (sheet: CharacterSheetState): Uint8Array => {
  const data = buildPrintableCharacterData(sheet);
  const document = new PdfDocument();
  drawPersonalPage(document, data);
  drawTalentsPage(document, data);
  drawCombatPage(document, data);
  drawInventoryPages(document, data);
  drawMagicPage(document, data);
  drawKarmaPage(document, data);
  addFooters(document);
  return document.build(`${data.identity.name || "Held"} - Aventurischer Heldenbogen`);
};

const safeFilename = (value: string): string => value
  .trim()
  .replace(/[\\/:*?"<>|]+/g, "-")
  .replace(/\s+/g, " ")
  .slice(0, 80) || "Held";

export const downloadPrintableCharacterPdf = (sheet: CharacterSheetState): void => {
  const pdf = createPrintableCharacterPdf(sheet);
  const blob = new Blob([pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(sheet.hero.name)}-Heldenbogen.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
