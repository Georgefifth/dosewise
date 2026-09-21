"use client";

/* Browser-side AI path — used on the static (GitHub Pages) deployment where
   /api/* doesn't exist.
   - bundled samples → canned scans (deterministic demo, zero keys)
   - uploaded images → if the user pasted a BYOK OpenAI-compatible key, we call
     the endpoint straight from the browser (Featherless is CORS-open);
     otherwise a low-confidence placeholder they can fill in manually
   - analysis rules (interactions/schedule/refills) are pure TS — run locally
     in every deployment */

import { checkInteractions } from "./interactions";
import { mockExplain, mockScan } from "./llm";
import { resolveDrug } from "./drugs";
import { buildSchedule, estimateSupply } from "./schedule";
import type {
  Analysis,
  MedExplanation,
  MedInput,
  ScannedMed,
} from "./schema";

const BYOK_KEY = "dosewise.byok";

export interface ByokConfig {
  baseUrl: string;
  apiKey: string;
  vlModel: string;
  textModel: string;
}

export function getByok(): ByokConfig | null {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j.baseUrl || !j.apiKey) return null;
    return j as ByokConfig;
  } catch {
    return null;
  }
}

export function saveByok(cfg: ByokConfig | null) {
  try {
    if (cfg) localStorage.setItem(BYOK_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(BYOK_KEY);
  } catch {}
}

/* minimal OpenAI-compatible chat — the resilient server version lives in
   lib/llm.ts; this one just needs a happy path + one retry */
async function browserChat(
  cfg: ByokConfig,
  model: string,
  messages: unknown[],
  imageB64?: { b64: string; mime: string },
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: imageB64
            ? [
                { role: "system", content: messages[0] },
                {
                  role: "user",
                  content: [
                    { type: "text", text: messages[1] },
                    { type: "image_url", image_url: { url: `data:${imageB64.mime};base64,${imageB64.b64}` } },
                  ],
                },
              ]
            : messages.map((m, i) =>
                i === messages.length - 1 && /qwen3/i.test(model)
                  ? { role: "user", content: `${(m as { content: string }).content}\n/no_think` }
                  : m,
              ),
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        if (attempt === 0 && (res.status === 503 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return null;
      }
      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) return null;
      const cleaned = content.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
      return cleaned || null;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

const SCAN_SYSTEM = `You are a pharmacy-label OCR assistant. Read the medication label photo and output ONLY a JSON object:
{"generic": "generic drug name (lowercase)", "brand": "brand name or null", "strength": "e.g. 5 mg", "form": "tablet|capsule|liquid|spray|patch|null", "sig": "the directions text verbatim", "quantity": "e.g. 30 tablets or null", "prescriber": "prescriber name or null", "confidence": "high|medium|low"}
If the image is not a medication label, output {"generic": null, "confidence": "low", "notes": "not a medication label"}.`;

function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function scanImageBrowser(
  sample: string | undefined,
  file: File | undefined,
  id: string,
  idx: number,
): Promise<ScannedMed> {
  const byok = getByok();
  if (sample) {
    // with BYOK, scan the real PNG for fidelity; without, canned data
    if (!byok) return mockScan(id, idx, sample);
    const res = await fetch(`samples/${sample}.png`); // relative — works under gh-pages basePath
    const blob = await res.blob();
    file = new File([blob], `${sample}.png`, { type: "image/png" });
  }
  if (!file || !byok)
    return {
      id, image: idx, generic: "", confidence: "low",
      notes: byok ? "no image" : "paste an API key in ⚙ settings for live scanning — or type it in here",
    };

  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  const b64 = btoa(bin);

  const raw = await browserChat(byok, byok.vlModel, [SCAN_SYSTEM, "Extract this medication label."], {
    b64,
    mime: file.type || "image/png",
  });
  const parsed = raw ? extractJson(raw) : null;
  if (!parsed)
    return { id, image: idx, generic: "", confidence: "low", notes: "could not read — type it in" };
  const generic = typeof parsed.generic === "string" ? parsed.generic : "";
  const resolved = generic ? resolveDrug(generic) : undefined;
  return {
    id, image: idx,
    generic: resolved?.generic ?? generic,
    brand: typeof parsed.brand === "string" ? parsed.brand : undefined,
    strength: typeof parsed.strength === "string" ? parsed.strength : undefined,
    form: typeof parsed.form === "string" ? parsed.form : undefined,
    sig: typeof parsed.sig === "string" ? parsed.sig : undefined,
    quantity: typeof parsed.quantity === "string" ? parsed.quantity : undefined,
    confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
  };
}

export async function analyzeBrowser(meds: MedInput[], lang: string): Promise<Analysis> {
  const interactions = checkInteractions(meds);
  const schedule = buildSchedule(meds);
  const refills = meds.map((m) => ({ medId: m.id, ...estimateSupply(m) }));

  const byok = getByok();
  let explanations: MedExplanation[] = mockExplain(meds).explanations;
  let pharmacistQuestions = mockExplain(meds).pharmacistQuestions;
  let source: "ai" | "offline" = "offline";

  if (byok && meds.length) {
    const langName =
      { en: "English", es: "Spanish", zh: "Simplified Chinese", hi: "Hindi", fr: "French", ar: "Modern Standard Arabic" }[
        lang
      ] ?? "English";
    const raw = await browserChat(byok, byok.textModel, [
      {
        role: "system",
        content:
          "You write short, warm, plain-language medication explanations for patients. Output ONLY valid JSON.",
      },
      {
        role: "user",
        content: `Medications: ${JSON.stringify(meds.map((m) => ({ id: m.id, generic: m.generic, strength: m.strength })))}
Output JSON: {"explanations":[{"medId":"id","purpose":"one sentence what it is for in ${langName}, 6th-grade level","tips":"one practical tip or null"}],"pharmacistQuestions":["3-4 questions for THIS combination in ${langName}"]}`,
      },
    ]);
    const parsed = raw ? extractJson(raw) : null;
    if (parsed && Array.isArray(parsed.explanations)) {
      const known = new Set(meds.map((m) => m.id));
      const seen = new Set<string>();
      const got: MedExplanation[] = [];
      for (const e of parsed.explanations as MedExplanation[]) {
        if (!e || !known.has(e.medId) || seen.has(e.medId) || typeof e.purpose !== "string") continue;
        seen.add(e.medId);
        got.push({ medId: e.medId, purpose: e.purpose, tips: typeof e.tips === "string" ? e.tips : undefined });
      }
      for (const f of explanations) if (!seen.has(f.medId)) got.push(f);
      explanations = got;
      if (Array.isArray(parsed.pharmacistQuestions))
        pharmacistQuestions = (parsed.pharmacistQuestions as unknown[]).filter(
          (q): q is string => typeof q === "string",
        );
      source = "ai";
    }
  }

  return { interactions, schedule, explanations, refills, pharmacistQuestions, source };
}
