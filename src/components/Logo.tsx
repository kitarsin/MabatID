export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight ${dark ? "text-navy" : "text-white"}`}>
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-amber text-navy">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
          <path d="M12 7v4M12 11l-6 6M12 11l6 6" />
        </svg>
      </span>
      <span translate="no">Mabat<span className={dark ? "text-civic" : "text-amber"}>ID</span></span>
    </span>
  );
}
