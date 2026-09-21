export type FieldType = "text" | "checkbox" | "radio" | "dropdown" | "optionlist";

export interface WidgetRect {
  /** 1-based page index */
  page: number;
  /** PDF points, origin bottom-left (native PDF space) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** export value for radio/checkbox kid widgets */
  option?: string;
}

export interface FormField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  maxLength?: number;
  rects: WidgetRect[];
  /** pre-filled value already in the document */
  value?: string;
}

export interface ExtractedForm {
  title: string;
  fieldCount: number;
  fields: FormField[];
  pageSizes: { width: number; height: number }[];
}

export interface Question {
  fieldId: string;
  /** plain-language question in the user's language */
  question: string;
  /** "why is this asked" / jargon buster */
  help?: string;
  /** format hint, e.g. "MM/DD/YYYY" */
  hint?: string;
  /** stable semantic key for the answer vault, e.g. "full_name" */
  semanticKey?: string;
}

export interface InterviewPlan {
  title: string;
  intro: string;
  questions: Question[];
  /** documents/items the user should gather */
  checklist: string[];
  source: "ai" | "offline";
  lang: string;
}

export type AnswerMap = Record<string, string | boolean>;

export interface FillProblem {
  fieldId: string;
  reason: string;
}
