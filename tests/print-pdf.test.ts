import { describe, expect, it } from "vitest";
import { buildGeneratedCharacter, createGeneratorDraft, normalizeGeneratorDraft } from "../src/character-generator";
import { createPrintableCharacterPdf } from "../src/print-pdf";

const pdfText = (pdf: Uint8Array): string => new TextDecoder("windows-1252").decode(pdf);

describe("druckbarer Heldenbogen", () => {
  it("erzeugt für einen weltlichen Helden ein valides vierseitiges A4-PDF", () => {
    const draft = createGeneratorDraft();
    draft.name = "Alrik vom Blautann";
    draft.professionId = "barde";
    draft.purchases = [
      { catalogId: "meleeweapon:dolch", amount: 1 },
      { catalogId: "armor:kettenhemd", amount: 1 },
    ];
    normalizeGeneratorDraft(draft);

    const pdf = createPrintableCharacterPdf(buildGeneratedCharacter(draft));
    const text = pdfText(pdf);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(text).toContain("/Count 4");
    expect(text).toContain("Alrik vom Blautann");
    expect(text).toContain("Talente");
    expect(text).toContain("Kampf");
    expect(text).toContain("AUSRÜSTUNG");
    expect(text).toContain("/BaseFont /Andalus");
    expect(text).toContain("/BaseFont /GentiumBasic");
    expect(text).toContain("/BaseFont /GentiumBasic-Bold");
    expect(text).toContain("/BaseFont /GentiumBasic-Italic");
    expect(text).toContain("/FontFile2");
    expect(text).not.toContain("/BaseFont /Courier");
    expect(pdf.byteLength).toBeGreaterThan(25_000);
  });

  it("ergänzt bei einer magisch begabten Heldin automatisch die Zauberseite", () => {
    const draft = createGeneratorDraft();
    draft.name = "Mirhiban al'Orhima";
    draft.professionId = "katzenhexe";
    normalizeGeneratorDraft(draft);

    const text = pdfText(createPrintableCharacterPdf(buildGeneratedCharacter(draft)));

    expect(text).toContain("/Count 5");
    expect(text).toContain("Zauber und Rituale");
    expect(text).toContain("ASTRALENERGIE");
  });

  it("ergänzt bei einem Geweihten automatisch das Liturgieblatt", () => {
    const draft = createGeneratorDraft();
    draft.name = "Sszintiss";
    draft.raceId = "archaischerachaz";
    draft.cultureId = "stammesachaz";
    draft.professionId = "achazschamane";
    normalizeGeneratorDraft(draft);

    const text = pdfText(createPrintableCharacterPdf(buildGeneratedCharacter(draft)));

    expect(text).toContain("/Count 5");
    expect(text).toContain("Liturgien und Zeremonien");
    expect(text).toContain("KARMAENERGIE");
  });
});
