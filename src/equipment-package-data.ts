import type { ArmoryItemInfo } from "./armory-data";
import type { OptolithItem } from "./types";

export interface EquipmentPackageItem {
  catalogId: string;
  amount: number;
}

export interface EquipmentPackageDefinition {
  id: string;
  name: string;
  sourceLabel: string;
  sourceShortLabel: string;
  pages: readonly string[];
  regelwikiUrl: string;
  items: readonly EquipmentPackageItem[];
  publishedPrice?: number;
  publishedWeight?: number;
  note?: string;
  unavailableReason?: string;
}

const overviewUrl = "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete.html";

const packageInfo = (
  name: string,
  sourceLabel: string,
  sourceShortLabel: string,
  pages: readonly string[],
  regelwikiUrl: string,
): ArmoryItemInfo => ({
  sourceId: "ausruestungspakete",
  sourceLabel,
  sourceShortLabel,
  pages,
  hasSpecialAdvantage: false,
  hasSpecialDisadvantage: false,
  hasAdditionalRules: false,
  propertyNames: [],
  categoryUrl: overviewUrl,
  regelwikiUrl,
  shortDescription: `${name} aus einem Ausrüstungspaket. Preis und Gewicht entsprechen dem veröffentlichten Paketinhalt.`,
});

/**
 * Paketbestandteile, die im allgemeinen Katalog nur als variable Vorlage oder
 * mit abweichendem Einzelgewicht vorliegen. Eigene Kennungen halten die
 * veröffentlichten Paketwerte nachvollziehbar, ohne andere Katalogeinträge zu
 * überschreiben.
 */
export const EQUIPMENT_PACKAGE_ITEM_DATA: Record<string, Partial<OptolithItem> & { name: string; price: number }> = {
  "equipment:paketamulettepersoenliches": { name: "Amulette, Götterfigürchen und persönliche Gegenstände", gr: 7, weight: 2.175, price: 4.7 },
  "equipment:paketheiltrankqs3": { name: "Heiltrank (QS 3)", gr: 9, weight: 0.5, price: 180 },
  "equipment:paketheiltrankqs4": { name: "Heiltrank (QS 4)", gr: 9, weight: 0, price: 240 },
  "equipment:paketkleidungnormal": { name: "Kleidung (normal)", gr: 6, weight: 2, price: 25 },
  "equipment:paketkleidungniedereradel": { name: "Kleidung (Niederer Adel)", gr: 6, weight: 2, price: 150 },
  "equipment:paketnagelpfeile": { name: "Nagelpfeile", gr: 7, weight: 0.05, price: 20 },
  "equipment:paketpuder": { name: "Puder", gr: 7, weight: 0.05, price: 5 },
};

export const EQUIPMENT_PACKAGE_ITEM_INFO: Record<string, ArmoryItemInfo> = {
  "equipment:paketamulettepersoenliches": packageInfo("Persönliche Gegenstände", "Archiv der Ausrüstung", "AdA", ["318"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/abenteurerpaket.html"),
  "equipment:paketheiltrankqs3": packageInfo("Heiltrank QS 3", "Verborgen in der Tiefe", "VidT", ["159"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/hoehlenforscherpaket.html"),
  "equipment:paketheiltrankqs4": packageInfo("Heiltrank QS 4", "Archiv der Ausrüstung", "AdA", ["318"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/abenteurerpaket.html"),
  "equipment:paketkleidungnormal": packageInfo("Normale Kleidung", "Archiv der Ausrüstung", "AdA", ["318"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/abenteurerpaket.html"),
  "equipment:paketkleidungniedereradel": packageInfo("Kleidung des niederen Adels", "Archiv der Ausrüstung", "AdA", ["319"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/adligenpaket.html"),
  "equipment:paketnagelpfeile": packageInfo("Nagelpfeile", "Archiv der Ausrüstung", "AdA", ["319"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/adligenpaket.html"),
  "equipment:paketpuder": packageInfo("Puder", "Archiv der Ausrüstung", "AdA", ["319"], "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/adligenpaket.html"),
};

const item = (catalogId: string, amount = 1): EquipmentPackageItem => ({ catalogId, amount });

const unavailable = (id: string, name: string): EquipmentPackageDefinition => ({
  id,
  name,
  sourceLabel: "DSA-Regelwiki",
  sourceShortLabel: "RW",
  pages: [],
  regelwikiUrl: `https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/${id}.html`,
  items: [],
  unavailableReason: "Die im Regelwiki verlinkte Detailseite enthält derzeit keine veröffentlichte Inhaltsliste.",
});

export const EQUIPMENT_PACKAGES: readonly EquipmentPackageDefinition[] = [
  {
    id: "abenteurerpaket",
    name: "Abenteurerpaket",
    sourceLabel: "Archiv der Ausrüstung / Aventurische Meisterschaft",
    sourceShortLabel: "AdA/AMe",
    pages: ["318", "186"],
    regelwikiUrl: "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/abenteurerpaket.html",
    publishedPrice: 575.5,
    publishedWeight: 23.6,
    items: [
      item("equipment:pfeile", 20), item("equipment:paketamulettepersoenliches"), item("equipment:becher"),
      item("equipment:fackel"), item("equipment:feuersteinundstahl"), item("equipment:geldbeutel"),
      item("equipment:goetterfiguerchen"), item("equipment:guerteltasche"), item("equipment:paketheiltrankqs4"),
      item("equipment:holzschale"), item("equipment:paketkleidungnormal"), item("equipment:kletterseil10schritt"),
      item("equipment:koecher"), item("equipment:kompass"), item("rangedweapon:kurzbogen"),
      item("meleeweapon:kurzschwert"), item("equipment:lederrucksack"), item("equipment:nadelundzwirnset"),
      item("equipment:proviant", 3), item("equipment:verband", 10), item("equipment:waffenpflegeset"),
      item("equipment:wasserschlauch"), item("equipment:wolldecke"), item("equipment:wurfhaken"),
      item("equipment:zunder"), item("equipment:zunderdose"),
    ],
  },
  {
    id: "adligenpaket",
    name: "Adligenpaket",
    sourceLabel: "Archiv der Ausrüstung / Aventurische Meisterschaft",
    sourceShortLabel: "AdA/AMe",
    pages: ["319", "187"],
    regelwikiUrl: "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/adligenpaket.html",
    publishedPrice: 446.8,
    publishedWeight: 4.225,
    note: "Das Regelwiki nennt 4,225 Stein als Gesamtgewicht; die veröffentlichten Einzelpositionen ergeben 4,725 Stein. Für Warenkorb und Tragkraft verwendet der Generator die Einzelwerte.",
    items: [
      item("equipment:buerste"), item("meleeweapon:dolch"), item("equipment:geldkatze"),
      item("equipment:paketkleidungniedereradel"), item("meleeweapon:langschwert"), item("equipment:nadelundzwirnset"),
      item("equipment:paketnagelpfeile"), item("equipment:oellampe"), item("equipment:papier1blatt"),
      item("equipment:paketpuder"), item("equipment:taschentuch"), item("equipment:verband", 10),
      item("equipment:zunder"), item("equipment:zunderdose"),
    ],
  },
  unavailable("buergerpaket", "Bürgerpaket"),
  unavailable("geweihtenpaket", "Geweihtenpaket"),
  unavailable("hexenpaket", "Hexenpaket"),
  {
    id: "hoehlenforscherpaket",
    name: "Höhlenforscherpaket",
    sourceLabel: "Verborgen in der Tiefe",
    sourceShortLabel: "VidT",
    pages: ["159"],
    regelwikiUrl: "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/hoehlenforscherpaket.html",
    publishedPrice: 392,
    publishedWeight: 34.225,
    note: "Das Paket ist häufig schwerer als die unbelastete Tragkraft. Lasttier, Aufteilung in der Gruppe oder das Weglassen markierter Gegenstände einplanen.",
    items: [
      item("equipment:beilhandaxt"), item("equipment:fackel", 5), item("equipment:feuersteinundstahl"),
      item("equipment:paketheiltrankqs3"), item("equipment:holzschale"), item("equipment:kletterhaken", 10),
      item("equipment:kletterseil10schritt"), item("equipment:kompass"), item("equipment:lederrucksack"),
      item("meleeweapon:messer"), item("equipment:proviant", 10), item("equipment:spitzhacke"),
      item("equipment:stundenglas"), item("equipment:verband", 10), item("equipment:wasserschlauch", 2),
      item("equipment:wolldecke"), item("equipment:wurfhaken"), item("equipment:zunder"), item("equipment:zunderdose"),
    ],
  },
  unavailable("magierpaket", "Magierpaket"),
  {
    id: "reisepaket",
    name: "Reisepaket",
    sourceLabel: "DSA5-Regelwerk, dritte Auflage",
    sourceShortLabel: "GRW",
    pages: ["364"],
    regelwikiUrl: "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/reisepaket.html",
    items: [
      item("equipment:becher"), item("equipment:beilhandaxt"), item("equipment:essbesteck"), item("equipment:wolldecke"),
      item("equipment:feuersteinundstahl"), item("equipment:geldbeutel"), item("equipment:kletterseil10schritt"),
      item("equipment:lederrucksack"), item("meleeweapon:messer"), item("equipment:nadelundzwirnset"),
      item("equipment:fackel"), item("equipment:proviant", 3), item("equipment:holzschale"), item("equipment:verband"),
      item("equipment:waffenpflegeset"), item("equipment:wasserschlauch"), item("equipment:wurfhaken"),
      item("equipment:zunder"), item("equipment:zunderdose"),
    ],
  },
  {
    id: "stadtpaket",
    name: "Stadtpaket",
    sourceLabel: "DSA5-Regelwerk, dritte Auflage",
    sourceShortLabel: "GRW",
    pages: ["365"],
    regelwikiUrl: "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/stadtpaket.html",
    items: [
      item("equipment:geldkatze"), item("equipment:kohlestift"), item("equipment:lampenoel"), item("meleeweapon:messer"),
      item("equipment:nadelundzwirnset"), item("equipment:oellampe"), item("equipment:papier1blatt"),
      item("equipment:verband"), item("equipment:zunder"), item("equipment:zunderdose"),
    ],
  },
  {
    id: "wildnispaket",
    name: "Wildnispaket",
    sourceLabel: "DSA5-Regelwerk, dritte Auflage",
    sourceShortLabel: "GRW",
    pages: ["365"],
    regelwikiUrl: "https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete/wildnispaket.html",
    items: [
      item("equipment:beilhandaxt"), item("equipment:wolldecke"), item("equipment:feuersteinundstahl"),
      item("equipment:kletterseil10schritt"), item("equipment:lederrucksack"), item("meleeweapon:messer"),
      item("equipment:nadelundzwirnset"), item("equipment:fackel"), item("equipment:proviant", 5),
      item("equipment:holzschale"), item("equipment:verband"), item("equipment:wasserschlauch", 2),
      item("equipment:wurfhaken"), item("equipment:zelt1person"), item("equipment:zunder"), item("equipment:zunderdose"),
    ],
  },
];

/** Nur Pakete mit einer veröffentlichten, kaufbaren Inhaltsliste. */
export const AVAILABLE_EQUIPMENT_PACKAGES: readonly EquipmentPackageDefinition[] = EQUIPMENT_PACKAGES
  .filter((entry) => !entry.unavailableReason && entry.items.length > 0);

export const EQUIPMENT_PACKAGE_BY_ID = Object.fromEntries(EQUIPMENT_PACKAGES.map((entry) => [entry.id, entry]));
