"use client";

/* Build an .ics calendar file: one daily recurring event per med per slot.
   Imports straight into Google/Apple/Outlook calendars — reminders without
   any account or server on our side. */

import type { MedInput, ScheduleEntry, Slot } from "./schema";

const SLOT_TIME: Record<Slot, string> = {
  morning: "T073000",
  noon: "T120000",
  evening: "T180000",
  bedtime: "T220000",
  as_needed: "T120000",
};

const SLOT_NAME: Record<Slot, string> = {
  morning: "morning",
  noon: "noon",
  evening: "evening",
  bedtime: "bedtime",
  as_needed: "as needed",
};

export function buildIcs(meds: MedInput[], schedule: ScheduleEntry[]): string {
  const today = new Date();
  const dt = (t: string) =>
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}${t}`;

  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const events: string[] = [];
  for (const entry of schedule) {
    const med = meds.find((m) => m.id === entry.medId);
    if (!med) continue;
    for (const slot of entry.slots) {
      if (slot === "as_needed") continue; // no recurring alarm for PRN
      const summary = `Take ${med.generic}${med.strength ? ` ${med.strength}` : ""} (${SLOT_NAME[slot]})`;
      const desc = [
        med.sig ? `Label directions: ${med.sig}` : "",
        entry.withFood ? "Take with food." : "",
        entry.emptyStomach ? "Take on an empty stomach." : "",
        entry.timingNote ?? "",
        "— scheduled by DoseWise",
      ]
        .filter(Boolean)
        .join("\\n");
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${med.id}-${slot}@dosewise`,
          `DTSTAMP:${dt("T000000")}`,
          `DTSTART:${dt(SLOT_TIME[slot])}`,
          `RRULE:FREQ=DAILY`,
          `SUMMARY:${esc(summary)}`,
          `DESCRIPTION:${esc(desc)}`,
          "BEGIN:VALARM",
          "TRIGGER:-PT0M",
          "ACTION:DISPLAY",
          `DESCRIPTION:${esc(summary)}`,
          "END:VALARM",
          "END:VEVENT",
        ].join("\r\n"),
      );
    }
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DoseWise//medication-reminders//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(meds: MedInput[], schedule: ScheduleEntry[]) {
  const blob = new Blob([buildIcs(meds, schedule)], {
    type: "text/calendar;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dosewise-reminders.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}
