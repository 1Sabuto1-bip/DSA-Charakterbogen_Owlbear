import { COMBAT_TECHNIQUES, TALENTS } from "./data";
import { DARKAID_ITEM_DATA, DARKAID_MAGIC_BY_SOURCE_ID } from "./darkaid-data";
import { CANTRIPS, SPELLS } from "./magic-data";
import type {
  CharacterSheetState,
  DarkAidEquipmentValue,
  DarkAidHero,
  DarkAidValue,
  OptolithHero,
  OptolithItem,
} from "./types";

const ATTRIBUTE_IDS: Record<string, string> = {
  mut: "ATTR_1",
  klugheit: "ATTR_2",
  intuition: "ATTR_3",
  charisma: "ATTR_4",
  fingerfertigkeit: "ATTR_5",
  gewandtheit: "ATTR_6",
  konstitution: "ATTR_7",
  koerperkraft: "ATTR_8",
};

const EXPERIENCE_AP: Record<string, number> = {
  unerfahren: 900,
  durchschnittlich: 1000,
  erfahren: 1100,
  kompetent: 1200,
  meisterlich: 1400,
  brillant: 1700,
  legendaer: 2100,
};

const EXPERIENCE_ORDER = [
  "unerfahren",
  "durchschnittlich",
  "erfahren",
  "kompetent",
  "meisterlich",
  "brillant",
  "legendaer",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeDarkAidId = (value: string): string =>
  value
    .toLocaleLowerCase("de")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const TALENT_ID_BY_DARKAID_ID = Object.fromEntries(
  TALENTS.map((entry) => [normalizeDarkAidId(entry.name), entry.id]),
) as Record<string, string>;

const COMBAT_ID_BY_DARKAID_ID = Object.fromEntries(
  Object.entries(COMBAT_TECHNIQUES).map(([id, name]) => [normalizeDarkAidId(name), id]),
) as Record<string, string>;

const SPELL_ID_BY_DARKAID_ID = Object.fromEntries(
  SPELLS.map((entry) => [normalizeDarkAidId(entry.name), entry.id]),
) as Record<string, string>;

const CANTRIP_ID_BY_DARKAID_ID = Object.fromEntries(
  Object.entries(CANTRIPS).map(([id, name]) => [normalizeDarkAidId(name), id]),
) as Record<string, string>;

const SPELL_ALIASES: Record<string, string> = {
  analys: "SPELL_2",
  hexenkralle: "SPELL_19",
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const sourceValues = (hero: DarkAidHero): DarkAidValue[] => [
  ...(hero.advantages ?? []),
  ...(hero.disadvantages ?? []),
];

const getSourceLevel = (hero: DarkAidHero, id: string): number => {
  const entry = sourceValues(hero).find((value) => value.id === id);
  return entry ? Math.max(1, asNumber(entry.level, 1)) : 0;
};

const getBaseValue = (hero: DarkAidHero, id: string): DarkAidValue | undefined =>
  hero.basevalues?.find((entry) => entry.id === id);

const mapSpecies = (race = ""): "R_1" | "R_2" | "R_4" => {
  const normalized = normalizeDarkAidId(race);
  if (normalized.includes("zwerg")) return "R_4";
  if (normalized.includes("elf")) return "R_2";
  return "R_1";
};

const humanizeId = (value: string): string => {
  const spaced = value
    .replace(/([a-zäöüß])([A-ZÄÖÜ])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();
  return spaced ? spaced.charAt(0).toLocaleUpperCase("de") + spaced.slice(1) : "Unbekannter Gegenstand";
};

const itemArrays = (hero: DarkAidHero): Array<{ values: DarkAidEquipmentValue[]; fallbackType: string }> => [
  { values: hero.meleeweapons ?? [], fallbackType: "meleeweapon" },
  { values: hero.rangedweapons ?? [], fallbackType: "rangedweapon" },
  { values: hero.shields ?? [], fallbackType: "shield" },
  { values: hero.armor ?? [], fallbackType: "armor" },
  { values: hero.otherobjects ?? [], fallbackType: "equipment" },
];

const convertItems = (hero: DarkAidHero): Record<string, OptolithItem> => {
  const items: Record<string, OptolithItem> = {};
  let index = 0;
  for (const collection of itemArrays(hero)) {
    for (const value of collection.values) {
      const sourceId = value.ruleelement?.id ?? `custom-${index + 1}`;
      const sourceType = value.ruleelement?.type ?? collection.fallbackType;
      const itemKind = sourceType === "armor"
        ? "armor"
        : sourceType === "rangedweapon"
          ? "ranged"
          : sourceType === "shield"
            ? "shield"
            : sourceType === "meleeweapon"
              ? "melee"
              : "equipment";
      const template = DARKAID_ITEM_DATA[`${sourceType}:${sourceId}`]
        ?? DARKAID_ITEM_DATA[`${collection.fallbackType}:${sourceId}`]
        ?? {};
      const id = `DARKAID_ITEM_${normalizeDarkAidId(sourceType)}_${normalizeDarkAidId(sourceId)}_${index}`;
      const directWeight = typeof value.weight === "number" ? value.weight : undefined;
      const directPrice = typeof value.price === "number" ? value.price : undefined;
      items[id] = {
        ...template,
        id,
        name: typeof value.name === "string" && value.name.trim()
          ? value.name.trim()
          : template.name ?? humanizeId(sourceId),
        gr: template.gr ?? (sourceType === "armor" ? 4 : sourceType.includes("weapon") || sourceType === "shield" ? 1 : 7),
        amount: Math.max(0, asNumber(value.amount, 1)),
        itemKind,
        ...(directWeight === undefined ? {} : { weight: directWeight }),
        ...(directPrice === undefined ? {} : { price: directPrice }),
        darkAidSourceId: sourceId,
        darkAidSourceType: sourceType,
        equipped: value.equipped === true,
      };
      index += 1;
    }
  }
  return items;
};

const startingPurse = (hero: DarkAidHero): number => {
  let total = 75_000;
  total += getSourceLevel(hero, "reich") * 25_000;
  total -= getSourceLevel(hero, "arm") * 25_000;

  const focusRules = isObject(hero.rules) && Array.isArray(hero.rules.focusrules)
    ? hero.rules.focusrules
    : [];
  const variablePurse = focusRules.find(
    (entry) => isObject(entry) && entry.id === "startkapitalnacherfahrung",
  );
  if (isObject(variablePurse) && variablePurse.choice !== -1) {
    const level = hero.xp?.startinglevel ?? "erfahren";
    const levelIndex = EXPERIENCE_ORDER.indexOf(level);
    const difference = (levelIndex >= 0 ? levelIndex : EXPERIENCE_ORDER.indexOf("erfahren"))
      - EXPERIENCE_ORDER.indexOf("erfahren");
    total += difference * 20_000;
  }
  return total;
};

const splitPurse = (hero: DarkAidHero): Partial<Record<"d" | "s" | "h" | "k", string>> => {
  const stored = Math.trunc(asNumber(hero.purse));
  const kreutzers = hero.iscreated === true ? stored : startingPurse(hero) + stored;
  const sign = kreutzers < 0 ? -1 : 1;
  let remainder = Math.abs(kreutzers);
  const d = Math.floor(remainder / 1000);
  remainder %= 1000;
  const s = Math.floor(remainder / 100);
  remainder %= 100;
  const h = Math.floor(remainder / 10);
  const k = remainder % 10;
  const values = [d, s, h, k];
  const firstNonZero = values.findIndex((value) => value > 0);
  if (sign < 0 && firstNonZero >= 0) values[firstNonZero] *= -1;
  return { d: String(values[0]), s: String(values[1]), h: String(values[2]), k: String(values[3]) };
};

const convertMagic = (hero: DarkAidHero): { spells: Record<string, number>; cantrips: string[] } => {
  const spells: Record<string, number> = {};
  const cantrips: string[] = [];
  for (const entry of hero.spells ?? []) {
    const sourceId = normalizeDarkAidId(entry.id);
    const definition = DARKAID_MAGIC_BY_SOURCE_ID[sourceId];
    const hasSpellCheck = Boolean(definition?.check);
    if (typeof entry.level === "number" || hasSpellCheck) {
      const id = SPELL_ID_BY_DARKAID_ID[sourceId]
        ?? SPELL_ALIASES[sourceId]
        ?? definition?.id
        ?? `DARKAID_SPELL_${sourceId}`;
      spells[id] = asNumber(entry.level);
    } else {
      const id = CANTRIP_ID_BY_DARKAID_ID[sourceId] ?? `DARKAID_CANTRIP_${sourceId}`;
      if (!cantrips.includes(id)) cantrips.push(id);
    }
  }
  return { spells, cantrips };
};

const convertChants = (hero: DarkAidHero): { liturgies: Record<string, number>; blessings: string[] } => {
  const liturgies: Record<string, number> = {};
  const blessings: string[] = [];
  for (const entry of hero.chants ?? []) {
    if (typeof entry.level === "number") liturgies[`DARKAID_CHANT_${entry.id}`] = entry.level;
    else blessings.push(`DARKAID_BLESSING_${entry.id}`);
  }
  return { liturgies, blessings };
};

export const isDarkAidHero = (value: unknown): value is DarkAidHero =>
  isObject(value)
  && typeof value.name === "string"
  && Array.isArray(value.attributes)
  && (Array.isArray(value.skills) || isObject(value.rules))
  && typeof value.clientVersion !== "string";

export interface DarkAidConversion {
  hero: OptolithHero;
  karmaMax: number;
  fateMax: number;
}

export const convertDarkAidHero = (source: DarkAidHero): DarkAidConversion => {
  const attributes = Object.entries(ATTRIBUTE_IDS).map(([sourceId, id]) => {
    const entry = source.attributes.find((value) => value.id === sourceId);
    return { id, value: asNumber(entry?.level, 8) };
  });
  const talents = Object.fromEntries(TALENTS.map((definition) => [definition.id, 0])) as Record<string, number>;
  for (const entry of source.skills ?? []) {
    const id = TALENT_ID_BY_DARKAID_ID[normalizeDarkAidId(entry.id)];
    if (id) talents[id] = asNumber(entry.level);
  }
  const ct: Record<string, number> = {};
  for (const entry of source.combattechniques ?? []) {
    const id = COMBAT_ID_BY_DARKAID_ID[normalizeDarkAidId(entry.id)];
    if (id) ct[id] = asNumber(entry.level, 6);
  }

  const magic = convertMagic(source);
  const chants = convertChants(source);
  const life = getBaseValue(source, "lebensenergie");
  const astral = getBaseValue(source, "astralenergie");
  const karma = getBaseValue(source, "karmaenergie");
  const magicalTrait = getSourceLevel(source, "zauberer") > 0;
  const level = source.xp?.startinglevel ?? "erfahren";
  const rulesLocale = isObject(source.rules) && typeof source.rules.locale === "string"
    ? source.rules.locale.replace("_", "-")
    : "de-DE";
  const fileVersion = source.version
    ?? (isObject(source.rules) && (typeof source.rules.version === "string" || typeof source.rules.version === "number")
      ? source.rules.version
      : "älteres Format");
  const hero: OptolithHero = {
    clientVersion: `DarkAid TDC ${fileVersion}`,
    id: typeof source.uuid === "string" && source.uuid
      ? source.uuid
      : `DARKAID_${stableHash(`${source.name}|${source.race ?? ""}|${source.profession ?? ""}`)}`,
    name: source.name.trim(),
    locale: rulesLocale,
    ap: { total: EXPERIENCE_AP[level] ?? 0 },
    el: level,
    r: mapSpecies(source.race),
    rv: source.race,
    c: source.culture,
    p: source.professionname || source.profession,
    pv: source.profession,
    sex: source.sex,
    pers: {
      eyeColor: source.eyecolor,
      hairColor: source.haircolor,
      placeOfBirth: source.placeofbirth,
      height: source.height,
      weight: source.weigth,
    },
    attr: {
      values: attributes,
      lp: asNumber(life?.bought) + getSourceLevel(source, "hohelebenskraft"),
      ae: asNumber(astral?.bought) + getSourceLevel(source, "hoheastralkraft"),
      kp: asNumber(karma?.bought) + getSourceLevel(source, "hohekarmalkraft"),
      permanentLP: { lost: Array.isArray(life?.losses) ? life.losses.length : 0 },
      permanentAE: { lost: Array.isArray(astral?.losses) ? astral.losses.length : 0, redeemed: 0 },
      permanentKP: { lost: Array.isArray(karma?.losses) ? karma.losses.length : 0, redeemed: 0 },
    },
    activatable: magicalTrait ? { ADV_50: [{}] } : {},
    talents,
    ct,
    spells: magic.spells,
    cantrips: magic.cantrips,
    liturgies: chants.liturgies,
    blessings: chants.blessings,
    belongings: {
      items: convertItems(source),
      purse: splitPurse(source),
    },
  };

  const attributeValues = attributes.map((entry) => entry.value);
  const primary = Math.max(...attributeValues.slice(0, 4), 8);
  const isBlessed = getSourceLevel(source, "geweihter") > 0 || Object.keys(chants.liturgies).length > 0;
  const karmaLoss = Array.isArray(karma?.losses) ? karma.losses.length : 0;
  return {
    hero,
    karmaMax: isBlessed ? Math.max(1, 20 + primary + asNumber(hero.attr.kp) - karmaLoss) : 0,
    fateMax: Math.max(0, 3 + getSourceLevel(source, "glueck")),
  };
};

export const createDarkAidState = (
  source: DarkAidHero,
  createRuntime: (hero: OptolithHero) => CharacterSheetState["runtime"],
): CharacterSheetState => {
  const converted = convertDarkAidHero(source);
  const runtime = createRuntime(converted.hero);
  runtime.resources.kp = { current: converted.karmaMax, max: converted.karmaMax };
  runtime.resources.fate = { current: converted.fateMax, max: converted.fateMax };
  return {
    schemaVersion: 1,
    source: "darkaid",
    importedAt: new Date().toISOString(),
    hero: converted.hero,
    runtime,
    originalData: source as unknown as Record<string, unknown>,
  };
};
