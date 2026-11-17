# MabatID

A Next.js app for exploring Philippine ID requirements and tracking applications.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Next.js. Validation:

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Current scope

The app supports device profiles, document ownership, eligibility answers, acquisition planning, target tracking, requirements checklists and application progress. Any ID can be tracked before its prerequisites are ready. Ownership can be recorded independently of the acquisition procedure.

Device profiles are **not authenticated accounts**. They use browser localStorage, are accessible to anyone using that browser, and do not sync. No passwords or email addresses are collected. Real server authentication and persistence are part of the backend integration.

On first load, v1 mock accounts migrate to credential-free profiles. Names, ages, documents and goals are retained. Password hashes and email addresses are removed from browser storage after the replacement is saved. Positional v1 checklist ticks are reset because their meaning changed; migrated profiles show a review notice.

## Rules and progress

- `src/data/cards.ts` contains presentation metadata and illustrative overview parents, not prerequisite rules.
- `src/data/details.ts` contains the shared requirement and procedure definitions. Requirement, route and step IDs are authored stable identifiers; never generate them from text or array indices.
- `src/data/documents.ts` defines supplementary documents. `child:psa` is separate from the applicant's certificate; UMID is separate from MySSS Card.
- `src/data/facts.ts` defines self-reported facts. Missing answers mean unknown, not false.
- `src/lib/eligibility.ts` evaluates age and modeled eligibility conditions.
- `src/lib/prepare.ts` evaluates requirements, active application routes, step dependencies and progress. The tree, detail sheet and progress views consume this shared evaluation.
- `src/lib/tree.ts` derives document relationships from requirements. The overview shows a subset; selecting an ID shows its direct document relationships. These links are not a computed acquisition plan.
- `src/lib/planner/catalog.ts` adapts the same structured requirements and effective checklist state for the planner. Tier, visual parents, and browsing filters never determine eligibility or dependencies.

AND applies across required checklist entries; OR groups require one entire route; `min` counts distinct selected documents. Conditional requirements are omitted only after their condition is known to be false. Document ownership does not automatically attest photocopies, remaining validity periods, or combined supporting evidence when a confirmation is required.

Budget filters compare the upper end of modeled fee ranges and do not assume conditional waivers or confirm payment. Route-specific estimates and conditional replacement/income fees are used where modeled. Unknown conditions retain the full estimated range. A preference for online applications never removes a required visit or blocks viewing a guide.

Hybrid procedures require online preparation followed by the in-person phase. Alternative procedures count only the explicitly selected route. Preliminary booking steps can start before requirements are complete; designated submission steps require preparation. Later steps depend on preceding steps. Undoing an upstream step clears its downstream completion on the active procedure. Progress reaches 100% only after the user confirms ownership.

## Acquisition planner and API

Keep the planner in this repository while the website is its only consumer. `src/lib/planner/engine.ts` is framework-independent TypeScript with serializable contracts in `types.ts`. The catalog adapter, Next.js transport, and client UI are separate; the engine can become a shared package or service later without duplicating requirement rules now.

Opening a target guide requests a plan from `POST /api/plans/preview`. The plan uses backward chaining with depth-first traversal, AND/OR and distinct-document threshold evaluation, branch comparison across complete candidate plans, stack-based cycle detection, and Kahn's topological sorting. Shared prerequisite acquisitions and their modeled fees count once. A circular alternative is rejected individually, allowing an acyclic route to succeed.

The preview ranks confirmed eligibility, fewer unanswered conditions, and better per-item budget fit first. The selected objective then prioritizes fewer acquisitions or lower modeled maximum fees. Application preference breaks remaining ties; required visits are retained. Explicitly saved application modes constrain those routes. Unknown conditions and outside documents remain questions; they never become assumed eligibility or automatic ownership. Existing-only IDs without supported issuance guidance are not invented as acquisition steps.

Search is bounded to 18,000 exploration operations and a frontier of 48 candidates, returning up to three nonredundant alternatives. Any operation or frontier truncation sets `search.complete` to false and the UI discloses the limited search. Rankings are best among explored candidates, not a guarantee of global optimality. If no complete candidate survives an exhausted search, status is `incomplete`, not `blocked`. `planned` means a dependency path was found; ordinary missing preparation still appears in its checklist.

Example request:

```json
{
  "targetId": "passport",
  "owned": ["psa", "school"],
  "age": 20,
  "facts": { "enrolled": true, "waiverRequested": false },
  "objective": "fewest-documents"
}
```

Optional request fields are `documents` (date/format evidence only), `prep` (stable checklist keys), `modes`, `budget`, and `setup`. The API validates known catalog IDs, facts, checklist keys, modes, and scalar values; rejects unknown fields; accepts only JSON up to 64 KiB; and returns `Cache-Control: no-store`. Invalid input returns 400, oversized input 413, and unsupported media types 415. Callers cannot override the server date, catalog version, or search limits. The response includes ordered steps, prerequisite edges, chosen branches, eligibility/requirement states, procedure phases, fee estimates, questions, and diagnostics.

The client debounces changes and cancels stale requests. Users can compare alternatives, expand requirements and procedures, and open any prerequisite guide. **Start with …** applies the chosen application modes, tracks the final goal for a device profile, and opens the first guide. Requirement alternatives remain suggestions; they are not stored as a frozen plan. Recommendations are recalculated as documents and answers change. Starting a path never marks a document as owned or ticks a preparation task.

The endpoint is stateless and does not save profiles. It receives only the allowlisted planning fields, without names, ID numbers, document scans, email addresses, or credentials. Authentication, durable plans, and cross-device progress still need a server persistence layer.

## ID and document filters

Every catalog entry has an explicit `kind` (`id` or `document`), independent of its tier and significance category. Identity cards and passports are IDs; birth certificates, Barangay Clearance, Cedula, NBI/Police Clearance and Voter’s Certification are documents. This is a browsing classification, not a guarantee of agency acceptance.

The tree and Browse views share **All types / IDs only / Documents only**. Type combines with the existing filters; the tree's active count and Clear action include it. Browse search and category filters also respect the selected type. Nonmatching tree nodes are dimmed so document prerequisites remain available for context. Type badges and detail labels identify each item, and mixed totals use “items”.

## Barangay ID starter card

Barangay ID (`barangay-id`) is the first Tier 1 card, separate from Barangay Clearance (`barangay`). School ID is also Tier 1; Tier 0 keeps baseline paper documents. The overview begins at Barangay ID for a user with no selected documents.

The card includes local eligibility/residency confirmation, adult-only conditional Cedula, printed-photo versus live-capture requirements, guardian paperwork, replacement evidence, and explicitly confirmed local waivers. An online route requires confirmation that the applicant’s own barangay offers it; no citywide availability, same-day release or fee exemption is assumed.

`src/lib/documents.ts` and `BarangayIdFields` store only issue/expiry dates and self-reported format checks. Selecting ownership does not establish current validity. Cards without a printed expiry remain **Needs confirmation** until an issue date and local validity confirmation are recorded. No one-, two- or three-year expiry is invented. Expired cards cannot auto-satisfy document requirements.

Verified acceptance is scoped: PSAHelpline’s online delivery ID requires photo and signature; PhilSys has an alternative Barangay ID route requiring its specified card details; Postal ID accepts Barangay Residency ID as address evidence, with identity and copies still separate. Barangay ID is not added to the DFA passport ID list. Bank/e-wallet acceptance remains provider-specific.

Source references are embedded in the card: [PSAHelpline delivery IDs](https://psahelpline.ph/faq/Delivery), [PSA PhilSys Charter](https://rsso05.psa.gov.ph/system/files/documents/2024%20CC%20-%20PhilSys_Updated%20with%20Brief%20Description%20%281%29.pdf), [Postal ID requirements](https://www.postalidph.com/requirements.html), [RA 7160](https://www.lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html), [RA 11261](https://www.lawphil.net/statutes/repacts/ra2019/ra_11261_2019.html), and [BSP Circular 950](https://www.bsp.gov.ph/Regulations/Issuances/2017/c950.pdf). Locally varying fees and release/validity periods are guidance estimates from the supplied research, pending the applicant’s barangay charter.

## Before production

The research catalog is provisional. References are included, but fees, eligibility, document acceptance, local variations, and all procedures still need an authoritative review and versioned source records. Passing software tests establishes consistent behavior, not government acceptance.

Server authentication and a persistent database remain future backend work. Before exposing the preview endpoint publicly, add deployment-level rate limits and resource monitoring; its per-request search and body limits do not limit request volume.
