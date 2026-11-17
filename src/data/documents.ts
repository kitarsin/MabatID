import type { CardKind, CredentialGroup } from "./cards";

export interface InventoryDocument {
  id: string;
  name: string;
  kind: CardKind;
  group: CredentialGroup;
  groupReason: string;
}

/** Classified inventory evidence; these items have no acquisition guide on the tree. */
export const EXTRA_DOCUMENTS = [
  {
    id: "lcro-birth",
    name: "Local Civil Registry Birth Certificate",
    kind: "document",
    group: "foundation",
    groupReason:
      "A foundational civil record. Whether it can replace a PSA copy depends on the receiving agency.",
  },
  {
    id: "company-id",
    name: "Current Company ID",
    kind: "id",
    group: "supporting",
    groupReason:
      "An employer-issued supporting ID. Acceptance depends on the issuer and receiving office.",
  },
  {
    id: "lease-contract",
    name: "Lease or rental contract",
    kind: "document",
    group: "foundation",
    groupReason:
      "Supporting address evidence, with certification or notarization where required.",
  },
  {
    id: "voter-record",
    name: "Voter registration record showing local address",
    kind: "document",
    group: "foundation",
    groupReason:
      "Supporting address or registration evidence; it is distinct from a COMELEC Voter's Certification.",
  },
  {
    id: "umid",
    name: "UMID card (distinct from MySSS Card)",
    kind: "id",
    group: "identity",
    groupReason:
      "A widely accepted legacy identity card for existing holders. It is separate from MySSS Card and has no new-application guide here.",
  },
  {
    id: "utility-bill",
    name: "Utility bill accepted as proof of address",
    kind: "document",
    group: "foundation",
    groupReason:
      "Supporting address evidence. Check the required name, address and billing date.",
  },
  {
    id: "form137",
    name: "School Form 137",
    kind: "document",
    group: "foundation",
    groupReason:
      "An academic permanent record supporting specified applications; it is not a School ID.",
  },
  {
    id: "child:psa",
    name: "Child's PSA Birth Certificate",
    kind: "document",
    group: "foundation",
    groupReason:
      "A foundational civil record belonging to the child. It does not replace the applicant's own birth certificate.",
  },
  {
    id: "jobseeker:barangay",
    name: "Barangay First-Time Jobseeker Certification",
    kind: "document",
    group: "foundation",
    groupReason:
      "Supporting proof for applicable first-time-jobseeker fee waivers; it is separate from a Barangay ID or general clearance.",
  },
] as const satisfies readonly InventoryDocument[];

export const documentName = (id: string) =>
  EXTRA_DOCUMENTS.find((d) => d.id === id)?.name;
