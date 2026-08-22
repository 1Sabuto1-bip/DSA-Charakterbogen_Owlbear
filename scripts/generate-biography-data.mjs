import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rulesRoot = resolve(
  process.env.DARKAID_RULES_ROOT
    ?? join(projectRoot, "..", "darkaid-source", "src", "rulesystems", "dsa5aventurien"),
);

const walk = (directory, result = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, result);
    else result.push(path);
  }
  return result;
};

const files = walk(rulesRoot);
const loadEntries = (filename) => files
  .filter((path) => basename(path) === filename)
  .flatMap((path) => JSON.parse(readFileSync(path, "utf8")).data ?? []);
const loadBase = (filename) => JSON.parse(readFileSync(join(rulesRoot, filename), "utf8")).data ?? [];

const humanize = (value) => String(value ?? "")
  .replace(/([a-zäöüß])([A-ZÄÖÜ])/g, "$1 $2")
  .replaceAll("_", " ")
  .replaceAll("-", " ")
  .trim()
  .replace(/^./, (letter) => letter.toLocaleUpperCase("de"));

const professionName = (entry) => {
  if (entry.name) return entry.name;
  if (entry.namemale && entry.namefemale && entry.namemale !== entry.namefemale) {
    return `${entry.namemale} / ${entry.namefemale}`;
  }
  return entry.namemale || entry.namefemale || humanize(entry.id);
};

const simpleName = (entry) => entry.name || humanize(entry.id);
const catalog = (filename, getName = simpleName) => {
  const unique = new Map();
  for (const entry of loadEntries(filename)) {
    if (!entry.id) continue;
    const name = getName(entry);
    if (!unique.has(entry.id) || unique.get(entry.id).name === humanize(entry.id)) {
      unique.set(entry.id, { id: entry.id, name });
    }
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
};

const traitCatalog = (kind) => {
  const documents = files
    .filter((path) => ["advantages.json", "disadvantages.json"].includes(basename(path)))
    .flatMap((path) => {
      const document = JSON.parse(readFileSync(path, "utf8"));
      return (document.data ?? []).map((entry) => ({
        entry,
        filename: basename(path),
        documentGroup: document.group,
        base: dirname(path) === rulesRoot,
      }));
    });
  const byId = new Map();
  for (const document of documents) {
    if (!document.entry.id) continue;
    const values = byId.get(document.entry.id) ?? [];
    values.push(document);
    byId.set(document.entry.id, values);
  }
  const result = [];
  for (const [id, values] of byId) {
    const hasAdvantageMarker = values.some(({ entry, documentGroup, filename, base }) =>
      (entry.group ?? documentGroup) === "vorteile" || (base && filename === "advantages.json"));
    const hasDisadvantageMarker = values.some(({ entry, documentGroup, filename, base }) =>
      (entry.group ?? documentGroup) === "nachteile" || (base && filename === "disadvantages.json"));
    const inferredKind = hasAdvantageMarker
      ? "advantage"
      : hasDisadvantageMarker
        ? "disadvantage"
        : values.some(({ filename }) => filename === "advantages.json")
          ? "advantage"
          : "disadvantage";
    if (inferredKind !== kind) continue;
    const named = values.find(({ entry }) => typeof entry.name === "string" && entry.name.trim());
    result.push({ id, name: named?.entry.name ?? humanize(id) });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "de"));
};

const baseMap = (filename, prefix, getName = simpleName) => Object.fromEntries(
  loadBase(filename).map((entry, index) => [`${prefix}_${index + 1}`, getName(entry)]),
);

const variantLabel = (value) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.name || value.text || value.label || "";
  return "";
};

const traitVariants = (filename, prefix) => Object.fromEntries(
  loadBase(filename).flatMap((entry, index) => {
    const list = entry.variants?.variantlist;
    if (!Array.isArray(list)) return [];
    const labels = Object.fromEntries(list.map((value, variantIndex) => [variantIndex + 1, variantLabel(value)]));
    return [[`${prefix}_${index + 1}`, labels]];
  }),
);

const data = {
  species: catalog("speciesraces.json"),
  cultures: catalog("cultures.json"),
  professions: catalog("professions.json", professionName),
  advantages: traitCatalog("advantage"),
  disadvantages: traitCatalog("disadvantage"),
  optolithSpecies: baseMap("speciesraces.json", "RV"),
  optolithCultures: baseMap("cultures.json", "C"),
  optolithProfessions: baseMap("professions.json", "P", professionName),
  optolithAdvantages: baseMap("advantages.json", "ADV"),
  optolithDisadvantages: baseMap("disadvantages.json", "DISADV"),
  optolithTraitVariants: {
    ...traitVariants("advantages.json", "ADV"),
    ...traitVariants("disadvantages.json", "DISADV"),
  },
};

const output = `// Automatisch aus den frei verf\u00fcgbaren deutschen DarkAid-Regeldaten erzeugt.\n`
  + `// Enthalten sind nur Kennungen und Namen, keine Regeltexte.\n`
  + `import type { BiographyCatalogEntry } from "./types";\n\n`
  + `export const BIOGRAPHY_SPECIES: BiographyCatalogEntry[] = ${JSON.stringify(data.species, null, 2)};\n\n`
  + `export const BIOGRAPHY_CULTURES: BiographyCatalogEntry[] = ${JSON.stringify(data.cultures, null, 2)};\n\n`
  + `export const BIOGRAPHY_PROFESSIONS: BiographyCatalogEntry[] = ${JSON.stringify(data.professions, null, 2)};\n\n`
  + `export const BIOGRAPHY_ADVANTAGES: BiographyCatalogEntry[] = ${JSON.stringify(data.advantages, null, 2)};\n\n`
  + `export const BIOGRAPHY_DISADVANTAGES: BiographyCatalogEntry[] = ${JSON.stringify(data.disadvantages, null, 2)};\n\n`
  + `export const OPTOLITH_SPECIES_NAMES: Record<string, string> = ${JSON.stringify(data.optolithSpecies, null, 2)};\n\n`
  + `export const OPTOLITH_CULTURE_NAMES: Record<string, string> = ${JSON.stringify(data.optolithCultures, null, 2)};\n\n`
  + `export const OPTOLITH_PROFESSION_NAMES: Record<string, string> = ${JSON.stringify(data.optolithProfessions, null, 2)};\n\n`
  + `export const OPTOLITH_ADVANTAGE_NAMES: Record<string, string> = ${JSON.stringify(data.optolithAdvantages, null, 2)};\n\n`
  + `export const OPTOLITH_DISADVANTAGE_NAMES: Record<string, string> = ${JSON.stringify(data.optolithDisadvantages, null, 2)};\n\n`
  + `export const OPTOLITH_TRAIT_VARIANTS: Record<string, Record<number, string>> = ${JSON.stringify(data.optolithTraitVariants, null, 2)};\n`;

writeFileSync(join(projectRoot, "src", "biography-data.ts"), output);
console.log(`Biografie-Katalog erzeugt: ${data.species.length} Spezies, ${data.cultures.length} Kulturen, ${data.professions.length} Professionen, ${data.advantages.length} Vorteile, ${data.disadvantages.length} Nachteile.`);
