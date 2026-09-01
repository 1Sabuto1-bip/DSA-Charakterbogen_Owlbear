import type { EquipmentBodySlot, EquipmentBodySlots, OptolithItem } from "./types";

export interface EquipmentBodySlotDefinition {
  id: EquipmentBodySlot;
  label: string;
  shortLabel: string;
  factor: number;
  protectionLabel: string;
}

export const EQUIPMENT_BODY_SLOT_DEFINITIONS: readonly EquipmentBodySlotDefinition[] = [
  { id: "head", label: "Kopf", shortLabel: "Kopf", factor: 1, protectionLabel: "RS" },
  { id: "torso", label: "Torso", shortLabel: "Torso", factor: 5, protectionLabel: "RS" },
  { id: "leftArm", label: "Linker Arm", shortLabel: "L. Arm", factor: 2, protectionLabel: "RS" },
  { id: "rightArm", label: "Rechter Arm", shortLabel: "R. Arm", factor: 2, protectionLabel: "RS" },
  { id: "legs", label: "Beine", shortLabel: "Beine", factor: 4, protectionLabel: "RS je Bein" },
  { id: "footwear", label: "Schuhwerk", shortLabel: "Schuhe", factor: 0, protectionLabel: "ohne RS" },
] as const;

export interface EquipmentZoneEntry {
  slot: EquipmentBodySlotDefinition;
  itemId?: string;
  item?: OptolithItem;
  protection: number;
}

export interface EquipmentZoneSummary {
  entries: EquipmentZoneEntry[];
  protectionScore: number;
  encumbrance: number;
  movementPenalty: number;
  initiativePenalty: number;
  assignedItemIds: string[];
  backpackItemIds: string[];
}

const asProtection = (value: unknown): number => Math.max(0, Math.round(Number(value) || 0));

const itemKind = (item: OptolithItem): "armor" | "helmet" | "equipment" | "other" => {
  if (item.itemKind === "helmet") return "helmet";
  if (item.itemKind === "armor") return "armor";
  if (item.itemKind === "equipment") return "equipment";
  if (item.itemKind) return "other";
  if (item.gr === 4 || typeof item.pro === "number" || typeof item.zoneProtection === "number") return "armor";
  if (!item.itemKind) return "equipment";
  return "other";
};

/** Liefert ausschließlich die Körperzonen, für die der Gegenstand gedacht ist. */
export const allowedEquipmentSlots = (item: OptolithItem): EquipmentBodySlot[] => {
  if (item.armorZone === "Kopf") return ["head"];
  if (item.armorZone === "Torso") return ["torso"];
  if (item.armorZone === "Arme") return ["leftArm", "rightArm"];
  if (item.armorZone === "Beine") return ["legs"];

  const normalized = item.name.toLocaleLowerCase("de");
  const kind = itemKind(item);
  if (kind === "helmet" || /helm|haube|kapuze|hut|kappe|krone|stirnreif/.test(normalized)) return ["head"];
  if (/armschiene|armzeug|unterarmschutz|armschutz|panzerhandschuh|handschuh/.test(normalized)) return ["leftArm", "rightArm"];
  if (/beinschiene|beinzeug|beinschutz|beinling|hose|gamasche/.test(normalized)) return ["legs"];
  if (/stiefel|schuh|sandale|fußbekleidung|fussbekleidung|pantoffel/.test(normalized)) return ["footwear"];
  if (kind === "armor" || /wams|hemd|jacke|mantel|robe|gewand|tunika|rüstung|ruestung|harnisch|kürass|kuerass/.test(normalized)) return ["torso"];
  return [];
};

export const equipmentCanUseSlot = (item: OptolithItem, slot: EquipmentBodySlot): boolean =>
  allowedEquipmentSlots(item).includes(slot);

export const equipmentSlotIsAvailable = (
  itemId: string,
  item: OptolithItem,
  slot: EquipmentBodySlot,
  slots: EquipmentBodySlots | undefined,
): boolean => {
  if (!equipmentCanUseSlot(item, slot)) return false;
  if (slots?.[slot] === itemId) return true;
  const assignedElsewhere = EQUIPMENT_BODY_SLOT_DEFINITIONS
    .filter((definition) => definition.id !== slot && slots?.[definition.id] === itemId)
    .length;
  return assignedElsewhere < Math.max(1, Math.round(Number(item.amount) || 1));
};

export const equipmentProtectionForSlot = (item: OptolithItem | undefined, slot: EquipmentBodySlot): number => {
  if (!item || slot === "footwear") return 0;
  if (typeof item.zoneProtection === "number") return asProtection(item.zoneProtection);
  return asProtection(item.pro);
};

export const normalizeEquipmentSlots = (
  slots: EquipmentBodySlots | undefined,
  items: Record<string, OptolithItem>,
): EquipmentBodySlots => {
  const usage = new Map<string, number>();
  return Object.fromEntries(EQUIPMENT_BODY_SLOT_DEFINITIONS.flatMap(({ id }) => {
    const itemId = slots?.[id];
    const item = typeof itemId === "string" ? items[itemId] : undefined;
    if (!itemId || !item || !equipmentCanUseSlot(item, id)) return [];
    const used = usage.get(itemId) ?? 0;
    if (used >= Math.max(1, Math.round(Number(item.amount) || 1))) return [];
    usage.set(itemId, used + 1);
    return [[id, itemId]];
  })) as EquipmentBodySlots;
};

export const assignEquipmentToAvailableSlots = (
  rawSlots: EquipmentBodySlots | undefined,
  itemId: string,
  items: Record<string, OptolithItem>,
): EquipmentBodySlots => {
  const item = items[itemId];
  const slots = normalizeEquipmentSlots(rawSlots, items);
  if (!item) return slots;
  for (const slot of allowedEquipmentSlots(item)) {
    if (slots[slot] || !equipmentSlotIsAvailable(itemId, item, slot, slots)) continue;
    slots[slot] = itemId;
  }
  return normalizeEquipmentSlots(slots, items);
};

export const calculateEquipmentZones = (
  items: Record<string, OptolithItem>,
  rawSlots: EquipmentBodySlots | undefined,
): EquipmentZoneSummary => {
  const slots = normalizeEquipmentSlots(rawSlots, items);
  const entries = EQUIPMENT_BODY_SLOT_DEFINITIONS.map((slot) => {
    const itemId = slots[slot.id];
    const item = itemId ? items[itemId] : undefined;
    return { slot, itemId, item, protection: equipmentProtectionForSlot(item, slot.id) };
  });
  const protectionScore = entries.reduce((total, entry) => total + entry.protection * entry.slot.factor, 0);
  let encumbrance = 0;
  let additionalPenalty = 0;
  if (protectionScore >= 1 && protectionScore <= 14) additionalPenalty = 1;
  else if (protectionScore <= 28) encumbrance = protectionScore === 0 ? 0 : 1;
  else if (protectionScore <= 42) { encumbrance = 1; additionalPenalty = 1; }
  else if (protectionScore <= 56) encumbrance = 2;
  else if (protectionScore <= 70) { encumbrance = 2; additionalPenalty = 1; }
  else encumbrance = 3 + Math.floor((protectionScore - 71) / 14);
  const assignedItemIds = [...new Set(entries.flatMap((entry) => entry.itemId ? [entry.itemId] : []))];
  return {
    entries,
    protectionScore,
    encumbrance,
    movementPenalty: additionalPenalty,
    initiativePenalty: additionalPenalty,
    assignedItemIds,
    backpackItemIds: Object.keys(items).filter((id) => !assignedItemIds.includes(id)),
  };
};

export const suggestedEquipmentSlots = allowedEquipmentSlots;

export const equipmentSlotLabel = (slot: EquipmentBodySlot): string =>
  EQUIPMENT_BODY_SLOT_DEFINITIONS.find((entry) => entry.id === slot)?.label ?? slot;
