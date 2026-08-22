import { BIOGRAPHY_ADVANTAGES, BIOGRAPHY_DISADVANTAGES } from "./biography-data";
import { REGELWIKI_ADVANTAGE_NAMES, REGELWIKI_DISADVANTAGE_NAMES } from "./regelwiki-biography-data";
import type { BiographyCatalogEntry } from "./types";

const normalize = (value: string): string => value
  .toLocaleLowerCase("de")
  .replaceAll("ä", "ae")
  .replaceAll("ö", "oe")
  .replaceAll("ü", "ue")
  .replaceAll("ß", "ss")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]/g, "");

const cleanRulewikiName = (value: string): string => value
  .replace(/\s*\(\*\)\s*$/, "")
  .replace(/\s+I(?:-[IVX]+)?\s*$/, "")
  .trim();

const mergeCatalogues = (
  darkAidEntries: BiographyCatalogEntry[],
  rulewikiNames: readonly string[],
): BiographyCatalogEntry[] => {
  const entries = new Map<string, BiographyCatalogEntry>();
  for (const entry of darkAidEntries) entries.set(normalize(entry.name), entry);
  for (const rawName of rulewikiNames) {
    const name = cleanRulewikiName(rawName);
    const key = normalize(name);
    if (!entries.has(key)) entries.set(key, { id: `regelwiki_${key}`, name });
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
};

export const COMPLETE_ADVANTAGES = mergeCatalogues(BIOGRAPHY_ADVANTAGES, REGELWIKI_ADVANTAGE_NAMES);
export const COMPLETE_DISADVANTAGES = mergeCatalogues(BIOGRAPHY_DISADVANTAGES, REGELWIKI_DISADVANTAGE_NAMES);
