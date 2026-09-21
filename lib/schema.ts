export interface ScannedMed {
  id: string;
  /** index into the uploaded/sample image list */
  image?: number;
  brand?: string;
  generic: string;
  strength?: string;
  form?: string;
  /** directions text exactly as printed ("sig") */
  sig?: string;
  quantity?: string;
  prescriber?: string;
  confidence: "high" | "medium" | "low";
  rawText?: string;
  notes?: string;
}

export type Severity = "major" | "moderate" | "minor" | "info";

export interface Interaction {
  severity: Severity;
  /** display names of the two meds involved */
  a: string;
  b: string;
  title: string;
  /** plain-language mechanism */
  mechanism: string;
  /** what to do about it */
  advice: string;
}

export type Slot = "morning" | "noon" | "evening" | "bedtime" | "as_needed";

export interface ScheduleEntry {
  medId: string;
  slots: Slot[];
  withFood?: boolean;
  emptyStomach?: boolean;
  timingNote?: string;
}

export interface MedExplanation {
  medId: string;
  purpose: string;
  tips?: string;
}

export interface Analysis {
  interactions: Interaction[];
  schedule: ScheduleEntry[];
  explanations: MedExplanation[];
  pharmacistQuestions: string[];
  source: "ai" | "offline";
}

export interface MedInput {
  id: string;
  generic: string;
  strength?: string;
  sig?: string;
  image?: number;
  confidence?: string;
}
