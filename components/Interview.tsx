"use client";

import { useEffect, useRef, useState } from "react";
import type { FormField, InterviewPlan, Question } from "@/lib/schema";

type AnswerValue = string | boolean;

/* ---- speech recognition (progressive enhancement) ---- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;
function getSR(): SR {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: SR }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SR }).webkitSpeechRecognition ??
    null
  );
}

export default function Interview({
  plan,
  fields,
  answers,
  vaultHits,
  onAnswer,
  onActiveChange,
  onFinish,
  lang,
  jumpTo,
}: {
  plan: InterviewPlan;
  fields: FormField[];
  answers: Record<string, AnswerValue>;
  vaultHits: Set<string>; // fieldIds whose answers came from the vault
  onAnswer: (fieldId: string, value: AnswerValue) => void;
  onActiveChange: (fieldId: string) => void;
  onFinish: () => void;
  lang: string;
  /** bump {fieldId, n} to jump to that field's question */
  jumpTo?: { fieldId: string; n: number };
}) {
  const [idx, setIdx] = useState(0);
  const [helpOpenFor, setHelpOpenFor] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SR>(null);

  const q: Question | undefined = plan.questions[idx];
  const field = fields.find((f) => f.id === q?.fieldId);
  const total = plan.questions.length;
  const answeredCount = plan.questions.filter(
    (qq) => answers[qq.fieldId] !== undefined && answers[qq.fieldId] !== "",
  ).length;
  const isLast = idx === total - 1;
  const value = q ? answers[q.fieldId] : undefined;

  // clicking a field on the PDF jumps to its question (render-time adjustment)
  const [prevJump, setPrevJump] = useState(jumpTo);
  if (jumpTo !== prevJump) {
    setPrevJump(jumpTo);
    if (jumpTo) {
      const qi = plan.questions.findIndex((qq) => qq.fieldId === jumpTo.fieldId);
      if (qi >= 0) setIdx(qi);
    }
  }

  useEffect(() => {
    if (q) onActiveChange(q.fieldId);
    inputRef.current?.focus();
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => (isLast ? onFinish() : setIdx((i) => Math.min(i + 1, total - 1)));
  const back = () => setIdx((i) => Math.max(i - 1, 0));
  const skip = () => next();

  const startVoice = () => {
    const SRClass = getSR();
    if (!SRClass || !q || !field || field.type !== "text") return;
    const rec = new SRClass();
    rec.lang = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : lang === "hi" ? "hi-IN" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => {
      const text = e.results[0][0].transcript;
      onAnswer(q.fieldId, ((value as string) ?? "") + (value ? " " : "") + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  if (!q || !field) return null;

  const fromVault = vaultHits.has(q.fieldId);
  const showHelp = helpOpenFor === q.fieldId;

  return (
    <div className="flex h-full flex-col">
      {/* progress */}
      <div className="border-b border-zinc-200 px-5 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Question {idx + 1} of {total}
          </span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(answeredCount / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* question */}
      <div className="flex-1 overflow-auto px-5 py-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            {field.name}
          </span>
          {field.required && (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
              required
            </span>
          )}
          {fromVault && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              remembered ✓
            </span>
          )}
        </div>

        <h2 className="mb-4 text-xl font-semibold leading-snug text-zinc-900">
          {q.question}
        </h2>

        {q.help && (
          <button
            onClick={() => setHelpOpenFor(showHelp ? null : q.fieldId)}
            className="mb-3 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showHelp ? "− hide explanation" : "ⓘ why is this asked?"}
          </button>
        )}
        {showHelp && q.help && (
          <p className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-sm leading-relaxed text-indigo-900">
            {q.help}
          </p>
        )}

        {/* input by field type */}
        {field.type === "text" && (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={(value as string) ?? ""}
              onChange={(e) => onAnswer(q.fieldId, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder={q.hint ?? "type your answer…"}
              maxLength={field.maxLength}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 pr-11 text-base text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            {getSR() && (
              <button
                onClick={startVoice}
                title="voice input"
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-lg transition ${
                  listening ? "animate-pulse bg-rose-100" : "hover:bg-zinc-100"
                }`}
              >
                🎙️
              </button>
            )}
          </div>
        )}

        {field.type === "checkbox" && (
          <div className="flex gap-3">
            {[
              { v: true, label: "Yes" },
              { v: false, label: "No" },
            ].map((o) => (
              <button
                key={String(o.v)}
                onClick={() => onAnswer(q.fieldId, o.v)}
                className={`flex-1 rounded-lg border px-4 py-3 text-base font-medium transition ${
                  value === o.v
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-indigo-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {(field.type === "radio" || field.type === "dropdown" || field.type === "optionlist") && (
          <div className="flex flex-col gap-2">
            {(field.options ?? []).map((opt) => (
              <button
                key={opt}
                onClick={() => onAnswer(q.fieldId, opt)}
                className={`rounded-lg border px-4 py-3 text-left text-base transition ${
                  value === opt
                    ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-900 ring-1 ring-indigo-600"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-indigo-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.hint && field.type !== "text" && (
          <p className="mt-2 text-xs text-zinc-500">{q.hint}</p>
        )}
      </div>

      {/* nav */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3">
        <button
          onClick={back}
          disabled={idx === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-30"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={skip}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {isLast ? "Review answers →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
