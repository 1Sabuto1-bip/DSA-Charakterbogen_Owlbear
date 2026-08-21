import OBR, { buildImage, buildText } from "@owlbear-rodeo/sdk";
import type { Image, Item, Text } from "@owlbear-rodeo/sdk";
import { createTokenSheetSummary, getHealthPresentation, parseTokenSheetSummary } from "./group-monitor";
import { createStatusTokenLayout, getStatusTokenText, STATUS_TOKEN_FRAME } from "./status-token";
import type { CharacterSheetState, GroupHeroSummary, TokenSheetSummary } from "./types";

const EXTENSION_ID = "de.alexander-hoffmann.dsa5-sheet";
const METADATA_KEY = `${EXTENSION_ID}/summary`;
const STATUS_METADATA_KEY = `${EXTENSION_ID}/status-display`;

interface StatusDisplayLink {
  version: 1 | 2;
  heroId: string;
  tokenId: string;
  role?: "frame" | "lp" | "condition" | "initiative";
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStatusDisplayLink = (item: Item): StatusDisplayLink | null => {
  const value = item.metadata[STATUS_METADATA_KEY];
  if (!isObject(value) || typeof value.heroId !== "string" || typeof value.tokenId !== "string") return null;
  const role = ["frame", "lp", "condition", "initiative"].includes(String(value.role))
    ? value.role as StatusDisplayLink["role"]
    : undefined;
  return { version: role ? 2 : 1, heroId: value.heroId, tokenId: value.tokenId, ...(role ? { role } : {}) };
};

const getStatusTextColor = (summary: TokenSheetSummary): string => ({
  healthy: "#9fe0b5",
  lightlyInjured: "#ffd27a",
  severelyWounded: "#ff9187",
  unconscious: "#d8c9e1",
})[getHealthPresentation(summary.lp).status];

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
      throw new Error("Wähle auf der Karte genau einen Charaktertoken aus.");
    }
    const [selected] = await OBR.scene.items.getItems(selection);
    if (!selected) throw new Error("Das ausgewählte Element wurde nicht gefunden.");
    if (selected.layer === "CHARACTER") return selected;
    const link = readStatusDisplayLink(selected);
    if (link) {
      const [token] = await OBR.scene.items.getItems([link.tokenId]);
      if (token?.layer === "CHARACTER") return token;
    }
    throw new Error("Das ausgewählte Element ist kein Charaktertoken.");
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
      statusWarning = "Der Bogen wurde verbunden, aber Owlbear hat keine Berechtigung zum Anlegen der Tokenanzeige.";
    }
    await OBR.notification.show(
      statusWarning
        ? `${state.hero.name} wurde verbunden. Die Tokenanzeige kann der GM im Gruppenmonitor anlegen.`
        : `${state.hero.name} wurde mit Token und rechteckiger Anzeige verknüpft.`,
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
      if (link?.role === "frame" || (link && !statusByToken.has(link.tokenId))) {
        statusByToken.set(link.tokenId, item.id);
      }
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
      throw new Error("Tokenanzeigen für die Gruppe können nur vom GM angelegt werden.");
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
    const statusText = getStatusTokenText(summary);
    const attachments = await OBR.scene.items.getItemAttachments([token.id]);
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const layout = createStatusTokenLayout(bounds);
    const sceneDpi = await OBR.scene.grid.getDpi();
    const statusItems = attachments.filter((item) => readStatusDisplayLink(item)?.tokenId === token.id);
    const sameHeroItems = statusItems.filter((item) => readStatusDisplayLink(item)?.heroId === summary.heroId);
    const toAdd: Item[] = [];
    const keepIds = new Set<string>();
    const makeLink = (role: NonNullable<StatusDisplayLink["role"]>): StatusDisplayLink => ({
      version: 2,
      heroId: summary.heroId,
      tokenId: token.id,
      role,
    });
    const description = `Verknüpfte Tokenanzeige für ${summary.name}: ${summary.lp.current} von ${summary.lp.max} LeP, ${health.label}, Initiative ${statusText.initiative}.`;
    const frameImage = {
      width: STATUS_TOKEN_FRAME.width,
      height: STATUS_TOKEN_FRAME.height,
      mime: "image/png",
      url: new URL("./status-token-frame.png?v=082", document.baseURI).toString(),
    };
    const frameGrid = { dpi: sceneDpi, offset: { x: 0, y: 0 } };
    const existingFrame = sameHeroItems.find((item) => {
      const link = readStatusDisplayLink(item);
      return item.type === "IMAGE" && link?.role === "frame";
    }) ?? sameHeroItems.find((item) => item.id === preferredId && item.type === "IMAGE");
    let frameId: string;

    if (existingFrame?.type === "IMAGE") {
      frameId = existingFrame.id;
      keepIds.add(existingFrame.id);
      await OBR.scene.items.updateItems<Image>([existingFrame as Image], (items) => {
        for (const item of items) {
          item.name = `Tokenanzeige · ${summary.name}`;
          item.description = description;
          item.image = frameImage;
          item.grid = frameGrid;
          item.position = layout.framePosition;
          item.scale = { x: layout.scale, y: layout.scale };
          item.layer = "ATTACHMENT";
          item.attachedTo = token.id;
          item.locked = true;
          item.disableHit = true;
          item.disableAutoZIndex = true;
          item.metadata[STATUS_METADATA_KEY] = makeLink("frame");
        }
      });
    } else {
      const frame = buildImage(frameImage, frameGrid)
        .name(`Tokenanzeige · ${summary.name}`)
        .description(description)
        .position(layout.framePosition)
        .scale({ x: layout.scale, y: layout.scale })
        .layer("ATTACHMENT")
        .attachedTo(token.id)
        .locked(true)
        .disableHit(true)
        .disableAutoZIndex(true)
        .metadata({ [STATUS_METADATA_KEY]: makeLink("frame") })
        .build();
      frameId = frame.id;
      keepIds.add(frame.id);
      toAdd.push(frame);
    }

    const upsertText = async (
      role: "lp" | "condition" | "initiative",
      value: string,
      field: typeof layout.lp,
      fillColor: string,
    ): Promise<void> => {
      const existing = sameHeroItems.find((item) => item.type === "TEXT" && readStatusDisplayLink(item)?.role === role);
      if (existing?.type === "TEXT") {
        keepIds.add(existing.id);
        await OBR.scene.items.updateItems<Text>([existing as Text], (items) => {
          for (const item of items) {
            item.name = `Tokenanzeige ${role} · ${summary.name}`;
            item.description = description;
            item.position = field.position;
            item.layer = "ATTACHMENT";
            item.attachedTo = token.id;
            item.locked = true;
            item.disableHit = true;
            item.disableAutoZIndex = true;
            item.metadata[STATUS_METADATA_KEY] = makeLink(role);
            item.text.plainText = value;
            item.text.type = "PLAIN";
            item.text.width = field.width;
            item.text.height = field.height;
            item.text.style.padding = 0;
            item.text.style.fontFamily = "Georgia";
            item.text.style.fontSize = field.fontSize;
            item.text.style.fontWeight = 800;
            item.text.style.textAlign = "CENTER";
            item.text.style.textAlignVertical = "MIDDLE";
            item.text.style.fillColor = fillColor;
            item.text.style.fillOpacity = 1;
            item.text.style.strokeColor = "#160f0a";
            item.text.style.strokeOpacity = 0.95;
            item.text.style.strokeWidth = Math.max(1, layout.scale * 5);
            item.text.style.lineHeight = 1;
          }
        });
        return;
      }

      const text = buildText()
        .name(`Tokenanzeige ${role} · ${summary.name}`)
        .description(description)
        .plainText(value)
        .textType("PLAIN")
        .width(field.width)
        .height(field.height)
        .padding(0)
        .fontFamily("Georgia")
        .fontSize(field.fontSize)
        .fontWeight(800)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor(fillColor)
        .strokeColor("#160f0a")
        .strokeOpacity(0.95)
        .strokeWidth(Math.max(1, layout.scale * 5))
        .lineHeight(1)
        .position(field.position)
        .layer("ATTACHMENT")
        .attachedTo(token.id)
        .locked(true)
        .disableHit(true)
        .disableAutoZIndex(true)
        .metadata({ [STATUS_METADATA_KEY]: makeLink(role) })
        .build();
      keepIds.add(text.id);
      toAdd.push(text);
    };

    await upsertText("lp", statusText.lp, layout.lp, "#fff1c4");
    await upsertText("condition", statusText.condition, layout.condition, getStatusTextColor(summary));
    await upsertText("initiative", statusText.initiative, layout.initiative, "#ffe1a0");
    if (toAdd.length) await OBR.scene.items.addItems(toAdd);

    const obsoleteIds = statusItems.filter((item) => !keepIds.has(item.id)).map((item) => item.id);
    if (obsoleteIds.length) await OBR.scene.items.deleteItems(obsoleteIds);
    return frameId;
  }
}
