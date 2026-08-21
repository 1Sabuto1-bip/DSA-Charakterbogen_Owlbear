import "./styles.css";

import {
  ATTRIBUTES,
  COMBAT_TECHNIQUES,
  COMBAT_TECHNIQUE_RULES,
  ITEM_GROUPS,
  SPECIES,
  SPECIES_BY_ID,
  TALENTS,
  TALENT_BY_ID,
} from "./data";
import { CANTRIPS, SPELL_BY_ID } from "./magic-data";
import { DARKAID_ITEM_DATA, DARKAID_MAGIC_BY_ID, DARKAID_MAGIC_BY_SOURCE_ID } from "./darkaid-data";
import { ALL_SPELLS, ALL_SPELL_BY_ID } from "./spell-catalog";
import {
  combatTechniqueMaximum,
  improvementCostForTarget,
  talentMaximum,
} from "./advancement";
import {
  HeroImportError,
  calculateInitiative,
  createManualState,
  getAttributeValues,
  importHeroJson,
  isMagicallyGifted,
  refreshManualLifePoints,
  updateManualMagic,
  updateManualSpecies,
} from "./importer";
import { OwlbearBridge } from "./owlbear";
import { getHealthPresentation } from "./group-monitor";
import { rollTalent } from "./roll";
import { clearState, loadState, saveState } from "./storage";
import {
  calculateCombatOverview,
  getDefaultPrimaryWeaponId,
  inferCombatItemKind,
  rollInitiative,
} from "./combat";
import type {
  CharacterSheetState,
  AdvancementHistoryEntry,
  AttributeCode,
  CombatItemKind,
  ImprovementCost,
  GroupHeroSummary,
  ManualSpecies,
  OptolithItem,
  ResourceValue,
  SpellDefinition,
  TalentDefinition,
  TalentRollResult,
} from "./types";

type TabId = "overview" | "talents" | "spells" | "combat" | "inventory" | "advance" | "source" | "group";

type AdvancementSection = "attributes" | "talents" | "combat" | "spells" | "resources";
type InventorySort = "category" | "name" | "weight" | "value";

interface RollDialogState {
  kind: "talent" | "spell";
  entryId: string;
  modifier: number;
  result?: TalentRollResult;
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App container not found");

const bridge = new OwlbearBridge();
const APP_VERSION = "0.8.1";
let state: CharacterSheetState | null = loadState();
let activeTab: TabId = "overview";
let talentSearch = "";
let spellSearch = "";
let spellCatalogSearch = "";
let advancementSearch = "";
let advancementSection: AdvancementSection = "attributes";
let weaponCatalogSearch = "";
let inventorySort: InventorySort = "category";
let rollDialog: RollDialogState | null = null;
let groupMembers: GroupHeroSummary[] = [];
let groupLoading = false;
let groupDashboardOpen = false;
let groupRefreshRequest = 0;
let groupRefreshTimer: number | undefined;
let toastTimer: number | undefined;

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const asNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

const COMBAT_CATALOG = Object.entries(DARKAID_ITEM_DATA)
  .filter(([id]) => /^(meleeweapon|rangedweapon|shield|armor):/.test(id))
  .map(([id, item]) => ({ id, item }))
  .sort((a, b) => (a.item.name ?? a.id).localeCompare(b.item.name ?? b.id, "de"));

const normalizeSearch = (value: string): string => value
  .toLocaleLowerCase("de")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replaceAll("ß", "ss")
  .trim();

const combatKindLabel = (kind: CombatItemKind): string => ({
  melee: "Nahkampfwaffe",
  ranged: "Fernkampfwaffe",
  shield: "Schild",
  armor: "Rüstung",
  equipment: "Gegenstand",
})[kind];

const combatCatalogSummary = (item: Partial<OptolithItem>): string => {
  const kind = inferCombatItemKind(item as OptolithItem);
  if (kind === "armor") return `RS ${item.pro ?? 0} · BE ${item.enc ?? 0}`;
  const damage = `${item.damageDiceNumber ?? 1}W${item.damageDiceSides ?? 6}${Number(item.damageFlat ?? 0) >= 0 ? "+" : ""}${item.damageFlat ?? 0}`;
  const technique = COMBAT_TECHNIQUES[item.combatTechnique ?? ""] ?? "ohne Kampftechnik";
  if (kind === "ranged") return `${damage} TP · ${technique} · RW ${item.rangeShort ?? 0}/${item.rangeMedium ?? 0}/${item.rangeLong ?? 0}`;
  return `${damage} TP · ${technique} · AT/PA ${Number(item.at ?? 0) >= 0 ? "+" : ""}${item.at ?? 0}/${Number(item.pa ?? 0) >= 0 ? "+" : ""}${item.pa ?? 0}`;
};

const getDarkAidMagicDefinition = (id: string) => {
  const sourceId = id.startsWith("DARKAID_CANTRIP_")
    ? id.slice("DARKAID_CANTRIP_".length)
    : id.startsWith("DARKAID_SPELL_")
      ? id.slice("DARKAID_SPELL_".length)
      : "";
  return DARKAID_MAGIC_BY_ID[id] ?? (sourceId ? DARKAID_MAGIC_BY_SOURCE_ID[sourceId] : undefined);
};

const getSpellDefinition = (id: string): SpellDefinition | undefined => {
  return SPELL_BY_ID[id] ?? ALL_SPELL_BY_ID[id] ?? getDarkAidMagicDefinition(id);
};

const getCantripName = (id: string): string =>
  CANTRIPS[id] ?? getDarkAidMagicDefinition(id)?.name ?? id;

const sourceName = (sheet: CharacterSheetState): string => {
  if (sheet.source === "manual") return "Manuell angelegt";
  if (sheet.source === "darkaid") return sheet.hero.clientVersion;
  return `Optolith ${sheet.hero.clientVersion}`;
};

const showToast = (message: string, kind: "success" | "error" = "success"): void => {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast toast--${kind}`;
  toast.textContent = message;
  document.body.append(toast);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.remove(), 3600);
};

const persist = (syncToken = true): void => {
  if (!state) return;
  saveState(state);
  if (syncToken) void bridge.syncLinkedToken(state).catch(() => undefined);
};

const downloadJson = (filename: string, value: unknown): void => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const importFile = async (file?: File): Promise<void> => {
  if (!file) return;
  try {
    state = importHeroJson(await file.text());
    activeTab = "overview";
    talentSearch = "";
    spellSearch = "";
    spellCatalogSearch = "";
    persist();
    render();
    showToast(`${state.hero.name} wurde erfolgreich importiert.`);
  } catch (error) {
    const message = error instanceof HeroImportError ? error.message : "Die Datei konnte nicht gelesen werden.";
    showToast(message, "error");
  }
};

const groupMonitorVisible = (): boolean =>
  bridge.isGameMaster && (groupDashboardOpen || (Boolean(state) && activeTab === "group"));

const refreshGroupMembers = async (showLoading = true): Promise<void> => {
  if (!bridge.available || !bridge.isGameMaster) return;
  const request = ++groupRefreshRequest;
  if (showLoading) {
    groupLoading = true;
    if (groupMonitorVisible()) render();
  }
  try {
    const members = await bridge.getGroupSummaries();
    if (request !== groupRefreshRequest) return;
    groupMembers = members;
  } catch {
    if (request !== groupRefreshRequest) return;
    showToast("Die Gruppenwerte konnten nicht aus der aktuellen Szene gelesen werden.", "error");
  } finally {
    if (request === groupRefreshRequest) {
      groupLoading = false;
      if (groupMonitorVisible()) render();
    }
  }
};

const renderImportScreen = (): string => `
  <main class="welcome-shell">
    <section class="welcome-card">
      <div class="sigil" aria-hidden="true">3W20</div>
      <p class="eyebrow">Owlbear Rodeo · DSA 5</p>
      <h1>Aventurischer<br />Heldenbogen</h1>
      <p class="welcome-copy">
        Importiere einen Optolith-Helden als JSON oder einen DarkAid-Helden als TDC-Datei. Der Bogen bleibt in deinem Browser gespeichert
        und kann anschließend mit einem Charaktertoken verbunden werden.
      </p>
      <label class="drop-zone" id="drop-zone">
        <input id="hero-file" type="file" accept="application/json,.json,.tdc" hidden />
        <span class="drop-zone__icon" aria-hidden="true">⇧</span>
        <strong>JSON- oder TDC-Datei auswählen</strong>
        <span>oder hierher ziehen</span>
      </label>
      <div class="welcome-divider"><span>oder</span></div>
      <section class="manual-start" aria-labelledby="manual-start-title">
        <div>
          <strong id="manual-start-title">Kein digitaler Heldenbogen?</strong>
          <span>Lege einen leeren Bogen an und trage alle Werte selbst ein.</span>
        </div>
        <div class="manual-start__controls">
          <input id="manual-hero-name" type="text" maxlength="80" placeholder="Name des Helden" autocomplete="off" />
          <label class="manual-option"><span>Spezies</span><select id="manual-species">
            ${SPECIES.map((species) => `<option value="${species.key}">${species.name}</option>`).join("")}
          </select></label>
          <label class="manual-magic"><input id="manual-magical" type="checkbox" /><span>magisch begabt</span></label>
          <button class="primary-button" id="create-manual-hero">Bogen selbst ausfüllen</button>
        </div>
      </section>
      <div class="welcome-notes">
        <span>Version ${APP_VERSION}</span>
        <span>✓ Optolith 1.5.x</span>
        <span>✓ DarkAid TDC</span>
        <span>✓ lokale Speicherung</span>
        <span>✓ 3W20-Proben</span>
      </div>
      ${bridge.isGameMaster ? `<aside class="gm-entry">
        <div><strong>Spielleiter-Ansicht</strong><span>Verbundene Helden dieser Szene überwachen – ein eigener Heldenbogen ist nicht erforderlich.</span></div>
        <button class="secondary-button" id="open-group-monitor">Gruppenmonitor öffnen</button>
      </aside>` : ""}
    </section>
  </main>
`;

const resourceCard = (
  key: "lp" | "ae" | "kp" | "fate",
  label: string,
  short: string,
  resource: ResourceValue,
): string => {
  const ratio = resource.max > 0 ? Math.max(0, Math.min(100, (resource.current / resource.max) * 100)) : 0;
  return `
    <article class="resource-card resource-card--${key}">
      <div class="resource-card__heading">
        <span class="resource-mark">${short}</span>
        <span>${label}</span>
      </div>
      <div class="resource-controls">
        <button class="step-button" data-resource="${key}" data-delta="-1" aria-label="${label} senken">−</button>
        <label class="resource-value">
          <span class="sr-only">Aktuell</span>
          <input data-resource-current="${key}" type="number" min="0" value="${resource.current}" />
        </label>
        <span class="resource-divider">/</span>
        <label class="resource-value resource-value--max">
          <span class="sr-only">Maximum</span>
          <input data-resource-max="${key}" type="number" min="0" value="${resource.max}" />
        </label>
        <button class="step-button" data-resource="${key}" data-delta="1" aria-label="${label} erhöhen">+</button>
      </div>
      <div class="resource-track"><span style="width:${ratio}%"></span></div>
    </article>
  `;
};

const renderOverview = (sheet: CharacterSheetState): string => {
  const isManual = sheet.source === "manual";
  const attributeValues = getAttributeValues(sheet.hero);
  const { resources } = sheet.runtime;
  const hasArcane = isMagicallyGifted(sheet);
  const hasKarma = resources.kp.max > 0 || Object.keys(sheet.hero.liturgies ?? {}).length > 0;
  const family = typeof sheet.hero.pers?.family === "string" ? sheet.hero.pers.family : "—";
  const species = SPECIES_BY_ID[sheet.hero.r ?? ""];
  const manualSpecies = sheet.hero.manual?.species ?? species?.key ?? "human";
  const magical = isMagicallyGifted(sheet);

  return `
    <section class="page page--overview">
      <div class="section-title">
        <div><p class="eyebrow">Grundwerte</p><h2>Eigenschaften</h2></div>
        <span class="section-hint">${isManual ? "Werte direkt eintragen" : "Importierte Werte"}</span>
      </div>
      <div class="attribute-grid">
        ${ATTRIBUTES.map(
          (attribute) => `
            <article class="attribute-card">
              <span class="attribute-code">${attribute.code}</span>
              ${isManual
                ? `<input class="attribute-input" data-manual-attribute="${attribute.id}" type="number" min="0" max="30" value="${attributeValues[attribute.code]}" aria-label="${attribute.name}" />`
                : `<strong>${attributeValues[attribute.code]}</strong>`}
              <span>${attribute.name}</span>
            </article>`,
        ).join("")}
      </div>

      <div class="section-title section-title--resources">
        <div><p class="eyebrow">Im Spiel</p><h2>Ressourcen</h2></div>
        <span class="section-hint">Änderungen werden automatisch gespeichert</span>
      </div>
      <div class="resource-grid">
        ${resourceCard("lp", "Lebensenergie", "LeP", resources.lp)}
        ${hasArcane ? resourceCard("ae", "Astralenergie", "AsP", resources.ae) : ""}
        ${hasKarma ? resourceCard("kp", "Karmaenergie", "KaP", resources.kp) : ""}
        ${resourceCard("fate", "Schicksalspunkte", "Schip", resources.fate)}
      </div>
      ${
        !hasArcane || !hasKarma
          ? `<div class="resource-add-row">
              ${!hasArcane ? '<button class="text-button" data-enable-resource="ae">+ Astralenergie einblenden</button>' : ""}
              ${!hasKarma ? '<button class="text-button" data-enable-resource="kp">+ Karmaenergie einblenden</button>' : ""}
            </div>`
          : ""
      }

      <div class="overview-columns">
        <article class="panel">
          <div class="panel__header"><h3>Auf einen Blick</h3></div>
          <dl class="facts-grid">
            <div><dt>Initiative</dt><dd>${calculateInitiative(sheet.hero)}</dd></div>
            <div><dt>Abenteuerpunkte</dt><dd>${isManual ? `<input class="fact-input" id="manual-ap" type="number" min="0" value="${sheet.hero.ap?.total ?? 0}" aria-label="Abenteuerpunkte" />` : sheet.hero.ap?.total ?? "—"}</dd></div>
            <div><dt>Spezies</dt><dd>${isManual
              ? `<select class="fact-select" id="manual-species-sheet" aria-label="Spezies">${SPECIES.map((entry) => `<option value="${entry.key}" ${entry.key === manualSpecies ? "selected" : ""}>${entry.name}</option>`).join("")}</select>`
              : escapeHtml(species?.name ?? sheet.hero.r ?? "—")}</dd></div>
            <div><dt>Magie</dt><dd>${isManual
              ? `<label class="fact-toggle"><input id="manual-magical-sheet" type="checkbox" ${magical ? "checked" : ""} ${manualSpecies === "elf" ? "disabled" : ""} /><span>${manualSpecies === "elf" ? "automatisch" : "magisch begabt"}</span></label>`
              : magical ? "magisch begabt" : "nicht magisch"}</dd></div>
            ${isManual ? `<div><dt>Erstellung</dt><dd>Manuell</dd></div>` : `<div><dt>Familie</dt><dd>${escapeHtml(family)}</dd></div>`}
            <div><dt>Zauber</dt><dd>${Object.keys(sheet.hero.spells ?? {}).length}</dd></div>
          </dl>
        </article>
        <article class="panel">
          <div class="panel__header">
            <h3>Owlbear-Token</h3>
            <span class="connection-dot ${bridge.available ? "connection-dot--online" : ""}"></span>
          </div>
          <p class="panel-copy">
            ${
              sheet.runtime.linkedTokenId
                ? `Verknüpft mit <strong>${escapeHtml(sheet.runtime.linkedTokenName ?? "Charaktertoken")}</strong>. Ressourcen, Grund- und Kampfwerte werden übertragen${sheet.runtime.statusDisplayId ? "; die Kartenanzeige ist aktiv." : "."}`
                : bridge.available
                  ? "Wähle einen Charaktertoken auf der Karte aus und verbinde ihn mit diesem Bogen."
                  : "In der Browser-Vorschau ist keine Owlbear-Szene verbunden."
            }
          </p>
          <div class="button-row">
            <button class="secondary-button" id="link-token" ${bridge.available ? "" : "disabled"}>
              ${sheet.runtime.linkedTokenId ? "Anderen Token verbinden" : "Ausgewählten Token verbinden"}
            </button>
            ${sheet.runtime.linkedTokenId ? `<button class="primary-button" id="sync-status-display" ${bridge.available ? "" : "disabled"}>${sheet.runtime.statusDisplayId ? "Kartenanzeige aktualisieren" : "Kartenanzeige erstellen"}</button>` : ""}
          </div>
        </article>
      </div>

      <article class="panel notes-panel">
        <div class="panel__header"><h3>Notizen</h3><span>privat im Browser</span></div>
        <textarea id="hero-notes" placeholder="Wunden, Zustände, Absprachen oder Erinnerungen …">${escapeHtml(sheet.runtime.notes)}</textarea>
      </article>
    </section>
  `;
};

const renderTalentRow = (
  definition: TalentDefinition,
  value: number,
  favorite: boolean,
  editable: boolean,
): string => `
  <div class="talent-row">
    <button class="favorite-button ${favorite ? "favorite-button--active" : ""}" data-favorite="${definition.id}" aria-label="Favorit umschalten">★</button>
    <div class="talent-name"><strong>${escapeHtml(definition.name)}</strong><span>${definition.category}</span></div>
    <div class="check-badges" aria-label="Probe ${definition.check.join(" ")}">
      ${definition.check.map((attribute) => `<span>${attribute}</span>`).join("")}
    </div>
    ${editable
      ? `<input class="talent-value talent-value-input" data-manual-talent="${definition.id}" type="number" min="0" max="30" value="${value}" aria-label="Fertigkeitswert ${escapeHtml(definition.name)}" />`
      : `<span class="talent-value" title="Fertigkeitswert">${value}</span>`}
    <button class="roll-button" data-roll-talent="${definition.id}">3W20</button>
  </div>
`;

const renderTalents = (sheet: CharacterSheetState): string => {
  const favorites = new Set(sheet.runtime.favoriteTalentIds);
  const query = talentSearch.trim().toLocaleLowerCase("de");
  const entries = TALENTS
    .map((definition) => ({ definition, value: sheet.hero.talents[definition.id] ?? 0 }))
    .filter((entry) => !query || entry.definition.name.toLocaleLowerCase("de").includes(query))
    .sort((a, b) => {
      const favoriteDifference = Number(favorites.has(b.definition.id)) - Number(favorites.has(a.definition.id));
      return favoriteDifference || a.definition.name.localeCompare(b.definition.name, "de");
    });

  const categories = ["Körper", "Gesellschaft", "Natur", "Wissen", "Handwerk"] as const;

  return `
    <section class="page page--talents">
      <div class="section-title">
        <div><p class="eyebrow">3W20-Proben</p><h2>Talente</h2></div>
        <span class="section-hint">Stern = Favorit</span>
      </div>
      <label class="search-box">
        <span aria-hidden="true">⌕</span>
        <input id="talent-search" type="search" value="${escapeHtml(talentSearch)}" placeholder="Talent suchen …" autocomplete="off" />
      </label>
      <div class="talent-list">
        ${categories
          .map((category) => {
            const categoryEntries = entries.filter((entry) => entry.definition.category === category);
            if (categoryEntries.length === 0) return "";
            return `<section class="talent-group">
              <h3>${category}<span>${categoryEntries.length}</span></h3>
              ${categoryEntries
                .map((entry) => renderTalentRow(entry.definition, entry.value, favorites.has(entry.definition.id), sheet.source === "manual"))
                .join("")}
            </section>`;
          })
          .join("") || '<div class="empty-state">Kein passendes Talent gefunden.</div>'}
      </div>
    </section>
  `;
};

const renderSpellRow = (
  id: string,
  definition: SpellDefinition | undefined,
  value: number,
  editable: boolean,
): string => {
  const name = definition?.name ?? id;
  const check = definition?.check;
  const definitionSummary = definition
    ? `${definition.kind} · Steigerungsfaktor ${definition.improvementCost}${definition.checkModifier ? ` · mod. ${definition.checkModifier}` : ""}${check ? "" : " · Probe nicht hinterlegt"}`
    : "Unbekannte Zauberkennung";
  return `
    <div class="talent-row spell-row">
      <span class="spell-sigil" aria-hidden="true">✦</span>
      <div class="talent-name"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(definitionSummary)}</span></div>
      <div class="check-badges" aria-label="${check ? `Probe ${check.join(" ")}` : "Probe nicht hinterlegt"}">
        ${check ? check.map((attribute) => `<span>${attribute}</span>`).join("") : '<span>?</span><span>?</span><span>?</span>'}
      </div>
      ${editable
        ? `<input class="talent-value talent-value-input" data-manual-spell="${escapeHtml(id)}" type="number" min="0" max="30" value="${value}" aria-label="Fertigkeitswert ${escapeHtml(name)}" />`
        : `<span class="talent-value" title="Fertigkeitswert">${value}</span>`}
      <button class="roll-button" data-roll-spell="${escapeHtml(id)}" ${check ? "" : "disabled"} title="${check ? "Zauberprobe würfeln" : "Für diesen Eintrag ist keine Probe hinterlegt"}">3W20</button>
      ${editable ? `<button class="spell-delete" data-delete-spell="${escapeHtml(id)}" title="Zauber entfernen" aria-label="${escapeHtml(name)} entfernen">×</button>` : ""}
    </div>`;
};

const renderSpells = (sheet: CharacterSheetState): string => {
  const editable = sheet.source === "manual";
  const query = normalizeSearch(spellSearch);
  const catalogQuery = normalizeSearch(spellCatalogSearch);
  const learnedSpellIds = Object.keys(sheet.hero.spells ?? {});
  const spellEntries = learnedSpellIds
    .map((id) => ({ id, definition: getSpellDefinition(id), value: sheet.hero.spells?.[id] ?? 0 }))
    .filter((entry) => !query || normalizeSearch(entry.definition?.name ?? entry.id).includes(query))
    .sort((a, b) => (a.definition?.name ?? a.id).localeCompare(b.definition?.name ?? b.id, "de"));
  const learnedCantrips = (sheet.hero.cantrips ?? [])
    .map((id) => ({ id, name: getCantripName(id) }))
    .filter((entry) => !query || normalizeSearch(entry.name).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const catalogMatches = catalogQuery
    ? ALL_SPELLS
      .filter((definition) => !learnedSpellIds.includes(definition.id))
      .filter((definition) => normalizeSearch(`${definition.name} ${definition.kind}`).includes(catalogQuery))
      .slice(0, 30)
    : [];
  const availableCantrips = Object.entries(CANTRIPS)
    .filter(([id]) => !(sheet.hero.cantrips ?? []).includes(id))
    .sort((a, b) => a[1].localeCompare(b[1], "de"));

  return `
    <section class="page page--spells">
      <div class="section-title">
        <div><p class="eyebrow">Astrale Künste</p><h2>Zaubersprüche</h2></div>
        <span class="section-hint">${spellEntries.length} Zauber · ${learnedCantrips.length} Zaubertricks</span>
      </div>
      <label class="search-box">
        <span aria-hidden="true">⌕</span>
        <input id="spell-search" type="search" value="${escapeHtml(spellSearch)}" placeholder="Zauber oder Zaubertrick suchen …" autocomplete="off" />
      </label>
      ${editable ? `<article class="spell-library-panel">
        <div class="spell-library-search">
          <label for="spell-catalog-search"><span>Zauber oder Ritual aus dem Gesamtkatalog suchen</span></label>
          <div class="search-input"><span aria-hidden="true">⌕</span><input id="spell-catalog-search" type="search" value="${escapeHtml(spellCatalogSearch)}" placeholder="z. B. Axxeleratus, Balsam, Ritual …" autocomplete="off" /></div>
          <small>${catalogQuery ? `${catalogMatches.length}${catalogMatches.length === 30 ? "+" : ""} Treffer angezeigt` : `${ALL_SPELLS.length} Zauber und Rituale durchsuchbar`}</small>
        </div>
        ${catalogQuery ? `<div class="spell-search-results">
          ${catalogMatches.map((definition) => `<article class="spell-search-result">
            <span class="spell-search-result__kind">${definition.kind}</span>
            <div><strong>${escapeHtml(definition.name)}</strong><small>${definition.check ? `Probe ${definition.check.join("/")} · Faktor ${definition.improvementCost}` : `Probe nicht hinterlegt · Faktor ${definition.improvementCost}`}</small></div>
            <button class="secondary-button" data-import-spell="${escapeHtml(definition.id)}">Importieren</button>
          </article>`).join("") || '<div class="empty-state">Kein noch nicht eingetragener Zauber gefunden.</div>'}
        </div>` : '<p class="catalog-help">Suchbegriff eingeben und den gewünschten Zauber direkt importieren.</p>'}
      </article>` : ""}
      <div class="talent-list spell-list">
        ${(["Zauber", "Ritual"] as const).map((kind) => {
          const entries = spellEntries.filter((entry) => entry.definition?.kind === kind || (kind === "Zauber" && !entry.definition));
          if (!entries.length) return "";
          return `<section class="talent-group"><h3>${kind === "Zauber" ? "Zaubersprüche" : "Rituale"}<span>${entries.length}</span></h3>${entries.map((entry) => renderSpellRow(entry.id, entry.definition, entry.value, editable)).join("")}</section>`;
        }).join("") || '<div class="empty-state">Noch keine Zaubersprüche eingetragen.</div>'}
      </div>

      <div class="section-title section-title--resources"><div><p class="eyebrow">Kleine Magie</p><h2>Zaubertricks</h2></div></div>
      ${editable ? `<article class="spell-add-panel">
        <label><span>Zaubertrick hinzufügen</span><select id="cantrip-catalog-select" ${availableCantrips.length ? "" : "disabled"}>
          ${availableCantrips.map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join("") || '<option>Alle Zaubertricks hinzugefügt</option>'}
        </select></label>
        <button class="secondary-button" id="add-cantrip" ${availableCantrips.length ? "" : "disabled"}>+ Zaubertrick</button>
      </article>` : ""}
      <div class="cantrip-list">
        ${learnedCantrips.map((entry) => `<article class="cantrip-card"><span aria-hidden="true">✧</span><strong>${escapeHtml(entry.name)}</strong>${editable ? `<button class="spell-delete" data-delete-cantrip="${escapeHtml(entry.id)}" title="Zaubertrick entfernen" aria-label="${escapeHtml(entry.name)} entfernen">×</button>` : ""}</article>`).join("") || '<div class="empty-state">Keine Zaubertricks eingetragen.</div>'}
      </div>
    </section>`;
};

const combatInput = (
  key: string,
  field: string,
  value: unknown,
  label: string,
  options: { min?: number; max?: number; step?: number } = {},
): string => `<label class="combat-field"><span>${label}</span><input data-combat-key="${escapeHtml(key)}" data-combat-field="${field}" type="number" value="${escapeHtml(value ?? 0)}" min="${options.min ?? 0}" ${options.max === undefined ? "" : `max="${options.max}"`} step="${options.step ?? 1}" /></label>`;

const combatTechniqueOptions = (selected: string | undefined, range?: "melee" | "ranged"): string =>
  Object.values(COMBAT_TECHNIQUE_RULES)
    .filter((definition) => !range || definition.range === range)
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((definition) => `<option value="${definition.id}" ${definition.id === selected ? "selected" : ""}>${escapeHtml(definition.name)}</option>`)
    .join("");

const renderWeaponEditor = (
  key: string,
  item: OptolithItem,
  kind: "melee" | "ranged" | "shield",
  isPrimary: boolean,
): string => {
  const techniqueRange = kind === "ranged" ? "ranged" : "melee";
  const techniqueOptions = kind === "shield"
    ? `<option value="CT_10" selected>Schilde</option>`
    : combatTechniqueOptions(item.combatTechnique, techniqueRange);
  const kindIcon = kind === "ranged" ? "➶" : kind === "shield" ? "◒" : "⚔";
  return `<article class="combat-editor combat-editor--${kind}">
    <div class="combat-editor__header">
      <span class="weapon-icon">${kindIcon}</span>
      <label><span>Name</span><input class="combat-name-input" data-combat-key="${escapeHtml(key)}" data-combat-field="name" value="${escapeHtml(item.name)}" /></label>
      <span class="combat-kind">${combatKindLabel(kind)}</span>
      <label class="primary-weapon-toggle" title="Diese Waffe für die Werte oben verwenden"><input type="radio" name="primary-weapon" data-primary-weapon="${escapeHtml(key)}" ${isPrimary ? "checked" : ""} /><span>Primär</span></label>
      <button class="inventory-delete" data-delete-combat="${escapeHtml(key)}" title="${escapeHtml(item.name)} löschen">×</button>
    </div>
    <div class="combat-editor__grid">
      <label class="combat-field combat-field--wide"><span>Kampftechnik</span><select data-combat-key="${escapeHtml(key)}" data-combat-field="combatTechnique">${techniqueOptions}</select></label>
      <fieldset class="damage-field"><legend>Trefferpunkte</legend>
        <input data-combat-key="${escapeHtml(key)}" data-combat-field="damageDiceNumber" type="number" min="0" max="9" value="${item.damageDiceNumber ?? 1}" aria-label="Anzahl Schadenswürfel" />
        <span>W</span>
        <input data-combat-key="${escapeHtml(key)}" data-combat-field="damageDiceSides" type="number" min="0" max="100" value="${item.damageDiceSides ?? 6}" aria-label="Seiten des Schadenswürfels" />
        <span>+</span>
        <input data-combat-key="${escapeHtml(key)}" data-combat-field="damageFlat" type="number" min="-20" max="50" value="${item.damageFlat ?? 0}" aria-label="Fester Schadensbonus" />
      </fieldset>
      ${kind === "ranged"
        ? `${combatInput(key, "reloadTime", item.reloadTime, "Ladezeit", { max: 99 })}
          ${combatInput(key, "rangeShort", item.rangeShort, "RW kurz", { max: 999 })}
          ${combatInput(key, "rangeMedium", item.rangeMedium, "RW mittel", { max: 999 })}
          ${combatInput(key, "rangeLong", item.rangeLong, "RW weit", { max: 999 })}
          <label class="combat-field"><span>Munition</span><input data-combat-key="${escapeHtml(key)}" data-combat-field="ammunition" value="${escapeHtml(item.ammunition ?? "")}" placeholder="Pfeile, Bolzen …" /></label>`
        : `${combatInput(key, "at", item.at, "AT-Mod.", { min: -20, max: 20 })}
          ${combatInput(key, "pa", item.pa, "PA-Mod.", { min: -20, max: 20 })}
          <label class="combat-field"><span>Reichweite</span><select data-combat-key="${escapeHtml(key)}" data-combat-field="reach">
            <option value="1" ${(item.reach ?? 2) === 1 ? "selected" : ""}>kurz</option>
            <option value="2" ${(item.reach ?? 2) === 2 ? "selected" : ""}>mittel</option>
            <option value="3" ${(item.reach ?? 2) === 3 ? "selected" : ""}>lang</option>
          </select></label>
          ${combatInput(key, "damageThreshold", item.damageThreshold, "TP-Schwelle", { max: 30 })}
          <label class="combat-field"><span>Leiteigenschaft</span><select data-combat-key="${escapeHtml(key)}" data-combat-field="damageBonusAttribute">
            ${ATTRIBUTES.map((attribute) => `<option value="${attribute.code}" ${(item.damageBonusAttribute ?? "KK") === attribute.code ? "selected" : ""}>${attribute.code}</option>`).join("")}
          </select></label>`}
      ${combatInput(key, "amount", item.amount ?? 1, "Anzahl", { max: 999 })}
      ${combatInput(key, "weight", item.weight, "Gewicht", { max: 999, step: 0.01 })}
      ${combatInput(key, "price", item.price, "Preis (S)", { max: 999999, step: 0.01 })}
      ${combatInput(key, "length", item.length, "Länge", { max: 999, step: 0.1 })}
      <label class="combat-field combat-field--check"><input data-combat-key="${escapeHtml(key)}" data-combat-field="equipped" type="checkbox" ${item.equipped === false ? "" : "checked"} /><span>ausgerüstet</span></label>
      <label class="combat-field combat-field--notes"><span>Notizen / Besonderheiten</span><textarea data-combat-key="${escapeHtml(key)}" data-combat-field="notes">${escapeHtml(item.notes ?? "")}</textarea></label>
    </div>
  </article>`;
};

const renderArmorEditor = (key: string, item: OptolithItem): string => `<article class="combat-editor combat-editor--armor">
  <div class="combat-editor__header">
    <span class="weapon-icon">⬟</span>
    <label><span>Name</span><input class="combat-name-input" data-combat-key="${escapeHtml(key)}" data-combat-field="name" value="${escapeHtml(item.name)}" /></label>
    <span class="combat-kind">Rüstung</span>
    <button class="inventory-delete" data-delete-combat="${escapeHtml(key)}" title="${escapeHtml(item.name)} löschen">×</button>
  </div>
  <div class="combat-editor__grid">
    ${combatInput(key, "pro", item.pro, "Rüstungsschutz", { max: 20 })}
    ${combatInput(key, "enc", item.enc, "Belastung", { max: 10 })}
    ${combatInput(key, "movementPenalty", item.movementPenalty, "GS-Abzug", { min: -20, max: 0 })}
    ${combatInput(key, "initiativePenalty", item.initiativePenalty, "INI-Abzug", { min: -20, max: 0 })}
    ${combatInput(key, "amount", item.amount ?? 1, "Anzahl", { max: 99 })}
    ${combatInput(key, "weight", item.weight, "Gewicht", { max: 999, step: 0.01 })}
    ${combatInput(key, "price", item.price, "Preis (S)", { max: 999999, step: 0.01 })}
    <label class="combat-field combat-field--check"><input data-combat-key="${escapeHtml(key)}" data-combat-field="equipped" type="checkbox" ${item.equipped === false ? "" : "checked"} /><span>getragen</span></label>
    <label class="combat-field combat-field--notes"><span>Notizen / Vor- und Nachteile</span><textarea data-combat-key="${escapeHtml(key)}" data-combat-field="notes">${escapeHtml(item.notes ?? "")}</textarea></label>
  </div>
</article>`;

const renderCombat = (sheet: CharacterSheetState): string => {
  const isManual = sheet.source === "manual";
  const techniqueIds = isManual ? Object.keys(COMBAT_TECHNIQUES) : Object.keys(sheet.hero.ct ?? {});
  const techniques = techniqueIds
    .map((id) => [id, sheet.hero.ct?.[id] ?? 0] as const)
    .sort((a, b) => isManual
      ? (COMBAT_TECHNIQUES[a[0]] ?? a[0]).localeCompare(COMBAT_TECHNIQUES[b[0]] ?? b[0], "de")
      : b[1] - a[1]);
  const combatItems = Object.entries(sheet.hero.belongings?.items ?? {})
    .map(([key, item]) => ({ key, item, kind: inferCombatItemKind(item) }))
    .filter((entry) => entry.kind !== "equipment")
    .sort((a, b) => a.item.name.localeCompare(b.item.name, "de"));
  const weapons = combatItems.filter((entry) => entry.kind !== "armor");
  const armor = combatItems.filter((entry) => entry.kind === "armor");
  const overview = calculateCombatOverview(
    sheet.hero,
    sheet.runtime.combat.primaryWeaponId,
    sheet.runtime.combat.initiativeModifier,
  );
  const query = normalizeSearch(weaponCatalogSearch);
  const catalogMatches = query
    ? COMBAT_CATALOG.filter(({ id, item }) => normalizeSearch(`${item.name ?? ""} ${id} ${combatKindLabel(inferCombatItemKind(item as OptolithItem))}`).includes(query)).slice(0, 24)
    : [];
  const lastInitiative = sheet.runtime.combat.lastInitiativeRoll;

  return `
    <section class="page page--combat">
      <section class="combat-overview" aria-label="Aktuelle Kampfwerte">
        <div class="combat-overview__weapon">
          <span>Primärwaffe</span>
          <strong>${escapeHtml(overview.primaryWeaponName)}</strong>
          <small>${escapeHtml(overview.combatTechniqueName)}</small>
        </div>
        <div class="combat-stat"><span>${overview.attackLabel}</span><strong>${overview.attack}</strong><small>${overview.attackLabel === "FK" ? "Fernkampf" : "Attacke"}</small></div>
        <div class="combat-stat"><span>PA</span><strong>${overview.parry ?? "—"}</strong><small>Parade</small></div>
        <div class="combat-stat"><span>AW</span><strong>${overview.dodge}</strong><small>Ausweichen</small></div>
        <div class="combat-stat combat-stat--initiative"><span>INI</span><strong>${overview.initiative}</strong><small>Basis ${overview.initiativeBase}${overview.armorModifier ? ` · Rüstung ${overview.armorModifier}` : ""}</small></div>
        <div class="initiative-control">
          <label><span>Weiterer Mod.</span><input id="initiative-modifier" type="number" min="-20" max="20" value="${sheet.runtime.combat.initiativeModifier}" /></label>
          <button class="initiative-roll-button" id="roll-initiative"><span aria-hidden="true">⚄</span> Initiative würfeln</button>
          ${lastInitiative ? `<output class="initiative-result"><span>Letzter Wurf</span><strong>${lastInitiative.total}</strong><small>${lastInitiative.base} ${lastInitiative.armorModifier >= 0 ? "+" : ""}${lastInitiative.armorModifier} ${lastInitiative.manualModifier >= 0 ? "+" : ""}${lastInitiative.manualModifier} + W6 (${lastInitiative.die})</small></output>` : '<span class="initiative-placeholder">Noch nicht ausgewürfelt</span>'}
        </div>
      </section>

      <div class="section-title"><div><p class="eyebrow">Kampfwerte</p><h2>Kampftechniken</h2></div><span class="section-hint">Steigerungen erfolgen im Reiter „Steigern“</span></div>
      <div class="technique-grid">
        ${techniques.map(([id, value]) => `<article class="technique-card">
          <span>${escapeHtml(COMBAT_TECHNIQUES[id] ?? id)}</span>${isManual ? `<input data-manual-technique="${id}" type="number" min="0" max="30" value="${value}" aria-label="Kampftechnik ${escapeHtml(COMBAT_TECHNIQUES[id] ?? id)}" />` : `<strong>${value}</strong>`}<small>Ktw</small>
        </article>`).join("") || '<div class="empty-state">Keine Kampftechniken importiert.</div>'}
      </div>

      <div class="section-title section-title--resources">
        <div><p class="eyebrow">Ausrüstung</p><h2>Waffen & Rüstungen</h2></div>
        <span class="section-hint">Regelvorlage wählen oder frei anlegen</span>
      </div>
      <article class="combat-add-panel">
        <div class="combat-library-search">
          <label for="weapon-catalog-search"><span>Waffe oder Rüstung suchen</span></label>
          <div class="search-input"><span>⌕</span><input id="weapon-catalog-search" type="search" value="${escapeHtml(weaponCatalogSearch)}" placeholder="z. B. Langschwert, Bogen, Kettenhemd …" autocomplete="off" /></div>
          <small>${query ? `${catalogMatches.length}${catalogMatches.length === 24 ? "+" : ""} Treffer angezeigt` : `${COMBAT_CATALOG.length} Vorlagen durchsuchbar`}</small>
        </div>
        ${query ? `<div class="combat-search-results">
          ${catalogMatches.map(({ id, item }) => `<article class="combat-search-result">
            <span class="combat-search-result__kind">${escapeHtml(combatKindLabel(inferCombatItemKind(item as OptolithItem)))}</span>
            <div><strong>${escapeHtml(item.name ?? id)}</strong><small>${escapeHtml(combatCatalogSummary(item))}</small></div>
            <button class="secondary-button" data-import-combat-template="${escapeHtml(id)}">Importieren</button>
          </article>`).join("") || '<div class="empty-state">Keine passende Waffe oder Rüstung gefunden.</div>'}
        </div>` : '<div class="combat-search-hint">Suchbegriff eingeben und den passenden Eintrag mit einem Klick importieren.</div>'}
        <div class="combat-add-panel__blank">
          <span>Oder frei anlegen:</span>
          <button class="secondary-button" data-add-combat-kind="melee">+ Nahkampf</button>
          <button class="secondary-button" data-add-combat-kind="ranged">+ Fernkampf</button>
          <button class="secondary-button" data-add-combat-kind="shield">+ Schild</button>
          <button class="secondary-button" data-add-combat-kind="armor">+ Rüstung</button>
        </div>
      </article>

      <div class="weapon-list">
        ${weapons.map(({ key, item, kind }) => renderWeaponEditor(key, item, kind as "melee" | "ranged" | "shield", overview.primaryWeaponId === key)).join("") || '<div class="empty-state">Noch keine Waffen oder Schilde eingetragen. Ohne Auswahl werden die Werte für Raufen angezeigt.</div>'}
      </div>
      <div class="section-title section-title--resources"><div><p class="eyebrow">Schutz</p><h2>Rüstungen</h2></div></div>
      <div class="armor-editor-list">
        ${armor.map(({ key, item }) => renderArmorEditor(key, item)).join("") || '<div class="empty-state">Noch keine Rüstung eingetragen.</div>'}
      </div>
    </section>
  `;
};

const renderInventory = (sheet: CharacterSheetState): string => {
  const items = Object.entries(sheet.hero.belongings?.items ?? {})
    .map(([key, item]) => ({ key, item }));
  const categoryName = (item: OptolithItem): string => ITEM_GROUPS[item.gr ?? 0] ?? "Sonstiges";
  items.sort((a, b) => {
    if (inventorySort === "weight") return ((b.item.weight ?? 0) * (b.item.amount ?? 1)) - ((a.item.weight ?? 0) * (a.item.amount ?? 1)) || a.item.name.localeCompare(b.item.name, "de");
    if (inventorySort === "value") return ((b.item.price ?? 0) * (b.item.amount ?? 1)) - ((a.item.price ?? 0) * (a.item.amount ?? 1)) || a.item.name.localeCompare(b.item.name, "de");
    if (inventorySort === "category") {
      const groupA = ITEM_GROUPS[a.item.gr ?? 0] ? Number(a.item.gr) : 99;
      const groupB = ITEM_GROUPS[b.item.gr ?? 0] ? Number(b.item.gr) : 99;
      return groupA - groupB || a.item.name.localeCompare(b.item.name, "de");
    }
    return a.item.name.localeCompare(b.item.name, "de");
  });
  const purse = sheet.hero.belongings?.purse ?? {};
  const totalWeight = items.reduce((sum, entry) => sum + (entry.item.weight ?? 0) * (entry.item.amount ?? 1), 0);
  let previousCategory = "";
  const itemRows = items.map(({ key, item }) => {
    const category = categoryName(item);
    const categoryRow = inventorySort === "category" && category !== previousCategory
      ? `<tr class="inventory-category-row"><th colspan="5"><span>${escapeHtml(category)}</span><small>${items.filter((entry) => categoryName(entry.item) === category).length} Einträge</small></th></tr>`
      : "";
    previousCategory = category;
    return `${categoryRow}<tr>
      <td class="inventory-item-cell">
        <input class="inventory-name-input" data-inventory-key="${escapeHtml(key)}" data-inventory-field="name" value="${escapeHtml(item.name)}" aria-label="Gegenstand" />
        <select data-inventory-key="${escapeHtml(key)}" data-inventory-field="gr" aria-label="Kategorie">
          ${Object.entries(ITEM_GROUPS).map(([groupId, groupName]) => `<option value="${groupId}" ${Number(groupId) === (item.gr ?? 0) ? "selected" : ""}>${escapeHtml(groupName)}</option>`).join("")}
          <option value="0" ${ITEM_GROUPS[item.gr ?? 0] ? "" : "selected"}>Sonstiges</option>
        </select>
      </td>
      <td><input class="inventory-number-input" data-inventory-key="${escapeHtml(key)}" data-inventory-field="amount" type="number" min="0" step="1" value="${item.amount ?? 1}" aria-label="Anzahl" /></td>
      <td><input class="inventory-number-input" data-inventory-key="${escapeHtml(key)}" data-inventory-field="weight" type="number" min="0" step="0.01" value="${item.weight ?? 0}" aria-label="Gewicht in Stein" /></td>
      <td><input class="inventory-number-input" data-inventory-key="${escapeHtml(key)}" data-inventory-field="price" type="number" min="0" step="0.01" value="${item.price ?? 0}" aria-label="Wert" /></td>
      <td><button class="inventory-delete" data-delete-inventory="${escapeHtml(key)}" title="Gegenstand löschen" aria-label="${escapeHtml(item.name)} löschen">×</button></td>
    </tr>`;
  }).join("");

  return `
    <section class="page page--inventory">
      <div class="section-title">
        <div><p class="eyebrow">Hab und Gut</p><h2>Inventar</h2></div>
        <div class="inventory-heading-actions">
          <span class="section-hint">${formatNumber(totalWeight)} Stein</span>
          <label class="inventory-sort"><span>Sortierung</span><select id="inventory-sort">
            <option value="category" ${inventorySort === "category" ? "selected" : ""}>Kategorien</option>
            <option value="name" ${inventorySort === "name" ? "selected" : ""}>Name A–Z</option>
            <option value="weight" ${inventorySort === "weight" ? "selected" : ""}>Gewicht</option>
            <option value="value" ${inventorySort === "value" ? "selected" : ""}>Wert</option>
          </select></label>
          <button class="primary-button inventory-add" id="add-inventory-item">+ Gegenstand</button>
        </div>
      </div>
      <div class="purse" aria-label="Geldbörse">
        ${[
          ["d", "D", "Dukaten"],
          ["s", "S", "Silbertaler"],
          ["h", "H", "Heller"],
          ["k", "K", "Kreuzer"],
        ]
          .map(
            ([key, short, label]) => `<label title="${label}"><span>${short}</span><input data-purse="${key}" value="${escapeHtml(purse[key as keyof typeof purse] || "0")}" inputmode="decimal" aria-label="${label}" /></label>`,
          )
          .join("")}
      </div>
      <div class="inventory-table-wrap">
        <table class="inventory-table">
          <thead><tr><th>Gegenstand</th><th>Anzahl</th><th>Gewicht</th><th>Wert</th><th></th></tr></thead>
          <tbody>
            ${itemRows || '<tr><td colspan="5" class="empty-state">Noch keine Gegenstände vorhanden.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const advancementRow = (options: {
  kind: "attribute" | "talent" | "combatTechnique" | "spell" | "resource";
  id: string;
  label: string;
  detail: string;
  current: number;
  cost?: number;
  maximum?: number;
  disabledReason?: string;
  availableAp: number;
  ignoreLimits: boolean;
}): string => {
  const atMaximum = options.maximum !== undefined && options.current >= options.maximum && !options.ignoreLimits;
  const reason = options.disabledReason
    ?? (atMaximum ? `Maximum ${options.maximum}` : undefined)
    ?? (options.cost !== undefined && options.cost > options.availableAp ? "Nicht genügend AP" : undefined);
  return `<div class="advance-row">
    <div class="advance-row__name"><strong>${escapeHtml(options.label)}</strong><span>${escapeHtml(options.detail)}</span></div>
    <span class="advance-row__value">${options.current} <i>→</i> ${options.current + 1}</span>
    <span class="advance-row__cost">${options.cost === undefined ? "—" : `${options.cost} AP`}</span>
    <button class="advance-button" data-advance-kind="${options.kind}" data-advance-id="${escapeHtml(options.id)}" ${reason ? "disabled" : ""} title="${escapeHtml(reason ?? `${options.label} steigern`)}">+1</button>
    ${reason ? `<small class="advance-row__reason">${escapeHtml(reason)}</small>` : ""}
  </div>`;
};

const renderAdvance = (sheet: CharacterSheetState): string => {
  const advancement = sheet.runtime.advancement;
  const attributes = getAttributeValues(sheet.hero);
  const query = advancementSearch.trim().toLocaleLowerCase("de");
  const filterName = (name: string): boolean => !query || name.toLocaleLowerCase("de").includes(query);
  const sections: Array<{ id: AdvancementSection; label: string; icon: string }> = [
    { id: "attributes", label: "Eigenschaften", icon: "◆" },
    { id: "talents", label: "Talente", icon: "◈" },
    { id: "combat", label: "Kampf", icon: "⚔" },
    { id: "spells", label: "Zauber", icon: "✦" },
    { id: "resources", label: "Energien", icon: "♥" },
  ];

  let rows = "";
  if (advancementSection === "attributes") {
    rows = ATTRIBUTES.filter((definition) => filterName(definition.name)).map((definition) => {
      const current = attributes[definition.code];
      return advancementRow({
        kind: "attribute",
        id: definition.id,
        label: definition.name,
        detail: `${definition.code} · Steigerungsfaktor E`,
        current,
        cost: improvementCostForTarget("E", current + 1),
        maximum: 25,
        availableAp: advancement.availableAp,
        ignoreLimits: advancement.ignoreLimits,
      });
    }).join("");
  } else if (advancementSection === "talents") {
    rows = TALENTS.filter((definition) => filterName(definition.name)).map((definition) => {
      const current = sheet.hero.talents[definition.id] ?? 0;
      return advancementRow({
        kind: "talent",
        id: definition.id,
        label: definition.name,
        detail: `${definition.check.join("/")} · Faktor ${definition.improvementCost}`,
        current,
        cost: improvementCostForTarget(definition.improvementCost, current + 1),
        maximum: talentMaximum(definition, attributes),
        availableAp: advancement.availableAp,
        ignoreLimits: advancement.ignoreLimits,
      });
    }).join("");
  } else if (advancementSection === "combat") {
    rows = Object.values(COMBAT_TECHNIQUE_RULES).filter((definition) => filterName(definition.name)).sort((a, b) => a.name.localeCompare(b.name, "de")).map((definition) => {
      const current = sheet.hero.ct?.[definition.id] ?? 6;
      return advancementRow({
        kind: "combatTechnique",
        id: definition.id,
        label: definition.name,
        detail: `${definition.primaryAttributes.join("/")} · Faktor ${definition.improvementCost}`,
        current,
        cost: improvementCostForTarget(definition.improvementCost, current + 1),
        maximum: combatTechniqueMaximum(definition, attributes),
        availableAp: advancement.availableAp,
        ignoreLimits: advancement.ignoreLimits,
      });
    }).join("");
  } else if (advancementSection === "spells") {
    const spells = Object.entries(sheet.hero.spells ?? {})
      .map(([id, current]) => ({ id, current, definition: getSpellDefinition(id) }))
      .filter((entry) => filterName(entry.definition?.name ?? entry.id))
      .sort((a, b) => (a.definition?.name ?? a.id).localeCompare(b.definition?.name ?? b.id, "de"));
    rows = spells.map(({ id, current, definition }) => {
      const column = definition?.improvementCost as ImprovementCost | undefined;
      const validColumn = column && ["A", "B", "C", "D"].includes(column);
      return advancementRow({
        kind: "spell",
        id,
        label: definition?.name ?? id,
        detail: definition ? `${definition.kind} · Faktor ${definition.improvementCost}` : "Unbekannter Zauber",
        current,
        cost: validColumn ? improvementCostForTarget(column, current + 1) : undefined,
        maximum: 14,
        disabledReason: validColumn ? undefined : "Steigerungsfaktor unbekannt",
        availableAp: advancement.availableAp,
        ignoreLimits: advancement.ignoreLimits,
      });
    }).join("");
  } else {
    const maximumAttribute = Math.max(...Object.values(attributes));
    const energyRows = [
      { id: "lp", label: "Lebensenergie", short: "LeP", purchased: Number(sheet.hero.attr.lp ?? 0), maximum: attributes.KO },
      ...(isMagicallyGifted(sheet) ? [{ id: "ae", label: "Astralenergie", short: "AsP", purchased: Number(sheet.hero.attr.ae ?? 0), maximum: maximumAttribute }] : []),
      ...(sheet.runtime.resources.kp.max > 0 ? [{ id: "kp", label: "Karmaenergie", short: "KaP", purchased: Number(sheet.hero.attr.kp ?? 0), maximum: maximumAttribute }] : []),
    ];
    rows = energyRows.filter((entry) => filterName(entry.label)).map((entry) => advancementRow({
      kind: "resource",
      id: entry.id,
      label: entry.label,
      detail: `${entry.short} · Zukauf ${entry.purchased}/${entry.maximum} · Faktor D`,
      current: sheet.runtime.resources[entry.id as "lp" | "ae" | "kp"].max,
      cost: improvementCostForTarget("D", entry.purchased + 1),
      maximum: sheet.runtime.resources[entry.id as "lp" | "ae" | "kp"].max + Math.max(0, entry.maximum - entry.purchased),
      availableAp: advancement.availableAp,
      ignoreLimits: advancement.ignoreLimits,
    })).join("");
  }

  const history = [...advancement.history].reverse().slice(0, 8);
  return `<section class="page page--advance">
    <div class="section-title"><div><p class="eyebrow">Abenteuerpunkte</p><h2>Helden steigern</h2></div><span class="section-hint">Kosten und Grenzwerte werden automatisch geprüft</span></div>
    <div class="ap-dashboard">
      <article><span>AP-Guthaben</span><strong>${advancement.availableAp}</strong><small>verfügbar</small></article>
      <article><span>Ausgegeben</span><strong>${advancement.spentAp}</strong><small>in diesem Bogen</small></article>
      <article><span>Gesamt-AP</span><strong>${sheet.hero.ap?.total ?? 0}</strong><small>Heldenwert</small></article>
      <div class="ap-controls">
        <label><span>Vorhandenes Guthaben setzen</span><input id="ap-balance-input" type="number" min="0" value="${advancement.availableAp}" /></label>
        <button class="secondary-button" id="set-ap-balance">Übernehmen</button>
        <label><span>Neue AP erhalten</span><input id="ap-award-input" type="number" min="1" value="5" /></label>
        <button class="primary-button" id="award-ap">AP hinzufügen</button>
      </div>
    </div>
    <label class="limit-toggle"><input id="ignore-advancement-limits" type="checkbox" ${advancement.ignoreLimits ? "checked" : ""} /><span><strong>Spielleiter-Freigabe / Hausregel</strong> Grenzwerte übergehen; AP-Kosten bleiben aktiv.</span></label>

    <div class="advance-section-tabs">
      ${sections.map((section) => `<button class="${section.id === advancementSection ? "active" : ""}" data-advance-section="${section.id}"><span>${section.icon}</span>${section.label}</button>`).join("")}
    </div>
    <label class="search-box"><span aria-hidden="true">⌕</span><input id="advancement-search" type="search" value="${escapeHtml(advancementSearch)}" placeholder="In diesem Bereich suchen …" autocomplete="off" /></label>
    ${advancementSection === "resources" ? '<aside class="info-callout compact"><strong>Hinweis zu Leiteigenschaften</strong><p>Bei AsP und KaP verwendet der Bogen die höchste Eigenschaft als vorläufige Obergrenze. Prüfe die tatsächliche Leiteigenschaft der Tradition.</p></aside>' : ""}
    <div class="advance-list">${rows || '<div class="empty-state">Keine passenden Werte gefunden.</div>'}</div>

    <div class="section-title section-title--resources"><div><p class="eyebrow">Protokoll</p><h2>Letzte Steigerungen</h2></div>${history.length ? '<button class="text-button" id="undo-advancement">Letzte zurücknehmen</button>' : ""}</div>
    <div class="advance-history">
      ${history.map((entry) => `<div><span>${new Date(entry.timestamp).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span><strong>${escapeHtml(entry.label)}</strong><em>${entry.from} → ${entry.to}</em><b>−${entry.cost} AP</b></div>`).join("") || '<div class="empty-state">Noch keine Steigerung in diesem Bogen vorgenommen.</div>'}
    </div>
  </section>`;
};

const renderSource = (sheet: CharacterSheetState): string => {
  const isManual = sheet.source === "manual";
  const isDarkAid = sheet.source === "darkaid";
  return `
  <section class="page page--source">
    <div class="section-title"><div><p class="eyebrow">Import & Sicherung</p><h2>Quelldaten</h2></div></div>
    <article class="panel source-card">
      <div class="source-logo">${isManual ? "M" : isDarkAid ? "D" : "O"}</div>
      <div><h3>${isManual ? "Manuell ausgefüllter Bogen" : escapeHtml(sourceName(sheet))}</h3><p>${isManual ? "Angelegt" : "Importiert"} am ${new Date(sheet.importedAt).toLocaleString("de-DE")}</p></div>
      <span class="status-pill">${isManual ? "manuell" : "erkannt"}</span>
    </article>
    <article class="panel">
      <div class="panel__header"><h3>Technische Kennungen</h3></div>
      <dl class="source-ids">
        <div><dt>Held</dt><dd>${escapeHtml(sheet.hero.id)}</dd></div>
        <div><dt>Spezies</dt><dd>${escapeHtml(SPECIES_BY_ID[sheet.hero.r ?? ""]?.name ?? sheet.hero.r ?? "—")}</dd></div>
        <div><dt>Kultur</dt><dd>${escapeHtml(sheet.hero.c ?? "—")}</dd></div>
        <div><dt>Profession</dt><dd>${escapeHtml(sheet.hero.p ?? "—")}</dd></div>
      </dl>
    </article>
    <article class="panel">
      <div class="panel__header"><h3>Spielstand sichern</h3></div>
      <p class="panel-copy">Die Sicherung enthält alle Werte, Ressourcen, Talente, Waffen, Rüstungen, AP-Guthaben, Steigerungsprotokoll, Notizen und die Token-Verknüpfung.</p>
      <div class="button-row">
        <button class="primary-button" id="export-backup">Owlbear-JSON sichern</button>
        ${isManual ? "" : '<button class="secondary-button" id="export-original">Original exportieren</button>'}
      </div>
    </article>
    <aside class="info-callout">
      <strong>Stand dieses Prototyps</strong>
      <p>${isManual
        ? "Name, Spezies, magische Begabung, Eigenschaften, alle 59 Basistalente, Zauber, Kampftechniken, Ressourcen, Waffen, Rüstungen, Inventar und Geldbörse können bearbeitet und regelgerecht mit AP gesteigert werden."
        : isDarkAid
          ? "DarkAid-Eigenschaften, alle 59 Basistalente, Kampftechniken, Zauber, Zaubertricks, Ausrüstung und Geldbörse wurden aus der TDC-Datei übernommen. Waffen und Rüstungen können bearbeitet oder ergänzt und alle Kernwerte mit AP gesteigert werden."
          : "Alle 59 Basistalente sowie vorhandene Zauber, Zaubertricks, Kampftechniken und Gegenstände aus Optolith 1.5.x werden eingelesen. Waffen und Rüstungen können bearbeitet oder ergänzt und alle Kernwerte mit AP gesteigert werden."}</p>
    </aside>
  </section>
  `;
};

const formatGroupUpdate = (updatedAt: string): { label: string; stale: boolean } => {
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return { label: "Zeit unbekannt", stale: true };
  const ageSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (ageSeconds < 15) return { label: "gerade aktualisiert", stale: false };
  if (ageSeconds < 60) return { label: `vor ${ageSeconds} Sekunden`, stale: false };
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return { label: `vor ${minutes} Minute${minutes === 1 ? "" : "n"}`, stale: minutes >= 5 };
  return {
    label: new Date(timestamp).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }),
    stale: true,
  };
};

const renderGroupMember = (member: GroupHeroSummary): string => {
  const { summary } = member;
  const health = getHealthPresentation(summary.lp);
  const updated = formatGroupUpdate(summary.updatedAt);
  const resourceEntries = [
    { short: "LeP", value: summary.lp, className: "lp" },
    ...(summary.ae ? [{ short: "AsP", value: summary.ae, className: "ae" }] : []),
    ...(summary.kp ? [{ short: "KaP", value: summary.kp, className: "kp" }] : []),
    { short: "Schip", value: summary.fate, className: "fate" },
  ];
  const combat = summary.combat;
  return `<article class="group-card group-card--${health.status}">
    <header class="group-card__header">
      <div><p>${escapeHtml(member.tokenName)}</p><h3>${escapeHtml(summary.name)}</h3></div>
      <span class="health-pill" style="--health-color:${health.color}">${health.label}</span>
    </header>
    <div class="group-resources">
      ${resourceEntries.map((entry) => {
        const ratio = entry.value.max > 0 ? Math.max(0, Math.min(100, entry.value.current / entry.value.max * 100)) : 0;
        return `<div class="group-resource group-resource--${entry.className}"><span>${entry.short}</span><strong>${entry.value.current}<small>/${entry.value.max}</small></strong><i><b style="width:${ratio}%"></b></i></div>`;
      }).join("")}
    </div>
    ${summary.attributes ? `<dl class="group-attributes">
      ${ATTRIBUTES.map((attribute) => `<div><dt>${attribute.code}</dt><dd>${summary.attributes?.[attribute.code] ?? "—"}</dd></div>`).join("")}
    </dl>` : '<p class="group-legacy-note">Grundwerte werden nach der nächsten Änderung im Spielerbogen angezeigt.</p>'}
    <div class="group-combat-values">
      <div><span>${combat?.attackLabel ?? "AT"}</span><strong>${combat?.attack ?? "—"}</strong></div>
      <div><span>PA</span><strong>${combat?.parry ?? "—"}</strong></div>
      <div><span>AW</span><strong>${combat?.dodge ?? "—"}</strong></div>
      <div><span>INI</span><strong>${combat?.initiative ?? summary.initiative}</strong></div>
      <p>${combat ? `Primär: ${escapeHtml(combat.primaryWeaponName)}` : "Kampfwerte werden beim nächsten Synchronisieren ergänzt."}</p>
    </div>
    <footer class="group-card__footer">
      <span class="${updated.stale ? "stale" : ""}">${updated.stale ? "⚠ " : ""}${escapeHtml(updated.label)}</span>
      <span>${member.statusDisplayId ? "Statusanzeige auf der Karte" : "Noch keine Kartenanzeige"}</span>
    </footer>
  </article>`;
};

const renderGroupMonitor = (): string => `
  <section class="page page--group">
    <div class="section-title group-title">
      <div><p class="eyebrow">Nur für den GM</p><h2>Gruppenmonitor</h2></div>
      <div class="group-actions">
        <button class="secondary-button" id="refresh-group" ${groupLoading ? "disabled" : ""}>↻ Aktualisieren</button>
        <button class="primary-button" id="sync-group-status" ${groupLoading || groupMembers.length === 0 ? "disabled" : ""}>Statusanzeigen anlegen</button>
      </div>
    </div>
    <aside class="info-callout compact"><strong>Live aus der aktuellen Owlbear-Szene</strong><p>Jeder Spieler verbindet seinen Bogen einmal mit seinem Charaktertoken. Danach erscheinen Ressourcen, Eigenschaften und Kampfwerte hier; Änderungen am Bogen werden automatisch übertragen.</p></aside>
    ${groupLoading && groupMembers.length === 0
      ? '<div class="group-loading">Gruppenwerte werden geladen …</div>'
      : `<div class="group-grid">${groupMembers.map(renderGroupMember).join("") || '<div class="empty-state group-empty"><strong>Noch keine verbundenen Helden</strong><span>Die Spieler müssen in ihrem Bogen einen Charaktertoken auswählen und „Ausgewählten Token verbinden“ anklicken.</span></div>'}</div>`}
    <aside class="group-thresholds"><strong>Automatischer Gesundheitszustand</strong><span>Gesund: über 75 % · leicht verletzt: über 25 % · schwer verwundet: bis 25 % · ohnmächtig: 0 LeP</span></aside>
  </section>`;

const renderGameMasterShell = (): string => `
  <div class="app-shell">
    <header class="hero-header gm-header">
      <div class="hero-header__identity"><div class="hero-avatar">GM</div><div><p class="eyebrow">Spielleiter</p><h1>Gruppenmonitor</h1></div></div>
      <div class="hero-meta"><span>${groupMembers.length} verbunden</span><span>aktuelle Szene</span></div>
    </header>
    <main class="content">${renderGroupMonitor()}</main>
    <footer class="app-footer"><span><i class="connection-dot connection-dot--online"></i>Mit Owlbear Rodeo verbunden · v${APP_VERSION}</span><button id="close-group-monitor">Zur Heldenauswahl</button></footer>
  </div>`;

const renderRollDialog = (sheet: CharacterSheetState): string => {
  if (!rollDialog) return "";
  const definition = rollDialog.kind === "talent"
    ? TALENT_BY_ID[rollDialog.entryId]
    : getSpellDefinition(rollDialog.entryId);
  if (!definition?.check) return "";
  const attributes = getAttributeValues(sheet.hero);
  const values = definition.check.map((code: AttributeCode) => attributes[code]) as [number, number, number];
  const skillValue = rollDialog.kind === "talent"
    ? sheet.hero.talents[definition.id] ?? 0
    : sheet.hero.spells?.[definition.id] ?? 0;
  const result = rollDialog.result;
  const outcomeLabels = {
    success: "Gelungen",
    failure: "Misslungen",
    critical: "Kritischer Erfolg",
    botch: "Patzer",
  } as const;

  return `
    <div class="modal-backdrop" id="roll-backdrop">
      <section class="roll-dialog" role="dialog" aria-modal="true" aria-labelledby="roll-title">
        <button class="modal-close" id="close-roll" aria-label="Schließen">×</button>
        <p class="eyebrow">${rollDialog.kind === "talent" ? "Talentprobe" : "Zauberprobe"}</p>
        <h2 id="roll-title">${escapeHtml(definition.name)}</h2>
        <div class="roll-check">
          ${definition.check
            .map(
              (code, index) => `<div><span>${code}</span><strong>${values[index]}</strong></div>`,
            )
            .join("")}
          <div class="roll-skill"><span>FW</span><strong>${skillValue}</strong></div>
        </div>
        <label class="modifier-control">
          <span>Modifikator</span>
          <small>positiv = Erleichterung</small>
          <input id="roll-modifier" type="number" min="-20" max="20" value="${rollDialog.modifier}" />
        </label>
        ${
          result
            ? `<div class="dice-row">
                ${result.rolls
                  .map(
                    (die, index) => `<div class="die ${die === 1 ? "die--one" : die === 20 ? "die--twenty" : ""}">
                      <strong>${die}</strong><span>auf ${result.targets[index]}</span>${result.differences[index] ? `<em>−${result.differences[index]}</em>` : ""}
                    </div>`,
                  )
                  .join("")}
              </div>
              <div class="roll-result roll-result--${result.outcome}">
                <span>${outcomeLabels[result.outcome]}</span>
                <strong>${result.outcome === "success" || result.outcome === "critical" ? `QS ${result.qualityLevel}` : "—"}</strong>
                <small>${result.remainingSkillPoints >= 0 ? `${result.remainingSkillPoints} FP übrig` : `${Math.abs(result.remainingSkillPoints)} FP fehlen`}</small>
              </div>`
            : '<div class="roll-placeholder"><span>Bereit für die Probe</span><small>Drei Würfel, ein Schicksal.</small></div>'
        }
        <button class="primary-button primary-button--wide" id="perform-roll">${result ? "Noch einmal würfeln" : "3W20 würfeln"}</button>
      </section>
    </div>
  `;
};

const tabLabel = (id: TabId, label: string, icon: string): string => `
  <button class="nav-tab ${activeTab === id ? "nav-tab--active" : ""}" data-tab="${id}">
    <span aria-hidden="true">${icon}</span><em>${label}</em>
  </button>`;

const renderSheet = (sheet: CharacterSheetState): string => {
  const hasMagic = isMagicallyGifted(sheet);
  if (!hasMagic && activeTab === "spells") activeTab = "overview";
  if (!bridge.isGameMaster && activeTab === "group") activeTab = "overview";
  const content = {
    overview: renderOverview,
    talents: renderTalents,
    spells: renderSpells,
    combat: renderCombat,
    inventory: renderInventory,
    advance: renderAdvance,
    source: renderSource,
    group: renderGroupMonitor,
  }[activeTab](sheet);

  return `
    <div class="app-shell">
      <header class="hero-header">
        <div class="hero-header__identity">
          <div class="hero-avatar">${escapeHtml(sheet.hero.name.charAt(0).toUpperCase())}</div>
          <div><p class="eyebrow">Heldenbogen</p>${sheet.source === "manual" ? `<input class="manual-name-input" id="manual-name" type="text" maxlength="80" value="${escapeHtml(sheet.hero.name)}" aria-label="Name des Helden" />` : `<h1>${escapeHtml(sheet.hero.name)}</h1>`}</div>
        </div>
        <div class="hero-meta">
          <span>${sheet.hero.ap?.total ?? "—"} AP</span>
          <span>${escapeHtml(sourceName(sheet))}</span>
        </div>
        <div class="header-actions">
          <label class="icon-button" title="Anderen Helden importieren">
            <input id="replace-hero-file" type="file" accept="application/json,.json,.tdc" hidden />
            ⇧
          </label>
          <button class="icon-button" id="export-quick" title="Spielstand sichern">↓</button>
        </div>
      </header>
      <nav class="main-nav" aria-label="Heldenbogen-Bereiche" style="grid-template-columns: repeat(${(hasMagic ? 7 : 6) + (bridge.isGameMaster ? 1 : 0)}, 1fr)">
        ${tabLabel("overview", "Übersicht", "◆")}
        ${tabLabel("talents", "Talente", "◈")}
        ${hasMagic ? tabLabel("spells", "Zauber", "✦") : ""}
        ${tabLabel("combat", "Kampf", "⚔")}
        ${tabLabel("inventory", "Inventar", "▣")}
        ${tabLabel("advance", "Steigern", "↑")}
        ${tabLabel("source", "Daten", "⋯")}
        ${bridge.isGameMaster ? tabLabel("group", "Gruppe", "♟") : ""}
      </nav>
      <main class="content">${content}</main>
      <footer class="app-footer">
        <span><i class="connection-dot ${bridge.available ? "connection-dot--online" : ""}"></i>${bridge.available ? "Mit Owlbear Rodeo verbunden" : "Lokale Vorschau"} · v${APP_VERSION}</span>
        <button id="remove-hero">Helden aus diesem Browser entfernen</button>
      </footer>
    </div>
    ${renderRollDialog(sheet)}
  `;
};

const attachGroupMonitorListeners = (): void => {
  document.querySelector("#refresh-group")?.addEventListener("click", () => void refreshGroupMembers());
  document.querySelector("#sync-group-status")?.addEventListener("click", async () => {
    try {
      const count = await bridge.ensureGroupStatusDisplays();
      showToast(`${count} Kartenanzeige${count === 1 ? "" : "n"} wurden angelegt oder aktualisiert.`);
      await refreshGroupMembers(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Die Kartenanzeigen konnten nicht aktualisiert werden.", "error");
    }
  });
  document.querySelector("#close-group-monitor")?.addEventListener("click", () => {
    groupDashboardOpen = false;
    render();
  });
};

const attachImportListeners = (): void => {
  const input = document.querySelector<HTMLInputElement>("#hero-file");
  input?.addEventListener("change", () => void importFile(input.files?.[0]));
  document.querySelector("#open-group-monitor")?.addEventListener("click", () => {
    groupDashboardOpen = true;
    render();
    void refreshGroupMembers();
  });
  const dropZone = document.querySelector<HTMLElement>("#drop-zone");
  dropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drop-zone--active");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("drop-zone--active"));
  dropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drop-zone--active");
    void importFile(event.dataTransfer?.files[0]);
  });
  const manualName = document.querySelector<HTMLInputElement>("#manual-hero-name");
  const manualSpecies = document.querySelector<HTMLSelectElement>("#manual-species");
  const manualMagical = document.querySelector<HTMLInputElement>("#manual-magical");
  const syncManualMagicOption = (): void => {
    if (!manualSpecies || !manualMagical) return;
    const isElf = manualSpecies.value === "elf";
    manualMagical.disabled = isElf;
    if (isElf) manualMagical.checked = true;
  };
  manualSpecies?.addEventListener("change", syncManualMagicOption);
  syncManualMagicOption();
  const createManualHero = (): void => {
    const name = manualName?.value.trim() ?? "";
    if (!name) {
      showToast("Bitte gib zuerst einen Namen für den Helden ein.", "error");
      manualName?.focus();
      return;
    }
    state = createManualState(name, {
      species: (manualSpecies?.value ?? "human") as ManualSpecies,
      magical: manualMagical?.checked ?? false,
    });
    activeTab = "overview";
    talentSearch = "";
    spellSearch = "";
    persist(false);
    render();
    showToast(`${name} wurde als leerer Heldenbogen angelegt.`);
  };
  document.querySelector("#create-manual-hero")?.addEventListener("click", createManualHero);
  manualName?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createManualHero();
  });
};

const attachSheetListeners = (): void => {
  if (!state) return;
  attachGroupMonitorListeners();

  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab as TabId;
      render();
      if (activeTab === "group") void refreshGroupMembers();
    });
  });

  const replacement = document.querySelector<HTMLInputElement>("#replace-hero-file");
  replacement?.addEventListener("change", () => void importFile(replacement.files?.[0]));

  document.querySelector<HTMLInputElement>("#manual-name")?.addEventListener("change", (event) => {
    if (!state || state.source !== "manual") return;
    state.hero.name = (event.target as HTMLInputElement).value.trim() || "Unbenannter Held";
    state.hero.dateModified = new Date().toISOString();
    persist();
    render();
  });

  document.querySelector<HTMLSelectElement>("#manual-species-sheet")?.addEventListener("change", (event) => {
    if (!state || state.source !== "manual") return;
    updateManualSpecies(state, (event.target as HTMLSelectElement).value as ManualSpecies);
    state.hero.dateModified = new Date().toISOString();
    persist();
    render();
  });

  document.querySelector<HTMLInputElement>("#manual-magical-sheet")?.addEventListener("change", (event) => {
    if (!state || state.source !== "manual") return;
    updateManualMagic(state, (event.target as HTMLInputElement).checked);
    if (!isMagicallyGifted(state) && activeTab === "spells") activeTab = "overview";
    state.hero.dateModified = new Date().toISOString();
    persist();
    render();
  });

  document.querySelectorAll<HTMLInputElement>("[data-manual-attribute]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state || state.source !== "manual") return;
      const id = input.dataset.manualAttribute;
      const attribute = state.hero.attr.values.find((entry) => entry.id === id);
      if (!attribute) return;
      attribute.value = Math.max(0, Math.min(30, Math.round(asNumber(input.value, attribute.value))));
      if (id === "ATTR_7") refreshManualLifePoints(state);
      state.hero.dateModified = new Date().toISOString();
      persist();
      render();
    });
  });

  document.querySelector<HTMLInputElement>("#manual-ap")?.addEventListener("change", (event) => {
    if (!state || state.source !== "manual") return;
    state.hero.ap ??= {};
    state.hero.ap.total = Math.max(0, Math.round(asNumber((event.target as HTMLInputElement).value, state.hero.ap.total ?? 0)));
    persist(false);
    render();
  });

  document.querySelectorAll<HTMLInputElement>("[data-manual-talent]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state || state.source !== "manual") return;
      const id = input.dataset.manualTalent;
      if (!id) return;
      state.hero.talents[id] = Math.max(0, Math.min(30, Math.round(asNumber(input.value, state.hero.talents[id] ?? 0))));
      persist(false);
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-manual-technique]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state || state.source !== "manual") return;
      const id = input.dataset.manualTechnique;
      if (!id) return;
      state.hero.ct ??= {};
      state.hero.ct[id] = Math.max(0, Math.min(30, Math.round(asNumber(input.value, state.hero.ct[id] ?? 6))));
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-manual-spell]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state || state.source !== "manual") return;
      const id = input.dataset.manualSpell;
      if (!id) return;
      state.hero.spells ??= {};
      state.hero.spells[id] = Math.max(0, Math.min(30, Math.round(asNumber(input.value, state.hero.spells[id] ?? 0))));
      persist(false);
      render();
    });
  });

  const spellCatalogSearchInput = document.querySelector<HTMLInputElement>("#spell-catalog-search");
  spellCatalogSearchInput?.addEventListener("input", () => {
    spellCatalogSearch = spellCatalogSearchInput.value;
    render();
    const refreshed = document.querySelector<HTMLInputElement>("#spell-catalog-search");
    refreshed?.focus();
    refreshed?.setSelectionRange(spellCatalogSearch.length, spellCatalogSearch.length);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-import-spell]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state || state.source !== "manual") return;
      const id = button.dataset.importSpell;
      const definition = id ? ALL_SPELL_BY_ID[id] : undefined;
      if (!id || !definition) return;
      state.hero.spells ??= {};
      state.hero.spells[id] = 0;
      spellCatalogSearch = "";
      persist(false);
      render();
      showToast(`„${definition.name}“ wurde hinzugefügt.`);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-spell]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state || state.source !== "manual") return;
      const id = button.dataset.deleteSpell;
      if (!id) return;
      delete state.hero.spells?.[id];
      persist(false);
      render();
    });
  });

  document.querySelector("#add-cantrip")?.addEventListener("click", () => {
    if (!state || state.source !== "manual") return;
    const select = document.querySelector<HTMLSelectElement>("#cantrip-catalog-select");
    const id = select?.value;
    if (!id || !CANTRIPS[id]) return;
    state.hero.cantrips ??= [];
    if (!state.hero.cantrips.includes(id)) state.hero.cantrips.push(id);
    persist();
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-cantrip]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state || state.source !== "manual") return;
      const id = button.dataset.deleteCantrip;
      if (!id) return;
      state.hero.cantrips = (state.hero.cantrips ?? []).filter((entry) => entry !== id);
      persist();
      render();
    });
  });

  const backup = (): void => downloadJson(`${state?.hero.name ?? "Held"}-owlbear.json`, state);
  document.querySelector("#export-quick")?.addEventListener("click", backup);
  document.querySelector("#export-backup")?.addEventListener("click", backup);
  document.querySelector("#export-original")?.addEventListener("click", () => {
    if (!state) return;
    if (state.source === "darkaid") {
      downloadJson(`${state.hero.name}.tdc`, state.originalData ?? state.hero);
    } else {
      downloadJson(`${state.hero.name}-optolith.json`, state.hero);
    }
  });

  document.querySelector("#remove-hero")?.addEventListener("click", () => {
    if (!window.confirm("Den Helden und alle lokalen Änderungen aus diesem Browser entfernen?")) return;
    state = null;
    clearState();
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-resource][data-delta]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      const key = button.dataset.resource as keyof typeof state.runtime.resources;
      const delta = asNumber(button.dataset.delta ?? "0");
      const resource = state.runtime.resources[key];
      resource.current = Math.max(0, Math.min(resource.max, resource.current + delta));
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-resource-current]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state) return;
      const key = input.dataset.resourceCurrent as keyof typeof state.runtime.resources;
      const resource = state.runtime.resources[key];
      resource.current = Math.max(0, Math.min(resource.max, asNumber(input.value, resource.current)));
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-resource-max]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state) return;
      const key = input.dataset.resourceMax as keyof typeof state.runtime.resources;
      const resource = state.runtime.resources[key];
      resource.max = Math.max(0, asNumber(input.value, resource.max));
      resource.current = Math.min(resource.current, resource.max);
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-enable-resource]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      const key = button.dataset.enableResource as "ae" | "kp";
      if (key === "ae" && state.source === "manual") updateManualMagic(state, true);
      else state.runtime.resources[key] = { current: 20, max: 20 };
      persist();
      render();
    });
  });

  const notes = document.querySelector<HTMLTextAreaElement>("#hero-notes");
  notes?.addEventListener("input", () => {
    if (!state) return;
    state.runtime.notes = notes.value;
    persist(false);
  });

  const addCombatItem = (kind: CombatItemKind, template: Partial<OptolithItem> = {}): void => {
    if (!state) return;
    state.hero.belongings ??= {};
    state.hero.belongings.items ??= {};
    let id = `ITEM_COMBAT_${kind.toUpperCase()}_${Date.now().toString(36)}`;
    while (state.hero.belongings.items[id]) id += "_1";
    const defaults: Record<CombatItemKind, Partial<OptolithItem>> = {
      melee: { name: "Neue Nahkampfwaffe", gr: 1, combatTechnique: "CT_12", damageDiceNumber: 1, damageDiceSides: 6, damageFlat: 3, at: 0, pa: 0, reach: 2, damageBonusAttribute: "KK", damageThreshold: 14 },
      ranged: { name: "Neue Fernkampfwaffe", gr: 2, combatTechnique: "CT_2", damageDiceNumber: 1, damageDiceSides: 6, damageFlat: 4, reloadTime: 1, rangeShort: 10, rangeMedium: 50, rangeLong: 100, ammunition: "" },
      shield: { name: "Neuer Schild", gr: 1, combatTechnique: "CT_10", damageDiceNumber: 1, damageDiceSides: 6, damageFlat: 0, at: -4, pa: 1, reach: 1 },
      armor: { name: "Neue Rüstung", gr: 4, pro: 2, enc: 1, movementPenalty: 0, initiativePenalty: 0 },
      equipment: { name: "Neuer Gegenstand", gr: 7 },
    };
    const createdItem: OptolithItem = {
      id,
      amount: 1,
      weight: 0,
      price: 0,
      equipped: true,
      ...defaults[kind],
      ...template,
      itemKind: kind,
    } as OptolithItem;
    const primaryAttributes = COMBAT_TECHNIQUE_RULES[createdItem.combatTechnique ?? ""]?.primaryAttributes;
    if (!template.damageBonusAttribute && primaryAttributes?.length === 1) {
      createdItem.damageBonusAttribute = primaryAttributes[0];
    }
    state.hero.belongings.items[id] = createdItem;
    if (kind !== "armor" && kind !== "equipment" && !state.runtime.combat.primaryWeaponId) {
      state.runtime.combat.primaryWeaponId = id;
    }
    persist();
    render();
    document.querySelector<HTMLInputElement>(`[data-combat-key="${id}"][data-combat-field="name"]`)?.select();
  };

  const weaponSearchInput = document.querySelector<HTMLInputElement>("#weapon-catalog-search");
  weaponSearchInput?.addEventListener("input", () => {
    weaponCatalogSearch = weaponSearchInput.value;
    render();
    const refreshed = document.querySelector<HTMLInputElement>("#weapon-catalog-search");
    refreshed?.focus();
    refreshed?.setSelectionRange(weaponCatalogSearch.length, weaponCatalogSearch.length);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-import-combat-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.importCombatTemplate;
      const template = catalogId ? DARKAID_ITEM_DATA[catalogId] : undefined;
      if (!catalogId || !template) return;
      const prefix = catalogId.split(":", 1)[0];
      const kind: CombatItemKind = prefix === "armor" ? "armor" : prefix === "rangedweapon" ? "ranged" : prefix === "shield" ? "shield" : "melee";
      weaponCatalogSearch = "";
      addCombatItem(kind, template);
      showToast(`„${template.name ?? "Kampfgegenstand"}“ wurde importiert.`);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-add-combat-kind]").forEach((button) => {
    button.addEventListener("click", () => addCombatItem(button.dataset.addCombatKind as CombatItemKind));
  });

  document.querySelectorAll<HTMLInputElement>("[data-primary-weapon]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state || !input.checked) return;
      const key = input.dataset.primaryWeapon;
      const item = key ? state.hero.belongings?.items?.[key] : undefined;
      if (!key || !item) return;
      state.runtime.combat.primaryWeaponId = key;
      item.equipped = true;
      persist();
      render();
    });
  });

  document.querySelector<HTMLInputElement>("#initiative-modifier")?.addEventListener("input", (event) => {
    if (!state) return;
    state.runtime.combat.initiativeModifier = Math.max(-20, Math.min(20, Math.round(asNumber((event.target as HTMLInputElement).value))));
    persist(false);
    const overview = calculateCombatOverview(
      state.hero,
      state.runtime.combat.primaryWeaponId,
      state.runtime.combat.initiativeModifier,
    );
    const value = document.querySelector<HTMLElement>(".combat-stat--initiative strong");
    if (value) value.textContent = String(overview.initiative);
  });

  document.querySelector<HTMLInputElement>("#initiative-modifier")?.addEventListener("change", () => {
    persist();
  });

  document.querySelector("#roll-initiative")?.addEventListener("click", () => {
    if (!state) return;
    const overview = calculateCombatOverview(
      state.hero,
      state.runtime.combat.primaryWeaponId,
      state.runtime.combat.initiativeModifier,
    );
    state.runtime.combat.lastInitiativeRoll = rollInitiative(overview);
    persist(false);
    render();
  });

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-combat-key][data-combat-field]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state) return;
      const key = input.dataset.combatKey;
      const field = input.dataset.combatField;
      const item = key ? state.hero.belongings?.items?.[key] : undefined;
      if (!item || !field) return;
      if (["name", "ammunition", "notes", "combatTechnique", "damageBonusAttribute"].includes(field)) {
        (item as Record<string, unknown>)[field] = input.value.trim();
        if (field === "name" && !item.name) item.name = "Unbenannter Kampfgegenstand";
      } else if (field === "equipped" && input instanceof HTMLInputElement) {
        item.equipped = input.checked;
      } else {
        const allowNegative = ["at", "pa", "damageFlat", "movementPenalty", "initiativePenalty"].includes(field);
        const numeric = asNumber(input.value, Number((item as Record<string, unknown>)[field] ?? 0));
        (item as Record<string, unknown>)[field] = allowNegative ? numeric : Math.max(0, numeric);
      }
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-combat]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      const key = button.dataset.deleteCombat;
      const item = key ? state.hero.belongings?.items?.[key] : undefined;
      if (!key || !item || !window.confirm(`„${item.name}“ vollständig aus dem Inventar löschen?`)) return;
      delete state.hero.belongings?.items?.[key];
      if (state.runtime.combat.primaryWeaponId === key) {
        state.runtime.combat.primaryWeaponId = getDefaultPrimaryWeaponId(state.hero);
      }
      persist();
      render();
    });
  });

  document.querySelector("#set-ap-balance")?.addEventListener("click", () => {
    if (!state) return;
    const input = document.querySelector<HTMLInputElement>("#ap-balance-input");
    state.runtime.advancement.availableAp = Math.max(0, Math.round(asNumber(input?.value ?? "0")));
    persist(false);
    render();
  });

  document.querySelector("#award-ap")?.addEventListener("click", () => {
    if (!state) return;
    const input = document.querySelector<HTMLInputElement>("#ap-award-input");
    const amount = Math.max(0, Math.round(asNumber(input?.value ?? "0")));
    if (!amount) return;
    state.runtime.advancement.availableAp += amount;
    state.hero.ap ??= {};
    state.hero.ap.total = Math.max(0, Number(state.hero.ap.total ?? 0)) + amount;
    persist(false);
    render();
    showToast(`${amount} AP wurden gutgeschrieben.`);
  });

  document.querySelector<HTMLInputElement>("#ignore-advancement-limits")?.addEventListener("change", (event) => {
    if (!state) return;
    state.runtime.advancement.ignoreLimits = (event.target as HTMLInputElement).checked;
    persist(false);
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-advance-section]").forEach((button) => {
    button.addEventListener("click", () => {
      advancementSection = button.dataset.advanceSection as AdvancementSection;
      advancementSearch = "";
      render();
    });
  });

  const advancementSearchInput = document.querySelector<HTMLInputElement>("#advancement-search");
  advancementSearchInput?.addEventListener("input", () => {
    advancementSearch = advancementSearchInput.value;
    render();
    const refreshed = document.querySelector<HTMLInputElement>("#advancement-search");
    refreshed?.focus();
    refreshed?.setSelectionRange(advancementSearch.length, advancementSearch.length);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-advance-kind][data-advance-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      const kind = button.dataset.advanceKind as AdvancementHistoryEntry["kind"];
      const targetId = button.dataset.advanceId;
      if (!targetId) return;
      const advancement = state.runtime.advancement;
      const attributes = getAttributeValues(state.hero);
      let label = targetId;
      let from = 0;
      let cost = 0;
      let maximum = Number.POSITIVE_INFINITY;

      if (kind === "attribute") {
        const definition = ATTRIBUTES.find((entry) => entry.id === targetId);
        const value = state.hero.attr.values.find((entry) => entry.id === targetId);
        if (!definition || !value) return;
        label = definition.name;
        from = value.value;
        cost = improvementCostForTarget("E", from + 1);
        maximum = 25;
      } else if (kind === "talent") {
        const definition = TALENT_BY_ID[targetId];
        if (!definition) return;
        label = definition.name;
        from = state.hero.talents[targetId] ?? 0;
        cost = improvementCostForTarget(definition.improvementCost, from + 1);
        maximum = talentMaximum(definition, attributes);
      } else if (kind === "combatTechnique") {
        const definition = COMBAT_TECHNIQUE_RULES[targetId];
        if (!definition) return;
        label = definition.name;
        from = state.hero.ct?.[targetId] ?? 6;
        cost = improvementCostForTarget(definition.improvementCost, from + 1);
        maximum = combatTechniqueMaximum(definition, attributes);
      } else if (kind === "spell") {
        const definition = getSpellDefinition(targetId);
        const column = definition?.improvementCost as ImprovementCost | undefined;
        if (!definition || !column || !["A", "B", "C", "D"].includes(column)) return;
        label = definition.name;
        from = state.hero.spells?.[targetId] ?? 0;
        cost = improvementCostForTarget(column, from + 1);
        maximum = 14;
      } else {
        const resourceId = targetId as "lp" | "ae" | "kp";
        const labels = { lp: "Lebensenergie", ae: "Astralenergie", kp: "Karmaenergie" };
        const attributeField = resourceId === "lp" ? "lp" : resourceId === "ae" ? "ae" : "kp";
        const purchased = Number(state.hero.attr[attributeField] ?? 0);
        label = labels[resourceId];
        from = state.runtime.resources[resourceId].max;
        cost = improvementCostForTarget("D", purchased + 1);
        maximum = from + Math.max(0, (resourceId === "lp" ? attributes.KO : Math.max(...Object.values(attributes))) - purchased);
      }

      if ((!advancement.ignoreLimits && from >= maximum) || advancement.availableAp < cost) {
        showToast(from >= maximum ? "Der regeltechnische Maximalwert ist erreicht." : "Dafür sind nicht genügend AP vorhanden.", "error");
        return;
      }

      if (kind === "attribute") {
        const value = state.hero.attr.values.find((entry) => entry.id === targetId);
        if (!value) return;
        value.value += 1;
        if (targetId === "ATTR_7") state.runtime.resources.lp.max += 2;
      } else if (kind === "talent") {
        state.hero.talents[targetId] = from + 1;
      } else if (kind === "combatTechnique") {
        state.hero.ct ??= {};
        state.hero.ct[targetId] = from + 1;
      } else if (kind === "spell") {
        state.hero.spells ??= {};
        state.hero.spells[targetId] = from + 1;
      } else {
        const resourceId = targetId as "lp" | "ae" | "kp";
        if (resourceId === "lp") state.hero.attr.lp = Number(state.hero.attr.lp ?? 0) + 1;
        if (resourceId === "ae") state.hero.attr.ae = Number(state.hero.attr.ae ?? 0) + 1;
        if (resourceId === "kp") state.hero.attr.kp = Number(state.hero.attr.kp ?? 0) + 1;
        state.runtime.resources[resourceId].max += 1;
      }

      const historyEntry: AdvancementHistoryEntry = {
        id: `ADV_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        kind,
        targetId,
        label,
        from,
        to: from + 1,
        cost,
      };
      advancement.availableAp -= cost;
      advancement.spentAp += cost;
      advancement.history.push(historyEntry);
      state.hero.dateModified = historyEntry.timestamp;
      persist();
      render();
      showToast(`${label} wurde auf ${from + 1} gesteigert.`);
    });
  });

  document.querySelector("#undo-advancement")?.addEventListener("click", () => {
    if (!state) return;
    const advancement = state.runtime.advancement;
    const entry = advancement.history.at(-1);
    if (!entry || !window.confirm(`Die Steigerung „${entry.label}“ zurücknehmen und ${entry.cost} AP erstatten?`)) return;
    if (entry.kind === "attribute") {
      const value = state.hero.attr.values.find((attribute) => attribute.id === entry.targetId);
      if (value) value.value = entry.from;
      if (entry.targetId === "ATTR_7") {
        state.runtime.resources.lp.max = Math.max(1, state.runtime.resources.lp.max - 2);
        state.runtime.resources.lp.current = Math.min(state.runtime.resources.lp.current, state.runtime.resources.lp.max);
      }
    } else if (entry.kind === "talent") {
      state.hero.talents[entry.targetId] = entry.from;
    } else if (entry.kind === "combatTechnique") {
      state.hero.ct ??= {};
      state.hero.ct[entry.targetId] = entry.from;
    } else if (entry.kind === "spell") {
      state.hero.spells ??= {};
      state.hero.spells[entry.targetId] = entry.from;
    } else {
      const resourceId = entry.targetId as "lp" | "ae" | "kp";
      if (resourceId === "lp") state.hero.attr.lp = Math.max(0, Number(state.hero.attr.lp ?? 0) - 1);
      if (resourceId === "ae") state.hero.attr.ae = Math.max(0, Number(state.hero.attr.ae ?? 0) - 1);
      if (resourceId === "kp") state.hero.attr.kp = Math.max(0, Number(state.hero.attr.kp ?? 0) - 1);
      state.runtime.resources[resourceId].max = entry.from;
      state.runtime.resources[resourceId].current = Math.min(state.runtime.resources[resourceId].current, entry.from);
    }
    advancement.history.pop();
    advancement.availableAp += entry.cost;
    advancement.spentAp = Math.max(0, advancement.spentAp - entry.cost);
    persist();
    render();
    showToast(`${entry.cost} AP wurden erstattet.`);
  });

  document.querySelector("#add-inventory-item")?.addEventListener("click", () => {
    if (!state) return;
    state.hero.belongings ??= {};
    state.hero.belongings.items ??= {};
    let id = `ITEM_CUSTOM_${Date.now().toString(36)}`;
    while (state.hero.belongings.items[id]) id += "_1";
    state.hero.belongings.items[id] = {
      id,
      name: "Neuer Gegenstand",
      gr: 7,
      amount: 1,
      weight: 0,
      price: 0,
    };
    persist(false);
    render();
    document.querySelector<HTMLInputElement>(`[data-inventory-key="${id}"][data-inventory-field="name"]`)?.select();
  });

  document.querySelector<HTMLSelectElement>("#inventory-sort")?.addEventListener("change", (event) => {
    inventorySort = (event.target as HTMLSelectElement).value as InventorySort;
    render();
  });

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-inventory-key][data-inventory-field]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state) return;
      const key = input.dataset.inventoryKey;
      const field = input.dataset.inventoryField as "name" | "gr" | "amount" | "weight" | "price";
      const item = key ? state.hero.belongings?.items?.[key] : undefined;
      if (!item) return;
      if (field === "name") item.name = input.value.trim() || "Unbenannter Gegenstand";
      else if (field === "gr") item.gr = Math.max(0, Math.round(asNumber(input.value, item.gr ?? 0)));
      else if (field === "amount") item.amount = Math.max(0, Math.round(asNumber(input.value, item.amount ?? 1)));
      else item[field] = Math.max(0, asNumber(input.value, item[field] ?? 0));
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-inventory]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      const key = button.dataset.deleteInventory;
      const item = key ? state.hero.belongings?.items?.[key] : undefined;
      if (!key || !item || !window.confirm(`„${item.name}“ aus dem Inventar löschen?`)) return;
      delete state.hero.belongings?.items?.[key];
      if (state.runtime.combat.primaryWeaponId === key) {
        state.runtime.combat.primaryWeaponId = getDefaultPrimaryWeaponId(state.hero);
      }
      persist();
      render();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-purse]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!state) return;
      const key = input.dataset.purse as "d" | "s" | "h" | "k";
      state.hero.belongings ??= {};
      state.hero.belongings.purse ??= {};
      state.hero.belongings.purse[key] = input.value.trim() || "0";
      persist(false);
      render();
    });
  });

  document.querySelector("#link-token")?.addEventListener("click", async () => {
    if (!state) return;
    try {
      const linked = await bridge.linkSelectedToken(state);
      state.runtime.linkedTokenId = linked.id;
      state.runtime.linkedTokenName = linked.name;
      state.runtime.statusDisplayId = linked.statusDisplayId;
      persist(false);
      render();
      if (linked.statusWarning) showToast(linked.statusWarning, "error");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Der Token konnte nicht verbunden werden.", "error");
    }
  });

  document.querySelector("#sync-status-display")?.addEventListener("click", async () => {
    if (!state) return;
    try {
      state.runtime.statusDisplayId = await bridge.ensureLinkedStatusDisplay(state);
      persist(false);
      render();
      showToast("Die Kartenanzeige wurde angelegt oder aktualisiert.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Die Kartenanzeige konnte nicht erstellt werden.", "error");
    }
  });

  const talentSearchInput = document.querySelector<HTMLInputElement>("#talent-search");
  talentSearchInput?.addEventListener("input", () => {
    talentSearch = talentSearchInput.value;
    render();
    const refreshed = document.querySelector<HTMLInputElement>("#talent-search");
    refreshed?.focus();
    refreshed?.setSelectionRange(talentSearch.length, talentSearch.length);
  });

  const spellSearchInput = document.querySelector<HTMLInputElement>("#spell-search");
  spellSearchInput?.addEventListener("input", () => {
    spellSearch = spellSearchInput.value;
    render();
    const refreshed = document.querySelector<HTMLInputElement>("#spell-search");
    refreshed?.focus();
    refreshed?.setSelectionRange(spellSearch.length, spellSearch.length);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) return;
      const id = button.dataset.favorite;
      if (!id) return;
      const favorites = new Set(state.runtime.favoriteTalentIds);
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      state.runtime.favoriteTalentIds = [...favorites];
      persist(false);
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-roll-talent]").forEach((button) => {
    button.addEventListener("click", () => {
      const talentId = button.dataset.rollTalent;
      if (!talentId) return;
      rollDialog = { kind: "talent", entryId: talentId, modifier: 0 };
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-roll-spell]").forEach((button) => {
    button.addEventListener("click", () => {
      const spellId = button.dataset.rollSpell;
      if (!spellId || !getSpellDefinition(spellId)?.check) return;
      rollDialog = { kind: "spell", entryId: spellId, modifier: 0 };
      render();
    });
  });

  document.querySelector("#close-roll")?.addEventListener("click", () => {
    rollDialog = null;
    render();
  });
  document.querySelector("#roll-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      rollDialog = null;
      render();
    }
  });
  document.querySelector<HTMLInputElement>("#roll-modifier")?.addEventListener("change", (event) => {
    if (!rollDialog) return;
    rollDialog.modifier = Math.max(-20, Math.min(20, asNumber((event.target as HTMLInputElement).value)));
    rollDialog.result = undefined;
  });
  document.querySelector("#perform-roll")?.addEventListener("click", () => {
    if (!state || !rollDialog) return;
    const modifierInput = document.querySelector<HTMLInputElement>("#roll-modifier");
    rollDialog.modifier = Math.max(-20, Math.min(20, asNumber(modifierInput?.value ?? "0")));
    const definition = rollDialog.kind === "talent"
      ? TALENT_BY_ID[rollDialog.entryId]
      : getSpellDefinition(rollDialog.entryId);
    if (!definition?.check) return;
    const attributes = getAttributeValues(state.hero);
    const values = definition.check.map((code: AttributeCode) => attributes[code]) as [number, number, number];
    const skillValue = rollDialog.kind === "talent"
      ? state.hero.talents[definition.id] ?? 0
      : state.hero.spells?.[definition.id] ?? 0;
    rollDialog.result = rollTalent(values, skillValue, rollDialog.modifier);
    render();
  });
};

const render = (): void => {
  root.innerHTML = state
    ? renderSheet(state)
    : groupDashboardOpen && bridge.isGameMaster
      ? renderGameMasterShell()
      : renderImportScreen();
  if (state) attachSheetListeners();
  else if (groupDashboardOpen && bridge.isGameMaster) attachGroupMonitorListeners();
  else attachImportListeners();
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && rollDialog) {
    rollDialog = null;
    render();
  }
});

render();
void bridge.initialize().then((available) => {
  if (!available) return;
  render();
  if (bridge.isGameMaster && groupMonitorVisible()) void refreshGroupMembers();
});

bridge.onChange((reason) => {
  if (reason === "player") {
    if (!bridge.isGameMaster) {
      groupDashboardOpen = false;
      if (activeTab === "group") activeTab = "overview";
    }
    render();
  }
  if (!bridge.isGameMaster) return;
  if (!groupMonitorVisible()) return;
  window.clearTimeout(groupRefreshTimer);
  groupRefreshTimer = window.setTimeout(() => void refreshGroupMembers(false), 180);
});
