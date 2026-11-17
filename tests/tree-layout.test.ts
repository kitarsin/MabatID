import assert from "node:assert/strict";
import test from "node:test";
import { CARD_BY_ID } from "../src/data/cards";
import { layoutTree, NODE_H, NODE_W } from "../src/lib/tree";
import { normalizeProfile } from "../src/lib/profile";

test("reassigned branches stay inside the graph and leave nonoverlapping space for every card", () => {
  const { placed, width, height } = layoutTree();
  for (const node of placed) {
    assert.ok(node.x >= 0 && node.x + NODE_W <= width, node.card.id);
    assert.ok(node.y >= 0 && node.y + NODE_H <= height, node.card.id);
    for (const other of placed) {
      if (other === node) continue;
      const overlaps =
        node.x < other.x + NODE_W &&
        node.x + NODE_W > other.x &&
        node.y < other.y + NODE_H &&
        node.y + NODE_H > other.y;
      assert.equal(
        overlaps,
        false,
        `${node.card.id} overlaps ${other.card.id}`,
      );
    }
  }
});

test("credential-group changes preserve saved inventory and target references without a profile migration", () => {
  const saved = normalizeProfile({
    id: "group-update",
    name: "CredentialGroup update",
    age: 30,
    createdAt: 1,
    onboarded: true,
    owned: ["postal", "company-id", "lcro-birth", "umid"],
    tracking: ["mysss", "pagibig"],
    priority: "mysss",
    modes: { mysss: "online", pagibig: "onsite" },
  });
  assert.ok(saved);
  assert.deepEqual(
    new Set(saved.owned),
    new Set(["postal", "company-id", "lcro-birth", "umid"]),
  );
  assert.deepEqual(new Set(saved.tracking), new Set(["mysss", "pagibig"]));
  assert.equal(saved.priority, "mysss");
  assert.deepEqual(saved.modes, { mysss: "online", pagibig: "onsite" });
  assert.equal(CARD_BY_ID[saved.priority!].id, "mysss");
});
