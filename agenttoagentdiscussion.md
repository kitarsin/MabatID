# MabatID — Design Critique & Implementation Blueprint

**From:** `frontend-brand-critic` → **To:** `frontend-dev`
**Date:** 2026-11-17 · **Status:** Phase 1 ✅ done · Phase 2 ✅ this file · Phase 3 ⏳ awaiting `frontend-dev` review

> Stack: Next.js 16.4.6 (App Router, Turbopack) · React 19 · Tailwind 4.3 · shadcn on `@base-ui/react` · `@xyflow/react` · lucide-react.
> **AGENTS.md applies:** this Next.js has breaking changes. Before touching anything Next-specific (`next/font`, `viewport`, routing, `useSearchParams`), read the matching guide in `node_modules/next/dist/docs/`.

---

## 0. Scope & method

- **Surfaces audited:** Landing (Persuade), Skill-tree main screen, Detail sheet, Browse, Progress, Auth, Onboarding (all Operate), plus `globals.css`, `layout.tsx` and the `ui/*` primitives.
- **Lenses applied, in order:** `taste-frontend-lite` → `impeccable-lite` (audit + critique) → `web-design-guidelines` (Vercel rules, fetched fresh) → `emilkowalski-motion`.
- **Verified in the running app** (dev server, 375px and desktop): landing, tree, detail sheet. Everything marked **[verified]** was seen or measured in the browser; the rest is from source.
- **Not verified:** screen reader (NVDA/VoiceOver), real touch device, Auth/Onboarding/Progress/Browse rendered (code-read only), signed-in states.

**Kind:** software (Filipino civic utility app). Landing = *Persuade*; everything after = *Operate*. That means the landing may carry a point of view, while the app screens must favour scan speed, consistency and precision.

### Scorecard (impeccable audit, 0–4)

| Dimension | Score | One-line reason |
|---|---|---|
| Accessibility | **2** | Focus ring fails contrast on light surfaces; invisible sheet close button; opacity-gated content; radiogroup markup |
| Performance | 3 | `transition-all`, width/box-shadow animation, decorative `backdrop-blur` over a panning canvas |
| Theming | 3 | Strong token set, but raw hex in SVG/React Flow and off-palette `slate-*` |
| Responsive | **2** | Desktop landing is broken; app screens are a 448px column on wide screens; 11px text and 26px controls on touch |
| Implementation integrity | **2** | ≥5 button looks, duplicate Chip/Tag components, `raised`/`liftControls` hacks to dodge overlapping floaters |
| **Total** | **12 / 20** | Good bones, unfinished system |

### What is already good (do NOT regress)

1. **The palette is the brand.** Navy `#1B365D` / civic `#005A9C` / sky `#60C1E5` / mist `#A0E0EF` / amber `#FFA500`, with contrast ratios documented in `globals.css:43-47`. Keep it all.
2. **Node language:** filled amber = have, outlined civic = ready, dashed = locked. Shape *and* colour carry status, so it isn't colour-only. Keep it.
3. **Existing a11y work:** `aria-live` on counts, `role="alert"` on auth errors, `sr-only` "(opens in a new tab)", real `<label htmlFor>`, `autoComplete` values, `prefers-reduced-motion` on the two loops, `min-h-dvh`/safe-area insets.
4. **Voice:** plain, action-first, with a Filipino touch ("Kumusta, {name}!"). Keep **sentence case** everywhere. Vercel's guideline asks for Title Case; that is an *intentional deviation* because the sentence-case voice is already consistent and friendlier.

---

## 1. PHASE 1 — The multi-lens critique

Legend: 🅣 taste · 🅘 impeccable · 🅦 web-guidelines · 🅜 motion.

### 🔴 CRITICAL (breaks a task, fails WCAG, or looks broken)

**C1 · Landing hero collapses on desktop [verified]** 🅣🅘
`Landing.tsx:52-57`: the SVG uses `preserveAspectRatio="xMidYMin slice"` with `w-full h-[36%]`. At 1440px wide, `slice` crops a 100×80 viewBox into a ~1440×300 band, so the whole "tree" renders as **one giant amber circle with two stub lines**. The column is `max-w-md` (`Landing.tsx:11`) on a full-bleed navy field, so desktop shows a phone column floating in empty navy.
*Why it hurts:* the first impression for anyone arriving from a desktop link (Facebook share, school IT lab) is a broken illustration. It also fails the taste rule for software: the hero must show **the real product**, and this is a generic nodes-and-lines motif that "hints" at it (`Landing.tsx:45` says so itself).

**C2 · Focus indicator fails contrast on every light surface; two focus systems fight [verified in code, ratio computed]** 🅦🅘
- `globals.css:80-83` sets a global `:focus-visible { outline: 3px solid #ffa500 }`. Amber vs. the page background `#F3FBFD` is **1.88 : 1** (vs. white 1.97 : 1); WCAG 1.4.11 / 2.4.11 need ≥ 3 : 1. It's excellent on navy (6.1 : 1), which is why nobody noticed.
- `ui/button.tsx:6`, `ui/tabs.tsx:60` and `ui/input.tsx:11` add `outline-none` + `ring-ring/50` (civic at 50% alpha, roughly 2.5 : 1). Utilities beat `@layer base`, so shadcn controls get the weak ring and raw `<button>`s get the failing amber one.
- Affected raw buttons: `App.tsx:73-87,161-170` · `FilterBar.tsx:38,78,100` · `BrowseScreen.tsx:83,132` · `DetailSheet.tsx:248,377,413,448,467` · `ProgressScreen.tsx:51,76,89,96,140` · `TrackingBar.tsx:16`. `BrowseScreen.tsx:47` removes the outline and only changes the border colour.

**C3 · Detail-sheet close button is invisible [verified in browser]** 🅦🅘
`ui/sheet.tsx:63-77` renders the close `Button variant="ghost"` with inherited colour. `DetailSheet.tsx:81,85` puts it over a **navy** header, so the computed icon colour is `rgb(27,54,93)` on `#1B365D`, a contrast of **1 : 1**. It is also 28×28 px (`size="icon-sm"`). Sighted users have no visible way to dismiss the main modal except Esc/overlay tap.

**C4 · The guide and requirements are dimmed below readable contrast** 🅘🅦
`DetailSheet.tsx:225` (`opacity-40` when locked) and `:171` (`opacity-50` when obtained). Navy text at 40% opacity is roughly 2.4 : 1 and at 50% about 3.6 : 1, both under 4.5 : 1. The landing promise is "see exactly what to get, what it costs and what to bring", and then the app greys out the *how* for exactly the people who are planning ahead. Only the step *checkboxes* should be disabled, never the reading.

**C5 · Tree first-run view hides the map [verified]** 🅘🅣
- `SkillTree.tsx:206-210` centres on PSA at zoom .8, so Tiers 1–3 are off-screen on first load. Tier labels (`SkillTree.tsx:101-110`, x = 6) are also off-screen, so the user loses "which tier am I looking at".
- `App.tsx:182` (Legend, top-left) and `FilterBar.tsx:37` (top-right) float **on top of nodes**. In the 375px screenshot, the Legend covers the "Voter's/Cedula" row's neighbours and Filter covers a node. The Dock (`App.tsx:154`) and RF controls (`SkillTree.tsx:225`) fight for the bottom corners, which is why `raised` and `liftControls` props exist.
- In preview mode (no profile) 19 of 20 nodes are grey-dashed "locked" and there is no "start here". The screen reads as disabled.

**C6 · Screen state lives in `useState`, so the Back button leaves the app** 🅦
`App.tsx:24`: Landing → Auth → Tree → Browse → Progress → ID sheet are all component state. Mobile Back exits MabatID; no ID can be linked or shared (a real need: "send my cousin the NBI steps"); filters and the open sheet vanish on refresh. (Guideline: *URL reflects state; deep-link all stateful UI.*) This is architecture-adjacent, so it is in Wave 2 and needs an owner decision (§5).

### 🟠 MODERATE (hurts polish, consistency, or specific users)

**M1 · Type hierarchy is flattened by weight 800 everywhere** 🅣🅘
`font-extrabold` appears on names, labels, pills, section titles, buttons, percentages. When everything is 800 nothing leads. Plus Jakarta Sans is on impeccable's training-default list; it is *acceptable* for Operate screens, but the Persuade landing has no distinctive voice. **Decision for owner:** the face stays for now (§5-D3); the weight scale is fixed now (WP-2).

**M2 · Uppercase-tracked mini-labels everywhere** 🅘
`uppercase tracking-wider text-xs text-civic` is repeated in `FilterBar.tsx:92`, `Onboarding.tsx:55`, `DetailSheet.tsx:187,342`, `SkillTree.tsx:105`, `ProgressScreen.tsx:44`. `ProgressScreen.tsx:44` ("Your level" above the level title) is a pure eyebrow, which impeccable bans. The rest is a costume. Use sentence-case 13px/600.

**M3 · No single button / chip / pill system** 🅘
- Five button looks: shadcn `Button` (`h-8 rounded-lg`) overridden per call-site with `h-14 rounded-2xl bg-amber hover:bg-amber/85` (`Landing.tsx:26,33`, `Onboarding.tsx:102,108`, `AuthScreen.tsx:102`, `DetailSheet.tsx:273,277,288,298,313`); raw `<button>`s in `App.tsx:73-87`, `ProgressScreen.tsx:51,89,96`, `FilterBar.tsx:38`.
- Duplicate components: `Chip` in `FilterBar.tsx:98` and `BrowseScreen.tsx:130`; `JumpChip` and `Chips` in `DetailSheet.tsx:445,459`; `Tag` (`BrowseScreen.tsx:145`, `DetailSheet.tsx:348`) and `Pill` (`DetailSheet.tsx:441`).
- `DetailSheet.tsx:298`: the priority button uses `disabled:opacity-100 disabled:bg-amber` to look *enabled*. `ProgressScreen.tsx:90` does the same. Disabled buttons drop out of the tab order and screen readers don't announce state; use `aria-pressed` instead.

**M4 · Hard-coded colours and off-palette greys** 🅘
Raw hex in `Landing.tsx:62-75`, `SkillTree.tsx:191,224`, `ProgressScreen.tsx:193-198`, `globals.css:81,106`. Tailwind `slate-*` in `App.tsx:185`, `SkillTree.tsx:52,58,79,86`. The locked-node dashed border and locked edges (`#94A3B8`) are **~2.5 : 1** against `#F3FBFD`, under the 3 : 1 non-text minimum; the edges are also drawn at 0.75 opacity, which lowers them further.

**M5 · Tiny text and touch targets** 🅦🅘
`text-[11px]` on pills/tags/legend: `SkillTree.tsx:92,105`, `DetailSheet.tsx:442`, `BrowseScreen.tsx:95,147`, `App.tsx:182`, `ProgressScreen.tsx:178`. Targets under 44px: React Flow controls **26px [verified]** (`SkillTree.tsx:225`), step checkboxes 28px (`DetailSheet.tsx:384`), JumpChips ~32px (`DetailSheet.tsx:451,471`), sheet close 28px (C3), FilterBar "Clear" ~28px.

**M6 · Semantics, headings, landmarks** 🅦
- No skip link. The tree and Progress screens have **no `h1`** (`App.tsx:68-119`, `ProgressScreen.tsx:39`), and `Logo` isn't a heading or link.
- `Dock <nav>` sits inside `<main>` (`App.tsx:97,152`), and every screen mounts its own `<main>` (`Landing`, `AuthScreen`, `Onboarding`).
- Switching screens doesn't move focus or update `document.title`.
- `Onboarding.tsx:77,89`: `<ul role="radiogroup"><li><button role="radio">`. The `li` breaks the required owned-element chain, and custom radios have no arrow-key roving. `Onboarding.tsx:151` and `PrepButton` (`DetailSheet.tsx:413`) rebuild native checkboxes by hand.
- `TrackingBar.tsx:22-31`: `role="progressbar"` nested inside a `<button>` (children of a button are presentational).
- `DetailSheet.tsx:381`: step checkbox label is just "Step 3", with no step text.
- Unicode glyphs used as icons: `✓` at `DetailSheet.tsx:101,167,189,193,223`; `— OR —` at `:192`.
- `App.tsx:48`: the loading state is a blank navy div with no accessible text.

**M7 · Forms** 🅦
`AuthScreen.tsx`: errors have no `aria-invalid` / `aria-describedby`; the age error doesn't move focus to the field (`:38-41`); no show-password toggle; email field lacks `spellCheck={false}`; the "At least 8 characters." hint (`:94`) isn't linked to the input. Busy label "One moment…" should say what is happening ("Creating account…" / "Logging in…"). `BrowseScreen.tsx:41-48`: search lacks `autoComplete="off"`, `enterKeyHint`, a clear button, and an ellipsis placeholder.

**M8 · Filter panel & sheet behave like prototypes** 🅦🅜
`FilterBar.tsx:48`: conditional render (no enter/exit), no Esc / outside-click close, button lacks `aria-controls`. `ui/sheet.tsx:56`: `transition duration-200 ease-in-out`, with a 2.5rem translate (reads as a fade, not a bottom sheet) and an ease-in-out curve; overlay uses `backdrop-blur-xs` (`:31`) for no reason.

**M9 · Decorative blur & perpetual motion** 🅘🅜
`backdrop-blur` at `App.tsx:154,182`, `Onboarding.tsx:99` (Dock/Legend float over a panning WebGL-less but repaint-heavy canvas). `globals.css:97-111`: **every** "ready" node pulses forever (`node-pulse` animates `box-shadow`, not compositor-friendly) and every open edge marches forever (`edge-flow`). On a screen with several available nodes that is constant motion with no pause control (>5s rule), and it dilutes the one node that matters (the user's next step).

**M10 · Desktop is an afterthought** 🅘
Browse/Progress/Onboarding/Auth are `max-w-md` columns (`BrowseScreen.tsx:28`, `ProgressScreen.tsx:39`) under a full-bleed header: 448px of content on a 1440px canvas. Tree is fine (a canvas), but Browse (20 cards) and Progress (5 sections) should use 2 columns at ≥ 768px.

**M11 · Landing copy & hierarchy** 🅣🅘
- h1 "From baseline documents to your first valid ID." never names the category or the country; "Philippine" appears only in `<meta>`. A stranger can't tell what this is in 5 seconds. There's no hard fact ("20 IDs", "4 tiers").
- Two equally heavy 56px buttons, and the amber primary is **Log in or register**, while the lower-friction promise ("No account needed to preview") sits *under both* buttons, so it's ambiguous. (Owner decision D1.)
- `Landing.tsx:14` `pt-48` + absolute `h-[36%]` SVG: overlap risk at 320×568.

**M12 · "Everyone's progress" leaderboard** 🅘
`ProgressScreen.tsx:155-183` lists every registered member's **name and ID count** to whoever is signed in on the device. For an app about identity documents on shared family/school devices, that is a privacy smell. (Owner decision D5.)

### 🟡 POLISH

- **P1** `DetailSheet.tsx:330-333` numeral badges "1 2 3 4" on sections, and `Onboarding.tsx:50,75,87` "1 · / 2 · / 3 ·". Only Requirements→Guide carries real sequence ("finish section 2 first", `:223`); reference sections *by name* and drop the badges.
- **P2** Tabular numerals for `%`, `n/20`, "{shown} of 20" (`ProgressScreen.tsx`, `TrackingBar.tsx:35-36`, `FilterBar.tsx:76`).
- **P3** No `touch-action: manipulation`, `-webkit-tap-highlight-color`, or `overscroll-behavior: contain` on the sheet body (`DetailSheet.tsx:105`) and scroll panes (`App.tsx:108,113`).
- **P4** `Logo.tsx:10`: add `translate="no"` on the brand name. `layout.tsx:11` title is Filipino-only while all UI is English (owner decision D4).
- **P5** `App.tsx:92` preview banner eats 40px of an 812px screen; make it a dismissible one-liner or fold it into the header.
- **P6** Scroll-container chip rows (`BrowseScreen.tsx:51`) have no edge fade to signal more.
- **P7** Dead weight: `public/*.svg` (Next template files), `README.md` boilerplate, `dark:` variants with no `.dark` tokens, `--font-heading` alias.
- **P8** `transition-all`: `TrackingBar.tsx:30`, `ProgressScreen.tsx:86,124,196`, `ui/button.tsx:6`, `ui/tabs.tsx:60`. Progress bars animate `width` (layout); use `transform: scaleX()`.
- **P9** `SkillTree.tsx:62` node hover/press scale is a good instinct but uses the default `transition-transform` curve; unify with the motion tokens below.

### 🅜 Motion audit summary

There is **no motion language**: some `transition-colors` (default 150ms, ease), `transition-all`, one `ease-in-out`, two infinite loops, and no press feedback on raw buttons or list cards. The right budget for this product is *small*: functional feedback everywhere (press/hover/open/close) plus **one** authored moment (marking an ID as obtained). No page-level choreography, no scroll reveals, no parallax.

---

## 2. PHASE 2 — Design & Implementation Plan

### 2.0 Design tokens (add to `globals.css`)

```css
:root {
  /* focus — one system, surface-aware */
  --focus: #005a9c;               /* civic on light: 7.1:1 vs #F3FBFD / white */
  /* locked state (off slate-*, tinted from navy) */
  --locked: #5d7190;              /* text/icon: 4.98:1 on white, 4.74:1 on #F3FBFD */
  --locked-line: #7a8ea9;         /* dashed borders + edges: ≥3.1:1 on #F3FBFD */
  /* motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-press: 90ms;
  --dur-fast: 140ms;              /* hover, press release, chip toggle */
  --dur-base: 200ms;              /* popovers, state changes */
  --dur-sheet-in: 220ms;
  --dur-sheet-out: 160ms;
}
.surface-navy { --focus: #ffa500; }     /* amber on navy: 6.1:1 */

@theme inline {
  --color-locked: var(--locked);
  --color-locked-line: var(--locked-line);
}

@layer base {
  :focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
  html { -webkit-tap-highlight-color: transparent; }
  body { touch-action: manipulation; }
}
```

Apply `.surface-navy` to: app `<header>` (`App.tsx:70`), Dock `<nav>`, `TrackingBar`, Landing `<main>`, `SheetHeader` (`DetailSheet.tsx:85`), Progress hero card (`ProgressScreen.tsx:40`), `Logo` wrapper when not `dark`.

**Type scale (Plus Jakarta Sans stays; hierarchy comes from size + weight, not 800 everywhere):**

| Role | Size / line | Weight | Use |
|---|---|---|---|
| Display | 2.1rem / 1.1 (`text-balance`) | 800 | Landing h1 only |
| Screen title (h1) | 1.5rem / 1.2 | 700 | Browse, Progress, Auth, Onboarding |
| Section title (h2/h3) | 1.125rem / 1.3 | 700 | Section headings |
| Item name | 0.9375rem / 1.35 | 600 | Card names, node labels (13px/600 on tree) |
| Body | 0.9375rem / 1.5 (`text-pretty`) | 400–500 | Paragraphs, steps |
| Label | 0.8125rem / 1.3 (13px) | 600, sentence case, `text-civic` | Replaces uppercase `text-xs` mini-labels |
| Pill / tag | 0.75rem / 1 (**12px floor**, never 11) | 600 | Pills, tags, legend |
| Numerals | add `tabular-nums` | — | %, counts, fees |

`font-extrabold` allowed only for: Landing h1, the Logo, and the single % figure in the Progress hero.

### 2.1 Work packages

Each item lists *what*, *where*, *acceptance*. **Wave 1 = approved for build now.** Wave 2 and items marked **[owner]** wait for a decision (§5).

#### WAVE 1 — approved

**WP-1 · Accessibility & focus (fixes C2, C3, C4, M5, M6, M7, P3)**

1. **Focus system.** Implement §2.0 tokens. In `ui/button.tsx:6`, `ui/input.tsx:11`, `ui/tabs.tsx:60` replace `outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring` with `outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]`. One ring, same colour logic for shadcn and raw buttons. `BrowseScreen.tsx:47`: drop `outline-none focus:border-civic`, rely on the global ring plus `focus-visible:border-civic`.
   *Accept:* Tab through every screen; ring visible ≥3:1 on white, mist, amber and navy surfaces.
2. **Close button** (`ui/sheet.tsx:63-77`): add a `closeClassName` prop to `SheetContent`; default `top-2 right-2 size-11`, icon `size-5`. `DetailSheet.tsx:78` passes `closeClassName="text-white hover:bg-white/15"`. Keep the sr-only "Close".
   *Accept:* white × visible on navy, 44×44 hit area, header `pr-14` still clears it.
3. **Stop dimming content** (`DetailSheet.tsx:171,225`): remove both opacity wrappers. Keep steps fully readable; when `!unlocked`, only the step checkboxes are `disabled` (already) and their number discs use `bg-locked text-white` instead of civic. The status banner at `:213-224` already explains why. When `obtained`, show requirements at full contrast with the ticks locked.
   *Accept:* all text ≥4.5:1 in every state.
4. **Skip link + landmarks + headings.** Add a skip link as first focusable element in the app shell (`sr-only focus:not-sr-only`, `surface-navy`-aware) targeting `#main`. Make the app shell render **one** `<main id="main" tabIndex={-1}>`; screens (`Landing`, `AuthScreen`, `Onboarding`) become `<div>`/`<section>` or keep `<main>` only where they are the whole page. Move `<nav>` (Dock) out of `<main>`. Add an `sr-only` `<h1>` on the tree ("Your ID path") and Progress ("Your progress"). On screen change, move focus to `#main` and set `document.title` (`"Browse IDs · MabatID"`, etc.).
5. **Radio / checkbox semantics.** `Onboarding.tsx:77,89`: replace `<ul role="radiogroup"><li>` with `<div role="radiogroup" aria-labelledby>` + direct `role="radio"` children, with roving `tabIndex` and ←↑/→↓ keys, **or** render native visually-hidden `<input type="radio">` inside `<label>` (preferred: less code, free keyboard). Same for `Row role="checkbox"` and `PrepButton` (`DetailSheet.tsx:413`): prefer native `<input type="checkbox" className="sr-only peer">`. Step checkbox `aria-label` → `` `Step ${i+1}: ${plain text of step}` `` (or `aria-labelledby` to the step text element).
6. **TrackingBar** (`TrackingBar.tsx:22-31`): remove the inner `role="progressbar"`; mark the bar `aria-hidden` (the button's `aria-label` already says "%").
7. **Priority/track buttons**: replace `disabled` hacks (`DetailSheet.tsx:296-298`, `ProgressScreen.tsx:90`) with `aria-pressed` and a no-op handler; no `disabled:opacity-100`.
8. **Forms** (`AuthScreen.tsx`, `BrowseScreen.tsx`): `aria-invalid` + `aria-describedby` linking error/hint; on submit error focus the first invalid field (age error `:38-41`); `spellCheck={false}` on email; add a show-password toggle (`type` swap, icon button with `aria-label` + `aria-pressed`); busy label "Creating account…" / "Logging in…"; search: `autoComplete="off"`, `enterKeyHint="search"`, placeholder `Search by name or agency…`, clear-× button when non-empty.
9. **Glyph → icon.** Replace `✓` text glyphs (`DetailSheet.tsx:101,167,189,193,223`) with lucide `Check` (`aria-hidden`) + text; replace `— OR —` (`:192`) with a divider: `<div role="separator" class="flex items-center gap-2 text-xs text-muted-foreground"><span class="h-px flex-1 bg-border"/>or<span class="h-px flex-1 bg-border"/></div>`.
10. **Touch targets ≥44px** where the target is a control: step checkboxes keep a `size-7` visual but get `relative` + `before:absolute before:-inset-2` (44px hit area); JumpChip/Chips/FilterBar Clear get `min-h-11` (or `py-2.5`); React Flow controls → `@media (pointer: coarse) { .react-flow__controls-button { width: 44px; height: 44px } }`.
11. **Misc:** `Logo.tsx:10` brand name `translate="no"`; `App.tsx:48` loading div gets `<span class="sr-only">Loading…</span>`; `overscroll-behavior: contain` on `DetailSheet.tsx:105`, `App.tsx:108,113`; `html { overscroll-behavior: none }` inside `@media (pointer: fine)`.

**WP-2 · Tokens & type (fixes M1, M2, M4, M5, P2, P7)**

1. Add §2.0 tokens. Replace every raw hex/`slate-*`:
   - `SkillTree.tsx:52,58,79,86`: `text-slate-500/600`, `border-slate-400`, `bg-slate-500` → `text-locked`, `border-locked-line`, `bg-locked`.
   - `SkillTree.tsx:191`: edge strokes → `var(--color-amber)`, `var(--color-civic)`, `var(--locked-line)`; set unfocused `strokeOpacity` to **1** (fade only when `faded`). `:224` dot colour → `color-mix(in srgb, var(--color-navy) 14%, transparent)`.
   - `Landing.tsx:62-75`, `ProgressScreen.tsx:193-198`: use Tailwind `stroke-amber`/`fill-civic` etc. or `style={{ stroke: "var(--color-amber)" }}`.
   - `App.tsx:185`: Legend "locked" swatch uses `border-locked-line`.
   - `globals.css:81` → `var(--focus)`; `:106-107` pulse colour → `color-mix` of `--color-civic`.
2. Apply the type table: swap `font-extrabold` → `font-bold`/`font-semibold` per role; `text-[11px]` → `text-xs` (12px) everywhere (§M5 list); convert uppercase-tracked mini-labels to the **Label** role (sentence case, 13px/600) in `FilterBar.tsx:92`, `Onboarding.tsx:55`, `DetailSheet.tsx:187,342`, `ProgressScreen.tsx:44`. **Delete** the "Your level" eyebrow (`ProgressScreen.tsx:44`): show the level title with `owned.size of total IDs collected` beneath it. `SkillTree.tsx:105` tier chip: keep as a chip but sentence case.
3. `tabular-nums` on `ProgressScreen` % / `n/total`, `TrackingBar.tsx:35-36`, `FilterBar.tsx:76`, `BrowseScreen.tsx:63`.
4. Add `text-wrap: balance` to all headings and `pretty` to body paragraphs via `@layer base { h1,h2,h3 { text-wrap: balance } p { text-wrap: pretty } }`.
5. Delete dead `public/*.svg`, strip the README boilerplate, drop unused `dark:` variants and the `--font-heading` alias *only if* grep shows no consumers.

**WP-3 · One component system (fixes M3, P-dups)**

Extend `ui/button.tsx` with variants and sizes instead of per-call overrides:

| New | Spec | Replaces |
|---|---|---|
| `variant="cta"` | `bg-amber text-navy hover:bg-[color-mix(in_oklch,var(--color-amber),var(--color-navy)_14%)]` | all `bg-amber … hover:bg-amber/85` |
| `variant="brand"` | `bg-civic text-white hover:bg-navy` | `AuthScreen.tsx:102` |
| `variant="onDark"` | `border-2 border-mist bg-transparent text-white hover:bg-white/10` | `Landing.tsx:33` |
| `size="xl"` | `h-14 rounded-2xl px-5 text-base font-bold` | every `h-14 rounded-2xl` |
| `size="lg"` | `h-12 rounded-xl px-4 text-base font-bold` | `h-12` CTAs |
| `size="md"` | `h-11 rounded-xl px-4 text-sm font-bold` | `h-11` buttons |

Base class: replace `transition-all` with `transition-[background-color,color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]`, keep `active:scale-[0.97]` (not the 1px translate).
Create `components/ui/chip.tsx` (toggle chip: `aria-pressed`, `min-h-11`; used by FilterBar, BrowseScreen, DetailSheet JumpChip/Chips) and `components/ui/pill.tsx` (`tone: "mist" | "navy" | "amber" | "muted"`, 12px; replaces `Tag`, `Pill`, `relPills` classes). Convert the raw `<button>`s in `App.tsx:73-87`, `ProgressScreen.tsx:51,89,96`, `FilterBar.tsx:38` to `Button`.
*Accept:* grep for `h-14 rounded-2xl`, `hover:bg-amber/85`, `Chip =`/`function Chip` returns only the shared primitives.

**WP-4 · Motion system (fixes M8, M9, P8, P9)** — see §2.2 for exact values.

**WP-5 · Landing (fixes C1; copy parts wait for owner)**

1. **Fix the bug and show the real product.** Replace `MiniTree` (`Landing.tsx:45-80`) with `HeroPath`: three **real** nodes using the same visual language as `IdNode`: *PSA Birth Certificate* (amber, check) → *Barangay Clearance* (civic outline, gentle single pulse) → *National ID* (dashed, lock), connected by the same edge styles, with real `CardIcon`s and `short` labels from `CARD_BY_ID` (no new copy invented). Fixed pixel size (≈ 260×300), **no `slice`**, no absolute percentage height.
2. **Layout.** `<640px`: current single column (h1, sub, buttons; HeroPath above the h1, `mt-8` not `pt-48`). `≥900px`: two columns inside a centered `max-w-5xl` wrap, with copy left and HeroPath on the right in a rounded `bg-white/5 ring-1 ring-white/10` frame (an "app frame", no glow, no gradient). Hero must still fit one screen at 1440×900 and 320×568 with both buttons visible.
3. **Entrance, once, on load** (see §2.2 M-6): HeroPath edges draw, then nodes rise; h1/sub/buttons fade-rise as three groups. `prefers-reduced-motion`: render final state.
4. Add `surface-navy` to the `<main>`; keep amber CTA + outlined secondary exactly as they are (order **unchanged** pending D1).

**WP-6a · Tree screen (fixes C5, partial M9)**

1. **Single in-flow toolbar** above the canvas replaces the floating Legend + Filter: `<div class="flex h-12 items-center justify-between gap-3 border-b bg-background px-3">` with the Legend inline on the left (3 items, 12px, swatch + label) and the Filter button on the right. The filter *panel* opens as an anchored popover under the toolbar (`absolute right-3 top-full`). Remove `pointer-events-none` Legend, `backdrop-blur`, and the absolute Legend.
2. **Initial view:** centre on, in order, the priority ID → the lowest-tier "ready" node → PSA (`SkillTree.tsx:206-210`). Keep zoom .8.
3. **Start here:** when the user owns nothing (preview or fresh account), add a `Start here` pill (existing `relPills` mist/navy style) under the PSA node.
4. **Pulse only what matters:** `node-pulse` on the **priority** node, or if none set, on at most the single lowest-tier available node; other available nodes show the static civic outline. `edge-flow` only on edges into the pulsing node. (Replaces global `.node-available`.)
5. Controls: 44px on coarse pointer (WP-1.10).
6. *Optional, dev's call on feasibility:* pin tier labels to the viewport's left edge using `useViewport()` so they stay visible while panning (position = `y·zoom + viewport.y`).

**WP-7 · Detail sheet information order (fixes M-hierarchy, P1)**

New order: header (icon, name, status chip, **purpose as a one-line lede** under the title) → *if locked:* "Unlock by getting" → **Requirements** → **Step-by-step guide** → "Helps you get" → About details (tier, issued by, fit tags) → References → disclaimer. Remove numeral badges (`:330-333`); reference sections by name ("finish **Requirements** first (2/5)"). Header status text uses the `Check` icon, not a glyph. Sticky bottom action bar is unchanged.
*Accept:* with a locked ID, the first screen of the sheet answers *why locked and what to get*; with an available ID, the first screen shows requirements.

#### WAVE 2 — needs `frontend-dev` feasibility + owner decision

- **WP-8 · Navigation shell.** Replace the floating left Dock with an in-flow **bottom tab bar** on `<768px` (icon + visible label, 56px, `surface-navy`) and a left rail on `≥768px`; this deletes the `raised`/`liftControls` props. Needs D2.
- **WP-9 · URL state.** `?v=tree|browse|progress&id=nbi` via the App Router (`useSearchParams` needs `<Suspense>`; **read `node_modules/next/dist/docs/` first**), so Back works and IDs are linkable. Needs D6.
- **WP-10 · Desktop layouts.** Browse: 2 columns at `≥768px`, 3 at `≥1280px` within `max-w-5xl`; Progress: 2 columns at `≥768px`; Auth/Onboarding stay a centered card.
- **WP-6b · pinned tier labels** (if not done in 6a.6).

### 2.2 Motion spec (`emilkowalski-motion`)

One language: `ease-out = cubic-bezier(0.2, 0.8, 0.2, 1)`; only `transform` + `opacity` (plus `background-color`/`color`/`border-color` on small controls, which are cheap); **never `transition: all`**; every animation interruptible (CSS transitions, no JS timelines).

| # | Element (file) | Trigger | Spec |
|---|---|---|---|
| M-1 | All `Button`, `Chip`, Dock/tab items | press | `transform: scale(.97)`, **90ms**; release **140ms** |
| M-2 | Buttons / chips / list rows | hover (fine pointer only) | `background-color`/`color` **140ms** ease-out |
| M-3 | Browse cards, Progress rows, PrepButton, JumpChip | press | `scale(.985)` 90ms; hover bg tint 140ms. **No lift/shadow animation** on touch lists |
| M-4 | Tree `IdNode` circle (`SkillTree.tsx:62`) | hover / press | `scale(1.04)` / `scale(.96)`, 140ms (replace `scale-105`/`95` and default curve) |
| M-5 | Detail sheet (`ui/sheet.tsx:56`) | open / close | `translateY(100%)→0`, **220ms in / 160ms out**, ease-out (not ease-in-out); overlay `opacity` only 160ms; overlay → `bg-navy/40`, **remove `backdrop-blur-xs`** |
| M-6 | Landing entrance (once) | load | HeroPath edges draw (`stroke-dashoffset`, 360ms), nodes `translateY(8px)→0 + opacity` staggered 60ms ×3; then h1 → sub → buttons as **three** groups `translateY(10px)→0 + opacity`, 280ms, 60ms stagger. Total ≤ 700ms. Reduced motion: no transform, final state immediately |
| M-7 | Filter panel (`FilterBar.tsx:48`) | open / close | Keep mounted; CSS `@starting-style` or `data-state`: `opacity 0→1` + `scale(.98)→1`, `transform-origin: top right`, **160ms in / 120ms out**. Esc and outside click close; return focus to trigger |
| M-8 | Tabs indicator (`ui/tabs.tsx`) | change | `transition: background-color, color, box-shadow 140ms ease-out` (no `transition-all`) |
| M-9 | Progress bars (`TrackingBar.tsx:30`, `ProgressScreen.tsx:86,124,173`) | value change | `transform: scaleX(pct/100)`, `origin-left`, **300ms** ease-out; remove `width` animation |
| M-10 | Progress ring (`ProgressScreen.tsx:196`) | value change | `transition: stroke-dashoffset 400ms var(--ease-out)` (not `all`) |
| M-11 | **The one moment:** "I have this ID" (`DetailSheet.tsx:311-316`) | tap | Button shows check; the node on the tree gets one `scale(1)→1.08→1` over **320ms** plus its amber fill cross-fading (`background-color` 200ms); newly *unlocked* neighbours play **one** pulse (single iteration). Nothing else celebrates |
| M-12 | Pulse (`globals.css:105-111`) | priority / first-ready node only | Replace `box-shadow` keyframes with an `::after` ring: `transform: scale(1)→scale(1.35)`, `opacity .5→0`, 2.2s, **3 iterations then rest**; `edge-flow` max 3 loops on selection. Both off under reduced motion |
| M-13 | Screen switches (`App.tsx` `setScreen`) | navigate | **No animation.** Instant swap + focus management (WP-1.4). Restraint is the feature |

**Reduced motion** (add once in `globals.css`, replacing the two-selector block at `:112-117`):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-iteration-count: 1 !important; animation-duration: 1ms !important; }
  .pulse-ring, .edge-flow-active { animation: none; }
  [data-slot="sheet-content"] { transition-property: opacity; }   /* fade only, no slide */
  .rise { transform: none !important; }
}
```
State changes must still be *visible* (colours, check icons) when motion is removed, so do not use a blanket 0ms kill on `transition` for colour.

### 2.3 What Wave 1 explicitly does **not** change

Palette, logo mark, node status language, button copy ("Log in or register", "Preview your ID path"), h1 wording, button order, typeface, screen routing, leaderboard. All are in §5 for the owner.

---

## 3. Implementation order & verification

**Order (each step leaves the app working):**
1. WP-2.1 tokens → WP-1.1 focus system → WP-3 primitives (`Button`, `Chip`, `Pill`).
2. WP-1 (2–11) a11y fixes → WP-7 detail sheet.
3. WP-6a tree toolbar/start-here/pulse → WP-5 landing → WP-4 motion polish.

**Definition of done (the critic will re-check these):**
- [ ] `npm run lint` and `npm run build` pass; no new `any`/`@ts-ignore`.
- [ ] 320 / 375 / 768 / 1440 px: landing hero fits one screen with both buttons, HeroPath renders as real nodes (never a giant circle) [C1].
- [ ] Keyboard-only run: skip link first; visible ≥3:1 ring on every control, light and navy surfaces [C2]; sheet closes via visible × [C3].
- [ ] No text under 12px; no content at <4.5:1 (including locked/obtained states) [C4, M5].
- [ ] No overlap of Legend/Filter with nodes at 375px; PSA marked "Start here" with no profile [C5].
- [ ] `grep -rn "transition-all\|backdrop-blur\|text-\[11px\]\|slate-\|#[0-9A-Fa-f]\{6\}" src` only hits files with a documented reason.
- [ ] `prefers-reduced-motion: reduce`: no slide/pulse/march, all state changes still visible.
- [ ] Screens at 375 and 1440 attached to the review for Landing, Tree, Sheet (open), Browse.

---

## 4. PHASE 3 — Handoff to `frontend-dev`

**Please:**
1. **Review feasibility** of Wave 1 against the real code and the Next 16 docs in `node_modules/next/dist/docs/`. Anything you disagree with or can't build as written goes in §6 with a proposed alternative. Don't silently skip.
2. **Build Wave 1** (WP-1 … WP-7, WP-6a) in the order in §3. Keep behaviour and data flow intact (store, prepare, tree logic untouched). Do **not** edit `src/data/*`, `src/lib/*` (except if a prop type must widen), or any Wave 2 / owner-decision item.
3. Keep changes lightweight: no new dependencies. If something truly needs one, stop and note it in §6.
4. Append **§6 Frontend-dev notes** and **§7 Change log** to this file (file list, deviations, anything unverified).

### Approval gate

| Item | Status |
|---|---|
| Wave 1 (WP-1…7, 6a) | ✅ **Approved for build** (accessibility, tokens, motion, bug fixes, consolidation; no brand/copy change) |
| Wave 2 (WP-8, 9, 10, 6b) | ⏸ Needs feasibility notes from `frontend-dev` + owner decisions D2, D6 |
| D1–D5 | ⏸ Owner |

---

## 5. Open decisions for the project owner (not blocking Wave 1)

| ID | Decision | Critic's recommendation |
|---|---|---|
| **D1** | Landing hierarchy: make **Preview your ID path** the primary amber button and **Log in or register** the outlined secondary? | **Yes.** The low-friction action is what first-timers want; registration converts better *after* they see their path. Needs your product call. |
| **D2** | Replace the floating left Dock with a bottom tab bar (mobile) / left rail (desktop)? | **Yes.** It removes the overlap hacks and labels the icons. |
| **D3** | Typeface: keep Plus Jakarta Sans, or pair a distinct display face for the landing h1/logo (e.g. Bricolage Grotesque) with a high-legibility body face (e.g. Atkinson Hyperlegible Next; verify it exists in `next/font/google` first)? | Keep for Wave 1. Revisit after the system is clean; do it as one deliberate change. |
| **D4** | Landing/meta copy: h1 `Philippine government IDs, step by step`, sub `{CARDS.length} IDs in 4 tiers. One unlocks the next. See what to bring, what it costs and where to apply, whether you are a student, a young adult or a first-time jobseeker.` Page `<title>` to English with the Filipino tagline kept in the logo/onboarding voice. | **Yes**, since the count is read from `CARDS.length` rather than hard-coded. Keep "Kumusta" in onboarding. |
| **D5** | Keep the "Everyone's progress" member leaderboard (`ProgressScreen.tsx:155`)? | **Remove or make opt-in.** It exposes names and ID counts on shared devices. |
| **D6** | Move screen state to URL query params (WP-9)? | **Yes**, as its own task after Wave 1. |

**Owner decisions (relayed by the coordinator, recorded by frontend-dev):**

| ID | Decision | Effect |
|---|---|---|
| D1 | **Approved** | Landing: "Preview your ID path" is the amber primary (`variant="cta"`) and comes first; "Log in or register" is the outlined secondary (`variant="onDark"`). Copy unchanged. The note "Free · No account needed to preview" sits directly under the Preview button. **Built (Wave 1).** |
| D2 | Approved, **Wave 2** | Bottom tab bar / left rail is not built now. Dock kept, WP-1 fixes only. |
| D3 | Keep Plus Jakarta Sans | No change. |
| D4 | **Not applied** | Landing h1/sub and page title stay as they are. |
| D5 | **Approved** | "Everyone's progress" section, the `board` variable, the `users` prop and the `Trophy` import are removed; `App.tsx` no longer passes `users`. Store untouched. **Built (Wave 1).** |
| D6 | Approved, **later task** | URL state not built. |

---

## 6. Frontend-dev notes

### 6.0 Environment limits (important for the critic)
- My toolset has no shell: I could **not** run `npm run lint`, `npm run build`, `tsc` or a browser. Everything below is code-read only. Please run lint/build first and send errors back.
- I could not delete files, so `public/*.svg` (Next template assets) are still there (WP-2.5). Safe to delete: nothing in `src` references them.
- I did not touch `layout.tsx`, `next/font`, `viewport` or routing, so no Next 16 doc lookup was needed for the changes made. Wave 2 WP-9 will need it.

### 6.1 Wave 1: disagreements, deviations and alternatives
1. **WP-1.1 focus system: simpler than written.** The plan swaps `outline-none focus-visible:ring…` for explicit `focus-visible:outline-[3px] … outline-[color:var(--focus)]` on button/input/tabs. I instead **removed** `outline-none` and the ring classes there and let the single global `:focus-visible { outline: 3px solid var(--focus) }` rule do the work. Same result, one place, no utility-vs-base layering fight. `focus-visible:border-ring` stays on `Input` (border goes civic as an extra cue).
2. **WP-5 hero path: PSA -> Barangay -> Postal ID, not National ID.** The plan names *National ID* as the third node. In `cards.ts`, Barangay Clearance is **not** a prerequisite of the National ID (`philsys` needs `any: psa | passport | lto | mysss`); the chain that is actually true is `psa -> barangay -> postal` (`postal` has `all: ['barangay']`, `parent: 'barangay'`). I used Postal ID so the hero never shows a path the app contradicts. Statuses come from `statusOf()` with a user who only holds the PSA, so they are true by construction (owned / ready / locked). No new copy: names are `card.short`, status strings are the existing `STATUS_LABEL`.
3. **WP-5 hero layout:** the plan's "fixed ~260x300, above the h1" would push both CTAs below the fold at 375x667 (a vertical 300px stack + h1 + sub). I built **one component with two layouts**: a compact horizontal row (~110px high) below 900px, and a bottom-to-top vertical stepper inside the `ring-1 ring-white/10` frame at >=900px (custom `hero:` breakpoint = 900px via `@theme { --breakpoint-hero: 900px }`). Edges are CSS borders (scaleX/scaleY draw), not SVG, so there is no `preserveAspectRatio` to break. Edges on navy use mist / white-30 instead of civic / locked-line (those are unreadable on navy). At 320x568 the page scrolls a little: the h1 + sub + two 56px buttons alone are taller than 568px, so "everything on one screen at 320x568" is not reachable without cutting copy/button size. At 375x667 and 1440x900 it fits.
4. **Landing h1 size:** `clamp(1.9rem, 8vw, 2.1rem)` on small screens (so 320px does not wrap to 5 lines) and `2.6rem` at >=900px (two-column layout). Typeface and copy untouched.
5. **WP-1.2 close button:** added a new Button size `icon-xl` (44px) instead of overriding `icon-sm` per call; `closeClassName` also sets `[--focus:var(--color-amber)]` because the close button is *not* a descendant of the navy `SheetHeader`, so `.surface-navy` would not reach it.
6. **WP-1.7 aria-pressed:** done as specified. Note for the critic: the label still flips "Make priority" / "Priority" (copy is frozen), so a screen reader hears the state twice ("Priority, toggle button, pressed"). Harmless; a stable label ("Priority") would be better if the owner ever allows a copy change.
7. **WP-1.8 busy label:** "One moment…" -> "Creating account…" / "Logging in…" is a visible button-copy change but is explicitly in WP-1.8, so I did it. Easy to revert.
8. **WP-1.8 error focus:** the store only returns "email already registered" (register) or "doesn't match" (login). I map register errors to the email field and login errors to the password field rather than parsing strings. If the store grows more errors this mapping needs revisiting.
9. **P1 numerals on Onboarding:** removed the "1 · 2 · 3 ·" prefixes from the three section headings (P1 lists them). Those are visible text changes, not button copy; revert if the owner sees them as sequence cues.
10. **Sheet reduced motion:** also sets `translate: none !important` on `[data-slot=sheet-content]` (not in the plan's snippet), otherwise the ending-style `translate-y-full` would still snap the panel down while it fades.
11. **Tailwind 4 gotcha applied everywhere:** `translate-*` and `scale-*` compile to the individual `translate` / `scale` properties, so transitions list `translate` / `scale`, not `transform` (a `transition-[transform,…]` would silently not animate them).
12. **Extra a11y fix not in the plan:** inactive tab label was `text-foreground/60` (about 3.5:1 on muted); raised to `/80` (about 6:1). Also converted the Browse tier headings to the sentence-case Label style (same costume as M2), and gave Browse's chip row vertical padding so the focus ring is not clipped by its `overflow-x-auto`.
13. **WP-2.5 partially done:** README boilerplate replaced; `public/*.svg` not deleted (no delete tool); `--font-heading` alias **kept** because `SheetTitle` still uses `font-heading`; `dark:` variants in `ui/*` left (inert, removing them is churn across shadcn files). `ui/progress.tsx` and `ui/badge.tsx` are unused anywhere; I only removed `transition-all` / ring classes from them. Candidates for deletion.
14. **Left as-is on purpose:** the preview banner (P5), chip-row edge fade (P6), `README`-level cleanups beyond above, Dock `raised`/`liftControls` (Wave 2 WP-8 removes them).
15. **WP-6a.6 pinned tier labels:** not done (see 6b below). The tier pills are now sentence-case 12px Pills inside the canvas, as before.

### 6.2 Wave 2 feasibility (nothing built)
- **WP-8 navigation shell:** feasible. The shell is already split into a `relative` wrapper holding `<main>` and a sibling `<Dock>` (done in Wave 1, nav is out of `<main>`), so swapping Dock for a bottom bar (`<768px`, in-flow, so the canvas just gets shorter) or a left rail (`>=768px`, flex row) is a contained change in `App.tsx`. It deletes `raised` (App) and `liftControls` (SkillTree) and the `marginBottom: 52` hack. One catch: `TrackingBar` is currently `absolute bottom-0` inside the canvas wrapper; with an in-flow tab bar it can stay as is (it sits above the bar), but the safe-area padding then belongs to the tab bar only.
- **WP-9 URL state:** feasible but not trivial. All screens are client components driven by `useState` in `App`. Options: `useSearchParams` (needs a `<Suspense>` boundary around `App` in `page.tsx`, and I must read the Next 16 docs for `useSearchParams` / `useRouter` / `history` handling first) or a lighter `history.pushState` + `popstate` listener with no router involvement. Open questions for the owner: which params (`v`, `id`), `push` vs `replace` for sheet open/close, and what Back does from the first screen. The "screen" state also drives login/logout flows, so those need explicit rules. Recommend its own task, as the critic said.
- **WP-10 desktop layouts:** easy and low risk: wrap Browse list in `md:grid md:grid-cols-2 xl:grid-cols-3` with `max-w-5xl`, same for Progress. Browse's tier sections are `<section>` blocks, so the grid should apply *inside* each section (the `ul`), not to the sections. Progress: place Tracking + By tier in one column, Ready-next in the other.
- **WP-6b pinned tier labels:** feasible, low cost. Do **not** call `useViewport()` in `SkillTree` (it would re-render the whole tree on every pan). Instead add a small child `<TierRail />` inside `<ReactFlow>` that calls `useViewport()` and renders four absolutely positioned pills (`pointer-events-none`, `z-[5]`) at `x: 8px`, `y = (rowY(t) - 46) * zoom + viewport.y`; then delete the in-canvas `tier` node type. Only that tiny component re-renders while panning.

---

## 7. Change log

**Not verified:** no lint, no build, no browser (no shell in my toolset). All of the below is code-read. Highest-risk spots for the critic: Tailwind class merging through the `cn` package (e.g. `hidden`/`whitespace-normal` overrides on `Pill`, `hover:text-white` over the ghost variant's `hover:text-foreground`), the `hero:` custom breakpoint, `setState`-during-render in `IdNode`, and the sheet's `data-ending-style:duration-[…]` utility.

### Files created
- `src/components/ui/chip.tsx` (toggle / action chip, 44px, `pressed` -> `aria-pressed`)
- `src/components/ui/pill.tsx` (tones mist / navy / civic / amber / muted / onDark, 12px)
- `src/components/NodeCircle.tsx` (shared node visual for the tree and the landing hero)
- `src/components/TreeToolbar.tsx` (in-flow legend + filter bar above the canvas)

### Files changed
- `src/app/globals.css`: tokens (`--focus`, `--locked`, `--locked-line`, motion durations, easing), `.surface-navy`, `hero` breakpoint, global focus rule on `--focus`, `touch-action`, tap highlight, `overscroll-behavior` on fine pointers, `text-wrap`, `.focus-ring-within`, 44px React Flow controls on coarse pointers, new keyframes (`ring-pulse`, `edge-flow` limited to 3 loops, `node-got`, `rise`, `edge-draw-*`), reduced-motion block replaced. Palette values untouched.
- `src/components/ui/button.tsx`: new variants `cta`, `brand`, `onDark`; sizes `md`, `lg`, `xl`, `icon-xl`; explicit transitions; press scale .97 / 90ms; no ring classes (global focus rule). `size="lg"` was unused before, so redefining it is safe.
- `src/components/ui/input.tsx`, `ui/tabs.tsx`: focus ring classes removed (global rule), `transition-all` removed, tab inactive contrast raised.
- `src/components/ui/sheet.tsx`: `closeClassName`, 44px close with `size-5` icon, `translate-y-full` slide with 220ms in / 160ms out ease-out, overlay `bg-navy/40`, no backdrop blur.
- `src/components/ui/progress.tsx`, `ui/badge.tsx`: `transition-all` / ring classes removed (unused components).
- `src/components/App.tsx`: skip link, one `<main id="main" tabIndex=-1>` (Dock moved out), sr-only `h1`, focus + `document.title` per screen, loading text, Button for header actions, `TreeToolbar`, canvas wrapper, `priorityId` to the tree, `users` prop dropped (D5), `overscroll-contain`.
- `src/components/SkillTree.tsx`: tokens instead of hex / slate, strokes at full opacity, initial centring (priority -> first ready -> PSA), "Start here" pill, one pulsing node + edge flow only into it, node "got" / "unlock" one-shots, `NodeCircle` + `Pill`, sentence-case tier pills, exports `STATUS_LABEL`.
- `src/components/FilterBar.tsx`: now just the button + anchored panel (kept mounted, 160/120ms, Esc and outside click, `aria-controls`, returns focus), shared `Chip`, 44px Clear, grouped labels.
- `src/components/Landing.tsx`: `HeroPath` of real nodes replaces `MiniTree`, two-column desktop layout, entrance animation, D1 button order/variants.
- `src/components/AuthScreen.tsx`: `aria-invalid` / `aria-describedby`, focus on error field, show-password toggle, `spellCheck`/`autoCapitalize`, busy labels, `<main id>`, Button variants.
- `src/components/Onboarding.tsx`: native hidden radio / checkbox inputs inside labels (real `radiogroup`, no `ul/li` role clash), Button variants, sentence-case labels, numerals removed.
- `src/components/BrowseScreen.tsx`: search attributes + clear button + ellipsis placeholder, shared `Chip` / `Pill`, press feedback, sentence-case tier headings.
- `src/components/ProgressScreen.tsx`: sr-only `h1`, "Your level" eyebrow removed, Buttons for Edit / Make priority / Stop tracking, `aria-pressed` instead of `disabled`, scaleX bars, token-based ring, **leaderboard + `users` prop + `Trophy` removed (D5)**.
- `src/components/DetailSheet.tsx`: WP-7 order (header lede + status pill, unlock hint first when locked, Requirements, Guide, Helps you get, About, References, disclaimer), numeral badges removed, no opacity dimming, `Check` icons instead of glyphs, `or` separator, native checkboxes for prep rows and steps (step text as the accessible name, 44px hit area), shared `Chip` / `Pill`, `aria-pressed` priority button, Button variants, white close button.
- `src/components/TrackingBar.tsx`: nested `progressbar` removed (bar is `aria-hidden`), scaleX, `tabular-nums`, `surface-navy`.
- `src/components/Logo.tsx`: `translate="no"` on the brand name.
- `src/components/Rich.tsx`: inline bold `font-extrabold` -> `font-bold`.
- `README.md`: boilerplate replaced.

### Not done
- Delete `public/*.svg` (no delete tool). WP-6a.6 / WP-6b pinned tier labels (Wave 2). Wave 2 items WP-8, WP-9, WP-10. D2 and D6 are explicitly deferred; D3 / D4 intentionally unchanged.
- No screenshots (no browser).

---

## 8. Critic verification (round 1)

**Automated:** `npx tsc --noEmit` clean · `npm run lint` clean · `npm run build` passes (static `/`, `/_not-found`).

**Checked in the running app** (375px, 320×568 and desktop):

| Finding | Result |
|---|---|
| C1 desktop landing collapses | ✅ Fixed. Real nodes (PSA → Barangay → Postal ID) on desktop and mobile; no giant circle; no horizontal scroll at 320 |
| C2 focus ring | ✅ Global ring is civic `#005A9C` 3px on light surfaces (read from computed style after real Tab presses) |
| C3 invisible close button | ✅ White × at 44×44 on the navy header |
| C4 dimmed content | ✅ Zero elements under full opacity inside the sheet; guide/requirements readable |
| C5 tree first view | ✅ In-flow toolbar (no overlap), "Start here" pill on PSA, 44px zoom controls |
| M5 tiny text | ✅ Smallest sheet text 12px |
| M6 landmarks/title/focus | ✅ One `<main>`, skip link, sr-only h1, focus moves to main, title becomes "Your ID path · MabatID" |
| WP-7 sheet order | ✅ Purpose lede, status pill, Requirements first for an available ID |
| D1 / D5 | ✅ Preview is the amber primary and first; leaderboard removed |
| DoD grep (`transition-all`, `backdrop-blur`, `text-[11px]`, `slate-`, raw hex) | ✅ Clean (only `themeColor` hex in `layout.tsx`, which is correct; remaining `slate` matches are the word "translate") |

**Remaining issues for round 2 (small):**
1. At **320×568** the primary "Preview your ID path" button straddles the fold (top 525, bottom 581) and "Log in or register" is below it; the page scrolls 131px. Compact the HeroPath/h1 spacing when `max-height: 640px` so both buttons fit, or accept as an extreme-size exception.
2. At 375px the toolbar Legend wraps "Locked" onto a second line; tighten gap or shorten swatch spacing so it stays on one row.
3. Not browser-verified yet: signed-in states, Auth, Onboarding, Browse, Progress, filter popover Esc/outside-click, `prefers-reduced-motion`, and the "I have this ID" moment. Needs a pass with an account.
4. `frontend-dev` left `public/*.svg`, `ui/progress.tsx` and `ui/badge.tsx` (unused) undeleted. Safe to remove.
5. Wave 2 (tab bar D2, URL state D6, desktop layouts WP-10) remains unbuilt.

---

## 9. Round 2 change log

**Not verified:** no compiler, lint or browser available; edits are code-read only. Needs a re-check at 320x568, 375x812, 900px+ and the tree toolbar at 375 / 320.

### `src/app/globals.css`
- Added custom variant `short` (utility `short:...`) = `@media (max-height: 640px) and (max-width: 899px)`. Scoped below the `hero` breakpoint so desktop is untouched.

### `src/components/Landing.tsx` (all additions are `short:` only; base and `hero:` classes unchanged, copy and button order unchanged, buttons stay `size="xl"` = 56px)
- Outer wrapper: `short:pt-4 short:pb-5` (was pt-6 / pb-8).
- Content column: `short:gap-5 short:pt-4` (was gap-8 / pt-8).
- h1: `short:text-[length:1.7rem]` (was clamp 1.9rem-2.1rem).
- Sub-line: `short:mt-3 short:text-sm short:leading-snug`.
- Button group: `short:mt-5 short:gap-2` (was mt-8 / gap-3).
- HeroStep: `short:gap-1.5`; `NodeCircle` gets `short:size-14!` (56px, was 72px); connector edge `short:mt-[26px]` so it stays on the circle's centre line.
- Estimated saving about 180px of the 131px overflow (about 50px margin); entrance animation and reduced-motion untouched.

### `src/components/TreeToolbar.tsx`
- Toolbar gap `gap-3` -> `gap-2`; legend `gap-x-3` -> `gap-x-2.5`.
- Legend items: `shrink-0 whitespace-nowrap`, swatch-to-label `gap-1.5` -> `gap-1`, swatches `shrink-0`. Text stays `text-xs` (12px); Filter button unchanged (44px). `flex-wrap` kept on the `ul`, so at 320px it wraps instead of overflowing.
- Follow-up (filter badge case): legend `gap-x-2.5` -> `gap-x-2`; toolbar wrapper gets `[&>button]:px-3` so the Filter button's horizontal padding is 12px instead of 16px (about 12px more legend room in total; height still 44px; FilterBar.tsx untouched).

### `src/components/ui/tabs.tsx`
- Follow-up (tab height): the base list class `group-data-horizontal/tabs:h-8` was overriding the call sites' `h-11`, so lists rendered 32px and triggers 25px. Changed it to `group-data-horizontal/tabs:h-[50px]` (50px list - 6px padding = 44px content) and the trigger from `h-[calc(100%-1px)]` to `h-full min-h-11`, so every trigger is 44px tall. Applies to DetailSheet On-site / Online and the Auth Log in / Register tabs; call-site `h-11` is now inert, so those files were not touched. Colours and active/inactive styles untouched. Note: the trigger class string contains a pre-existing typo `text-foreground/80transition-[...]` (missing space), left as is to keep contrast unchanged.

---

## 10. Critic verification (round 2)

**Automated:** `tsc --noEmit` clean · `npm run lint` clean · `npm run build` passes. Critic fixed one typo left in `ui/tabs.tsx:60` (`text-foreground/80transition-…` missing a space, which had silently voided both the inactive-tab contrast bump and the transition).

**Round 1 leftovers — all closed**

| Issue | Result (measured in browser) |
|---|---|
| 320×568 landing fold | ✅ No scroll (`scrollH` 568); buttons end at y=548, both 56px; 375×812 and desktop unchanged |
| 375px legend wrap | ✅ All three items on one row, also with a filter active (badge showing); no overlap, Filter button 44px |
| Unused files | ✅ Deleted `public/*.svg` (5), `ui/progress.tsx`, `ui/badge.tsx` (no references; recoverable from git) |
| Tab triggers 25px (new, found in round 2) | ✅ Now 44px (list 50px) for sheet On-site/Online and Auth Log in/Register |

**Signed-in pass (test account on localhost, cleared afterwards)**

- Auth: register form, show-password toggle, `spellcheck=false` on email, → Onboarding.
- Onboarding: 20 native checkboxes, two native radio groups with valid owned children; "Show my path · 1 selected" updates.
- Tree: opens centred on first ready node; Obtained → amber node with check, edges light amber; legend on one row.
- Sheet: Track/Priority use `aria-pressed` (no `disabled` hacks); "I have this ID" → status banners + "Undo…" button; Esc closes.
- Filter popover: opens, closes on Esc and on outside click, trigger `aria-expanded`/`aria-controls`.
- Browse: 20 cards, search `autocomplete=off`, ellipsis placeholder, clear button, filtering to 2 for "nbi".
- Progress: title/h1 correct, 4 progress bars, leaderboard gone, no horizontal scroll.
- Reduced motion: stylesheet contains the `prefers-reduced-motion` blocks (animations → 1 iteration/none, sheet slide off, pulse/edge/rise/draw off). Rules read from CSSOM; not exercised with the OS setting.

**Observations to carry into Wave 2 (not bugs in round 1/2 scope)**

1. On Progress and Browse the floating Dock **covers content** (e.g. the "Tier 2 · Primary IDs" row at 375px). This is the problem D2 (bottom tab bar) solves; it is now the highest-value next task.
2. After closing the sheet with Esc, focus lands on the toolbar **Filter** button rather than the node that opened the sheet. Return focus to the originating node (store the opener id and focus its button on close).
3. Tabs in `ui/tabs.tsx` still carry shadcn-leftover `dark:` classes (no dark theme exists).

**Still not verified:** real screen reader, real touch device, the OS-level reduced-motion switch, the "I have this ID" bounce animation by eye (only state/DOM checked).

---

## 11. Tab bar change log

**Not verified:** no compiler, lint or browser available to me; code-read only. Please check at 375x812 and 768/1024+ (rail), signed in and signed out, plus the focus-return behaviour below.

### WP-8 (owner decision D2): Dock replaced by an in-flow navigation bar
`src/components/App.tsx`
- `Dock` removed; new `TabBar` (same `<nav aria-label="Main">`, outside `<main>`, `surface-navy`). Items: "ID path", "Browse IDs", and "Progress" only when signed in. Each is a `<button>` (min height 56px) with the icon (`size-6`) in a 56x32 fully rounded pill over a **visible** 12px / weight 600 label. Active: pill `bg-amber text-navy`, label white, `aria-current="page"`. Inactive: icon and label `text-white/80`, pill gets `hover:bg-white/10` (via `group-hover`, so fine pointers only). Press: `active:scale-[0.97]` at 90ms, release 140ms; colour transitions 140ms; no layout animation. The old `title` / `aria-label` were dropped because the visible label is now the accessible name (text is identical).
- Layout: the area under the header is `flex min-h-0 flex-1 flex-col md:flex-row` holding the nav and `<main>`. **Below 768px** the nav is a full-width bar at the bottom (`order-last`, in flow, `border-t`, `pb-[env(safe-area-inset-bottom)]`). **From 768px** it is an 80px-wide left rail (`md:order-first`, `md:flex-col`, items stacked and top-aligned with `gap-2`, `border-r`). `<main>` is `min-w-0 flex-1`. The only scroll containers are still the Browse / Progress wrappers (`overflow-y-auto`), so no double scrollbars.
- DOM order is nav first, then main, and the bar is moved below visually on small screens with `order-last`. Reason: on desktop the rail is first in tab order; the trade-off is that on mobile, keyboard/screen-reader order is nav -> main while the bar is visually at the bottom. The skip link still jumps over the header to `<main>`. Easy to flip if you prefer DOM = visual order on mobile.
- Removed the `raised` prop (App), and the `pb-24` padding on the Browse and Progress scroll containers (now `pb-6`).
- Skip link, focus-to-`#main` on screen change, `document.title` and the sheet (portaled, `z-50`, `fixed`) are untouched, so the sheet still sits above the bar.

`src/components/SkillTree.tsx`
- Removed the `liftControls` prop and the `marginBottom: 52` style on `<Controls>`.

`src/components/TrackingBar.tsx`
- No longer `absolute`: it is now an in-flow strip (`relative z-10 w-full shrink-0`) rendered by `App` directly after the canvas wrapper inside `<main>`, so the canvas shrinks and the bar sits directly above the tab bar (on desktop: at the bottom of the main area beside the rail). Removed its own safe-area padding (the tab bar owns the inset). Content, `aria-label` and button role unchanged.

### Related fix: return focus to the opener when the sheet closes
- `ui/sheet.tsx` already spreads props onto Base UI's `Dialog.Popup`, which supports `finalFocus` as a function (checked `DialogPopup.d.ts` and `FloatingFocusManager.js`: it resolves the element when the popup unmounts and focuses it with `preventScroll: true`, plus `focusVisible` on keyboard close). `DetailSheet` takes a new optional `finalFocus?: () => HTMLElement | null` and passes it to `SheetContent`; the Dialog primitive is otherwise unchanged.
- `App.tsx` supplies `returnFocusTo`: (1) `[data-card-id="<last selected id>"]` if present, else (2) the element that had focus when the sheet was first opened (stored in `select`, ignoring focus that is inside the sheet so jump chips do not overwrite it), else (3) `#main`. Uses two refs (`openerRef`, `selectedRef`) written only inside callbacks.
- Tagged with `data-card-id`: tree node button (`SkillTree.tsx`), Browse card (`BrowseScreen.tsx`), Progress tracked-row and "Ready to get next" buttons (`ProgressScreen.tsx`). I did **not** tag the jump chips: they live inside the sheet and are unmounted before focus is restored, so tagging them would be dead code. Jumping A -> B -> close therefore focuses B's node/card, as requested.
- Note: from Progress, picking an ID switches to the tree first, so focus returns to that ID's tree node (the Progress row no longer exists).

### Things to check
- At 375px the bar height is about 62px + safe-area inset; confirm the tree canvas, toolbar and TrackingBar still fit at 375x667 with a priority set.
- Filter popover (`z-30` inside the toolbar's stacking context) must still draw above the TrackingBar / canvas.
- `layout.tsx` does not set `viewport-fit=cover`, so `env(safe-area-inset-bottom)` is 0 in normal iOS Safari (the browser already keeps content above the home indicator); it only matters in standalone / cover mode. I did not touch `layout.tsx`.
- Esc / X / overlay close from a tree node, a Browse card, and after a jump chip should all land on the right node/card with a visible focus ring.

---

## 12. Critic verification (Wave 2: tab bar, WP-8)

**Automated:** `tsc --noEmit` clean · `npm run lint` clean · `npm run build` passes. Class-name scan for glued tokens (missing spaces) is clean.

**Critic fixes after `frontend-dev` hand-back** (both were missing-space typos that silently voided classes; the earlier round-2 "one row" measurement had only passed because the legend had zero gaps):
1. `TreeToolbar.tsx`: `gap-x-2gap-y-1` → `gap-x-1.5 gap-y-1`; toolbar side padding `px-3` → `px-2.5`; removed the dead `[&>button]:px-3` selector and set `px-3` on the Filter trigger in `FilterBar.tsx`. Legend now sits on one row at 375px **with the filter badge showing**, with real 6px gaps and 14px clear of the Filter button.
2. (previous round) `ui/tabs.tsx` `80transition` typo.

**Tab bar measured in the browser**

| Check | Result |
|---|---|
| 375×812, signed out | In-flow bar 63px, items 56px, 12px visible labels, `nav` outside `main`, no overlap with canvas or zoom controls, no page scroll |
| 375×667, signed in with priority | Header 60 + toolbar 49 + canvas 447 + TrackingBar 48 + nav 63 = 667. Nothing overlaps; no scroll |
| 768×900 | Left rail 80px wide, full height under the header, items 56px at 12px spacing, main starts at x=80, TrackingBar spans main only |
| 320×568 | Three items 99px each, no clipped labels, no horizontal scroll |
| Browse / Progress at 375×667 | Scroll area ends exactly at the nav top; last content clears the bar; no double scrollbars; active tab and `document.title` correct |
| States | Active = navy on amber pill + white label; inactive = white at 80% on navy; focus ring amber 3px on navy |
| Dock overlap (Wave 1 observation #1) | ✅ Resolved |

**Focus return on sheet close** — final focus target is correct for X, overlay, Esc, and after a jump chip (A → B, close → B's node). Ring is the 3px civic outline. In this hidden browser pane `requestAnimationFrame` runs at 1 fps, so focus appeared to arrive ~1s late; that is an artifact of the test environment, not the product.

**Remaining**
1. WP-9 URL state (D6) and WP-10 desktop layouts are still unbuilt.
2. Not verified: real screen reader, real touch device, iOS home-indicator behaviour (no `viewport-fit=cover`, so `env(safe-area-inset-bottom)` is 0 in normal Safari, which is fine), OS-level reduced motion.
3. DOM order is nav-then-main (rail first on desktop); on mobile the bar is visually at the bottom but first in tab order. Acceptable; flip if you prefer DOM order to match the visual order.

---

## 13. URL state change log

**Not verified:** no compiler, lint, build or browser available to me; code-read only. The build is the main thing to check (Suspense + `/` still prerendered), then the history behaviour in a browser (Back/Forward/refresh/deep links).

### Next.js docs read first (16.4.6, `cacheComponents: true`, `partialPrefetching: true`)
- `useSearchParams` (app/api-reference/functions): on a prerendered route the Client Component tree up to the closest `<Suspense>` is client-rendered; without a boundary the production build fails ("Missing Suspense boundary with useSearchParams"). The fallback becomes the initial HTML.
- `linking-and-navigating` ("Native History API"): Next.js integrates `window.history.pushState` / `replaceState` into the router, so `useSearchParams` / `usePathname` update when the URL changes. This is why I used the native History API instead of `router.push/replace`: no server round trip for what is purely client state, and Back/Forward are handled by Next's popstate handling. `router.back()` is just history back, so I call `window.history.back()` (deviation from "use router.back()", same behaviour).
- `cacheComponents` doc: nothing else needed here; the page itself does not read request data, so `/` stays prerendered (static shell = the navy loading fallback).

### Files
- **New `src/lib/route.ts`** (pure, no React/window): `View` / `Screen` types, `readRoute()` (validates `v` and `id`; unknown values are dropped and flagged), `resolveRoute()` (guards), `buildUrl()` (canonical `/` or `/?v=..&id=..`). Card ids are validated with `hasOwnProperty` against `CARD_BY_ID` (so `id=constructor` is rejected).
- **New `src/lib/useAppRoute.ts`** (`"use client"`): `useAppRoute(signedIn, ready)` reads with `useSearchParams`, writes with the native History API, and returns `{ screen, openId, go, home, back, openCard, closeCard }`. Callbacks read the latest route through a ref so they keep a stable identity (they feed the memoised tree nodes); `write()` updates that ref immediately so two calls in one handler compose.
- **New `src/components/AppLoading.tsx`**: the navy `role="status" aria-busy` + sr-only "Loading…" markup, shared by `App` (store not ready) and the Suspense fallback.
- **`src/app/page.tsx`**: `<App />` wrapped in `<Suspense fallback={<AppLoading />}>` inside `StoreProvider`.
- **`src/components/App.tsx`**: `useState<Screen>` and `sheetOpen` removed. `view` and `openId` come from the URL; DetailSheet `card` is `openId ? CARD_BY_ID[openId] : null`. `selected` stays as state and follows the URL during render (`seenId` pattern) so deep links and Back/Forward light the right node. `selectedRef` for the focus-return logic is synced from `openId` in an effect. Landing, Auth, Onboarding, header buttons, tab bar, Progress "Edit" / pick and the sheet's sign-up button now call the route functions. `TabBar` keeps real `<button>`s with `aria-current` (items typed `View`).
- Untouched: store, prepare, tree logic, filters, Browse search, copy and visuals. No new route files, no dependencies.

### URL model
- `v` = `tree | browse | progress | auth | edit`; `id` = a card id. No param: Landing signed out, ID path signed in. `id` without `v`: ID path with that sheet (signed-out preview mode, no Landing).
- Guards (`resolveRoute`): unknown `v` or `id` -> dropped and URL tidied; `progress` / `edit` signed out -> `tree`; `auth` signed in -> `tree`. Tidying is a `replaceState` run only after the store is `ready`, so a signed-in deep link to `?v=progress` is not "fixed" before the account loads. Signed-in with no `v` stays `/` (no rewrite). First-run onboarding still takes over regardless of URL; its save does `replace` to `?v=tree` and keeps `id`.
- Not in the URL (as requested): filters, Browse search text, the tree highlight.

### History model (push vs replace)
| Action | Method | Why |
|---|---|---|
| Tab bar / header buttons to another view | push | Back returns to the previous view. Tapping the active tab is a no-op (no duplicate entry) |
| Landing "Preview your ID path" | push `?v=tree` | |
| Landing "Log in or register", header "Log in / Register", sheet "Create a free account" | push `?v=auth` | Back returns to where the user was |
| Open a sheet (node, Browse card, TrackingBar) | push `?v=..&id=..` | Back closes it |
| Progress row pick | push `?v=tree`, then push `&id=..` | closing returns to the ID path, Back again to Progress |
| Jump chip inside the sheet (A -> B) | replace `id` | Back closes the sheet in one step |
| Close sheet (X / overlay / Esc) | `history.back()` if this session pushed it, else replace without `id` | no dead-end entry; deep-linked sheet just loses `id` |
| Auth success | replace `?v=tree` | Back never returns to the form |
| Onboarding save | replace `?v=tree` (+ `id` kept) | |
| Logout | replace `/` | |
| Auth "Back" / Edit "Cancel" | `history.back()` if the entry was pushed this session, else replace (`/` or `?v=progress`) | no loops after a refresh or deep link |
| Invalid / guarded URL | replace (after `ready`) | |
"Pushed this session" is tracked in a small ref (`sheet`, `auth`, `edit`) that is cleared whenever the URL no longer shows that state (so browser Back/Forward keep it honest).

### Deviations / limitations
1. Native `history.pushState` / `replaceState` + `window.history.back()` instead of `useRouter` (see docs note above).
2. Tab bar items stay `<button>`s, so Cmd/Ctrl-click does not open a new tab (nice-to-have only).
3. Logout replaces only the current entry; earlier history entries (e.g. `?v=progress`) still exist, but they now render as the signed-out guard result (`tree` preview) rather than signed-in screens.
4. After a logout/login in the same tab, "pushed this session" flags are not reset beyond the URL-based cleanup; the worst case is a replace instead of a back, never a wrong exit.
5. Auth "Back" now returns to where the user came from (e.g. the tree with a sheet open after "Create a free account"), not always to the Landing.

### Please check
- `npm run build`: `/` still prerendered, no "missing Suspense" error; view-source of `/` shows the loading fallback.
- Deep links and refresh: `/?v=browse`, `/?v=tree&id=nbi`, `/?id=psa`, `/?v=progress` (signed out -> tree), `/?v=bogus`, `/?id=nope` (tidied), `/?v=auth` while signed in.
- Back/Forward: tree -> open sheet -> Back (closes) -> Forward (reopens); jump chips then Back (one step); focus and `document.title` update on Back/Forward; finalFocus return still lands on the node.
- That Next's popstate handling for `pushState` entries does not trigger a visible reload or scroll jump for these same-page entries (the one thing I could not confirm from the docs).

---

## 14. Critic verification (WP-9 URL state)

**Automated:** `tsc --noEmit` clean · `npm run lint` clean · `npm run build` passes, `/` still prerendered (static). Glued-class scan clean.

**Critic fixes after `frontend-dev` hand-back**
1. **Logout landed on `?v=tree`, not Landing.** `home()` replaced the URL with `/`, but in the same tick `logout()` made `signedIn=false` while `useSearchParams` still held `?v=progress`; the "fix invalid URL" effect then overwrote `/` with `/?v=tree`. `useAppRoute.ts`: the effect now re-reads `window.location.search` instead of the render-time snapshot. Verified: Log out from Progress → `/` + Landing.
2. **Hydration error on every load** (found in the console: "Hydration failed… server rendered `<div role=status aria-busy>`, client rendered `<main id=main>`"). Cause: wrapping `App` in Suspense lets React hydrate it after the store's own effect has set `ready=true`, so the first client render (Landing) differed from the prerendered loading screen. Added `src/lib/useHydrated.ts` (`useSyncExternalStore`, false on server and during hydration) and `App.tsx` now treats the app as ready only when `storeReady && hydrated`. Verified: 0 hydration errors across 3 fresh loads (it was 1 per load before).

**Verified in the browser** (375×812; pane brought into view so animation frames run)

| Case | Result |
|---|---|
| `/?v=browse` | Browse, tab active, title correct |
| `/?v=tree&id=nbi`, `/?id=psa` | Tree + sheet open for that ID, node highlighted |
| `/?v=progress` signed out | → `/?v=tree` (replaced) |
| `/?v=bogus`, `/?id=nope` | → `/` Landing (cleaned) |
| `/?v=tree&id=constructor` | `id` rejected (own-property check), → `/?v=tree` |
| `/?v=auth` signed out / signed in | Auth form / → `/?v=tree` |
| `/?v=progress`, `/?v=edit`, `/` signed in | Progress / "Update your checklist" with Cancel / tree |
| History: Landing → Preview → open → jump chip | push, push, **replace** (length unchanged); one Back closes the sheet, Forward reopens, Back returns to tree then Landing |
| Tab bar | push per view change; Back walks views in order |
| Close sheet (X) after in-session open | `history.back()`; length unchanged |
| Close sheet (X) on a deep link | `replaceState` to `?v=tree`, same host, length unchanged, focus returns to the node, sheet removed in ~200ms |
| Cancel on deep-linked edit | → `?v=progress` |
| Back after logout | shows guest preview only, no signed-in content |

**Observations (not bugs)**
- `?v=auth&id=nbi` drops `id` once login succeeds (the existing sign-up handler already clears the selection). A guest who taps "Create a free account" from a sheet returns to the tree, not that sheet.
- Tab bar items are still buttons, so Cmd/Ctrl-click does not open a new tab. Upgrade to `next/link` later if desired.
- Filters, search text and the tree highlight are not in the URL (out of scope for D6).

**Still not verified:** real touch device, screen reader, the Progress-row "push tree then id" path by hand.

---

## 15. Merge with the collaborator's work (origin/main 06c5455)

**What came in** (Ian Villaraza, 2 commits): personalized skill-tree paths replacing fixed tiers, acquisition planner (`lib/planner/*`, `/api/plans/*` routes), new data model (`CredentialGroup`, `CardKind`), facts/documents/eligibility, device-profile auth (no passwords), TreeAdvisor, AcquisitionPlan, 72 tests (`npm test`, new `tsx` dev dependency).

**How it was merged:** 11 files conflicted (~74 hunks). Rule: **their logic, data model, props and copy win; our design/a11y/route/tab-bar work is re-applied on top.** Their side was taken per file and our changes re-applied from per-file patches by two `frontend-dev` threads; the critic ran the checks.

**Result:** `tsc` clean · `eslint` clean · **72/72 tests pass** · `next build` passes (`/` static, `/api/plans/*` dynamic).

**Critic fixes during the merge**
1. `route.ts`: only `progress` is guarded for guests; their guests may open `?v=edit` (edit starting point). Verified: guest `?v=edit` shows "Update your checklist" with native radios.
2. `App.tsx`: root now `overflow-hidden`. Their FilterBar renders two closed popovers (invisible, 533px tall); they extended the document scroll to 970px so the page itself could scroll. Verified `scrollHeight == innerHeight` at 375×812 and 768×900.
3. `AcquisitionPlan.tsx`: `<small>` defaulted to 11.2px; now `text-xs`.

**Adapted because of their data model**
- Tiers → credential groups everywhere (Browse headings, filter chips, progress). Hero path is PSA → Barangay Clearance → Postal ID, read from their overview `parent` links.
- Tree node statuses are theirs (`owned`, `available`, `preparation`, `confirmation`, `ineligible`, `unresolved`); NodeCircle was rewritten for them. "Start here" / single pulse / `node-got` kept; the unlock pulse was dropped (statuses change asynchronously when the assessment arrives).
- Auth: their device-profile flow (name + age, no password) replaced our tabs/password/show-password; our aria-invalid/describedby/focus-on-error and Button variants kept.
- Detail sheet: their structure (plan, eligibility, requirements, steps, acceptance, notes) kept; our close button, status pill, no dimming, native checkboxes, `finalFocus`. "Unlock by getting" dropped (`unlockHint` no longer exists; the acquisition plan covers it).
- Copy: theirs wins (h1 "IDs & documents", "Open device profile", "Free · No profile needed to preview", etc.).

**Verified in the merged app** (375×812, 768×900): landing (hero path, D1 order, one screen), tree (single `main`, tab bar, rail at 768), sheet (white 44px close, no dimmed elements, headings), Browse (21 cards, search attrs, title), guest edit, auth screen, no console errors/hydration warnings, no page scroll.

**Known issues / follow-ups**
1. **Tree space at 375px:** header 60 + preview banner 56 + TreeAdvisor 269 (cap 40dvh) + toolbar 49 + tab bar 63 leaves a **315px canvas** at 812px tall and ~170px at 667px. Make the advisor collapsible (default collapsed on narrow screens) or shrink the preview banner.
2. **Legend wraps to 2 rows at 375px** (their new Groups icon button + Filter). Also the 3-item legend (Obtained / Ready to get / Locked) no longer matches their six statuses; replace it with a "Tree key" popover.
3. **Focus return on sheet close not re-verified** after the merge (the browser window was hidden, so animation frames stalled). The code path (`finalFocus` + `data-card-id`) is unchanged and was verified before the merge.
4. Edge arrowheads use CSS variables for colour (`--edge-owned`); confirm they render in a visible browser.
5. Rail label "Browse IDs & documents" wraps to 3 lines in the 80px rail.
6. Real screen reader, touch device and OS reduced-motion still untested.
