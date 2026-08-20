export type AttributeId =
  | "ATTR_1"
  | "ATTR_2"
  | "ATTR_3"
  | "ATTR_4"
  | "ATTR_5"
  | "ATTR_6"
  | "ATTR_7"
  | "ATTR_8";

export type AttributeCode = "MU" | "KL" | "IN" | "CH" | "FF" | "GE" | "KO" | "KK";

export type ImprovementCost = "A" | "B" | "C" | "D" | "E";

export type CombatItemKind = "melee" | "ranged" | "shield" | "armor" | "equipment";

export type ManualSpecies = "human" | "elf" | "dwarf";

export interface ManualHeroSettings {
  species: ManualSpecies;
  magical: boolean;
}

export interface OptolithAttributeValue {
  id: string;
  value: number;
}

export interface OptolithItem {
  id: string;
  name: string;
  gr?: number;
  amount?: number;
  weight?: number;
  price?: number;
  at?: number;
  pa?: number;
  enc?: number;
  pro?: number;
  damageDiceNumber?: number;
  damageDiceSides?: number;
  damageFlat?: number;
  combatTechnique?: string;
  reach?: number;
  itemKind?: CombatItemKind;
  damageThreshold?: number;
  damageBonusAttribute?: AttributeCode;
  reloadTime?: number;
  rangeShort?: number;
  rangeMedium?: number;
  rangeLong?: number;
  ammunition?: string;
  length?: number;
  movementPenalty?: number;
  initiativePenalty?: number;
  notes?: string;
  equipped?: boolean;
  [key: string]: unknown;
}

export interface OptolithHero {
  clientVersion: string;
  dateCreated?: string;
  dateModified?: string;
  id: string;
  phase?: number;
  locale?: string;
  name: string;
  ap?: { total?: number };
  el?: string;
  r?: string;
  rv?: string;
  c?: string;
  p?: string;
  pv?: string;
  sex?: string;
  pers?: Record<string, unknown>;
  attr: {
    values: OptolithAttributeValue[];
    ae?: number;
    kp?: number;
    lp?: number;
    permanentAE?: { lost?: number; redeemed?: number };
    permanentKP?: { lost?: number; redeemed?: number };
    permanentLP?: { lost?: number };
    [key: string]: unknown;
  };
  activatable?: Record<string, unknown[]>;
  talents: Record<string, number>;
  ct?: Record<string, number>;
  spells?: Record<string, number>;
  cantrips?: string[];
  liturgies?: Record<string, number>;
  blessings?: string[];
  manual?: ManualHeroSettings;
  belongings?: {
    items?: Record<string, OptolithItem>;
    purse?: Partial<Record<"d" | "s" | "h" | "k", string>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ResourceValue {
  current: number;
  max: number;
}

export interface RuntimeState {
  resources: {
    lp: ResourceValue;
    ae: ResourceValue;
    kp: ResourceValue;
    fate: ResourceValue;
  };
  notes: string;
  favoriteTalentIds: string[];
  linkedTokenId?: string;
  linkedTokenName?: string;
  inventoryCategoriesMigrated: boolean;
  combat: CombatRuntimeState;
  advancement: AdvancementState;
}

export interface InitiativeRoll {
  die: number;
  base: number;
  armorModifier: number;
  manualModifier: number;
  total: number;
  rolledAt: string;
}

export interface CombatRuntimeState {
  primaryWeaponId?: string;
  initiativeModifier: number;
  lastInitiativeRoll?: InitiativeRoll;
}

export type AdvancementKind = "attribute" | "talent" | "combatTechnique" | "spell" | "resource";

export interface AdvancementHistoryEntry {
  id: string;
  timestamp: string;
  kind: AdvancementKind;
  targetId: string;
  label: string;
  from: number;
  to: number;
  cost: number;
}

export interface AdvancementState {
  availableAp: number;
  spentAp: number;
  ignoreLimits: boolean;
  history: AdvancementHistoryEntry[];
}

export interface CharacterSheetState {
  schemaVersion: 1;
  source: "optolith" | "darkaid" | "manual";
  importedAt: string;
  hero: OptolithHero;
  runtime: RuntimeState;
  originalData?: Record<string, unknown>;
}

export interface DarkAidValue {
  id: string;
  level?: number;
  bought?: number;
  losses?: unknown[];
  [key: string]: unknown;
}

export interface DarkAidEquipmentValue {
  amount?: number;
  equipped?: boolean;
  name?: string;
  type?: string;
  ruleelement?: {
    id?: string;
    type?: string;
  };
  [key: string]: unknown;
}

export interface DarkAidHero {
  version?: number | string;
  uuid?: string;
  name: string;
  race?: string;
  culture?: string;
  profession?: string;
  professionname?: string;
  sex?: string;
  iscreated?: boolean;
  purse?: string | number;
  xp?: { startinglevel?: string; [key: string]: unknown };
  rules?: Record<string, unknown>;
  attributes: DarkAidValue[];
  basevalues?: DarkAidValue[];
  skills?: DarkAidValue[];
  combattechniques?: DarkAidValue[];
  spells?: DarkAidValue[];
  chants?: DarkAidValue[];
  advantages?: DarkAidValue[];
  disadvantages?: DarkAidValue[];
  armor?: DarkAidEquipmentValue[];
  meleeweapons?: DarkAidEquipmentValue[];
  rangedweapons?: DarkAidEquipmentValue[];
  shields?: DarkAidEquipmentValue[];
  otherobjects?: DarkAidEquipmentValue[];
  [key: string]: unknown;
}

export interface DarkAidMagicDefinition {
  id: string;
  name: string;
  check?: [AttributeCode, AttributeCode, AttributeCode];
  kind: "Zauber" | "Ritual";
  improvementCost: string;
}

export interface AttributeDefinition {
  id: AttributeId;
  code: AttributeCode;
  name: string;
}

export type TalentCategory = "Körper" | "Gesellschaft" | "Natur" | "Wissen" | "Handwerk";

export interface TalentDefinition {
  id: string;
  name: string;
  check: [AttributeCode, AttributeCode, AttributeCode];
  category: TalentCategory;
  improvementCost: ImprovementCost;
}

export interface CombatTechniqueDefinition {
  id: string;
  name: string;
  improvementCost: "B" | "C" | "D";
  primaryAttributes: AttributeCode[];
  range: "melee" | "ranged";
}

export interface SpellDefinition {
  id: string;
  name: string;
  check?: [AttributeCode, AttributeCode, AttributeCode];
  kind: "Zauber" | "Ritual";
  improvementCost: string;
  checkModifier?: string;
}

export interface SpeciesDefinition {
  key: ManualSpecies;
  id: "R_1" | "R_2" | "R_4";
  name: "Mensch" | "Elf" | "Zwerg";
  lifeBase: number;
  automaticallyMagical: boolean;
}

export interface TalentRollResult {
  rolls: [number, number, number];
  targets: [number, number, number];
  differences: [number, number, number];
  initialSkillPoints: number;
  remainingSkillPoints: number;
  qualityLevel: number;
  outcome: "success" | "failure" | "critical" | "botch";
}

export interface TokenSheetSummary {
  heroId: string;
  name: string;
  lp: ResourceValue;
  ae?: ResourceValue;
  kp?: ResourceValue;
  fate: ResourceValue;
  initiative: number;
  updatedAt: string;
}
