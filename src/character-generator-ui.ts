import {
  GENERATOR_STEPS,
  GRW_ADVANTAGES,
  GRW_CULTURES,
  GRW_DISADVANTAGES,
  GRW_EXPERIENCES,
  GRW_PROFESSIONS,
  GRW_RACES,
  GRW_SPECIAL_ABILITIES,
  GENERATOR_SHOP_ITEMS,
  GENERATOR_SPELLS,
  AVAILABLE_EQUIPMENT_PACKAGES,
  addEquipmentPackageToDraft,
  assignGeneratorEquipmentSuggestion,
  buildGeneratedCharacter,
  calculateGeneratorBalance,
  calculateGeneratorShopping,
  calculateGeneratorEquipmentZones,
  createGeneratorDraft,
  generatorCantripName,
  generatorCombatChoiceName,
  generatorProfessionSummary,
  generatorSpecialAbilityCost,
  generatorSpellCostFor,
  generatorSpellNextCost,
  generatorTalentCostFor,
  generatorTraitCost,
  getEquipmentPackageBalance,
  getGeneratorAttributeMaximum,
  getGeneratorCulture,
  getGeneratorExperience,
  getGeneratorProfession,
  getGeneratorRace,
  getGeneratorSpecies,
  getGeneratorSpecialAbilityDefinition,
  getGeneratorShopItem,
  getGeneratorBaseTalentValues,
  getGeneratorBaseSpellValues,
  getGeneratorSpellCount,
  getGeneratorSpellValue,
  getGeneratorTalentValue,
  getGeneratorTraitDefinition,
  getRequiredProfessionComponents,
  isGeneratorMagicAutomatic,
  isGeneratorMagicallyGifted,
  normalizeGeneratorDraft,
  validateGeneratorDraft,
} from "./character-generator";
import { EQUIPMENT_BODY_SLOT_DEFINITIONS, equipmentSlotIsAvailable } from "./equipment-zones";
import { ATTRIBUTES, COMBAT_TECHNIQUES, ITEM_GROUPS, TALENTS } from "./data";
import { improvementCostForTarget } from "./advancement";
import { attachSpecialAbilityInfoListeners } from "./special-ability-info";
import { renderInfoIcon } from "./ui-assets";
import { downloadPrintableCharacterPdf } from "./print-pdf";
import type { CharacterSheetState, EquipmentBodySlot, OptolithItem } from "./types";
import type { GeneratorDraft, GeneratorShopCategory, GeneratorShopItem, GeneratorSpecialAbilitySelection, GeneratorTraitKind, GeneratorTraitSelection } from "./character-generator";

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
      talentIncreases: parsed.talentIncreases && typeof parsed.talentIncreases === "object" ? parsed.talentIncreases : {},
      magicallyGifted: Boolean(parsed.magicallyGifted),
      spellIncreases: parsed.spellIncreases && typeof parsed.spellIncreases === "object" ? parsed.spellIncreases : {},
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      equipmentSlots: parsed.equipmentSlots && typeof parsed.equipmentSlots === "object" ? parsed.equipmentSlots : {},
    } as GeneratorDraft;
    normalizeGeneratorDraft(draft);
    return draft;
  } catch {
    return createGeneratorDraft();
  }
};

const selectedTraitCost = (kind: GeneratorTraitKind, entry: GeneratorTraitSelection): number =>
  Math.abs(generatorTraitCost(kind, entry));

const formatSilver = (value: number): string => `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} S`;

const formatWeight = (value: number): string => `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Stein`;

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
  professionCategory = "all";
  specialAbilitySource = "all";
  specialAbilityCategory = "all";
  shopSearch = "";
  shopCategory: GeneratorShopCategory | "all" = "all";
  talentSearch = "";
  spellSearch = "";

  private captureScrollState(): { pageX: number; pageY: number; lists: Map<string, { left: number; top: number }> } {
    const lists = new Map<string, { left: number; top: number }>();
    document.querySelectorAll<HTMLElement>("[data-generator-scroll]").forEach((element) => {
      const key = element.dataset.generatorScroll;
      if (key) lists.set(key, { left: element.scrollLeft, top: element.scrollTop });
    });
    return { pageX: window.scrollX, pageY: window.scrollY, lists };
  }

  private restoreScrollState(scrollState: ReturnType<CharacterGeneratorUI["captureScrollState"]>): void {
    window.scrollTo(scrollState.pageX, scrollState.pageY);
    document.querySelectorAll<HTMLElement>("[data-generator-scroll]").forEach((element) => {
      const key = element.dataset.generatorScroll;
      const position = key ? scrollState.lists.get(key) : undefined;
      if (position) {
        element.scrollLeft = position.left;
        element.scrollTop = position.top;
      }
    });
  }

  reset(): void {
    this.draft = createGeneratorDraft();
    this.professionSearch = "";
    this.advantageSearch = "";
    this.disadvantageSearch = "";
    this.specialAbilitySearch = "";
    this.professionSource = "all";
    this.professionCategory = "all";
    this.specialAbilitySource = "all";
    this.specialAbilityCategory = "all";
    this.shopSearch = "";
    this.shopCategory = "all";
    this.talentSearch = "";
    this.spellSearch = "";
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
        ${balance.talents ? `<div><dt>Talentsteigerungen</dt><dd>−${balance.talents}</dd></div>` : ""}
        ${balance.spells ? `<div><dt>Zauber</dt><dd>−${balance.spells}</dd></div>` : ""}
      </dl>
      <small>Grenzen: Vorteile ${balance.advantageLimit}/80 · Nachteile ${balance.disadvantageLimit}/80</small>
    </aside>`;
  }

  private renderConcept(): string {
    const magical = isGeneratorMagicallyGifted(this.draft);
    const automaticMagic = isGeneratorMagicAutomatic(this.draft);
    const automaticReason = getGeneratorSpecies(this.draft).id === "elfen"
      ? "Die gewählte elfische Herkunft ist automatisch magisch begabt."
      : getGeneratorProfession(this.draft).magical === true
        ? `Die Profession „${this.draft.sex === "f" ? getGeneratorProfession(this.draft).femaleName : getGeneratorProfession(this.draft).name}“ setzt Magiebegabung voraus.`
        : "";
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
        <fieldset class="generator-magic-choice generator-field--wide"><legend>Magische Begabung</legend>
          <label class="generator-magic-option ${!magical ? "generator-magic-option--selected" : ""}"><input data-generator-magical type="radio" name="generator-magical" value="no" ${!magical ? "checked" : ""} ${automaticMagic ? "disabled" : ""} /><span><strong>Nicht magisch begabt</strong><small>Im Steigerungsschritt werden nur Talente angezeigt.</small></span></label>
          <label class="generator-magic-option ${magical ? "generator-magic-option--selected" : ""}"><input data-generator-magical type="radio" name="generator-magical" value="yes" ${magical ? "checked" : ""} ${automaticMagic ? "disabled" : ""} /><span><strong>Magisch begabt</strong><small>Zauber und Rituale können im Steigerungsschritt aktiviert und erhöht werden.</small></span></label>
          ${automaticReason ? `<p class="generator-magic-note">✦ ${escapeHtml(automaticReason)}</p>` : ""}
        </fieldset>
        <label class="generator-field generator-field--wide"><span>Konzept und Motivation</span><textarea id="generator-concept" rows="7" placeholder="Herkunft, Ziele, Stärken, Schwächen …">${escapeHtml(this.draft.concept)}</textarea></label>
      </div>
      <div class="generator-rule-note"><strong>Regelgrundlage</strong><span>DSA5-Regelwiki und die im Katalog genannten Quellenbände</span></div>
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
      && (this.professionCategory === "all" || entry.category === this.professionCategory)
      && (!search || normalizeSearch(`${entry.name} ${entry.femaleName} ${entry.group} ${entry.category} ${entry.sourceLabel}`).includes(search))).slice(0, 60);
    const professionSources = [...new Map(GRW_PROFESSIONS.map((entry) => [entry.sourceId, { id: entry.sourceId, label: entry.sourceLabel }])).values()];
    const required = getRequiredProfessionComponents(this.draft);
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 6</p><h2>Profession wählen</h2>
      <p class="generator-lead">${GRW_PROFESSIONS.length} Professionspakete und Varianten aus den Bereichen Weltliche, Kämpfer, Ordensleute, Zauberer und Geweihte sind enthalten.</p>
      <div class="generator-filter-row"><label class="generator-search"><span>Profession suchen</span><input id="generator-profession-search" type="search" value="${escapeHtml(this.professionSearch)}" placeholder="z. B. Geode, Schwertgeselle, Hexe …" /></label><label class="generator-field"><span>Gruppe</span><select id="generator-profession-category"><option value="all">Alle Gruppen</option>${["Weltliche", "Kämpfer", "Ordensleute", "Zauberer", "Geweihte"].map((entry) => `<option value="${entry}" ${this.professionCategory === entry ? "selected" : ""}>${entry}</option>`).join("")}</select></label><label class="generator-field"><span>Quelle</span><select id="generator-profession-source"><option value="all">Alle Regelbände</option>${professionSources.map((entry) => `<option value="${entry.id}" ${this.professionSource === entry.id ? "selected" : ""}>${entry.label}</option>`).join("")}</select></label></div>
      <div class="profession-layout">
        <div class="profession-list">${filtered.map((entry) => `<label class="profession-option ${entry.id === profession.id ? "profession-option--selected" : ""}"><input data-generator-profession type="radio" name="generator-profession" value="${entry.id}" ${entry.id === profession.id ? "checked" : ""} /><span><strong>${escapeHtml(this.draft.sex === "f" ? entry.femaleName : entry.name)}</strong><small>${generatorProfessionSummary(entry)}</small></span></label>`).join("") || `<div class="empty-state">Keine Profession gefunden.</div>`}</div>
        <article class="profession-detail">
          <p class="eyebrow">Ausgewählt</p><h3>${escapeHtml(this.draft.sex === "f" ? profession.femaleName : profession.name)}</h3>
          ${profession.id ? `<p>${generatorProfessionSummary(profession)} · S. ${profession.page}</p>` : `<p>Suche links nach einer Profession oder grenze die Liste nach Gruppe und Quelle ein.</p>`}
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

  private specialAbilityCostLabel(definition: NonNullable<ReturnType<typeof getGeneratorSpecialAbilityDefinition>>): string {
    if ("costByLevel" in definition) {
      const costs = definition.costByLevel as readonly number[];
      return `${costs.join("/")} AP für Stufe I–${costs.length}`;
    }
    if ("costPerLevel" in definition) return `${definition.costPerLevel} AP${definition.maxLevel > 1 ? " je Stufe" : ""}`;
    return `variabel${"suggestedCost" in definition ? ` · Richtwert ${definition.suggestedCost} AP` : ""}`;
  }

  private renderSpecialAbilityInfo(definition: NonNullable<ReturnType<typeof getGeneratorSpecialAbilityDefinition>>): string {
    const prerequisites = definition.prerequisites.length
      ? `<ul>${definition.prerequisites.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
      : `<span>Keine Voraussetzungen in den eingebundenen Daten hinterlegt.</span>`;
    return `<div class="generator-sa-info">
      <button type="button" class="generator-sa-info__button" data-generator-sa-info aria-label="Informationen zu ${escapeHtml(definition.name)}" aria-expanded="false">${renderInfoIcon()}</button>
      <div class="generator-sa-info__popover" role="tooltip">
        <strong>${escapeHtml(definition.name)}</strong>
        <em>${escapeHtml(definition.category)} · ${escapeHtml(this.specialAbilityCostLabel(definition))}</em>
        <p>${escapeHtml(definition.shortDescription || "Eine kurze Regelbeschreibung ist in den eingebundenen Daten noch nicht verfügbar.")}</p>
        <b>Voraussetzungen</b>${prerequisites}
        <small>${escapeHtml(definition.sourceLabel)} · Seite ${definition.page}</small>
        <a href="${escapeHtml(definition.regelwikiUrl)}" target="_blank" rel="noopener noreferrer">Im DSA-Regelwiki nachschlagen ↗</a>
      </div>
    </div>`;
  }

  private renderSelectedSpecialAbility(selected: GeneratorSpecialAbilitySelection): string {
    const definition = getGeneratorSpecialAbilityDefinition(selected.id);
    if (!definition) return "";
    const variable = "variableCost" in definition && definition.variableCost;
    return `<div class="generator-selected-trait">
      <div class="generator-selected-trait__title"><span><strong>${escapeHtml(definition.name)}</strong><small>${generatorSpecialAbilityCost(selected) || "?"} AP · ${definition.sourceShortLabel}</small></span>${this.renderSpecialAbilityInfo(definition)}</div>
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
      <p class="generator-lead">${GRW_SPECIAL_ABILITIES.length} allgemeine, Kampf- und Magie-Sonderfertigkeiten aus den eingebundenen Quellen sind hinterlegt. Bereits im Professionspaket enthaltene Einträge werden automatisch übernommen. Das <b>i</b> zeigt eine Kurzinfo und führt zum passenden Regelwiki-Eintrag.</p>
      <div class="generator-filter-row">
        <label class="generator-search"><span>Sonderfertigkeit suchen</span><input id="generator-sa-search" type="search" value="${escapeHtml(this.specialAbilitySearch)}" placeholder="z. B. Abrichter, Finte, Zauberstil …" /></label>
        <label class="generator-field"><span>Bereich</span><select id="generator-sa-category"><option value="all">Alle Bereiche</option>${categories.map((entry) => `<option value="${entry}" ${this.specialAbilityCategory === entry ? "selected" : ""}>${entry}</option>`).join("")}</select></label>
        <label class="generator-field"><span>Quelle</span><select id="generator-sa-source"><option value="all">Alle Regelbände</option>${sources.map((entry) => `<option value="${entry.id}" ${this.specialAbilitySource === entry.id ? "selected" : ""}>${entry.label}</option>`).join("")}</select></label>
      </div>
      <div class="generator-special-abilities-layout">
        <div class="generator-trait-results">${filtered.map((entry) => {
          const already = selectedIds.has(entry.id);
          const cost = this.specialAbilityCostLabel(entry);
          return `<article class="generator-sa-result"><button data-generator-add-sa="${entry.id}" ${already ? "disabled" : ""}><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.category} · ${entry.sourceShortLabel} S. ${entry.page} · ${cost}</small></span><b>${already ? "✓" : "+"}</b></button>${this.renderSpecialAbilityInfo(entry)}</article>`;
        }).join("") || `<div class="empty-state">Keine Sonderfertigkeit gefunden.</div>`}</div>
        <div class="generator-selected-traits"><h3>Gewählt (${this.draft.specialAbilities.length})</h3>${this.draft.specialAbilities.map((entry) => this.renderSelectedSpecialAbility(entry)).join("") || `<div class="empty-state">Noch keine zusätzlichen Sonderfertigkeiten gewählt.</div>`}</div>
      </div>
      <div class="generator-rule-note"><strong>Voraussetzungen prüfen</strong><span>Der Generator berechnet die AP. Komplexe Voraussetzungen, aufeinander aufbauende Manöver und traditonsgebundene Stile solltest du zusätzlich mit dem GM anhand der angegebenen Buchseite prüfen.</span></div>
    </section>`;
  }

  private shopItemDetails(entry: GeneratorShopItem): string {
    const item = entry.item;
    const details = [entry.kindLabel];
    if (item.damageDiceSides) details.push(`TP ${item.damageDiceNumber ?? 1}W${item.damageDiceSides}${Number(item.damageFlat ?? 0) >= 0 ? "+" : ""}${item.damageFlat ?? 0}`);
    if (item.combatTechnique) details.push(COMBAT_TECHNIQUES[item.combatTechnique] ?? item.combatTechnique);
    if (typeof item.pro === "number") details.push(`RS ${item.pro}`);
    if (typeof item.enc === "number") details.push(`BE ${item.enc}`);
    if (entry.itemKind === "helmet" && typeof item.zoneProtection === "number") details.push(`Kopf-RS ${item.zoneProtection}`);
    if (entry.itemKind === "equipment") details.push(ITEM_GROUPS[item.gr ?? 0] ?? "Inventar");
    if (typeof item.weight === "number") details.push(formatWeight(item.weight));
    return details.join(" · ");
  }

  private renderArmoryInfo(entry: GeneratorShopItem): string {
    const item = entry.item;
    const info = entry.info;
    const facts: Array<[string, string]> = [
      ["Art", entry.kindLabel],
      ["Preis", formatSilver(item.price)],
      ...(typeof item.weight === "number" ? [["Gewicht", formatWeight(item.weight)] as [string, string]] : []),
      ...(item.damageDiceSides ? [["Trefferpunkte", `${item.damageDiceNumber ?? 1}W${item.damageDiceSides}${Number(item.damageFlat ?? 0) >= 0 ? "+" : ""}${item.damageFlat ?? 0}`] as [string, string]] : []),
      ...(item.combatTechnique ? [["Kampftechnik", COMBAT_TECHNIQUES[item.combatTechnique] ?? item.combatTechnique] as [string, string]] : []),
      ...(typeof item.at === "number" || typeof item.pa === "number" ? [["AT/PA-Modifikator", `${Number(item.at ?? 0) >= 0 ? "+" : ""}${item.at ?? 0} / ${Number(item.pa ?? 0) >= 0 ? "+" : ""}${item.pa ?? 0}`] as [string, string]] : []),
      ...(typeof item.pro === "number" ? [["Rüstungsschutz", String(item.pro)] as [string, string]] : []),
      ...(typeof item.enc === "number" ? [["Belastung", String(item.enc)] as [string, string]] : []),
      ...(item.armorType ? [["Rüstungstyp", String(item.armorType)] as [string, string]] : []),
      ...(item.armorZone ? [["Trefferzone", String(item.armorZone)] as [string, string]] : []),
      ...(typeof item.zoneProtection === "number" ? [["RS der Zone", String(item.zoneProtection)] as [string, string]] : []),
      ...(typeof item.movementPenalty === "number" ? [["GS-Modifikator", String(item.movementPenalty)] as [string, string]] : []),
      ...(typeof item.initiativePenalty === "number" ? [["INI-Modifikator", String(item.initiativePenalty)] as [string, string]] : []),
      ...(typeof item.reloadTime === "number" ? [["Ladezeit", `${item.reloadTime} Aktion${item.reloadTime === 1 ? "" : "en"}`] as [string, string]] : []),
      ...(typeof item.rangeShort === "number" ? [["Reichweiten", `${item.rangeShort}/${item.rangeMedium ?? "–"}/${item.rangeLong ?? "–"}`] as [string, string]] : []),
      ...(typeof item.length === "number" ? [["Länge", `${item.length} Halbfinger`] as [string, string]] : []),
      ...(info?.complexity ? [["Herstellung", info.complexity] as [string, string]] : []),
    ];
    const specialRules = [
      info?.hasSpecialAdvantage ? "besonderer Vorteil" : "",
      info?.hasSpecialDisadvantage ? "besonderer Nachteil" : "",
      info?.hasAdditionalRules ? `Zusatzregeln${info.propertyNames.length ? ` (${info.propertyNames.join(", ")})` : ""}` : "",
    ].filter(Boolean);
    const source = info
      ? `${info.sourceLabel}${info.pages.length ? ` · Seite ${info.pages.join(", ")}` : ""}`
      : "Integrierter DarkAid-Ausrüstungskatalog";
    const regelwikiUrl = info?.regelwikiUrl
      ?? `https://dsa.ulisses-regelwiki.de/suche.html?keywords=${encodeURIComponent(item.name)}`;
    const categoryUrl = info?.categoryUrl ?? "https://dsa.ulisses-regelwiki.de/ruestkammer.html";
    const detailedRules = [
      info?.ruleNote ? `<p><b>Hinweis:</b> ${escapeHtml(info.ruleNote)}</p>` : "",
      info?.advantageText ? `<p><b>Helmvorteil:</b> ${escapeHtml(info.advantageText)}</p>` : "",
      info?.disadvantageText ? `<p><b>Helmnachteil:</b> ${escapeHtml(info.disadvantageText)}</p>` : "",
    ].filter(Boolean).join("");
    return `<div class="generator-sa-info armory-info">
      <button type="button" class="generator-sa-info__button" data-generator-sa-info aria-label="Rüstkammer-Informationen zu ${escapeHtml(item.name)}" aria-expanded="false">${renderInfoIcon()}</button>
      <div class="generator-sa-info__popover armory-info__popover" role="tooltip">
        <strong>${escapeHtml(item.name)}</strong>
        <em>${escapeHtml(entry.kindLabel)} · ${escapeHtml(info?.sourceShortLabel ?? "Katalog")}</em>
        ${info?.shortDescription ? `<p>${escapeHtml(info.shortDescription)}</p>` : ""}
        <dl class="armory-info__facts">${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
        ${detailedRules || (specialRules.length ? `<p><b>Besondere Regeln:</b> ${escapeHtml(specialRules.join(" · "))}. Die genaue Wirkung steht im Regelwiki.</p>` : `<p>Für diesen Eintrag sind keine zusätzlichen Sonderregeln im eingebundenen Datensatz markiert.</p>`)}
        ${info?.derivedValues ? `<small>Preis und Gewicht wurden nach dem Kopf-Multiplikator der Trefferzonen-Regel aus dem angegebenen Rüstungstyp berechnet.</small>` : ""}
        <small>${escapeHtml(source)}</small>
        <a href="${escapeHtml(regelwikiUrl)}" target="_blank" rel="noopener noreferrer">Gegenstand im DSA-Regelwiki suchen ↗</a>
        <a href="${escapeHtml(categoryUrl)}" target="_blank" rel="noopener noreferrer">Rüstkammer-Übersicht öffnen ↗</a>
      </div>
    </div>`;
  }

  private renderShopping(): string {
    const shopping = calculateGeneratorShopping(this.draft);
    const search = normalizeSearch(this.shopSearch);
    const filtered = GENERATOR_SHOP_ITEMS.filter((entry) =>
      (this.shopCategory === "all" || entry.category === this.shopCategory)
      && (!search || normalizeSearch(`${entry.item.name} ${entry.kindLabel} ${ITEM_GROUPS[entry.item.gr ?? 0] ?? ""}`).includes(search)))
      .slice(0, 60);
    const purchases = this.draft.purchases
      .map((purchase) => ({ purchase, entry: getGeneratorShopItem(purchase.catalogId) }))
      .filter((value): value is { purchase: GeneratorDraft["purchases"][number]; entry: GeneratorShopItem } => Boolean(value.entry))
      .sort((a, b) => a.entry.item.name.localeCompare(b.entry.item.name, "de"));
    const zoneSummary = calculateGeneratorEquipmentZones(this.draft);
    const backpackEntries = purchases.filter(({ purchase }) => zoneSummary.backpackItemIds.includes(purchase.catalogId));
    const bodyZones = EQUIPMENT_BODY_SLOT_DEFINITIONS.map((definition) => {
      const zone = zoneSummary.entries.find((entry) => entry.slot.id === definition.id)!;
      const candidates = purchases.filter(({ purchase, entry }) => equipmentSlotIsAvailable(
        purchase.catalogId,
        { ...entry.item, id: purchase.catalogId, amount: purchase.amount, itemKind: entry.itemKind } as OptolithItem,
        definition.id,
        this.draft.equipmentSlots,
      ));
      return `<label class="equipment-zone-card equipment-zone-card--${definition.id}">
        <span>${escapeHtml(definition.label)}</span>
        <select data-generator-equipment-slot="${definition.id}" aria-label="Ausrüstung für ${escapeHtml(definition.label)}">
          <option value="">${candidates.length ? "nicht belegt / im Rucksack" : "keine passende Ausrüstung"}</option>
          ${candidates.map(({ purchase, entry }) => `<option value="${escapeHtml(purchase.catalogId)}" ${zone.itemId === purchase.catalogId ? "selected" : ""}>${escapeHtml(entry.item.name)}</option>`).join("")}
        </select>
        <strong>${definition.id === "footwear" ? "ohne RS" : `${escapeHtml(definition.protectionLabel)} ${zone.protection}`}</strong>
      </label>`;
    }).join("");
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 8</p><h2>Rüstkammer &amp; Ausrüstung</h2>
      <p class="generator-lead">Suche in der Rüstkammer nach Inventar, Waffen, Schilden, Helmen und Rüstungen. Über das Info-Symbol siehst du Werte, Quelle und Regelwiki-Verweise; gekaufte Gegenstände und das übrige Geld werden in den fertigen Heldenbogen übernommen.</p>
      <div class="generator-shopping-balance ${shopping.remainingSilver < 0 ? "generator-shopping-balance--error" : ""}">
        <div><span>Startkapital</span><strong>${formatSilver(shopping.startingCapitalSilver)}</strong></div>
        <div><span>Ausgegeben</span><strong>${formatSilver(shopping.spentSilver)}</strong></div>
        <div><span>Übrig</span><strong>${formatSilver(shopping.remainingSilver)}</strong></div>
        <div><span>Gewicht</span><strong>${formatWeight(shopping.totalWeight)}</strong></div>
      </div>
      <div class="generator-rule-note"><strong>Startkapital</strong><span>Standard sind 750 Silbertaler. Der Vorteil „Reich“ erhöht und der Nachteil „Arm“ senkt diesen Betrag automatisch um 250 Silbertaler je Stufe.</span></div>
      <section class="equipment-placement equipment-placement--generator">
        <div class="generator-section-heading"><div><h3>Getragene Ausrüstung &amp; Rucksack</h3><small>Jedes Feld bietet nur dafür geeignete Gegenstände an. Alles Übrige bleibt automatisch im Rucksack.</small></div><a href="https://dsa.ulisses-regelwiki.de/Fokus_TreffzonenRS.html" target="_blank" rel="noopener noreferrer">Trefferzonen-Regel ↗</a></div>
        <div class="equipment-placement__layout">
          <div class="equipment-body-zones">${bodyZones}</div>
          <aside class="equipment-backpack"><header><span>Rucksack</span><strong>${backpackEntries.reduce((total, { purchase }) => total + purchase.amount, 0)} Gegenstände</strong></header><ul>${backpackEntries.slice(0, 9).map(({ purchase, entry }) => `<li><span>${purchase.amount > 1 ? `${purchase.amount}× ` : ""}${escapeHtml(entry.item.name)}</span><small>${formatWeight(Number(entry.item.weight ?? 0) * purchase.amount)}</small></li>`).join("") || "<li class=\"empty-state\">Der Rucksack ist leer.</li>"}</ul>${backpackEntries.length > 9 ? `<small>+ ${backpackEntries.length - 9} weitere Positionen</small>` : ""}</aside>
        </div>
        <div class="equipment-zone-result"><div><span>Belastungswert</span><strong>${zoneSummary.protectionScore}</strong><small>Kopf ×1 · Torso ×5 · Arme ×2 · Beine ×2 je Bein</small></div><div><span>Rüstungs-BE</span><strong>${zoneSummary.encumbrance}</strong><small>aus den zugeordneten Trefferzonen</small></div><div><span>Zusatzabzug</span><strong>${zoneSummary.movementPenalty ? `−${zoneSummary.movementPenalty}` : "–"}</strong><small>auf GS und INI</small></div><p>Der RS wird nicht addiert: Bei einem Treffer gilt ausschließlich der Wert der getroffenen Zone. „Beine“ zeigt denselben RS für jedes Bein.</p></div>
      </section>
      <section class="generator-equipment-packages">
        <div class="generator-section-heading"><div><h3>Ausrüstungspakete</h3><small>Ein Klick legt alle enthaltenen Gegenstände einzeln in den Einkauf.</small></div><a href="https://dsa.ulisses-regelwiki.de/ruestkammer/ausruestungspakete.html" target="_blank" rel="noopener noreferrer">Regelwiki-Übersicht ↗</a></div>
        <div class="generator-equipment-package-grid">${AVAILABLE_EQUIPMENT_PACKAGES.map((definition) => {
          const packageBalance = getEquipmentPackageBalance(definition.id);
          const affordable = Boolean(packageBalance && packageBalance.spentSilver <= shopping.remainingSilver + 0.0001);
          const price = definition.publishedPrice ?? packageBalance?.spentSilver;
          const weight = definition.publishedWeight ?? packageBalance?.totalWeight;
          const differsFromPublished = Boolean(packageBalance && definition.publishedWeight !== undefined
            && Math.abs(packageBalance.totalWeight - definition.publishedWeight) > 0.0001);
          return `<article class="generator-equipment-package">
            <div><strong>${escapeHtml(definition.name)}</strong><small>${escapeHtml(definition.sourceShortLabel)}${definition.pages.length ? ` · S. ${definition.pages.join("/")}` : ""}</small></div>
            <p>${definition.items.length} Positionen · ${definition.publishedPrice !== undefined || definition.publishedWeight !== undefined ? "Regelwiki: " : ""}${formatSilver(price ?? 0)} · ${formatWeight(weight ?? 0)}${differsFromPublished ? `<br />Warenkorb aus Einzelwerten: ${formatWeight(packageBalance!.totalWeight)}` : ""}</p>
              <details><summary>Inhalt anzeigen</summary><ul>${definition.items.map((packageItem) => {
                const entry = getGeneratorShopItem(packageItem.catalogId);
                return `<li>${packageItem.amount > 1 ? `${packageItem.amount}× ` : ""}${escapeHtml(entry?.item.name ?? packageItem.catalogId)}</li>`;
              }).join("")}</ul>${definition.note ? `<p>${escapeHtml(definition.note)}</p>` : ""}<a href="${escapeHtml(definition.regelwikiUrl)}" target="_blank" rel="noopener noreferrer">Quelle im Regelwiki ↗</a></details>
              <button data-generator-buy-package="${escapeHtml(definition.id)}" ${affordable ? "" : "disabled"} title="${affordable ? "Gesamtes Paket kaufen" : "Nicht genug Geld"}">Paket hinzufügen</button>
          </article>`;
        }).join("")}</div>
      </section>
      <div class="generator-filter-row generator-shop-filters">
        <label class="generator-search"><span>Gegenstand suchen</span><input id="generator-shop-search" type="search" value="${escapeHtml(this.shopSearch)}" placeholder="z. B. Dolch, Kettenhemd, Seil …" /></label>
        <label class="generator-field"><span>Bereich</span><select id="generator-shop-category">
          <option value="all" ${this.shopCategory === "all" ? "selected" : ""}>Alles</option>
          <option value="weapons" ${this.shopCategory === "weapons" ? "selected" : ""}>Waffen & Schilde</option>
          <option value="armor" ${this.shopCategory === "armor" ? "selected" : ""}>Rüstungen</option>
          <option value="helmets" ${this.shopCategory === "helmets" ? "selected" : ""}>Helme</option>
          <option value="equipment" ${this.shopCategory === "equipment" ? "selected" : ""}>Inventar</option>
        </select></label>
      </div>
      <div class="generator-shop-layout">
        <div class="generator-shop-catalog">
          <h3>Katalog <small>${GENERATOR_SHOP_ITEMS.length} kaufbare Einträge</small></h3>
          <div class="generator-shop-results" data-generator-scroll="shop-results">${filtered.map((entry) => {
            const affordable = Math.round(entry.item.price * 100) <= Math.round(shopping.remainingSilver * 100);
            return `<article class="generator-shop-result">
              <div><strong>${escapeHtml(entry.item.name)}</strong><small>${escapeHtml(this.shopItemDetails(entry))}</small></div>
              <span>${formatSilver(entry.item.price)}</span>
              <div class="generator-shop-result__actions"><button data-generator-buy="${escapeHtml(entry.catalogId)}" ${affordable ? "" : "disabled"} title="${affordable ? "Kaufen" : "Nicht genug Geld"}">Kaufen</button>${this.renderArmoryInfo(entry)}</div>
            </article>`;
          }).join("") || `<div class="empty-state">Kein passender Gegenstand gefunden.</div>`}</div>
          ${filtered.length === 60 ? `<small class="generator-result-limit">Die ersten 60 Treffer werden angezeigt. Verfeinere die Suche für weitere Ergebnisse.</small>` : ""}
        </div>
        <div class="generator-shopping-cart">
          <h3>Einkauf <small>${shopping.itemCount} Gegenstände</small></h3>
          <div class="generator-cart-list" data-generator-scroll="shopping-cart">${purchases.map(({ purchase, entry }) => `<article class="generator-cart-item">
            <div><div class="generator-shop-result__title"><strong>${escapeHtml(entry.item.name)}</strong>${this.renderArmoryInfo(entry)}</div><small>${formatSilver(entry.item.price)} je Stück · ${formatSilver(entry.item.price * purchase.amount)}</small></div>
            <div class="generator-cart-amount"><button data-generator-purchase-adjust="${escapeHtml(entry.catalogId)}" data-delta="-1" title="Ein Stück entfernen">−</button><b>${purchase.amount}</b><button data-generator-purchase-adjust="${escapeHtml(entry.catalogId)}" data-delta="1" ${Math.round(entry.item.price * 100) <= Math.round(shopping.remainingSilver * 100) ? "" : "disabled"} title="Ein Stück hinzufügen">+</button></div>
            <button class="generator-cart-remove" data-generator-remove-purchase="${escapeHtml(entry.catalogId)}" title="Aus Einkauf entfernen">×</button>
          </article>`).join("") || `<div class="empty-state">Noch nichts gekauft.</div>`}</div>
        </div>
      </div>
    </section>`;
  }

  private renderTalents(): string {
    const experience = getGeneratorExperience(this.draft);
    const balance = calculateGeneratorBalance(this.draft);
    const magical = isGeneratorMagicallyGifted(this.draft);
    const baseValues = getGeneratorBaseTalentValues(this.draft);
    const search = normalizeSearch(this.talentSearch);
    const filtered = TALENTS.filter((talent) => !search || normalizeSearch(`${talent.name} ${talent.category} ${talent.check.join(" ")}`).includes(search));
    const increasedCount = Object.keys(this.draft.talentIncreases).length;
    return `<section class="generator-page">
      <p class="eyebrow">Schritt 9</p><h2>${magical ? "Talente &amp; Zauber steigern" : "Talente erstmals steigern"}</h2>
      <p class="generator-lead">Kultur- und Professionswerte sind bereits als Ausgangswerte eingerechnet. Hier kannst du die übrigen AP vor dem Anlegen des Helden gezielt auf alle 59 Talente${magical ? " sowie auf Zauber und Rituale" : ""} verteilen.</p>
      <div class="generator-talent-summary">
        <div><span>Ausgewählte Talente</span><strong>${increasedCount}</strong></div>
        <div><span>Ausgegeben</span><strong>${balance.talents} AP</strong></div>
        <div><span>Noch verfügbar</span><strong>${balance.remaining} AP</strong></div>
        <div><span>Maximum</span><strong>FW ${experience.skillmaximum}</strong></div>
      </div>
      <label class="generator-search generator-talent-search"><span>Talent suchen</span><input id="generator-talent-search" type="search" value="${escapeHtml(this.talentSearch)}" placeholder="z. B. Klettern, Wissen, MU …" /></label>
      <div class="generator-talent-list" data-generator-scroll="talents">${filtered.map((talent) => {
        const base = baseValues[talent.id] ?? 0;
        const value = getGeneratorTalentValue(this.draft, talent.id);
        const spent = generatorTalentCostFor(this.draft, talent.id);
        const nextCost = improvementCostForTarget(talent.improvementCost, value + 1);
        const canIncrease = value < experience.skillmaximum && nextCost <= balance.remaining;
        return `<article class="generator-talent-row ${value > base ? "generator-talent-row--increased" : ""}">
          <div><strong>${escapeHtml(talent.name)}</strong><small>${escapeHtml(talent.category)} · ${talent.check.join("/")} · Spalte ${talent.improvementCost}</small></div>
          <div class="generator-talent-origin"><span>Start</span><b>${base}</b></div>
          <div class="generator-talent-controls"><button data-generator-talent-adjust="${talent.id}" data-delta="-1" ${value <= base ? "disabled" : ""} title="Um 1 senken">−</button><strong>${value}</strong><button data-generator-talent-adjust="${talent.id}" data-delta="1" ${canIncrease ? "" : "disabled"} title="${value >= experience.skillmaximum ? "Maximum erreicht" : canIncrease ? `Für ${nextCost} AP steigern` : "Nicht genug AP"}">+</button></div>
          <div class="generator-talent-cost"><span>${spent ? `${spent} AP` : "enthalten"}</span><small>${value < experience.skillmaximum ? `nächster Punkt ${nextCost} AP` : "Maximum"}</small></div>
        </article>`;
      }).join("") || `<div class="empty-state">Kein passendes Talent gefunden.</div>`}</div>
      ${magical ? this.renderSpellAdvancement(balance.remaining) : ""}
      <div class="generator-rule-note"><strong>AP-Berechnung</strong><span>Berechnet wird nur die Steigerung oberhalb der bereits enthaltenen Kultur-, Professions- und Zauberwerte. Bei einem neuen Zauber kommt zuerst die Aktivierung hinzu. Spätere Steigerungen bleiben im fertigen Bogen weiterhin unter „Steigern“ möglich.</span></div>
    </section>`;
  }

  private renderSpellAdvancement(remainingAp: number): string {
    const experience = getGeneratorExperience(this.draft);
    const baseValues = getGeneratorBaseSpellValues(this.draft);
    const selectedIds = new Set([...Object.keys(baseValues), ...Object.keys(this.draft.spellIncreases)]);
    const query = normalizeSearch(this.spellSearch);
    const visible = GENERATOR_SPELLS
      .filter((spell) => selectedIds.has(spell.id) || (query && normalizeSearch(`${spell.name} ${spell.kind} ${spell.check?.join(" ") ?? ""}`).includes(query)))
      .sort((a, b) => Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id)) || a.name.localeCompare(b.name, "de"))
      .slice(0, 60);
    const spellCount = getGeneratorSpellCount(this.draft);
    const balance = calculateGeneratorBalance(this.draft);
    return `<section class="generator-spell-advancement">
      <div class="generator-section-heading"><div><h3>Zauber &amp; Rituale</h3><small>Professionszauber sind enthalten; weitere Einträge werden zunächst aktiviert und können dann gesteigert werden.</small></div><strong>${spellCount}/${experience.maxnumberofspellsliturgies} aktiviert</strong></div>
      <div class="generator-talent-summary">
        <div><span>Zauber/Rituale</span><strong>${spellCount}</strong></div>
        <div><span>Zusätzlich ausgegeben</span><strong>${balance.spells} AP</strong></div>
        <div><span>Noch verfügbar</span><strong>${remainingAp} AP</strong></div>
        <div><span>Maximum</span><strong>FW ${experience.skillmaximum}</strong></div>
      </div>
      <label class="generator-search generator-talent-search"><span>Zauber oder Ritual suchen</span><input id="generator-spell-search" type="search" value="${escapeHtml(this.spellSearch)}" placeholder="z. B. Axxeleratus, Balsam, Ritual …" /></label>
      <div class="generator-talent-list" data-generator-scroll="spells">${visible.map((spell) => {
        const base = baseValues[spell.id] ?? 0;
        const manuallyActivated = Object.prototype.hasOwnProperty.call(this.draft.spellIncreases, spell.id);
        const selected = base > 0 || manuallyActivated;
        const value = getGeneratorSpellValue(this.draft, spell.id);
        const spent = generatorSpellCostFor(this.draft, spell.id);
        const nextCost = generatorSpellNextCost(this.draft, spell.id);
        const canActivate = selected || spellCount < experience.maxnumberofspellsliturgies;
        const canIncrease = canActivate && (!selected || value < experience.skillmaximum) && nextCost <= remainingAp;
        const canDecrease = selected && (base === 0 || value > base);
        const actionTitle = !selected
          ? canActivate ? `Für ${nextCost} AP aktivieren` : `Höchstens ${experience.maxnumberofspellsliturgies} Zauber und Rituale`
          : value >= experience.skillmaximum ? "Maximum erreicht" : `Für ${nextCost} AP steigern`;
        return `<article class="generator-talent-row ${selected ? "generator-talent-row--increased" : ""}">
          <div><strong>${escapeHtml(spell.name)}</strong><small>${escapeHtml(spell.kind)} · ${spell.check?.join("/") ?? "Probe nicht hinterlegt"} · Spalte ${spell.improvementCost}</small></div>
          <div class="generator-talent-origin"><span>Start</span><b>${base}</b></div>
          <div class="generator-talent-controls"><button data-generator-spell-adjust="${escapeHtml(spell.id)}" data-delta="-1" ${canDecrease ? "" : "disabled"} title="${base === 0 && value === 0 ? "Deaktivieren" : "Um 1 senken"}">−</button><strong>${selected ? value : "–"}</strong><button data-generator-spell-adjust="${escapeHtml(spell.id)}" data-delta="1" ${canIncrease ? "" : "disabled"} title="${escapeHtml(actionTitle)}">+</button></div>
          <div class="generator-talent-cost"><span>${spent ? `${spent} AP` : selected ? "enthalten" : "nicht aktiviert"}</span><small>${!selected ? `Aktivierung ${nextCost} AP` : value < experience.skillmaximum ? `nächster Punkt ${nextCost} AP` : "Maximum"}</small></div>
        </article>`;
      }).join("") || `<div class="empty-state">${query ? "Kein passender Zauber gefunden." : "Noch keine Professionszauber vorhanden. Nutze die Suche, um einen Zauber oder ein Ritual zu aktivieren."}</div>`}</div>
      ${visible.length === 60 ? `<small class="generator-result-limit">Die ersten 60 Treffer werden angezeigt. Verfeinere die Suche für weitere Ergebnisse.</small>` : ""}
    </section>`;
  }

  private renderReview(): string {
    const validation = validateGeneratorDraft(this.draft);
    const experience = getGeneratorExperience(this.draft);
    const race = getGeneratorRace(this.draft);
    const culture = getGeneratorCulture(this.draft);
    const profession = getGeneratorProfession(this.draft);
    const balance = calculateGeneratorBalance(this.draft);
    const shopping = calculateGeneratorShopping(this.draft);
    return `<section class="generator-page">
      <p class="eyebrow">Abschluss</p><h2>Heldenentwurf prüfen</h2>
      <div class="generator-review-grid">
        <article><span>Name</span><strong>${escapeHtml(this.draft.name || "Noch nicht eingetragen")}</strong><small>${escapeHtml(this.draft.concept || "Kein Konzept notiert")}</small></article>
        <article><span>Erfahrungsgrad</span><strong>${experience.name}</strong><small>${experience.ap} AP</small></article>
        <article><span>Herkunft</span><strong>${race.name}</strong><small>${culture.name}${this.draft.useCulturePackage ? ` · Kulturpaket ${culture.packageAp} AP` : " · ohne Kulturpaket"}</small></article>
        <article><span>Profession</span><strong>${escapeHtml(this.draft.sex === "f" ? profession.femaleName : profession.name)}</strong><small>${generatorProfessionSummary(profession)}</small></article>
        <article><span>Magische Begabung</span><strong>${isGeneratorMagicallyGifted(this.draft) ? "Ja" : "Nein"}</strong><small>${isGeneratorMagicAutomatic(this.draft) ? "durch Herkunft oder Profession vorgegeben" : "im Konzept gewählt"}</small></article>
        <article><span>Eigenschaften</span><strong>${Object.values(this.draft.attributes).reduce((sum, value) => sum + value, 0)} Punkte</strong><small>${ATTRIBUTES.map((entry) => `${entry.code} ${this.draft.attributes[entry.code]}`).join(" · ")}</small></article>
        <article><span>Zusätzliche Sonderfertigkeiten</span><strong>${this.draft.specialAbilities.length}</strong><small>${balance.specialAbilities} AP</small></article>
        <article><span>Talentsteigerungen</span><strong>${Object.keys(this.draft.talentIncreases).length} Talente</strong><small>${balance.talents} AP zusätzlich ausgegeben</small></article>
        ${isGeneratorMagicallyGifted(this.draft) ? `<article><span>Zauber &amp; Rituale</span><strong>${getGeneratorSpellCount(this.draft)} aktiviert</strong><small>${balance.spells} AP zusätzlich ausgegeben</small></article>` : ""}
        <article><span>AP-Bilanz</span><strong>${balance.remaining} AP übrig</strong><small>Vorteile ${balance.advantageLimit}/80 · Nachteile ${balance.disadvantageLimit}/80</small></article>
        <article><span>Ausrüstung</span><strong>${shopping.itemCount} Gegenstände</strong><small>${formatSilver(shopping.spentSilver)} ausgegeben · ${formatSilver(shopping.remainingSilver)} übrig · ${formatWeight(shopping.totalWeight)}</small></article>
      </div>
      ${validation.errors.length ? `<div class="generator-validation generator-validation--error"><strong>Noch zu korrigieren</strong><ul>${validation.errors.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>` : ""}
      ${validation.warnings.length ? `<div class="generator-validation generator-validation--warning"><strong>Hinweise</strong><ul>${validation.warnings.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>` : ""}
      <div class="generator-print-preview">
        <div class="generator-print-preview__mark" aria-hidden="true">PDF</div>
        <div><strong>Druckbarer Heldenbogen</strong><span>Erstellt einen eigenständigen A4-Bogen mit Stammdaten, Talenten, Kampf und Rüstkammer. Seiten für Zauber oder Liturgien werden nur ergänzt, wenn dein Held sie benötigt.</span></div>
      </div>
      <div class="generator-rule-note"><strong>Nach dem Anlegen</strong><span>Der Held wird als normaler interaktiver Bogen geöffnet. Weitere AP kannst du weiterhin im Reiter „Steigern“ ausgeben; Inventar, Waffen, Rüstung und Geld bleiben bearbeitbar.</span></div>
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
      this.renderShopping(),
      this.renderTalents(),
      this.renderReview(),
    ];
    const validation = validateGeneratorDraft(this.draft);
    return `<main class="generator-shell">
      <header class="generator-header"><div><p class="eyebrow">DSA 5 · erweiterter Professionskatalog</p><h1>Regelwerksgenerator</h1></div><div class="generator-header__actions"><button id="generator-reset" class="generator-reset-button" title="Gesamten Entwurf und das AP-Konto zurücksetzen">↺ Neu beginnen</button><button id="generator-close" class="icon-button" title="Generator schließen">×</button></div></header>
      <nav class="generator-stepper" aria-label="Schritte der Heldenerschaffung">${GENERATOR_STEPS.map((label, index) => `<button data-generator-step="${index}" class="${index === this.draft.step ? "active" : index < this.draft.step ? "done" : ""}" aria-label="Schritt ${index + 1}: ${escapeHtml(label)}" title="${index + 1}. ${escapeHtml(label)}" ${index === this.draft.step ? `aria-current="step"` : ""}><b aria-hidden="true">${index + 1}</b><span>${label}</span></button>`).join("")}</nav>
      <div class="generator-workspace"><div class="generator-main">${pages[this.draft.step] ?? pages[0]}</div>${this.renderBalance()}</div>
      <footer class="generator-footer">
        <button id="generator-cancel" class="text-button">Entwurf schließen</button>
        <div><button id="generator-previous" class="secondary-button" ${this.draft.step === 0 ? "disabled" : ""}>Zurück</button>${this.draft.step < GENERATOR_STEPS.length - 1 ? `<button id="generator-next" class="primary-button">Weiter</button>` : `<button id="generator-download-pdf" class="secondary-button" ${validation.errors.length ? "disabled" : ""}>PDF herunterladen</button><button id="generator-create" class="primary-button" ${validation.errors.length ? "disabled" : ""}>Heldenbogen anlegen</button>`}</div>
      </footer>
    </main>`;
  }

  attach(callbacks: CharacterGeneratorCallbacks): void {
    const rerender = (): void => {
      const scrollState = this.captureScrollState();
      this.persist();
      callbacks.refresh();
      this.restoreScrollState(scrollState);
    };
    const navigate = (): void => {
      this.persist();
      callbacks.refresh();
      window.scrollTo(0, 0);
    };
    document.querySelector("#generator-close")?.addEventListener("click", callbacks.cancel);
    document.querySelector("#generator-cancel")?.addEventListener("click", callbacks.cancel);
    document.querySelector("#generator-reset")?.addEventListener("click", () => {
      if (!window.confirm("Den gesamten Heldenentwurf einschließlich Einkauf wirklich zurücksetzen?")) return;
      this.reset();
      callbacks.notify("Der Charaktergenerator und das AP-Konto wurden vollständig zurückgesetzt.", "success");
      callbacks.refresh();
    });
    document.querySelectorAll<HTMLButtonElement>("[data-generator-step]").forEach((button) => button.addEventListener("click", () => {
      this.draft.step = Number(button.dataset.generatorStep ?? 0);
      navigate();
    }));
    document.querySelector("#generator-previous")?.addEventListener("click", () => { this.draft.step = Math.max(0, this.draft.step - 1); navigate(); });
    document.querySelector("#generator-next")?.addEventListener("click", () => {
      if (this.draft.step === 0 && !this.draft.name.trim()) {
        callbacks.notify("Bitte gib deinem Helden zuerst einen Namen.", "error");
        document.querySelector<HTMLInputElement>("#generator-name")?.focus();
        return;
      }
      this.draft.step = Math.min(GENERATOR_STEPS.length - 1, this.draft.step + 1);
      navigate();
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
    document.querySelectorAll<HTMLInputElement>("[data-generator-magical]").forEach((input) => input.addEventListener("change", () => {
      this.draft.magicallyGifted = input.value === "yes";
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
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
    bindValue("#generator-profession-category", (value) => { this.professionCategory = value; });
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
    attachSpecialAbilityInfoListeners();
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
    const shopSearch = document.querySelector<HTMLInputElement>("#generator-shop-search");
    shopSearch?.addEventListener("input", () => {
      this.shopSearch = shopSearch.value;
      callbacks.refresh();
      const refreshed = document.querySelector<HTMLInputElement>("#generator-shop-search");
      refreshed?.focus();
      refreshed?.setSelectionRange(this.shopSearch.length, this.shopSearch.length);
    });
    bindValue("#generator-shop-category", (value) => { this.shopCategory = value as CharacterGeneratorUI["shopCategory"]; });
    document.querySelectorAll<HTMLButtonElement>("[data-generator-buy]").forEach((button) => button.addEventListener("click", () => {
      const catalogId = button.dataset.generatorBuy;
      const entry = catalogId ? getGeneratorShopItem(catalogId) : undefined;
      if (!catalogId || !entry) return;
      const shopping = calculateGeneratorShopping(this.draft);
      if (Math.round(entry.item.price * 100) > Math.round(shopping.remainingSilver * 100)) {
        callbacks.notify("Dafür reicht das verbleibende Startkapital nicht.", "error");
        return;
      }
      const purchase = this.draft.purchases.find((item) => item.catalogId === catalogId);
      if (purchase) purchase.amount += 1;
      else this.draft.purchases.push({ catalogId, amount: 1 });
      assignGeneratorEquipmentSuggestion(this.draft, catalogId);
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-generator-buy-package]").forEach((button) => button.addEventListener("click", () => {
      const packageId = button.dataset.generatorBuyPackage;
      if (!packageId || !addEquipmentPackageToDraft(this.draft, packageId)) {
        callbacks.notify("Das Paket ist nicht verfügbar oder das Startkapital reicht nicht aus.", "error");
        return;
      }
      const definition = AVAILABLE_EQUIPMENT_PACKAGES.find((entry) => entry.id === packageId);
      for (const item of definition?.items ?? []) assignGeneratorEquipmentSuggestion(this.draft, item.catalogId);
      callbacks.notify(`${definition?.name ?? "Ausrüstungspaket"} wurde vollständig zum Einkauf hinzugefügt.`, "success");
      rerender();
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-generator-purchase-adjust]").forEach((button) => button.addEventListener("click", () => {
      const catalogId = button.dataset.generatorPurchaseAdjust;
      const purchase = this.draft.purchases.find((item) => item.catalogId === catalogId);
      const entry = catalogId ? getGeneratorShopItem(catalogId) : undefined;
      const delta = Number(button.dataset.delta ?? 0);
      if (!purchase || !entry || !delta) return;
      if (delta > 0 && Math.round(entry.item.price * 100) > Math.round(calculateGeneratorShopping(this.draft).remainingSilver * 100)) return;
      purchase.amount += delta;
      if (purchase.amount <= 0) this.draft.purchases.splice(this.draft.purchases.indexOf(purchase), 1);
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    document.querySelectorAll<HTMLButtonElement>("[data-generator-remove-purchase]").forEach((button) => button.addEventListener("click", () => {
      const index = this.draft.purchases.findIndex((item) => item.catalogId === button.dataset.generatorRemovePurchase);
      if (index >= 0) this.draft.purchases.splice(index, 1);
      rerender();
    }));
    document.querySelectorAll<HTMLSelectElement>("[data-generator-equipment-slot]").forEach((select) => select.addEventListener("change", () => {
      const slot = select.dataset.generatorEquipmentSlot as EquipmentBodySlot;
      if (select.value) this.draft.equipmentSlots[slot] = select.value;
      else delete this.draft.equipmentSlots[slot];
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    const talentSearch = document.querySelector<HTMLInputElement>("#generator-talent-search");
    talentSearch?.addEventListener("input", () => {
      this.talentSearch = talentSearch.value;
      callbacks.refresh();
      const refreshed = document.querySelector<HTMLInputElement>("#generator-talent-search");
      refreshed?.focus();
      refreshed?.setSelectionRange(this.talentSearch.length, this.talentSearch.length);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-generator-talent-adjust]").forEach((button) => button.addEventListener("click", () => {
      const talentId = button.dataset.generatorTalentAdjust;
      const delta = Number(button.dataset.delta ?? 0);
      if (!talentId || !delta) return;
      const base = getGeneratorBaseTalentValues(this.draft)[talentId] ?? 0;
      const current = getGeneratorTalentValue(this.draft, talentId);
      const target = current + delta;
      if (target <= base) delete this.draft.talentIncreases[talentId];
      else this.draft.talentIncreases[talentId] = target;
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    const spellSearch = document.querySelector<HTMLInputElement>("#generator-spell-search");
    spellSearch?.addEventListener("input", () => {
      this.spellSearch = spellSearch.value;
      callbacks.refresh();
      const refreshed = document.querySelector<HTMLInputElement>("#generator-spell-search");
      refreshed?.focus();
      refreshed?.setSelectionRange(this.spellSearch.length, this.spellSearch.length);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-generator-spell-adjust]").forEach((button) => button.addEventListener("click", () => {
      const spellId = button.dataset.generatorSpellAdjust;
      const delta = Number(button.dataset.delta ?? 0);
      if (!spellId || !delta) return;
      const base = getGeneratorBaseSpellValues(this.draft)[spellId] ?? 0;
      const current = getGeneratorSpellValue(this.draft, spellId);
      const manuallyActivated = Object.prototype.hasOwnProperty.call(this.draft.spellIncreases, spellId);
      if (delta > 0 && base === 0 && !manuallyActivated) this.draft.spellIncreases[spellId] = 0;
      else if (delta < 0 && base === 0 && manuallyActivated && current === 0) delete this.draft.spellIncreases[spellId];
      else {
        const target = current + delta;
        if (target <= base && base > 0) delete this.draft.spellIncreases[spellId];
        else this.draft.spellIncreases[spellId] = Math.max(0, target);
      }
      normalizeGeneratorDraft(this.draft);
      rerender();
    }));
    document.querySelector("#generator-download-pdf")?.addEventListener("click", () => {
      try {
        downloadPrintableCharacterPdf(buildGeneratedCharacter(this.draft));
        callbacks.notify("Der druckbare Heldenbogen wurde als PDF erstellt.", "success");
      } catch (error) {
        callbacks.notify(error instanceof Error ? error.message : "Das PDF konnte nicht erstellt werden.", "error");
      }
    });
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
