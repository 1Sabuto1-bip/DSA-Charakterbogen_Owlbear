import type { CharacterSheetState } from "./types";
import { importHeroJson } from "./importer";

const STORAGE_KEY = "de.alexander-hoffmann.dsa5-sheet/state/v1";

export const loadState = (): CharacterSheetState | null => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    return importHeroJson(value);
  } catch {
    return null;
  }
};

export const saveState = (state: CharacterSheetState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearState = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
