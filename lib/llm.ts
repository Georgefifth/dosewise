import { DRUGS, resolveDrug } from "./drugs";
import type { MedExplanation, ScannedMed } from "./schema";

/* OpenAI-compatible provider layer.
   - vision calls (VL_MODEL / VL_MODEL_FALLBACK) read label photos
   - text calls (LLM_MODEL / LLM_MODEL_FALLBACK) write explanations
   - hardened for flaky upstreams: custom UA (Cloudflare), cold-start retries,
     model fallback, <think> stripping, `!`-flood detection */

const BASE = () => process.env.LLM_BASE_URL?.replace(/\/$/, "");
const KEY = () => process.env.LLM_API_KEY;
const VL_MODELS = () =>
  [process.env.VL_MODEL, process.env.VL_MODEL_FALLBACK].filter((m): m is string => !!m);
const TEXT_MODELS = () =>
  [process.env.LLM_MODEL, process.env.LLM_MODEL_FALLBACK].filter((m): m is string => !!m);

const UA = "DoseWise/1.0 (+hackathon)";

class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function cleanCompletion(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  s = s.replace(/<think>[\s\S]*$/g, "");
  if (/^!+$/.test(s.trim())) return "";
  s = s.replace(/\n!{20,}[\s\S]*$/, "");
  return s.trim();
}

type Msg =
  | { role: "system"; content: string }
  | {
      role: "user";
      content:
        | string
        | (
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
          )[];
    };

async function chat(
  models: string[],
  messages: Msg[],
  { json = false, timeoutMs = 120_000 } = {},
): Promise<string | null> {
  const base = BASE();
  const key = KEY();
  if (!base || !key || !models.length) return null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const isQwen3 = /qwen3/i.test(model);
        const msgs: Msg[] = isQwen3
          ? messages.map((m, i) => {
              if (i !== messages.length - 1 || m.role !== "user") return m;
              if (typeof m.content === "string")
                return { ...m, content: `${m.content}\n/no_think` };
              const parts = [...m.content];
              for (let j = parts.length - 1; j >= 0; j--) {
                const c = parts[j];
                if (c.type === "text") {
                  parts[j] = { ...c, text: `${c.text}\n/no_think` };
                  break;
                }
              }
              return { ...m, content: parts };
            })
          : messages;

        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "User-Agent": UA,
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            messages: msgs,
            ...(json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 503 || res.status === 429 || /capacity|rate/i.test(body)) {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            break;
          }
          throw new UpstreamError(res.status, body.slice(0, 300));
        }
        const data = await res.json();
        const content: string | undefined = data?.choices?.[0]?.message?.content;
        if (!content) break;
        const cleaned = cleanCompletion(content);
        if (!cleaned) break;
        return cleaned;
      } catch (err) {
        if (attempt === 0 && !(err instanceof UpstreamError)) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        break;
      }
    }
  }
  return null;
}

function extractJson(raw: string): unknown | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Label scanning (vision)                                             */
/* ------------------------------------------------------------------ */

const SCAN_SYSTEM = `You are a pharmacy-label OCR assistant. Read the medication label photo and output ONLY a JSON object:
{"generic": "generic drug name (lowercase)", "brand": "brand name or null", "strength": "e.g. 5 mg", "form": "tablet|capsule|liquid|spray|patch|null", "sig": "the directions text verbatim, e.g. 'take one tablet by mouth twice daily'", "quantity": "e.g. 30 tablets or null", "prescriber": "prescriber name or null", "confidence": "high|medium|low"}
If the image is not a medication label, output {"generic": null, "confidence": "low", "notes": "not a medication label"}.`;

export async function scanLabelImage(
  imageB64: string,
  mime: string,
  id: string,
  imageIdx: number,
  nudge = false,
): Promise<ScannedMed> {
  const raw = await chat(VL_MODELS(), [
    { role: "system", content: SCAN_SYSTEM },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: nudge
            ? "Look again carefully — the largest bold text on the label is the drug name. Extract this medication label."
            : "Extract this medication label.",
        },
        { type: "image_url", image_url: { url: `data:${mime};base64,${imageB64}` } },
      ],
    },
  ]);

  const parsed = raw ? (extractJson(raw) as Record<string, unknown> | null) : null;
  if (!parsed || typeof parsed !== "object") {
    return {
      id,
      image: imageIdx,
      generic: "",
      confidence: "low",
      notes: "Could not read this label — please type the details.",
    };
  }

  const generic = typeof parsed.generic === "string" ? parsed.generic : "";
  const resolved = generic ? resolveDrug(generic) : undefined;
  return {
    id,
    image: imageIdx,
    generic: resolved?.generic ?? generic,
    brand: typeof parsed.brand === "string" ? parsed.brand : undefined,
    strength: typeof parsed.strength === "string" ? parsed.strength : undefined,
    form: typeof parsed.form === "string" ? parsed.form : undefined,
    sig: typeof parsed.sig === "string" ? parsed.sig : undefined,
    quantity: typeof parsed.quantity === "string" ? parsed.quantity : undefined,
    prescriber: typeof parsed.prescriber === "string" ? parsed.prescriber : undefined,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
    notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
  };
}

/** Canned scans for bundled samples — used when no LLM key is configured. */
export function mockScan(id: string, imageIdx: number, sampleName: string): ScannedMed {
  const table: Record<string, Omit<ScannedMed, "id" | "image">> = {
    warfarin: {
      generic: "warfarin", brand: "Coumadin", strength: "5 mg", form: "tablet",
      sig: "take one tablet by mouth once daily", quantity: "30 tablets",
      prescriber: "Dr. A. Chen", confidence: "high",
    },
    ibuprofen: {
      generic: "ibuprofen", brand: "Advil", strength: "200 mg", form: "tablet",
      sig: "take one tablet every 6 hours as needed for pain", quantity: "100 tablets",
      confidence: "high",
    },
    lisinopril: {
      generic: "lisinopril", strength: "10 mg", form: "tablet",
      sig: "take one tablet by mouth once daily", quantity: "90 tablets",
      prescriber: "Dr. A. Chen", confidence: "high",
    },
    simvastatin: {
      generic: "simvastatin", brand: "Zocor", strength: "20 mg", form: "tablet",
      sig: "take one tablet by mouth at bedtime", quantity: "30 tablets",
      prescriber: "Dr. A. Chen", confidence: "high",
    },
  };
  const base = table[sampleName] ?? {
    generic: "", confidence: "low" as const, notes: "demo image",
  };
  return { id, image: imageIdx, ...base };
}

/* ------------------------------------------------------------------ */
/* Explanations + pharmacist questions (text LLM)                      */
/* ------------------------------------------------------------------ */

export function mockExplain(meds: { id: string; generic: string }[]): {
  explanations: MedExplanation[];
  pharmacistQuestions: string[];
} {
  const explanations: MedExplanation[] = meds.map((m) => {
    const info = resolveDrug(m.generic);
    return {
      medId: m.id,
      purpose: info
        ? `${info.generic.charAt(0).toUpperCase() + info.generic.slice(1)} is ${info.purpose}`
        : `${m.generic} — purpose not in the offline dictionary; ask your pharmacist.`,
      tips: info?.foodNote,
    };
  });
  const pharmacistQuestions = [
    "Can I take all of these together safely?",
    "Are there any foods, drinks, or supplements I should avoid?",
    "What should I do if I miss a dose of any of these?",
  ];
  return { explanations, pharmacistQuestions };
}

export async function explainMeds(
  meds: { id: string; generic: string; strength?: string; sig?: string }[],
  lang: string,
): Promise<{ explanations: MedExplanation[]; pharmacistQuestions: string[]; source: "ai" | "offline" }> {
  const fallback = mockExplain(meds);
  if (!BASE() || !KEY() || !meds.length)
    return { ...fallback, source: "offline" };

  const langName =
    (await import("./i18n")).LANG_NAME[lang] ?? "English";

  const system =
    "You write short, warm, plain-language medication explanations for patients. Output ONLY valid JSON. You are not giving medical advice — you describe what each medicine is commonly for.";
  const user = `Medications (JSON):
${JSON.stringify(meds.map((m) => ({ id: m.id, generic: m.generic, strength: m.strength, sig: m.sig })), null, 1)}

Output JSON:
{
  "explanations": [ { "medId": "<id>", "purpose": "one sentence: what this medicine is for, in ${langName}, 6th-grade level", "tips": "one practical tip (food/timing/monitoring) or null" } ],
  "pharmacistQuestions": ["3-4 smart questions this person should ask their pharmacist about THIS combination, in ${langName}"]
}
Every medId must appear exactly once.`;

  const raw = await chat(TEXT_MODELS(), [
    { role: "system", content: system },
    { role: "user", content: user },
  ], { timeoutMs: 60_000 });
  const parsed = raw ? (extractJson(raw) as Record<string, unknown> | null) : null;

  if (!parsed || !Array.isArray(parsed.explanations)) return { ...fallback, source: "offline" };

  const known = new Set(meds.map((m) => m.id));
  const seen = new Set<string>();
  const explanations: MedExplanation[] = [];
  for (const e of parsed.explanations as MedExplanation[]) {
    if (!e || !known.has(e.medId) || seen.has(e.medId) || typeof e.purpose !== "string") continue;
    seen.add(e.medId);
    explanations.push({ medId: e.medId, purpose: e.purpose, tips: typeof e.tips === "string" ? e.tips : undefined });
  }
  for (const f of fallback.explanations) if (!seen.has(f.medId)) explanations.push(f);

  const questions = Array.isArray(parsed.pharmacistQuestions)
    ? (parsed.pharmacistQuestions as unknown[]).filter((q): q is string => typeof q === "string")
    : fallback.pharmacistQuestions;

  return { explanations, pharmacistQuestions: questions, source: "ai" };
}

/** used by analyze route to attach purposes when AI is off — keeps a single path */
export function knownGenerics(): string[] {
  return DRUGS.map((d) => d.generic);
}
