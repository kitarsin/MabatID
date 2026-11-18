"use client";

import { useRef, useState, type CSSProperties } from "react";
import { RENDERS } from "@/data/renders";
import { CardIcon } from "./icons";

/**
 * The hero of the detail sheet: a 3D render of the ID / document on a soft studio stage.
 * - Enters with a short lift (tilted back, blurred → upright, sharp), then floats gently.
 * - With a fine pointer the render tilts toward the cursor and a soft sheen follows it.
 * - Front / Back (or Cover / Inside) swaps with a small turn; the choice resets per card.
 * Reduced motion: no entrance, float, tilt or turn (see globals.css).
 */
export function RenderStage({
  id,
  name,
  icon,
}: {
  id: string;
  name: string;
  icon: string;
}) {
  const render = RENDERS[id];
  const [face, setFace] = useState<"front" | "back">("front");
  const [seen, setSeen] = useState(id);
  if (seen !== id) {
    setSeen(id);
    setFace("front");
  }
  const tiltRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = tiltRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
      el.dataset.tilting = "true";
    });
  };
  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
    delete el.dataset.tilting;
  };

  const src = render ? (face === "back" && render.back ? render.back : render.front) : null;
  const faceLabel = face === "back" ? (render?.backLabel ?? "Back") : render?.backLabel ? "Cover" : "Front";

  return (
    <div className="render-stage relative isolate overflow-hidden rounded-[28px]">
      <div
        className={`relative [perspective:1100px] ${render?.portrait ? "h-[260px] sm:h-[300px]" : "h-[220px] sm:h-[260px]"}`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {/* floor shadow, breathes with the float */}
        <span aria-hidden="true" className="render-floor absolute bottom-[10%] left-1/2 h-5 w-[52%] -translate-x-1/2 rounded-[50%] bg-navy/25 blur-xl" />
        <div key={id} className="render-enter absolute inset-0">
          <div className="render-float h-full w-full">
            <div
              ref={tiltRef}
              className="render-tilt relative h-full w-full"
              style={{ "--rx": "0deg", "--ry": "0deg", "--mx": "50%", "--my": "40%" } as CSSProperties}
            >
              {src ? (
                <div key={face} className="render-swap relative h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP renders */}
                  <img
                    src={src}
                    alt={`3D render of ${name}${render?.back ? `, ${faceLabel.toLowerCase()}` : ""}`}
                    draggable={false}
                    decoding="async"
                    className="render-img h-full w-full select-none object-contain"
                  />
                  <span aria-hidden="true" className="render-sheen pointer-events-none absolute inset-0" />
                </div>
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <span className="grid size-28 place-items-center rounded-[32px] bg-white text-civic shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--color-navy)_35%,transparent)] ring-1 ring-navy/5">
                    <CardIcon name={icon} className="size-12" />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {render?.back && (
        <div
          role="group"
          aria-label="Side shown"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-white/70 p-1 shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--color-navy)_40%,transparent)] ring-1 ring-navy/10 backdrop-blur-md"
        >
          {(["front", "back"] as const).map((f) => {
            const label = f === "back" ? (render.backLabel ?? "Back") : render.backLabel ? "Cover" : "Front";
            const on = face === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFace(f)}
                className={`min-h-9 rounded-full px-4 text-xs font-bold transition-[background-color,color,box-shadow,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.96] ${
                  on ? "bg-navy text-white shadow-sm" : "text-navy hover:bg-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
