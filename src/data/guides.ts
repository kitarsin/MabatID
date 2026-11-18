/**
 * Scenario guides (Guide tab): an ordered set of IDs/documents for a real-life goal, each with a plain
 * reason. Order matters — earlier items are used as requirements for later ones.
 */
export interface GuideStep {
  cardId: string;
  /** One short sentence: why this, and why now. */
  why: string;
  /** Not everyone needs it (e.g. only some employers ask). */
  optional?: boolean;
}

export interface Guide {
  id: string;
  title: string;
  /** Shown on the scenario card. */
  tagline: string;
  icon: "sprout" | "briefcase" | "plane" | "graduation";
  /** One or two sentences at the top of the guide. */
  lede: string;
  steps: GuideStep[];
  /** Short "good to know" notes, shown in a dropdown. */
  tips: string[];
}

export const GUIDES: Guide[] = [
  {
    id: "zero",
    title: "Starting from zero",
    tagline: "No ID or documents yet? Start here.",
    icon: "sprout",
    lede: "Every ID starts with your birth certificate and proof of where you live. Get these in order — each one helps you get the next.",
    steps: [
      {
        cardId: "psa",
        why: "Comes first: it proves who you are, and you don’t need an ID for it — a parent, spouse, child or guardian can request it for you with their own ID.",
      },
      {
        cardId: "barangay",
        why: "Proves where you live. Ask for a Certificate of Residency at your Barangay Hall.",
      },
      {
        cardId: "barangay-id",
        why: "An easy first photo ID from your barangay — useful while you wait for bigger IDs.",
      },
      {
        cardId: "philsys",
        why: "Free and accepted almost everywhere. Your birth certificate is the main requirement.",
      },
      {
        cardId: "postal",
        why: "A second photo ID many offices accept. Uses your birth certificate and proof of address.",
      },
    ],
    tips: [
      "Why not the Barangay ID first? It asks for proof of identity — usually your birth certificate — so PSA has to come before it.",
      "No birth record at PSA? Go to the Local Civil Registry Office (LCRO) at your City or Municipal Hall and ask about late registration.",
      "Under 18? A parent or guardian usually has to come with you. A School ID is often the easiest first photo ID.",
      "Bring photocopies of everything, plus your originals. Many offices ask for both.",
    ],
  },
  {
    id: "job",
    title: "Getting ready for a job",
    tagline: "The usual pre-employment requirements.",
    icon: "briefcase",
    lede: "Most employers ask for clearances, government numbers and 2 valid IDs. First-time jobseekers can get several of these for free.",
    steps: [
      {
        cardId: "psa",
        why: "Employers and every agency below ask for it.",
      },
      {
        cardId: "barangay",
        why: "Ask for the First-Time Jobseeker certificate too — it makes the clearances below free.",
      },
      {
        cardId: "nbi",
        why: "The clearance most employers ask for. Free once for first-time jobseekers.",
      },
      {
        cardId: "npc",
        why: "Some employers ask for this instead of, or on top of, NBI.",
        optional: true,
      },
      {
        cardId: "tin",
        why: "Your employer needs your TIN for payroll and taxes.",
      },
      {
        cardId: "mysss",
        why: "Your SSS number is needed for payroll; the MySSS card can come later.",
      },
      {
        cardId: "philhealth",
        why: "Your PhilHealth number is needed for payroll contributions.",
      },
      {
        cardId: "pagibig",
        why: "Employers need your Pag-IBIG number (MID). The card itself is optional.",
        optional: true,
      },
      {
        cardId: "philsys",
        why: "Most HR offices ask for 2 valid IDs — the National ID is a free one.",
      },
    ],
    tips: [
      "First-Time Jobseekers Act (RA 11261): get your barangay’s First-Time Jobseeker certificate first. It lets you get clearances like NBI and police clearance free, once, within one year.",
      "Already hired? Many employers register your TIN, SSS, PhilHealth and Pag-IBIG for you — ask HR before going yourself.",
      "Keep digital copies (photos or PDFs) of everything. Many companies accept them for the first submission.",
    ],
  },
  {
    id: "abroad",
    title: "Travelling or working abroad",
    tagline: "Passport first, then work papers.",
    icon: "plane",
    lede: "You’ll need a passport for any trip. Working abroad adds a clearance and OFW membership.",
    steps: [
      {
        cardId: "psa",
        why: "DFA checks your passport details against it. Spelling must match exactly.",
      },
      {
        cardId: "philsys",
        why: "A valid ID to bring to your DFA appointment.",
      },
      {
        cardId: "passport",
        why: "Needed for any travel abroad. Book only on the official DFA site.",
      },
      {
        cardId: "nbi",
        why: "Most work visas and agencies ask for it. Choose “travel abroad” or “work abroad” as the purpose.",
        optional: true,
      },
      {
        cardId: "owwa",
        why: "For OFWs: your proof of OWWA membership and access to its benefits.",
        optional: true,
      },
    ],
    tips: [
      "Book your DFA appointment early — slots can be full for weeks.",
      "Never pay fixers or anyone outside the official DFA site.",
      "Your name and birth date must match your PSA birth certificate on every document.",
    ],
  },
  {
    id: "student",
    title: "For students",
    tagline: "IDs you can get while still in school.",
    icon: "graduation",
    lede: "Your School ID is a good start. Add a government ID so you’re ready for exams, scholarships and your first job.",
    steps: [
      {
        cardId: "school",
        why: "Your first photo ID — you get it when you enroll.",
      },
      {
        cardId: "psa",
        why: "Needed for scholarships, exams and most other IDs.",
      },
      {
        cardId: "philsys",
        why: "Free, and accepted almost everywhere. A parent comes with you if you’re under 18.",
      },
      {
        cardId: "postal",
        why: "A government photo ID that works for banks and remittances.",
        optional: true,
      },
    ],
    tips: [
      "Under 18? Bring a parent or guardian and their valid ID to most offices.",
      "Graduating soon? Look at “Getting ready for a job” next.",
    ],
  },
];

export const GUIDE_BY_ID: Record<string, Guide> = Object.fromEntries(
  GUIDES.map((g) => [g.id, g]),
);
