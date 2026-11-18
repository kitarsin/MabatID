import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => fileURLToPath(new URL(`../tests/${file}`, import.meta.url)));

// Vercel builds run with production flags. Unit tests must never consume live rate quotas.
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "test", VERCEL: "0" },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
