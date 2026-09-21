"use client";

import { DRUGS } from "@/lib/drugs";
import type { ScannedMed } from "@/lib/schema";

const CONF_STYLE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-rose-50 text-rose-700",
};

export default function MedListEditor({
  meds,
  previews,
  onChange,
  onRemove,
  onAdd,
}: {
  meds: ScannedMed[];
  previews: string[]; // index → image url
  onChange: (id: string, patch: Partial<ScannedMed>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <datalist id="known-generics">
        {DRUGS.map((d) => (
          <option key={d.generic} value={d.generic} />
        ))}
      </datalist>
      {meds.map((m) => (
        <div
          key={m.id}
          className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3"
        >
          {m.image !== undefined && previews[m.image] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews[m.image]}
              alt=""
              className="h-20 w-28 shrink-0 rounded-lg border border-zinc-200 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONF_STYLE[m.confidence]}`}>
                {m.confidence === "high" ? "read clearly" : m.confidence === "medium" ? "please check" : "needs your input"}
              </span>
              <button
                onClick={() => onRemove(m.id)}
                className="ml-auto text-xs text-zinc-400 hover:text-rose-600"
              >
                remove
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">drug (generic)</span>
                <input
                  list="known-generics"
                  value={m.generic}
                  onChange={(e) => onChange(m.id, { generic: e.target.value })}
                  placeholder="e.g. warfarin"
                  className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">strength</span>
                <input
                  value={m.strength ?? ""}
                  onChange={(e) => onChange(m.id, { strength: e.target.value })}
                  placeholder="e.g. 5 mg"
                  className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">directions</span>
                <input
                  value={m.sig ?? ""}
                  onChange={(e) => onChange(m.id, { sig: e.target.value })}
                  placeholder="e.g. one tablet twice daily"
                  className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
              </label>
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="rounded-xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500 transition hover:border-teal-400 hover:text-teal-700"
      >
        + add a medication manually
      </button>
    </div>
  );
}
