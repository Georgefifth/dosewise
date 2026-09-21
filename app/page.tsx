"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PdfViewer from "@/components/PdfViewer";
import Interview from "@/components/Interview";
import FieldReview from "@/components/FieldReview";
import MarkdownLite from "@/components/MarkdownLite";
import { LANGS } from "@/lib/i18n";
import { loadVault, saveVault } from "@/lib/vault";
import type {
  AnswerMap,
  ExtractedForm,
  FillProblem,
  InterviewPlan,
} from "@/lib/schema";

type Phase = "landing" | "working" | "interview" | "review" | "done";
type Source = { kind: "file"; file: File } | { kind: "sample"; name: string };

const SAMPLES = [
  {
    id: "benefits-application",
    name: "Form SB-10 · Benefits Application",
    desc: "State assistance form — SSN, income, household",
    emoji: "🏛️",
  },
  {
    id: "medical-intake",
    name: "Form MI-2 · Patient Intake",
    desc: "Clinic intake — history, insurance, consent",
    emoji: "🏥",
  },
  {
    id: "rental-application",
    name: "Form RA-7 · Rental Application",
    desc: "Apartment application — income, references, pets",
    emoji: "🏠",
  },
];

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState("en");
  const [source, setSource] = useState<Source | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [form, setForm] = useState<ExtractedForm | null>(null);
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [vaultHits, setVaultHits] = useState<Set<string>>(new Set());
  const [activeField, setActiveField] = useState<string>();
  const [jumpTo, setJumpTo] = useState<{ fieldId: string; n: number }>();
  const [summary, setSummary] = useState("");
  const [problems, setProblems] = useState<FillProblem[]>([]);
  const [filledUrl, setFilledUrl] = useState<string>();
  const [filledName, setFilledName] = useState("filled.pdf");
  const [bigText, setBigText] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const answeredIds = useMemo(
    () =>
      new Set(
        Object.entries(answers)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k]) => k),
      ),
    [answers],
  );

  /* ------------------------------ pipeline ------------------------------ */

  const startWith = useCallback(
    async (src: Source, bytes: ArrayBuffer) => {
      setError(null);
      setSource(src);
      setPdfBytes(bytes);
      setPhase("working");
      try {
        setStage("Reading the form — extracting every field…");
        const fd = new FormData();
        if (src.kind === "file") fd.set("file", src.file);
        else fd.set("sample", src.name);
        const ex = await fetch("/api/extract", { method: "POST", body: fd });
        const exJson = await ex.json();
        if (!ex.ok) throw new Error(exJson.error ?? "Could not read this PDF");
        const extracted = exJson as ExtractedForm;
        setForm(extracted);

        setStage("Translating fields into plain language…");
        const pl = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form: extracted, lang }),
        });
        const planJson = await pl.json();
        if (!pl.ok) throw new Error(planJson.error ?? "Could not build the interview");
        const p = planJson as InterviewPlan;
        setPlan(p);

        // seed answers: existing PDF values + vault hits
        const vault = loadVault();
        const seed: AnswerMap = {};
        const hits = new Set<string>();
        for (const f of extracted.fields) {
          if (f.value && f.type !== "checkbox") seed[f.id] = f.value;
          if (f.value === "true" && f.type === "checkbox") seed[f.id] = true;
        }
        for (const q of p.questions) {
          if (q.semanticKey && vault[q.semanticKey] && seed[q.fieldId] === undefined) {
            seed[q.fieldId] = vault[q.semanticKey];
            hits.add(q.fieldId);
          }
        }
        setAnswers(seed);
        setVaultHits(hits);
        setActiveField(p.questions[0]?.fieldId);
        setPhase("interview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setPhase("landing");
      }
    },
    [lang],
  );

  const pickFile = useCallback(
    async (file: File) => startWith({ kind: "file", file }, await file.arrayBuffer()),
    [startWith],
  );

  const pickSample = useCallback(
    async (name: string) => {
      const res = await fetch(`/samples/${name}.pdf`);
      const bytes = await res.arrayBuffer();
      return startWith({ kind: "sample", name }, bytes);
    },
    [startWith],
  );

  const setAnswer = useCallback((fieldId: string, v: string | boolean) => {
    setAnswers((a) => ({ ...a, [fieldId]: v }));
  }, []);

  /* ------------------------------- finish ------------------------------- */

  const fillAndSummarize = useCallback(async () => {
    if (!source || !form) return;
    setPhase("working");
    setStage("Writing your answers into the PDF…");
    try {
      // persist semantic answers into the vault
      if (plan) {
        const entries: Record<string, string> = {};
        for (const q of plan.questions) {
          const v = answers[q.fieldId];
          if (q.semanticKey && typeof v === "string" && v.trim())
            entries[q.semanticKey] = v;
        }
        saveVault(entries);
      }

      const fd = new FormData();
      if (source.kind === "file") fd.set("file", source.file);
      else fd.set("sample", source.name);
      fd.set("answers", JSON.stringify(answers));
      const res = await fetch("/api/fill", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "fill failed");
      }
      const blob = await res.blob();
      setFilledUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(cd);
      if (m) setFilledName(m[1]);
      try {
        setProblems(JSON.parse(decodeURIComponent(res.headers.get("X-Fill-Problems") ?? "%5B%5D")));
      } catch {
        setProblems([]);
      }

      setStage("Writing your plain-language summary…");
      const sr = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, answers, lang }),
      });
      const sj = await sr.json();
      setSummary(sj.markdown ?? "");
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fill failed");
      setPhase("review");
    }
  }, [source, form, plan, answers, lang]);

  const reset = () => {
    setPhase("landing");
    setForm(null);
    setPlan(null);
    setAnswers({});
    setVaultHits(new Set());
    setSource(null);
    setPdfBytes(null);
    setSummary("");
    setProblems([]);
    setError(null);
    if (filledUrl) URL.revokeObjectURL(filledUrl);
    setFilledUrl(undefined);
  };

  /* -------------------------------- views ------------------------------- */

  const shell = (children: React.ReactNode) => (
    <div
      className={`flex min-h-screen flex-col bg-[#f7f5f1] text-zinc-900 ${bigText ? "text-lg" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (--dragDepth.current === 0) setDragging(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) pickFile(f);
      }}
    >
      <header className="flex items-center justify-between border-b border-zinc-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <button onClick={reset} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-black text-white">
            F
          </span>
          <span className="text-base font-bold tracking-tight">FormPilot</span>
          <span className="hidden text-xs text-zinc-400 sm:inline">paperwork, translated</span>
        </button>
        <div className="flex items-center gap-3">
          {plan && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                plan.source === "ai"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {plan.source === "ai" ? "◆ AI online" : "◆ offline mode"}
            </span>
          )}
          <button
            onClick={() => setBigText((b) => !b)}
            title="larger text"
            className={`rounded-md px-2 py-1 text-xs font-bold transition ${
              bigText ? "bg-indigo-100 text-indigo-700" : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            A+
          </button>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      {children}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-indigo-600/20 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-indigo-500 bg-white px-10 py-8 text-lg font-semibold text-indigo-700 shadow-xl">
            Drop your PDF form here
          </div>
        </div>
      )}
    </div>
  );

  /* ------------------------------- landing ------------------------------ */

  if (phase === "landing")
    return shell(
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 py-14">
        <div className="mb-3 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          InfinityX Global Hackathon 2K26
        </div>
        <h1 className="mb-4 max-w-2xl text-center text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          Forms shouldn&apos;t need a lawyer to read.
        </h1>
        <p className="mb-8 max-w-xl text-center text-lg leading-relaxed text-zinc-600">
          Upload any fillable PDF form. FormPilot turns every cryptic field into a
          plain-language question — in your language — then writes your answers into
          the real document.
        </p>

        <div className="mb-10 grid w-full max-w-2xl grid-cols-3 gap-3 text-center">
          {[
            ["$140B+", "benefits unclaimed yearly"],
            ["1 in 5", "adults struggle with forms"],
            ["6+", "languages supported"],
          ].map(([n, d]) => (
            <div key={d} className="rounded-xl border border-zinc-200 bg-white px-3 py-4">
              <div className="text-xl font-black text-indigo-600">{n}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{d}</div>
            </div>
          ))}
        </div>

        <button
          onClick={() => fileInput.current?.click()}
          className="mb-3 flex w-full max-w-2xl flex-col items-center rounded-2xl border-2 border-dashed border-indigo-300 bg-white px-8 py-10 transition hover:border-indigo-500 hover:bg-indigo-50/40"
        >
          <span className="text-3xl">📄</span>
          <span className="mt-3 text-base font-semibold text-zinc-800">
            Drop a fillable PDF, or click to browse
          </span>
          <span className="mt-1 text-xs text-zinc-500">
            processed in your session — nothing is stored
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
        />

        <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          or try a sample form
        </p>
        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => pickSample(s.id)}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:shadow-sm"
            >
              <div className="text-xl">{s.emoji}</div>
              <div className="mt-2 text-sm font-semibold text-zinc-800">{s.name}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{s.desc}</div>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 max-w-xl rounded-lg bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
            {error}
          </p>
        )}

        <footer className="mt-14 text-center text-xs text-zinc-400">
          Built for people blocked by paperwork — immigrants, seniors, and anyone facing a form
          in a language they don&apos;t fully speak.
        </footer>
      </main>,
    );

  /* ------------------------------- working ------------------------------ */

  if (phase === "working")
    return shell(
      <main className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-zinc-600">{stage}</p>
        </div>
      </main>,
    );

  if (!form || !plan || !pdfBytes) return shell(<main className="flex-1" />);

  /* --------------------------- interview/review -------------------------- */

  if (phase === "interview" || phase === "review")
    return shell(
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">{plan.title}</h1>
            <p className="text-xs text-zinc-500">{plan.intro}</p>
          </div>
          <div className="flex gap-2">
            {phase === "review" && (
              <button
                onClick={() => setPhase("interview")}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
              >
                ← keep answering
              </button>
            )}
          </div>
        </div>

        {plan.checklist.length > 0 && phase === "interview" && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Have ready:</span>
            {plan.checklist.map((c, i) => (
              <span key={i} className="rounded bg-white/70 px-2 py-0.5">
                {c}
              </span>
            ))}
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
        )}

        <div className="flex min-h-0 flex-1 gap-4">
          <div className="hidden w-[55%] overflow-hidden rounded-xl border border-zinc-200 lg:block">
            <PdfViewer
              pdfBytes={pdfBytes}
              fields={form.fields}
              activeFieldId={activeField}
              answeredIds={answeredIds}
              onFieldClick={(fid) => {
                setActiveField(fid);
                setJumpTo((j) => ({ fieldId: fid, n: (j?.n ?? 0) + 1 }));
              }}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {phase === "interview" ? (
              <Interview
                plan={plan}
                fields={form.fields}
                answers={answers}
                vaultHits={vaultHits}
                onAnswer={setAnswer}
                onActiveChange={setActiveField}
                onFinish={() => setPhase("review")}
                lang={lang}
                jumpTo={jumpTo}
              />
            ) : (
              <>
                <FieldReview
                  plan={plan}
                  fields={form.fields}
                  answers={answers}
                  onAnswer={setAnswer}
                  onFieldFocus={setActiveField}
                />
                <div className="border-t border-zinc-200 px-5 py-3">
                  <button
                    onClick={fillAndSummarize}
                    className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    ✓ Fill the PDF &amp; finish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>,
    );

  /* -------------------------------- done -------------------------------- */

  return shell(
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-black">Your form is filled.</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {answeredIds.size} of {form.fieldCount} fields completed
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={filledUrl}
          download={filledName}
          className="flex-1 rounded-lg bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          ⬇ Download {filledName}
        </a>
        <button
          onClick={() => {
            const blob = new Blob([summary], { type: "text/markdown" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "submission-summary.md";
            a.click();
          }}
          className="rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          ⬇ Summary (.md)
        </button>
      </div>

      {problems.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <b>Heads up:</b> {problems.length} field(s) need a manual check —
          {problems.slice(0, 4).map((p) => ` ${p.fieldId} (${p.reason})`).join("; ")}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <MarkdownLite text={summary} />
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={reset}
          className="rounded-lg px-5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Fill another form →
        </button>
      </div>
    </main>,
  );
}
