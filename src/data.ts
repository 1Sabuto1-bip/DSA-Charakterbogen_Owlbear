import type {
  AttributeCode,
  AttributeDefinition,
  AttributeId,
  TalentCategory,
  TalentDefinition,
  SpeciesDefinition,
  ImprovementCost,
  CombatTechniqueDefinition,
} from "./types";

export const SPECIES: SpeciesDefinition[] = [
  { key: "human", id: "R_1", name: "Mensch", lifeBase: 5, automaticallyMagical: false },
  { key: "elf", id: "R_2", name: "Elf", lifeBase: 2, automaticallyMagical: true },
  { key: "dwarf", id: "R_4", name: "Zwerg", lifeBase: 8, automaticallyMagical: false },
];

export const SPECIES_BY_KEY = Object.fromEntries(SPECIES.map((entry) => [entry.key, entry])) as Record<string, SpeciesDefinition>;
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((entry) => [entry.id, entry])) as Record<string, SpeciesDefinition>;

export const ATTRIBUTES: AttributeDefinition[] = [
  { id: "ATTR_1", code: "MU", name: "Mut" },
  { id: "ATTR_2", code: "KL", name: "Klugheit" },
  { id: "ATTR_3", code: "IN", name: "Intuition" },
  { id: "ATTR_4", code: "CH", name: "Charisma" },
  { id: "ATTR_5", code: "FF", name: "Fingerfertigkeit" },
  { id: "ATTR_6", code: "GE", name: "Gewandtheit" },
  { id: "ATTR_7", code: "KO", name: "Konstitution" },
  { id: "ATTR_8", code: "KK", name: "Körperkraft" },
];

export const ATTRIBUTE_BY_ID = Object.fromEntries(
  ATTRIBUTES.map((attribute) => [attribute.id, attribute]),
) as Record<AttributeId, AttributeDefinition>;

export const ATTRIBUTE_BY_CODE = Object.fromEntries(
  ATTRIBUTES.map((attribute) => [attribute.code, attribute]),
) as Record<AttributeCode, AttributeDefinition>;

const talent = (
  id: number,
  name: string,
  check: string,
  category: TalentCategory,
): TalentDefinition => ({
  id: `TAL_${id}`,
  name,
  check: check.split("/") as [AttributeCode, AttributeCode, AttributeCode],
  category,
  improvementCost: TALENT_IMPROVEMENT_COSTS[id - 1],
});

const TALENT_IMPROVEMENT_COSTS: ImprovementCost[] = [
  "B", "A", "B", "D", "B", "B", "B", "D", "A", "D",
  "A", "B", "C", "A", "B", "B", "B", "B", "C", "C",
  "C", "B", "D", "C", "A", "A", "B", "C", "C", "C",
  "A", "B", "B", "B", "B", "C", "B", "A", "A", "B",
  "B", "A", "C", "B", "A", "B", "B", "B", "B", "D",
  "B", "A", "B", "A", "C", "A", "C", "A", "A",
];

export const TALENTS: TalentDefinition[] = [
  talent(1, "Fliegen", "MU/IN/GE", "Körper"),
  talent(2, "Gaukeleien", "MU/CH/FF", "Körper"),
  talent(3, "Klettern", "MU/GE/KK", "Körper"),
  talent(4, "Körperbeherrschung", "GE/GE/KO", "Körper"),
  talent(5, "Kraftakt", "KO/KK/KK", "Körper"),
  talent(6, "Reiten", "CH/GE/KK", "Körper"),
  talent(7, "Schwimmen", "GE/KO/KK", "Körper"),
  talent(8, "Selbstbeherrschung", "MU/MU/KO", "Körper"),
  talent(9, "Singen", "KL/CH/KO", "Körper"),
  talent(10, "Sinnesschärfe", "KL/IN/IN", "Körper"),
  talent(11, "Tanzen", "KL/CH/GE", "Körper"),
  talent(12, "Taschendiebstahl", "MU/FF/GE", "Körper"),
  talent(13, "Verbergen", "MU/IN/GE", "Körper"),
  talent(14, "Zechen", "KL/KO/KK", "Körper"),
  talent(15, "Bekehren & Überzeugen", "MU/KL/CH", "Gesellschaft"),
  talent(16, "Betören", "MU/CH/CH", "Gesellschaft"),
  talent(17, "Einschüchtern", "MU/IN/CH", "Gesellschaft"),
  talent(18, "Etikette", "KL/IN/CH", "Gesellschaft"),
  talent(19, "Gassenwissen", "KL/IN/CH", "Gesellschaft"),
  talent(20, "Menschenkenntnis", "KL/IN/CH", "Gesellschaft"),
  talent(21, "Überreden", "MU/IN/CH", "Gesellschaft"),
  talent(22, "Verkleiden", "IN/CH/GE", "Gesellschaft"),
  talent(23, "Willenskraft", "MU/IN/CH", "Gesellschaft"),
  talent(24, "Fährtensuchen", "MU/IN/GE", "Natur"),
  talent(25, "Fesseln", "KL/FF/KK", "Natur"),
  talent(26, "Fischen & Angeln", "FF/GE/KO", "Natur"),
  talent(27, "Orientierung", "KL/IN/IN", "Natur"),
  talent(28, "Pflanzenkunde", "KL/FF/KO", "Natur"),
  talent(29, "Tierkunde", "MU/MU/CH", "Natur"),
  talent(30, "Wildnisleben", "MU/GE/KO", "Natur"),
  talent(31, "Brett- & Glücksspiel", "KL/KL/IN", "Wissen"),
  talent(32, "Geographie", "KL/KL/IN", "Wissen"),
  talent(33, "Geschichtswissen", "KL/KL/IN", "Wissen"),
  talent(34, "Götter & Kulte", "KL/KL/IN", "Wissen"),
  talent(35, "Kriegskunst", "MU/KL/IN", "Wissen"),
  talent(36, "Magiekunde", "KL/KL/IN", "Wissen"),
  talent(37, "Mechanik", "KL/KL/FF", "Wissen"),
  talent(38, "Rechnen", "KL/KL/IN", "Wissen"),
  talent(39, "Rechtskunde", "KL/KL/IN", "Wissen"),
  talent(40, "Sagen & Legenden", "KL/KL/IN", "Wissen"),
  talent(41, "Sphärenkunde", "KL/KL/IN", "Wissen"),
  talent(42, "Sternkunde", "KL/KL/IN", "Wissen"),
  talent(43, "Alchimie", "MU/KL/FF", "Handwerk"),
  talent(44, "Boote & Schiffe", "FF/GE/KK", "Handwerk"),
  talent(45, "Fahrzeuge", "CH/FF/KO", "Handwerk"),
  talent(46, "Handel", "KL/IN/CH", "Handwerk"),
  talent(47, "Heilkunde Gift", "MU/KL/IN", "Handwerk"),
  talent(48, "Heilkunde Krankheiten", "MU/IN/KO", "Handwerk"),
  talent(49, "Heilkunde Seele", "IN/CH/KO", "Handwerk"),
  talent(50, "Heilkunde Wunden", "KL/FF/FF", "Handwerk"),
  talent(51, "Holzbearbeitung", "FF/GE/KK", "Handwerk"),
  talent(52, "Lebensmittelbearbeitung", "IN/FF/FF", "Handwerk"),
  talent(53, "Lederbearbeitung", "FF/GE/KO", "Handwerk"),
  talent(54, "Malen & Zeichnen", "IN/FF/FF", "Handwerk"),
  talent(55, "Metallbearbeitung", "FF/KO/KK", "Handwerk"),
  talent(56, "Musizieren", "CH/FF/KO", "Handwerk"),
  talent(57, "Schlösserknacken", "IN/FF/FF", "Handwerk"),
  talent(58, "Steinbearbeitung", "FF/FF/KK", "Handwerk"),
  talent(59, "Stoffbearbeitung", "KL/FF/FF", "Handwerk"),
];

export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((entry) => [entry.id, entry]));

export const COMBAT_TECHNIQUES: Record<string, string> = {
  CT_1: "Armbrüste",
  CT_2: "Bögen",
  CT_3: "Dolche",
  CT_4: "Fechtwaffen",
  CT_5: "Hiebwaffen",
  CT_6: "Kettenwaffen",
  CT_7: "Lanzen",
  CT_8: "Peitschen",
  CT_9: "Raufen",
  CT_10: "Schilde",
  CT_11: "Schleudern",
  CT_12: "Schwerter",
  CT_13: "Stangenwaffen",
  CT_14: "Wurfwaffen",
  CT_15: "Zweihandhiebwaffen",
  CT_16: "Zweihandschwerter",
  CT_17: "Feuerspeien",
  CT_18: "Blasrohre",
  CT_19: "Diskusse",
  CT_20: "Fächer",
  CT_21: "Spießwaffen",
};

export const COMBAT_TECHNIQUE_RULES: Record<string, CombatTechniqueDefinition> = {
  CT_1: { id: "CT_1", name: "Armbrüste", improvementCost: "B", primaryAttributes: ["FF"], range: "ranged" },
  CT_2: { id: "CT_2", name: "Bögen", improvementCost: "C", primaryAttributes: ["FF"], range: "ranged" },
  CT_3: { id: "CT_3", name: "Dolche", improvementCost: "B", primaryAttributes: ["GE"], range: "melee" },
  CT_4: { id: "CT_4", name: "Fechtwaffen", improvementCost: "C", primaryAttributes: ["GE"], range: "melee" },
  CT_5: { id: "CT_5", name: "Hiebwaffen", improvementCost: "C", primaryAttributes: ["KK"], range: "melee" },
  CT_6: { id: "CT_6", name: "Kettenwaffen", improvementCost: "C", primaryAttributes: ["KK"], range: "melee" },
  CT_7: { id: "CT_7", name: "Lanzen", improvementCost: "B", primaryAttributes: ["KK"], range: "melee" },
  CT_8: { id: "CT_8", name: "Peitschen", improvementCost: "B", primaryAttributes: ["FF"], range: "melee" },
  CT_9: { id: "CT_9", name: "Raufen", improvementCost: "B", primaryAttributes: ["GE", "KK"], range: "melee" },
  CT_10: { id: "CT_10", name: "Schilde", improvementCost: "C", primaryAttributes: ["KK"], range: "melee" },
  CT_11: { id: "CT_11", name: "Schleudern", improvementCost: "B", primaryAttributes: ["FF"], range: "ranged" },
  CT_12: { id: "CT_12", name: "Schwerter", improvementCost: "C", primaryAttributes: ["GE", "KK"], range: "melee" },
  CT_13: { id: "CT_13", name: "Stangenwaffen", improvementCost: "C", primaryAttributes: ["GE", "KK"], range: "melee" },
  CT_14: { id: "CT_14", name: "Wurfwaffen", improvementCost: "B", primaryAttributes: ["FF"], range: "ranged" },
  CT_15: { id: "CT_15", name: "Zweihandhiebwaffen", improvementCost: "C", primaryAttributes: ["KK"], range: "melee" },
  CT_16: { id: "CT_16", name: "Zweihandschwerter", improvementCost: "C", primaryAttributes: ["KK"], range: "melee" },
  CT_17: { id: "CT_17", name: "Feuerspeien", improvementCost: "B", primaryAttributes: ["FF"], range: "ranged" },
  CT_18: { id: "CT_18", name: "Blasrohre", improvementCost: "B", primaryAttributes: ["FF"], range: "ranged" },
  CT_19: { id: "CT_19", name: "Diskusse", improvementCost: "C", primaryAttributes: ["FF"], range: "ranged" },
  CT_20: { id: "CT_20", name: "Fächer", improvementCost: "C", primaryAttributes: ["GE"], range: "melee" },
  CT_21: { id: "CT_21", name: "Spießwaffen", improvementCost: "C", primaryAttributes: ["KK"], range: "melee" },
};

export const ITEM_GROUPS: Record<number, string> = {
  1: "Waffen",
  2: "Fernkampfwaffen",
  3: "Munition",
  4: "Rüstungen",
  5: "Waffenzubehör",
  6: "Kleidung",
  7: "Reisebedarf",
  8: "Werkzeuge",
  9: "Heilmittel",
};
