import OBR, { buildLabel } from "@owlbear-rodeo/sdk";
import type { Item, Label } from "@owlbear-rodeo/sdk";
import { createTokenSheetSummary, getHealthPresentation, parseTokenSheetSummary } from "./group-monitor";
import type { CharacterSheetState, GroupHeroSummary, TokenSheetSummary } from "./types";

const EXTENSION_ID = "de.alexander-hoffmann.dsa5-sheet";
const METADATA_KEY = `${EXTENSION_ID}/summary`;
const STATUS_METADATA_KEY = `${EXTENSION_ID}/status-display`;

interface StatusDisplayLink {
  version: 1;
  heroId: string;
  tokenId: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStatusDisplayLink = (item: Item): StatusDisplayLink | null => {
  const value = item.metadata[STATUS_METADATA_KEY];
  if (!isObject(value) || typeof value.heroId !== "string" || typeof value.tokenId !== "string") return null;
  return { version: 1, heroId: value.heroId, tokenId: value.tokenId };
};

const statusText = (summary: TokenSheetSummary): string => {
  const health = getHealthPresentation(summary.lp);
  return `${summary.name} · LeP ${summary.lp.current}/${summary.lp.max}\n${health.label.toUpperCase()}`;
};

export class OwlbearBridge {
  available = false;
  role: "GM" | "PLAYER" | null = null;
  private listeners = new Set<(reason: "scene" | "player") => void>();
  private unsubscribeItems?: () => void;
  private unsubscribePlayer?: () => void;

  get isGameMaster(): boolean {
    return this.role === "GM";
  }

  onChange(listener: (reason: "scene" | "player") => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(reason: "scene" | "player"): void {
    for (const listener of this.listeners) listener(reason);
  }

  async initialize(): Promise<boolean> {
    if (!OBR.isAvailable) return false;
    if (!OBR.isReady) {
      await new Promise<void>((resolve) => {
        OBR.onReady(resolve);
      });
    }
    this.available = true;
    this.role = await OBR.player.getRole();
    this.unsubscribeItems?.();
    this.unsubscribePlayer?.();
    this.unsubscribeItems = OBR.scene.items.onChange(() => this.emitChange("scene"));
    this.unsubscribePlayer = OBR.player.onChange((player) => {
      this.role = player.role;
      this.emitChange("player");
    });
    return true;
  }

  private async resolveSelectedCharacterToken(): Promise<Item> {
    const selection = await OBR.player.getSelection();
    if (!selection || selection.length !== 1) {
      throw new Error("Wähle auf der Karte genau einen Charaktertoken oder eine Statusanzeige aus.");
    }
    const [selected] = await OBR.scene.items.getItems(selection);
    if (!selected) throw new Error("Das ausgewählte Element wurde nicht gefunden.");
    if (selected.layer === "CHARACTER") return selected;
    const link = readStatusDisplayLink(selected);
    if (link) {
      const [token] = await OBR.scene.items.getItems([link.tokenId]);
      if (token?.layer === "CHARACTER") return token;
    }
    throw new Error("Das ausgewählte Element ist kein Charaktertoken und keine Helden-Statusanzeige.");
  }

  async linkSelectedToken(state: CharacterSheetState): Promise<{
    id: string;
    name: string;
    statusDisplayId?: string;
    statusWarning?: string;
  }> {
    if (!this.available) throw new Error("Owlbear Rodeo ist in der Vorschau nicht verbunden.");
    const token = await this.resolveSelectedCharacterToken();
    const summary = createTokenSheetSummary(state);
    await OBR.scene.items.updateItems([token], (items) => {
      for (const item of items) item.metadata[METADATA_KEY] = summary;
    });

    let statusDisplayId: string | undefined;
    let statusWarning: string | undefined;
    try {
      statusDisplayId = await this.ensureStatusDisplay(token, summary, state.runtime.statusDisplayId);
    } catch {
      statusWarning = "Der Bogen wurde verbunden, aber Owlbear hat keine Berechtigung zum Anlegen der Kartenanzeige.";
    }
    await OBR.notification.show(
      statusWarning
        ? `${state.hero.name} wurde verbunden. Die Statusanzeige kann der GM im Gruppenmonitor anlegen.`
        : `${state.hero.name} wurde mit Token und Statusanzeige verknüpft.`,
      statusWarning ? "WARNING" : "SUCCESS",
    );
    return { id: token.id, name: token.name || state.hero.name, statusDisplayId, statusWarning };
  }

  async syncLinkedToken(state: CharacterSheetState): Promise<void> {
    const tokenId = state.runtime.linkedTokenId;
    if (!this.available || !tokenId) return;
    const [token] = await OBR.scene.items.getItems([tokenId]);
    if (!token) return;
    const summary = createTokenSheetSummary(state);
    await OBR.scene.items.updateItems([token], (draft) => {
      for (const item of draft) item.metadata[METADATA_KEY] = summary;
    });
    try {
      state.runtime.statusDisplayId = await this.ensureStatusDisplay(
        token,
        summary,
        state.runtime.statusDisplayId,
      );
    } catch {
      // Die Token-Metadaten bleiben auch ohne Berechtigung für Anhänge aktuell.
    }
  }

  async ensureLinkedStatusDisplay(state: CharacterSheetState): Promise<string> {
    if (!this.available || !state.runtime.linkedTokenId) {
      throw new Error("Verbinde den Bogen zuerst mit einem Charaktertoken.");
    }
    const [token] = await OBR.scene.items.getItems([state.runtime.linkedTokenId]);
    if (!token) throw new Error("Der verbundene Charaktertoken befindet sich nicht in der aktuellen Szene.");
    const summary = createTokenSheetSummary(state);
    await OBR.scene.items.updateItems([token], (items) => {
      for (const item of items) item.metadata[METADATA_KEY] = summary;
    });
    return this.ensureStatusDisplay(token, summary, state.runtime.statusDisplayId);
  }

  async getGroupSummaries(): Promise<GroupHeroSummary[]> {
    if (!this.available || !this.isGameMaster) return [];
    const items = await OBR.scene.items.getItems();
    const statusByToken = new Map<string, string>();
    for (const item of items) {
      const link = readStatusDisplayLink(item);
      if (link) statusByToken.set(link.tokenId, item.id);
    }
    const members: GroupHeroSummary[] = [];
    for (const token of items.filter((item) => item.layer === "CHARACTER")) {
      const summary = parseTokenSheetSummary(token.metadata[METADATA_KEY]);
      if (!summary) continue;
      const statusDisplayId = statusByToken.get(token.id);
      members.push({
        tokenId: token.id,
        tokenName: token.name || summary.name,
        ...(statusDisplayId ? { statusDisplayId } : {}),
        summary,
      });
    }
    return members.sort((a, b) => a.summary.name.localeCompare(b.summary.name, "de"));
  }

  async ensureGroupStatusDisplays(): Promise<number> {
    if (!this.available || !this.isGameMaster) {
      throw new Error("Statusanzeigen für die Gruppe können nur vom GM angelegt werden.");
    }
    const items = await OBR.scene.items.getItems();
    const tokensById = new Map(items.filter((item) => item.layer === "CHARACTER").map((item) => [item.id, item]));
    let updated = 0;
    for (const member of await this.getGroupSummaries()) {
      const token = tokensById.get(member.tokenId);
      if (!token) continue;
      await this.ensureStatusDisplay(token, member.summary, member.statusDisplayId);
      updated += 1;
    }
    return updated;
  }

  private async ensureStatusDisplay(
    token: Item,
    summary: TokenSheetSummary,
    preferredId?: string,
  ): Promise<string> {
    const health = getHealthPresentation(summary.lp);
    const attachments = await OBR.scene.items.getItemAttachments([token.id]);
    const existing = attachments.find((item) => {
      if (preferredId && item.id === preferredId) return true;
      const link = readStatusDisplayLink(item);
      return link?.tokenId === token.id && link.heroId === summary.heroId;
    });
    const link: StatusDisplayLink = { version: 1, heroId: summary.heroId, tokenId: token.id };

    if (existing?.type === "LABEL") {
      await OBR.scene.items.updateItems<Label>([existing as Label], (items) => {
        for (const item of items) {
          item.name = `Heldenstatus · ${summary.name}`;
          item.description = `Verknüpfte Statusanzeige für ${summary.name}: ${summary.lp.current} von ${summary.lp.max} LeP, ${health.label}.`;
          item.text.plainText = statusText(summary);
          item.text.type = "PLAIN";
          item.style.backgroundColor = health.color;
          item.metadata[STATUS_METADATA_KEY] = link;
          item.attachedTo = token.id;
        }
      });
      return existing.id;
    }

    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const label = buildLabel()
      .name(`Heldenstatus · ${summary.name}`)
      .description(`Verknüpfte Statusanzeige für ${summary.name}: ${summary.lp.current} von ${summary.lp.max} LeP, ${health.label}.`)
      .plainText(statusText(summary))
      .width(230)
      .height("AUTO")
      .padding(10)
      .fontSize(17)
      .fontWeight(800)
      .lineHeight(1.15)
      .fillColor("#fffdf5")
      .backgroundColor(health.color)
      .backgroundOpacity(0.96)
      .cornerRadius(10)
      .pointerDirection("DOWN")
      .pointerWidth(9)
      .pointerHeight(8)
      .position({ x: bounds.center.x, y: bounds.min.y - 18 })
      .attachedTo(token.id)
      .layer("ATTACHMENT")
      .disableAttachmentBehavior(["ROTATION", "SCALE"])
      .metadata({ [STATUS_METADATA_KEY]: link })
      .build();
    await OBR.scene.items.addItems([label]);
    return label.id;
  }
}
