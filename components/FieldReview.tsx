"use client";

import type { FormField, InterviewPlan } from "@/lib/schema";

type AnswerValue = string | boolean;

export default function FieldReview({
  plan,
  fields,
  answers,
  onAnswer,
  onFieldFocus,
}: {
  plan: InterviewPlan;
  fields: FormField[];
  answers: Record<string, AnswerValue>;
  onAnswer: (fieldId: string, value: AnswerValue) => void;
  onFieldFocus?: (fieldId: string) => void;
}) {
  return (
    <div className="h-full overflow-auto px-5 py-4">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">Review your answers</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Edit anything below — changes write straight into the PDF.
      </p>
      <div className="flex flex-col gap-2 pb-6">
        {plan.questions.map((q) => {
          const field = fields.find((f) => f.id === q.fieldId);
          if (!field) return null;
          const v = answers[q.fieldId];
          const empty = v === undefined || v === "";
          return (
            <div
              key={q.fieldId}
              onClick={() => onFieldFocus?.(q.fieldId)}
              className={`rounded-lg border px-3 py-2.5 transition ${
                empty ? "border-dashed border-zinc-300 bg-zinc-50" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600">{q.question}</span>
                <span className="shrink-0 font-mono text-[10px] text-zinc-400">{field.name}</span>
              </div>
              {field.type === "checkbox" ? (
                <div className="flex gap-2">
                  {[
                    { v: true, label: "Yes" },
                    { v: false, label: "No" },
                  ].map((o) => (
                    <button
                      key={String(o.v)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnswer(q.fieldId, o.v);
                      }}
                      className={`rounded-md border px-3 py-1 text-sm ${
                        v === o.v
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-zinc-300 bg-white text-zinc-600"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : field.options?.length ? (
                <select
                  value={(v as string) ?? ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onAnswer(q.fieldId, e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-indigo-500"
                >
                  <option value="">— choose —</option>
                  {field.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={(v as string) ?? ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onAnswer(q.fieldId, e.target.value)}
                  placeholder={q.hint ?? "not answered"}
                  maxLength={field.maxLength}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 outline-none placeholder-zinc-400 focus:border-indigo-500"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
