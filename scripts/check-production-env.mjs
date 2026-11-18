// Vercel provides environment variables directly. Never print their values.
if (process.env.VERCEL !== "1") {
  console.log("Vercel environment validation skipped outside Vercel.");
  process.exit(0);
}

const problems = [];
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, TRANSFER_CODE_SECRET: transfer, ENGAGEMENT_SECRET: engagement } = process.env;
try {
  const parsed = new URL(url ?? "");
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
} catch { problems.push("SUPABASE_URL must be a valid HTTPS project URL."); }
if (!key || key.startsWith("sb_publishable_")) {
  problems.push("SUPABASE_SECRET_KEY must be a server secret key, not a publishable key.");
} else if (!key.startsWith("sb_secret_")) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    if (payload.role !== "service_role") throw new Error();
  } catch { problems.push("SUPABASE_SECRET_KEY must be a secret key or a legacy service_role key."); }
}
if (!/^[a-f0-9]{64}$/i.test(transfer ?? "")) problems.push("TRANSFER_CODE_SECRET must contain exactly 64 hexadecimal characters.");
if (engagement && !/^[a-f0-9]{64}$/i.test(engagement)) problems.push("ENGAGEMENT_SECRET must contain exactly 64 hexadecimal characters when set.");

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else {
  console.log("Required Vercel server environment variables have valid formats.");
}
