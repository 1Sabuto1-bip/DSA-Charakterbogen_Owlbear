import "./styles.css";

import {
  ATTRIBUTES,
  COMBAT_TECHNIQUES,
  ITEM_GROUPS,
  SPECIES,
  SPECIES_BY_ID,
  TALENTS,
  TALENT_BY_ID,
} from "./data";
import { CANTRIPS, SPELLS, SPELL_BY_ID } from "./magic-data";
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
import { rollTalent } from "./roll";
import { clearState, loadState, saveState } from "./storage";
import type {
  CharacterSheetState,
  AttributeCode,
  ManualSpecies,
  ResourceValue,
  SpellDefinition,
  TalentDefinition,
  TalentRollResult,
} from "./types";

type TabId = "overview" | "talents" | "spells" | "combat" | "inventory" | "source";

interface RollDialogState {
  kind: "talent" | "spell";
  entryId: string;
  modifier: number;
  result?: TalentRollResult;
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App container not found");

const bridge = new OwlbearBridge();
let state: CharacterSheetState | null = loadState();
let activeTab: TabId = "overview";
let talentSearch = "";
let spellSearch = "";
let rollDialog: RollDialogState | null = null;
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

const formatSigned = (value = 0): string => (value > 0 ? `+${value}` : String(value));

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
    persist(false);
    render();
    showToast(`${state.hero.name} wurde erfolgreich importiert.`);
  } catch (error) {
    const message = error instanceof HeroImportError ? error.message : "Die Datei konnte nicht gelesen werden.";
    showToast(message, "error");
  }
};

const renderImportScreen = (): string => `
  <main class="welcome-shell">
    <section class="welcome-card">
      <div class="sigil" aria-hidden="true">3W20</div>
      <p class="eyebrow">Owlbear Rodeo · DSA 5</p>
      <h1>Aventurischer<br />Heldenbogen</h1>
      <p class="welcome-copy">
        Importiere einen Optolith-Helden als JSON. Der Bogen bleibt in deinem Browser gespeichert
        und kann anschließend mit einem Charaktertoken verbunden werden.
      </p>
      <label class="drop-zone" id="drop-zone">
        <input id="hero-file" type="file" accept="application/json,.json" hidden />
        <span class="drop-zone__icon" aria-hidden="true">⇧</span>
        <strong>JSON-Datei auswählen</strong>
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
        <span>✓ Optolith 1.5.x</span>
        <span>✓ lokale Speicherung</span>
        <span>✓ 3W20-Proben</span>
      </div>
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
                ? `Verknüpft mit <strong>${escapeHtml(sheet.runtime.linkedTokenName ?? "Charaktertoken")}</strong>. LeP und weitere Ressourcen werden am Token aktualisiert.`
                : bridge.available
                  ? "Wähle einen Charaktertoken auf der Karte aus und verbinde ihn mit diesem Bogen."
                  : "In der Browser-Vorschau ist keine Owlbear-Szene verbunden."
            }
          </p>
          <button class="secondary-button" id="link-token" ${bridge.available ? "" : "disabled"}>
            ${sheet.runtime.linkedTokenId ? "Anderen Token verbinden" : "Ausgewählten Token verbinden"}
          </button>
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
  return `
    <div class="talent-row spell-row">
      <span class="spell-sigil" aria-hidden="true">✦</span>
      <div class="talent-name"><strong>${escapeHtml(name)}</strong><span>${definition ? `${definition.kind} · Steigerungsfaktor ${definition.improvementCost}${definition.checkModifier ? ` · mod. ${definition.checkModifier}` : ""}` : "Unbekannte Optolith-Kennung"}</span></div>
      <div class="check-badges" aria-label="${definition ? `Probe ${definition.check.join(" ")}` : "Probe unbekannt"}">
        ${definition ? definition.check.map((attribute) => `<span>${attribute}</span>`).join("") : '<span>?</span><span>?</span><span>?</span>'}
      </div>
      ${editable
        ? `<input class="talent-value talent-value-input" data-manual-spell="${escapeHtml(id)}" type="number" min="0" max="30" value="${value}" aria-label="Fertigkeitswert ${escapeHtml(name)}" />`
        : `<span class="talent-value" title="Fertigkeitswert">${value}</span>`}
      <button class="roll-button" data-roll-spell="${escapeHtml(id)}" ${definition ? "" : "disabled"}>3W20</button>
      ${editable ? `<button class="spell-delete" data-delete-spell="${escapeHtml(id)}" title="Zauber entfernen" aria-label="${escapeHtml(name)} entfernen">×</button>` : ""}
    </div>`;
};

const renderSpells = (sheet: CharacterSheetState): string => {
  const editable = sheet.source === "manual";
  const query = spellSearch.trim().toLocaleLowerCase("de");
  const learnedSpellIds = Object.keys(sheet.hero.spells ?? {});
  const spellEntries = learnedSpellIds
    .map((id) => ({ id, definition: SPELL_BY_ID[id], value: sheet.hero.spells?.[id] ?? 0 }))
    .filter((entry) => !query || (entry.definition?.name ?? entry.id).toLocaleLowerCase("de").includes(query))
    .sort((a, b) => (a.definition?.name ?? a.id).localeCompare(b.definition?.name ?? b.id, "de"));
  const learnedCantrips = (sheet.hero.cantrips ?? [])
    .map((id) => ({ id, name: CANTRIPS[id] ?? id }))
    .filter((entry) => !query || entry.name.toLocaleLowerCase("de").includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const availableSpells = SPELLS
    .filter((definition) => !learnedSpellIds.includes(definition.id))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
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
      ${editable ? `<article class="spell-add-panel">
        <label><span>Zauber aus dem Optolith-Katalog</span><select id="spell-catalog-select" ${availableSpells.length ? "" : "disabled"}>
          ${availableSpells.map((definition) => `<option value="${definition.id}">${escapeHtml(definition.name)} (${definition.kind}, ${definition.check.join("/")})</option>`).join("") || '<option>Alle Zauber hinzugefügt</option>'}
        </select></label>
        <button class="primary-button" id="add-spell" ${availableSpells.length ? "" : "disabled"}>+ Zauber</button>
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

const renderCombat = (sheet: CharacterSheetState): string => {
  const isManual = sheet.source === "manual";
  const techniqueIds = isManual ? Object.keys(COMBAT_TECHNIQUES) : Object.keys(sheet.hero.ct ?? {});
  const techniques = techniqueIds
    .map((id) => [id, sheet.hero.ct?.[id] ?? 0] as const)
    .sort((a, b) => isManual
      ? (COMBAT_TECHNIQUES[a[0]] ?? a[0]).localeCompare(COMBAT_TECHNIQUES[b[0]] ?? b[0], "de")
      : b[1] - a[1]);
  const items = Object.values(sheet.hero.belongings?.items ?? {});
  const weapons = items.filter((item) => item.damageDiceSides || item.combatTechnique);
  const armor = items.filter((item) => typeof item.pro === "number");

  return `
    <section class="page page--combat">
      <div class="section-title"><div><p class="eyebrow">Kampfwerte</p><h2>Kampftechniken</h2></div></div>
      <div class="technique-grid">
        ${techniques
          .map(
            ([id, value]) => `<article class="technique-card">
              <span>${escapeHtml(COMBAT_TECHNIQUES[id] ?? id)}</span>${isManual ? `<input data-manual-technique="${id}" type="number" min="0" max="30" value="${value}" aria-label="Kampftechnik ${escapeHtml(COMBAT_TECHNIQUES[id] ?? id)}" />` : `<strong>${value}</strong>`}<small>Ktw</small>
            </article>`,
          )
          .join("") || '<div class="empty-state">Keine Kampftechniken importiert.</div>'}
      </div>

      <div class="section-title section-title--resources"><div><p class="eyebrow">Ausrüstung</p><h2>Waffen</h2></div></div>
      <div class="weapon-list">
        ${weapons
          .map((weapon) => {
            const damage = weapon.damageDiceSides
              ? `${weapon.damageDiceNumber ?? 1}W${weapon.damageDiceSides}${weapon.damageFlat ? formatSigned(weapon.damageFlat) : ""}`
              : "—";
            return `<article class="weapon-card">
              <div class="weapon-card__name"><span class="weapon-icon">⚔</span><div><strong>${escapeHtml(weapon.name)}</strong><span>${escapeHtml(COMBAT_TECHNIQUES[weapon.combatTechnique ?? ""] ?? weapon.combatTechnique ?? "Waffe")}</span></div></div>
              <dl>
                <div><dt>TP</dt><dd>${damage}</dd></div>
                <div><dt>AT</dt><dd>${formatSigned(weapon.at)}</dd></div>
                <div><dt>PA</dt><dd>${formatSigned(weapon.pa)}</dd></div>
                <div><dt>RW</dt><dd>${weapon.reach ?? "—"}</dd></div>
              </dl>
            </article>`;
          })
          .join("") || '<div class="empty-state">Keine Waffen importiert.</div>'}
      </div>

      ${
        armor.length
          ? `<div class="section-title section-title--resources"><div><p class="eyebrow">Schutz</p><h2>Rüstungen</h2></div></div>
            <div class="armor-list">${armor
              .map(
                (item) => `<article class="armor-card"><strong>${escapeHtml(item.name)}</strong><span>RS ${item.pro ?? 0}</span><span>BE ${item.enc ?? 0}</span></article>`,
              )
              .join("")}</div>`
          : ""
      }
    </section>
  `;
};

const renderInventory = (sheet: CharacterSheetState): string => {
  const items = Object.entries(sheet.hero.belongings?.items ?? {})
    .map(([key, item]) => ({ key, item }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name, "de"));
  const purse = sheet.hero.belongings?.purse ?? {};
  const totalWeight = items.reduce((sum, entry) => sum + (entry.item.weight ?? 0) * (entry.item.amount ?? 1), 0);

  return `
    <section class="page page--inventory">
      <div class="section-title">
        <div><p class="eyebrow">Hab und Gut</p><h2>Inventar</h2></div>
        <div class="inventory-heading-actions"><span class="section-hint">${formatNumber(totalWeight)} Stein</span><button class="primary-button inventory-add" id="add-inventory-item">+ Gegenstand</button></div>
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
            ${items
              .map(
                ({ key, item }) => `<tr>
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
                </tr>`,
              )
              .join("") || '<tr><td colspan="5" class="empty-state">Noch keine Gegenstände vorhanden.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const renderSource = (sheet: CharacterSheetState): string => {
  const isManual = sheet.source === "manual";
  return `
  <section class="page page--source">
    <div class="section-title"><div><p class="eyebrow">Import & Sicherung</p><h2>Quelldaten</h2></div></div>
    <article class="panel source-card">
      <div class="source-logo">${isManual ? "M" : "O"}</div>
      <div><h3>${isManual ? "Manuell ausgefüllter Bogen" : `Optolith ${escapeHtml(sheet.hero.clientVersion)}`}</h3><p>${isManual ? "Angelegt" : "Importiert"} am ${new Date(sheet.importedAt).toLocaleString("de-DE")}</p></div>
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
      <p class="panel-copy">Die Sicherung enthält alle Werte, Ressourcen, Talente, Gegenstände, Notizen und die Token-Verknüpfung.</p>
      <div class="button-row">
        <button class="primary-button" id="export-backup">Owlbear-JSON sichern</button>
        ${isManual ? "" : '<button class="secondary-button" id="export-original">Original exportieren</button>'}
      </div>
    </article>
    <aside class="info-callout">
      <strong>Stand dieses Prototyps</strong>
      <p>${isManual ? "Name, Spezies, magische Begabung, Eigenschaften, alle 59 Basistalente, Zauber, Kampftechniken, Ressourcen, Inventar und Geldbörse können direkt bearbeitet werden." : "Alle 59 Basistalente sowie vorhandene Zauber, Zaubertricks, Kampftechniken und Gegenstände aus Optolith 1.5.x werden eingelesen. Das Inventar und die Geldbörse können direkt bearbeitet werden."}</p>
    </aside>
  </section>
  `;
};

const renderRollDialog = (sheet: CharacterSheetState): string => {
  if (!rollDialog) return "";
  const definition = rollDialog.kind === "talent"
    ? TALENT_BY_ID[rollDialog.entryId]
    : SPELL_BY_ID[rollDialog.entryId];
  if (!definition) return "";
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
  const content = {
    overview: renderOverview,
    talents: renderTalents,
    spells: renderSpells,
    combat: renderCombat,
    inventory: renderInventory,
    source: renderSource,
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
          <span>${sheet.source === "manual" ? "Manuell angelegt" : `Optolith ${escapeHtml(sheet.hero.clientVersion)}`}</span>
        </div>
        <div class="header-actions">
          <label class="icon-button" title="Anderen Helden importieren">
            <input id="replace-hero-file" type="file" accept="application/json,.json" hidden />
            ⇧
          </label>
          <button class="icon-button" id="export-quick" title="Spielstand sichern">↓</button>
        </div>
      </header>
      <nav class="main-nav" aria-label="Heldenbogen-Bereiche" style="grid-template-columns: repeat(${hasMagic ? 6 : 5}, 1fr)">
        ${tabLabel("overview", "Übersicht", "◆")}
        ${tabLabel("talents", "Talente", "◈")}
        ${hasMagic ? tabLabel("spells", "Zauber", "✦") : ""}
        ${tabLabel("combat", "Kampf", "⚔")}
        ${tabLabel("inventory", "Inventar", "▣")}
        ${tabLabel("source", "Daten", "⋯")}
      </nav>
      <main class="content">${content}</main>
      <footer class="app-footer">
        <span><i class="connection-dot ${bridge.available ? "connection-dot--online" : ""}"></i>${bridge.available ? "Mit Owlbear Rodeo verbunden" : "Lokale Vorschau"}</span>
        <button id="remove-hero">Helden aus diesem Browser entfernen</button>
      </footer>
    </div>
    ${renderRollDialog(sheet)}
  `;
};

const attachImportListeners = (): void => {
  const input = document.querySelector<HTMLInputElement>("#hero-file");
  input?.addEventListener("change", () => void importFile(input.files?.[0]));
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

  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab as TabId;
      render();
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
      persist(false);
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

  document.querySelector("#add-spell")?.addEventListener("click", () => {
    if (!state || state.source !== "manual") return;
    const select = document.querySelector<HTMLSelectElement>("#spell-catalog-select");
    const id = select?.value;
    if (!id || !SPELL_BY_ID[id]) return;
    state.hero.spells ??= {};
    state.hero.spells[id] = 0;
    persist(false);
    render();
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
    persist(false);
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-cantrip]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state || state.source !== "manual") return;
      const id = button.dataset.deleteCantrip;
      if (!id) return;
      state.hero.cantrips = (state.hero.cantrips ?? []).filter((entry) => entry !== id);
      persist(false);
      render();
    });
  });

  const backup = (): void => downloadJson(`${state?.hero.name ?? "Held"}-owlbear.json`, state);
  document.querySelector("#export-quick")?.addEventListener("click", backup);
  document.querySelector("#export-backup")?.addEventListener("click", backup);
  document.querySelector("#export-original")?.addEventListener("click", () => {
    if (state) downloadJson(`${state.hero.name}-optolith.json`, state.hero);
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
      persist(false);
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
      persist(false);
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
      persist(false);
      render();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Der Token konnte nicht verbunden werden.", "error");
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
      if (!spellId || !SPELL_BY_ID[spellId]) return;
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
      : SPELL_BY_ID[rollDialog.entryId];
    if (!definition) return;
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
  root.innerHTML = state ? renderSheet(state) : renderImportScreen();
  state ? attachSheetListeners() : attachImportListeners();
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && rollDialog) {
    rollDialog = null;
    render();
  }
});

render();
void bridge.initialize().then((available) => {
  if (available) render();
});
