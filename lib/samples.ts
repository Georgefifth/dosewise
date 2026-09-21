/* Client-safe sample metadata (no node imports — imported by the page). */

export const SAMPLES = ["warfarin", "ibuprofen", "lisinopril", "simvastatin"] as const;
export type SampleName = (typeof SAMPLES)[number];

export function isSample(v: string): v is SampleName {
  return (SAMPLES as readonly string[]).includes(v);
}

export const SAMPLE_LABELS: Record<SampleName, { name: string; desc: string }> = {
  warfarin: { name: "Warfarin 5mg", desc: "blood thinner" },
  ibuprofen: { name: "Ibuprofen 200mg", desc: "pain reliever" },
  lisinopril: { name: "Lisinopril 10mg", desc: "blood pressure" },
  simvastatin: { name: "Simvastatin 20mg", desc: "cholesterol" },
};
