import { Disclosure } from "@/components/ui/disclosure";
import { CREDENTIAL_GROUPS, GROUP_GUIDANCE, GROUP_META } from "@/data/cards";

export function GroupDefinitions() {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <p className="text-muted-foreground">
        Groups sort IDs by what they’re for — not by how hard they are. Get only
        what you need.
      </p>
      <ol className="space-y-5">
        {CREDENTIAL_GROUPS.map((group) => (
          <li key={group} className="space-y-1.5">
            <p className="font-semibold text-navy">{GROUP_META[group].label}</p>
            <p className="text-muted-foreground">{GROUP_META[group].blurb}</p>
            <Disclosure variant="inline" summary="More">
              <p className="text-xs text-muted-foreground">
                {GROUP_META[group].significance}
              </p>
            </Disclosure>
          </li>
        ))}
      </ol>
      <Disclosure variant="inline" summary="Fine print">
        <p className="text-xs text-muted-foreground">
          {GROUP_GUIDANCE} Each agency decides which IDs it accepts.
        </p>
      </Disclosure>
    </div>
  );
}

export function GroupGuide() {
  return (
    <Disclosure summary="What do the groups mean?" hint="4 groups, sorted by purpose">
      <GroupDefinitions />
    </Disclosure>
  );
}
