import OBR from "@owlbear-rodeo/sdk";
import { calculateInitiative } from "./importer";
import type { CharacterSheetState, TokenSheetSummary } from "./types";

const EXTENSION_ID = "de.alexander-hoffmann.dsa5-sheet";
const METADATA_KEY = `${EXTENSION_ID}/summary`;

export class OwlbearBridge {
  available = false;

  async initialize(): Promise<boolean> {
    if (!OBR.isAvailable) return false;
    if (!OBR.isReady) {
      await new Promise<void>((resolve) => {
        OBR.onReady(resolve);
      });
    }
    this.available = true;
    return true;
  }

  async linkSelectedToken(state: CharacterSheetState): Promise<{ id: string; name: string }> {
    if (!this.available) throw new Error("Owlbear Rodeo ist in der Vorschau nicht verbunden.");
    const selection = await OBR.player.getSelection();
    if (!selection || selection.length !== 1) {
      throw new Error("Wähle auf der Karte genau einen Charaktertoken aus.");
    }
    const [item] = await OBR.scene.items.getItems(selection);
    if (!item || item.layer !== "CHARACTER") {
      throw new Error("Das ausgewählte Element ist kein Charaktertoken.");
    }

    const summary = this.createSummary(state);
    await OBR.scene.items.updateItems([item], (items) => {
      for (const token of items) token.metadata[METADATA_KEY] = summary;
    });
    await OBR.notification.show(`${state.hero.name} wurde mit dem Token verknüpft.`, "SUCCESS");
    return { id: item.id, name: item.name || state.hero.name };
  }

  async syncLinkedToken(state: CharacterSheetState): Promise<void> {
    const tokenId = state.runtime.linkedTokenId;
    if (!this.available || !tokenId) return;
    const items = await OBR.scene.items.getItems([tokenId]);
    if (items.length === 0) return;
    const summary = this.createSummary(state);
    await OBR.scene.items.updateItems(items, (draft) => {
      for (const token of draft) token.metadata[METADATA_KEY] = summary;
    });
  }

  private createSummary(state: CharacterSheetState): TokenSheetSummary {
    const { resources } = state.runtime;
    return {
      heroId: state.hero.id,
      name: state.hero.name,
      lp: resources.lp,
      ...(resources.ae.max > 0 ? { ae: resources.ae } : {}),
      ...(resources.kp.max > 0 ? { kp: resources.kp } : {}),
      fate: resources.fate,
      initiative: calculateInitiative(state.hero),
      updatedAt: new Date().toISOString(),
    };
  }
}
