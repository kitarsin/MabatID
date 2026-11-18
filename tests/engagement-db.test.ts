import assert from "node:assert/strict";
import test from "node:test";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const available = process.getuid?.() !== 0 && spawnSync("initdb", ["--version"], { stdio: "ignore" }).status === 0;
const hash = (letter: string) => letter.repeat(64);

test("real Postgres engagement preserves privacy, deduplicates concurrent likes and bounds writes", { skip: available ? false : "Requires non-root PostgreSQL tools." }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "mabatid-engagement-test-")), data = join(root, "data");
  const args = ["-h", root, "-p", "56380", "-U", userInfo().username, "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
  const sql = (source: string) => execFileSync("psql", [...args, "-c", source], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const call = (source: string) => sql(`set role service_role; select ${source}`).replace(/^SET(?:\n|$)/, "");
  let started = false;
  try {
    execFileSync("initdb", ["-D", data, "-A", "trust", "--no-locale", "--encoding=UTF8"], { stdio: "ignore" });
    execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 56380 -c listen_addresses=`, "-w", "start"], { stdio: "ignore" });
    started = true;
    sql("create role anon; create role authenticated; create role service_role bypassrls; alter default privileges in schema public grant all on tables to anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to anon, authenticated, service_role; alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;");
    const migrations = join(process.cwd(), "supabase/migrations");
    const file = readdirSync(migrations).find((name) => name.endsWith("_weekly_likes_feedback.sql"))!;
    execFileSync("psql", [...args, "-f", join(migrations, file)], { stdio: ["ignore", "pipe", "pipe"] });

    await t.test("browser roles cannot read feedback, manipulate likes or call privileged functions", () => {
      assert.equal(sql("select count(*) from pg_class where relname in ('mabatid_weekly_likes','mabatid_feedback','mabatid_engagement_limits') and relrowsecurity"), "3");
      for (const role of ["anon", "authenticated"]) {
        for (const table of ["mabatid_weekly_likes", "mabatid_feedback", "mabatid_engagement_limits"]) {
          for (const privilege of ["select", "insert", "update", "delete", "truncate"]) assert.equal(sql(`select has_table_privilege('${role}','public.${table}','${privilege}')`), "f");
        }
        for (const signature of ["mabatid_like_tally(text)", "mabatid_like_add(text)", "mabatid_engagement_rate(text,integer,integer)", "mabatid_feedback_submit(text,uuid,text,smallint)"]) assert.equal(sql(`select has_function_privilege('${role}','public.${signature}','execute')`), "f");
        assert.equal(sql(`select has_sequence_privilege('${role}','public.mabatid_feedback_id_seq','usage')`), "f");
        assert.throws(() => sql(`set role ${role}; select * from public.mabatid_feedback`));
      }
      assert.equal(sql("select count(*) from pg_proc where proname in ('mabatid_like_tally','mabatid_like_add','mabatid_engagement_rate','mabatid_feedback_submit') and (prosecdef or not proconfig @> array['search_path=" + '""' + "'])"), "0");
    });
    await t.test("the database assigns the Philippine week and ignores older weekly likes", () => {
      sql(`insert into public.mabatid_weekly_likes(week_start,browser_hash) values ((date_trunc('week',clock_timestamp() at time zone 'Asia/Manila')::date - 7),'${hash("a")}')`);
      const before = JSON.parse(call(`public.mabatid_like_tally('${hash("a")}')`));
      assert.equal(before.count, 0); assert.equal(before.liked, false);
      const expected = sql("select to_char(date_trunc('week',clock_timestamp() at time zone 'Asia/Manila'),'YYYY-MM-DD')");
      assert.equal(before.week, expected);
      const reset = new Date(before.nextResetAt);
      assert.equal(reset.getUTCDay(), 0); assert.equal(reset.getUTCHours(), 16);
      const result = JSON.parse(call(`public.mabatid_like_add('${hash("a")}')`));
      assert.equal(result.count, 1); assert.equal(result.liked, true); assert.equal(result.already, false);
      assert.equal(JSON.parse(call(`public.mabatid_like_add('${hash("a")}')`)).already, true);
    });
    await t.test("concurrent requests from the same browser count exactly once", async () => {
      const results = await Promise.all(Array.from({ length: 8 }, async () => {
        const result = await run("psql", [...args, "-c", `set role service_role; select public.mabatid_like_add('${hash("b")}')`]);
        return JSON.parse(result.stdout.replace(/^SET(?:\n|$)/, "").trim());
      }));
      assert.equal(results.filter((r) => !r.already).length, 1);
      assert.equal(JSON.parse(call(`public.mabatid_like_tally('${hash("b")}')`)).count, 2);
    });
    await t.test("feedback is private plain text, retries are idempotent, and validation survives direct SQL", () => {
      const submit = (message = "A useful checklist", rating = "5::smallint") => call(`public.mabatid_feedback_submit('${hash("a")}','00000000-0000-4000-8000-000000000001','${message}',${rating})`);
      assert.equal(submit(), "t"); assert.equal(submit(), "t"); assert.equal(submit("A changed message"), "f");
      assert.equal(sql("select count(*) from public.mabatid_feedback"), "1");
      assert.equal(sql("select status from public.mabatid_feedback"), "new");
      assert.throws(() => call(`public.mabatid_feedback_submit('${hash("b")}','00000000-0000-4000-8000-000000000002','too short',null)`));
      assert.throws(() => call(`public.mabatid_feedback_submit('${hash("b")}','00000000-0000-4000-8000-000000000002','An invalid rating',6::smallint)`));
      assert.equal(call(`public.mabatid_feedback_submit('${hash("b")}','00000000-0000-4000-8000-000000000002','<script>literal text</script>',null)`), "t");
    });
    await t.test("rate limits are shared and atomic, and expired buckets are pruned", async () => {
      sql("insert into public.mabatid_engagement_limits values ('expired',clock_timestamp()-interval '2 hours',1,clock_timestamp()-interval '1 hour')");
      const results = await Promise.all(Array.from({ length: 10 }, async () => {
        const output = await run("psql", [...args, "-c", "set role service_role; select public.mabatid_engagement_rate('concurrent',3,3600)"]);
        return output.stdout.replace(/^SET(?:\n|$)/, "").trim();
      }));
      assert.equal(results.filter((r) => r === "t").length, 3);
      assert.equal(results.filter((r) => r === "f").length, 7);
      assert.equal(sql("select count(*) from public.mabatid_engagement_limits where bucket='expired'"), "0");
    });
  } finally {
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
    rmSync(root, { recursive: true, force: true });
  }
});
