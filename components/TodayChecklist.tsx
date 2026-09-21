"use client";

import { useMemo, useState } from "react";
import { SLOT_LABELS } from "@/lib/schedule";
import type { MedInput, ScheduleEntry, Slot } from "@/lib/schema";

/* Daily adherence check-off — localStorage, no account needed.
   Streak counts consecutive days where every scheduled dose was checked. */

const SLOTS: Slot[] = ["morning", "noon", "evening", "bedtime"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function storeKey(date: string) {
  return `dosewise.taken.${date}`;
}
function loadDay(date: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(storeKey(date)) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveDay(date: string, taken: Set<string>) {
  try {
    localStorage.setItem(storeKey(date), JSON.stringify([...taken]));
  } catch {}
}

function doseIds(meds: MedInput[], schedule: ScheduleEntry[], slot: Slot): string[] {
  return schedule
    .filter((e) => e.slots.includes(slot))
    .map((e) => e.medId)
    .filter((id) => meds.some((m) => m.id === id));
}

export default function TodayChecklist({
  meds,
  schedule,
}: {
  meds: MedInput[];
  schedule: ScheduleEntry[];
}) {
  const today = todayKey();
  const [taken, setTaken] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : loadDay(today),
  );

  const doseKey = (slot: Slot, medId: string) => `${slot}:${medId}`;

  const allDoses = useMemo(
    () =>
      SLOTS.flatMap((slot) =>
        doseIds(meds, schedule, slot).map((id) => doseKey(slot, id)),
      ),
    [meds, schedule],
  );

  const streak = useMemo(() => {
    // count consecutive fully-completed days ending today/yesterday
    let s = 0;
    const d = new Date();
    // today counts only if complete; otherwise start from yesterday
    const todayDone = allDoses.length > 0 && allDoses.every((k) => taken.has(k));
    if (!todayDone) d.setDate(d.getDate() - 1);
    for (;;) {
      const key = d.toISOString().slice(0, 10);
      const dayTaken = loadDay(key);
      const schedIds = allDoses.map((k) => k); // same schedule assumed
      if (schedIds.length && schedIds.every((k) => dayTaken.has(k))) {
        s++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return s;
  }, [taken, allDoses]);

  const toggle = (slot: Slot, medId: string) => {
    const next = new Set(taken);
    const k = doseKey(slot, medId);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setTaken(next);
    saveDay(today, next);
  };

  const doneCount = allDoses.filter((k) => taken.has(k)).length;
  const complete = allDoses.length > 0 && doneCount === allDoses.length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-bold text-zinc-900">✅ Today&apos;s doses</h2>
        {streak > 0 && (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            🔥 {streak}-day streak
          </span>
        )}
        {complete && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            all done today
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SLOTS.map((slot) => {
          const ids = doseIds(meds, schedule, slot);
          if (!ids.length) return null;
          return (
            <div key={slot} className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 text-xs font-bold text-zinc-500">
                {SLOT_LABELS[slot]}
              </div>
              {ids.map((id) => {
                const med = meds.find((m) => m.id === id)!;
                const checked = taken.has(doseKey(slot, id));
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(slot, id)}
                      className="h-4 w-4 rounded accent-teal-600"
                    />
                    <span className={checked ? "text-zinc-400 line-through" : "text-zinc-800"}>
                      {med.generic}
                      {med.strength && (
                        <span className="ml-1 text-xs text-zinc-400">{med.strength}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        {doneCount}/{allDoses.length} taken — stored only on this device.
      </p>
    </section>
  );
}
