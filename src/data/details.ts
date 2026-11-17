/**
 * Short, scannable card content condensed from the research workbook
 * ("Summary Cards" + each tier's step-by-step and reference columns).
 * `**bold**` marks what the reader must not miss.
 */

/**
 * One thing to prepare. `ids` = owning any of these IDs ticks it automatically
 * (`min` = how many you need). `opt` = only needed in some cases, so it never blocks the guide.
 */
export type PrepItem = string | { t: string; ids?: string[]; min?: number; opt?: boolean };
/** Either a single item, or alternative routes — completing ANY one route satisfies it. */
export type PrepEntry = PrepItem | { either: { label: string; items: PrepItem[] }[] };

/** Government photo IDs that most applications accept as "a valid ID". */
const GOV = ["postal", "philsys", "passport", "lto", "mysss", "prc"];
/** A wider set that NBI / Police Clearance accept as valid IDs. */
const VALID2 = [...GOV, "comelec", "philhealth", "tin", "pwd", "senior", "owwa", "pagibig"];

export interface Step {
  t: string;
  link?: { label: string; url: string };
}

export interface CardDetail {
  purpose: string;
  issuedBy: string;
  /** Lowest realistic cost in pesos (used for budget matching). */
  minFee: number;
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

const L = (label: string, url: string) => ({ label, url });

export const DETAILS: Record<string, CardDetail> = {
  psa: {
    purpose: "Ultimate proof of identity and citizenship — the base for your passport, license and National ID.",
    issuedBy: "Philippine Statistics Authority (PSA)",
    minFee: 155, onsite: true, online: true,
    refs: [{ label: "PSA Civil Registry (CRS) appointments", url: "https://crs.psa.gov.ph" }, { label: "PSAHelpline.ph — order online", url: "https://psahelpline.ph/psa-birth-certificate" }, { label: "Philippine Statistics Authority", url: "https://psa.gov.ph" }, { label: "Presidential Decree 603 — Child and Youth Welfare Code" }],
    req: {
      age: "Issued from **birth**. Request on your own at **18+**.",
      fee: "**₱155** on-site · **₱365** online (with delivery)",
      prepare: [{ t: "**1 original valid photo ID**", ids: GOV }, "**Appointment slip** + application form (on-site)", "Know your **birth name, birth date/place** and **parents’ full names**"],
      minors: "Parent or guardian books it and shows their **valid ID**.",
    },
    steps: {
      onsite: [
        { t: "Book a free appointment and pick a **PSA CRS outlet**.", link: L("PSA CRS appointment", "https://crs.psa.gov.ph") },
        { t: "Arrive **30 minutes early** and show your slip." },
        { t: "Fill out the application form and get a queue number." },
        { t: "Submit form, ID and **₱155** at the window." },
        { t: "Claim your copy and **check every detail**." },
      ],
      online: [
        { t: "Choose **Birth Certificate** and enter your birth details.", link: L("PSAHelpline.ph", "https://psahelpline.ph/psa-birth-certificate") },
        { t: "Add your delivery address and contact number." },
        { t: "Pay **₱365** via GCash, Maya, card or bank." },
        { t: "Receive it from the courier — show your **original ID**." },
      ],
    },
  },

  barangay: {
    purpose: "Local proof of address and good standing; required for NBI, police clearance and Postal ID.",
    issuedBy: "Barangay Hall where you live",
    minFee: 0, onsite: true, online: true,
    refs: [{ label: "eGovPH — online barangay services", url: "https://e.gov.ph" }, { label: "DICT eGov digital platforms", url: "https://dict.gov.ph/egov-digital-platforms" }, { label: "RA 7160 — Local Government Code" }, { label: "RA 11261 — First Time Jobseekers Assistance Act" }],
    req: {
      age: "**No fixed age** for residency. First-Time Jobseeker certificate: **15+**.",
      fee: "**₱20–₱100** · **₱0** for first-time jobseekers (RA 11261)",
      prepare: [{ t: "**1 valid ID** (or School ID / PSA Birth Cert)", ids: ["psa", "school", ...GOV] }, "**Proof of residency** — utility bill, lease or landlord note", { t: "Cedula, **only if** your barangay requires it", ids: ["cedula"], opt: true }, { t: "Jobseeker: signed **Oath of Undertaking**, 6+ months residency", opt: true }],
      minors: "Bring a guardian’s **valid ID** and written consent.",
    },
    steps: {
      onsite: [
        { t: "Go to the Barangay Hall of your **actual address**." },
        { t: "Show your ID and proof of residency; state your purpose." },
        { t: "Fill out the request form (and the **Oath** if jobseeker)." },
        { t: "Pay at the treasurer’s desk — **₱0** if exempt." },
        { t: "Claim your **dry-sealed** certificate and check the spelling." },
      ],
      online: [
        { t: "Check if your LGU supports online requests.", link: L("eGovPH", "https://e.gov.ph") },
        { t: "Fill out the digital form and upload your ID and proof of residency." },
        { t: "Pay online or at the hall." },
        { t: "Download the e-clearance or claim the physical copy." },
      ],
    },
  },

  cedula: {
    purpose: "Local tax certificate often needed for clearances, affidavits and permits.",
    issuedBy: "City/Municipal Treasurer’s Office (or barangay desk)",
    minFee: 5, onsite: true, online: false,
    refs: [{ label: "QC guide — how to get a Cedula", url: "https://quezoncity.gov.ph/qcitizen-guides/how-to-get-a-community-tax-certificate-cedula-for-individual/" }, { label: "DICT eGov digital platforms", url: "https://dict.gov.ph/egov-digital-platforms" }, { label: "RA 7160 Sec. 157 — Community tax (18+ only)" }],
    req: {
      age: "**18+** only. Minors are exempt.",
      fee: "**₱5** basic + ₱1 per ₱1,000 of last year’s income (max ₱5,005)",
      prepare: [{ t: "**1 valid ID** (students: School ID or PSA Birth Cert)", ids: ["psa", "school", ...GOV] }, "Community Tax Declaration Form", { t: "**Proof of income** if you earn (BIR 2316, payslip, ITR)", opt: true }],
      minors: "Not issued to under-18s.",
    },
    steps: {
      onsite: [
        { t: "Go to the **Treasurer’s Office** or authorized barangay desk." },
        { t: "Fill out the **Community Tax Declaration Form**." },
        { t: "Submit it with your ID and proof of income." },
        { t: "Pay the assessed tax (**₱5** if no income)." },
        { t: "Sign and thumbmark the cedula — released **same day**." },
      ],
      online: [],
    },
  },

  school: {
    purpose: "Student ID from your school — often your first photo ID before any government ID.",
    issuedBy: "Your school (DepEd) or university (CHED)",
    minFee: 0, onsite: true, online: false,
    refs: [{ label: "DepEd", url: "https://www.deped.gov.ph" }, { label: "DepEd Learner Information System", url: "https://lis.deped.gov.ph" }, { label: "CHED", url: "https://ched.gov.ph" }],
    req: {
      age: "**No minimum age** — issued when you enroll.",
      fee: "**Included in tuition** · reprint **₱100–₱300**",
      prepare: ["**Certificate of Matriculation** (proof of enrollment)", "**Photo and signature** taken on campus", { t: "Lost ID? A **notarized Affidavit of Loss**", opt: true }],
      minors: "Issued directly to you as an enrolled student.",
    },
    steps: {
      onsite: [
        { t: "Enroll and get your **Certificate of Matriculation**." },
        { t: "Go to your school’s **Student Affairs Office**." },
        { t: "Fill out the ID application form." },
        { t: "Have your **photo and signature** captured." },
        { t: "Claim your ID — for a lost ID, bring the affidavit and pay the **reprint fee**." },
      ],
      online: [],
    },
  },


  philhealth: {
    purpose: "Your PhilHealth member ID — proof of membership and a supporting ID.",
    issuedBy: "Philippine Health Insurance Corporation (PhilHealth)",
    minFee: 0, onsite: true, online: true,
    refs: [{ label: "PhilHealth registration guide", url: "https://www.philhealth.gov.ph/members/informal/registration.php" }, { label: "PhilHealth Member Portal", url: "https://memberinquiry.philhealth.gov.ph/member/" }, { label: "PMRF form (PDF)", url: "https://www.philhealth.gov.ph/downloads/membership/pmrf_012020.pdf" }, { label: "RA 11223 — Universal Health Care Act" }],
    req: {
      age: "As dependent from **birth**. Own membership at **15+** (employed) or **21+**.",
      fee: "**₱0** for the PhilHealth ID",
      prepare: [{ t: "**PSA Birth Certificate** or 1 valid ID", ids: ["psa", ...GOV] }, "**2 copies** of the PMRF form", "**Two 1x1 photos**", "Know your **mother’s maiden name**"],
      minors: "Usually covered as a **dependent** of a member.",
    },
    steps: {
      onsite: [
        { t: "Go to a **PhilHealth LHIO / Express** office and get a queue number." },
        { t: "Fill out **2 copies** of the PMRF." },
        { t: "Submit the PMRF, birth certificate or ID, and photos." },
        { t: "Wait for encoding (**15–60 minutes**)." },
        { t: "Claim your **PhilHealth ID** on the spot." },
      ],
      online: [
        { t: "Open the Member Portal and choose **Member Registration**.", link: L("PhilHealth Member Portal", "https://memberinquiry.philhealth.gov.ph/member/") },
        { t: "Complete the PMRF fields and upload your documents." },
        { t: "Wait **1–5 working days** for your 12-digit **PIN** by email." },
        { t: "Claim your **PhilHealth ID** at any LHIO with your PIN, 1 valid ID and a 1x1 photo." },
      ],
    },
  },

  tin: {
    purpose: "Your tax number card — needed for jobs and many bank and ID applications.",
    issuedBy: "Bureau of Internal Revenue (BIR)",
    minFee: 0, onsite: true, online: true,
    refs: [{ label: "BIR Citizen’s Charter — TIN application", url: "https://www.bir.gov.ph/BIRCC-RDO-External-Service-02" }, { label: "BIR ORUS portal", url: "https://orus.bir.gov.ph" }, { label: "RA 8424 Sec. 275 — one TIN only" }],
    req: {
      age: "Typically **18+**. **15–17** only if employed.",
      fee: "**₱0** · lost physical card replacement **₱100**",
      prepare: [{ t: "**1 valid government ID** (or PSA Birth Cert + proof of address)", ids: ["psa", ...GOV] }, "**BIR Form 1904** (jobseeker) or **1902** (employee)", { t: "Jobseeker: **Barangay Certification**", ids: ["barangay"], opt: true }],
      minors: "Employed minors apply through their **employer** (Form 1902).",
    },
    steps: {
      onsite: [
        { t: "Find the **RDO** covering your address (or your employer’s)." },
        { t: "Fill out **2 copies** of BIR Form 1904 / 1902." },
        { t: "Submit with your ID, proof of address and a 1x1 photo." },
        { t: "Wait for verification (**30 min – 2 hours**)." },
        { t: "Get your stamped form with your **9-digit TIN**." },
      ],
      online: [
        { t: "Open ORUS → **New Registration → Individual**.", link: L("BIR ORUS", "https://orus.bir.gov.ph") },
        { t: "Verify your email, then complete **Form 1904/1902**." },
        { t: "Upload your ID and a **selfie holding it**." },
        { t: "Wait **1–3 working days** for approval." },
        { t: "Download your **Digital TIN ID** (PDF or eGovPH app)." },
      ],
    },
  },

  nbi: {
    purpose: "Proof you have no criminal record; common for jobs, travel and licensing.",
    issuedBy: "National Bureau of Investigation (NBI)",
    minFee: 0, onsite: true, online: true,
    refs: [{ label: "NBI Clearance online", url: "https://clearance.nbi.gov.ph" }, { label: "NBI first-time jobseeker portal", url: "https://firsttimejobseekers.nbi.gov.ph" }, { label: "NBI official website", url: "https://nbi.gov.ph" }, { label: "RA 11261 Sec. 4(b) — free for first-time jobseekers" }],
    req: {
      age: "**18+** standard. **15–17** for allowed purposes only.",
      fee: "**₱155** · **₱0** for adult first-time jobseekers",
      prepare: [{ either: [{ label: "I have 2 valid IDs", items: [{ t: "**2 original valid IDs**", ids: VALID2, min: 2 }] }, { label: "Student route", items: [{ t: "**PSA Birth Certificate**", ids: ["psa"] }, { t: "**School ID**", ids: ["school"] }] }] }, "**Appointment reference** + payment receipt", { t: "Jobseeker: **Barangay Certification** + Oath", ids: ["barangay"], opt: true }],
      minors: "Come with a **parent/guardian**, their ID and written consent.",
    },
    steps: {
      onsite: [
        { t: "Arrive at your chosen NBI branch **on your appointment date**." },
        { t: "Show your reference number, receipt and **2 IDs**." },
        { t: "Have your photo, fingerprints and signature captured." },
        { t: "No “hit”: released **same day**. With a “hit”: return in **5–10 working days**." },
      ],
      online: [
        { t: "Register an account and verify your mobile number.", link: L("NBI Clearance", "https://clearance.nbi.gov.ph") },
        { t: "Complete your profile and click **Apply for Clearance**." },
        { t: "Pick a branch, date and time." },
        { t: "Pay **₱155** (or choose jobseeker for **₱0**).", link: L("First-time jobseeker NBI", "https://firsttimejobseekers.nbi.gov.ph") },
        { t: "Save your **reference number** and receipt." },
      ],
    },
  },

  npc: {
    purpose: "Police clearance showing no pending record; widely required for employment.",
    issuedBy: "Philippine National Police (PNP)",
    minFee: 0, onsite: true, online: true,
    refs: [{ label: "PNP National Police Clearance System", url: "https://pnpclearance.ph" }, { label: "RA 11261 Sec. 4(a) — free for first-time jobseekers" }],
    req: {
      age: "**18+** standard. **15–17** for justified cases.",
      fee: "**₱160–₱180** · **₱0** for first-time jobseekers",
      prepare: [{ t: "**2 original valid IDs**", ids: VALID2, min: 2 }, "**NPCS appointment** + payment receipt", { t: "Jobseeker: **Barangay Certification** + Oath", ids: ["barangay"], opt: true }],
      minors: "Parent/guardian attends with **PSA Birth Cert**, School ID and consent.",
    },
    steps: {
      onsite: [
        { t: "Go to your station **15–30 minutes early** (decent attire)." },
        { t: "Show your reference number, receipt and **2 IDs**." },
        { t: "Biometrics: photo, fingerprints, signature." },
        { t: "Clean record: **same day**. With a “hit”: return in **5–15 working days**." },
      ],
      online: [
        { t: "Register and verify your email.", link: L("PNP NPCS", "https://pnpclearance.ph") },
        { t: "Complete your applicant profile." },
        { t: "Choose purpose, police station, date and time." },
        { t: "Pay **₱150 + fee** — or jobseeker for **₱0**." },
        { t: "Save your **reference number**." },
      ],
    },
  },

  comelec: {
    purpose: "Official proof you are a registered voter; accepted as an ID for passport applications.",
    issuedBy: "Commission on Elections (COMELEC)",
    minFee: 75, onsite: true, online: false,
    refs: [{ label: "COMELEC", url: "https://www.comelec.gov.ph" }, { label: "Precinct Finder", url: "https://precinctfinder.comelec.gov.ph" }, { label: "DFA consular requirements", url: "https://consular.dfa.gov.ph" }, { label: "RA 8189 — Voter’s Registration Act" }],
    req: {
      age: "**18+**. Ages 15–17 can only register for SK.",
      fee: "**₱75** · exemptions for seniors, PWDs, solo parents, jobseekers",
      prepare: [{ t: "**1 valid ID** — original **and** photocopy", ids: ["school", ...GOV] }, "Precinct / registration details", "You must be an **active registered voter**"],
      minors: "Not available for regular voter certification.",
    },
    steps: {
      onsite: [
        { t: "Check your voter status online first.", link: L("Precinct Finder", "https://precinctfinder.comelec.gov.ph") },
        { t: "Visit your local **COMELEC office** (Intramuros main office if it’s for a **passport**)." },
        { t: "Fill out the Voter’s Certification request form." },
        { t: "Pay **₱75** and keep the receipt." },
        { t: "Wait for the **dry-seal** — usually same day." },
      ],
      online: [],
    },
  },

  postal: {
    purpose: "Affordable government photo ID with fingerprint capture, widely accepted.",
    issuedBy: "Philippine Postal Corporation (PHLPost)",
    minFee: 550, onsite: true, online: true,
    refs: [{ label: "Postal ID requirements", url: "https://www.postalidph.com/requirements.html" }, { label: "Postal ID FAQs", url: "https://www.postalidph.com/faqs.html" }, { label: "PHLPost", url: "https://phlpost.gov.ph" }],
    req: {
      age: "**No minimum age**. Under 18 come with a parent/guardian.",
      fee: "**₱550** regular · **₱650** rush",
      prepare: [{ t: "**1 proof of identity** (PSA Birth Cert, School ID or Form 137)", ids: ["psa", "school"] }, { t: "**1 proof of address** (Barangay certificate or utility bill)", ids: ["barangay"] }, "**2 copies** of the application form"],
      minors: "Parent/guardian must come with you **in person**.",
    },
    steps: {
      onsite: [
        { t: "Download the form, find a capture station.", link: L("Postal ID info", "https://www.postalidph.com/requirements.html") },
        { t: "Submit **2 forms** with ID and address proof." },
        { t: "Pay **₱550** (regular) or **₱650** (rush)." },
        { t: "Photo, fingerprint and signature capture." },
        { t: "Delivery: **3–5 days** rush · **15–30 days** regular." },
      ],
      online: [
        { t: "Pre-register where available; **capture is still in person**.", link: L("PHLPost", "https://phlpost.gov.ph") },
        { t: "Visit the station for biometrics and payment." },
      ],
    },
  },

  philsys: {
    purpose: "The national ID — one free, accepted-everywhere proof of identity.",
    issuedBy: "Philippine Statistics Authority (PhilSys)",
    minFee: 0, onsite: true, online: false,
    refs: [{ label: "PhilSys — supporting documents", url: "https://philsys.gov.ph/supporting-documents/" }, { label: "PhilSys FAQs", url: "https://philsys.gov.ph/faq-frequently-asked-questions/" }, { label: "National ID digital (eGovPH)", url: "https://national-id.gov.ph" }, { label: "RA 11055 — Philippine Identification System Act" }],
    req: {
      age: "From **birth**. Recapture at ages **5** and **15**. Apply alone at **18+**.",
      fee: "**₱0**",
      prepare: [{ either: [{ label: "I have 1 primary ID", items: [{ t: "**1 primary ID** — Passport, UMID or LTO license", ids: ["passport", "mysss", "lto"] }] }, { label: "I have 2 secondary documents", items: [{ t: "**PSA Birth Certificate** (with BReN)", ids: ["psa"] }, { t: "**1 supporting document** — School ID, Barangay clearance, PhilHealth, TIN, NBI/Police or Postal ID", ids: ["school", "barangay", "philhealth", "tin", "nbi", "npc", "postal"] }] }] }],
      minors: "Bring a **parent/guardian** and their valid ID.",
    },
    steps: {
      onsite: [
        { t: "Find an open **PhilSys registration center**.", link: L("Supporting documents", "https://philsys.gov.ph/supporting-documents/") },
        { t: "Present your documents for screening." },
        { t: "Check your encoded details **carefully**." },
        { t: "Biometrics: photo, 10 fingerprints, iris scan." },
        { t: "Keep your **TRN slip** to claim your ID." },
      ],
      online: [],
    },
  },

  passport: {
    purpose: "Travel document and the strongest proof of identity abroad and at home.",
    issuedBy: "Department of Foreign Affairs (DFA)",
    minFee: 1000, onsite: true, online: true,
    refs: [{ label: "DFA passport appointment", url: "https://www.passport.gov.ph" }, { label: "DFA consular requirements", url: "https://consular.dfa.gov.ph" }, { label: "RA 11983 and RA 10928 — passport laws" }],
    req: {
      age: "From **birth**. Apply alone at **18+**. Validity: **10 years** adult, **5** minor.",
      fee: "**₱1,000** regular · **₱1,250** expedited",
      prepare: [{ t: "**PSA Birth Certificate** (security paper)", ids: ["psa"] }, { t: "**1 DFA-accepted primary ID** — original + photocopy", ids: ["philsys", "lto", "mysss", "prc", "postal", "comelec"] }, "**Printed appointment packet**"],
      minors: "Appear with a parent; bring **PSA Birth Cert** and the adult’s documents.",
    },
    steps: {
      onsite: [
        { t: "Arrive **30 minutes early** with your printed packet." },
        { t: "Submit documents at the verification counter." },
        { t: "Check encoded details, then biometrics." },
        { t: "Keep your receipt and **pick-up date**." },
        { t: "Claim in **5–12 working days**." },
      ],
      online: [
        { t: "Book on the **official DFA site only**.", link: L("DFA appointment", "https://www.passport.gov.ph") },
        { t: "Fill out the form exactly as on your **PSA Birth Cert**." },
        { t: "Pay within **24 hours** (GCash, Maya, card, bank)." },
        { t: "Download and print your application packet." },
      ],
    },
  },

  mysss: {
    purpose: "SSS membership card that doubles as a bank-linked payment card.",
    issuedBy: "Social Security System (SSS) with partner banks",
    minFee: 200, onsite: false, online: true,
    refs: [{ label: "MySSS Card (SSS)", url: "https://www.sss.gov.ph/mysss-card/" }, { label: "My.SSS member portal", url: "https://member.sss.gov.ph" }, { label: "RCBC DiskarTech — MySSS Card", url: "https://diskartech.ph/mysss-card-powered-by-rcbc-diskartech/" }, { label: "RA 11199 — Social Security Act of 2018" }],
    req: {
      age: "**18+** for the card. SSS membership can start at 15 if employed.",
      fee: "**₱0** SSS + about **₱200** partner-bank card",
      prepare: [{ t: "**PhilSys National ID** registration", ids: ["philsys"] }, "Permanent **SS number** + 1 posted contribution", "Active **My.SSS account** and a smartphone"],
      minors: "Not available. Employed minors get an SS number only.",
    },
    steps: {
      onsite: [],
      online: [
        { t: "Log in to My.SSS → **MySSS Card**.", link: L("My.SSS", "https://member.sss.gov.ph") },
        { t: "Check your details, then do the **facial scan**." },
        { t: "Pick a partner bank and save your **TRN**." },
        { t: "Finish the bank’s app KYC and cash in **₱200**." },
        { t: "Card arrives in **7–15 working days**.", link: L("MySSS Card info", "https://www.sss.gov.ph/mysss-card/") },
      ],
    },
  },

  lto: {
    purpose: "Government driver’s license — also a strong primary ID.",
    issuedBy: "Land Transportation Office (LTO)",
    minFee: 1000, onsite: true, online: true,
    refs: [{ label: "LTO", url: "https://lto.gov.ph" }, { label: "LTO LTMS portal", url: "https://portal.lto.gov.ph" }, { label: "RA 10930 — driver’s license validity" }, { label: "LTO MC 2021-2293 — student permit and driving courses" }],
    req: {
      age: "**17+** (Filipino). Student Permit from **16**.",
      fee: "LTO **₱685** + medical + driving course; about **₱1,000–₱7,500**",
      prepare: ["**Student Permit** held **30+ days**", "**8-hour PDC** certificate + **LTO medical**", { t: "**PSA Birth Cert** or valid ID (+ TIN if employed)", ids: ["psa", ...GOV] }],
      minors: "At 17 you need **guardian consent** and ID.",
    },
    steps: {
      onsite: [
        { t: "Bring originals and your LTMS appointment printout." },
        { t: "Submit documents and pay the **₱100** application fee." },
        { t: "Photo, signature and fingerprints." },
        { t: "Pass the **written exam** (48/60) and **driving test** (80/100)." },
        { t: "Pay the license fee and claim your card **same day**." },
      ],
      online: [
        { t: "Finish the PDC and medical first." },
        { t: "Register on LTMS, then **Licensing → New (Non-Pro)**.", link: L("LTMS portal", "https://portal.lto.gov.ph") },
        { t: "Verify your certificates and book a date." },
      ],
    },
  },

  pagibig: {
    purpose: "Pag-IBIG membership card that works as a bank-linked payment card.",
    issuedBy: "Pag-IBIG Fund with UnionBank / AUB",
    minFee: 125, onsite: true, online: false,
    refs: [{ label: "Pag-IBIG Fund", url: "https://www.pagibigfund.gov.ph" }, { label: "Virtual Pag-IBIG", url: "https://www.pagibigfundservices.com/virtualpagibig/" }, { label: "UnionBank — Loyalty Card Plus", url: "https://www.unionbankph.com/PagIBIGLoyaltyCardPlus" }, { label: "AUB — Hello Pag-IBIG FAQs", url: "https://www.aub.com.ph/hellopagibig/faqs" }, { label: "RA 9679 — Home Development Mutual Fund Law" }],
    req: {
      age: "**18+**; you must appear in person.",
      fee: "**₱125** card fee",
      prepare: ["**Active MID** + at least 1 contribution", "**Loyalty Card Plus form** (HQP-PFF-108)", { t: "**1 primary ID** — original + photocopy", ids: GOV }],
      minors: "Not available until **18**.",
    },
    steps: {
      onsite: [
        { t: "Check your MID and contributions first.", link: L("Virtual Pag-IBIG", "https://www.pagibigfundservices.com/virtualpagibig/") },
        { t: "Visit a branch with a **loyalty card kiosk**; get a number." },
        { t: "Submit the form and ID for validation." },
        { t: "At the kiosk: photo, signature, fingerprint; pay **₱125**." },
        { t: "Claim your card **same day** and activate it in the bank app." },
      ],
      online: [],
    },
  },

  prc: {
    purpose: "Professional ID for licensed professionals, issued after the board exam.",
    issuedBy: "Professional Regulation Commission (PRC)",
    minFee: 900, onsite: true, online: true,
    refs: [{ label: "PRC LERIS online", url: "https://online.prc.gov.ph" }, { label: "PRC", url: "https://www.prc.gov.ph" }, { label: "RA 8981 — PRC Modernization Act" }, { label: "RA 10912 — CPD Act" }],
    req: {
      age: "Usually **18 or 21**, after the required degree and **board exam**.",
      fee: "**₱1,050** (bachelor’s) · **₱900** (non-bachelor’s) for 3 years",
      prepare: ["**Oath form** + Notice of Admission / rating", "**2 photos (2x2)** with name tag", "**2 sets** of documentary stamps", { t: "**1 valid ID** (Cedula if your region asks)", ids: ["school", ...GOV] }],
      minors: "Not available. **Personal appearance** required for first registration.",
    },
    steps: {
      onsite: [
        { t: "Go to your scheduled **PRC office** with printed forms." },
        { t: "Submit documents; sign the **Registry Book**." },
        { t: "Claim your PIC and certificate (**same day** or on the stub date)." },
      ],
      online: [
        { t: "Create your **LERIS** account; photo must match your records.", link: L("PRC LERIS", "https://online.prc.gov.ph") },
        { t: "Attend your **oath-taking** (e-oath or in person)." },
        { t: "Book **Initial Registration** and pick an office and date." },
        { t: "Pay online, then print your oath form and slip." },
      ],
    },
  },

  pwd: {
    purpose: "National ID for persons with disability, unlocking discounts and benefits.",
    issuedBy: "LGU PDAO / Social Welfare Office (DOH–NCDA registry)",
    minFee: 0, onsite: true, online: false,
    refs: [{ label: "NCDA", url: "https://ncda.gov.ph" }, { label: "DOH PWD registry", url: "https://pwd.doh.gov.ph" }, { label: "RA 7277, RA 9442 and RA 10754 — PWD laws" }],
    req: {
      age: "**Any age** with a qualifying permanent disability.",
      fee: "**₱0** (public hospital certificates are free)",
      prepare: ["**Medical certificate** or clinical abstract", { t: "**PSA Birth Cert** or valid ID", ids: ["psa", ...GOV] }, { t: "**Barangay Certificate**", ids: ["barangay"] }, "**2 photos**", "DOH–NCDA PRPWD application form"],
      minors: "Parent, guardian or social worker applies for you.",
    },
    steps: {
      onsite: [
        { t: "Get a **medical certificate** and a **Barangay Certificate**." },
        { t: "Go to your **PDAO** or social welfare office." },
        { t: "Fill out the **PRPWD form** and submit requirements." },
        { t: "Verification, signature and photo capture." },
        { t: "Claim your ID and booklets (**same day – 5 days**)." },
      ],
      online: [],
    },
  },

  soloparent: {
    purpose: "ID granting solo parents statutory benefits and discounts.",
    issuedBy: "LGU Solo Parents Office / CSWDO / MSWDO",
    minFee: 0, onsite: true, online: false,
    refs: [{ label: "DSWD", url: "https://www.dswd.gov.ph" }, { label: "RA 11861 — Expanded Solo Parents Welfare Act" }, { label: "DOLE DO 239-2023 — 7-day parental leave" }],
    req: {
      age: "No minimum for **biological** parents; others **18+**.",
      fee: "**₱0** card · notarization **₱100–₱300** (free via PAO)",
      prepare: [{ t: "Child’s **PSA Birth Certificate**", ids: ["psa"] }, { t: "**Barangay Certification** (6 months)", ids: ["barangay"] }, "**Sworn affidavit** (notarized)", "Income proof + **category proof** (death cert, CENOMAR, etc.)"],
      minors: "A guardian or **DSWD social worker** co-signs.",
    },
    steps: {
      onsite: [
        { t: "Get your **Barangay Certification** and notarized **affidavit**." },
        { t: "Prepare the child’s birth certificate and **category proof**." },
        { t: "Submit everything to the **Solo Parents Office**." },
        { t: "Case assessment interview with a social worker." },
        { t: "Attend the orientation, then claim your **SPIC** (7–30 days)." },
      ],
      online: [],
    },
  },

  owwa: {
    purpose: "Membership ID for overseas workers with OWWA benefits and assistance.",
    issuedBy: "Overseas Workers Welfare Administration (OWWA)",
    minFee: 0, onsite: false, online: true,
    refs: [{ label: "OWWA", url: "https://owwa.gov.ph" }, { label: "OWWA e-Card portal", url: "https://ecard.owwa.gov.ph" }, { label: "DMW", url: "https://www.dmw.gov.ph" }, { label: "DMW online services", url: "https://onlineservices.dmw.gov.ph" }, { label: "RA 10801 — OWWA Act" }],
    req: {
      age: "**18+** (land/sea-based). **23+** for domestic workers.",
      fee: "**₱0** card · membership about **US$25** per contract",
      prepare: [{ t: "**Valid Philippine Passport** (6+ months)", ids: ["passport"] }, "**Active OWWA membership**", "**Contract, visa or OEC** record", "Active **email and mobile number**"],
      minors: "Not available to under-18s.",
    },
    steps: {
      onsite: [],
      online: [
        { t: "Make sure your **OWWA membership** is active." },
        { t: "Create an account in the OWWA mobile app with your **passport details**." },
        { t: "Open your digital **OWWA e-Card**." },
        { t: "Want the physical card? Request pick-up on the e-Card portal.", link: L("OWWA e-Card portal", "https://ecard.owwa.gov.ph") },
        { t: "Claim it with your **passport** and confirmation slip." },
      ],
    },
  },


  senior: {
    purpose: "Senior citizen ID for statutory discounts and purchase booklets.",
    issuedBy: "City/Municipal OSCA (Office for Senior Citizens Affairs)",
    minFee: 0, onsite: true, online: false,
    refs: [{ label: "National Commission of Senior Citizens", url: "https://www.ncsc.gov.ph" }, { label: "RA 9994 — Expanded Senior Citizens Act" }, { label: "RA 11350 — NCSC Act" }],
    req: {
      age: "**60+** (some LGUs pre-register shortly before 60).",
      fee: "**₱0**",
      prepare: [{ t: "**Proof of age** — PSA Birth Cert, Passport, National ID, etc.", ids: ["psa", "passport", "philsys", "lto", "mysss", "comelec"] }, { t: "**Barangay Residency Certificate** (6+ months)", ids: ["barangay"] }, "**2–3 photos** (1x1 or 2x2)"],
      minors: "Not available. Under-60s are ineligible.",
    },
    steps: {
      onsite: [
        { t: "Get a **Barangay Certificate of Residency**." },
        { t: "Go to your **OSCA** and ask for the application form." },
        { t: "Submit form, proof of age, residency and photos." },
        { t: "Sign / thumbmark; some LGUs capture biometrics." },
        { t: "Claim your ID and **purchase booklets** (same day – 3 days)." },
      ],
      online: [],
    },
  },
};
