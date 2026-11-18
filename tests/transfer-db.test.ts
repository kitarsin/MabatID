import assert from "node:assert/strict";
import test from "node:test";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const available = process.getuid?.() !== 0 && spawnSync("initdb",["--version"],{stdio:"ignore"}).status === 0 && spawnSync("psql",["--version"],{stdio:"ignore"}).status === 0;
const h = (letter: string) => letter.repeat(64);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;

test("real Postgres relay functions enforce privileges, atomic claims, cleanup, capacity and shared limits", {skip: available ? false : "Requires non-root local PostgreSQL tools (initdb, pg_ctl, psql)."}, async (t) => {
  const root = mkdtempSync(join(tmpdir(),"mabatid-sql-test-")), data = join(root,"data");
  const base = ["-h",root,"-p","56379","-U",userInfo().username,"-d","postgres","-X","-A","-t","-v","ON_ERROR_STOP=1"];
  const sql = (source: string) => execFileSync("psql",[...base,"-c",source],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
  let started = false;
  try {
    execFileSync("initdb",["-D",data,"-A","trust","--no-locale","--encoding=UTF8"],{stdio:"ignore"});
    execFileSync("pg_ctl",["-D",data,"-l",join(root,"postgres.log"),"-o",`-k ${root} -p 56379 -c listen_addresses=`,"-w","start"],{stdio:"ignore"}); started = true;
    sql("create role anon; create role authenticated; create role service_role bypassrls; alter default privileges in schema public grant all on tables to anon, authenticated, service_role; alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;");
    const migrations = join(process.cwd(),"supabase/migrations");
    const migration = readdirSync(migrations).find((name) => name.endsWith("_profile_transfers.sql"))!;
    execFileSync("psql",[...base,"-f",join(migrations,migration)],{stdio:["ignore","pipe","pipe"]});
    const call = (expression: string) => sql(`set role service_role; select ${expression};`).replace(/^SET(?:\n|$)/,"");
    const create = (n: number, hash = h("a")) => JSON.parse(call(`public.mabatid_transfer_create('${id(n)}','${hash}','${h("b")}', 'encrypted-personal-payload')`));

    await t.test("RLS and explicit object/function grants block anon and authenticated roles", () => {
      assert.equal(sql("select count(*) from pg_class where relname in ('mabatid_transfers','mabatid_transfer_limits') and relrowsecurity"),"2");
      for (const role of ["anon","authenticated"]) {
        assert.equal(sql(`select has_table_privilege('${role}','public.mabatid_transfers','select')`),"f");
        assert.equal(sql(`select has_function_privilege('${role}','public.mabatid_transfer_claim(text,text)','execute')`),"f");
        assert.throws(() => sql(`set role ${role}; select public.mabatid_transfer_claim('${h("a")}','${h("c")}')`));
      }
      assert.equal(sql("select count(*) from pg_proc where proname like 'mabatid_transfer_%' and prosecdef"),"0");
      assert.equal(call("public.mabatid_transfer_health()"),"1");
    });
    await t.test("creation retries are idempotent and use a server-defined ten-minute lifetime", () => {
      const first = create(1), retry = create(1,h("d"));
      assert.equal(first.id,retry.id); assert.equal(first.ciphertext,retry.ciphertext);
      assert.equal(sql("select count(*) from public.mabatid_transfers"),"1");
      assert.equal(call(`public.mabatid_transfer_create('${id(1)}','${h("e")}','${h("f")}','other')`),"");
      const remaining = Number(sql("select extract(epoch from (expires_at-created_at)) from public.mabatid_transfers limit 1"));
      assert.ok(remaining>=599 && remaining<=601);
    });
    await t.test("concurrent receivers cannot both claim the same code", async () => {
      const outputs = await Promise.all(["c","d"].map(async (token) => (await run("psql",[...base,"-c",`set role service_role; select public.mabatid_transfer_claim('${h("a")}','${h(token)}');`])).stdout.replace(/^SET(?:\n|$)/,"").trim()));
      assert.equal(outputs.filter(Boolean).length,1);
      const winner = sql("select claim_hash from public.mabatid_transfers limit 1");
      assert.ok([h("c"),h("d")].includes(winner));
      assert.equal(JSON.parse(call(`public.mabatid_transfer_claim('${h("a")}','${winner}')`)).completed,false);
      assert.equal(call(`public.mabatid_transfer_release('${id(1)}','${h("f")}')`),"f");
      assert.equal(call(`public.mabatid_transfer_release('${id(1)}','${winner}')`),"t");
      assert.ok(JSON.parse(call(`public.mabatid_transfer_claim('${h("a")}','${h("e")}')`)));
    });
    await t.test("completion erases the payload and supports lost-response acknowledgment retries", () => {
      assert.equal(call(`public.mabatid_transfer_finish('${id(1)}','${h("e")}')`),"t");
      assert.equal(call(`public.mabatid_transfer_finish('${id(1)}','${h("e")}')`),"t");
      assert.equal(sql("select ciphertext is null from public.mabatid_transfers limit 1"),"t");
      assert.equal(JSON.parse(call(`public.mabatid_transfer_claim('${h("a")}','${h("e")}')`)).completed,true);
      assert.equal(call(`public.mabatid_transfer_claim('${h("a")}','${h("c")}')`),"");
    });
    await t.test("expired data is inaccessible before cleanup and then physically removed", () => {
      sql("update public.mabatid_transfers set created_at=clock_timestamp()-interval '11 minutes', expires_at=clock_timestamp()-interval '1 minute'");
      assert.equal(call(`public.mabatid_transfer_claim('${h("a")}','${h("e")}')`),"");
      call("public.mabatid_transfer_cleanup()");
      assert.equal(sql("select count(*) from public.mabatid_transfers"),"0");
    });
    await t.test("shared rate counters remain atomic across independent connections", async () => {
      const values = await Promise.all(Array.from({length:10},async () => (await run("psql",[...base,"-c","set role service_role; select public.mabatid_transfer_rate('concurrent',5,60);"])).stdout.replace(/^SET(?:\n|$)/,"").trim()));
      assert.equal(values.filter((v) => v === "t").length,5); assert.equal(values.filter((v) => v === "f").length,5);
      assert.equal(call("public.mabatid_transfer_rate('concurrent',5,60)"),"f");
    });
    await t.test("global transfer storage capacity rejects new uploads without deleting unrelated transfers", () => {
      sql("insert into public.mabatid_transfers(id,code_hash,owner_hash,ciphertext) select gen_random_uuid(),md5(n::text)||md5((n+1000)::text),repeat('b',64),'cipher' from generate_series(1,128)n");
      assert.equal(create(999,h("f")).full,true);
      assert.equal(sql("select count(*) from public.mabatid_transfers"),"128");
    });
  } finally {
    if (started) execFileSync("pg_ctl",["-D",data,"-m","immediate","-w","stop"],{stdio:"ignore"});
    rmSync(root,{recursive:true,force:true});
  }
});
