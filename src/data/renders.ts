/**
 * 3D renders of each ID / document, served from /public/renders (WebP, max 1000px on the long side).
 * `back` is the reverse side (or, for the passport, the open data page).
 */
export interface CardRender {
  front: string;
  back?: string;
  /** Label for the second face. Defaults to "Back". */
  backLabel?: string;
  /** Portrait renders (documents, vertical IDs) get a taller stage. */
  portrait?: boolean;
}

const r = (id: string, opts: Omit<CardRender, "front" | "back"> & { back?: boolean } = {}): CardRender => ({
  front: `/renders/${id}.webp`,
  back: opts.back ? `/renders/${id}-back.webp` : undefined,
  backLabel: opts.backLabel,
  portrait: opts.portrait,
});

export const RENDERS: Record<string, CardRender> = {
  psa: r("psa", { portrait: true }),
  barangay: r("barangay", { portrait: true }),
  cedula: r("cedula"),
  "barangay-id": r("barangay-id", { back: true }),
  school: r("school", { portrait: true }),
  philhealth: r("philhealth", { back: true }),
  tin: r("tin", { back: true, portrait: true }),
  nbi: r("nbi"),
  npc: r("npc"),
  comelec: r("comelec", { portrait: true }),
  postal: r("postal"),
  philsys: r("philsys", { back: true }),
  passport: r("passport", { back: true, backLabel: "Inside", portrait: true }),
  lto: r("lto", { back: true }),
  mysss: r("mysss"),
  pagibig: r("pagibig"),
  prc: r("prc", { back: true }),
  pwd: r("pwd"),
  soloparent: r("soloparent"),
  owwa: r("owwa", { back: true }),
  senior: r("senior"),
};
