import type {
  AnswerMap,
  ExtractedForm,
  InterviewPlan,
  Question,
} from "./schema";
import { LANG_NAME, labelFor, semanticFor, t } from "./i18n";

/* ------------------------------------------------------------------ */
/* OpenAI-compatible chat with provider resilience                      */
/* ------------------------------------------------------------------ */

const BASE = () => process.env.LLM_BASE_URL?.replace(/\/$/, "");
const KEY = () => process.env.LLM_API_KEY;
const MODELS = () =>
  [process.env.LLM_MODEL, process.env.LLM_MODEL_FALLBACK].filter(
    (m): m is string => !!m,
  );

// Cloudflare blocks default fetch UAs on some providers (error 1010).
const UA = "FormPilot/1.0 (+hackathon; contact: devpost)";

class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Strip <think>…</think> and dangling think-tails; detect `!` token floods. */
function cleanCompletion(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  s = s.replace(/<think>[\s\S]*$/g, ""); // unterminated think
  if (/^!+$/.test(s.trim())) return ""; // pure flood
  s = s.replace(/\n!{20,}[\s\S]*$/, ""); // trailing flood
  return s.trim();
}

async function llmChat(
  system: string,
  user: string,
  { json = false, timeoutMs = 90_000 } = {},
): Promise<string | null> {
  const base = BASE();
  const key = KEY();
  if (!base || !key) return null;

  for (const model of MODELS()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const isQwen3 = /qwen3/i.test(model);
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "User-Agent": UA,
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: isQwen3 ? `${user}\n/no_think` : user },
            ],
            ...(json ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          // capacity / cold start → retry same model once, then next model
          if (res.status === 503 || res.status === 429 || /capacity/i.test(body)) {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 2500));
              continue;
            }
            break;
          }
          throw new UpstreamError(res.status, body.slice(0, 200));
        }
        const data = await res.json();
        const content: string | undefined =
          data?.choices?.[0]?.message?.content ?? undefined;
        if (!content) break;
        const cleaned = cleanCompletion(content);
        if (!cleaned) break; // flood → next model
        return cleaned;
      } catch (err) {
        if (attempt === 0 && !(err instanceof UpstreamError)) {
          await new Promise((r) => setTimeout(r, 1500));
          continue; // network hiccup / cold start timeout → retry once
        }
        break; // → next model
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
/* Interview plan                                                      */
/* ------------------------------------------------------------------ */

export function mockPlan(form: ExtractedForm, lang: string): InterviewPlan {
  const tr = t(lang);
  const questions: Question[] = form.fields.map((f) => {
    const sem = semanticFor(f.name);
    const label = labelFor(f.name, lang);
    const template =
      f.type === "checkbox"
        ? tr.confirm
        : f.options?.length
          ? tr.provideChoice
          : tr.provide;
    return {
      fieldId: f.id,
      question: template.replace("{label}", label),
      help: sem?.why ? tr.whyAsked.replace("{why}", sem.why) : undefined,
      hint: f.type === "text" ? (sem?.hint ?? (f.maxLength ? `max ${f.maxLength} chars` : undefined)) : undefined,
      semanticKey: sem?.key,
    };
  });

  const checklist = inferChecklist(form, lang);

  return {
    title: form.title,
    intro: tr.intro,
    questions,
    checklist,
    source: "offline",
    lang,
  };
}

function inferChecklist(form: ExtractedForm, lang: string): string[] {
  const items: Record<string, string> = {
    en: "Government-issued photo ID",
    es: "Identificación oficial con foto",
    zh: "政府签发的带照片身份证件",
    hi: "सरकारी फ़ोटो पहचान पत्र",
    fr: "Pièce d'identité officielle avec photo",
    ar: "بطاقة هوية حكومية بصورة",
  };
  const income: Record<string, string> = {
    en: "Recent pay stubs or income proof",
    es: "Recibos de pago o comprobante de ingresos",
    zh: "近期工资单或收入证明",
    hi: "हाल की वेतन पर्ची या आय प्रमाण",
    fr: "Bulletins de salaire récents ou justificatif de revenus",
    ar: "قسائم راتب حديثة أو إثبات دخل",
  };
  const card: Record<string, string> = {
    en: "Insurance card",
    es: "Tarjeta de seguro",
    zh: "医保卡",
    hi: "बीमा कार्ड",
    fr: "Carte d'assurance",
    ar: "بطاقة التأمين",
  };
  const out: string[] = [items[lang] ?? items.en];
  if (form.fields.some((f) => /income|salary|wage|ssn/i.test(f.name)))
    out.push(income[lang] ?? income.en);
  if (form.fields.some((f) => /insur|member|policy/i.test(f.name)))
    out.push(card[lang] ?? card.en);
  return out;
}

export async function planInterview(
  form: ExtractedForm,
  lang: string,
): Promise<InterviewPlan> {
  const fallback = mockPlan(form, lang);
  if (!BASE() || !KEY()) return fallback;

  const langName = LANG_NAME[lang] ?? "English";
  const compact = form.fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    required: f.required,
    options: f.options,
    currentValue: f.value,
  }));

  const system =
    "You are FormPilot, an assistant that turns bureaucratic PDF form fields into a warm, plain-language guided interview. You output ONLY valid JSON.";
  const user = `Here are the AcroForm fields extracted from a PDF titled "${form.title}":

${JSON.stringify(compact, null, 1)}

Produce a JSON object with EXACTLY this shape:
{
  "title": "short friendly title for this form",
  "intro": "1-2 sentence welcome explaining what you'll do, in ${langName}",
  "questions": [
    {
      "fieldId": "<id from the list above — every field id must appear exactly once>",
      "question": "a plain-language question in ${langName} asking for this value",
      "help": "one sentence in ${langName} explaining WHY the form asks this / what it means in plain words",
      "hint": "format hint like 'MM/DD/YYYY' or '9 digits' when useful (omit otherwise)",
      "semanticKey": "one of: full_name, first_name, last_name, dob, ssn, email, phone, address, city, state, zip, country, gender, income, household_size, employed, employer, signature, date — or omit"
    }
  ],
  "checklist": ["2-4 documents the user should physically have ready, in ${langName}"]
}

Rules:
- questions must cover EVERY field id, in the same order given
- for checkbox fields, phrase as a yes/no question
- for radio/dropdown fields, ask which option applies (do not list options — the UI shows them)
- never use bureaucratic jargon; write at a 6th-grade reading level
- write ALL question/help/intro/checklist text in ${langName}`;

  const raw = await llmChat(system, user, { json: true });
  const parsed = raw ? (extractJson(raw) as Partial<InterviewPlan> | null) : null;
  if (!parsed || !Array.isArray(parsed.questions)) return fallback;

  // Merge: keep valid LLM questions for known field ids, in LLM order,
  // then append mock questions for any fields the model skipped.
  const knownIds = new Set(form.fields.map((f) => f.id));
  const seenIds = new Set<string>();
  const questions: Question[] = [];
  for (const q of parsed.questions) {
    if (
      !q ||
      typeof q.fieldId !== "string" ||
      !knownIds.has(q.fieldId) ||
      seenIds.has(q.fieldId) ||
      typeof q.question !== "string" ||
      !q.question.trim()
    )
      continue;
    seenIds.add(q.fieldId);
    questions.push({
      fieldId: q.fieldId,
      question: q.question.trim(),
      help: typeof q.help === "string" ? q.help : undefined,
      hint: typeof q.hint === "string" ? q.hint : undefined,
      semanticKey:
        typeof q.semanticKey === "string" ? q.semanticKey : semanticFor(form.fields.find((f) => f.id === q.fieldId)?.name ?? "")?.key,
    });
  }
  for (const q of fallback.questions)
    if (!seenIds.has(q.fieldId)) questions.push(q);

  return {
    title: typeof parsed.title === "string" ? parsed.title : fallback.title,
    intro: typeof parsed.intro === "string" ? parsed.intro : fallback.intro,
    questions,
    checklist:
      Array.isArray(parsed.checklist) && parsed.checklist.every((c) => typeof c === "string")
        ? parsed.checklist
        : fallback.checklist,
    source: "ai",
    lang,
  };
}

/* ------------------------------------------------------------------ */
/* Submission summary                                                   */
/* ------------------------------------------------------------------ */

export function mockSummary(
  form: ExtractedForm,
  answers: AnswerMap,
  lang: string,
): string {
  const lines: string[] = [
    `# ${form.title}`,
    "",
    `_${new Date().toLocaleDateString()}_`,
    "",
    "| Field | Your answer |",
    "| --- | --- |",
  ];
  for (const f of form.fields) {
    const a = answers[f.id];
    const shown =
      a === undefined || a === "" ? "—" : a === true ? "☑ yes" : a === false ? "☐ no" : String(a);
    lines.push(`| ${labelFor(f.name, lang)} | ${shown} |`);
  }
  return lines.join("\n");
}

export async function summarizeSubmission(
  form: ExtractedForm,
  answers: AnswerMap,
  lang: string,
): Promise<string> {
  const fallback = mockSummary(form, answers, lang);
  if (!BASE() || !KEY()) return fallback;

  const langName = LANG_NAME[lang] ?? "English";
  const rows = form.fields.map((f) => ({
    field: f.name,
    answer: answers[f.id] ?? null,
  }));
  const system =
    "You write concise, warm plain-language summaries of a form a person just filled out. Output markdown only.";
  const user = `Form: "${form.title}". Language: ${langName}.

Fields and answers (JSON):
${JSON.stringify(rows, null, 1)}

Write a short markdown summary in ${langName}:
- "## What you just submitted" section with 2-3 sentences in plain words
- a compact table: | Field | You answered |
- a "## What happens next" section: 2-3 realistic next steps for this kind of form (review, mailing/portal submission, expected wait)
- a "## Watch out for" section with 1-3 common pitfalls for these fields (e.g. unsigned forms get rejected)
Keep it under 300 words.`;

  const raw = await llmChat(system, user, { json: false });
  return raw && raw.length > 40 ? raw : fallback;
}
