import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { normalizeProfile } from "../src/lib/profile";
import { exportBackup } from "../src/lib/backup";
import { revise } from "../src/lib/revisions";
import { relayConfig, relayHandler, TransferRelay, type RelayDatabase } from "../src/lib/transfers/server";
import { formatCode, normalizeCode, validCode, validToken } from "../src/lib/transfers/protocol";

interface Row { id: string; codeHash: string; ownerHash: string; ciphertext: string | null; claimHash: string | null; expiresAt: string; completed: boolean }
class Database implements RelayDatabase {
  rows = new Map<string,Row>(); counters = new Map<string,number>(); now = Date.now(); fail = false;
  async rpc(name: string, p: Record<string,unknown> = {}) {
    if (this.fail) throw new Error("PRIVATE DATABASE DETAILS");
    if (name.endsWith("health")) return 1;
    if (name.endsWith("rate")) { const key = String(p.p_bucket); const n = (this.counters.get(key) ?? 0)+1; this.counters.set(key,n); return n <= Number(p.p_limit); }
    if (name.endsWith("create")) {
      let row = this.rows.get(String(p.p_id));
      if (row && (row.ownerHash !== p.p_owner_hash || row.completed)) return null;
      if (!row) { row = { id: String(p.p_id), codeHash: String(p.p_code_hash), ownerHash: String(p.p_owner_hash), ciphertext: String(p.p_ciphertext), claimHash: null, expiresAt: new Date(this.now+600000).toISOString(), completed: false }; this.rows.set(row.id,row); }
      return { id: row.id, ciphertext: row.ciphertext, expiresAt: row.expiresAt };
    }
    if (name.endsWith("claim")) {
      const row = [...this.rows.values()].find((r) => r.codeHash === p.p_code_hash && Date.parse(r.expiresAt)>this.now);
      if (!row || (row.claimHash && row.claimHash !== p.p_claim_hash)) return null;
      row.claimHash = String(p.p_claim_hash); return { id: row.id, ciphertext: row.ciphertext, expiresAt: row.expiresAt, completed: row.completed };
    }
    const row = this.rows.get(String(p.p_id)); if (!row) return false;
    if (name.endsWith("revoke")) { if (row.ownerHash !== p.p_owner_hash) return false; this.rows.delete(row.id); return true; }
    if (row.claimHash !== p.p_claim_hash) return false;
    if (name.endsWith("finish")) { row.completed = true; row.ciphertext = null; return true; }
    if (name.endsWith("release") && !row.completed) { row.claimHash = null; return true; }
    return false;
  }
}
const config = { url: "https://example.supabase.co", secretKey: "sb_secret_test", codeSecret: "a".repeat(64) };
const token = (char: string) => char.repeat(64);
function request(action: string, value: unknown, headers: Record<string,string> = {}) {
  return new Request(`http://localhost/api/transfers/${action}`,{ method: "POST", headers: { "Content-Type":"application/json", Origin:"http://localhost", ...headers }, body: JSON.stringify(value) });
}
async function setup() {
  const db = new Database(), handler = relayHandler(config,db);
  const profile = await revise(normalizeProfile({ id: "relay-qa", name: "Private QA nickname", age:24, owned:["psa"], createdAt:1, onboarded:true })!);
  const backup = await exportBackup(profile);
  const ownerToken = token("b"), id = randomUUID();
  const response = await handler(request("create",{backup,id,ownerToken}),"create");
  assert.equal(response.status,200);
  const created = await response.json() as {id:string; code:string; expiresAt:number};
  return {db,handler,backup,ownerToken,id,created};
}

test("relay config stays server-only, validates required secrets and requires secure remote URLs", () => {
  assert.equal(relayConfig({}),null);
  assert.equal(relayConfig({SUPABASE_URL:"http://public.example",SUPABASE_SECRET_KEY:"key",TRANSFER_CODE_SECRET:"a".repeat(64)}),null);
  assert.equal(relayConfig({SUPABASE_URL:config.url,SUPABASE_SECRET_KEY:"key",TRANSFER_CODE_SECRET:"weak"}),null);
  assert.ok(relayConfig({SUPABASE_URL:config.url,SUPABASE_SECRET_KEY:"key",TRANSFER_CODE_SECRET:config.codeSecret}));
});

test("code protocol normalizes grouping/case while rejecting arbitrary characters and overlong codes", () => {
  assert.ok(validCode(normalizeCode("abcd-efgh-jkmn")));
  assert.equal(formatCode("ABCDEFGHJKMN"),"ABCD-EFGH-JKMN");
  for (const code of ["ABCDEFGHJKM!","ABCDEFGHJKMNA","","000000000000"]) assert.equal(validCode(code),false);
  assert.equal(validToken("a".repeat(64)),true); assert.equal(validToken("a".repeat(63)),false);
});

test("complete relay roundtrip preserves the exact backup and encrypts personal data/code in the database", async () => {
  const {db,handler,backup,created,id} = await setup();
  assert.ok(validCode(created.code));
  assert.ok(created.expiresAt > Date.now());
  const stored = JSON.stringify([...db.rows.values()]);
  for (const value of ["Private QA nickname","relay-qa",created.code,backup]) assert.equal(stored.includes(value),false);
  const response = await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim");
  assert.equal(response.status,200); const claim = await response.json();
  assert.equal(claim.backup,backup); assert.equal(claim.id,id);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal((await handler(request("finish",{id,claimToken:token("c")}),"finish")).status,200);
  assert.equal(db.rows.get(id)!.ciphertext,null);
  assert.equal((await handler(request("finish",{id,claimToken:token("c")}),"finish")).status,200);
  const repeated = await (await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim")).json();
  assert.equal(repeated.completed,true); assert.equal(repeated.backup,null);
});

test("creation retries return the same code/snapshot and cannot hijack an existing request ID", async () => {
  const {db,handler,backup,id,ownerToken,created} = await setup();
  const retry = await handler(request("create",{backup,id,ownerToken}),"create");
  assert.equal((await retry.json()).code,created.code); assert.equal(db.rows.size,1);
  assert.equal((await handler(request("create",{backup,id,ownerToken:token("c")}),"create")).status,404);
});

test("a reservation prevents concurrent receivers; same receiver retries and explicit cancellation are safe", async () => {
  const {handler,created,id} = await setup();
  const responses = await Promise.all(["c","d"].map((c) => handler(request("claim",{code:created.code,claimToken:token(c)}),"claim")));
  assert.deepEqual(responses.map((r) => r.status).sort(),[200,404]);
  assert.equal((await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim")).status,200);
  assert.equal((await handler(request("release",{id,claimToken:token("d")}),"release")).status,404);
  assert.equal((await handler(request("release",{id,claimToken:token("c")}),"release")).status,200);
  assert.equal((await handler(request("claim",{code:created.code,claimToken:token("d")}),"claim")).status,200);
});

test("expired, unknown, reserved, and consumed codes reveal no distinguishing lookup details", async () => {
  const {db,handler,created,id} = await setup();
  const wrong = await handler(request("claim",{code:"AAAAAAAAAAAA",claimToken:token("c")}),"claim");
  db.now += 600001;
  const expired = await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim");
  assert.equal(wrong.status,404); assert.equal(expired.status,404); assert.deepEqual(await wrong.json(),await expired.json());
  db.now -= 600001;
  await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim");
  await handler(request("finish",{id,claimToken:token("c")}),"finish");
  assert.equal((await handler(request("claim",{code:created.code,claimToken:token("d")}),"claim")).status,404);
});

test("sender cancellation requires the owner token and prevents retrieval", async () => {
  const {handler,created,id,ownerToken} = await setup();
  assert.equal((await handler(request("revoke",{id,ownerToken:token("d")}),"revoke")).status,404);
  assert.equal((await handler(request("revoke",{id,ownerToken}),"revoke")).status,200);
  assert.equal((await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim")).status,404);
});

test("missing configuration and database/encryption failures return no sensitive details or fake codes", async () => {
  const {db,handler,created} = await setup();
  const missing = await relayHandler(null)(request("create",{}),"create"); assert.equal(missing.status,503);
  db.fail = true;
  const failed = await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim");
  assert.equal(failed.status,503); assert.equal((await failed.text()).includes("PRIVATE"),false);
  db.fail = false; [...db.rows.values()][0].ciphertext = "tampered";
  assert.equal((await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim")).status,503);
  const relay = new TransferRelay(db,config);
  const encrypted = relay.encrypt({id:randomUUID(),code:"ABCDEFGHJKMN",backup:"private"});
  assert.throws(() => new TransferRelay(db,{...config,codeSecret:"b".repeat(64)}).decrypt(encrypted));
});

test("shared rate limits resist forged forwarding headers and return retry advice", async () => {
  const {handler,created} = await setup();
  for (let n=0;n<60;n++) assert.equal((await handler(request("claim",{code:created.code,claimToken:token("c")},{"x-forwarded-for":`spoof-${n}`}),"claim")).status,200);
  const limited = await handler(request("claim",{code:created.code,claimToken:token("c")},{"x-forwarded-for":"new-spoof"}),"claim");
  assert.equal(limited.status,429); assert.equal(limited.headers.get("retry-after"),"60");
});

test("only explicitly trusted proxy headers produce pseudonymous client rate buckets", async () => {
  const db = new Database(), handler = relayHandler({...config,trustedIpHeader:"x-trusted-ip"},db);
  await handler(request("claim",{code:"AAAAAAAAAAAA",claimToken:token("c")},{"x-trusted-ip":"192.0.2.1"}),"claim");
  assert.equal(db.counters.size,2);
  assert.equal(JSON.stringify([...db.counters.keys()]).includes("192.0.2.1"),false);
});

test("cross-site, malformed, incompatible and oversized requests never create transfer rows", async () => {
  const db = new Database(), handler = relayHandler(config,db);
  for (const [value,headers,status] of [
    [{},{Origin:"https://other.example"},403], [{},{"Content-Type":"text/plain"},415],
    [{},{"Content-Type":"application/json-bogus"},415],
    [{backup:"{",id:randomUUID(),ownerToken:token("b")},{},400],
    [{backup:"x".repeat(1024*1024+1),id:randomUUID(),ownerToken:token("b")},{},413],
    [{backup:"{}",id:"wrong",ownerToken:token("b")},{},400],
  ] as const) assert.equal((await handler(request("create",value,headers),"create")).status,status);
  const malformed = new Request("http://localhost/api/transfers/create",{method:"POST",headers:{Origin:"http://localhost","Content-Type":"application/json"},body:"{"});
  assert.equal((await handler(malformed,"create")).status,400);
  assert.equal(db.rows.size,0);
});

test("origin checks use the public Host when Next binds to 0.0.0.0 and ignore forged forwarded hosts", async () => {
  const db = new Database(), handler = relayHandler(config,db);
  const publicRequest = new Request("http://0.0.0.0:3177/api/transfers/claim",{method:"POST",headers:{Origin:"http://127.0.0.1:3177",Host:"127.0.0.1:3177","Content-Type":"application/json"},body:JSON.stringify({code:"AAAAAAAAAAAA",claimToken:token("c")})});
  assert.equal((await handler(publicRequest,"claim")).status,404);
  const forged = request("claim",{code:"AAAAAAAAAAAA",claimToken:token("c")},{Origin:"https://attacker.example","x-forwarded-host":"attacker.example"});
  assert.equal((await handler(forged,"claim")).status,403);
});


test("authenticated transfer ID/code checks reject swapped ciphertext and mismatched idempotent snapshots", async () => {
  const {db,handler,backup,id,ownerToken,created} = await setup();
  const secondId=randomUUID();
  const second=await handler(request("create",{id:secondId,ownerToken,backup}),"create");
  assert.equal(second.status,200);
  db.rows.get(id)!.ciphertext=db.rows.get(secondId)!.ciphertext;
  assert.equal((await handler(request("claim",{code:created.code,claimToken:token("c")}),"claim")).status,503);
  assert.equal((await handler(request("create",{id,ownerToken,backup}),"create")).status,404);
  const mismatch=await handler(request("create",{id:secondId,ownerToken,backup:backup+" "}),"create");
  assert.equal(mismatch.status,404);
});
