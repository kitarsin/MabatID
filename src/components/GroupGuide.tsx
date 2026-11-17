import { CREDENTIAL_GROUPS, GROUP_GUIDANCE, GROUP_META } from "@/data/cards";

export function GroupDefinitions() {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">{GROUP_GUIDANCE}</p>
      <ol className="space-y-4">
        {CREDENTIAL_GROUPS.map((group) => (
          <li key={group} className="space-y-1">
            <p className="font-bold text-civic">
              {GROUP_META[group].label}
            </p>
            <p>{GROUP_META[group].blurb}</p>
            <p className="text-xs text-muted-foreground">
              {GROUP_META[group].significance}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        These are MabatID’s browsing groups. Official acceptance is checked for
        each agency and transaction.
      </p>
    </div>
  );
}

export function GroupGuide() {
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="-my-2 min-h-11 cursor-pointer py-3 text-sm font-bold text-civic">
        What do the groups mean?
      </summary>
      <div className="mt-3">
        <GroupDefinitions />
      </div>
    </details>
  );
}
