"use client";

import { SLOT_LABELS } from "@/lib/schedule";
import type { MedInput, ScheduleEntry, Slot } from "@/lib/schema";

const SLOT_ICONS: Record<Slot, string> = {
  morning: "🌅",
  noon: "☀️",
  evening: "🌆",
  bedtime: "🌙",
  as_needed: "🔁",
};

const SLOT_HINTS: Record<Slot, string> = {
  morning: "wake up / breakfast",
  noon: "midday",
  evening: "dinner",
  bedtime: "before sleep",
  as_needed: "only if needed",
};

export default function ScheduleGrid({
  meds,
  schedule,
  previews,
}: {
  meds: MedInput[];
  schedule: ScheduleEntry[];
  previews: string[];
}) {
  const byId = new Map(meds.map((m) => [m.id, m]));
  const slots: Slot[] = ["morning", "noon", "evening", "bedtime", "as_needed"];

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-zinc-900">🕐 Your daily schedule</h2>
      <p className="mb-3 text-xs text-zinc-500">
        built from the directions on each label — 🍽 with food · ⏳ empty stomach
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {slots.map((slot) => {
          const entries = schedule.filter((e) => e.slots.includes(slot));
          return (
            <div
              key={slot}
              className="rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="mb-2 border-b border-zinc-100 pb-2">
                <div className="text-sm font-bold text-zinc-800">
                  {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
                </div>
                <div className="text-[10px] text-zinc-400">{SLOT_HINTS[slot]}</div>
              </div>
              <div className="flex flex-col gap-2">
                {entries.length === 0 && (
                  <span className="text-xs text-zinc-300">—</span>
                )}
                {entries.map((e) => {
                  const med = byId.get(e.medId);
                  if (!med) return null;
                  return (
                    <div
                      key={e.medId}
                      className="flex items-center gap-2 rounded-lg bg-teal-50/70 px-2 py-1.5"
                    >
                      {med.image !== undefined && previews[med.image] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previews[med.image]}
                          alt=""
                          className="h-9 w-12 shrink-0 rounded border border-teal-100 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-zinc-800">
                          {med.generic} {med.strength && <span className="font-normal text-zinc-500">{med.strength}</span>}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {e.withFood && "🍽 with food "}
                          {e.emptyStomach && "⏳ empty stomach "}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {schedule.some((e) => e.timingNote) && (
        <div className="mt-3 flex flex-col gap-1">
          {schedule
            .filter((e) => e.timingNote)
            .map((e) => {
              const med = byId.get(e.medId);
              return (
                <p key={e.medId} className="text-xs text-amber-700">
                  ⚠ <b>{med?.generic}:</b> {e.timingNote}
                </p>
              );
            })}
        </div>
      )}
    </section>
  );
}
