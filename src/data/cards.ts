export type CredentialGroup =
  | "foundation"
  | "supporting"
  | "identity"
  | "specialized";
export const CREDENTIAL_GROUPS: readonly CredentialGroup[] = [
  "foundation",
  "supporting",
  "identity",
  "specialized",
];

export const GROUP_GUIDANCE =
  "Credential groups describe purpose, not difficulty or a required sequence. Choose any goal on the skill tree; your documents and answers determine the suggested path. Only pursue credentials relevant to you.";

/** Item format, separate from significance, group and acceptance by an agency. */
export type CardKind = "id" | "document";
export const CARD_KIND_META: Record<
  CardKind,
  { label: string; singular: string; blurb: string }
> = {
  id: {
    label: "IDs only",
    singular: "ID",
    blurb: "Identity, membership and service cards, plus passports.",
  },
  document: {
    label: "Documents only",
    singular: "Document",
    blurb: "Certificates, clearances and supporting paperwork.",
  },
};

/** Browsing badges, independent of group and transaction-specific acceptance. */
export type Category = "foundation" | "primary" | "supporting" | "special";

export const CATEGORY_META: Record<Category, { label: string; blurb: string }> =
  {
    foundation: {
      label: "Foundational",
      blurb:
        "Records that support birth, residence and other application details",
    },
    primary: {
      label: "Widely accepted",
      blurb:
        "Commonly used for identity verification; check the receiving office's rules",
    },
    supporting: {
      label: "Supporting",
      blurb: "Clearances and IDs that back up your identity",
    },
    special: {
      label: "Service & status",
      blurb:
        "Credentials for membership services, benefits or a specific status",
    },
  };

export interface IdCard {
  id: string;
  name: string; // full title from Summary Cards
  short: string; // node label
  group: CredentialGroup;
  /** Why this item's role belongs in its group; never an eligibility or dependency rule. */
  groupReason: string;
  category: Category;
  kind: CardKind;
  icon: string; // key into icon map
  starter?: boolean;
  /** Illustrative overview parent. Requirements live in details.ts. */
  parent?: string;
  /** Youngest age the ID can realistically be attained (for age hints). */
  minAge: number;
}

export const GROUP_META: Record<
  CredentialGroup,
  { label: string; blurb: string; significance: string }
> = {
  foundation: {
    label: "Foundational documents",
    blurb: "Civil, academic, residency and other baseline supporting records.",
    significance:
      "Use these records to establish details such as birth, residence or eligibility for a fee waiver. They are supporting paperwork rather than standalone photo IDs, and not every applicant needs every record.",
  },
  supporting: {
    label: "Starter & supporting credentials",
    blurb:
      "Starter IDs, routine supporting IDs from schools, employers, tax and health services, and clearances.",
    significance:
      "Use these credentials as an early identity option or to support another application. Issuer, enrollment, membership and document conditions still apply; a clearance may itself require an existing ID.",
  },
  identity: {
    label: "Widely accepted identity credentials",
    blurb:
      "IDs commonly used for identity verification across different institutions.",
    significance:
      "Useful for repeated identity checks across government and private services. Acceptance depends on the transaction, format and validity. A widely accepted ID can be your first ID when its application route allows it.",
  },
  specialized: {
    label: "Specialized & service credentials",
    blurb:
      "Professional credentials, IDs for specific benefits, and membership cards linked to banking services.",
    significance:
      "Choose these branches when you need their professional, membership or benefit services and meet the eligibility rules. The specialized group is not a final level everyone must complete; some of these IDs are also widely accepted.",
  },
};

export const CARDS: IdCard[] = [
  // Credential groups are browsing metadata; they do not determine tree positions.
  {
    id: "psa",
    kind: "document",
    category: "foundation",
    name: "PSA Birth Certificate",
    short: "PSA Birth Certificate",
    group: "foundation",
    groupReason:
      "A civil record establishing birth details and supporting other applications; it is not a photo ID.",
    icon: "baby",
    minAge: 0,
  },
  {
    id: "barangay",
    kind: "document",
    category: "foundation",
    name: "Barangay Clearance / Certificate of Residency",
    short: "Barangay Clearance",
    group: "foundation",
    groupReason:
      "Local clearance or residency paperwork supports applications and address checks. Confirm which specific document the receiving office requires.",
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
    group: "foundation",
    groupReason:
      "A community-tax certificate used when an applicable transaction requires it; it is not a general photo ID or a requirement for every applicant.",
    icon: "receipt",
    parent: "school",
    minAge: 18,
  },

  // Credential groups are browsing metadata; they do not determine tree positions.
  {
    id: "barangay-id",
    kind: "id",
    category: "supporting",
    name: "Barangay ID",
    short: "Barangay ID",
    group: "supporting",
    groupReason:
      "A local starter photo ID that can support other applications when its validity and required card details are confirmed. Local issuance rules apply.",
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
    group: "supporting",
    groupReason:
      "An enrollment-based identity credential, distinct from an academic record such as Form 137. Public and private school IDs belong in the supporting group.",
    icon: "school",
    minAge: 0,
  },
  {
    id: "philhealth",
    kind: "id",
    category: "supporting",
    name: "PhilHealth ID",
    short: "PhilHealth ID",
    group: "supporting",
    groupReason:
      "A health-insurance membership ID that can support selected applications. Its use outside PhilHealth depends on the receiving office.",
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
    group: "supporting",
    groupReason:
      "A tax-registration identity credential used as supporting identification. Physical and authenticated digital formats have transaction-specific acceptance rules.",
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
    group: "supporting",
    groupReason:
      "A background-check clearance that may also be accepted as identity evidence. Its main role is clearance, and applying may require existing identification.",
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
    group: "supporting",
    groupReason:
      "A police-record clearance used for employment and other applications. It is supporting paperwork and may require existing identification to obtain.",
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
    group: "supporting",
    groupReason:
      "An official voter certification used as supporting evidence. Required issuing office and format depend on the receiving agency; it is distinct from a voter registration record.",
    icon: "vote",
    parent: "school",
    minAge: 18,
  },

  // Credential groups are browsing metadata; they do not determine tree positions.
  {
    id: "postal",
    kind: "id",
    category: "primary",
    name: "Philippine Postal ID",
    short: "Postal ID",
    group: "identity",
    groupReason:
      "A broadly usable identity and address credential. Its accessible application route can make it a first-ID option, even though its role belongs in the identity group.",
    icon: "mail",
    starter: true,
    parent: "barangay",
    minAge: 0,
  },
  {
    id: "philsys",
    kind: "id",
    category: "primary",
    name: "PhilSys National ID",
    short: "National ID",
    group: "identity",
    groupReason:
      "A general identity credential for government and private transactions, subject to authentication. The accepted physical, paper and digital formats serve the same identity role.",
    icon: "idcard",
    parent: "psa",
    minAge: 0,
  },
  {
    id: "passport",
    kind: "id",
    category: "primary",
    name: "Philippine Passport",
    short: "Passport",
    group: "identity",
    groupReason:
      "A travel and identity credential commonly used across institutions. Its own birth-record and accepted-identification requirements still apply.",
    icon: "plane",
    parent: "postal",
    minAge: 0,
  },
  {
    id: "lto",
    kind: "id",
    category: "primary",
    name: "LTO Non-Professional Driver’s License",
    short: "Driver’s License",
    group: "identity",
    groupReason:
      "A commonly accepted identity credential that also grants driving privileges. Driving qualifications apply, and it is an optional goal for people who need to drive.",
    icon: "car",
    parent: "philsys",
    minAge: 17,
  },

  // Credential groups are browsing metadata; they do not determine tree positions.
  {
    id: "mysss",
    kind: "id",
    category: "special",
    name: "MySSS Card",
    short: "MySSS Card",
    group: "specialized",
    groupReason:
      "An SSS functional ID and bank-linked service card. Its main role is SSS services and disbursements; other institutions set their own acceptance policies.",
    icon: "card",
    parent: "philsys",
    minAge: 18,
  },
  {
    id: "pagibig",
    kind: "id",
    category: "special",
    name: "Pag-IBIG Loyalty Card Plus",
    short: "Pag-IBIG Card",
    group: "specialized",
    groupReason:
      "A Pag-IBIG loyalty and disbursement service card. Pag-IBIG does not classify Loyalty Card Plus as a government ID, so it does not belong in the widely accepted identity group.",
    icon: "piggy",
    parent: "lto",
    minAge: 18,
  },
  {
    id: "prc",
    kind: "id",
    category: "primary",
    name: "PRC License ID (PIC)",
    short: "PRC License",
    group: "specialized",
    groupReason:
      "A credential for registered professionals, obtained through the applicable professional registration process. It can also be widely accepted as ID while remaining a professional branch.",
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
    group: "specialized",
    groupReason:
      "A beneficiary credential for applicants who meet disability eligibility rules. Its purpose is access to applicable rights, services and benefits.",
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
    group: "specialized",
    groupReason:
      "A beneficiary credential based on assessed solo-parent eligibility. It is a relevant branch for qualifying applicants, rather than a universal ID milestone.",
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
    group: "specialized",
    groupReason:
      "An OFW membership and service credential requiring the applicable OWWA eligibility and documents. It also functions as government-issued identification.",
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
    group: "specialized",
    groupReason:
      "An age- and eligibility-based credential for senior citizen services and privileges. It is a specialized branch rather than a final acquisition level.",
    icon: "sunset",
    parent: "barangay",
    minAge: 60,
  },
];

export const CARD_BY_ID: Record<string, IdCard> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);
