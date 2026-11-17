"use client";

import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

export function Landing({ onAuth, onPreview }: { onAuth: () => void; onPreview: () => void }) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-navy text-white">
      <MiniTree />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-10">
        <Logo />

        <div className="mt-auto pt-48">
          <h1 className="text-balance text-[2.1rem] font-extrabold leading-[1.1] tracking-tight">
            From baseline documents to your first valid ID.
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-mist">
            One step unlocks the next. See exactly what to get, what it costs and what to bring — for students,
            young adults and first-time jobseekers.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              onClick={onAuth}
              className="h-14 rounded-2xl bg-amber text-base font-bold text-navy hover:bg-amber/85"
            >
              <LogIn className="size-5" aria-hidden="true" /> Log in or register
            </Button>
            <Button
              onClick={onPreview}
              variant="outline"
              className="h-14 rounded-2xl border-2 border-mist bg-transparent text-base font-bold text-white hover:bg-white/10 hover:text-white"
            >
              Preview your ID path <ArrowRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-5 text-center text-xs text-mist/80">Free · No account needed to preview</p>
        </div>
      </div>
    </main>
  );
}

/** Decorative node-and-line motif that hints at the tree without being the real thing. */
function MiniTree() {
  const dots: [number, number, "o" | "b" | "l"][] = [
    [50, 14, "o"], [24, 34, "b"], [76, 34, "b"], [10, 56, "l"], [40, 56, "b"], [62, 56, "l"], [90, 56, "l"],
  ];
  const lines: [number, number][] = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 80"
      preserveAspectRatio="xMidYMin slice"
      className="pointer-events-none absolute inset-x-0 top-20 h-[36%] w-full opacity-90"
    >
      {lines.map(([a, b], i) => (
        <line
          key={i}
          x1={dots[a][0]} y1={dots[a][1]} x2={dots[b][0]} y2={dots[b][1]}
          stroke={dots[a][2] === "o" ? "#FFA500" : "#A0E0EF"}
          strokeOpacity={dots[b][2] === "l" ? 0.25 : 0.7}
          strokeWidth="0.5"
          strokeDasharray={dots[b][2] === "l" ? "1.5 1.5" : undefined}
        />
      ))}
      {dots.map(([x, y, s], i) => (
        <circle
          key={i} cx={x} cy={y} r={s === "o" ? 5.5 : 4.5}
          fill={s === "o" ? "#FFA500" : s === "b" ? "#005A9C" : "#1B365D"}
          stroke={s === "o" ? "#FFA500" : s === "b" ? "#60C1E5" : "#A0E0EF"}
          strokeOpacity={s === "l" ? 0.4 : 1}
          strokeWidth="0.7"
          strokeDasharray={s === "l" ? "1.2 1.2" : undefined}
        />
      ))}
    </svg>
  );
}
