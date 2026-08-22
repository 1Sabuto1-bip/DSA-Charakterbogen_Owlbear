import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(projectRoot, "../darkaid-source/src/rulesystems/dsa5aventurien");
const outputFile = path.resolve(projectRoot, "src/grw-character-data.ts");

const load = (file) => JSON.parse(fs.readFileSync(path.join(sourceRoot, file), "utf8")).data;
const sources = [
  { id: "regelwerk", directory: "", label: "Regelwerk (3. Auflage)", shortLabel: "GRW" },
  { id: "aventurischeskompendium", directory: "aventurischeskompendium", label: "Aventurisches Kompendium", shortLabel: "AKO" },
  { id: "aventurischemagie1", directory: "aventurischemagie1", label: "Aventurische Magie I", shortLabel: "AM I" },
  { id: "aventurischemagie2", directory: "aventurischemagie2", label: "Aventurische Magie II", shortLabel: "AM II" },
  { id: "aventurischemagie3", directory: "aventurischemagie3", label: "Aventurische Magie III", shortLabel: "AM III" },
];
const sourcePath = (source, file) => path.join(source.directory, file);
const hasSourceFile = (source, file) => fs.existsSync(path.join(sourceRoot, sourcePath(source, file)));
const loadSource = (source, file) => hasSourceFile(source, file) ? load(sourcePath(source, file)) : [];
const pageNumber = (value) => {
  const values = (Array.isArray(value) ? value : [value]).map(Number).filter(Number.isFinite);
  return values.at(-1) ?? 0;
};
const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

const skillCosts = Object.fromEntries(load("skills.json").map((entry) => [entry.id, entry.ic]));
const improvementBase = { A: 1, B: 2, C: 3, D: 4 };

const cultureCost = (entries = []) => entries.reduce(
  (sum, entry) => sum + (improvementBase[skillCosts[entry.ruleelement]] ?? 0) * Number(entry.level ?? 0),
  0,
);

const cleanTrait = (entry) => {
  const variants = Array.isArray(entry.variants?.variantlist)
    ? entry.variants.variantlist.map((variant) => typeof variant === "string"
      ? { name: variant }
      : { name: variant.text ?? variant.name ?? "Auswahl", ...(Number.isFinite(variant.apcost) ? { cost: Math.abs(variant.apcost) } : {}) })
    : [];
  const cost = entry.cost;
  const numericCost = typeof cost === "number"
    ? Math.abs(cost)
    : cost?.type === "highest" && Number.isFinite(cost.ap)
      ? Math.abs(cost.ap)
      : undefined;
  return {
    id: entry.id,
    name: entry.name,
    page: Number(entry.page),
    maxLevel: Number(entry.maxlevel ?? 1),
    ...(numericCost === undefined ? { variableCost: true } : { costPerLevel: numericCost }),
    ...(variants.length ? { variants } : {}),
  };
};

const mergeBy = (base = [], variant = [], key) => {
  const result = new Map();
  for (const entry of base) {
    const id = entry[key];
    if (id) result.set(id, { ...entry });
  }
  for (const entry of variant) {
    const id = entry[key];
    if (!id) continue;
    if (Number(entry.level) === 0) result.delete(id);
    else result.set(id, { ...(result.get(id) ?? {}), ...entry });
  }
  return [...result.values()];
};

const replaceOrAppendSelections = (base = [], variant = [], type) => {
  const directBase = base.filter((entry) => entry.type !== type && entry.type !== "no");
  const baseSelections = base.filter((entry) => entry.type === type);
  const variantDirect = variant.filter((entry) => entry.type !== type && entry.type !== "no");
  const variantSelections = variant.filter((entry) => entry.type === type);
  const removesSelection = variant.some((entry) => entry.type === "no" || entry.replaces);
  return [
    ...directBase,
    ...(removesSelection || variantSelections.length ? [] : baseSelections),
    ...variantDirect,
    ...variantSelections,
  ];
};

const specialAbilityFiles = {
  "spab-general.json": "Allgemein",
  "spab-combat.json": "Kampf",
  "spab-combatextended.json": "Erweiterter Kampf",
  "spab-commands.json": "Befehle",
  "spab-fatepoints.json": "Schicksalspunkte",
  "spab-fightingstyles.json": "Kampfstile",
  "spab-magical.json": "Magie",
  "spab-magicalextended.json": "Erweiterte Magie",
  "spab-praegung.json": "Prägungen",
  "spab-spellstyles.json": "Zauberstile",
  "spab-karma.json": "Karma",
};
const allSpecialAbilities = sources.flatMap((source) => Object.entries(specialAbilityFiles).flatMap(([file, category]) =>
  loadSource(source, file).map((entry) => ({ ...entry, source, category }))));
const specialAbilityNames = Object.fromEntries(allSpecialAbilities.map((entry) => [entry.id, entry.name]));
const skillNames = Object.fromEntries(load("skills.json").map((entry) => [entry.id, entry.name]));

const specialAbilityLabel = (entry) => {
  if (entry.type === "appoolabilityapsum") return `Sprachen und Schriften (${entry.apvalue ?? 0} AP)`;
  if (entry.type === "skillspecialization") return `Fertigkeitsspezialisierung (${skillNames[entry.skill] ?? entry.skill ?? "Auswahl"})`;
  if (entry.specialability) {
    const base = specialAbilityNames[entry.specialability] ?? entry.specialability;
    return `${base}${entry.level ? ` ${entry.level}` : ""}`;
  }
  if (entry.description) return entry.description.replace(/<[^>]+>/g, "");
  return "Wahl aus dem Professionspaket";
};

const attributeCodes = {
  mut: "MU", klugheit: "KL", intuition: "IN", charisma: "CH",
  fingerfertigkeit: "FF", gewandtheit: "GE", konstitution: "KO", koerperkraft: "KK",
};

const traditionData = new Map();
for (const source of sources) {
  for (const entry of loadSource(source, "magicaltraditions.json")) {
    const previous = traditionData.get(entry.id) ?? {};
    traditionData.set(entry.id, {
      ...entry,
      ...previous,
      sourceId: previous.sourceId ?? source.id,
      sourceLabel: previous.sourceLabel ?? source.label,
    });
  }
}

const professionTraditionId = (profession) => profession.prerequisites?.find((entry) =>
  entry.type === "specialability" && entry.specialabilitysignatures?.ruleelement === "magischetradition")
  ?.specialabilitysignatures?.variant?.id?.id;

const professionExtras = (profession) => {
  const traditionId = professionTraditionId(profession);
  const tradition = traditionData.get(traditionId);
  if (tradition?.name) {
    const primary = tradition.specialrules?.find((entry) => entry.type === "primaryattribute")?.attribute;
    return {
      magical: true,
      tradition: tradition.name,
      traditionId,
      traditionCost: Number(tradition.cost ?? 0),
      ...(primary ? { primaryAttribute: attributeCodes[primary] ?? "IN" } : {}),
    };
  }
  const group = profession.group;
  if (group === "elfen") return { magical: true, tradition: "Elfen", traditionCost: 125, primaryAttribute: "IN" };
  if (group === "hexer") return { magical: true, tradition: "Hexen", traditionCost: 135, primaryAttribute: "CH" };
  if (["gildenlos", "grauegilde", "schwarzegilde", "weissegilde"].includes(group)) {
    return { magical: true, tradition: "Gildenmagier", traditionCost: 155, primaryAttribute: "KL" };
  }
  if (profession.id === "borongeweihter") return { blessed: true, tradition: "Boronkirche", traditionCost: 130, primaryAttribute: "IN" };
  if (profession.id === "hesindegeweihter") return { blessed: true, tradition: "Hesindekirche", traditionCost: 130, primaryAttribute: "KL" };
  if (profession.id === "perainegeweihter") return { blessed: true, tradition: "Perainekirche", traditionCost: 110, primaryAttribute: "IN" };
  if (profession.id === "phexgeweihter") return { blessed: true, tradition: "Phexkirche", traditionCost: 150, primaryAttribute: "IN" };
  if (profession.id === "praiosgeweihter") return { blessed: true, tradition: "Praioskirche", traditionCost: 130, primaryAttribute: "KL" };
  if (profession.id === "rondrageweihter") return { blessed: true, tradition: "Rondrakirche", traditionCost: 150, primaryAttribute: "MU" };
  return {};
};

const cleanProfession = (profession, variant, source) => {
  const prerequisites = [...asArray(profession.prerequisites), ...asArray(variant?.prerequisites)];
  const requiredCultures = [...new Set(prerequisites.flatMap((entry) => {
    const value = entry.cultures;
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }))];
  const rawRequiredSex = prerequisites.find((entry) => entry.type === "sex")?.sex;
  const requiredSex = rawRequiredSex === "male" ? "m" : rawRequiredSex === "female" ? "f" : rawRequiredSex;
  const skills = mergeBy(profession.skills, variant?.skills, "skill")
    .map((entry) => ({ id: entry.skill, level: Number(entry.level ?? 0) }));
  const combatEntries = replaceOrAppendSelections(
    profession.combattechniques,
    variant?.combattechniques,
    "combattechniqueselectionbonus",
  );
  const combat = combatEntries.filter((entry) => entry.combattechnique)
    .map((entry) => ({ id: entry.combattechnique, level: Number(entry.level ?? 6) }));
  const combatChoices = combatEntries.filter((entry) => entry.type === "combattechniqueselectionbonus")
    .map((entry, index) => ({
      id: `combat-${index}`,
      count: Number(entry.count ?? 1),
      options: (entry.combattechniques ?? []).map((option) => ({ id: option.ruleelement, level: Number(option.level ?? 6) })),
    }));
  const spells = mergeBy(profession.spells, variant?.spells, "spell")
    .map((entry) => ({ id: entry.spell, level: Number(entry.level ?? 0) }));
  const spellSelections = replaceOrAppendSelections(profession.spells, variant?.spells, "spellselectionbonus")
    .filter((entry) => entry.type === "spellselectionbonus")
    .map((entry, index) => ({ id: `cantrip-${index}`, count: Number(entry.count ?? 1), options: entry.spells ?? [] }));
  const chants = mergeBy(profession.chants, variant?.chants, "chant")
    .map((entry) => ({ id: entry.chant, level: Number(entry.level ?? 0) }));
  const blessings = replaceOrAppendSelections(profession.chants, variant?.chants, "chantvaluepackage")
    .filter((entry) => entry.type === "chantvaluepackage")
    .flatMap((entry) => entry.chants ?? []);
  const specialAbilities = [...(profession.specialabilities ?? []), ...(variant?.specialabilities ?? [])]
    .filter((entry) => entry.type !== "no")
    .map(specialAbilityLabel);
  const name = variant
    ? `${profession.namemale ?? profession.namefemale} – ${variant.namemale ?? variant.namefemale ?? variant.id}`
    : profession.namemale ?? profession.namefemale;
  return {
    id: variant ? `${profession.id}:${variant.id}` : profession.id,
    baseId: profession.id,
    ...(variant ? { variantId: variant.id } : {}),
    name,
    femaleName: variant?.namefemale ?? profession.namefemale ?? name,
    group: profession.group,
    page: pageNumber(profession.page),
    sourceId: source.id,
    sourceLabel: source.label,
    sourceShortLabel: source.shortLabel,
    requiredCultures,
    ...(requiredSex ? { requiredSex } : {}),
    ap: Number(variant?.apvalue ?? profession.apvalue),
    skills,
    combat,
    combatChoices,
    spells,
    spellSelections,
    chants,
    blessings: [...new Set(blessings)],
    specialAbilities: [...new Set(specialAbilities)],
    ...professionExtras(profession),
  };
};

const speciesCosts = { menschen: 0, halbelfen: 0, elfen: 18, zwerge: 61 };
const automaticTraits = {
  elfen: [
    { id: "zauberer", name: "Zauberer" },
    { id: "zweistimmigergesang", name: "Zweistimmiger Gesang" },
  ],
};

const species = load("species.json").map((entry) => ({
  id: entry.id,
  name: entry.name,
  page: Number(entry.page),
  ap: speciesCosts[entry.id] ?? 0,
  baseValues: Object.fromEntries((entry.basevalues ?? []).map((value) => [value.basevalue, Number(value.level)])),
  attributeMaximums: entry.attributemaximums ?? [],
  automaticTraits: automaticTraits[entry.id] ?? [],
}));

const races = load("speciesraces.json").map((entry) => ({
  id: entry.id,
  name: entry.name,
  speciesId: entry.species,
  page: Number(entry.page),
  commonCultures: entry.commoncultures ?? [],
}));

const cultures = load("cultures.json").map((entry) => ({
  id: entry.id,
  name: entry.name,
  page: Number(entry.page),
  packageAp: cultureCost(entry.culturalpackage),
  packageSkills: (entry.culturalpackage ?? []).map((value) => ({ id: value.ruleelement, level: Number(value.level) })),
  language: entry.languages?.variant?.text ?? entry.languages?.variant?.id?.id ?? "",
  script: entry.scripts?.variant?.id?.id ?? "",
}));

const cultureData = sources.flatMap((source) => loadSource(source, "cultures.json").map((entry) => ({
  id: entry.id,
  name: entry.name,
  page: pageNumber(entry.page),
  sourceId: source.id,
  sourceLabel: source.label,
  sourceShortLabel: source.shortLabel,
  packageAp: cultureCost(entry.culturalpackage),
  packageSkills: (entry.culturalpackage ?? []).map((value) => ({ id: value.ruleelement, level: Number(value.level) })),
  language: entry.languages?.variant?.text ?? entry.languages?.variant?.id?.id ?? "",
  script: entry.scripts?.variant?.id?.id ?? "",
})));

const professionData = sources.flatMap((source) => loadSource(source, "professions.json")
  .filter((entry) => Number.isFinite(entry.apvalue) && (entry.namemale || entry.namefemale))
  .flatMap((entry) => [cleanProfession(entry, undefined, source), ...(entry.variants ?? []).filter((variant) => Number.isFinite(variant.apvalue)).map((variant) => cleanProfession(entry, variant, source))]));

const traitEntries = [];
for (const source of sources) {
  for (const file of ["advantages.json", "disadvantages.json"]) {
    for (const entry of loadSource(source, file)) {
      const explicitGroup = entry.group === "vorteile" ? "advantage" : entry.group === "nachteile" ? "disadvantage" : undefined;
      const kind = explicitGroup ?? (file === "advantages.json" ? "advantage" : "disadvantage");
      if (!entry.name || entry.cost === undefined) continue;
      traitEntries.push({ ...cleanTrait(entry), kind, sourceId: source.id, sourceLabel: source.label, sourceShortLabel: source.shortLabel });
    }
  }
}
const traitMap = new Map();
for (const entry of traitEntries) {
  const key = `${entry.kind}:${entry.id}`;
  if (!traitMap.has(key)) traitMap.set(key, entry);
}
const advantages = [...traitMap.values()].filter((entry) => entry.kind === "advantage").sort((a, b) => a.name.localeCompare(b.name, "de"));
const disadvantages = [...traitMap.values()].filter((entry) => entry.kind === "disadvantage").sort((a, b) => a.name.localeCompare(b.name, "de"));

const cleanSpecialAbility = (entry) => {
  const numericCost = typeof entry.cost === "number" ? Math.abs(entry.cost) : undefined;
  const suggestedCost = typeof entry.cost === "object" && Number.isFinite(entry.cost?.ap) ? Math.abs(entry.cost.ap) : undefined;
  return {
    id: entry.id,
    name: entry.name,
    page: pageNumber(entry.page),
    sourceId: entry.source.id,
    sourceLabel: entry.source.label,
    sourceShortLabel: entry.source.shortLabel,
    category: entry.category,
    maxLevel: Number(entry.maxlevel ?? 1),
    ...(numericCost === undefined ? { variableCost: true, ...(suggestedCost ? { suggestedCost } : {}) } : { costPerLevel: numericCost }),
  };
};
const specialAbilityMap = new Map();
for (const entry of allSpecialAbilities) {
  if (!entry.id || !entry.name) continue;
  if (!specialAbilityMap.has(entry.id)) specialAbilityMap.set(entry.id, cleanSpecialAbility(entry));
}
const specialAbilities = [...specialAbilityMap.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));

const mergeNameCatalog = (file) => Object.fromEntries(sources.flatMap((source) => loadSource(source, file)).map((entry) => [entry.id, entry.name]));

const data = {
  sources,
  experiences: load("experiencelevels.json"),
  species,
  races,
  cultures: cultureData,
  professions: professionData,
  advantages,
  disadvantages,
  specialAbilities,
  skillIds: Object.fromEntries(load("skills.json").map((entry, index) => [entry.id, `TAL_${index + 1}`])),
  combatIds: Object.fromEntries(load("combattechniques.json").map((entry, index) => [entry.id, `CT_${index + 1}`])),
  cantripNames: mergeNameCatalog("spells-cantrips.json"),
  chantNames: Object.fromEntries(load("chants.json").map((entry) => [entry.id, entry.name])),
  blessingNames: Object.fromEntries(load("chants-blessings.json").map((entry) => [entry.id, entry.name])),
};

const output = `// Generated from structured DarkAid data and checked against the supplied DSA5 rulebooks.\n// Sources: core rulebook (third edition), Aventurisches Kompendium, Aventurische Magie I-III.\n// Do not add rule prose here; this module contains only names and mechanical package data.\n\nexport const GRW_CHARACTER_DATA = ${JSON.stringify(data, null, 2)} as const;\n`;
fs.writeFileSync(outputFile, output);
console.log(`Wrote ${path.relative(projectRoot, outputFile)} (${professionData.length} profession packages, ${advantages.length} advantages, ${disadvantages.length} disadvantages, ${specialAbilities.length} special abilities).`);
