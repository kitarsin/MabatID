/** Additional documents can be held without being acquisition targets on the tree. */
export const EXTRA_DOCUMENTS = [
  { id: "lcro-birth", name: "Local Civil Registry Birth Certificate" },
  { id: "company-id", name: "Current Company ID" },
  { id: "lease-contract", name: "Lease or rental contract" },
  {
    id: "voter-record",
    name: "Voter registration record showing local address",
  },
  { id: "umid", name: "UMID card (distinct from MySSS Card)" },
  { id: "utility-bill", name: "Utility bill accepted as proof of address" },
  { id: "form137", name: "School Form 137" },
  { id: "child:psa", name: "Child's PSA Birth Certificate" },
  {
    id: "jobseeker:barangay",
    name: "Barangay First-Time Jobseeker Certification",
  },
] as const;

export const documentName = (id: string) =>
  EXTRA_DOCUMENTS.find((d) => d.id === id)?.name;
