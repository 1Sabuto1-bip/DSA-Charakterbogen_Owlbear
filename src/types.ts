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
}

export interface CharacterSheetState {
  schemaVersion: 1;
  source: "optolith" | "manual";
  importedAt: string;
  hero: OptolithHero;
  runtime: RuntimeState;
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
}

export interface SpellDefinition {
  id: string;
  name: string;
  check: [AttributeCode, AttributeCode, AttributeCode];
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
