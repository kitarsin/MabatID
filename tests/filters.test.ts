import assert from "node:assert/strict";
import test from "node:test";
import { CARDS, CARD_BY_ID } from "../src/data/cards";
import {
  activeFilterCount,
  matchSet,
  NO_FILTERS,
  type Filters,
} from "../src/lib/filters";
import { buildEdges } from "../src/lib/tree";

test("type filters distinguish identity credentials from certificates and clearances", () => {
  const ids = matchSet({ ...NO_FILTERS, kind: "id" })!;
  const documents = matchSet({ ...NO_FILTERS, kind: "document" })!;
  for (const id of ["barangay-id", "school", "passport", "philsys", "prc"]) {
    assert.equal(ids.has(id), true, id);
    assert.equal(documents.has(id), false, id);
  }
  for (const id of ["psa", "barangay", "cedula", "nbi", "npc", "comelec"]) {
    assert.equal(documents.has(id), true, id);
    assert.equal(ids.has(id), false, id);
  }
  assert.equal(ids.size + documents.size, CARDS.length);
});

test("type is independent of tier and significance and combines with existing filters", () => {
  const mixedTier: Filters = {
    ...NO_FILTERS,
    kind: "document",
    tiers: [1],
    category: "supporting",
    budget: "low",
  };
  const documents = matchSet(mixedTier)!;
  assert.equal(documents.has("nbi"), true);
  assert.equal(documents.has("npc"), true);
  assert.equal(documents.has("comelec"), true);
  assert.equal(documents.has("school"), false);
  assert.equal(documents.has("psa"), false);
  const ids = matchSet({ ...mixedTier, kind: "id" })!;
  assert.equal(ids.has("barangay-id"), true);
  assert.equal(ids.has("nbi"), false);
  assert.equal(ids.has("passport"), false);
  assert.ok(
    [...ids].every(
      (id) => CARD_BY_ID[id].kind === "id" && CARD_BY_ID[id].tier === 1,
    ),
  );
  assert.equal(
    matchSet({ ...NO_FILTERS, kind: "document", category: "primary" })?.size,
    0,
  );
});

test("type selection participates in the active count and Clear restores all types", () => {
  assert.equal(activeFilterCount(NO_FILTERS), 0);
  assert.equal(activeFilterCount({ ...NO_FILTERS, kind: "document" }), 1);
  assert.equal(
    activeFilterCount({
      kind: "id",
      category: "supporting",
      budget: "low",
      tiers: [1, 2],
    }),
    4,
  );
  assert.equal(matchSet({ ...NO_FILTERS, kind: null }), null);
});

test("filtering to IDs retains the document prerequisites in the underlying graph", () => {
  const ids = matchSet({ ...NO_FILTERS, kind: "id" })!;
  assert.equal(ids.has("barangay"), false);
  assert.equal(ids.has("barangay-id"), true);
  assert.ok(
    buildEdges().some(
      (edge) => edge.source === "barangay" && edge.target === "barangay-id",
    ),
  );
});
