export type Tier = 0 | 1 | 2 | 3;

/** How significant the ID is — used by the tree filter. */
export type Category = 'foundation' | 'primary' | 'supporting' | 'special';

export const CATEGORY_META: Record<Category, { label: string; blurb: string }> = {
  foundation: { label: 'Foundational', blurb: 'Baseline documents you need first' },
  primary: { label: 'Primary IDs', blurb: 'Widely accepted government photo IDs' },
  supporting: { label: 'Supporting', blurb: 'Clearances and IDs that back up your identity' },
  special: { label: 'Status-based', blurb: 'For a specific situation (PWD, OFW, senior…)' },
};

export interface IdCard {
  id: string;
  name: string; // full title from Summary Cards
  short: string; // node label
  tier: Tier;
  category: Category;
  icon: string; // key into icon map
  /** Hard prerequisites: every id in `all` AND at least one in `any` (if given). */
  all?: string[];
  any?: string[];
  /** Not required to unlock, but accepted or sometimes asked for (shown dotted). */
  optional?: string[];
  /** The single "main path" parent drawn in the tree (must come from all/any). */
  parent?: string;
  /** Youngest age the ID can realistically be attained (for age hints). */
  minAge: number;
}

export const TIER_META: Record<Tier, { label: string; blurb: string }> = {
  0: { label: 'Tier 0 · Foundations', blurb: 'Baseline documents anyone can start with.' },
  1: { label: 'Tier 1 · First IDs', blurb: 'Easy-to-get IDs built on your baseline documents.' },
  2: { label: 'Tier 2 · Primary IDs', blurb: 'Government-issued primary IDs accepted nearly everywhere.' },
  3: { label: 'Tier 3 · Specialized', blurb: 'Credentials for a profession, status or situation.' },
};

export const CARDS: IdCard[] = [
  // ---------------- TIER 0 ----------------
  {
    id: 'psa',
    category: 'foundation',
    name: 'PSA Birth Certificate',
    short: 'PSA Birth Certificate',
    tier: 0,
    icon: 'baby',
    minAge: 0,
  },
  {
    id: 'barangay',
    category: 'foundation',
    name: 'Barangay Clearance / Certificate of Residency',
    short: 'Barangay Clearance',
    tier: 0,
    icon: 'home',
    any: ['psa', 'school'],
    optional: ['cedula'],
    parent: 'psa',
    minAge: 15,
  },
  {
    id: 'cedula',
    category: 'foundation',
    name: 'Cedula (Community Tax Certificate)',
    short: 'Cedula',
    tier: 0,
    icon: 'receipt',
    any: ['psa', 'school'],
    parent: 'school',
    minAge: 18,
  },
  {
    id: 'school',
    category: 'foundation',
    name: 'School ID',
    short: 'School ID',
    tier: 0,
    icon: 'school',
    optional: ['psa'],
    minAge: 0,
  },

  // ---------------- TIER 1 ----------------
  {
    id: 'philhealth',
    category: 'supporting',
    name: 'PhilHealth ID',
    short: 'PhilHealth ID',
    tier: 1,
    icon: 'heart',
    any: ['psa', 'postal', 'philsys', 'passport', 'lto', 'mysss', 'prc'],
    parent: 'psa',
    minAge: 0,
  },
  {
    id: 'tin',
    category: 'supporting',
    name: 'BIR TIN ID',
    short: 'TIN ID',
    tier: 1,
    icon: 'landmark',
    any: ['psa', 'postal', 'philsys', 'passport', 'lto', 'mysss', 'prc'],
    optional: ['barangay'],
    parent: 'psa',
    minAge: 15,
  },
  {
    id: 'nbi',
    category: 'supporting',
    name: 'NBI Clearance',
    short: 'NBI Clearance',
    tier: 1,
    icon: 'shield',
    any: ['psa', 'school', 'postal', 'philsys', 'passport', 'lto', 'prc', 'pwd', 'senior'],
    optional: ['barangay'],
    parent: 'school',
    minAge: 15,
  },
  {
    id: 'npc',
    category: 'supporting',
    name: 'National Police Clearance (NPC)',
    short: 'Police Clearance',
    tier: 1,
    icon: 'badge',
    any: ['psa', 'school', 'postal', 'philsys', 'passport', 'lto', 'prc', 'pwd', 'owwa', 'senior'],
    optional: ['barangay'],
    parent: 'school',
    minAge: 15,
  },
  {
    id: 'comelec',
    category: 'supporting',
    name: 'COMELEC Voter’s Certification',
    short: 'Voter’s Certificate',
    tier: 1,
    icon: 'vote',
    any: ['psa', 'school', 'postal', 'philsys', 'passport', 'lto', 'mysss', 'prc'],
    parent: 'school',
    minAge: 18,
  },
  {
    id: 'postal',
    category: 'primary',
    name: 'Philippine Postal ID',
    short: 'Postal ID',
    tier: 1,
    icon: 'mail',
    all: ['barangay'],
    any: ['psa', 'school'],
    parent: 'barangay',
    minAge: 0,
  },

  // ---------------- TIER 2 ----------------
  {
    id: 'philsys',
    category: 'primary',
    name: 'PhilSys National ID',
    short: 'National ID',
    tier: 2,
    icon: 'idcard',
    any: ['psa', 'passport', 'lto', 'mysss'],
    optional: ['school', 'barangay', 'philhealth', 'tin', 'nbi', 'npc', 'postal'],
    parent: 'psa',
    minAge: 0,
  },
  {
    id: 'passport',
    category: 'primary',
    name: 'Philippine ePassport',
    short: 'Passport',
    tier: 2,
    icon: 'plane',
    all: ['psa'],
    any: ['postal', 'comelec', 'philsys', 'lto', 'mysss', 'prc'],
    parent: 'postal',
    minAge: 0,
  },
  {
    id: 'mysss',
    category: 'primary',
    name: 'MySSS Card',
    short: 'MySSS Card',
    tier: 2,
    icon: 'card',
    all: ['philsys'],
    parent: 'philsys',
    minAge: 18,
  },
  {
    id: 'lto',
    category: 'primary',
    name: 'LTO Non-Professional Driver’s License',
    short: 'Driver’s License',
    tier: 2,
    icon: 'car',
    any: ['psa', 'philsys', 'passport', 'postal'],
    optional: ['tin'],
    parent: 'philsys',
    minAge: 17,
  },
  {
    id: 'pagibig',
    category: 'supporting',
    name: 'Pag-IBIG Loyalty Card Plus',
    short: 'Pag-IBIG Card',
    tier: 2,
    icon: 'piggy',
    any: ['postal', 'philsys', 'passport', 'lto', 'mysss', 'prc'],
    parent: 'lto',
    minAge: 18,
  },

  // ---------------- TIER 3 ----------------
  {
    id: 'prc',
    category: 'primary',
    name: 'PRC License ID (PIC)',
    short: 'PRC License',
    tier: 3,
    icon: 'award',
    any: ['school', 'postal', 'philsys', 'passport', 'lto', 'mysss'],
    optional: ['cedula'],
    parent: 'lto',
    minAge: 18,
  },
  {
    id: 'pwd',
    category: 'special',
    name: 'PWD ID',
    short: 'PWD ID',
    tier: 3,
    icon: 'accessibility',
    all: ['barangay'],
    any: ['psa', 'postal', 'philsys', 'passport', 'lto', 'mysss'],
    parent: 'barangay',
    minAge: 0,
  },
  {
    id: 'soloparent',
    category: 'special',
    name: 'Solo Parent ID (SPIC)',
    short: 'Solo Parent ID',
    tier: 3,
    icon: 'users',
    all: ['psa', 'barangay'],
    parent: 'barangay',
    minAge: 0,
  },
  {
    id: 'owwa',
    category: 'special',
    name: 'OWWA OFW e-Card',
    short: 'OFW e-Card',
    tier: 3,
    icon: 'globe',
    all: ['passport'],
    parent: 'passport',
    minAge: 18,
  },
  {
    id: 'senior',
    category: 'special',
    name: 'Senior Citizen ID (OSCA ID)',
    short: 'Senior Citizen ID',
    tier: 3,
    icon: 'sunset',
    all: ['barangay'],
    any: ['psa', 'passport', 'philsys', 'lto', 'mysss', 'comelec'],
    parent: 'barangay',
    minAge: 60,
  },
];

export const CARD_BY_ID: Record<string, IdCard> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
