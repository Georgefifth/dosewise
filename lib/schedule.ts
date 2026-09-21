import { resolveDrug } from "./drugs";
import type { MedInput, ScheduleEntry, Slot } from "./schema";

/* Parse free-text directions ("take one tablet twice daily with food") into
   schedule slots. Deterministic — a wrong slot is a UX bug, not a safety call
   (the label text stays visible on the med card). */

const SLOT_ORDER: Slot[] = ["morning", "noon", "evening", "bedtime"];

export function sigToSlots(
  sig: string | undefined,
  generic: string,
): ScheduleEntry {
  const s = (sig ?? "").toLowerCase();
  const info = resolveDrug(generic);

  const prn = /\b(prn|as needed|when needed|if needed)\b/.test(s);
  const bedtime = /\b(bedtime|qhs|at night|before bed|nighttime)\b/.test(s);
  const morningWord = /\b(morning|breakfast|am\b|qam)\b/.test(s);
  const noonWord = /\b(noon|lunch|midday)\b/.test(s);
  const eveningWord = /\b(evening|dinner|supper|pm\b)\b/.test(s);

  let times = 0;
  if (/\b(once|one time|1 time)\b.*\b(dai?ly|day)\b|\bqd\b|\bdaily\b|\bonce a day\b/.test(s)) times = 1;
  else if (/\b(twice|two times|2 times)\b|\bbid\b|\bb\.i\.d\b/.test(s)) times = 2;
  else if (/\b(three times|3 times|thrice)\b|\btid\b|\bt\.i\.d\b/.test(s)) times = 3;
  else if (/\b(four times|4 times)\b|\bqid\b|\bq\.i\.d\b/.test(s)) times = 4;
  else {
    const m = /every\s+(\d+)\s*(?:-|to)?\s*\d*\s*hours?/.exec(s);
    if (m) {
      const h = parseInt(m[1], 10);
      times = h <= 6 ? 4 : h <= 8 ? 3 : h <= 12 ? 2 : 1;
    }
  }

  const slots = new Set<Slot>();

  {
    if (bedtime) slots.add("bedtime");
    if (morningWord) slots.add("morning");
    if (noonWord) slots.add("noon");
    if (eveningWord && !bedtime) slots.add("evening");

    if (slots.size === 0 && prn) {
      // "every 6h as needed" etc. — PRN beats a frequency pattern
      slots.add("as_needed");
    } else if (slots.size === 0) {
      if (times === 1) {
        // drug-specific preferred time, else morning
        slots.add(info?.timing ?? "morning");
      } else if (times === 2) {
        slots.add("morning");
        slots.add(info?.timing === "bedtime" ? "bedtime" : "evening");
      } else if (times === 3) {
        slots.add("morning"); slots.add("noon"); slots.add("evening");
      } else if (times >= 4) {
        SLOT_ORDER.forEach((s2) => slots.add(s2));
      } else {
        // no frequency parsed — default to drug's preferred time or morning
        slots.add(info?.timing ?? "morning");
      }
    }
  }

  const withFood = /\bwith (food|meals?|a meal)\b/.test(s) || info?.food === "with";
  const emptyStomach = /\bempty stomach|before (meals?|food|breakfast)\b/.test(s) || info?.food === "empty";

  return {
    medId: "",
    slots: [...slots],
    withFood: withFood || undefined,
    emptyStomach: emptyStomach || undefined,
    timingNote: info?.foodNote,
  };
}

export function buildSchedule(meds: MedInput[]): ScheduleEntry[] {
  return meds.map((m) => ({ ...sigToSlots(m.sig, m.generic), medId: m.id }));
}

export const SLOT_LABELS: Record<Slot, string> = {
  morning: "Morning",
  noon: "Noon",
  evening: "Evening",
  bedtime: "Bedtime",
  as_needed: "As needed",
};
