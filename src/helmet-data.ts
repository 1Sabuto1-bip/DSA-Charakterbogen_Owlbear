import type { ArmoryItemInfo } from "./armory-data";
import type { OptolithItem } from "./types";

interface HelmetDefinition {
  id: string;
  name: string;
  armorType: "Lederrüstung" | "Kettenrüstung" | "Plattenrüstung";
  page: string;
  url: string;
  shortDescription: string;
  advantageText?: string;
  disadvantageText?: string;
  ruleNote?: string;
  sourceId?: string;
  sourceLabel?: string;
  sourceShortLabel?: string;
  complexity?: string;
  explicitPriceAndWeight?: boolean;
}

const armorTypeValues = {
  Lederrüstung: { price: 15, weight: 0.6, zoneProtection: 3 },
  Kettenrüstung: { price: 25, weight: 1.2, zoneProtection: 4 },
  Plattenrüstung: { price: 75, weight: 2.5, zoneProtection: 6 },
} as const;

const definitions: readonly HelmetDefinition[] = [
  {
    id: "baburinerhut",
    name: "Baburiner Hut",
    armorType: "Plattenrüstung",
    page: "97",
    url: "https://dsa.ulisses-regelwiki.de/baburiner-hut.html",
    shortDescription: "Ein spitz zulaufender Helm für die Trefferzone Kopf.",
    advantageText: "Gegen Armbrüste, Bögen, Dolche und Schwerter schützt er am Kopf mit RS 5.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören sind um 1 erschwert.",
  },
  {
    id: "drachenhelm",
    name: "Drachenhelm",
    armorType: "Plattenrüstung",
    page: "98",
    url: "https://dsa.ulisses-regelwiki.de/drachenhelm.html",
    shortDescription: "Ein auffälliger Plattenhelm für die Trefferzone Kopf.",
    advantageText: "Gegen Dolche und Schwerter gilt am Kopf RS 7. Einmal pro Kampf darf ein Bestätigungswurf wiederholt und das bessere Ergebnis verwendet werden.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören oder Sehen sind um 2 erschwert.",
  },
  {
    id: "fluegelhelm",
    name: "Flügelhelm",
    armorType: "Plattenrüstung",
    page: "99",
    url: "https://dsa.ulisses-regelwiki.de/fluegelhelm.html",
    shortDescription: "Ein traditionsreicher Plattenhelm mit seitlichen Flügeln.",
    advantageText: "Einmal pro Kampf kann ein ausgegebener Schicksalspunkt auf einen Kampfgefährten übertragen werden.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören sind um 1 erschwert.",
  },
  {
    id: "gladiatorenhelm",
    name: "Gladiatorenhelm",
    armorType: "Lederrüstung",
    page: "100",
    url: "https://dsa.ulisses-regelwiki.de/gladiatorenhelm.html",
    shortDescription: "Ein Lederhelm für Kämpfe in der Arena.",
    advantageText: "Gegen Dolche, Fechtwaffen und Schwerter gilt am Kopf RS 4.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören oder Sehen sind um 1 erschwert.",
  },
  {
    id: "kettenhaube",
    name: "Kettenhaube",
    armorType: "Kettenrüstung",
    page: "101",
    url: "https://dsa.ulisses-regelwiki.de/kettenhaube.html",
    shortDescription: "Eine Kettenrüstung für die Trefferzone Kopf.",
    advantageText: "Gegen Armbrüste, Bögen, Dolche und Schwerter gilt am Kopf RS 5.",
    disadvantageText: "Sinnesschärfe-Proben, um den Träger zu bemerken, sind um 1 erleichtert.",
    ruleNote: "Mit Topfhelm, Tellerhelm oder Tobrischem Hut kombinierbar; die Kettenhaube erhöht deren Kopf-RS um 1.",
  },
  {
    id: "lederhelm",
    name: "Lederhelm",
    armorType: "Lederrüstung",
    page: "102",
    url: "https://dsa.ulisses-regelwiki.de/lederhelm.html",
    shortDescription: "Ein einfacher Lederhelm ohne besondere Vor- oder Nachteile.",
  },
  {
    id: "maskenhelm",
    name: "Maskenhelm",
    armorType: "Plattenrüstung",
    page: "103",
    url: "https://dsa.ulisses-regelwiki.de/maskenhelm.html",
    shortDescription: "Ein geschlossener Plattenhelm mit maskenartigem Gesichtsschutz.",
    advantageText: "Einschüchtern-Proben sind um 1 erleichtert.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören oder Sehen sind um 1 erschwert.",
    ruleNote: "Auf- oder Absetzen dauert jeweils 5 Aktionen.",
  },
  {
    id: "morion",
    name: "Morion",
    armorType: "Plattenrüstung",
    page: "104",
    url: "https://dsa.ulisses-regelwiki.de/morion.html",
    shortDescription: "Ein Plattenhelm ohne besondere Vor- oder Nachteile.",
  },
  {
    id: "schaller",
    name: "Schaller",
    armorType: "Plattenrüstung",
    page: "105",
    url: "https://dsa.ulisses-regelwiki.de/schaller.html",
    shortDescription: "Ein Plattenhelm mit nach hinten gezogenem Nackenschutz.",
    advantageText: "Gegen Armbrüste, Bögen, Dolche und Schwerter gilt am Kopf RS 7.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören sind um 1 erschwert.",
    ruleNote: "Mit einem Bart kombinierbar; dieser erhöht den Kopf-RS um 1.",
  },
  {
    id: "sturmhaube",
    name: "Sturmhaube",
    armorType: "Plattenrüstung",
    page: "106",
    url: "https://dsa.ulisses-regelwiki.de/sturmhaube.html",
    shortDescription: "Ein eng anliegender Plattenhelm für die Trefferzone Kopf.",
    advantageText: "Gegen Armbrüste, Bögen, Dolche und Schwerter gilt am Kopf RS 7.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören sind um 1 erschwert.",
  },
  {
    id: "tellerhelm",
    name: "Tellerhelm",
    armorType: "Plattenrüstung",
    page: "107",
    url: "https://dsa.ulisses-regelwiki.de/tellerhelm.html",
    shortDescription: "Ein breitkrempiger Plattenhelm für die Trefferzone Kopf.",
    advantageText: "Bei herabfallenden Trümmern erhält der gesamte Körper 1 zusätzlichen RS.",
    disadvantageText: "Nach einem Treffer bestimmt 1W6 den Kopf-RS: bei 1 gilt RS 0, bei 2 RS 1 und bei 3 RS 3; sonst gilt der normale Schutz.",
  },
  {
    id: "thorwalerhelm",
    name: "Thorwalerhelm",
    armorType: "Plattenrüstung",
    page: "13",
    url: "https://dsa.ulisses-regelwiki.de/Thorwalerhelm.html",
    shortDescription: "Ein schwerer, in Thorwal verbreiteter Plattenhelm.",
    advantageText: "Bestätigungswürfe bei Patzern sind um 1 erleichtert.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören oder Sehen sind um 1 erschwert. Bei gleichem INI-Wert handelt der Träger zuletzt.",
    ruleNote: "Verbreitung: Thorwal.",
    sourceId: "ruestkammerdergestadedesgottwals",
    sourceLabel: "Rüstkammer der Gestade des Gottwals",
    sourceShortLabel: "RGG",
    complexity: "einfach",
    explicitPriceAndWeight: true,
  },
  {
    id: "tobrischerhut",
    name: "Tobrischer Hut",
    armorType: "Plattenrüstung",
    page: "108",
    url: "https://dsa.ulisses-regelwiki.de/tobrischer-hut.html",
    shortDescription: "Ein breitkrempiger Plattenhelm aus Tobrien.",
    disadvantageText: "Nach einem Treffer bestimmt 1W6 den Kopf-RS: bei 1 gilt RS 0, bei 2 RS 1, bei 3–4 RS 3 und bei 5–6 der normale RS 6.",
  },
  {
    id: "topfhelm",
    name: "Topfhelm",
    armorType: "Plattenrüstung",
    page: "109",
    url: "https://dsa.ulisses-regelwiki.de/topfhelm.html",
    shortDescription: "Ein vollständig geschlossener Plattenhelm.",
    advantageText: "Gegen Schwerter und Zweihandschwerter gilt am Kopf RS 8.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören oder Sehen sind um 3 erschwert. Nach mehr als 7 KR Kampf entsteht für 30 Minuten 1 Stufe Betäubung.",
  },
  {
    id: "wolfshelm",
    name: "Wolfshelm",
    armorType: "Plattenrüstung",
    page: "110",
    url: "https://dsa.ulisses-regelwiki.de/wolfshelm.html",
    shortDescription: "Ein einschüchternd gestalteter Plattenhelm.",
    advantageText: "Willenskraft-Proben gegen Einschüchtern durch den Träger sind um 1 erschwert.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören oder Sehen sind um 2 erschwert. Nach mehr als 10 KR Kampf entsteht für 30 Minuten 1 Stufe Betäubung.",
  },
  {
    id: "zwergenhelm",
    name: "Zwergenhelm",
    armorType: "Plattenrüstung",
    page: "111",
    url: "https://dsa.ulisses-regelwiki.de/zwergenhelm.html",
    shortDescription: "Ein besonders massiver Plattenhelm zwergischer Machart.",
    advantageText: "Gegen Treffer großer oder riesiger Kreaturen gilt am Kopf RS 7.",
    disadvantageText: "Sinnesschärfe-Proben zum Hören sind um 2 erschwert.",
  },
] as const;

const buildNotes = (definition: HelmetDefinition): string => [
  definition.ruleNote,
  definition.advantageText ? `Vorteil: ${definition.advantageText}` : undefined,
  definition.disadvantageText ? `Nachteil: ${definition.disadvantageText}` : undefined,
].filter(Boolean).join(" ");

export const HELMET_ITEM_DATA: Record<string, Partial<OptolithItem> & { name: string; price: number }> = Object.fromEntries(
  definitions.map((definition) => {
    const values = armorTypeValues[definition.armorType];
    return [`helmet:${definition.id}`, {
      name: definition.name,
      gr: 4,
      itemKind: "helmet",
      price: values.price,
      weight: values.weight,
      armorZone: "Kopf",
      armorType: definition.armorType,
      zoneProtection: values.zoneProtection,
      notes: buildNotes(definition),
    } satisfies Partial<OptolithItem> & { name: string; price: number }];
  }),
);

export const HELMET_ITEM_INFO: Record<string, ArmoryItemInfo> = Object.fromEntries(
  definitions.map((definition) => {
    const values = armorTypeValues[definition.armorType];
    return [`helmet:${definition.id}`, {
      sourceId: definition.sourceId ?? "aventurischeruestkammer2",
      sourceLabel: definition.sourceLabel ?? "Aventurische Rüstkammer 2",
      sourceShortLabel: definition.sourceShortLabel ?? "AR2",
      pages: [definition.page],
      ...(definition.complexity ? { complexity: definition.complexity } : {}),
      hasSpecialAdvantage: Boolean(definition.advantageText),
      hasSpecialDisadvantage: Boolean(definition.disadvantageText),
      hasAdditionalRules: Boolean(definition.ruleNote),
      propertyNames: definition.ruleNote ? ["Helmregel"] : [],
      categoryUrl: "https://dsa.ulisses-regelwiki.de/RS_Helme.html",
      regelwikiUrl: definition.url,
      armorType: definition.armorType,
      armorZone: "Kopf",
      zoneProtection: values.zoneProtection,
      shortDescription: definition.shortDescription,
      ruleNote: definition.ruleNote,
      advantageText: definition.advantageText,
      disadvantageText: definition.disadvantageText,
      derivedValues: !definition.explicitPriceAndWeight,
    } satisfies ArmoryItemInfo];
  }),
);

export const HELMET_COUNT = definitions.length;
