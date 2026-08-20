import {
  ATTRIBUTES,
  ATTRIBUTE_BY_ID,
  COMBAT_TECHNIQUES,
  SPECIES_BY_ID,
  SPECIES_BY_KEY,
  TALENTS,
} from "./data";
import type {
  AttributeCode,
  CharacterSheetState,
  OptolithHero,
  ResourceValue,
  RuntimeState,
  ManualSpecies,
} from "./types";

export class HeroImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeroImportError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const getAttributeValues = (hero: OptolithHero): Record<AttributeCode, number> => {
  const values: Partial<Record<AttributeCode, number>> = {};
  for (const entry of hero.attr.values) {
    const definition = ATTRIBUTE_BY_ID[entry.id as keyof typeof ATTRIBUTE_BY_ID];
    if (definition) values[definition.code] = asFiniteNumber(entry.value);
  }
  return {
    MU: values.MU ?? 0,
    KL: values.KL ?? 0,
    IN: values.IN ?? 0,
    CH: values.CH ?? 0,
    FF: values.FF ?? 0,
    GE: values.GE ?? 0,
    KO: values.KO ?? 0,
    KK: values.KK ?? 0,
  };
};

const deriveLifePoints = (hero: OptolithHero): ResourceValue => {
  const attributes = getAttributeValues(hero);
  const purchased = asFiniteNumber(hero.attr.lp);
  const permanentLost = asFiniteNumber(hero.attr.permanentLP?.lost);

  const speciesBase = SPECIES_BY_ID[hero.r ?? ""]?.lifeBase ?? 5;
  const max = Math.max(1, speciesBase + attributes.KO * 2 + purchased - permanentLost);
  return { current: max, max };
};

const deriveAstralPoints = (hero: OptolithHero): ResourceValue => {
  const attributes = getAttributeValues(hero);
  const primaryAttribute = Math.max(attributes.KL, attributes.IN, attributes.CH);
  const purchased = asFiniteNumber(hero.attr.ae);
  const permanent = hero.attr.permanentAE;
  const permanentLost = asFiniteNumber(permanent?.lost) - asFiniteNumber(permanent?.redeemed);
  const max = Math.max(1, 20 + primaryAttribute + purchased - permanentLost);
  return { current: max, max };
};

export const heroIsMagicallyGifted = (hero: OptolithHero): boolean => {
  if (hero.manual) {
    return hero.manual.species === "elf" || hero.manual.magical;
  }
  return hero.r === "R_2"
    || Object.keys(hero.spells ?? {}).length > 0
    || (hero.cantrips?.length ?? 0) > 0
    || (hero.activatable?.ADV_50?.length ?? 0) > 0;
};

export const isMagicallyGifted = (sheet: CharacterSheetState): boolean =>
  heroIsMagicallyGifted(sheet.hero) || sheet.runtime.resources.ae.max > 0;

const emptyResource = (): ResourceValue => ({ current: 0, max: 0 });

export const createRuntimeState = (hero: OptolithHero): RuntimeState => ({
  resources: {
    lp: deriveLifePoints(hero),
    ae: heroIsMagicallyGifted(hero) ? deriveAstralPoints(hero) : emptyResource(),
    kp: emptyResource(),
    fate: { current: 3, max: 3 },
  },
  notes: "",
  favoriteTalentIds: [],
});

export interface ManualStateOptions {
  species?: ManualSpecies;
  magical?: boolean;
}

export const createManualState = (name: string, options: ManualStateOptions = {}): CharacterSheetState => {
  const createdAt = new Date().toISOString();
  const species = SPECIES_BY_KEY[options.species ?? "human"] ?? SPECIES_BY_KEY.human;
  const magical = species.automaticallyMagical || Boolean(options.magical);
  const hero: OptolithHero = {
    clientVersion: "Manuell",
    dateCreated: createdAt,
    dateModified: createdAt,
    id: `MANUAL_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Unbenannter Held",
    locale: "de-DE",
    r: species.id,
    manual: { species: species.key, magical },
    ap: { total: 0 },
    attr: {
      values: ATTRIBUTES.map((attribute) => ({ id: attribute.id, value: 8 })),
      ae: 0,
      kp: 0,
      lp: 0,
      permanentLP: { lost: 0 },
    },
    activatable: {},
    talents: Object.fromEntries(TALENTS.map((definition) => [definition.id, 0])),
    ct: Object.fromEntries(Object.keys(COMBAT_TECHNIQUES).map((id) => [id, 6])),
    spells: {},
    cantrips: [],
    liturgies: {},
    blessings: [],
    belongings: {
      items: {},
      purse: { d: "0", s: "0", h: "0", k: "0" },
    },
  };

  return {
    schemaVersion: 1,
    source: "manual",
    importedAt: createdAt,
    hero,
    runtime: createRuntimeState(hero),
  };
};

export const updateManualSpecies = (sheet: CharacterSheetState, speciesKey: ManualSpecies): void => {
  if (sheet.source !== "manual") return;
  const species = SPECIES_BY_KEY[speciesKey] ?? SPECIES_BY_KEY.human;
  const previousMax = sheet.runtime.resources.lp.max;
  const damage = Math.max(0, previousMax - sheet.runtime.resources.lp.current);
  sheet.hero.manual ??= { species: "human", magical: false };
  sheet.hero.manual.species = species.key;
  sheet.hero.r = species.id;
  if (species.automaticallyMagical) sheet.hero.manual.magical = true;
  const life = deriveLifePoints(sheet.hero);
  sheet.runtime.resources.lp = { current: Math.max(0, life.max - damage), max: life.max };
  if (heroIsMagicallyGifted(sheet.hero) && sheet.runtime.resources.ae.max === 0) {
    sheet.runtime.resources.ae = deriveAstralPoints(sheet.hero);
  }
};

export const updateManualMagic = (sheet: CharacterSheetState, magical: boolean): void => {
  if (sheet.source !== "manual") return;
  sheet.hero.manual ??= { species: "human", magical: false };
  sheet.hero.manual.magical = sheet.hero.manual.species === "elf" || magical;
  if (sheet.hero.manual.magical && sheet.runtime.resources.ae.max === 0) {
    sheet.runtime.resources.ae = deriveAstralPoints(sheet.hero);
  } else if (!sheet.hero.manual.magical) {
    sheet.runtime.resources.ae = emptyResource();
  }
};

export const refreshManualLifePoints = (sheet: CharacterSheetState): void => {
  if (sheet.source !== "manual") return;
  const previousMax = sheet.runtime.resources.lp.max;
  const damage = Math.max(0, previousMax - sheet.runtime.resources.lp.current);
  const life = deriveLifePoints(sheet.hero);
  sheet.runtime.resources.lp = { current: Math.max(0, life.max - damage), max: life.max };
};

const validateHero = (value: unknown): OptolithHero => {
  if (!isObject(value)) throw new HeroImportError("Die Datei enthält kein JSON-Objekt.");
  if (typeof value.name !== "string" || value.name.trim() === "") {
    throw new HeroImportError("Im Export fehlt der Name des Helden.");
  }
  if (typeof value.clientVersion !== "string") {
    throw new HeroImportError("Die Datei ist kein erkennbarer Optolith-Export.");
  }
  if (!isObject(value.attr) || !Array.isArray(value.attr.values)) {
    throw new HeroImportError("Im Optolith-Export fehlen die Eigenschaftswerte.");
  }
  if (!isObject(value.talents)) {
    throw new HeroImportError("Im Optolith-Export fehlen die Talente.");
  }
  if (typeof value.id !== "string") {
    throw new HeroImportError("Im Optolith-Export fehlt die Helden-ID.");
  }
  const hero = value as unknown as OptolithHero;
  const importedTalents = hero.talents;
  hero.talents = Object.fromEntries(
    TALENTS.map((definition) => [definition.id, asFiniteNumber(importedTalents[definition.id])]),
  );
  hero.spells = isObject(hero.spells)
    ? Object.fromEntries(Object.entries(hero.spells).map(([id, value]) => [id, asFiniteNumber(value)]))
    : {};
  hero.cantrips = Array.isArray(hero.cantrips)
    ? hero.cantrips.filter((id): id is string => typeof id === "string")
    : [];
  if (hero.manual) {
    const species = SPECIES_BY_KEY[hero.manual.species] ?? SPECIES_BY_ID[hero.r ?? ""] ?? SPECIES_BY_KEY.human;
    hero.manual = {
      species: species.key,
      magical: species.automaticallyMagical || Boolean(hero.manual.magical),
    };
    hero.r = species.id;
  }
  return hero;
};

const validateBackup = (value: Record<string, unknown>): CharacterSheetState | null => {
  if (value.schemaVersion !== 1 || (value.source !== "optolith" && value.source !== "manual")) return null;
  const source = value.source;
  const hero = validateHero(value.hero);
  if (source === "manual" && !hero.manual) {
    const species = SPECIES_BY_ID[hero.r ?? ""] ?? SPECIES_BY_KEY.human;
    hero.manual = {
      species: species.key,
      magical: species.automaticallyMagical
        || Object.keys(hero.spells ?? {}).length > 0
        || (hero.cantrips?.length ?? 0) > 0,
    };
    hero.r = species.id;
  }
  if (!isObject(value.runtime)) throw new HeroImportError("Der Owlbear-Spielstand ist beschädigt.");
  const fallback = createRuntimeState(hero);
  const runtime = value.runtime as unknown as Partial<RuntimeState>;
  return {
    schemaVersion: 1,
    source,
    importedAt: typeof value.importedAt === "string" ? value.importedAt : new Date().toISOString(),
    hero,
    runtime: {
      ...fallback,
      ...runtime,
      resources: {
        ...fallback.resources,
        ...(runtime.resources ?? {}),
      },
      favoriteTalentIds: Array.isArray(runtime.favoriteTalentIds)
        ? runtime.favoriteTalentIds.filter((id): id is string => typeof id === "string")
        : [],
      notes: typeof runtime.notes === "string" ? runtime.notes : "",
    },
  };
};

export const importHeroJson = (json: string): CharacterSheetState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json.replace(/^\uFEFF/, ""));
  } catch {
    throw new HeroImportError("Die Datei enthält kein gültiges JSON.");
  }

  if (isObject(parsed)) {
    const backup = validateBackup(parsed);
    if (backup) return backup;
  }

  const hero = validateHero(parsed);
  return {
    schemaVersion: 1,
    source: "optolith",
    importedAt: new Date().toISOString(),
    hero,
    runtime: createRuntimeState(hero),
  };
};

export const calculateInitiative = (hero: OptolithHero): number => {
  const attributes = getAttributeValues(hero);
  return Math.round((attributes.MU + attributes.GE) / 2);
};
