import { ATTRIBUTE_BY_ID } from "./data";
import type {
  AttributeCode,
  CharacterSheetState,
  OptolithHero,
  ResourceValue,
  RuntimeState,
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

  // Optolith R_1 is the human species. Other species use their own base value;
  // until their database labels are bundled, five is a safe editable default.
  const speciesBase = 5;
  const max = Math.max(1, speciesBase + attributes.KO * 2 + purchased - permanentLost);
  return { current: max, max };
};

const emptyResource = (): ResourceValue => ({ current: 0, max: 0 });

export const createRuntimeState = (hero: OptolithHero): RuntimeState => ({
  resources: {
    lp: deriveLifePoints(hero),
    ae: emptyResource(),
    kp: emptyResource(),
    fate: { current: 3, max: 3 },
  },
  notes: "",
  favoriteTalentIds: [],
});

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
  return value as unknown as OptolithHero;
};

const validateBackup = (value: Record<string, unknown>): CharacterSheetState | null => {
  if (value.schemaVersion !== 1 || value.source !== "optolith") return null;
  const hero = validateHero(value.hero);
  if (!isObject(value.runtime)) throw new HeroImportError("Der Owlbear-Spielstand ist beschädigt.");
  const fallback = createRuntimeState(hero);
  const runtime = value.runtime as unknown as Partial<RuntimeState>;
  return {
    schemaVersion: 1,
    source: "optolith",
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
