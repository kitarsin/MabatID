import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_BY_ID } from "../src/data/cards";
import { GUIDES } from "../src/data/guides";

test("every guide step points at a real ID and appears once", () => {
  for (const guide of GUIDES) {
    const ids = guide.steps.map((s) => s.cardId);
    assert.equal(new Set(ids).size, ids.length, `${guide.id} repeats an ID`);
    for (const id of ids) assert.ok(CARD_BY_ID[id], `${guide.id}: unknown ${id}`);
    assert.ok(guide.steps.some((s) => !s.optional), `${guide.id} has no required step`);
  }
});

import { DETAILS } from "../src/data/details";
import { evaluatePrepare } from "../src/lib/prepare";

test("someone with no IDs can still complete PSA's ID requirement through a family member", () => {
  const requester = (manual: string[]) =>
    evaluatePrepare("psa", new Set(), new Set(manual), { age: 20, mode: "onsite" }).nodes.find(
      (n) => n.kind === "either" && n.key === "requester",
    );
  const before = requester([]);
  const after = requester(["family-request"]);
  assert.ok(before && before.kind === "either" && !before.complete);
  assert.ok(after && after.kind === "either" && after.complete);
});

test("every case-by-case requirement says when it applies", () => {
  for (const [id, d] of Object.entries(DETAILS))
    for (const e of d.req.prepare)
      if (!("either" in e) && (e.when || e.opt))
        assert.ok(e.onlyIf, `${id}.${e.id} needs an onlyIf label`);
});
