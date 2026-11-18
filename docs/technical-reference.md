# MabatID technical reference

[← Back to the README](../README.md)

Implementation details for the catalog, planning engine, profile storage, backup and restore, device transfers, and community feedback. For the product overview and usage guide, see the [README](../README.md). These engineering notes are intended for the project team.

## Team development and deployment

## Getting started

### Prerequisites

- **Node.js 20.9 or newer** and npm.
- A modern browser with Web Crypto and Web Locks support. Use localhost or HTTPS for saved-profile features.
- Project environment variables; see [Environment configuration](#environment-configuration).

### Run locally

```sh
git clone https://github.com/sagembng/MabatID.git
cd MabatID
npm ci
npm run dev
```

Open the URL printed in your terminal.

### Environment configuration

Copy the environment template and fill in the project values:

```sh
cp .env.example .env.local
```

Keep secret keys private and out of version control. Restart the development server after updating environment variables. Database setup and verification are documented in the [technical reference](#server-and-database-setup).

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm test` | Run the automated test suite. |
| `npm run lint` | Run ESLint. |
| `npx tsc --noEmit` | Check TypeScript types. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build. |

Tests cover requirement rules, planning, filters, graph layout, profile migrations, backup and restore, transfers, likes and feedback. Database tests start disposable local PostgreSQL clusters when `initdb`, `pg_ctl` and `psql` are available under a non-root user; otherwise those tests are skipped. They do not use a hosted database.

For production, run `npm run build` followed by `npm start`, or deploy to a platform that supports the Next.js Node.js runtime. Add the server environment variables to the deployment platform. API routes require a server runtime, so a static-only export does not provide the full app.

## Project structure

```text
MabatID/
├── docs/                    Detailed engineering and setup reference
├── public/renders/          Illustrative ID and document assets
├── scripts/                 Verification utilities
├── src/
│   ├── app/                 Root layout, metadata, styles and API routes
│   ├── components/          Screens, graph, guides and shared UI
│   ├── data/                Catalog, requirements, facts and guide content
│   └── lib/                 Planner, profile storage, backups and server logic
├── supabase/                Database migrations, cleanup and verification SQL
├── tests/                   Unit, API and PostgreSQL integration tests
└── .env.example             Server configuration template
```

See the [technical reference](#rules-and-progress) for the planner's contracts, catalog conventions, backup format, conflict handling and backend setup.

## Current scope

The app supports device profiles, document ownership, eligibility answers, acquisition planning, target tracking, requirements checklists and application progress. Any ID can be tracked before its prerequisites are ready. Ownership can be recorded independently of the acquisition procedure.

Device profiles are **not authenticated accounts**. They use browser localStorage, are accessible to anyone using that browser, and do not sync. No passwords or email addresses are collected. Manual JSON backup and restore moves saved profiles between devices without an account or storage service.

On first load, v1 mock accounts migrate to credential-free profiles. Names, ages, documents and goals are retained. Password hashes and email addresses are removed from browser storage after the replacement is saved. Positional v1 checklist ticks are reset because their meaning changed; migrated profiles show a review notice.

## Rules and progress

- `src/data/cards.ts` contains presentation metadata and illustrative overview parents, not prerequisite rules.
- `src/data/details.ts` contains the shared requirement and procedure definitions. Requirement, route and step IDs are authored stable identifiers; never generate them from text or array indices.
- `src/data/documents.ts` defines supplementary documents. `child:psa` is separate from the applicant's certificate; UMID is separate from MySSS Card.
- `src/data/facts.ts` defines self-reported facts. Missing answers mean unknown, not false.
- `src/lib/eligibility.ts` evaluates age and modeled eligibility conditions.
- `src/lib/prepare.ts` evaluates requirements, active application routes, step dependencies and progress. The tree, detail sheet and progress views consume this shared evaluation.
- `src/lib/tree.ts` derives document relationships from requirements. The overview shows illustrative connections. Selecting a goal highlights only the evidence and acquisitions in the chosen computed plan; other targets remain available on the canvas.
- `src/lib/planner/catalog.ts` adapts the same structured requirements and effective checklist state for the planner. Credential groups, visual parents, and browsing filters never determine eligibility or dependencies.

AND applies across required checklist entries; OR groups require one entire route; `min` counts distinct selected documents. Conditional requirements are omitted only after their condition is known to be false. Document ownership does not automatically attest photocopies, remaining validity periods, or combined supporting evidence when a confirmation is required.

Budget filters compare the upper end of modeled fee ranges and do not assume conditional waivers or confirm payment. Route-specific estimates and conditional replacement/income fees are used where modeled. Unknown conditions retain the full estimated range. A preference for online applications never removes a required visit or blocks viewing a guide.

Hybrid procedures require online preparation followed by the in-person phase. Alternative procedures count only the explicitly selected route. Preliminary booking steps can start before requirements are complete; designated submission steps require preparation. Later steps depend on preceding steps. Undoing an upstream step clears its downstream completion on the active procedure. Progress reaches 100% only after the user confirms ownership.

## Acquisition planner and API

Keep the planner in this repository while the website is its only consumer. `src/lib/planner/engine.ts` is framework-independent TypeScript with serializable contracts in `types.ts`. The catalog adapter, Next.js transport, and client UI are separate; the engine can become a shared package or service later without duplicating requirement rules now.

The tree and guide share one debounced response from `POST /api/plans/tree`. Without a target, this returns personalized suggestions and assessments for all 21 guided targets. With `targetId`, it also returns full alternatives for that goal. `POST /api/plans/preview` remains available for a single-goal result. The plan uses backward chaining with depth-first traversal, AND/OR and distinct-document threshold evaluation, branch comparison across complete candidate plans, stack-based cycle detection, and Kahn's topological sorting. Shared prerequisite acquisitions and their modeled fees count once. A circular alternative is rejected individually, allowing an acyclic route to succeed.

The preview ranks confirmed eligibility, fewer unanswered conditions, and better per-item budget fit first. The selected objective then prioritizes fewer acquisitions or lower modeled maximum fees. Application preference breaks remaining ties; required visits are retained. Explicitly saved application modes constrain those routes. Unknown conditions and outside documents remain questions; they never become assumed eligibility or automatic ownership. Existing-only IDs without supported issuance guidance are not invented as acquisition steps.

Selected-goal search is bounded to 18,000 exploration operations and a frontier of 48 candidates, returning up to three nonredundant alternatives. Other targets use 6,000 operations, a frontier of 24, and one result each. A small initial pass seeks a feasible complete path before alternative exploration; this preserves a valid candidate if later search exhausts its budget. Any operation or frontier truncation sets `search.complete` to false and the UI discloses the limited search. Rankings are best among explored candidates, not a guarantee of global optimality. If no complete candidate survives an exhausted search, status is `incomplete`, not `blocked`. `planned` means a dependency path was found; ordinary missing preparation still appears in its checklist.

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

Both endpoints are stateless and do not save profiles. They receive only the allowlisted planning fields, without names, ID numbers, document scans, email addresses, or credentials. Manual JSON backups move saved progress between devices; these endpoints provide neither profile storage nor synchronization.

## ID and document filters

Every catalog entry has an explicit `kind` (`id` or `document`), independent of its credential group and significance category. Identity cards and passports are IDs; birth certificates, Barangay Clearance, Cedula, NBI/Police Clearance and Voter’s Certification are documents. This is a browsing classification, not a guarantee of agency acceptance.

The tree and Browse views share **All types / IDs only / Documents only**. Type combines with the existing filters; the tree's active count and Clear action include it. Browse search and category filters also respect the selected type. Nonmatching tree nodes are dimmed so document prerequisites remain available for context. Type badges and detail labels identify each item, and mixed totals use “items”.

## Skill tree and credential groups

The interactive skill tree remains the main interface: circular nodes, branches, pan/zoom, and tap-to-open guides. It has no numbered levels or fixed difficulty rows. Overview connections are illustrative, not a list of mandatory prerequisites. A selected goal focuses the computed route, marks existing evidence, and labels multiple required inputs with **AND**. Switching alternatives in either the guide or the tree updates both. Supplementary inventory evidence appears in a path when used, without inventing an acquisition guide for it.

**Suggested next IDs** compares explored paths using the applicant's inventory and answers. Recorded IDs and known-ineligible targets are excluded. Ranking prioritizes confirmed eligibility, fewer unanswered conditions and budget fit, followed by the chosen objective (fewer acquisitions or lower modeled maximum fees), then application preference. This estimates preparation burden, not guaranteed speed or universal ease. Each suggestion explains its remaining prerequisites or confirmations, and bounded searches are disclosed. Editing the starting point or eligibility answers recalculates the suggestions. Visitors can try their own inventory without a profile; their edits last for the current visit only.

Credential groups describe purpose, not difficulty, value, or acquisition order. They do not determine graph positions, eligibility, dependency edges, or recommendation scores. Definitions live in `GROUP_META` in `src/data/cards.ts`; every target and supplementary inventory item has `group` and `groupReason`. The **Groups** control, Browse, inventory editing, Progress, and detail sheets explain the classifications.

| Group | Meaning | Guided targets |
| --- | --- | --- |
| **Foundational documents** | Civil, academic, residency and other baseline supporting records. These establish application details rather than serve as standalone photo IDs. | PSA Birth Certificate; Barangay Clearance / Certificate of Residency; Cedula |
| **Starter & supporting credentials** | Early identity options, routine school, employer, tax and health IDs, and supporting clearances. Their eligibility and document conditions still apply. | Barangay ID; School ID; PhilHealth ID; BIR TIN ID; NBI Clearance; National Police Clearance; COMELEC Voter's Certification |
| **Widely accepted identity credentials** | General identity credentials used across institutions. Acceptance remains specific to the receiving agency, transaction, format and validity. Some can be first-ID options. | Postal ID; PhilSys National ID; Philippine ePassport; LTO Non-Professional Driver's License |
| **Specialized & service credentials** | Professional, benefit, status and membership credentials. Pursue these when relevant and eligible; this is not a final level everyone should complete. | MySSS Card; Pag-IBIG Loyalty Card Plus; PRC PIC; PWD ID; Solo Parent ID; OWWA e-Card; Senior Citizen ID |

Classify future entries by their main role and documented acceptance, recording a reason. Fees, age, prerequisite counts and issuing agency do not determine the group. Separate badges can describe overlapping roles: PRC retains **Widely accepted**, while Barangay ID and Postal ID retain starter badges. [Pag-IBIG Circular 450](https://www.pagibigfund.gov.ph/document/pdf/circulars/provident/Circular%20No.%20450%20-%20Modified%20Guidelines%20on%20the%20Availment%20of%20the%20Pag-IBIG%20Fund%20Loyalty%20Card%20Plus.pdf) says Loyalty Card Plus is not considered a government ID; its `id` classification here describes a membership/service card, not universal government-ID acceptance.

The nine supplementary records remain inventory evidence: LCRO Birth Certificate, lease/rental contract, voter registration record, utility bill, Form 137, child's PSA Birth Certificate and First-Time Jobseeker Barangay Certification are foundational; Company ID is supporting; legacy UMID is a widely accepted identity credential for existing holders. Progress counts all 30 inventory items. The tree and Browse expose 21 supported acquisition guides. These counts are a reference, not a goal to collect everything. Existing profile ownership, checklist keys and saved application modes keep their stable IDs.

The passport rules also model the conditional student route: School ID and, for adult students, Certificate of Registration. Unanswered enrollment remains a question and a negative answer removes that route. See the [DFA embassy acceptable-ID guidance](https://www.philippine-embassy.org.sg/list-of-acceptable-valid-ids-for-passport-application/); receiving-office screening and the rest of the passport checklist still apply.

## Barangay ID starter card

Barangay ID (`barangay-id`) leads the starter/supporting group and stays separate from Barangay Clearance (`barangay`). School ID is supporting evidence; baseline paper records belong to the foundational group. Recommendations use the applicant’s current information rather than always starting everyone at Barangay ID.

The card includes local eligibility/residency confirmation, adult-only conditional Cedula, printed-photo versus live-capture requirements, guardian paperwork, replacement evidence, and explicitly confirmed local waivers. An online route requires confirmation that the applicant’s own barangay offers it; no citywide availability, same-day release or fee exemption is assumed.

`src/lib/documents.ts` and `BarangayIdFields` store only issue/expiry dates and self-reported format checks. Selecting ownership does not establish current validity. Cards without a printed expiry remain **Needs confirmation** until an issue date and local validity confirmation are recorded. No one-, two- or three-year expiry is invented. Expired cards cannot auto-satisfy document requirements.

Verified acceptance is scoped: PSAHelpline’s online delivery ID requires photo and signature; PhilSys has an alternative Barangay ID route requiring its specified card details; Postal ID accepts Barangay Residency ID as address evidence, with identity and copies still separate. Barangay ID is not added to the DFA passport ID list. Bank/e-wallet acceptance remains provider-specific.

Source references are embedded in the card: [PSAHelpline delivery IDs](https://psahelpline.ph/faq/Delivery), [PSA PhilSys Charter](https://rsso05.psa.gov.ph/system/files/documents/2024%20CC%20-%20PhilSys_Updated%20with%20Brief%20Description%20%281%29.pdf), [Postal ID requirements](https://www.postalidph.com/requirements.html), [RA 7160](https://www.lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html), [RA 11261](https://www.lawphil.net/statutes/repacts/ra2019/ra_11261_2019.html), and [BSP Circular 950](https://www.bsp.gov.ph/Regulations/Issuances/2017/c950.pdf). Locally varying fees and release/validity periods are guidance estimates from the supplied research, pending the applicant’s barangay charter.

## Before production

The research catalog is provisional. References are included, but fees, eligibility, document acceptance, local variations, and all procedures still need an authoritative review and versioned source records. Passing software tests establishes consistent behavior, not government acceptance.

Profiles intentionally remain local rather than authenticated cloud accounts. Supabase provides the temporary transfer relay, weekly likes and private feedback storage. Before exposing the planning endpoints publicly, add deployment-level rate limits and resource monitoring; their per-request search and body limits do not limit request volume.

## Manual profile backup and restore

Open **Settings → Backup & restore**, or **Open device profile → Bring your progress → Import a file** before creating a profile. Select any saved profile and download its JSON backup. On the other browser/device, select that file, review its identity/content and differences, and import it. Selecting or canceling a file changes no saved data. Files are read locally; no backup service, login, email, transfer-code service, or cloud storage is involved. Backups contain personal information, are **not encrypted**, and do **not continuously synchronize** devices. Keep files private. Code-based device transfer is a separate, explicitly online option described below. Clearing browser storage still deletes local profiles and local undo data; keep a separate file backup.

### Format and validation

Format version 1 is an object with `format: "mabatid-profile-backup"`, `version: 1`, informational ISO `exportedAt`, `profile`, `contentHash`, and optional `revision`. The profile holds the permanent `id`, nickname (`name`), applicant age, creation/setup/review metadata, owned document IDs, document issue/expiry dates and format confirmations, eligibility answers (`facts`), budget/application preferences, tracked goals/priority, stable checklist keys (`prep`), and chosen application routes (`modes`). Computed recommendations are excluded and recalculated from these inputs and the current catalog. The active selection, unrelated profiles and replacement undo snapshot are not exported.

The content fingerprint is SHA-256 of UTF-8 canonical JSON from `profileContent` in `src/lib/revisions.ts`: sorted object keys, sorted/deduplicated set arrays, explicit defaults, and omitted empty map entries. Whitespace, JSON key order, list order, and export time do not change content identity. Each revision has `nonce` (random UUID), `parents` (zero to two revision IDs), `contentHash`, and `id`. Its ID is SHA-256 of canonical `{ profileId, nonce, parents, contentHash }`. This binds ancestry to content and permanent identity. Fingerprints detect damage and inconsistent metadata; they are not signatures or proof of authenticity. Someone who controls a file can deliberately recompute them.

Files are limited to **1 MiB**, depth 12, 20,000 visited values, 256 object entries, 512 array entries, 2,048-character strings (individual fields have tighter limits), and 64 revision nodes. Invalid JSON, unsafe property names, wrong field types, invalid document dates, unsupported format versions, and content-fingerprint mismatches are rejected before saving. Missing/invalid/content-mismatched revision metadata is explicitly reported as unreliable and requires acknowledgment; it cannot establish freshness. Obsolete/unrecognized catalog IDs, checklist keys, evidence fields, answers and preferences are listed for review. Importing a sanitized profile requires acknowledgment and records a new revision when its prior history no longer matches its content. Invalid raw files cannot silently reset existing profiles.

### Comparison, replacement and undo

Profiles match by permanent ID, never nickname. Renaming preserves identity; **Keep both** assigns a new permanent ID and independent root revision. The shared engine compares validated revision ancestry:

| Evidence | Result |
| --- | --- |
| Same saved content | Already up to date |
| Incoming history contains current revision | Imported version is newer |
| Current history contains incoming revision | Backup is older |
| Complete histories diverge after a shared revision | Conflict |
| Missing, invalid, unrelated, or insufficient/pruned ancestry | Cannot reliably determine freshness |

Neither device clocks, file dates, export dates, document counts, checklist totals, nor incrementing counters decide freshness. A newly exported file can contain older progress, and a newer revision can remove IDs or uncheck tasks. Meaningful normalized edits create revisions; no-op updates, selection changes and exports do not. History is bounded to the 64 nearest reachable nodes, retaining both parents of a resolution before older ancestors. Pruning may make comparison uncertain; direct proven ancestry still works across a pruned boundary when the relevant nodes remain. No automatic content merging occurs.

Preview shows additions/removals, nickname/age/metadata, changed answers/preferences, document evidence, routes, goals and checklist changes. Every replacement requires an explicit checkbox confirmation, even if newer. Older/conflicting/unknown versions can be chosen deliberately. Newer versions preserve their incoming revision; explicit rollback or conflict/unknown resolution creates a new revision descending from the current head and, when valid, the incoming head. Cancel leaves storage untouched. Commit rechecks the target, including its revision metadata; if it changed or appeared/disappeared after preview, review again. Unrelated profiles are retained.

One previous replacement snapshot is stored locally with the profiles and survives reload. **Undo last replacement** restores only that profile's content as a new revision. It is disabled after any later meaningful edit to that profile (even if an edit later restores identical content). Changing another profile or the active selection does not invalidate undo. Another replacement replaces the single undo snapshot. File backups do not include undo snapshots.

### Persistence and integration

Profiles, active selection, revision ancestry and the one undo snapshot are saved atomically in `mabatid.profiles.v3`. Existing v2 profiles are migrated with identities, ownership/evidence, stable progress, preferences and active selection intact; the original v2 keys are retained as migration recovery data and are not updated afterward. Legacy v1 mock profiles keep valid stable keys, discard obsolete positional ticks and receive a review notice; legacy credential records are removed only after the new record saves. Failed/corrupt migrations leave their sources untouched. Clearing only v3 manually can therefore expose the older v2 recovery data on the next migration.

Writes require **Web Locks** and Web Crypto in a secure context (HTTPS or localhost). Cooperating tabs serialize the complete read/check/write transaction under `mabatid-profile-storage`, use current durable data, reject stale target edits (including full-form edits checked against the version that initialized the form), and refresh on storage/focus events. An additional raw-storage check rejects changes during asynchronous work. Storage denial/quota errors leave the saved record intact and the app publishes no successful candidate state. External tools and older app versions are not supported concurrent writers; they may ignore locks or discard newer record fields; avoid running old and new app versions against the same browser storage. The localStorage record is atomic, but browser storage is not a durable server database.

`src/lib/backup.ts` handles the transport-independent envelope/validation/differences; `revisions.ts` handles content identity and ancestry; `profile-repository.ts` owns migration, preview, transactional commits and undo. A future transfer-code service should return this same JSON envelope and call the same preview/commit flow. It must never write profiles directly. The transfer-code interface uses this same envelope and review component through the temporary relay described below.

Settings renders the reusable adapter below. Other client screens can use the same integration:

```tsx
// Inside an existing client Settings component, under StoreProvider:
import { ProfileBackupRestore } from "@/components/BackupRestorePanel";

// Render wherever Settings wants its backup section:
<ProfileBackupRestore />
```

For another host or tests, render `<BackupRestorePanel controller={controller} onImported={onImported} />`. The `BackupRestoreController` type in `src/lib/store.tsx` specifies saved `users`, `activeId`, `undoSnapshot`, `downloadBackup(id)`, `previewBackup(json)`, `commitBackup(preview, choice, { confirmed, acknowledged })` and `undoReplacement(token)`. Reads produce no profile mutations; commits return `null` only after persistence succeeds, otherwise an error string. `onImported` runs only after successful persistence. Callbacks must be passed within a client boundary.

The `npm test` suite includes complete round trips, removals/corrections, misleading export dates and reversed clocks, conflicts, missing/tampered/pruned history, renamed and separate identities, no-op saves, validation limits, catalog sanitization, migration and storage failure, concurrent/stale writes, targeted replacement, keep-both and undo after reload.


## One-time device transfer codes

Open **Settings → Move to another device**, or **Open device profile → Bring your progress → Use a code** to receive progress before creating a profile. Select any saved profile and choose **Make a code**, then enter the grouped 12-character code on another device and choose **Review transfer**. The recipient does not need a profile first. The same `ImportReview` component and repository preview/commit engine handle files and codes: identity checks, ancestry comparisons, detailed differences, sanitization acknowledgment, replace/keep-both decisions, explicit replacement confirmation, stale-target checks and persistent undo. **Keep current profile** finishes a transfer whose content is already identical, without creating a revision.

Settings hosts `<ProfileBackupRestore />` and `<ProfileTransfers />` as separate sections; another client screen can render `<TransferPanel controller={controller} />` using the same store controller.

Creating a code snapshots the selected durable profile; later edits require a new code. Codes expire after ten minutes according to database time. Browser countdowns are informational and use elapsed monotonic time; neither their clock nor transfer expiry determines profile freshness. Codes are cryptographically random (unbiased selection from the readable alphabet) and grouped as `XXXX-XXXX-XXXX`. No accounts, passwords, emails or automatic synchronization are introduced. `@supabase/supabase-js` is used only by the server; `@supabase/ssr` is installed as requested but is not needed for this account-free relay.

Unlike file import, generating a code temporarily uploads the backup through MabatID's server to Supabase. The server encrypts it with AES-256-GCM before storing it. Encryption and code/owner/claim HMAC fingerprints use separate derivation domains from the server's transfer secret. The authenticated encrypted bundle includes its transfer ID and readable code, both verified against the lookup context; swapped database ciphertext is rejected before returning any backup. Idempotent creation also requires the exact original snapshot. The database stores ciphertext and fingerprints, not readable codes or browser claim credentials. **This is not end-to-end encryption: the MabatID server can decrypt the payload.** Anyone holding the code can attempt to retrieve it. The UI explains this upload before code creation. Backups downloaded as files remain unencrypted.

A receiving browser generates a private random claim token before retrieval and saves the code/token in its tab's session storage. The first atomic database claim reserves the transfer until its original expiry; another receiver cannot retrieve it. Retrying with the same claim token returns the same backup. Canceling the review releases the reservation; closing the tab does not, so a lost tab may leave the code reserved until expiry. Reloading that tab offers **Resume transfer**. Session storage contains only transfer credentials, never the backup payload. Releasing a reservation cannot make a recipient forget data it has already downloaded; one-time retrieval is not copy protection.

Successful local import records a receipt in the **same atomic localStorage write** as the profile. The last 256 receipts are retained separately from profile content and are not exported. They prevent a retry from creating a second keep-both identity if an acknowledgment is lost. The recipient acknowledges completion only after local saving succeeds. Completion immediately erases the encrypted personal payload; a small token-protected tombstone remains until expiry so acknowledgments can be retried. A failed completion request offers **Finish transfer** and never repeats the local import. Sender cancellation uses a separate owner token and removes the transfer. No distributed transaction spans a browser and Supabase; deleting browser storage also removes its receipts and resume credentials.

### Server and database setup

1. Copy `.env.example` to `.env.local` in the repository root and configure `SUPABASE_URL`, a server-only `SUPABASE_SECRET_KEY`, and a 32-byte random `TRANSFER_CODE_SECRET` encoded as 64 hex characters. Keep `.env.local` private; it is ignored by Git. Never put these secrets in a `NEXT_PUBLIC_` variable or a client component. All server instances intended to exchange codes must share the same transfer secret and Supabase project. Changing the secret invalidates outstanding transfers; use separate Supabase projects to isolate environments.
2. Apply `supabase/migrations/20261118142050_profile_transfers.sql` to the intended Supabase project, using its SQL Editor for an initial bootstrap or your configured migration workflow. The migration creates only the `mabatid_transfers` and `mabatid_transfer_limits` tables and the named `mabatid_transfer_*` functions. Tables have RLS enabled with no browser policies. Explicit grants permit only `service_role`; functions are security invokers with an empty search path and no `PUBLIC`, `anon` or `authenticated` execute privileges. If bootstrapping through SQL Editor, reconcile the version with CLI migration history before a later CLI push (use that CLI version's `migration repair --help`). The SQL Editor does not automatically record a CLI migration history entry.
3. Run `supabase/transfer-cleanup.sql` once on the hosted project to enable Supabase Cron and schedule the named minute-by-minute cleanup job. Running it again updates the same named job. Expiry prevents retrieval immediately even before cleanup runs. Cleanup removes expired transfers, completion tombstones and old rate buckets; it does not promise removal from provider backups or logs.
4. Run `supabase/verify-transfers.sql`. Expected: schema version 1; two RLS-protected tables; no anon/authenticated table or claim-function access; zero security-definer relay functions; one active cleanup job. Check the project's Supabase security advisors as well. Two informational “RLS Enabled No Policy” suggestions are expected for these server-only tables; browser policies are deliberately absent. There should be no relay security errors or warnings.
5. Add the same server variables to your deployment platform, then restart/redeploy the app. Code controls are shown only after `/api/transfers/status` confirms the database function is installed. An unavailable/misconfigured relay leaves file backup/restore usable and never generates a sample code.

The Next.js Node server exposes `/api/transfers/{status,create,claim,finish,release,revoke}`. Mutations require JSON and a matching browser Origin/Host; arbitrary forwarded hosts are ignored. Requests and backups have bounded sizes and use the existing strict envelope parser. Codes and tokens are sent in POST bodies rather than URLs. Responses are uncached and errors do not disclose profile data, database details, or whether a code is expired/reserved/unknown.

Atomic Postgres rate buckets enforce shared global limits across all app instances: 20 create attempts, 60 claims, 120 completions, and 60 releases/revocations per minute per action. Optional client limits (5 creates or 20 other actions/minute) use a pseudonymous HMAC of a **trusted** proxy IP header. Configure `TRANSFER_TRUSTED_IP_HEADER` only when your deployment platform overwrites that header; arbitrary client-supplied forwarding headers are not trusted by default. Without a trusted header, the global limits still apply. Global upload capacity is 128 unexpired transfers and 32 MiB of ciphertext, enforced under a short transaction lock. These conservative shared limits may temporarily limit unrelated visitors during abuse or heavy traffic; tune them with deployment-level abuse protection before broad rollout.

### Verification

`npm test` includes server validation, encrypted round trips, idempotent creation/completion, concurrent reservation behavior, cancellation, expiry, rate limits, request-origin checks, storage-failure safety and import receipts. When local PostgreSQL tools are available under a non-root user, it also starts a fresh temporary cluster and tests the **actual migration** against permissive Supabase-style default grants, real concurrent connections, row locks, RLS/privileges, capacity and cleanup. That SQL test reports a skip when those tools are unavailable; it does not contact a hosted project.

For a live check against a deliberately configured Supabase project, start the production app on local port 3177 and run `npx tsx scripts/verify-transfer-relay.ts` (or set `TRANSFER_TEST_ORIGIN` to another local app origin). It uses a disposable synthetic profile, checks the stored ciphertext and payload erasure, and removes only its own test transfer in a `finally` block. It never prints keys or transfer credentials. Browser QA should use a fresh local origin and disposable profiles; verify a real generated code, recipient preview/cancel/resume, storage-failure retry, replacement/keep-both and reload recovery without touching existing browser profiles.

## Weekly likes and profile feedback

The landing page's **Rates & Feedbacks** section shows the shared weekly like count. Anyone can like; one browser gets one like per Philippine week, starting Monday at 00:00 Asia/Manila. The database supplies the week, reset timestamp and browser's liked state. A signed HttpOnly, SameSite cookie identifies the browser, so clearing localStorage does not reset its weekly like. Clearing cookies or using another browser does; this is a browser limit, not proof of a unique person. Switching local profiles does not grant more likes.

Written feedback and an optional 1–5 rating are available in **Settings** only after opening a device profile and finishing its checklist setup. Guests see an Open device profile prompt. Feedback drafts reset when switching profiles. Device profiles remain local and are not authenticated identities: this is a UI gate to discourage casual spam, not a server-verifiable account requirement. No profile nickname, age, ID inventory, eligibility answers or progress is attached to feedback. The form uploads only the submitted message, optional rating and a retry identifier. It asks visitors to leave out personal information.

Feedback is private to the team. There is no public feedback read endpoint. Review `public.mabatid_feedback` in Supabase's Table Editor, newest `created_at` first; use `status` (`new`, `reviewed`, `archived`) to track review. Messages are plain text; if a public display is added later, render them as escaped text and introduce approval before publication.

### Setup

1. Apply `supabase/migrations/20261118155250_weekly_likes_feedback.sql` to the intended Supabase project using your migration workflow or SQL Editor. SQL Editor bootstrapping does not record CLI migration history; reconcile it before a later CLI push. This migration is independent of the transfer tables.
2. Reuse the server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `TRANSFER_CODE_SECRET` already used for transfers. Alternatively set a separate 64-hex `ENGAGEMENT_SECRET`. All app instances must share the same signing secret; rotating it invalidates existing visitor cookies and resets browser deduplication. Never expose these secrets through `NEXT_PUBLIC_` variables.
3. Optionally set `ENGAGEMENT_TRUSTED_IP_HEADER` only when the deployment proxy overwrites that header. Arbitrary forwarding headers are ignored by default. IP values are HMAC-hashed before use in rate buckets.
4. Run the Supabase security advisors. All three engagement tables have RLS enabled, browser privileges revoked and no browser policies. Functions use security invoker and an empty search path, with execute restricted to `service_role`. Informational “RLS Enabled No Policy” findings are intentional for these server-only tables.
5. Redeploy/restart with the configured environment, then verify likes and feedback. Missing configuration or schema returns an unavailable error; the UI never invents counts or reports an unsaved message as sent.

`GET /api/likes` supplies `{ week, nextResetAt, count, liked }` and establishes the browser cookie. `POST /api/likes` records a like; an existing like returns 409 with the same tally. `POST /api/feedback` accepts `{ submissionId, message, rating }`, requires a message of 10–2,000 characters and permits a null rating or an integer 1–5. Feedback retries with the same browser, submission ID and content are idempotent. There is no feedback GET endpoint. Mutations require an established signed browser cookie and matching Origin/Host, and responses are uncached.

Shared atomic database counters allow 120 like attempts and 20 feedback attempts globally per minute, 10 like attempts per browser per minute and 3 feedback attempts per browser per hour. With a trusted IP header, additional hourly limits allow 30 like attempts and 10 feedback attempts per IP fingerprint. Attempts, including retries, consume quota; 429 responses include Retry-After. Expired counters are pruned on subsequent requests. Feedback request bodies are limited to 16 KiB, including chunked bodies. These limits discourage abuse without authenticating device profiles; coordinated cookie resets can still reach the global limits and temporarily affect other visitors.

`npm test` covers API validation, cookie signatures, origin checks, failed requests, idempotency and shared limits. With local non-root PostgreSQL tools, it also runs the actual migration in a temporary cluster to verify permissions under permissive Supabase defaults, concurrent likes and rate limits, week isolation and feedback constraints.
