import type { CharacterSheetState } from "./types";

const STORAGE_KEY = "de.alexander-hoffmann.dsa5-sheet/state/v1";

export const loadState = (): CharacterSheetState | null => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CharacterSheetState;
    return parsed.schemaVersion === 1 && (parsed.source === "optolith" || parsed.source === "manual") ? parsed : null;
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
