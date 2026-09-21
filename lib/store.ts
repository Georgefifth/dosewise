"use client";

/* Persisted med list — localStorage only, never leaves the device. */

import type { MedInput } from "./schema";

const KEY = "dosewise.meds.v1";

export function loadMeds(): MedInput[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MedInput[]) : [];
  } catch {
    return [];
  }
}

export function saveMeds(meds: MedInput[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meds));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

export function clearMeds() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
