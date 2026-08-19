import "./styles.css";

import { ATTRIBUTES, COMBAT_TECHNIQUES, ITEM_GROUPS, TALENT_BY_ID } from "./data";
import {
  HeroImportError,
  calculateInitiative,
  getAttributeValues,
  importHeroJson,
} from "./importer";
import { OwlbearBridge } from "./owlbear";
import { rollTalent } from "./roll";
import { clearState, loadState, saveState } from "./storage";
import type {
  CharacterSheetState,
  ResourceValue,
  TalentDefinition,
  TalentRollResult,
} from "./types";

type TabId = "overview" | "talents" | "combat" | "inventory" | "source";

interface RollDialogState {
  talentId: string;
  modifier: number;
  result?: TalentRollResult;
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App container not found");

const bridge = new OwlbearBridge();
let state: CharacterSheetState | null = loadState();
let activeTab: TabId = "overview";
let talentSearch = "";
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
  const attributeValues = getAttributeValues(sheet.hero);
  const { resources } = sheet.runtime;
  const hasArcane = resources.ae.max > 0 || Object.keys(sheet.hero.spells ?? {}).length > 0;
  const hasKarma = resources.kp.max > 0 || Object.keys(sheet.hero.liturgies ?? {}).length > 0;
  const family = typeof sheet.hero.pers?.family === "string" ? sheet.hero.pers.family : "—";

  return `
    <section class="page page--overview">
      <div class="section-title">
        <div><p class="eyebrow">Grundwerte</p><h2>Eigenschaften</h2></div>
        <span class="section-hint">Importierte Werte</span>
      </div>
      <div class="attribute-grid">
        ${ATTRIBUTES.map(
          (attribute) => `
            <article class="attribute-card">
              <span class="attribute-code">${attribute.code}</span>
              <strong>${attributeValues[attribute.code]}</strong>
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
            <div><dt>Abenteuerpunkte</dt><dd>${sheet.hero.ap?.total ?? "—"}</dd></div>
            <div><dt>Familie</dt><dd>${escapeHtml(family)}</dd></div>
            <div><dt>Talente</dt><dd>${Object.keys(sheet.hero.talents).length}</dd></div>
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
): string => `
  <div class="talent-row">
    <button class="favorite-button ${favorite ? "favorite-button--active" : ""}" data-favorite="${definition.id}" aria-label="Favorit umschalten">★</button>
    <div class="talent-name"><strong>${escapeHtml(definition.name)}</strong><span>${definition.category}</span></div>
    <div class="check-badges" aria-label="Probe ${definition.check.join(" ")}">
      ${definition.check.map((attribute) => `<span>${attribute}</span>`).join("")}
    </div>
    <span class="talent-value" title="Fertigkeitswert">${value}</span>
    <button class="roll-button" data-roll-talent="${definition.id}">3W20</button>
  </div>
`;

const renderTalents = (sheet: CharacterSheetState): string => {
  const favorites = new Set(sheet.runtime.favoriteTalentIds);
  const query = talentSearch.trim().toLocaleLowerCase("de");
  const entries = Object.entries(sheet.hero.talents)
    .map(([id, value]) => ({ definition: TALENT_BY_ID[id], value }))
    .filter((entry): entry is { definition: TalentDefinition; value: number } => Boolean(entry.definition))
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
                .map((entry) => renderTalentRow(entry.definition, entry.value, favorites.has(entry.definition.id)))
                .join("")}
            </section>`;
          })
          .join("") || '<div class="empty-state">Kein passendes Talent gefunden.</div>'}
      </div>
    </section>
  `;
};

const renderCombat = (sheet: CharacterSheetState): string => {
  const techniques = Object.entries(sheet.hero.ct ?? {}).sort((a, b) => b[1] - a[1]);
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
              <span>${escapeHtml(COMBAT_TECHNIQUES[id] ?? id)}</span><strong>${value}</strong><small>Ktw</small>
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
  const items = Object.values(sheet.hero.belongings?.items ?? {}).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const purse = sheet.hero.belongings?.purse ?? {};
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 0) * (item.amount ?? 1), 0);

  return `
    <section class="page page--inventory">
      <div class="section-title">
        <div><p class="eyebrow">Hab und Gut</p><h2>Inventar</h2></div>
        <span class="section-hint">${formatNumber(totalWeight)} Stein</span>
      </div>
      <div class="purse" aria-label="Geldbörse">
        ${[
          ["d", "D", "Dukaten"],
          ["s", "S", "Silbertaler"],
          ["h", "H", "Heller"],
          ["k", "K", "Kreuzer"],
        ]
          .map(
            ([key, short, label]) => `<div title="${label}"><span>${short}</span><strong>${escapeHtml(purse[key as keyof typeof purse] || "0")}</strong></div>`,
          )
          .join("")}
      </div>
      <div class="inventory-table-wrap">
        <table class="inventory-table">
          <thead><tr><th>Gegenstand</th><th>Anzahl</th><th>Gewicht</th><th>Wert</th></tr></thead>
          <tbody>
            ${items
              .map(
                (item) => `<tr>
                  <td><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(ITEM_GROUPS[item.gr ?? 0] ?? "Ausrüstung")}</span></td>
                  <td>${item.amount ?? 1}</td>
                  <td>${typeof item.weight === "number" ? `${formatNumber(item.weight)} St` : "—"}</td>
                  <td>${typeof item.price === "number" ? formatNumber(item.price) : "—"}</td>
                </tr>`,
              )
              .join("") || '<tr><td colspan="4" class="empty-state">Keine Gegenstände importiert.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const renderSource = (sheet: CharacterSheetState): string => `
  <section class="page page--source">
    <div class="section-title"><div><p class="eyebrow">Import & Sicherung</p><h2>Quelldaten</h2></div></div>
    <article class="panel source-card">
      <div class="source-logo">O</div>
      <div><h3>Optolith ${escapeHtml(sheet.hero.clientVersion)}</h3><p>Importiert am ${new Date(sheet.importedAt).toLocaleString("de-DE")}</p></div>
      <span class="status-pill">erkannt</span>
    </article>
    <article class="panel">
      <div class="panel__header"><h3>Technische Kennungen</h3></div>
      <dl class="source-ids">
        <div><dt>Held</dt><dd>${escapeHtml(sheet.hero.id)}</dd></div>
        <div><dt>Spezies</dt><dd>${escapeHtml(sheet.hero.r ?? "—")}</dd></div>
        <div><dt>Kultur</dt><dd>${escapeHtml(sheet.hero.c ?? "—")}</dd></div>
        <div><dt>Profession</dt><dd>${escapeHtml(sheet.hero.p ?? "—")}</dd></div>
      </dl>
    </article>
    <article class="panel">
      <div class="panel__header"><h3>Spielstand sichern</h3></div>
      <p class="panel-copy">Die Sicherung enthält den unveränderten Optolith-Export sowie aktuelle Ressourcen, Favoriten, Notizen und die Token-Verknüpfung.</p>
      <div class="button-row">
        <button class="primary-button" id="export-backup">Owlbear-JSON sichern</button>
        <button class="secondary-button" id="export-original">Original exportieren</button>
      </div>
    </article>
    <aside class="info-callout">
      <strong>Stand dieses Prototyps</strong>
      <p>Eigenschaften, Basistalente, Kampftechniken und Gegenstände aus Optolith 1.5.x werden eingelesen. Vorteile, Nachteile, Sonderfertigkeiten sowie die Namensauflösung von Kultur und Profession folgen in einer späteren Ausbaustufe.</p>
    </aside>
  </section>
`;

const renderRollDialog = (sheet: CharacterSheetState): string => {
  if (!rollDialog) return "";
  const definition = TALENT_BY_ID[rollDialog.talentId];
  if (!definition) return "";
  const attributes = getAttributeValues(sheet.hero);
  const values = definition.check.map((code) => attributes[code]) as [number, number, number];
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
        <p class="eyebrow">Talentprobe</p>
        <h2 id="roll-title">${escapeHtml(definition.name)}</h2>
        <div class="roll-check">
          ${definition.check
            .map(
              (code, index) => `<div><span>${code}</span><strong>${values[index]}</strong></div>`,
            )
            .join("")}
          <div class="roll-skill"><span>FW</span><strong>${sheet.hero.talents[definition.id]}</strong></div>
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
  const content = {
    overview: renderOverview,
    talents: renderTalents,
    combat: renderCombat,
    inventory: renderInventory,
    source: renderSource,
  }[activeTab](sheet);

  return `
    <div class="app-shell">
      <header class="hero-header">
        <div class="hero-header__identity">
          <div class="hero-avatar">${escapeHtml(sheet.hero.name.charAt(0).toUpperCase())}</div>
          <div><p class="eyebrow">Heldenbogen</p><h1>${escapeHtml(sheet.hero.name)}</h1></div>
        </div>
        <div class="hero-meta">
          <span>${sheet.hero.ap?.total ?? "—"} AP</span>
          <span>Optolith ${escapeHtml(sheet.hero.clientVersion)}</span>
        </div>
        <div class="header-actions">
          <label class="icon-button" title="Anderen Helden importieren">
            <input id="replace-hero-file" type="file" accept="application/json,.json" hidden />
            ⇧
          </label>
          <button class="icon-button" id="export-quick" title="Spielstand sichern">↓</button>
        </div>
      </header>
      <nav class="main-nav" aria-label="Heldenbogen-Bereiche">
        ${tabLabel("overview", "Übersicht", "◆")}
        ${tabLabel("talents", "Talente", "◈")}
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
      state.runtime.resources[key] = { current: 20, max: 20 };
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
      rollDialog = { talentId, modifier: 0 };
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
    const definition = TALENT_BY_ID[rollDialog.talentId];
    const attributes = getAttributeValues(state.hero);
    const values = definition.check.map((code) => attributes[code]) as [number, number, number];
    rollDialog.result = rollTalent(values, state.hero.talents[definition.id], rollDialog.modifier);
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
