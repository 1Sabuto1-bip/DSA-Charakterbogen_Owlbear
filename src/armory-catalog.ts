import { ARMORY_ITEM_INFO } from "./armory-data";
import { DARKAID_ITEM_DATA } from "./darkaid-data";
import { HELMET_ITEM_DATA, HELMET_ITEM_INFO } from "./helmet-data";
import { EQUIPMENT_PACKAGE_ITEM_DATA, EQUIPMENT_PACKAGE_ITEM_INFO } from "./equipment-package-data";

export const ARMORY_ITEM_CATALOG = {
  ...DARKAID_ITEM_DATA,
  ...HELMET_ITEM_DATA,
  ...EQUIPMENT_PACKAGE_ITEM_DATA,
};

export const COMPLETE_ARMORY_ITEM_INFO = {
  ...ARMORY_ITEM_INFO,
  ...HELMET_ITEM_INFO,
  ...EQUIPMENT_PACKAGE_ITEM_INFO,
};
