/** Blank navy screen shown while the account store loads and, in the prerendered HTML, while the URL is read. */
export function AppLoading() {
  return (
    <div className="min-h-dvh bg-navy" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
    </div>
  );
}
