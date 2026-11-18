/** Self-reported answers. Absence means unknown, never false. */
export const FACTS = {
  enrolled: "Are you currently enrolled in a school or university?",
  employed: "Are you currently employed?",
  philhealthEligible:
    "Has PhilHealth confirmed you can register as a member in your own right?",
  minorPurpose:
    "Has the issuing office confirmed this application is allowed for your age and purpose?",
  guardian:
    "Will a parent or legal guardian assist with this application and provide their documents?",
  activeVoter: "Are you an active registered voter?",
  sssEligible:
    "Do you have a permanent SS number, a posted contribution and an active My.SSS account?",
  pagibigEligible:
    "Do you have an active Pag-IBIG MID and the required contribution?",
  prcEligible:
    "Have you met PRC's education, examination and initial-registration conditions?",
  pwdEligible:
    "Has the relevant office confirmed you meet the disability eligibility conditions?",
  soloParentEligible:
    "Has your local social welfare office confirmed you qualify as a solo parent?",
  owwaEligible:
    "Are you an eligible overseas worker with active OWWA membership?",
  domesticWorker: "Is this OWWA application for domestic work?",
  needsCedula: "Has your barangay asked you to bring a Cedula?",
  waiverRequested: "Are you requesting a first-time jobseeker fee waiver?",
  jobseekerApplication: "Are you applying for a TIN as a first-time jobseeker?",
  replacement: "Are you replacing a lost School ID?",
  barangayIdEligible:
    "Has your barangay confirmed it issues a physical Barangay ID to applicants of your age and verified your residency under its local rules?",
  barangayIdOnlineAvailable:
    "Has your barangay confirmed an official online Barangay ID application service is available?",
  barangayIdNeedsCedula:
    "Does your barangay require a current-year Cedula from adult Barangay ID applicants?",
  barangayIdLiveCapture:
    "Will the barangay take your ID photo on site instead of requiring printed photos?",
  barangayIdReplacement: "Are you replacing a lost or damaged Barangay ID?",
  barangayIdFeeWaived:
    "Has the barangay explicitly confirmed a free card or fee waiver for this Barangay ID application?",
} as const;

export type FactId = keyof typeof FACTS;
export type ProfileFacts = Partial<Record<FactId, boolean>>;
export type Condition =
  | { fact: FactId }
  | { underAge: number }
  | { all: Condition[] }
  | { not: Condition };

export function conditionFacts(
  condition: Condition,
  age?: number | null,
): FactId[] {
  if (conditionValue(condition, {}, age) === false) return [];
  if ("fact" in condition) return [condition.fact];
  if ("all" in condition)
    return condition.all.flatMap((part) => conditionFacts(part, age));
  if ("not" in condition) return conditionFacts(condition.not, age);
  return [];
}

export function conditionValue(
  condition: Condition,
  facts: ProfileFacts,
  age?: number | null,
): boolean | undefined {
  if ("fact" in condition) return facts[condition.fact];
  if ("not" in condition) {
    const value = conditionValue(condition.not, facts, age);
    return value === undefined ? undefined : !value;
  }
  if ("all" in condition) {
    const values = condition.all.map((part) =>
      conditionValue(part, facts, age),
    );
    return values.includes(false)
      ? false
      : values.includes(undefined)
        ? undefined
        : true;
  }
  return age == null ? undefined : age < condition.underAge;
}
