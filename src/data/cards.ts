export type Tier = 0 | 1 | 2 | 3;

/** Item format, separate from significance, tier and acceptance by an agency. */
export type CardKind = "id" | "document";
export const CARD_KIND_META: Record<
  CardKind,
  { label: string; singular: string; blurb: string }
> = {
  id: {
    label: "IDs only",
    singular: "ID",
    blurb: "Identity cards and passports.",
  },
  document: {
    label: "Documents only",
    singular: "Document",
    blurb: "Certificates, clearances and supporting paperwork.",
  },
};

/** How significant the ID is — used by the tree filter. */
export type Category = "foundation" | "primary" | "supporting" | "special";

export const CATEGORY_META: Record<Category, { label: string; blurb: string }> =
  {
    foundation: {
      label: "Foundational",
      blurb: "Baseline documents you need first",
    },
    primary: {
      label: "Primary IDs",
      blurb: "Widely accepted government photo IDs",
    },
    supporting: {
      label: "Supporting",
      blurb: "Clearances and IDs that back up your identity",
    },
    special: {
      label: "Status-based",
      blurb: "For a specific situation (PWD, OFW, senior…)",
    },
  };

export interface IdCard {
  id: string;
  name: string; // full title from Summary Cards
  short: string; // node label
  tier: Tier;
  category: Category;
  kind: CardKind;
  icon: string; // key into icon map
  starter?: boolean;
  /** Illustrative overview parent. Requirements live in details.ts. */
  parent?: string;
  /** Youngest age the ID can realistically be attained (for age hints). */
  minAge: number;
}

export const TIER_META: Record<Tier, { label: string; blurb: string }> = {
  0: {
    label: "Tier 0 · Foundations",
    blurb: "Baseline documents anyone can start with.",
  },
  1: {
    label: "Tier 1 · Starter & Secondary Government IDs / Clearances",
    blurb: "Starter photo IDs, secondary documents and clearances.",
  },
  2: {
    label: "Tier 2 · Primary IDs",
    blurb: "Government-issued primary IDs accepted nearly everywhere.",
  },
  3: {
    label: "Tier 3 · Specialized",
    blurb: "Credentials for a profession, status or situation.",
  },
};

export const CARDS: IdCard[] = [
  // ---------------- TIER 0 ----------------
  {
    id: "psa",
    kind: "document",
    category: "foundation",
    name: "PSA Birth Certificate",
    short: "PSA Birth Certificate",
    tier: 0,
    icon: "baby",
    minAge: 0,
  },
  {
    id: "barangay",
    kind: "document",
    category: "foundation",
    name: "Barangay Clearance / Certificate of Residency",
    short: "Barangay Clearance",
    tier: 0,
    icon: "home",
    parent: "psa",
    minAge: 0,
  },
  {
    id: "cedula",
    kind: "document",
    category: "foundation",
    name: "Cedula (Community Tax Certificate)",
    short: "Cedula",
    tier: 0,
    icon: "receipt",
    parent: "school",
    minAge: 18,
  },

  // ---------------- TIER 1 ----------------
  {
    id: "barangay-id",
    kind: "id",
    category: "supporting",
    name: "Barangay ID",
    short: "Barangay ID",
    tier: 1,
    icon: "idcard",
    starter: true,
    parent: "barangay",
    minAge: 0, // No national minimum; local eligibility must be confirmed.
  },
  {
    id: "school",
    kind: "id",
    category: "supporting",
    name: "School ID",
    short: "School ID",
    tier: 1,
    icon: "school",
    minAge: 0,
  },
  {
    id: "philhealth",
    kind: "id",
    category: "supporting",
    name: "PhilHealth ID",
    short: "PhilHealth ID",
    tier: 1,
    icon: "heart",
    parent: "psa",
    minAge: 0,
  },
  {
    id: "tin",
    kind: "id",
    category: "supporting",
    name: "BIR TIN ID",
    short: "TIN ID",
    tier: 1,
    icon: "landmark",
    parent: "psa",
    minAge: 15,
  },
  {
    id: "nbi",
    kind: "document",
    category: "supporting",
    name: "NBI Clearance",
    short: "NBI Clearance",
    tier: 1,
    icon: "shield",
    parent: "school",
    minAge: 15,
  },
  {
    id: "npc",
    kind: "document",
    category: "supporting",
    name: "National Police Clearance (NPC)",
    short: "Police Clearance",
    tier: 1,
    icon: "badge",
    parent: "school",
    minAge: 15,
  },
  {
    id: "comelec",
    kind: "document",
    category: "supporting",
    name: "COMELEC Voter’s Certification",
    short: "Voter’s Certificate",
    tier: 1,
    icon: "vote",
    parent: "school",
    minAge: 18,
  },
  {
    id: "postal",
    kind: "id",
    category: "primary",
    name: "Philippine Postal ID",
    short: "Postal ID",
    tier: 1,
    icon: "mail",
    parent: "barangay",
    minAge: 0,
  },

  // ---------------- TIER 2 ----------------
  {
    id: "philsys",
    kind: "id",
    category: "primary",
    name: "PhilSys National ID",
    short: "National ID",
    tier: 2,
    icon: "idcard",
    parent: "psa",
    minAge: 0,
  },
  {
    id: "passport",
    kind: "id",
    category: "primary",
    name: "Philippine ePassport",
    short: "Passport",
    tier: 2,
    icon: "plane",
    parent: "postal",
    minAge: 0,
  },
  {
    id: "mysss",
    kind: "id",
    category: "primary",
    name: "MySSS Card",
    short: "MySSS Card",
    tier: 2,
    icon: "card",
    parent: "philsys",
    minAge: 18,
  },
  {
    id: "lto",
    kind: "id",
    category: "primary",
    name: "LTO Non-Professional Driver’s License",
    short: "Driver’s License",
    tier: 2,
    icon: "car",
    parent: "philsys",
    minAge: 17,
  },
  {
    id: "pagibig",
    kind: "id",
    category: "supporting",
    name: "Pag-IBIG Loyalty Card Plus",
    short: "Pag-IBIG Card",
    tier: 2,
    icon: "piggy",
    parent: "lto",
    minAge: 18,
  },

  // ---------------- TIER 3 ----------------
  {
    id: "prc",
    kind: "id",
    category: "primary",
    name: "PRC License ID (PIC)",
    short: "PRC License",
    tier: 3,
    icon: "award",
    parent: "lto",
    minAge: 18,
  },
  {
    id: "pwd",
    kind: "id",
    category: "special",
    name: "PWD ID",
    short: "PWD ID",
    tier: 3,
    icon: "accessibility",
    parent: "barangay",
    minAge: 0,
  },
  {
    id: "soloparent",
    kind: "id",
    category: "special",
    name: "Solo Parent ID (SPIC)",
    short: "Solo Parent ID",
    tier: 3,
    icon: "users",
    parent: "barangay",
    minAge: 0,
  },
  {
    id: "owwa",
    kind: "id",
    category: "special",
    name: "OWWA OFW e-Card",
    short: "OFW e-Card",
    tier: 3,
    icon: "globe",
    parent: "passport",
    minAge: 18,
  },
  {
    id: "senior",
    kind: "id",
    category: "special",
    name: "Senior Citizen ID (OSCA ID)",
    short: "Senior Citizen ID",
    tier: 3,
    icon: "sunset",
    parent: "barangay",
    minAge: 60,
  },
];

export const CARD_BY_ID: Record<string, IdCard> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);
