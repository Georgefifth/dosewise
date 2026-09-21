"use client";

import { SLOT_LABELS } from "@/lib/schedule";
import type { MedInput, ScheduleEntry } from "@/lib/schema";

export default function WalletCard({
  meds,
  schedule,
}: {
  meds: MedInput[];
  schedule: ScheduleEntry[];
}) {
  const schedFor = (id: string) => schedule.find((s) => s.medId === id);
  const today = new Date().toLocaleDateString();

  return (
    <div
      id="wallet-card"
      className="mx-auto max-w-md rounded-2xl border-2 border-teal-700 bg-white p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between border-b-2 border-teal-700 pb-2">
        <div>
          <div className="text-base font-black tracking-tight text-teal-800">
            MY MEDICATION LIST
          </div>
          <div className="text-[10px] text-zinc-500">DoseWise · updated {today}</div>
        </div>
        <span className="text-xl">💊</span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400">
            <th className="pb-1">Medication</th>
            <th className="pb-1">Strength</th>
            <th className="pb-1">When</th>
          </tr>
        </thead>
        <tbody>
          {meds.map((m) => (
            <tr key={m.id} className="border-t border-zinc-100">
              <td className="py-1.5 pr-2 font-semibold text-zinc-800">{m.generic}</td>
              <td className="py-1.5 pr-2 text-zinc-600">{m.strength ?? "—"}</td>
              <td className="py-1.5 text-zinc-600">
                {(schedFor(m.id)?.slots ?? [])
                  .map((s) => SLOT_LABELS[s].toLowerCase())
                  .join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 border-t border-dashed border-zinc-200 pt-2 text-[10px] leading-relaxed text-zinc-500">
        <div>Allergies: ______________________</div>
        <div>Emergency contact: ______________________</div>
        <div className="mt-1 italic">
          Show this card to every doctor, dentist, and pharmacist. Not medical
          advice — verify with your pharmacist.
        </div>
      </div>
    </div>
  );
}
