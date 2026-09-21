"use client";

import type { Interaction, Severity } from "@/lib/schema";

const STYLE: Record<
  Severity,
  { ring: string; bg: string; badge: string; label: string }
> = {
  major: {
    ring: "border-rose-300",
    bg: "bg-rose-50",
    badge: "bg-rose-600 text-white",
    label: "MAJOR",
  },
  moderate: {
    ring: "border-amber-300",
    bg: "bg-amber-50",
    badge: "bg-amber-500 text-white",
    label: "MODERATE",
  },
  minor: {
    ring: "border-sky-300",
    bg: "bg-sky-50",
    badge: "bg-sky-500 text-white",
    label: "MINOR",
  },
  info: {
    ring: "border-zinc-200",
    bg: "bg-zinc-50",
    badge: "bg-zinc-400 text-white",
    label: "NOTE",
  },
};

export default function InteractionAlerts({
  interactions,
}: {
  interactions: Interaction[];
}) {
  const majors = interactions.filter((i) => i.severity === "major").length;
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-bold text-zinc-900">⚠️ Interaction check</h2>
        {interactions.length === 0 ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            ✓ no known conflicts in this list
          </span>
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              majors ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {majors} major · {interactions.length - majors} other
          </span>
        )}
      </div>

      {interactions.length === 0 ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          No known interactions between these medications in our rule table. Still
          confirm new combinations with your pharmacist — our table covers common
          pairs, not every possibility.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {interactions.map((ix, i) => {
            const s = STYLE[ix.severity];
            return (
              <div key={i} className={`rounded-xl border ${s.ring} ${s.bg} p-4`}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${s.badge}`}>
                    {s.label}
                  </span>
                  <span className="font-mono text-xs font-semibold text-zinc-700">
                    {ix.a}
                  </span>
                  <span className="text-zinc-400">×</span>
                  <span className="font-mono text-xs font-semibold text-zinc-700">
                    {ix.b}
                  </span>
                  <span className="ml-auto text-sm font-semibold text-zinc-800">{ix.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-700">{ix.mechanism}</p>
                <p className="mt-2 flex gap-2 text-sm font-medium text-zinc-800">
                  <span>→</span>
                  <span>{ix.advice}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
