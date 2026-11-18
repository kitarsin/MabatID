/** Trust deployment metadata, never a client-supplied header claiming to be Vercel. */
export function trustedIpHeader(
  env: Readonly<Record<string, string | undefined>>,
  configured?: string,
): string | undefined {
  return configured?.trim().toLowerCase() || (env.VERCEL === "1" ? "x-vercel-forwarded-for" : undefined);
}
