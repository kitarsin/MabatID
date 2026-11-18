/** Uses only disposable QA data. Start the production server, then run with npx tsx. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { exportBackup } from "../src/lib/backup";
import { normalizeProfile } from "../src/lib/profile";
import { revise } from "../src/lib/revisions";

async function main() {
  loadEnvConfig(process.cwd());
  const origin = process.env.TRANSFER_TEST_ORIGIN ?? "http://127.0.0.1:3177";
  assert.ok(["127.0.0.1","localhost"].includes(new URL(origin).hostname),"Live verification targets a local app server only.");
  assert.ok(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  const db = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const id = randomUUID(), ownerToken = randomBytes(32).toString("hex"), claimToken = randomBytes(32).toString("hex");
  const profile = await revise(normalizeProfile({ id: randomUUID(), name:"Disposable relay verification",age:24,owned:["psa"],createdAt:1,onboarded:true })!);
  const backup = await exportBackup(profile);
  const post = async (action: string, body: unknown, status=200) => {
    const response = await fetch(`${origin}/api/transfers/${action}`,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
    assert.equal(response.status,status,`${action} status`); return response.json();
  };
  try {
    assert.equal((await (await fetch(`${origin}/api/transfers/status`)).json()).enabled,true);
    const code = await post("create",{id,ownerToken,backup});
    const stored = await db.from("mabatid_transfers").select("ciphertext").eq("id",id).single();
    assert.equal(stored.error,null); assert.ok(stored.data?.ciphertext && !stored.data.ciphertext.includes(profile.name));
    const retry = await post("create",{id,ownerToken,backup}); assert.equal(retry.code,code.code);
    const claim = await post("claim",{code:code.code,claimToken}); assert.equal(claim.backup,backup);
    await post("claim",{code:code.code,claimToken:randomBytes(32).toString("hex")},404);
    await post("finish",{id,claimToken}); await post("finish",{id,claimToken});
    const erased = await db.from("mabatid_transfers").select("ciphertext,completed_at").eq("id",id).single();
    assert.equal(erased.data?.ciphertext,null); assert.ok(erased.data?.completed_at);
    console.log("Live Supabase relay passed: encrypted upload, idempotent creation, exact backup retrieval, exclusive claim, retryable completion, payload erasure.");
  } finally {
    const result = await db.from("mabatid_transfers").delete().eq("id",id);
    assert.equal(result.error,null,"Disposable relay data cleanup");
  }
}
main().catch((error) => { console.error(error instanceof assert.AssertionError ? `${error.message} (actual: ${String(error.actual)}, expected: ${String(error.expected)})` : "Relay verification failed without displaying credentials.");process.exitCode=1; });
