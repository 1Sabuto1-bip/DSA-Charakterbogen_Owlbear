import {
  GENERATOR_STEPS,
  GRW_ADVANTAGES,
  GRW_CULTURES,
  GRW_DISADVANTAGES,
  GRW_EXPERIENCES,
  GRW_PROFESSIONS,
  GRW_RACES,
  GRW_SPECIAL_ABILITIES,
  buildGeneratedCharacter,
  calculateGeneratorBalance,
  createGeneratorDraft,
  generatorCantripName,
  generatorCombatChoiceName,
  generatorProfessionSummary,
  generatorSpecialAbilityCost,
  generatorTraitCost,
  getGeneratorAttributeMaximum,
  getGeneratorCulture,
  getGeneratorExperience,
  getGeneratorProfession,
  getGeneratorRace,
  getGeneratorSpecies,
  getGeneratorSpecialAbilityDefinition,
  getGeneratorTraitDefinition,
  getRequiredProfessionComponents,
  normalizeGeneratorDraft,
  validateGeneratorDraft,
} from "./character-generator";
import { ATTRIBUTES } from "./data";
import type { CharacterSheetState } from "./types";
import type { GeneratorDraft, GeneratorSpecialAbilitySelection, GeneratorTraitKind, GeneratorTraitSelection } from "./character-generator";

const STORAGE_KEY = "de.alexander-hoffmann.dsa5-sheet/generator-draft/v1";

const escapeHtml = (value: unknown): string => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizeSearch = (value: string): string => value
  .toLocaleLowerCase("de")
  .replaceAll("ä", "ae")
  .replaceAll("ö", "oe")
  .replaceAll("ü", "ue")
  .replaceAll("ß", "ss")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim();

const loadDraft = (): GeneratorDraft => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<GeneratorDraft> | null;
    if (!parsed || typeof parsed !== "object") return createGeneratorDraft();
    const fallback = createGeneratorDraft();
    const draft = {
      ...fallback,
      ...parsed,
      attributes: { ...fallback.attributes, ...(parsed.attributes ?? {}) },
      combatChoices: parsed.combatChoices ?? {},
      spellChoices: parsed.spellChoices ?? {},
      advantages: Array.isArray(parsed.advantages) ? parsed.advantages : [],
      disadvantages: Array.isArray(parsed.disadvantages) ? parsed.disadvantages : [],
      specialAbilities: Array.isArray(parsed.specialAbilities) ? parsed.specialAbilities : [],
    } as GeneratorDraft;
    normalizeGeneratorDraft(draft);
    return draft;
  } catch {
    return createGeneratorDraft();
  }
};

const selectedTraitCost = (kind: GeneratorTraitKind, entry: GeneratorTraitSelection): number =>
  Math.abs(generatorTraitCost(kind, entry));

export interface CharacterGeneratorCallbacks {
  refresh: () => void;
  cancel: () => void;
  complete: (sheet: CharacterSheetState) => void;
  notify: (message: string, kind?: "success" | "error") => void;
}

export class CharacterGeneratorUI {
  draft = loadDraft();
  professionSearch = "";
  advantageSearch = "";
  disadvantageSearch = "";
  specialAbilitySearch = "";
  professionSource = "all";
  specialAbilitySource = "all";
  specialAbilityCategory = "all";

  reset(): void {
    this.draft = createGeneratorDraft();
    this.professionSearch = "";
    this.advantageSearch = "";
    this.disadvantageSearch = "";
    this.specialAbilitySearch = "";
    this.professionSource = "all";
    this.specialAbilitySource = "all";
    this.specialAbilityCategory = "all";
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.draft));
  }

  private renderBalance(): string {
    const balance = calculateGeneratorBalance(this.draft);
    const remainingClass = balance.remaining < 0 ? "generator-balance--error" : balance.remaining <= 10 ? "generator-balance--ok" : "generator-balance--open";
    return `<aside class="generator-balance ${remainingClass}">
      <p class="eyebrow">AP-Konto</p>
      <strong>${balance.remaining}</strong><span>von ${balance.budget} AP übrig</span>
      <dl>
        <div><dt>Spezies</dt><dd>−${balance.species}</dd></div>
        <div><dt>Eigenschaften</dt><dd>−${balance.attributes}</dd></div>
        <div><dt>Kulturpaket</dt><dd>−${balance.culture}</dd></div>
        <div><dt>Profession</dt><dd>−${balance.profession}</dd></div>
        ${balance.tradition ? `<div><dt>Tradition</dt><dd>−${balance.tradition}</dd></div>` : ""}
        <div><dt>Vorteile</dt><dd>−${balance.requiredAdvantages + balance.advantages}</dd></div>
        <div><dt>Nachteile</dt><dd>+${Math.abs(balance.requiredDisadvantages + balance.disadvantages)}</dd></div>
        ${balance.specialAbilities ? `<div><dt>Sonderfertigkeiten</dt><dd>−${balance.specialAbilities}</dd></div>` : ""}
      </dl>
      <small>Grenzen: Vorteile ${balance.advantageLimit}/80 · Nachteile ${balance.disadvantageLimit}/80</small>
    </aside>`;
  }

  private renderConcept(): string {
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 1</p><h2>Was möchtest du spielen?</h2>
      <p class="generator-lead">Lege zuerst Name und Grundidee fest. Alles bleibt als Entwurf in diesem Browser gespeichert.</p>
      <div class="generator-form-grid">
        <label class="generator-field generator-field--wide"><span>Name des Helden</span><input id="generator-name" type="text" maxlength="80" value="${escapeHtml(this.draft.name)}" placeholder="z. B. Arbosch Sohn des Angrax" /></label>
        <label class="generator-field"><span>Geschlecht / Anrede</span><select id="generator-sex">
          <option value="d" ${this.draft.sex === "d" ? "selected" : ""}>neutral / selbst festlegen</option>
          <option value="m" ${this.draft.sex === "m" ? "selected" : ""}>männlich</option>
          <option value="f" ${this.draft.sex === "f" ? "selected" : ""}>weiblich</option>
        </select></label>
        <label class="generator-field generator-field--wide"><span>Konzept und Motivation</span><textarea id="generator-concept" rows="7" placeholder="Herkunft, Ziele, Stärken, Schwächen …">${escapeHtml(this.draft.concept)}</textarea></label>
      </div>
      <div class="generator-rule-note"><strong>Regelgrundlage</strong><span>DSA5 Regelwerk (3. Auflage), Aventurisches Kompendium und Aventurische Magie I–III</span></div>
    </section>`;
  }

  private renderExperience(): string {
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 2</p><h2>Erfahrungsgrad wählen</h2>
      <p class="generator-lead">Der Erfahrungsgrad bestimmt AP-Guthaben und alle Höchstwerte während der Erschaffung.</p>
      <div class="experience-card-grid">${GRW_EXPERIENCES.map((entry) => `<label class="experience-card ${entry.id === this.draft.experienceId ? "experience-card--selected" : ""}">
        <input data-generator-experience type="radio" name="generator-experience" value="${entry.id}" ${entry.id === this.draft.experienceId ? "checked" : ""} />
        <strong>${entry.name}</strong><span>${entry.ap} AP</span>
        <small>Eigenschaften max. ${entry.attributemaximum} · Summe ${entry.attributemaximumsum}<br />Talente ${entry.skillmaximum} · Kampf ${entry.combattechniquemaximum}<br />Zauber/Liturgien ${entry.maxnumberofspellsliturgies}</small>
      </label>`).join("")}</div>
    </section>`;
  }

  private renderOrigin(): string {
    const race = getGeneratorRace(this.draft);
    const species = getGeneratorSpecies(this.draft);
    const culture = getGeneratorCulture(this.draft);
    const common = new Set(race.commonCultures);
    const positiveChoice = species.id === "menschen" || species.id === "halbelfen";
    const negativeOptions = species.id === "elfen" ? ["KL", "KK"] : species.id === "zwerge" ? ["CH", "GE"] : [];
    return `<section class="generator-page">
      <p class="eyebrow">Schritte 3–4</p><h2>Spezies, Herkunft und Kultur</h2>
      <div class="generator-form-grid">
        <label class="generator-field"><span>Herkunft / Variante</span><select id="generator-race">${GRW_RACES.map((entry) => `<option value="${entry.id}" ${entry.id === race.id ? "selected" : ""}>${entry.name} · ${getSpeciesName(entry.speciesId)}</option>`).join("")}</select></label>
        <label class="generator-field"><span>Kultur</span><select id="generator-culture">${GRW_CULTURES.map((entry) => `<option value="${entry.id}" ${entry.id === culture.id ? "selected" : ""}>${entry.name} · ${entry.sourceShortLabel}${common.has(entry.id as never) ? " · üblich" : ""}</option>`).join("")}</select></label>
        ${positiveChoice ? `<label class="generator-field"><span>Erhöhtes Eigenschaftsmaximum (+1)</span><select id="generator-positive-attribute">${ATTRIBUTES.map((entry) => `<option value="${entry.code}" ${entry.code === this.draft.positiveAttribute ? "selected" : ""}>${entry.code} · ${entry.name}</option>`).join("")}</select></label>` : ""}
        ${negativeOptions.length ? `<label class="generator-field"><span>Gesenktes Eigenschaftsmaximum (−2)</span><select id="generator-negative-attribute">${negativeOptions.map((code) => { const attribute = ATTRIBUTES.find((entry) => entry.code === code); return `<option value="${code}" ${code === this.draft.negativeAttribute ? "selected" : ""}>${code} · ${attribute?.name}</option>`; }).join("")}</select></label>` : ""}
      </div>
      <div class="origin-summary-grid">
        <article class="generator-summary-card"><span>Speziespaket</span><strong>${species.name}</strong><small>${species.ap} AP · LeP-Grundwert ${species.baseValues.lebensenergie} · SK ${species.baseValues.seelenkraft} · ZK ${species.baseValues.zaehigkeit} · GS ${species.baseValues.geschwindigkeit}</small></article>
        <article class="generator-summary-card"><span>Kulturpaket</span><strong>${culture.name}</strong><small>${culture.packageAp} AP · ${culture.packageSkills.length} Talentboni${culture.language ? ` · ${escapeHtml(culture.language)}` : ""}</small><label class="generator-inline-toggle"><input id="generator-culture-package" type="checkbox" ${this.draft.useCulturePackage ? "checked" : ""} /><span>Paket übernehmen</span></label></article>
      </div>
      ${species.automaticTraits.length ? `<div class="generator-rule-note"><strong>Automatisch enthalten</strong><span>${species.automaticTraits.map((entry) => entry.name).join(", ")}</span></div>` : ""}
      ${!common.has(culture.id as never) ? `<div class="generator-warning">Diese Kultur ist für ${race.name} unüblich. Das ist möglich, sollte aber mit dem GM abgestimmt werden.</div>` : ""}
    </section>`;
  }

  private renderAttributes(): string {
    const experience = getGeneratorExperience(this.draft);
    const sum = Object.values(this.draft.attributes).reduce((total, value) => total + value, 0);
    const cost = calculateGeneratorBalance(this.draft).attributes;
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 5</p><h2>Eigenschaftspunkte verteilen</h2>
      <p class="generator-lead">Alle Eigenschaften beginnen bei 8. Bis 14 kostet jeder weitere Punkt 15 AP; darüber steigen die Kosten.</p>
      <div class="generator-attribute-grid">${ATTRIBUTES.map((entry) => {
        const maximum = getGeneratorAttributeMaximum(this.draft, entry.code);
        return `<article class="generator-attribute-card"><span>${entry.code}</span><strong>${entry.name}</strong><div><button data-generator-attribute="${entry.code}" data-delta="-1" ${this.draft.attributes[entry.code] <= 8 ? "disabled" : ""}>−</button><input data-generator-attribute-input="${entry.code}" type="number" min="8" max="${maximum}" value="${this.draft.attributes[entry.code]}" /><button data-generator-attribute="${entry.code}" data-delta="1" ${this.draft.attributes[entry.code] >= maximum || sum >= experience.attributemaximumsum ? "disabled" : ""}>+</button></div><small>Maximum ${maximum}</small></article>`;
      }).join("")}</div>
      <div class="attribute-total ${sum > experience.attributemaximumsum ? "attribute-total--error" : ""}"><span>Eigenschaftssumme</span><strong>${sum} / ${experience.attributemaximumsum}</strong><span>${cost} AP</span></div>
    </section>`;
  }

  private renderProfession(): string {
    const profession = getGeneratorProfession(this.draft);
    const search = normalizeSearch(this.professionSearch);
    const filtered = GRW_PROFESSIONS.filter((entry) => (this.professionSource === "all" || entry.sourceId === this.professionSource)
      && (!search || normalizeSearch(`${entry.name} ${entry.femaleName} ${entry.group} ${entry.sourceLabel}`).includes(search))).slice(0, 40);
    const professionSources = [...new Map(GRW_PROFESSIONS.map((entry) => [entry.sourceId, { id: entry.sourceId, label: entry.sourceLabel }])).values()];
    const required = getRequiredProfessionComponents(this.draft);
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 6</p><h2>Profession wählen</h2>
      <p class="generator-lead">${GRW_PROFESSIONS.length} Professionspakete und Varianten aus allen fünf eingebundenen Regelbänden sind enthalten.</p>
      <div class="generator-filter-row"><label class="generator-search"><span>Profession suchen</span><input id="generator-profession-search" type="search" value="${escapeHtml(this.professionSearch)}" placeholder="z. B. Geode, Schwertgeselle, Hexe …" /></label><label class="generator-field"><span>Quelle</span><select id="generator-profession-source"><option value="all">Alle Regelbände</option>${professionSources.map((entry) => `<option value="${entry.id}" ${this.professionSource === entry.id ? "selected" : ""}>${entry.label}</option>`).join("")}</select></label></div>
      <div class="profession-layout">
        <div class="profession-list">${filtered.map((entry) => `<label class="profession-option ${entry.id === profession.id ? "profession-option--selected" : ""}"><input data-generator-profession type="radio" name="generator-profession" value="${entry.id}" ${entry.id === profession.id ? "checked" : ""} /><span><strong>${escapeHtml(this.draft.sex === "f" ? entry.femaleName : entry.name)}</strong><small>${generatorProfessionSummary(entry)}</small></span></label>`).join("") || `<div class="empty-state">Keine Profession gefunden.</div>`}</div>
        <article class="profession-detail">
          <p class="eyebrow">Ausgewählt</p><h3>${escapeHtml(this.draft.sex === "f" ? profession.femaleName : profession.name)}</h3>
          <p>${generatorProfessionSummary(profession)} · S. ${profession.page}</p>
          ${profession.requiredCultures.length ? `<div><strong>Kulturvoraussetzung</strong><span>${profession.requiredCultures.map((id) => GRW_CULTURES.find((entry) => entry.id === id)?.name ?? id).join(", ")}</span></div>` : ""}
          ${required.advantages.length ? `<div><strong>Pflichtvorteil</strong><span>${required.advantages.map((entry) => `${entry.name} (${entry.cost} AP)`).join(", ")}</span></div>` : ""}
          ${required.tradition ? `<div><strong>Pflicht-Sonderfertigkeit</strong><span>${required.tradition.name} (${required.tradition.cost} AP)</span></div>` : ""}
          ${required.disadvantages.length ? `<div><strong>Pflichtnachteile</strong><span>${required.disadvantages.map((entry) => `${entry.name} ${entry.level} (${entry.cost} AP)`).join(", ")}</span></div>` : ""}
          ${profession.combatChoices.map((choice) => `<fieldset class="generator-choice"><legend>${choice.count} Kampftechnik${choice.count === 1 ? "" : "en"} wählen</legend>${choice.options.map((option) => { const key = `${profession.id}:${choice.id}`; const checked = (this.draft.combatChoices[key] ?? []).includes(option.id); return `<label><input data-generator-combat-choice="${key}" data-limit="${choice.count}" type="checkbox" value="${option.id}" ${checked ? "checked" : ""} /><span>${generatorCombatChoiceName(option.id)} ${option.level}</span></label>`; }).join("")}</fieldset>`).join("")}
          ${profession.spellSelections.map((choice) => `<fieldset class="generator-choice"><legend>${choice.count} Zaubertrick${choice.count === 1 ? "" : "s"} wählen</legend>${choice.options.map((option) => { const key = `${profession.id}:${choice.id}`; const checked = (this.draft.spellChoices[key] ?? []).includes(option); return `<label><input data-generator-spell-choice="${key}" data-limit="${choice.count}" type="checkbox" value="${option}" ${checked ? "checked" : ""} /><span>${escapeHtml(generatorCantripName(option))}</span></label>`; }).join("")}</fieldset>`).join("")}
          ${profession.specialAbilities.length ? `<details><summary>Enthaltene Sonderfertigkeiten</summary><ul>${profession.specialAbilities.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></details>` : ""}
        </article>
      </div>
    </section>`;
  }

  private renderTraitSelection(kind: GeneratorTraitKind): string {
    const isAdvantage = kind === "advantage";
    const title = isAdvantage ? "Vorteile" : "Nachteile";
    const catalogue = isAdvantage ? GRW_ADVANTAGES : GRW_DISADVANTAGES;
    const searchValue = isAdvantage ? this.advantageSearch : this.disadvantageSearch;
    const search = normalizeSearch(searchValue);
    const selected = isAdvantage ? this.draft.advantages : this.draft.disadvantages;
    const filtered = catalogue.filter((entry) => !search || normalizeSearch(entry.name).includes(search)).slice(0, 12);
    return `<article class="generator-trait-column generator-trait-column--${kind}">
      <h3>${title}</h3>
      <label class="generator-search"><span>${title.slice(0, -1)} suchen</span><input data-generator-trait-search="${kind}" type="search" value="${escapeHtml(searchValue)}" placeholder="Name eingeben …" /></label>
      <div class="generator-trait-results">${filtered.map((entry) => {
        const already = selected.some((value) => value.id === entry.id);
        const cost = "costPerLevel" in entry ? `${entry.costPerLevel} AP${entry.maxLevel > 1 ? "/Stufe" : ""}` : "AP variabel";
        return `<button data-generator-add-trait="${entry.id}" data-generator-trait-kind="${kind}" ${already ? "disabled" : ""}><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.sourceShortLabel} · S. ${entry.page} · ${cost}</small></span><b>${already ? "✓" : "+"}</b></button>`;
      }).join("")}</div>
      <div class="generator-selected-traits">${selected.map((entry) => this.renderSelectedTrait(kind, entry)).join("") || `<div class="empty-state">Noch keine ${title.toLocaleLowerCase("de")} gewählt.</div>`}</div>
    </article>`;
  }

  private renderSelectedTrait(kind: GeneratorTraitKind, selected: GeneratorTraitSelection): string {
    const definition = getGeneratorTraitDefinition(kind, selected.id);
    if (!definition) return "";
    const variable = "variableCost" in definition && definition.variableCost;
    const variants = "variants" in definition ? definition.variants : [];
    return `<div class="generator-selected-trait">
      <div><strong>${escapeHtml(definition.name)}</strong><small>${selectedTraitCost(kind, selected) || "?"} AP</small></div>
      ${definition.maxLevel > 1 ? `<label><span>Stufe</span><input data-generator-selected-trait="${selected.id}" data-kind="${kind}" data-field="level" type="number" min="1" max="${definition.maxLevel}" value="${selected.level}" /></label>` : ""}
      ${(variants.length || variable) ? `<label class="generator-trait-variant"><span>Ausprägung</span><input data-generator-selected-trait="${selected.id}" data-kind="${kind}" data-field="variant" type="text" value="${escapeHtml(selected.variant)}" placeholder="Auswahl eintragen" /></label>` : ""}
      ${variable ? `<label><span>AP-Wert</span><input data-generator-selected-trait="${selected.id}" data-kind="${kind}" data-field="cost" type="number" min="0" value="${selected.costOverride || ""}" placeholder="0" /></label>` : ""}
      <button data-generator-remove-trait="${selected.id}" data-kind="${kind}" title="Entfernen">×</button>
    </div>`;
  }

  private renderTraits(): string {
    const required = getRequiredProfessionComponents(this.draft);
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 7</p><h2>Vor- und Nachteile</h2>
      <p class="generator-lead">${GRW_ADVANTAGES.length} Vorteile und ${GRW_DISADVANTAGES.length} Nachteile aus allen eingebundenen Bänden sind durchsuchbar. Jeweils höchstens 80 AP zählen für Vorteile und Nachteile.</p>
      ${(required.advantages.length || required.disadvantages.length) ? `<div class="generator-rule-note"><strong>Durch die Profession vorgeschrieben</strong><span>${[...required.advantages.map((entry) => entry.name), ...required.disadvantages.map((entry) => `${entry.name} ${entry.level}`)].join(", ")}</span></div>` : ""}
      <div class="generator-trait-grid">${this.renderTraitSelection("advantage")}${this.renderTraitSelection("disadvantage")}</div>
    </section>`;
  }

  private renderSelectedSpecialAbility(selected: GeneratorSpecialAbilitySelection): string {
    const definition = getGeneratorSpecialAbilityDefinition(selected.id);
    if (!definition) return "";
    const variable = "variableCost" in definition && definition.variableCost;
    return `<div class="generator-selected-trait">
      <div><strong>${escapeHtml(definition.name)}</strong><small>${generatorSpecialAbilityCost(selected) || "?"} AP · ${definition.sourceShortLabel}</small></div>
      ${definition.maxLevel > 1 ? `<label><span>Stufe</span><input data-generator-selected-sa="${selected.id}" data-field="level" type="number" min="1" max="${definition.maxLevel}" value="${selected.level}" /></label>` : ""}
      ${variable ? `<label class="generator-trait-variant"><span>Ausprägung</span><input data-generator-selected-sa="${selected.id}" data-field="variant" type="text" value="${escapeHtml(selected.variant)}" placeholder="Auswahl eintragen" /></label><label><span>AP-Wert</span><input data-generator-selected-sa="${selected.id}" data-field="cost" type="number" min="0" value="${selected.costOverride || ("suggestedCost" in definition ? definition.suggestedCost : "")}" placeholder="0" /></label>` : ""}
      <button data-generator-remove-sa="${selected.id}" title="Entfernen">×</button>
    </div>`;
  }

  private renderSpecialAbilities(): string {
    const search = normalizeSearch(this.specialAbilitySearch);
    const sources = [...new Map(GRW_SPECIAL_ABILITIES.map((entry) => [entry.sourceId, { id: entry.sourceId, label: entry.sourceLabel }])).values()];
    const categories = [...new Set(GRW_SPECIAL_ABILITIES.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, "de"));
    const selectedIds = new Set(this.draft.specialAbilities.map((entry) => entry.id));
    const filtered = GRW_SPECIAL_ABILITIES.filter((entry) =>
      (this.specialAbilitySource === "all" || entry.sourceId === this.specialAbilitySource)
      && (this.specialAbilityCategory === "all" || entry.category === this.specialAbilityCategory)
      && (!search || normalizeSearch(`${entry.name} ${entry.category} ${entry.sourceLabel}`).includes(search))).slice(0, 36);
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 8</p><h2>Sonderfertigkeiten ergänzen</h2>
      <p class="generator-lead">${GRW_SPECIAL_ABILITIES.length} allgemeine, Kampf- und Magie-Sonderfertigkeiten aus den fünf Regelbänden sind hinterlegt. Bereits im Professionspaket enthaltene Einträge werden automatisch übernommen.</p>
      <div class="generator-filter-row">
        <label class="generator-search"><span>Sonderfertigkeit suchen</span><input id="generator-sa-search" type="search" value="${escapeHtml(this.specialAbilitySearch)}" placeholder="z. B. Abrichter, Finte, Zauberstil …" /></label>
        <label class="generator-field"><span>Bereich</span><select id="generator-sa-category"><option value="all">Alle Bereiche</option>${categories.map((entry) => `<option value="${entry}" ${this.specialAbilityCategory === entry ? "selected" : ""}>${entry}</option>`).join("")}</select></label>
        <label class="generator-field"><span>Quelle</span><select id="generator-sa-source"><option value="all">Alle Regelbände</option>${sources.map((entry) => `<option value="${entry.id}" ${this.specialAbilitySource === entry.id ? "selected" : ""}>${entry.label}</option>`).join("")}</select></label>
      </div>
      <div class="generator-special-abilities-layout">
        <div class="generator-trait-results">${filtered.map((entry) => {
          const already = selectedIds.has(entry.id);
          const cost = "costPerLevel" in entry ? `${entry.costPerLevel} AP${entry.maxLevel > 1 ? "/Stufe" : ""}` : "AP/Ausprägung eintragen";
          return `<button data-generator-add-sa="${entry.id}" ${already ? "disabled" : ""}><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.category} · ${entry.sourceShortLabel} S. ${entry.page} · ${cost}</small></span><b>${already ? "✓" : "+"}</b></button>`;
        }).join("") || `<div class="empty-state">Keine Sonderfertigkeit gefunden.</div>`}</div>
        <div class="generator-selected-traits"><h3>Gewählt (${this.draft.specialAbilities.length})</h3>${this.draft.specialAbilities.map((entry) => this.renderSelectedSpecialAbility(entry)).join("") || `<div class="empty-state">Noch keine zusätzlichen Sonderfertigkeiten gewählt.</div>`}</div>
      </div>
      <div class="generator-rule-note"><strong>Voraussetzungen prüfen</strong><span>Der Generator berechnet die AP. Komplexe Voraussetzungen, aufeinander aufbauende Manöver und traditonsgebundene Stile solltest du zusätzlich mit dem GM anhand der angegebenen Buchseite prüfen.</span></div>
    </section>`;
  }

  private renderReview(): string {
    const validation = validateGeneratorDraft(this.draft);
    const experience = getGeneratorExperience(this.draft);
    const race = getGeneratorRace(this.draft);
    const culture = getGeneratorCulture(this.draft);
    const profession = getGeneratorProfession(this.draft);
    const balance = calculateGeneratorBalance(this.draft);
    return `<section class="generator-page">
      <p class="eyebrow">Abschluss</p><h2>Heldenentwurf prüfen</h2>
      <div class="generator-review-grid">
        <article><span>Name</span><strong>${escapeHtml(this.draft.name || "Noch nicht eingetragen")}</strong><small>${escapeHtml(this.draft.concept || "Kein Konzept notiert")}</small></article>
        <article><span>Erfahrungsgrad</span><strong>${experience.name}</strong><small>${experience.ap} AP</small></article>
        <article><span>Herkunft</span><strong>${race.name}</strong><small>${culture.name}${this.draft.useCulturePackage ? ` · Kulturpaket ${culture.packageAp} AP` : " · ohne Kulturpaket"}</small></article>
        <article><span>Profession</span><strong>${escapeHtml(this.draft.sex === "f" ? profession.femaleName : profession.name)}</strong><small>${generatorProfessionSummary(profession)}</small></article>
        <article><span>Eigenschaften</span><strong>${Object.values(this.draft.attributes).reduce((sum, value) => sum + value, 0)} Punkte</strong><small>${ATTRIBUTES.map((entry) => `${entry.code} ${this.draft.attributes[entry.code]}`).join(" · ")}</small></article>
        <article><span>Zusätzliche Sonderfertigkeiten</span><strong>${this.draft.specialAbilities.length}</strong><small>${balance.specialAbilities} AP</small></article>
        <article><span>AP-Bilanz</span><strong>${balance.remaining} AP übrig</strong><small>Vorteile ${balance.advantageLimit}/80 · Nachteile ${balance.disadvantageLimit}/80</small></article>
      </div>
      ${validation.errors.length ? `<div class="generator-validation generator-validation--error"><strong>Noch zu korrigieren</strong><ul>${validation.errors.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>` : ""}
      ${validation.warnings.length ? `<div class="generator-validation generator-validation--warning"><strong>Hinweise</strong><ul>${validation.warnings.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>` : ""}
      <div class="generator-rule-note"><strong>Nach dem Anlegen</strong><span>Der Held wird als normaler interaktiver Bogen geöffnet. Noch nicht verteilte AP kannst du im Reiter „Steigern“ ausgeben; Inventar, Waffen, Rüstung und Geld bleiben bearbeitbar.</span></div>
    </section>`;
  }

  render(): string {
    normalizeGeneratorDraft(this.draft);
    const pages = [
      this.renderConcept(),
      this.renderExperience(),
      this.renderOrigin(),
      this.renderAttributes(),
      this.renderProfession(),
      this.renderTraits(),
      this.renderSpecialAbilities(),
      this.renderReview(),
    ];
    const validation = validateGeneratorDraft(this.draft);
    return `<main class="generator-shell">
      <header class="generator-header"><div><p class="eyebrow">DSA 5 · GRW + Kompendium + Magie I–III</p><h1>Regelwerksgenerator</h1></div><button id="generator-close" class="icon-button" title="Generator schließen">×</button></header>
      <nav class="generator-stepper" aria-label="Schritte der Heldenerschaffung">${GENERATOR_STEPS.map((label, index) => `<button data-generator-step="${index}" class="${index === this.draft.step ? "active" : index < this.draft.step ? "done" : ""}"><b>${index + 1}</b><span>${label}</span></button>`).join("")}</nav>
      <div class="generator-workspace"><div class="generator-main">${pages[this.draft.step] ?? pages[0]}</div>${this.renderBalance()}</div>
      <footer class="generator-footer">
        <button id="generator-cancel" class="text-button">Entwurf schließen</button>
        <div><button id="generator-previous" class="secondary-button" ${this.draft.step === 0 ? "disabled" : ""}>Zurück</button>${this.draft.step < GENERATOR_STEPS.length - 1 ? `<button id="generator-next" class="primary-button">Weiter</button>` : `<button id="generator-create" class="primary-button" ${validation.errors.length ? "disabled" : ""}>Heldenbogen anlegen</button>`}</div>
      </footer>
    </main>`;
  }

  attach(callbacks: CharacterGeneratorCallbacks): void {
    const rerender = (): void => { this.persist(); callbacks.refresh(); };
    document.querySelector("#generator-close")?.addEventListener("click", callbacks.cancel);
    document.querySelector("#generator-cancel")?.addEventListener("click", callbacks.cancel);
    document.querySelectorAll<HTMLButtonElement>("[data-generator-step]").forEach((button) => button.addEventListener("click", () => {
      this.draft.step = Number(button.dataset.generatorStep ?? 0);
      rerender();
    }));
    document.querySelector("#generator-previous")?.addEventListener("click", () => { this.draft.step = Math.max(0, this.draft.step - 1); rerender(); });
    document.querySelector("#generator-next")?.addEventListener("click", () => {
      if (this.draft.step === 0 && !this.draft.name.trim()) {
        callbacks.notify("Bitte gib deinem Helden zuerst einen Namen.", "error");
        document.querySelector<HTMLInputElement>("#generator-name")?.focus();
        return;
      }
      this.draft.step = Math.min(GENERATOR_STEPS.length - 1, this.draft.step + 1);
      rerender();
    });
    const bindValue = (selector: string, handler: (value: string) => void, eventName = "change"): void => {
      document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)?.addEventListener(eventName, (event) => {
        handler((event.target as HTMLInputElement).value);
        if (eventName !== "input") rerender(); else this.persist();
      });
    };
    bindValue("#generator-name", (value) => { this.draft.name = value; }, "input");
    bindValue("#generator-concept", (value) => { this.draft.concept = value; }, "input");
    bindValue("#generator-sex", (value) => { this.draft.sex = value as GeneratorDraft["sex"]; });
    document.querySelectorAll<HTMLInputElement>("[data-generator-experience]").forEach((input) => input.addEventListener("change", () => { this.draft.experienceId = input.value; normalizeGeneratorDraft(this.draft); rerender(); }));
    bindValue("#generator-race", (value) => {
      this.draft.raceId = value;
      const race = GRW_RACES.find((entry) => entry.id === value);
      if (race?.commonCultures.length) this.draft.cultureId = race.commonCultures[0];
      normalizeGeneratorDraft(this.draft);
    });
    bindValue("#generator-culture", (value) => { this.draft.cultureId = value; });
    bindValue("#generator-positive-attribute", (value) => { this.draft.positiveAttribute = value as GeneratorDraft["positiveAttribute"]; normalizeGeneratorDraft(this.draft); });
    bindValue("#generator-negative-attribute", (value) => { this.draft.negativeAttribute = value as GeneratorDraft["negativeAttribute"]; normalizeGeneratorDraft(this.draft); });
    document.querySelector<HTMLInputElement>("#generator-culture-package")?.addEventListener("change", (event) => { this.draft.useCulturePackage = (event.target as HTMLInputElement).checked; rerender(); });
    document.querySelectorAll<HTMLButtonElement>("[data-generator-attribute][data-delta]").forEach((button) => button.addEventListener("click", () => {
      const code = button.dataset.generatorAttribute as keyof GeneratorDraft["attributes"];
      this.draft.attributes[code] += Number(button.dataset.delta ?? 0);
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    document.querySelectorAll<HTMLInputElement>("[data-generator-attribute-input]").forEach((input) => input.addEventListener("change", () => {
      const code = input.dataset.generatorAttributeInput as keyof GeneratorDraft["attributes"];
      this.draft.attributes[code] = Number(input.value);
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    const professionSearch = document.querySelector<HTMLInputElement>("#generator-profession-search");
    professionSearch?.addEventListener("input", () => {
      this.professionSearch = professionSearch.value;
      callbacks.refresh();
      const refreshed = document.querySelector<HTMLInputElement>("#generator-profession-search");
      refreshed?.focus(); refreshed?.setSelectionRange(this.professionSearch.length, this.professionSearch.length);
    });
    bindValue("#generator-profession-source", (value) => { this.professionSource = value; });
    document.querySelectorAll<HTMLInputElement>("[data-generator-profession]").forEach((input) => input.addEventListener("change", () => { this.draft.professionId = input.value; normalizeGeneratorDraft(this.draft); rerender(); }));
    const bindChoice = (selector: string, target: "combatChoices" | "spellChoices"): void => {
      document.querySelectorAll<HTMLInputElement>(selector).forEach((input) => input.addEventListener("change", () => {
        const key = target === "combatChoices" ? input.dataset.generatorCombatChoice : input.dataset.generatorSpellChoice;
        if (!key) return;
        const limit = Number(input.dataset.limit ?? 1);
        const values = this.draft[target][key] ?? [];
        if (input.checked && !values.includes(input.value)) {
          if (values.length >= limit) values.shift();
          values.push(input.value);
        } else if (!input.checked) values.splice(values.indexOf(input.value), 1);
        this.draft[target][key] = values;
        rerender();
      }));
    };
    bindChoice("[data-generator-combat-choice]", "combatChoices");
    bindChoice("[data-generator-spell-choice]", "spellChoices");
    document.querySelectorAll<HTMLInputElement>("[data-generator-trait-search]").forEach((input) => input.addEventListener("input", () => {
      const kind = input.dataset.generatorTraitSearch as GeneratorTraitKind;
      if (kind === "advantage") this.advantageSearch = input.value; else this.disadvantageSearch = input.value;
      callbacks.refresh();
      const refreshed = document.querySelector<HTMLInputElement>(`[data-generator-trait-search="${kind}"]`);
      refreshed?.focus(); refreshed?.setSelectionRange(input.value.length, input.value.length);
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-generator-add-trait]").forEach((button) => button.addEventListener("click", () => {
      const kind = button.dataset.generatorTraitKind as GeneratorTraitKind;
      const id = button.dataset.generatorAddTrait;
      if (!id) return;
      const definition = getGeneratorTraitDefinition(kind, id);
      const target = kind === "advantage" ? this.draft.advantages : this.draft.disadvantages;
      if (!definition || target.some((entry) => entry.id === id)) return;
      const firstVariant = "variants" in definition ? definition.variants[0] : undefined;
      target.push({ id, level: 1, variant: "", costOverride: firstVariant && "cost" in firstVariant ? Number(firstVariant.cost) : 0 });
      rerender();
    }));
    document.querySelectorAll<HTMLInputElement>("[data-generator-selected-trait]").forEach((input) => input.addEventListener("change", () => {
      const kind = input.dataset.kind as GeneratorTraitKind;
      const target = kind === "advantage" ? this.draft.advantages : this.draft.disadvantages;
      const selected = target.find((entry) => entry.id === input.dataset.generatorSelectedTrait);
      if (!selected) return;
      if (input.dataset.field === "level") selected.level = Math.max(1, Number(input.value));
      if (input.dataset.field === "variant") {
        selected.variant = input.value;
        const definition = getGeneratorTraitDefinition(kind, selected.id);
        const variant = definition && "variants" in definition ? definition.variants.find((entry) => entry.name === input.value) : undefined;
        if (variant && "cost" in variant) selected.costOverride = Number(variant.cost);
      }
      if (input.dataset.field === "cost") selected.costOverride = Math.max(0, Number(input.value));
      rerender();
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-generator-remove-trait]").forEach((button) => button.addEventListener("click", () => {
      const kind = button.dataset.kind as GeneratorTraitKind;
      const target = kind === "advantage" ? this.draft.advantages : this.draft.disadvantages;
      const index = target.findIndex((entry) => entry.id === button.dataset.generatorRemoveTrait);
      if (index >= 0) target.splice(index, 1);
      rerender();
    }));
    const specialAbilitySearch = document.querySelector<HTMLInputElement>("#generator-sa-search");
    specialAbilitySearch?.addEventListener("input", () => {
      this.specialAbilitySearch = specialAbilitySearch.value;
      callbacks.refresh();
      const refreshed = document.querySelector<HTMLInputElement>("#generator-sa-search");
      refreshed?.focus(); refreshed?.setSelectionRange(this.specialAbilitySearch.length, this.specialAbilitySearch.length);
    });
    bindValue("#generator-sa-source", (value) => { this.specialAbilitySource = value; });
    bindValue("#generator-sa-category", (value) => { this.specialAbilityCategory = value; });
    document.querySelectorAll<HTMLButtonElement>("[data-generator-add-sa]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.generatorAddSa;
      if (!id || this.draft.specialAbilities.some((entry) => entry.id === id)) return;
      const definition = getGeneratorSpecialAbilityDefinition(id);
      if (!definition) return;
      this.draft.specialAbilities.push({
        id,
        level: 1,
        variant: "",
        costOverride: "suggestedCost" in definition ? Number(definition.suggestedCost) : 0,
      });
      rerender();
    }));
    document.querySelectorAll<HTMLInputElement>("[data-generator-selected-sa]").forEach((input) => input.addEventListener("change", () => {
      const selected = this.draft.specialAbilities.find((entry) => entry.id === input.dataset.generatorSelectedSa);
      if (!selected) return;
      if (input.dataset.field === "level") selected.level = Math.max(1, Number(input.value));
      if (input.dataset.field === "variant") selected.variant = input.value;
      if (input.dataset.field === "cost") selected.costOverride = Math.max(0, Number(input.value));
      rerender();
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-generator-remove-sa]").forEach((button) => button.addEventListener("click", () => {
      const index = this.draft.specialAbilities.findIndex((entry) => entry.id === button.dataset.generatorRemoveSa);
      if (index >= 0) this.draft.specialAbilities.splice(index, 1);
      rerender();
    }));
    document.querySelector("#generator-create")?.addEventListener("click", () => {
      try {
        const sheet = buildGeneratedCharacter(this.draft);
        localStorage.removeItem(STORAGE_KEY);
        callbacks.complete(sheet);
      } catch (error) {
        callbacks.notify(error instanceof Error ? error.message : "Der Heldenbogen konnte nicht angelegt werden.", "error");
      }
    });
  }
}

const getSpeciesName = (speciesId: string): string => ({
  menschen: "Mensch",
  halbelfen: "Halbelf",
  elfen: "Elf",
  zwerge: "Zwerg",
})[speciesId] ?? speciesId;
