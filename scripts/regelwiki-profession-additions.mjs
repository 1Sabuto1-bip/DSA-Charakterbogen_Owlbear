// Mechanical profession packages which are already present in the current
// Regelwiki lists but not yet contained in the bundled DarkAid rule data.
// No rule prose is copied here.

const skills = (entries) => entries.map(([id, level]) => ({ id, level }));
const combat = (entries) => entries.map(([id, level]) => ({ id, level }));
const magic = (entries) => entries.map(([id, level]) => ({ id, level }));

const replaceLevels = (base, changes) => {
  const result = new Map(base.map((entry) => [entry.id, { ...entry }]));
  for (const [id, level] of changes) {
    if (level === 0) result.delete(id);
    else result.set(id, { id, level });
  }
  return [...result.values()];
};

const profession = (entry) => ({
  femaleName: entry.name,
  group: entry.category === "Zauberer" ? "zauberer" : entry.category === "Geweihte" ? "geweihte" : "kaempfer",
  requiredCultures: [],
  requiredAdvantages: [],
  requiredDisadvantages: [],
  skills: [],
  combat: [],
  combatChoices: [],
  spells: [],
  spellSelections: [],
  chants: [],
  blessings: [],
  specialAbilities: [],
  ...entry,
});

const variant = (base, id, name, ap, changes = {}) => profession({
  ...base,
  ...changes,
  id: `${base.id}:${id}`,
  baseId: base.id,
  variantId: id,
  name: `${base.name} – ${name}`,
  femaleName: `${base.femaleName} – ${name}`,
  ap,
});

const adoruSource = {
  sourceId: "fluestern-aus-dem-abgrund",
  sourceLabel: "Flüstern aus dem Abgrund",
  sourceShortLabel: "FdA",
};
const wolfsfrostSource = {
  sourceId: "helden-des-wolfsfrosts",
  sourceLabel: "Helden des Wolfsfrosts",
  sourceShortLabel: "HdW",
};
const goetterwirkenSource = {
  sourceId: "aventurischesgoetterwirken2",
  sourceLabel: "Aventurisches Götterwirken II",
  sourceShortLabel: "AG II",
};

const shindai = profession({
  id: "adoruschwertkaempfershindai",
  baseId: "adoruschwertkaempfershindai",
  name: "Adoru-Schwertkämpfer (Shindai)",
  femaleName: "Adoru-Schwertkämpferin (Shindai)",
  category: "Kämpfer",
  page: 115,
  ap: 297,
  ...adoruSource,
  skills: skills([
    ["koerperbeherrschung", 5], ["kraftakt", 5], ["selbstbeherrschung", 7], ["sinnesschaerfe", 5],
    ["einschuechtern", 4], ["etikette", 4], ["menschenkenntnis", 2], ["willenskraft", 3],
    ["faehrtensuchen", 2], ["orientierung", 2], ["wildnisleben", 2], ["goetterkulte", 2],
    ["kriegskunst", 6], ["rechnen", 3], ["rechtskunde", 3], ["sagenlegenden", 2],
    ["heilkundegift", 3], ["heilkundewunden", 4], ["metallbearbeitung", 3],
  ]),
  combat: combat([["dolche", 10], ["raufen", 10], ["schwerter", 12], ["zweihandhiebwaffen", 10], ["zweihandschwerter", 12]]),
  specialAbilities: ["Sprachen und Schriften (2 AP)", "Belastungsgewöhnung I", "Schnellziehen", "Vorstoß"],
  requiredDisadvantages: [{ id: "prinzipientreue", level: 2, variant: "Ehrenkodex der Shindai" }],
});

const adoruMagier = profession({
  id: "adorumagierdorukha",
  baseId: "adorumagierdorukha",
  name: "Adoru-Magier (Dorukha / Götterblut)",
  femaleName: "Adoru-Magierin (Dorukha / Götterblut)",
  category: "Zauberer",
  page: 116,
  ap: 317,
  ...adoruSource,
  magical: true,
  tradition: "Adoru-Magier",
  traditionCost: 155,
  primaryAttribute: "KL",
  requiredAdvantages: [{ id: "zauberer", level: 1, variant: "" }],
  skills: skills([
    ["koerperbeherrschung", 3], ["selbstbeherrschung", 4], ["sinnesschaerfe", 4], ["etikette", 6],
    ["menschenkenntnis", 4], ["verkleiden", 3], ["willenskraft", 4], ["orientierung", 1], ["tierkunde", 2],
    ["geschichtswissen", 5], ["goetterkulte", 4], ["magiekunde", 6], ["rechnen", 4], ["rechtskunde", 2],
    ["sagenlegenden", 3], ["sphaerenkunde", 4], ["alchimie", 6], ["heilkundegift", 1], ["malenzeichnen", 3],
    ["metallbearbeitung", 1], ["musizieren", 2], ["steinbearbeitung", 3],
  ]),
  combat: combat([["dolche", 8], ["hiebwaffen", 8]]),
  spells: magic([
    ["archofaxius", 7], ["archosphaero", 4], ["basaltleib", 2], ["brandform", 6],
    ["erhabenheitdesmarmors", 3], ["flammenwand", 6], ["manifesto", 8],
  ]),
  spellSelections: [{ id: "cantrip-0", count: 1, options: ["feuerspiel", "feuerfinger", "flammenhaar", "elementarling", "koerperpflege", "schminken", "schmutzabweisend", "steinempathie"] }],
  specialAbilities: ["Sprachen und Schriften (6 AP)", "Bindung des Adoru-Zepters"],
});

const klingensaengerin = profession({
  id: "klingensaengerindershakagra",
  baseId: "klingensaengerindershakagra",
  name: "Klingensänger der Shakagra",
  femaleName: "Klingensängerin der Shakagra",
  category: "Zauberer",
  page: 15,
  ap: 319,
  ...wolfsfrostSource,
  magical: true,
  tradition: "Nachtalben",
  traditionCost: 125,
  primaryAttribute: "MU",
  skills: skills([
    ["koerperbeherrschung", 4], ["selbstbeherrschung", 3], ["sinnesschaerfe", 5], ["einschuechtern", 4],
    ["willenskraft", 5], ["faehrtensuchen", 4], ["orientierung", 3], ["wildnisleben", 3],
    ["geschichtswissen", 3], ["goetterkulte", 3], ["magiekunde", 4], ["sagenlegenden", 6],
    ["holzbearbeitung", 4], ["musizieren", 5],
  ]),
  combat: combat([["boegen", 10], ["raufen", 10], ["schwerter", 12], ["stangenwaffen", 10]]),
  spells: magic([["attributokoerperkraft", 4], ["axxeleratus", 5], ["dunkelheit", 3], ["firnlauf", 4], ["fulminictus", 4], ["hoellenpein", 5], ["gletscherform", 3]]),
  spellSelections: [{ id: "cantrip-0", count: 1, options: ["eiskalterblick", "elfenhaar", "luftstoss", "trocken", "warmesblut"] }],
  specialAbilities: ["Sprachen und Schriften (8 AP)", "Finte I", "Schlachtlied 5"],
});

const zauberweber = profession({
  id: "zauberweberdershakagra",
  baseId: "zauberweberdershakagra",
  name: "Zauberweber der Shakagra",
  femaleName: "Zauberweberin der Shakagra",
  category: "Zauberer",
  page: 17,
  ap: 218,
  ...wolfsfrostSource,
  magical: true,
  tradition: "Nachtalben",
  traditionCost: 125,
  primaryAttribute: "MU",
  skills: skills([
    ["koerperbeherrschung", 2], ["selbstbeherrschung", 5], ["singen", 3], ["sinnesschaerfe", 3],
    ["einschuechtern", 4], ["willenskraft", 5], ["orientierung", 2], ["wildnisleben", 1],
    ["geschichtswissen", 5], ["goetterkulte", 3], ["magiekunde", 5], ["sagenlegenden", 6], ["musizieren", 5],
  ]),
  combat: combat([["dolche", 10]]),
  spells: magic([["analysarkanstruktur", 4], ["bannbaladin", 3], ["dunkelheit", 4], ["fulminictus", 3], ["horriphobus", 5], ["odemarcanum", 5], ["gletscherform", 3]]),
  spellSelections: [{ id: "cantrip-0", count: 1, options: ["eiskalterblick", "elfenhaar", "luftstoss", "trocken", "warmesblut"] }],
  specialAbilities: ["Sprachen und Schriften (8 AP)", "Sklavenlied 4"],
});

const tahayaschamanin = profession({
  id: "tahayaschamanin",
  baseId: "tahayaschamanin",
  name: "Tahayaschamane",
  femaleName: "Tahayaschamanin",
  category: "Geweihte",
  page: 129,
  ap: 316,
  ...goetterwirkenSource,
  blessed: true,
  tradition: "Tahayaschamanen",
  traditionCost: 100,
  primaryAttribute: "IN",
  requiredAdvantages: [{ id: "geweihter", level: 1, variant: "" }],
  requiredDisadvantages: [
    { id: "prinzipientreue", level: 1, variant: "Stammesregeln" },
    { id: "verpflichtungen", level: 2, variant: "Stamm" },
  ],
  skills: skills([
    ["koerperbeherrschung", 4], ["kraftakt", 4], ["selbstbeherrschung", 4], ["sinnesschaerfe", 4],
    ["bekehrenueberzeugen", 2], ["einschuechtern", 2], ["etikette", 4], ["menschenkenntnis", 4],
    ["willenskraft", 4], ["orientierung", 4], ["pflanzenkunde", 4], ["tierkunde", 4], ["wildnisleben", 4],
    ["geschichtswissen", 4], ["goetterkulte", 5], ["rechnen", 2], ["rechtskunde", 5], ["sagenlegenden", 6],
    ["heilkundekrankheiten", 4], ["heilkundeseele", 4], ["heilkundewunden", 3],
  ]),
  combat: combat([["hiebwaffen", 11], ["raufen", 10]]),
  chants: magic([["bannzone", 6], ["hauchdeselements", 5], ["jaguarruf", 5], ["ratderahnen", 7], ["tabuzone", 5]]),
  specialAbilities: ["Sprachen und Schriften (4 AP)"],
});

const ojomyaa = profession({
  id: "priesterindervierojomyaa",
  baseId: "priesterindervierojomyaa",
  name: "Priester der Vier (Ojomyaa)",
  femaleName: "Priesterin der Vier (Ojomyaa)",
  category: "Geweihte",
  page: 115,
  ap: 273,
  ...adoruSource,
  skills: skills([
    ["selbstbeherrschung", 8], ["sinnesschaerfe", 3], ["bekehrenueberzeugen", 6], ["etikette", 6],
    ["menschenkenntnis", 8], ["ueberreden", 4], ["willenskraft", 6], ["orientierung", 3], ["pflanzenkunde", 1],
    ["tierkunde", 1], ["geschichtswissen", 5], ["goetterkulte", 8], ["magiekunde", 4], ["rechnen", 4],
    ["rechtskunde", 4], ["sagenlegenden", 5], ["alchimie", 4], ["heilkundegift", 5],
    ["heilkundekrankheiten", 4], ["heilkundeseele", 5], ["metallbearbeitung", 3], ["steinbearbeitung", 3],
  ]),
  combat: combat([["dolche", 10], ["raufen", 10]]),
  specialAbilities: ["Sprachen und Schriften (4 AP)", "Fertigkeitsspezialisierung (Götter & Kulte)"],
  requiredDisadvantages: [
    { id: "prinzipientreue", level: 2, variant: "Kult der Vier" },
    { id: "verpflichtungen", level: 2, variant: "Tempel" },
  ],
});

export const regelwikiProfessionAdditions = [
  shindai,
  variant(shindai, "erz", "Erz-Shindai", 316, {
    skills: replaceLevels(shindai.skills, [["kraftakt", 7]]),
    specialAbilities: [...shindai.specialAbilities, "Wuchtschlag I"],
  }),
  variant(shindai, "feuer", "Feuer-Shindai", 320, {
    skills: replaceLevels(shindai.skills, [["koerperbeherrschung", 7]]),
    specialAbilities: [...shindai.specialAbilities, "Finte I"],
  }),
  adoruMagier,
  variant(adoruMagier, "humus", "Humus", 317, { spells: magic([["dornenwand", 6], ["eichenleib", 2], ["humofaxius", 7], ["humosphaero", 4], ["manifesto", 8], ["pflanzenform", 6], ["weisheitderbaeume", 3]]) }),
  variant(adoruMagier, "luft", "Luft", 317, { spells: magic([["federleib", 2], ["freiheitderwolken", 3], ["manifesto", 8], ["orcanofaxius", 7], ["orcanosphaero", 4], ["sturmwand", 6], ["wirbelform", 6]]) }),
  variant(adoruMagier, "wasser", "Wasser", 317, { spells: magic([["aquafaxius", 7], ["aquasphaero", 4], ["brandungsleib", 2], ["ergebenheitderwogen", 3], ["manifesto", 8], ["wellenwand", 6], ["wogenform", 6]]) }),
  klingensaengerin,
  variant(klingensaengerin, "eisgaenger", "Eisgänger", 303, {
    combat: replaceLevels(klingensaengerin.combat, [["boegen", 12], ["schwerter", 8]]),
    skills: replaceLevels(klingensaengerin.skills, [["einschuechtern", 0], ["verbergen", 4], ["tierkunde", 4], ["magiekunde", 2]]),
    spells: replaceLevels(klingensaengerin.spells, [["attributokoerperkraft", 0], ["fulminictus", 0], ["exposami", 5], ["falkenauge", 4]]),
    specialAbilities: ["Sprachen und Schriften (8 AP)", "Finte I", "Sturmlied 5"],
  }),
  variant(klingensaengerin, "schwarzertaenzer", "Schwarzer Tänzer", 302, {
    combat: replaceLevels(klingensaengerin.combat, [["boegen", 0], ["schwerter", 0], ["schilde", 10]]),
    combatChoices: [{ id: "kampfwaffe-0", count: 1, options: [{ id: "hiebwaffen", level: 12 }, { id: "zweihandhiebwaffen", level: 12 }] }],
  }),
  zauberweber,
  variant(zauberweber, "elementarist", "Elementarist", 212, {
    spells: replaceLevels(zauberweber.spells, [["analysarkanstruktur", 0], ["bannbaladin", 0], ["manifesto", 10], ["elementarerdiener", 5]]),
    specialAbilities: ["Sprachen und Schriften (8 AP)", "Sturmlied 4"],
  }),
  variant(zauberweber, "ruferderdiener", "Rufer der Diener", 220, {
    spells: replaceLevels(zauberweber.spells, [["analysarkanstruktur", 0], ["bannbaladin", 0], ["invocatiominima", 10], ["invocatiominor", 5]]),
    specialAbilities: ["Sprachen und Schriften (8 AP)", "Lied des Schmerzes 4"],
  }),
  tahayaschamanin,
  ojomyaa,
  variant(ojomyaa, "gyldaru", "Gyldaru-Verehrung", 281, { skills: replaceLevels(ojomyaa.skills, [["bekehrenueberzeugen", 8]]) }),
  variant(ojomyaa, "imaru", "Imaru-Verehrung", 291, { skills: replaceLevels(ojomyaa.skills, [["metallbearbeitung", 5]]), combat: [...ojomyaa.combat, { id: "zweihandschwerter", level: 10 }] }),
  variant(ojomyaa, "nanuru", "Nanuru-Verehrung", 289, { skills: replaceLevels(ojomyaa.skills, [["heilkundewunden", 3], ["heilkundegift", 7]]) }),
  variant(ojomyaa, "sindaru", "Sindaru-Verehrung", 279, { skills: replaceLevels(ojomyaa.skills, [["geschichtswissen", 7], ["rechtskunde", 6]]) }),
];

export const regelwikiProfessionSources = [adoruSource, wolfsfrostSource];

export const regelwikiCantripNames = {
  warmesblut: "Warmes Blut",
};

export const regelwikiChantNames = {
  ratderahnen: "Rat der Ahnen",
  tabuzone: "Tabuzone",
};
