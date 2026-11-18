import type { Condition } from "./facts";
import type { DocumentCheck } from "@/lib/documents";

/**
 * Short, scannable card content condensed from the research workbook
 * ("Summary Cards" + each group's step-by-step and reference columns).
 * `**bold**` marks what the reader must not miss.
 */

/**
 * One thing to prepare. `ids` = owning any of these IDs ticks it automatically
 * (`min` = how many distinct documents you need). `when` models conditional requirements;
 * `opt` is reserved for genuinely optional advice.
 */
export interface PrepItem {
  id: string;
  t: string;
  ids?: string[];
  min?: number;
  opt?: boolean;
  /** Possession alone cannot confirm copies, validity periods or combined evidence. */
  confirm?: boolean;
  subject?: "self" | "child" | "guardian";
  when?: Condition;
  /** Plain label for a case-by-case requirement, e.g. "If your barangay asks". */
  onlyIf?: string;
  route?: "onsite" | "online";
  completedBy?: string;
  documentChecks?: Record<string, DocumentCheck[]>;
}
/** Either a single item, or alternative routes — completing ANY one route satisfies it. */
export type PrepEntry =
  | PrepItem
  | {
      id: string;
      either: {
        id: string;
        label: string;
        when?: Condition;
        items: PrepItem[];
      }[];
    };

export interface Step {
  id: string;
  requiresPreparation?: boolean;
  t: string;
  link?: { label: string; url: string };
}

export interface CardDetail {
  /** Hybrid phases are consecutive, never alternative routes. */
  procedure: "hybrid" | "alternative";
  onlineRequiresVisit: boolean;
  channelNote?: string;
  processingTime?: string;
  validity?: string;
  acceptance?: { accepted: string[]; limits: string[] };
  localNotes?: string[];
  purpose: string;
  issuedBy: string;
  /** Standard fee estimate in pesos; conditional waivers are excluded. */
  fee: {
    min: number;
    max: number;
    byMode?: Partial<Record<"onsite" | "online", { min: number; max: number }>>;
    conditions?: { when: Condition; min: number; max: number }[];
  };
  onsite: boolean;
  online: boolean;
  /** Official sources: links where one exists, plain legal references otherwise. */
  refs: { label: string; url?: string }[];
  req: {
    age: string;
    fee: string;
    prepare: PrepEntry[];
    minors: string;
  };
  steps: { onsite: Step[]; online: Step[] };
}

export const DETAILS: Record<string, CardDetail> = {
  psa: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Ultimate proof of identity and citizenship — the base for your passport, license and National ID.",
    issuedBy: "Philippine Statistics Authority (PSA)",
    fee: {
      min: 155,
      max: 155,
      byMode: {
        onsite: { min: 155, max: 155 },
        online: { min: 365, max: 365 },
      },
    },
    onsite: true,
    online: true,
    refs: [
      {
        label: "PSA Civil Registry (CRS) appointments",
        url: "https://crs.psa.gov.ph",
      },
      {
        label: "PSAHelpline.ph — order online",
        url: "https://psahelpline.ph/psa-birth-certificate",
      },
      {
        label: "Philippine Statistics Authority",
        url: "https://psa.gov.ph",
      },
      {
        label: "Presidential Decree 603 — Child and Youth Welfare Code",
      },
      {
        label: "PSAHelpline — acceptable delivery IDs and conditions",
        url: "https://psahelpline.ph/faq/Delivery",
      },
    ],
    req: {
      age: "Issued from **birth**. Request on your own at **18+**.",
      fee: "**₱155** on-site · **₱365** online (with delivery)",
      prepare: [
        {
          id: "requester",
          either: [
            {
              id: "own-id",
              label: "I have my own valid ID",
              items: [
              {
                id: "photo-id",
                t: "**1 original valid photo ID**",
                ids: ["postal", "philsys", "passport", "lto", "prc"],
                route: "onsite",
              },
              {
                id: "online-photo-id",
                t: "**1 PSAHelpline-accepted original ID**. A Barangay ID must bear **both a photo and signature**.",
                route: "online",
                ids: [
                  "postal",
                  "philsys",
                  "passport",
                  "lto",
                  "prc",
                  "umid",
                  "barangay-id",
                ],
                documentChecks: {
                  "barangay-id": ["photoSignature"],
                },
              },
              ],
            },
            {
              id: "family",
              label: "A family member requests it for me",
              items: [
                {
                  id: "family-request",
                  t: "**A parent, spouse, child or legal guardian** requests it with **their own valid ID**. Anyone else needs your **authorization letter** and both IDs.",
                },
              ],
            },
          ],
        },
        {
          id: "appointment",
          t: "**Appointment confirmation** for your on-site visit",
          completedBy: "onsite:book-appointment",
          route: "onsite",
        },
        {
          id: "birth-details",
          t: "Know your **birth name, birth date/place** and **parents’ full names**",
        },
      ],
      minors: "Parent or guardian books it and shows their **valid ID**.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:book-appointment",
          t: "Book a free appointment online and pick the **PSA Civil Registry System (CRS) outlet** nearest you.",
          link: {
            label: "PSA CRS appointment",
            url: "https://crs.psa.gov.ph",
          },
        },
        {
          id: "onsite:attend",
          t: "Go to that outlet **30 minutes before** your time. Bring your appointment slip and **1 valid ID**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:complete-form",
          t: "Get the **Birth Certificate request form** at the information desk, fill it in, and take a queue number.",
        },
        {
          id: "onsite:submit-pay",
          t: "When your number is called, hand in the form and your ID at the window and pay **₱155 per copy**.",
        },
        {
          id: "onsite:collect",
          t: "Wait at the releasing area (usually **1–2 hours**). Check your name, birth date and parents’ names before you leave.",
        },
      ],
      online: [
        {
          id: "online:order",
          t: "Go to **PSA Helpline**, choose **Birth Certificate**, and type your details exactly as they appear on your record.",
          link: {
            label: "PSAHelpline.ph",
            url: "https://psahelpline.ph/psa-birth-certificate",
          },
        },
        {
          id: "online:delivery-details",
          t: "Enter the address where it should be delivered and a mobile number the courier can call.",
        },
        {
          id: "online:pay",
          t: "Pay **₱365 per copy** (delivery included) by GCash, Maya, card or over the counter.",
          requiresPreparation: true,
        },
        {
          id: "online:receive",
          t: "The courier arrives in about **3–8 working days**. You must receive it yourself and show a **valid ID**.",
        },
      ],
    },
  },

  barangay: {
    procedure: "alternative",
    onlineRequiresVisit: true,
    purpose:
      "Local proof of address and good standing; required for NBI, police clearance and Postal ID.",
    issuedBy: "Barangay Hall where you live",
    fee: { min: 20, max: 100 },
    onsite: true,
    online: true,
    refs: [
      { label: "eGovPH — online barangay services", url: "https://e.gov.ph" },
      {
        label: "DICT eGov digital platforms",
        url: "https://dict.gov.ph/egov-digital-platforms",
      },
      { label: "RA 7160 — Local Government Code" },
      { label: "RA 11261 — First Time Jobseekers Assistance Act" },
    ],
    req: {
      age: "**No fixed age** for residency. First-Time Jobseeker certificate: **15+**.",
      fee: "**₱20–₱100** · **₱0** for first-time jobseekers (RA 11261)",
      prepare: [
        {
          id: "identity",
          t: "**1 valid ID** (or School ID / PSA Birth Cert)",
          ids: ["psa", "school", "postal", "philsys", "passport", "lto", "prc"],
        },
        {
          id: "residency",
          t: "**Proof you live there** — utility bill, lease or landlord note. Some barangays just check their resident list.",
        },
        {
          id: "cedula",
          t: "**Cedula** (Community Tax Certificate)",
          onlyIf: "If your barangay asks",
          ids: ["cedula"],
          when: {
            fact: "needsCedula",
          },
        },
        {
          id: "jobseeker-oath",
          t: "**Signed Oath of Undertaking** — you must have lived there **6+ months**",
          onlyIf: "If you’re a first-time jobseeker",
          when: {
            fact: "waiverRequested",
          },
        },
      ],
      minors: "Bring a guardian’s **valid ID** and written consent.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:visit",
          t: "Go to the **Barangay Hall where you live now**, on a weekday during office hours.",
        },
        {
          id: "onsite:present-documents",
          t: "At the front desk, say you need a **Barangay Clearance** (or Certificate of Residency) and what it’s for — e.g. a job, NBI or Postal ID. Show **1 valid ID**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:complete-form",
          t: "Fill in the request form. **First-time jobseekers** also sign the **Oath of Undertaking** so it’s free.",
        },
        {
          id: "onsite:pay",
          t: "Pay the barangay treasurer (usually **₱20–₱100**, **free** for first-time jobseekers) and keep the receipt.",
        },
        {
          id: "onsite:collect",
          t: "Wait while it’s printed and signed — usually **the same day**. Check the spelling and the **dry seal**.",
        },
      ],
      online: [
        {
          id: "online:check-availability",
          t: "Ask your barangay or check its city’s official page if it takes **online requests**. If not, use **In person**.",
          link: {
            label: "eGovPH",
            url: "https://e.gov.ph",
          },
        },
        {
          id: "online:submit-request",
          t: "Fill in the online form and upload a photo of your **valid ID** and **proof that you live there**.",
          requiresPreparation: true,
        },
        {
          id: "online:pay",
          t: "Pay through the barangay’s online payment option, or at the Barangay Hall.",
        },
        {
          id: "online:collect",
          t: "Download the e-clearance if offered — or claim the printed copy at the Barangay Hall.",
        },
      ],
    },
  },

  cedula: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Local tax certificate often needed for clearances, affidavits and permits.",
    issuedBy: "City/Municipal Treasurer’s Office (or barangay desk)",
    fee: {
      min: 5,
      max: 5,
      conditions: [{ when: { fact: "employed" }, min: 5, max: 5005 }],
    },
    onsite: true,
    online: false,
    refs: [
      {
        label: "QC guide — how to get a Cedula",
        url: "https://quezoncity.gov.ph/qcitizen-guides/how-to-get-a-community-tax-certificate-cedula-for-individual/",
      },
      {
        label: "DICT eGov digital platforms",
        url: "https://dict.gov.ph/egov-digital-platforms",
      },
      { label: "RA 7160 Sec. 157 — Community tax (18+ only)" },
    ],
    req: {
      age: "**18+** only. Minors are exempt.",
      fee: "**₱5** basic + ₱1 per ₱1,000 of last year’s income (max ₱5,005)",
      prepare: [
        {
          id: "identity",
          t: "**1 valid ID** (students: School ID or PSA Birth Cert)",
          ids: ["psa", "school", "postal", "philsys", "passport", "lto", "prc"],
        },
        {
          id: "declaration",
          t: "Community Tax Declaration Form",
        },
        {
          id: "income",
          t: "**Proof of income** — payslip, BIR 2316 or ITR",
          onlyIf: "If you earn income",
          when: {
            fact: "employed",
          },
        },
      ],
      minors: "Not issued to under-18s.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:visit",
          t: "Go to the **Treasurer’s Office at your City or Municipal Hall** (some Barangay Halls also issue cedulas).",
        },
        {
          id: "onsite:complete-form",
          t: "Ask for the **Community Tax Certificate** form. Fill in your name, address, birth date, work and yearly income.",
        },
        {
          id: "onsite:submit",
          t: "Hand it in with **1 valid ID**. If you earn money, bring a payslip or ITR so they can compute the tax.",
          requiresPreparation: true,
        },
        {
          id: "onsite:pay",
          t: "Pay the tax: **₱5** basic, plus **₱1 for every ₱1,000** you earn in a year.",
        },
        {
          id: "onsite:receive",
          t: "Sign it and add your **thumbmark**. You get your cedula **right away**.",
        },
      ],
      online: [],
    },
  },

  school: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Student ID from your school — often your first photo ID before any government ID.",
    issuedBy: "Your school (DepEd) or university (CHED)",
    fee: {
      min: 0,
      max: 0,
      conditions: [{ when: { fact: "replacement" }, min: 100, max: 300 }],
    },
    onsite: true,
    online: false,
    refs: [
      { label: "DepEd", url: "https://www.deped.gov.ph" },
      {
        label: "DepEd Learner Information System",
        url: "https://lis.deped.gov.ph",
      },
      { label: "CHED", url: "https://ched.gov.ph" },
    ],
    req: {
      age: "**No minimum age** — issued when you enroll.",
      fee: "**Included in tuition** · reprint **₱100–₱300**",
      prepare: [
        {
          id: "enrollment",
          t: "**Certificate of Matriculation** (proof of enrollment)",
          completedBy: "onsite:enroll",
        },
        {
          id: "photo",
          t: "**Photo and signature** taken on campus",
          completedBy: "onsite:capture",
        },
        {
          id: "loss-affidavit",
          t: "**Notarized Affidavit of Loss**",
          onlyIf: "If replacing a lost ID",
          when: {
            fact: "replacement",
          },
        },
      ],
      minors: "Issued directly to you as an enrolled student.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:enroll",
          t: "Enroll for the term and keep your **Certificate of Registration** (proof you’re enrolled).",
        },
        {
          id: "onsite:visit",
          t: "Go to the office that makes IDs — usually the **Registrar** or **Student Affairs Office**.",
        },
        {
          id: "onsite:apply",
          t: "Fill in the **ID application form** they give you.",
        },
        {
          id: "onsite:capture",
          t: "Have your **photo and signature** taken at the ID station.",
        },
        {
          id: "onsite:collect",
          t: "Claim your ID on the release date. **Lost ID?** Bring an affidavit of loss and pay the replacement fee.",
          requiresPreparation: true,
        },
      ],
      online: [],
    },
  },

  "barangay-id": {
    procedure: "alternative",
    onlineRequiresVisit: true,
    channelNote:
      "Walk-in is the usual route. Use an online route only if your own barangay confirms an official portal. Physical pickup is normally required; ask whether local courier delivery is supported.",
    purpose:
      "Entry-level starter secondary government photo ID, distinct from a paper Barangay Clearance. Useful when you do not yet have a primary ID or current School ID. Supporting paperwork and local residency checks still apply.",
    issuedBy:
      "Local Barangay Unit — Office of the Punong Barangay / Barangay Hall",
    fee: {
      min: 20,
      max: 150,
      conditions: [
        {
          when: {
            fact: "barangayIdReplacement",
          },
          min: 50,
          max: 150,
        },
        {
          when: {
            fact: "barangayIdFeeWaived",
          },
          min: 0,
          max: 0,
        },
      ],
    },
    onsite: true,
    online: true,
    processingTime:
      "Often 15–60 minutes for on-site card printing; batch printing may take 1–5 working days. Confirm the actual release schedule locally.",
    validity:
      "Follow the printed expiry and the issuing barangay’s ordinance; local periods may be 1–3 years. If no expiry is printed, enter the issue date and confirm current validity. The app does not invent an expiry date.",
    acceptance: {
      accepted: [
        "PSAHelpline delivery: Barangay ID bearing both a picture and signature, subject to its current delivery requirements.",
        "PhilSys: alternative supporting document when it bears the required identity details and passes registration-center screening.",
        "Postal ID: Barangay Residency ID can serve as proof of address; proof of identity remains a separate requirement.",
        "Local LGU services; bank or e-wallet KYC only where the provider accepts it under its own policy.",
      ],
      limits: [
        "Not a standalone DFA passport ID. Use an ID on DFA’s current acceptable list.",
        "BSP Circular 950 concerns customer due diligence; it does not guarantee acceptance by every bank, e-wallet or loan product.",
      ],
    },
    localNotes: [
      "Local ordinances determine eligibility, residency period, card format, fees and validity. Ask for the physical Barangay ID, not a paper clearance.",
      "Residency is commonly checked using the Registry of Barangay Inhabitants (RBI) or purok/zone leader confirmation; ask whether a 3–6 month period applies.",
      "A shared utility bill may need a landlord/homeowner endorsement or lease. Confirm whose name and address must appear on each document.",
      "Some LGUs offer free resident cards or local indigent, senior or PWD concessions. Do not assume a nationwide physical-card exemption.",
      "RA 11261 covers employment-related documents including barangay clearance. Confirm waiver with local Barangay Hall for this physical ID card; do not assume PVC-card charges are waived.",
      "A required adult Cedula is an additional prerequisite cost (basic tax may start at ₱5 plus assessed income tax). Minors are outside the adult community-tax liability in RA 7160 Sec. 157. Do not assume every unemployed adult is automatically exempt.",
      "Replacement cards may require a local loss certification or affidavit; notarization and prerequisite costs are additional.",
    ],
    refs: [
      {
        label: "RA 7160 — Local Government Code, Sec. 157 and barangay powers",
        url: "https://www.lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html",
      },
      {
        label: "RA 11261 — First-Time Jobseekers Assistance Act",
        url: "https://www.lawphil.net/statutes/repacts/ra2019/ra_11261_2019.html",
      },
      {
        label: "PSAHelpline — acceptable delivery IDs",
        url: "https://psahelpline.ph/faq/Delivery",
      },
      {
        label: "PSA PhilSys Citizen’s Charter — supporting documents",
        url: "https://rsso05.psa.gov.ph/system/files/documents/2024%20CC%20-%20PhilSys_Updated%20with%20Brief%20Description%20%281%29.pdf",
      },
      {
        label: "Postal ID — proof of address requirements",
        url: "https://www.postalidph.com/requirements.html",
      },
      {
        label: "BSP Circular 950 — customer due diligence framework",
        url: "https://www.bsp.gov.ph/Regulations/Issuances/2017/c950.pdf",
      },
      {
        label:
          "Your barangay’s current Citizen’s Charter and revenue ordinance — confirm locally",
      },
    ],
    req: {
      age: "**No fixed national minimum** for this local card. Confirm your barangay’s rule. Adults generally apply alone at **18+**; some barangays accept **15–17** with guardian assistance.",
      fee: "**₱20–₱150** estimated card fee · replacement **₱50–₱150** · **₱0 only if locally confirmed**. Cedula, photos and any notarization cost extra.",
      prepare: [
        {
          id: "application-form-onsite",
          t: "**Barangay ID form** — name, birth date, civil status, address and emergency contact",
          route: "onsite",
          completedBy: "onsite:visit-fill-form",
        },
        {
          id: "application-form-online",
          t: "**Online Barangay ID form** on your city or barangay’s official site",
          route: "online",
          completedBy: "online:open-fill-form",
        },
        {
          id: "residency",
          t: "**1 proof you live there** — Barangay Certificate of Residency, utility bill, lease or voter record. Shared bill? Bring the owner’s endorsement.",
          ids: ["barangay", "utility-bill", "lease-contract", "voter-record"],
          confirm: true,
        },
        {
          id: "identity",
          t: "**1 proof of identity** — PSA or local birth certificate, School/Company ID, or a government ID",
          ids: [
            "psa",
            "lcro-birth",
            "school",
            "company-id",
            "philsys",
            "tin",
            "philhealth",
            "comelec",
            "passport",
            "lto",
            "umid",
            "prc",
          ],
        },
        {
          id: "cedula",
          t: "**Current-year Cedula**",
          onlyIf: "If your barangay asks (adults)",
          ids: ["cedula"],
          when: {
            all: [
              {
                not: {
                  underAge: 18,
                },
              },
              {
                fact: "barangayIdNeedsCedula",
              },
            ],
          },
        },
        {
          id: "printed-photos",
          t: "**1–2 recent colored ID photos** (1×1 or 2×2, white background)",
          onlyIf: "If they don’t take photos there",
          route: "onsite",
          when: {
            not: {
              fact: "barangayIdLiveCapture",
            },
          },
        },
        {
          id: "digital-photo",
          t: "**Digital photo and clear scans** of your documents",
          route: "online",
        },
        {
          id: "guardian-id",
          t: "**Your parent or guardian’s valid ID**, plus proof you’re related if asked",
          onlyIf: "If you’re under 18",
          subject: "guardian",
          when: {
            underAge: 18,
          },
        },
        {
          id: "guardian-consent",
          t: "**Written consent** from your parent or guardian, who usually comes with you",
          onlyIf: "If you’re under 18",
          when: {
            underAge: 18,
          },
        },
        {
          id: "loss-evidence",
          t: "**Proof of loss or damage** — barangay certification or affidavit of loss",
          onlyIf: "If replacing a lost or damaged card",
          when: {
            fact: "barangayIdReplacement",
          },
        },
        {
          id: "waiver-evidence",
          t: "**Fee-waiver confirmation** and any certificate the barangay asks for",
          onlyIf: "If your barangay waives the fee",
          when: {
            fact: "barangayIdFeeWaived",
          },
        },
      ],
      minors:
        "Where local rules allow it, bring the minor’s School ID or PSA/LCRO Birth Certificate, the parent/guardian’s valid ID and written consent. Do not require a Cedula from an applicant under 18.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:visit-fill-form",
          t: "Go to the **Barangay Hall where you live**. Ask for the **Barangay ID form** — they’ll check you’re listed as a resident.",
        },
        {
          id: "onsite:submit",
          t: "Hand in the form with **1 valid ID or your birth certificate** and **proof you live there**. Some barangays also ask for a **cedula** or a **1x1 photo**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:verify-capture-sign",
          t: "Have your **photo** taken and sign your **specimen signature**. Make sure the card will show **both** — other offices need them.",
        },
        {
          id: "onsite:pay-receipt",
          t: "Pay the barangay cashier (often **₱20–₱150**) and keep the **official receipt**.",
        },
        {
          id: "onsite:collect",
          t: "Claim the card on the date they give you. Check your **name, address, photo and expiry date**.",
        },
      ],
      online: [
        {
          id: "online:open-fill-form",
          t: "Ask your Barangay Hall if it has an **online form** and which website to use. Open it and fill in your details.",
        },
        {
          id: "online:upload-submit",
          t: "Upload your **valid ID**, **proof you live there** and a **digital photo**, then submit.",
          requiresPreparation: true,
        },
        {
          id: "online:pay-collect",
          t: "Pay online or at the barangay cashier, then **claim the card at the Barangay Hall**. Check your photo, signature and address.",
        },
      ],
    },
  },

  philhealth: {
    procedure: "alternative",
    onlineRequiresVisit: true,
    purpose:
      "Your PhilHealth member ID — proof of membership and a supporting ID.",
    issuedBy: "Philippine Health Insurance Corporation (PhilHealth)",
    fee: { min: 0, max: 0 },
    onsite: true,
    online: true,
    refs: [
      {
        label: "PhilHealth registration guide",
        url: "https://www.philhealth.gov.ph/members/informal/registration.php",
      },
      {
        label: "PhilHealth Member Portal",
        url: "https://memberinquiry.philhealth.gov.ph/member/",
      },
      {
        label: "PMRF form (PDF)",
        url: "https://www.philhealth.gov.ph/downloads/membership/pmrf_012020.pdf",
      },
      { label: "RA 11223 — Universal Health Care Act" },
    ],
    req: {
      age: "As dependent from **birth**. Own membership at **15+** (employed) or **21+**.",
      fee: "**₱0** for the PhilHealth ID",
      prepare: [
        {
          id: "identity",
          t: "**PSA Birth Certificate** or 1 valid ID",
          ids: ["psa", "postal", "philsys", "passport", "lto", "prc"],
        },
        {
          id: "pmrf",
          t: "**2 copies** of the PMRF form",
        },
        {
          id: "photos",
          t: "**Two 1x1 photos**",
        },
        {
          id: "maiden-name",
          t: "Know your **mother’s maiden name**",
        },
      ],
      minors: "Usually covered as a **dependent** of a member.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:visit",
          t: "Go to any **PhilHealth office (LHIO)** or **PhilHealth Express** outlet and take a queue number.",
        },
        {
          id: "onsite:complete-pmrf",
          t: "Fill in **2 copies** of the **PhilHealth Member Registration Form (PMRF)** — free at the office.",
        },
        {
          id: "onsite:submit",
          t: "Hand in the PMRF with your **PSA birth certificate or 1 valid ID** and a **1x1 photo**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:encoding",
          t: "Wait while they register you (**15–60 minutes**). You’ll get your **12-digit PhilHealth number (PIN)**.",
        },
        {
          id: "onsite:collect",
          t: "Claim your **PhilHealth ID card** at the same counter.",
        },
      ],
      online: [
        {
          id: "online:register",
          t: "Open the **PhilHealth Member Portal** and choose **Member Registration**.",
          link: {
            label: "PhilHealth Member Portal",
            url: "https://memberinquiry.philhealth.gov.ph/member/",
          },
        },
        {
          id: "online:submit-pmrf",
          t: "Fill in the form online and upload your **birth certificate or valid ID**.",
          requiresPreparation: true,
        },
        {
          id: "online:receive-pin",
          t: "Wait **1–5 working days**. Your **12-digit PIN** arrives by email.",
        },
        {
          id: "online:collect",
          t: "Go to **any PhilHealth office** with your PIN, **1 valid ID** and a **1x1 photo** to get the card.",
        },
      ],
    },
  },

  tin: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Your tax number card — needed for jobs and many bank and ID applications.",
    issuedBy: "Bureau of Internal Revenue (BIR)",
    fee: { min: 0, max: 0 },
    onsite: true,
    online: true,
    refs: [
      {
        label: "BIR Citizen’s Charter — TIN application",
        url: "https://www.bir.gov.ph/BIRCC-RDO-External-Service-02",
      },
      { label: "BIR ORUS portal", url: "https://orus.bir.gov.ph" },
      { label: "RA 8424 Sec. 275 — one TIN only" },
    ],
    req: {
      age: "Typically **18+**. **15–17** only if employed.",
      fee: "**₱0** · lost physical card replacement **₱100**",
      prepare: [
        {
          id: "identity-routes",
          either: [
            {
              id: "government-id",
              label: "Government ID route",
              items: [
                {
                  id: "government-id",
                  t: "**1 valid government ID**",
                  ids: ["postal", "philsys", "passport", "lto", "prc"],
                },
              ],
            },
            {
              id: "birth-and-address",
              label: "Birth certificate and address route",
              items: [
                {
                  id: "birth-certificate",
                  t: "**PSA Birth Certificate**",
                  ids: ["psa"],
                },
                {
                  id: "proof-of-address",
                  t: "**Proof of address**",
                  ids: ["barangay", "utility-bill"],
                },
              ],
            },
          ],
        },
        {
          id: "bir-form",
          t: "**BIR Form 1904** (jobseeker) or **1902** (employee)",
        },
        {
          id: "jobseeker-certificate",
          t: "**First-Time Jobseeker certificate** from your barangay",
          onlyIf: "If you’re a first-time jobseeker",
          ids: ["jobseeker:barangay"],
          when: {
            fact: "jobseekerApplication",
          },
        },
      ],
      minors: "Employed minors apply through their **employer** (Form 1902).",
    },
    steps: {
      onsite: [
        {
          id: "onsite:find-rdo",
          t: "Find the **BIR Revenue District Office (RDO)** for your home address — or your employer’s, if you’re employed.",
        },
        {
          id: "onsite:complete-form",
          t: "Fill in **2 copies** of **BIR Form 1904** (no job yet) or **1902** (employee — your employer often files this for you).",
        },
        {
          id: "onsite:submit",
          t: "Hand them in at the RDO’s **registration counter** with **1 valid ID**, proof of address and a **1x1 photo**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:verification",
          t: "Wait while they check and encode your details (**30 minutes – 2 hours**).",
        },
        {
          id: "onsite:receive-tin",
          t: "You get your **9-digit TIN** on the stamped form. You can then get the **Digital TIN ID** online.",
        },
      ],
      online: [
        {
          id: "online:register",
          t: "Open **BIR ORUS** and choose **New Registration → Individual**.",
          link: {
            label: "BIR ORUS",
            url: "https://orus.bir.gov.ph",
          },
        },
        {
          id: "online:complete-form",
          t: "Confirm your email, then fill in **Form 1904** or **1902** online.",
        },
        {
          id: "online:upload",
          t: "Upload a photo of your **valid ID** and a **selfie holding that ID**.",
          requiresPreparation: true,
        },
        {
          id: "online:approval",
          t: "Wait **1–3 working days** for an approval email.",
        },
        {
          id: "online:download",
          t: "Log in again and download your **Digital TIN ID** (also shown in the **eGovPH app**).",
        },
      ],
    },
  },

  nbi: {
    procedure: "hybrid",
    onlineRequiresVisit: true,
    purpose:
      "Proof you have no criminal record; common for jobs, travel and licensing.",
    issuedBy: "National Bureau of Investigation (NBI)",
    fee: { min: 155, max: 155 },
    onsite: true,
    online: true,
    refs: [
      { label: "NBI Clearance online", url: "https://clearance.nbi.gov.ph" },
      {
        label: "NBI first-time jobseeker portal",
        url: "https://firsttimejobseekers.nbi.gov.ph",
      },
      { label: "NBI official website", url: "https://nbi.gov.ph" },
      { label: "RA 11261 Sec. 4(b) — free for first-time jobseekers" },
    ],
    req: {
      age: "**18+** standard. **15–17** for allowed purposes only.",
      fee: "**₱155** · **₱0** for adult first-time jobseekers",
      prepare: [
        {
          id: "identity-routes",
          either: [
            {
              id: "primary",
              label: "I have 2 valid IDs",
              items: [
                {
                  id: "identity-routes-primary-identity",
                  t: "**2 original valid IDs**",
                  ids: [
                    "postal",
                    "philsys",
                    "passport",
                    "lto",
                    "prc",
                    "comelec",
                    "philhealth",
                    "tin",
                    "pwd",
                    "senior",
                    "owwa",
                    "pagibig",
                  ],
                  min: 2,
                },
              ],
            },
            {
              id: "supporting",
              label: "Student route",
              items: [
                {
                  id: "identity-routes-supporting-identity",
                  t: "**PSA Birth Certificate**",
                  ids: ["psa"],
                },
                {
                  id: "identity-routes-supporting-support",
                  t: "**School ID**",
                  ids: ["school"],
                },
              ],
            },
          ],
        },
        {
          id: "appointment",
          t: "**Appointment reference** + payment receipt",
          completedBy: "online:save-reference",
        },
        {
          id: "jobseeker-documents",
          t: "**First-Time Jobseeker certificate** + signed Oath",
          onlyIf: "If you’re a first-time jobseeker",
          ids: ["jobseeker:barangay"],
          when: {
            fact: "waiverRequested",
          },
          confirm: true,
        },
      ],
      minors: "Come with a **parent/guardian**, their ID and written consent.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:attend",
          t: "Go to your NBI branch **on your appointment date**, a little early.",
          requiresPreparation: true,
        },
        {
          id: "onsite:present-documents",
          t: "Show your **reference number**, receipt and **2 valid IDs** at the entrance.",
        },
        {
          id: "onsite:biometrics",
          t: "Have your **photo, fingerprints and signature** taken.",
        },
        {
          id: "onsite:release",
          t: "No “hit” (no name match): you get it **the same day**. With a hit: come back in **5–10 working days**.",
        },
      ],
      online: [
        {
          id: "online:register",
          t: "Create an account on the **NBI Clearance website** and verify your mobile number.",
          link: {
            label: "NBI Clearance",
            url: "https://clearance.nbi.gov.ph",
          },
        },
        {
          id: "online:apply",
          t: "Fill in your profile, then click **Apply for Clearance** and choose your purpose.",
        },
        {
          id: "online:book",
          t: "Pick the **NBI branch** nearest you, a date and a time slot.",
        },
        {
          id: "online:pay",
          t: "Pay **₱155** using an option on the site (GCash, Maya, bank, 7-Eleven). **First-time jobseekers pay ₱0.**",
          link: {
            label: "First-time jobseeker NBI",
            url: "https://firsttimejobseekers.nbi.gov.ph",
          },
        },
        {
          id: "online:save-reference",
          t: "Save or screenshot your **reference number** and payment receipt.",
        },
      ],
    },
  },

  npc: {
    procedure: "hybrid",
    onlineRequiresVisit: true,
    purpose:
      "Police clearance showing no pending record; widely required for employment.",
    issuedBy: "Philippine National Police (PNP)",
    fee: { min: 160, max: 180 },
    onsite: true,
    online: true,
    refs: [
      {
        label: "PNP National Police Clearance System",
        url: "https://pnpclearance.ph",
      },
      { label: "RA 11261 Sec. 4(a) — free for first-time jobseekers" },
    ],
    req: {
      age: "**18+** standard. **15–17** for justified cases.",
      fee: "**₱160–₱180** · **₱0** for first-time jobseekers",
      prepare: [
        {
          id: "valid-ids",
          t: "**2 original valid IDs**",
          ids: [
            "postal",
            "philsys",
            "passport",
            "lto",
            "prc",
            "comelec",
            "philhealth",
            "tin",
            "pwd",
            "senior",
            "owwa",
            "pagibig",
          ],
          min: 2,
        },
        {
          id: "appointment",
          t: "**NPCS appointment** + payment receipt",
          completedBy: "online:save-reference",
        },
        {
          id: "jobseeker-documents",
          t: "**First-Time Jobseeker certificate** + signed Oath",
          onlyIf: "If you’re a first-time jobseeker",
          ids: ["jobseeker:barangay"],
          when: {
            fact: "waiverRequested",
          },
          confirm: true,
        },
      ],
      minors:
        "Parent/guardian attends with **PSA Birth Cert**, School ID and consent.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:attend",
          t: "Go to that police station **15–30 minutes early**, in neat clothes (no sleeveless tops).",
          requiresPreparation: true,
        },
        {
          id: "onsite:present-documents",
          t: "Show your **reference number**, receipt and **2 valid IDs** at the clearance desk.",
        },
        {
          id: "onsite:biometrics",
          t: "Have your **photo, fingerprints and signature** taken.",
        },
        {
          id: "onsite:release",
          t: "Clean record: you get it **the same day**. With a “hit”: come back in **5–15 working days**.",
        },
      ],
      online: [
        {
          id: "online:register",
          t: "Create an account on the **PNP Police Clearance website** and verify your email.",
          link: {
            label: "PNP NPCS",
            url: "https://pnpclearance.ph",
          },
        },
        {
          id: "online:profile",
          t: "Fill in your profile exactly as it appears on your ID.",
        },
        {
          id: "online:book",
          t: "Choose your purpose, the **police station** nearest you, a date and a time.",
        },
        {
          id: "online:pay",
          t: "Pay **₱150 + service fee** with the options shown. **First-time jobseekers pay ₱0.**",
        },
        {
          id: "online:save-reference",
          t: "Save or screenshot your **reference number**.",
        },
      ],
    },
  },

  comelec: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Official proof you are a registered voter; accepted as an ID for passport applications.",
    issuedBy: "Commission on Elections (COMELEC)",
    fee: { min: 75, max: 75 },
    onsite: true,
    online: false,
    refs: [
      { label: "COMELEC", url: "https://www.comelec.gov.ph" },
      {
        label: "Precinct Finder",
        url: "https://precinctfinder.comelec.gov.ph",
      },
      {
        label: "DFA consular requirements",
        url: "https://consular.dfa.gov.ph",
      },
      { label: "RA 8189 — Voter’s Registration Act" },
    ],
    req: {
      age: "**18+**. Ages 15–17 can only register for SK.",
      fee: "**₱75** · exemptions for seniors, PWDs, solo parents, jobseekers",
      prepare: [
        {
          id: "identity",
          t: "**1 valid ID** — original **and** photocopy",
          ids: ["school", "postal", "philsys", "passport", "lto", "prc"],
          confirm: true,
        },
        {
          id: "precinct",
          t: "Precinct / registration details",
        },
        {
          id: "voter-status",
          t: "You must be an **active registered voter**",
        },
      ],
      minors: "Not available for regular voter certification.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:check-status",
          t: "Check that you’re a **registered voter** using the COMELEC Precinct Finder.",
          link: {
            label: "Precinct Finder",
            url: "https://precinctfinder.comelec.gov.ph",
          },
        },
        {
          id: "onsite:visit",
          t: "Go to the **COMELEC Election Officer’s office** in your city or town (usually at the City/Municipal Hall).",
        },
        {
          id: "onsite:apply",
          t: "Ask for a **Voter’s Certification** and fill in the request form. Bring **1 valid ID**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:pay",
          t: "Pay **₱75** at the cashier and keep the receipt.",
        },
        {
          id: "onsite:collect",
          t: "Wait for it to be printed and **dry-sealed** — usually **the same day**.",
        },
      ],
      online: [],
    },
  },

  postal: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Affordable government photo ID with fingerprint capture, widely accepted.",
    issuedBy: "Philippine Postal Corporation (PHLPost)",
    fee: { min: 550, max: 550 },
    onsite: true,
    online: false,
    refs: [
      {
        label: "Postal ID requirements",
        url: "https://www.postalidph.com/requirements.html",
      },
      {
        label: "Postal ID FAQs",
        url: "https://www.postalidph.com/faqs.html",
      },
      {
        label: "PHLPost",
        url: "https://phlpost.gov.ph",
      },
    ],
    req: {
      age: "**No minimum age**. Under 18 come with a parent/guardian.",
      fee: "**₱550** regular · **₱650** rush",
      prepare: [
        {
          id: "identity",
          t: "**1 proof of identity** (PSA Birth Cert, School ID or Form 137)",
          ids: ["psa", "school", "form137"],
        },
        {
          id: "address",
          t: "**1 proof of address** — accepted Barangay Certificate of Residency, utility bill or current Barangay Residency ID showing the required address.",
          ids: ["barangay", "utility-bill", "barangay-id"],

          documentChecks: {
            "barangay-id": ["addressCurrent"],
          },
        },
        {
          id: "address-copy",
          t: "**Original and photocopy of your proof of address**; confirm the name and address meet the Postal ID requirements.",
        },
        {
          id: "forms",
          t: "**2 copies** of the application form",
        },
      ],
      minors: "Parent/guardian must come with you **in person**.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:prepare-forms",
          t: "Download the **Postal ID application form** (or get it free at the post office) and fill in **2 copies**. Then find a **post office that takes Postal ID photos and fingerprints** — not every branch does, so call or check the list first.",
          link: {
            label: "Get the form and branch list",
            url: "https://www.postalidph.com/requirements.html",
          },
        },
        {
          id: "onsite:submit",
          t: "At that post office’s **Postal ID counter**, hand in both forms, **1 proof of identity** and **1 proof of address** (original + photocopy).",
          requiresPreparation: true,
        },
        {
          id: "onsite:pay",
          t: "Pay at the cashier: **₱550** regular or **₱650** rush. Keep the receipt.",
        },
        {
          id: "onsite:biometrics",
          t: "At the same counter, have your **photo, fingerprints and signature** taken.",
        },
        {
          id: "onsite:delivery",
          t: "Your Postal ID is **mailed to your address**: **15–30 days** regular, **3–5 days** rush. Keep your receipt to follow up.",
        },
      ],
      online: [],
    },
  },

  philsys: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "A general identity credential for government and private transactions, available in physical, paper and digital formats subject to authentication.",
    issuedBy: "Philippine Statistics Authority (PhilSys)",
    fee: { min: 0, max: 0 },
    onsite: true,
    online: false,
    refs: [
      {
        label: "PhilSys — supporting documents",
        url: "https://philsys.gov.ph/supporting-documents/",
      },
      {
        label: "PhilSys FAQs",
        url: "https://philsys.gov.ph/faq-frequently-asked-questions/",
      },
      {
        label: "National ID digital (eGovPH)",
        url: "https://national-id.gov.ph",
      },
      {
        label: "RA 11055 — Philippine Identification System Act",
      },
      {
        label: "PSA PhilSys Citizen’s Charter — supporting documents",
        url: "https://rsso05.psa.gov.ph/system/files/documents/2024%20CC%20-%20PhilSys_Updated%20with%20Brief%20Description%20%281%29.pdf",
      },
    ],
    req: {
      age: "From **birth**. Recapture at ages **5** and **15**. Apply alone at **18+**.",
      fee: "**₱0**",
      prepare: [
        {
          id: "identity-routes",
          either: [
            {
              id: "primary",
              label: "I have 1 primary ID",
              items: [
                {
                  id: "identity-routes-primary-identity",
                  t: "**1 primary ID** — Passport, UMID or LTO license",
                  ids: ["passport", "umid", "lto"],
                },
              ],
            },
            {
              id: "supporting",
              label: "I have 2 secondary documents",
              items: [
                {
                  id: "identity-routes-supporting-identity",
                  t: "**PSA Birth Certificate** (with BReN)",
                  ids: ["psa"],
                },
                {
                  id: "identity-routes-supporting-support",
                  t: "**1 supporting document** — School ID, Barangay clearance, PhilHealth, TIN, NBI/Police or Postal ID",
                  ids: [
                    "school",
                    "barangay",
                    "philhealth",
                    "tin",
                    "nbi",
                    "npc",
                    "postal",
                  ],
                },
              ],
            },
            {
              id: "barangay-id-alternative",
              label: "Barangay ID alternative document route",
              items: [
                {
                  id: "barangay-id-supporting",
                  t: "**Current Barangay ID** with full name, front-facing photo, signature/thumbmark, permanent address and date of birth; subject to PSA screening",
                  ids: ["barangay-id"],
                  documentChecks: {
                    "barangay-id": ["philsysFields"],
                  },
                },
              ],
            },
          ],
        },
      ],
      minors: "Bring a **parent/guardian** and their valid ID.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:find-center",
          t: "Find a **PhilSys registration center** — usually at your City/Municipal Hall, a mall or a PSA office. Check your LGU’s page for the schedule.",
          link: {
            label: "Supporting documents",
            url: "https://philsys.gov.ph/supporting-documents/",
          },
        },
        {
          id: "onsite:screening",
          t: "Show your **PSA birth certificate** or **1 valid ID** at the screening desk.",
          requiresPreparation: true,
        },
        {
          id: "onsite:verify-details",
          t: "Check the details they typed — **name, birth date, address** — before you confirm.",
        },
        {
          id: "onsite:biometrics",
          t: "Have your **photo, 10 fingerprints and iris** scanned.",
        },
        {
          id: "onsite:keep-trn",
          t: "Keep your **Transaction Reference Number (TRN)** slip. The card is mailed to you; you can use the **digital National ID** in the eGovPH app while you wait.",
        },
      ],
      online: [],
    },
  },

  passport: {
    procedure: "hybrid",
    onlineRequiresVisit: true,
    purpose:
      "Travel document and the strongest proof of identity abroad and at home.",
    issuedBy: "Department of Foreign Affairs (DFA)",
    fee: { min: 1000, max: 1000 },
    onsite: true,
    online: true,
    refs: [
      {
        label: "DFA embassy — accepted IDs and student route",
        url: "https://www.philippine-embassy.org.sg/list-of-acceptable-valid-ids-for-passport-application/",
      },
      { label: "DFA passport appointment", url: "https://www.passport.gov.ph" },
      {
        label: "DFA consular requirements",
        url: "https://consular.dfa.gov.ph",
      },
      { label: "RA 11983 and RA 10928 — passport laws" },
    ],
    req: {
      age: "From **birth**. Apply alone at **18+**. Validity: **10 years** adult, **5** minor.",
      fee: "**₱1,000** regular · **₱1,250** expedited",
      prepare: [
        {
          id: "birth-certificate",
          t: "**PSA Birth Certificate** (security paper)",
          ids: ["psa"],
        },
        {
          id: "identity-routes",
          either: [
            {
              id: "accepted-identity",
              label: "Accepted identity credential",
              items: [
                {
                  id: "accepted-id",
                  t: "**1 DFA-accepted ID** — original + photocopy. Confirm the required issuing office and format, especially for Voter's Certification.",
                  ids: [
                    "philsys",
                    "lto",
                    "prc",
                    "postal",
                    "comelec",
                    "umid",
                    "senior",
                    "owwa",
                  ],
                  confirm: true,
                },
              ],
            },
            {
              id: "student-identity",
              label: "Currently enrolled student route",
              when: { fact: "enrolled" },
              items: [
                {
                  id: "student-id",
                  t: "**Current School ID** — original and photocopy; confirm acceptance for this application.",
                  ids: ["school"],
                  confirm: true,
                },
                {
                  id: "student-registration",
                  t: "**Certificate of Registration** from your school, with your School ID",
                  onlyIf: "If you’re 18 or older",
                  when: { not: { underAge: 18 } },
                  confirm: true,
                },
              ],
            },
          ],
        },
        {
          id: "appointment",
          t: "**Printed appointment packet**",
          completedBy: "online:print-packet",
        },
      ],
      minors:
        "Appear with a parent; bring **PSA Birth Cert** and the adult’s documents.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:attend",
          t: "Go to the DFA office you chose **30 minutes early**. Bring the packet, your **PSA birth certificate** and **1 valid ID** (originals + photocopies).",
          requiresPreparation: true,
        },
        {
          id: "onsite:verification",
          t: "Hand your documents to the **verification counter**.",
        },
        {
          id: "onsite:biometrics",
          t: "Check your details on screen, then have your **photo, fingerprints and signature** taken.",
        },
        {
          id: "onsite:keep-receipt",
          t: "Keep your **official receipt** — it shows your **release date**.",
        },
        {
          id: "onsite:collect",
          t: "Claim your passport at the same office on that date (see the date on your receipt), or have it delivered.",
        },
      ],
      online: [
        {
          id: "online:book",
          t: "Book an appointment on the **official DFA passport site only** — never through fixers.",
          link: {
            label: "DFA appointment",
            url: "https://www.passport.gov.ph",
          },
        },
        {
          id: "online:complete-form",
          t: "Fill in the form **exactly as on your PSA birth certificate** (spelling, middle name, birth date).",
        },
        {
          id: "online:pay",
          t: "Pay within **24 hours**: **₱1,000** regular or **₱1,250** expedited (GCash, Maya, card or bank).",
        },
        {
          id: "online:print-packet",
          t: "Download and **print your application packet** (form + appointment page).",
        },
      ],
    },
  },

  mysss: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "SSS functional identification and bank-linked service card for SSS transactions and disbursements.",
    acceptance: {
      accepted: [
        "Identification for SSS transactions and bank-linked services under the issuing partner bank's rules.",
      ],
      limits: [
        "Other government agencies and private institutions set their own acceptance policies; the MySSS Card is distinct from the legacy UMID card.",
      ],
    },
    issuedBy: "Social Security System (SSS) with partner banks",
    fee: { min: 200, max: 200 },
    onsite: false,
    online: true,
    refs: [
      { label: "MySSS Card (SSS)", url: "https://www.sss.gov.ph/mysss-card/" },
      { label: "My.SSS member portal", url: "https://member.sss.gov.ph" },
      {
        label: "RCBC DiskarTech — MySSS Card",
        url: "https://diskartech.ph/mysss-card-powered-by-rcbc-diskartech/",
      },
      { label: "RA 11199 — Social Security Act of 2018" },
    ],
    req: {
      age: "**18+** for the card. SSS membership can start at 15 if employed.",
      fee: "**₱0** SSS + about **₱200** partner-bank card",
      prepare: [
        {
          id: "national-id",
          t: "**PhilSys National ID** registration",
          ids: ["philsys"],
        },
        {
          id: "membership",
          t: "Permanent **SS number** + 1 posted contribution",
        },
        {
          id: "account",
          t: "Active **My.SSS account** and a smartphone",
        },
      ],
      minors: "Not available. Employed minors get an SS number only.",
    },
    steps: {
      onsite: [],
      online: [
        {
          id: "online:sign-in",
          t: "Log in to **My.SSS** and open **MySSS Card**. (No account yet? Register with your SS number first.)",
          link: {
            label: "My.SSS",
            url: "https://member.sss.gov.ph",
          },
        },
        {
          id: "online:face-scan",
          t: "Check your details, then do the **face scan** with your phone camera.",
          requiresPreparation: true,
        },
        {
          id: "online:choose-bank",
          t: "Pick a **partner bank** for the card and save your **transaction reference number (TRN)**.",
        },
        {
          id: "online:bank-kyc",
          t: "Download that bank’s app, finish its **ID check**, and add at least **₱200**.",
        },
        {
          id: "online:delivery",
          t: "The card is delivered in **7–15 working days**.",
          link: {
            label: "MySSS Card info",
            url: "https://www.sss.gov.ph/mysss-card/",
          },
        },
      ],
    },
  },

  lto: {
    procedure: "hybrid",
    onlineRequiresVisit: true,
    purpose: "Government driver’s license — also a strong primary ID.",
    issuedBy: "Land Transportation Office (LTO)",
    fee: { min: 1000, max: 7500 },
    onsite: true,
    online: true,
    refs: [
      { label: "LTO", url: "https://lto.gov.ph" },
      { label: "LTO LTMS portal", url: "https://portal.lto.gov.ph" },
      { label: "RA 10930 — driver’s license validity" },
      { label: "LTO MC 2021-2293 — student permit and driving courses" },
    ],
    req: {
      age: "**17+** (Filipino). Student Permit from **16**.",
      fee: "LTO **₱685** + medical + driving course; about **₱1,000–₱7,500**",
      prepare: [
        {
          id: "student-permit",
          t: "**Student Permit** held **30+ days**",
        },
        {
          id: "training-medical",
          t: "**8-hour PDC** certificate + **LTO medical**",
          completedBy: "online:complete-training",
        },
        {
          id: "identity",
          t: "**PSA Birth Certificate** or a valid ID",
          ids: ["psa", "postal", "philsys", "passport", "lto", "prc"],
        },
        {
          id: "tin",
          t: "**TIN** (your tax number)",
          onlyIf: "If you’re employed",
          ids: ["tin"],
          when: { fact: "employed" },
        },
      ],
      minors: "At 17 you need **guardian consent** and ID.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:attend",
          t: "Go to your **LTO office** on your appointment date with your **original documents** and appointment printout.",
          requiresPreparation: true,
        },
        {
          id: "onsite:submit",
          t: "Hand in your documents and pay the **₱100** application fee.",
        },
        {
          id: "onsite:biometrics",
          t: "Have your **photo, signature and fingerprints** taken.",
        },
        {
          id: "onsite:exams",
          t: "Take the **written exam** (pass: 48 of 60) and the **driving test** (pass: 80 of 100).",
        },
        {
          id: "onsite:collect",
          t: "Pay the license fee and **claim your card the same day**.",
        },
      ],
      online: [
        {
          id: "online:complete-training",
          t: "First, finish the **Practical Driving Course (PDC)** at an LTO-accredited driving school and a **medical exam** at an LTO-accredited clinic. Both are sent to LTO for you.",
        },
        {
          id: "online:register",
          t: "Log in to the **LTO portal (LTMS)** and choose **Licensing → New Non-Professional License**.",
          link: {
            label: "LTMS portal",
            url: "https://portal.lto.gov.ph",
          },
        },
        {
          id: "online:book",
          t: "Check that your PDC and medical show up, then **book a date** at your LTO office.",
        },
      ],
    },
  },

  pagibig: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Pag-IBIG loyalty and bank-linked disbursement service card for eligible members.",
    acceptance: {
      accepted: [
        "Pag-IBIG transactions and the loyalty/disbursement services supported by the partner bank.",
      ],
      limits: [
        "Pag-IBIG Circular No. 450 states that Loyalty Card Plus is not considered a government ID. Do not assume it substitutes for an accepted government ID in another application.",
      ],
    },
    issuedBy: "Pag-IBIG Fund with UnionBank / AUB",
    fee: { min: 125, max: 125 },
    onsite: true,
    online: false,
    refs: [
      { label: "Pag-IBIG Fund", url: "https://www.pagibigfund.gov.ph" },
      {
        label: "Pag-IBIG Circular No. 450 — Loyalty Card Plus guidelines",
        url: "https://www.pagibigfund.gov.ph/document/pdf/circulars/provident/Circular%20No.%20450%20-%20Modified%20Guidelines%20on%20the%20Availment%20of%20the%20Pag-IBIG%20Fund%20Loyalty%20Card%20Plus.pdf",
      },
      {
        label: "Virtual Pag-IBIG",
        url: "https://www.pagibigfundservices.com/virtualpagibig/",
      },
      {
        label: "UnionBank — Loyalty Card Plus",
        url: "https://www.unionbankph.com/PagIBIGLoyaltyCardPlus",
      },
      {
        label: "AUB — Hello Pag-IBIG FAQs",
        url: "https://www.aub.com.ph/hellopagibig/faqs",
      },
      { label: "RA 9679 — Home Development Mutual Fund Law" },
    ],
    req: {
      age: "**18+**; you must appear in person.",
      fee: "**₱125** card fee",
      prepare: [
        {
          id: "membership",
          t: "**Active MID** + at least 1 contribution",
          completedBy: "onsite:check-membership",
        },
        {
          id: "form",
          t: "**Loyalty Card Plus form** (HQP-PFF-108)",
        },
        {
          id: "identity",
          t: "**1 primary ID** — original + photocopy",
          ids: ["postal", "philsys", "passport", "lto", "prc"],
          confirm: true,
        },
      ],
      minors: "Not available until **18**.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:check-membership",
          t: "Check your **Pag-IBIG MID number** and that your contributions are posted (Virtual Pag-IBIG).",
          link: {
            label: "Virtual Pag-IBIG",
            url: "https://www.pagibigfundservices.com/virtualpagibig/",
          },
        },
        {
          id: "onsite:visit",
          t: "Go to a **Pag-IBIG branch with a Loyalty Card kiosk** and take a queue number.",
        },
        {
          id: "onsite:submit",
          t: "Hand in the **Loyalty Card Plus form** and **1 valid ID**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:capture-pay",
          t: "At the kiosk, have your **photo, signature and fingerprint** taken, then pay **₱125**.",
        },
        {
          id: "onsite:activate",
          t: "Claim your card **the same day**, then activate it in the partner bank’s app.",
        },
      ],
      online: [],
    },
  },

  prc: {
    procedure: "hybrid",
    onlineRequiresVisit: true,
    purpose:
      "Professional ID for licensed professionals, issued after the board exam.",
    issuedBy: "Professional Regulation Commission (PRC)",
    fee: { min: 900, max: 1050 },
    onsite: true,
    online: true,
    refs: [
      { label: "PRC LERIS online", url: "https://online.prc.gov.ph" },
      { label: "PRC", url: "https://www.prc.gov.ph" },
      { label: "RA 8981 — PRC Modernization Act" },
      { label: "RA 10912 — CPD Act" },
    ],
    req: {
      age: "Usually **18 or 21**, after the required degree and **board exam**.",
      fee: "**₱1,050** (bachelor’s) · **₱900** (non-bachelor’s) for 3 years",
      prepare: [
        {
          id: "oath-form",
          t: "**Oath form** + Notice of Admission / rating",
        },
        {
          id: "photos",
          t: "**2 photos (2x2)** with name tag",
        },
        {
          id: "stamps",
          t: "**2 sets** of documentary stamps",
        },
        {
          id: "identity",
          t: "**1 valid ID**",
          ids: ["school", "postal", "philsys", "passport", "lto", "prc"],
        },
        {
          id: "cedula",
          t: "**Cedula** (Community Tax Certificate)",
          onlyIf: "If your PRC office asks",
          ids: ["cedula"],
          opt: true,
        },
      ],
      minors:
        "Not available. **Personal appearance** required for first registration.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:attend",
          t: "Go to your chosen **PRC office** on the date, with your printed forms.",
          requiresPreparation: true,
        },
        {
          id: "onsite:submit",
          t: "Hand in your documents and sign the **Registry Book**.",
        },
        {
          id: "onsite:collect",
          t: "Claim your **PRC ID** and certificate — same day or on the date on your claim stub.",
        },
      ],
      online: [
        {
          id: "online:register",
          t: "Create your **PRC LERIS** account. Use a photo that matches your records.",
          link: {
            label: "PRC LERIS",
            url: "https://online.prc.gov.ph",
          },
        },
        {
          id: "online:oath",
          t: "Attend your **oath-taking** (online or in person) after passing the board exam.",
        },
        {
          id: "online:book",
          t: "In LERIS, book **Initial Registration** and pick a PRC office and date.",
        },
        {
          id: "online:pay-print",
          t: "Pay online, then **print your oath form** and appointment slip.",
        },
      ],
    },
  },

  pwd: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Disability identification card for eligible applicants to access applicable discounts, services and benefits.",
    issuedBy: "LGU PDAO / Social Welfare Office (DOH–NCDA registry)",
    fee: { min: 0, max: 0 },
    onsite: true,
    online: false,
    refs: [
      { label: "NCDA", url: "https://ncda.gov.ph" },
      { label: "DOH PWD registry", url: "https://pwd.doh.gov.ph" },
      { label: "RA 7277, RA 9442 and RA 10754 — PWD laws" },
    ],
    req: {
      age: "**Any age** with a qualifying permanent disability.",
      fee: "**₱0** (public hospital certificates are free)",
      prepare: [
        {
          id: "medical",
          t: "**Medical certificate** or clinical abstract",
        },
        {
          id: "identity",
          t: "**PSA Birth Cert** or valid ID",
          ids: ["psa", "postal", "philsys", "passport", "lto", "prc"],
        },
        {
          id: "residency",
          t: "**Barangay Certificate**",
          ids: ["barangay"],
        },
        {
          id: "photos",
          t: "**2 photos**",
        },
        {
          id: "form",
          t: "DOH–NCDA PRPWD application form",
        },
      ],
      minors: "Parent, guardian or social worker applies for you.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:prepare-documents",
          t: "Get a **medical certificate** from a doctor that states your disability, and a **Barangay Certificate of Residency**.",
        },
        {
          id: "onsite:visit",
          t: "Go to your city or town’s **PWD Affairs Office (PDAO)** — or the **Social Welfare Office (CSWDO/MSWDO)** if there’s no PDAO.",
        },
        {
          id: "onsite:apply",
          t: "Fill in the **PWD registration form (PRPWD)** and hand in your documents with **2 1x1 photos**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:verification",
          t: "Wait for verification, then sign and have your **photo** taken.",
        },
        {
          id: "onsite:collect",
          t: "Claim your **PWD ID and discount booklets** (same day to 5 days).",
        },
      ],
      online: [],
    },
  },

  soloparent: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose: "ID granting solo parents statutory benefits and discounts.",
    issuedBy: "LGU Solo Parents Office / CSWDO / MSWDO",
    fee: { min: 100, max: 300 },
    onsite: true,
    online: false,
    refs: [
      { label: "DSWD", url: "https://www.dswd.gov.ph" },
      { label: "RA 11861 — Expanded Solo Parents Welfare Act" },
      { label: "DOLE DO 239-2023 — 7-day parental leave" },
    ],
    req: {
      age: "No minimum for **biological** parents; others **18+**.",
      fee: "**₱0** card · notarization **₱100–₱300** (free via PAO)",
      prepare: [
        {
          id: "child-birth-certificate",
          t: "Child’s **PSA Birth Certificate**",
          ids: ["child:psa"],
          subject: "child",
        },
        {
          id: "residency",
          t: "**Barangay Certification** (6 months)",
          ids: ["barangay"],
          confirm: true,
        },
        {
          id: "affidavit",
          t: "**Sworn affidavit** (notarized)",
        },
        {
          id: "category-evidence",
          t: "Income proof + **category proof** (death cert, CENOMAR, etc.)",
        },
      ],
      minors: "A guardian or **DSWD social worker** co-signs.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:prepare-documents",
          t: "Get a **Barangay Certificate** that you live there and a **notarized affidavit** that you’re a solo parent.",
        },
        {
          id: "onsite:prepare-evidence",
          t: "Prepare your child’s **PSA birth certificate** and proof of your situation (e.g. death certificate, court order).",
        },
        {
          id: "onsite:submit",
          t: "Hand everything in at your city or town’s **Social Welfare Office (CSWDO/MSWDO)** or **Solo Parents Office**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:interview",
          t: "Have a short **interview with a social worker**.",
        },
        {
          id: "onsite:collect",
          t: "Attend the short orientation, then claim your **Solo Parent ID** (7–30 days).",
        },
      ],
      online: [],
    },
  },

  owwa: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose:
      "Membership ID for overseas workers with OWWA benefits and assistance.",
    issuedBy: "Overseas Workers Welfare Administration (OWWA)",
    fee: { min: 0, max: 0 },
    onsite: false,
    online: true,
    refs: [
      { label: "OWWA", url: "https://owwa.gov.ph" },
      { label: "OWWA e-Card portal", url: "https://ecard.owwa.gov.ph" },
      { label: "DMW", url: "https://www.dmw.gov.ph" },
      {
        label: "DMW online services",
        url: "https://onlineservices.dmw.gov.ph",
      },
      { label: "RA 10801 — OWWA Act" },
    ],
    req: {
      age: "**18+** (land/sea-based). **23+** for domestic workers.",
      fee: "**₱0** card · membership about **US$25** per contract",
      prepare: [
        {
          id: "passport",
          t: "**Valid Philippine Passport** (6+ months)",
          ids: ["passport"],
          confirm: true,
        },
        {
          id: "membership",
          t: "**Active OWWA membership**",
        },
        {
          id: "employment-record",
          t: "**Contract, visa or OEC** record",
        },
        {
          id: "contact",
          t: "Active **email and mobile number**",
        },
      ],
      minors: "Not available to under-18s.",
    },
    steps: {
      onsite: [],
      online: [
        {
          id: "online:check-membership",
          t: "Make sure your **OWWA membership** is active (it’s paid with each work contract).",
        },
        {
          id: "online:register",
          t: "Download the **OWWA Mobile App** and sign up using your **passport details**.",
          requiresPreparation: true,
        },
        {
          id: "online:digital-card",
          t: "Open the **OFW e-Card** section in the app — that’s your ID.",
        },
      ],
    },
  },

  senior: {
    procedure: "alternative",
    onlineRequiresVisit: false,
    purpose: "Senior citizen ID for statutory discounts and purchase booklets.",
    issuedBy: "City/Municipal OSCA (Office for Senior Citizens Affairs)",
    fee: { min: 0, max: 0 },
    onsite: true,
    online: false,
    refs: [
      {
        label: "National Commission of Senior Citizens",
        url: "https://www.ncsc.gov.ph",
      },
      { label: "RA 9994 — Expanded Senior Citizens Act" },
      { label: "RA 11350 — NCSC Act" },
    ],
    req: {
      age: "**60+** (some LGUs pre-register shortly before 60).",
      fee: "**₱0**",
      prepare: [
        {
          id: "age-proof",
          t: "**Proof of age** — PSA Birth Cert, Passport, National ID, etc.",
          ids: ["psa", "passport", "philsys", "lto", "comelec"],
        },
        {
          id: "residency",
          t: "**Barangay Residency Certificate** (6+ months)",
          ids: ["barangay"],
          confirm: true,
        },
        {
          id: "photos",
          t: "**2–3 photos** (1x1 or 2x2)",
        },
      ],
      minors: "Not available. Under-60s are ineligible.",
    },
    steps: {
      onsite: [
        {
          id: "onsite:residency",
          t: "Get a **Barangay Certificate of Residency** from your Barangay Hall.",
        },
        {
          id: "onsite:visit",
          t: "Go to the **Office of Senior Citizens Affairs (OSCA)** at your City/Municipal Hall and ask for the form.",
        },
        {
          id: "onsite:submit",
          t: "Hand in the form with **proof of age** (birth certificate or ID), your residency certificate and **2 1x1 photos**.",
          requiresPreparation: true,
        },
        {
          id: "onsite:capture",
          t: "Sign or thumbmark the form. Some cities also take your **photo and fingerprints**.",
        },
        {
          id: "onsite:collect",
          t: "Claim your **Senior Citizen ID** and **discount booklets** (same day to 3 days).",
        },
      ],
      online: [],
    },
  },
};
