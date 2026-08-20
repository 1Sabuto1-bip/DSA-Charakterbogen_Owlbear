import { DARKAID_MAGIC_BY_SOURCE_ID } from "./darkaid-data";
import { CANTRIPS, SPELLS } from "./magic-data";
import type { SpellDefinition } from "./types";

export const normalizeMagicName = (value: string): string => value
  .toLocaleLowerCase("de")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replaceAll("ß", "ss")
  .replace(/[^a-z0-9]/g, "");

const cantripNames = new Set(Object.values(CANTRIPS).map(normalizeMagicName));
const catalogByName = new Map<string, SpellDefinition>();

for (const definition of SPELLS) {
  catalogByName.set(normalizeMagicName(definition.name), definition);
}

for (const definition of Object.values(DARKAID_MAGIC_BY_SOURCE_ID)) {
  const normalizedName = normalizeMagicName(definition.name);
  if (cantripNames.has(normalizedName) || catalogByName.has(normalizedName)) continue;
  catalogByName.set(normalizedName, { ...definition });
}

/**
 * Gemeinsamer, nach Namen bereinigter Katalog aus Optolith und DarkAid.
 * Zaubertricks bleiben im separaten CANTRIPS-Katalog.
 */
export const ALL_SPELLS: SpellDefinition[] = [...catalogByName.values()]
  .sort((a, b) => a.name.localeCompare(b.name, "de"));

export const ALL_SPELL_BY_ID = Object.fromEntries(
  ALL_SPELLS.map((definition) => [definition.id, definition]),
) as Record<string, SpellDefinition>;
