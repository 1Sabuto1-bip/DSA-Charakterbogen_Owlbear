import {
  BIOGRAPHY_CULTURES,
  BIOGRAPHY_PROFESSIONS,
  BIOGRAPHY_SPECIES,
  OPTOLITH_ADVANTAGE_NAMES,
  OPTOLITH_CULTURE_NAMES,
  OPTOLITH_DISADVANTAGE_NAMES,
  OPTOLITH_PROFESSION_NAMES,
  OPTOLITH_SPECIES_NAMES,
  OPTOLITH_TRAIT_VARIANTS,
} from "./biography-data";
import { COMPLETE_ADVANTAGES, COMPLETE_DISADVANTAGES } from "./biography-catalog";
import type {
  BiographyCatalogEntry,
  BiographyTrait,
  DarkAidHero,
  DarkAidValue,
  HeroBiography,
  OptolithHero,
} from "./types";

const BASE_SPECIES_NAMES: Record<string, string> = {
  R_1: "Mensch",
  R_2: "Elf",
  R_3: "Halbelf",
  R_4: "Zwerg",
};

export const normalizeBiographyText = (value: string): string => value
  .toLocaleLowerCase("de")
  .replaceAll("ä", "ae")
  .replaceAll("ö", "oe")
  .replaceAll("ü", "ue")
  .replaceAll("ß", "ss")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]/g, "");

const humanize = (value: string): string => {
  const text = value
    .replace(/([a-zäöüß])([A-ZÄÖÜ])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();
  return text ? text.charAt(0).toLocaleUpperCase("de") + text.slice(1) : "Unbekannt";
};

const catalogMap = (catalog: BiographyCatalogEntry[]): Map<string, BiographyCatalogEntry> => new Map(
  catalog.flatMap((entry) => [
    [normalizeBiographyText(entry.id), entry],
    [normalizeBiographyText(entry.name), entry],
  ]),
);

const SPECIES_BY_TEXT = catalogMap(BIOGRAPHY_SPECIES);
const CULTURES_BY_TEXT = catalogMap(BIOGRAPHY_CULTURES);
const PROFESSIONS_BY_TEXT = catalogMap(BIOGRAPHY_PROFESSIONS);
const ADVANTAGES_BY_TEXT = catalogMap(COMPLETE_ADVANTAGES);
const DISADVANTAGES_BY_TEXT = catalogMap(COMPLETE_DISADVANTAGES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finitePositiveInteger = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
};

const resolveName = (
  value: string | undefined,
  catalogue: Map<string, BiographyCatalogEntry>,
  optolithNames: Record<string, string>,
): string => {
  if (!value) return "";
  return optolithNames[value] ?? catalogue.get(normalizeBiographyText(value))?.name ?? humanize(value);
};

const selectionLabel = (sourceId: string, entry: Record<string, unknown>): string | undefined => {
  const direct = [entry.variant, entry.name, entry.text].find((value) => typeof value === "string" && value.trim());
  if (typeof direct === "string") return direct.trim();
  const sid = finitePositiveInteger(entry.sid);
  if (!sid) return undefined;
  return OPTOLITH_TRAIT_VARIANTS[sourceId]?.[sid] ?? `Auswahl ${sid}`;
};

const importedTrait = (
  sourceId: string,
  name: string,
  raw: unknown,
  index: number,
): BiographyTrait => {
  const entry = isRecord(raw) ? raw : {};
  const level = finitePositiveInteger(entry.tier ?? entry.level);
  const variant = selectionLabel(sourceId, entry);
  return {
    id: `${sourceId}_${index}_${normalizeBiographyText(variant ?? "standard")}`,
    sourceId,
    name,
    ...(level ? { level } : {}),
    ...(variant ? { variant } : {}),
  };
};

const traitsFromOptolith = (hero: OptolithHero, kind: "advantage" | "disadvantage"): BiographyTrait[] => {
  const prefix = kind === "advantage" ? "ADV_" : "DISADV_";
  const names = kind === "advantage" ? OPTOLITH_ADVANTAGE_NAMES : OPTOLITH_DISADVANTAGE_NAMES;
  return Object.entries(hero.activatable ?? {}).flatMap(([sourceId, values]) => {
    if (!sourceId.startsWith(prefix)) return [];
    const name = names[sourceId] ?? humanize(sourceId);
    const entries = Array.isArray(values) && values.length > 0 ? values : [{}];
    return entries.map((entry, index) => importedTrait(sourceId, name, entry, index));
  });
};

const darkAidVariant = (entry: DarkAidValue): string | undefined => {
  const variant = entry.variant;
  if (typeof variant === "string" && variant.trim()) return variant.trim();
  if (isRecord(variant)) {
    const name = variant.name ?? variant.text;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return undefined;
};

const traitsFromDarkAid = (
  values: DarkAidValue[] | undefined,
  catalogue: Map<string, BiographyCatalogEntry>,
  kind: "ADV" | "DISADV",
): BiographyTrait[] => (values ?? []).map((entry, index) => {
  const definition = catalogue.get(normalizeBiographyText(entry.id));
  const variant = darkAidVariant(entry);
  const level = finitePositiveInteger(entry.level);
  return {
    id: `DARKAID_${kind}_${normalizeBiographyText(entry.id)}_${index}_${normalizeBiographyText(variant ?? "standard")}`,
    sourceId: entry.id,
    name: definition?.name ?? humanize(entry.id),
    ...(level ? { level } : {}),
    ...(variant ? { variant } : {}),
  };
});

const sanitizeTrait = (value: unknown, index: number): BiographyTrait | null => {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const level = finitePositiveInteger(value.level);
  const variant = typeof value.variant === "string" && value.variant.trim() ? value.variant.trim() : undefined;
  return {
    id: typeof value.id === "string" && value.id ? value.id : `TRAIT_${index}_${normalizeBiographyText(value.name)}`,
    ...(typeof value.sourceId === "string" && value.sourceId ? { sourceId: value.sourceId } : {}),
    name: value.name.trim(),
    ...(level ? { level } : {}),
    ...(variant ? { variant } : {}),
  };
};

export const deriveBiography = (hero: OptolithHero): HeroBiography => ({
  species: hero.rv
    ? resolveName(hero.rv, SPECIES_BY_TEXT, OPTOLITH_SPECIES_NAMES)
    : BASE_SPECIES_NAMES[hero.r ?? ""] ?? resolveName(hero.r, SPECIES_BY_TEXT, OPTOLITH_SPECIES_NAMES),
  culture: resolveName(hero.c, CULTURES_BY_TEXT, OPTOLITH_CULTURE_NAMES),
  profession: resolveName(hero.p, PROFESSIONS_BY_TEXT, OPTOLITH_PROFESSION_NAMES),
  advantages: traitsFromOptolith(hero, "advantage"),
  disadvantages: traitsFromOptolith(hero, "disadvantage"),
  specialAbilities: [],
});

export const createDarkAidBiography = (source: DarkAidHero): HeroBiography => ({
  species: resolveName(source.race, SPECIES_BY_TEXT, {}),
  culture: resolveName(source.culture, CULTURES_BY_TEXT, {}),
  profession: source.professionname?.trim()
    || resolveName(source.profession, PROFESSIONS_BY_TEXT, {}),
  advantages: traitsFromDarkAid(source.advantages, ADVANTAGES_BY_TEXT, "ADV"),
  disadvantages: traitsFromDarkAid(source.disadvantages, DISADVANTAGES_BY_TEXT, "DISADV"),
  specialAbilities: [],
});

export const ensureHeroBiography = (hero: OptolithHero): HeroBiography => {
  const current = hero.biography;
  if (!current || !isRecord(current)) {
    hero.biography = deriveBiography(hero);
    return hero.biography;
  }
  const derived = deriveBiography(hero);
  hero.biography = {
    species: typeof current.species === "string" ? current.species.trim() : derived.species,
    culture: typeof current.culture === "string" ? current.culture.trim() : derived.culture,
    profession: typeof current.profession === "string" ? current.profession.trim() : derived.profession,
    advantages: Array.isArray(current.advantages)
      ? current.advantages.map(sanitizeTrait).filter((entry): entry is BiographyTrait => Boolean(entry))
      : derived.advantages,
    disadvantages: Array.isArray(current.disadvantages)
      ? current.disadvantages.map(sanitizeTrait).filter((entry): entry is BiographyTrait => Boolean(entry))
      : derived.disadvantages,
    specialAbilities: Array.isArray(current.specialAbilities)
      ? current.specialAbilities.map(sanitizeTrait).filter((entry): entry is BiographyTrait => Boolean(entry))
      : derived.specialAbilities,
  };
  return hero.biography;
};

export const findBiographyEntry = (
  value: string,
  kind: "advantage" | "disadvantage",
): BiographyCatalogEntry | undefined => (kind === "advantage" ? ADVANTAGES_BY_TEXT : DISADVANTAGES_BY_TEXT)
  .get(normalizeBiographyText(value));
