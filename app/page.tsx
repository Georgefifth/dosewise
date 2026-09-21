"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ScanPanel, { ScanImage } from "@/components/ScanPanel";
import MedListEditor from "@/components/MedListEditor";
import InteractionAlerts from "@/components/InteractionAlerts";
import ScheduleGrid from "@/components/ScheduleGrid";
import WalletCard from "@/components/WalletCard";
import TodayChecklist from "@/components/TodayChecklist";
import { LANGS } from "@/lib/i18n";
import { downloadIcs } from "@/lib/ics";
import { speak, stopSpeaking } from "@/lib/speech";
import { clearMeds, loadMeds, saveMeds } from "@/lib/store";
import {
  analyzeBrowser,
  getByok,
  saveByok,
  scanImageBrowser,
  type ByokConfig,
} from "@/lib/client-ai";
import type { Analysis, MedInput, ScannedMed } from "@/lib/schema";
import { SAMPLE_LABELS, SAMPLES } from "@/lib/samples";

/* static (GitHub Pages) builds have no /api/* — run scan+analysis in-browser */
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

type Phase = "landing" | "scanning" | "confirm" | "analyzing" | "results";

const DISCLAIMER =
  "DoseWise organizes your medications — it is not medical advice. Always confirm interactions, doses, and schedules with your pharmacist or prescriber.";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState("en");
  const [images, setImages] = useState<ScanImage[]>([]);
  const [meds, setMeds] = useState<ScannedMed[]>([]);
  const [scanSource, setScanSource] = useState<"ai" | "offline">("offline");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [copied, setCopied] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showByok, setShowByok] = useState(false);
  const [savedList, setSavedList] = useState<MedInput[]>([]);

  // re-read the saved list whenever we return to landing (post-mount → no
  // hydration mismatch)
  useEffect(() => {
    if (phase === "landing") setSavedList(loadMeds());
  }, [phase]);

  const previews = useMemo(() => images.map((i) => i.url), [images]);

  const addImages = useCallback(
    (imgs: ScanImage[]) => setImages((cur) => [...cur, ...imgs].slice(0, 12)),
    [],
  );

  const removeImage = useCallback((i: number) => {
    setImages((cur) => {
      URL.revokeObjectURL(cur[i].url);
      return cur.filter((_, k) => k !== i);
    });
  }, []);

  /* --------------------------------- scan --------------------------------- */

  const scan = useCallback(async (imgs?: ScanImage[]) => {
    const list = imgs ?? images;
    if (!list.length) return;
    setError(null);
    setPhase("scanning");
    try {
      if (IS_STATIC) {
        const out = await Promise.all(
          list.map((img, i) => scanImageBrowser(img.sample, img.file, `m${i}`, i)),
        );
        setScanSource(getByok() ? "ai" : "offline");
        setMeds(out);
        if (imgs) setImages(imgs);
        setPhase("confirm");
        return;
      }
      const fd = new FormData();
      for (const img of list) {
        if (img.file) fd.append("images", img.file);
        else if (img.sample) fd.append("sample", img.sample);
      }
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "scan failed");
      setScanSource(j.source ?? "offline");
      setMeds(j.meds as ScannedMed[]);
      if (imgs) setImages(imgs);
      setPhase("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setPhase("landing");
    }
  }, [images]);

  const loadSamplePillbox = useCallback(() => {
    const imgs: ScanImage[] = SAMPLES.map((s) => ({
      url: `samples/${s}.png`,
      sample: s,
    }));
    setImages(imgs);
    scan(imgs);
  }, [scan]);

  const resumeSaved = useCallback(() => {
    const medList = loadMeds();
    setMeds(
      medList.map((m) => ({
        ...m,
        confidence: "high" as const,
      })),
    );
    setImages([]);
    setPhase("confirm");
  }, []);

  /* -------------------------------- analyze ------------------------------- */

  const analyze = useCallback(async () => {
    setError(null);
    setPhase("analyzing");
    setStage("Checking interactions and building your schedule…");
    try {
      const inputs: MedInput[] = meds
        .filter((m) => m.generic.trim())
        .map((m) => ({
          id: m.id,
          generic: m.generic,
          strength: m.strength,
          sig: m.sig,
          quantity: m.quantity,
          image: m.image,
          confidence: m.confidence,
        }));
      saveMeds(inputs);
      if (IS_STATIC) {
        setAnalysis(await analyzeBrowser(inputs, lang));
      } else {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meds: inputs, lang }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "analysis failed");
        setAnalysis(j as Analysis);
      }
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("confirm");
    }
  }, [meds, lang]);

  const reset = () => {
    images.forEach((i) => i.file && URL.revokeObjectURL(i.url));
    setImages([]);
    setMeds([]);
    setAnalysis(null);
    setError(null);
    setPhase("landing");
  };

  const patchMed = (id: string, patch: Partial<ScannedMed>) =>
    setMeds((cur) => cur.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  /* --------------------------------- chrome -------------------------------- */

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col bg-[#f4f7f6] text-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <button onClick={reset} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-sm text-white">
            ✚
          </span>
          <span className="text-base font-bold tracking-tight">DoseWise</span>
          <span className="hidden text-xs text-zinc-400 sm:inline">
            see all your meds, safely
          </span>
        </button>
        <div className="flex items-center gap-3">
          {phase !== "landing" && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                (analysis?.source ?? scanSource) === "ai"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {(analysis?.source ?? scanSource) === "ai" ? "◆ AI online" : "◆ demo mode"}
            </span>
          )}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title="explanation language"
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
    </div>
  );

  const spinner = (text: string) =>
    shell(
      <main className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="text-sm font-medium text-zinc-600">{text}</p>
        </div>
      </main>,
    );

  /* -------------------------------- landing -------------------------------- */

  if (phase === "landing")
    return shell(
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 py-14">
        <div className="mb-3 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
          InfinityX Global Hackathon 2K26
        </div>
        <h1 className="mb-4 max-w-2xl text-center text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          Nobody sees all your meds at once. Until now.
        </h1>
        <p className="mb-8 max-w-xl text-center text-lg leading-relaxed text-zinc-600">
          Photograph your pill bottles. DoseWise reads every label, checks the
          combinations against an interaction rule table, and builds a visual
          schedule you can actually follow.
        </p>

        <div className="mb-10 grid w-full max-w-2xl grid-cols-3 gap-3 text-center">
          {[
            ["1.5M", "harmed by med errors yearly (US)"],
            ["5+", "daily meds = interaction territory"],
            ["40%", "of seniors take 5+ meds daily"],
          ].map(([n, d]) => (
            <div key={d} className="rounded-xl border border-zinc-200 bg-white px-3 py-4">
              <div className="text-xl font-black text-teal-600">{n}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{d}</div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-2xl">
          <ScanPanel images={images} onAdd={addImages} onRemove={removeImage} />
          {images.length > 0 && (
            <button
              onClick={() => scan()}
              className="mt-4 w-full rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Read {images.length} label{images.length > 1 ? "s" : ""} →
            </button>
          )}
        </div>

        <div className="mb-3 mt-10 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span className="h-px w-10 bg-zinc-300" />
          or try the sample pillbox
          <span className="h-px w-10 bg-zinc-300" />
        </div>
        <p className="mb-3 max-w-md text-center text-xs text-zinc-500">
          Maria&apos;s four prescriptions — including a pair that shouldn&apos;t be
          together. (Fictional labels, generated for the demo.)
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              onClick={() => {
                const img = { url: `samples/${s}.png`, sample: s };
                setImages((c) => [...c, img]);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-teal-400"
              title={SAMPLE_LABELS[s].desc}
            >
              + {SAMPLE_LABELS[s].name}
            </button>
          ))}
          <button
            onClick={loadSamplePillbox}
            className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
          >
            ⚡ Scan all 4 at once
          </button>
        </div>

        {IS_STATIC && (
          <div className="mt-8 w-full max-w-md">
            <button
              onClick={() => setShowByok((s) => !s)}
              className="mx-auto block text-xs font-medium text-zinc-400 hover:text-teal-600"
            >
              ⚙ {getByok() ? "✓ live AI key set" : "demo mode — add an API key for live label reading"}
            </button>
            {showByok && (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 text-left">
                <p className="mb-2 text-xs text-zinc-500">
                  This is a static demo — there is no server. Paste any
                  OpenAI-compatible key to enable real label reading. Stored only
                  in your browser, never sent anywhere except the endpoint below.
                </p>
                {(
                  [
                    ["baseUrl", "Base URL", "https://api.featherless.ai/v1"],
                    ["apiKey", "API key", "your-key-here"],
                    ["vlModel", "Vision model", "Qwen/Qwen3-VL-30B-A3B-Instruct"],
                    ["textModel", "Text model", "Qwen/Qwen3-32B"],
                  ] as [keyof ByokConfig, string, string][]
                ).map(([k, label, ph]) => (
                  <label key={k} className="mb-2 block">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
                    <input
                      id={`byok-${k}`}
                      defaultValue={getByok()?.[k] ?? ""}
                      placeholder={ph}
                      type={k === "apiKey" ? "password" : "text"}
                      className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-teal-500"
                    />
                  </label>
                ))}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      const v = (k: string) =>
                        (document.getElementById(`byok-${k}`) as HTMLInputElement).value.trim();
                      const cfg: ByokConfig = {
                        baseUrl: v("baseUrl") || "https://api.featherless.ai/v1",
                        apiKey: v("apiKey"),
                        vlModel: v("vlModel") || "Qwen/Qwen3-VL-30B-A3B-Instruct",
                        textModel: v("textModel") || "Qwen/Qwen3-32B",
                      };
                      saveByok(cfg.apiKey ? cfg : null);
                      setShowByok(false);
                    }}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    Save key
                  </button>
                  <button
                    onClick={() => {
                      saveByok(null);
                      setShowByok(false);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {savedList.length > 0 && (
          <button
            onClick={resumeSaved}
            className="mt-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-medium text-teal-700 hover:bg-teal-100"
          >
            Continue with your saved list ({savedList.length} med{savedList.length > 1 ? "s" : ""})
          </button>
        )}

        {error && (
          <p className="mt-6 max-w-xl rounded-lg bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
            {error}
          </p>
        )}

        <footer className="mt-14 max-w-xl text-center text-xs leading-relaxed text-zinc-400">
          {DISCLAIMER}
        </footer>
      </main>,
    );

  if (phase === "scanning") return spinner("Reading your labels…");
  if (phase === "analyzing") return spinner(stage);

  /* -------------------------------- confirm -------------------------------- */

  if (phase === "confirm")
    return shell(
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="text-xl font-black">Check the camera&apos;s work</h1>
        <p className="mb-1 mt-1 text-sm text-zinc-500">
          We found <b>{meds.filter((m) => m.generic.trim()).length}</b> medication
          {meds.length !== 1 ? "s" : ""}. Fix anything that&apos;s wrong — the safety
          check is only as good as this list.
        </p>
        {scanSource === "offline" && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Demo mode — no LLM key configured, so scans are canned. Everything
            below is still fully editable.
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
        )}
        <MedListEditor
          meds={meds}
          previews={previews}
          onChange={patchMed}
          onRemove={(id) => setMeds((c) => c.filter((m) => m.id !== id))}
          onAdd={() =>
            setMeds((c) => [
              ...c,
              { id: `m${Date.now()}`, generic: "", confidence: "low" },
            ])
          }
        />
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => setPhase("landing")}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            ← add more photos
          </button>
          <button
            onClick={analyze}
            disabled={!meds.some((m) => m.generic.trim())}
            className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-40"
          >
            Analyze my medications →
          </button>
        </div>
      </main>,
    );

  /* -------------------------------- results -------------------------------- */

  if (phase === "results" && analysis) {
    const inputs: MedInput[] = meds
      .filter((m) => m.generic.trim())
      .map((m) => ({ id: m.id, generic: m.generic, strength: m.strength, sig: m.sig, quantity: m.quantity, image: m.image }));
    const explainFor = (id: string) => analysis.explanations.find((e) => e.medId === id);
    const refillFor = (id: string) => analysis.refills.find((r) => r.medId === id);

    const copyForCaregiver = () => {
      const lines = [
        "MY MEDICATION LIST (from DoseWise)",
        "",
        ...inputs.map((m) => {
          const sched = analysis.schedule.find((s) => s.medId === m.id);
          const when = sched?.slots.map((s) => s.replace("_", " ")).join(", ") ?? "";
          return `• ${m.generic}${m.strength ? ` ${m.strength}` : ""} — ${when}${m.sig ? ` (${m.sig})` : ""}`;
        }),
        "",
        ...(analysis.interactions.length
          ? [
              "INTERACTION WARNINGS:",
              ...analysis.interactions.map(
                (i) => `• [${i.severity.toUpperCase()}] ${i.a} × ${i.b}: ${i.title}. ${i.advice}`,
              ),
            ]
          : ["No known interactions in this list."]),
        "",
        DISCLAIMER,
      ];
      navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return shell(
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Your medication picture</h1>
            <p className="text-xs text-zinc-500">
              {inputs.length} medication{inputs.length !== 1 ? "s" : ""} ·{" "}
              {analysis.interactions.length} interaction
              {analysis.interactions.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <button
            onClick={() => setPhase("confirm")}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            ← edit list
          </button>
        </div>

        {/* action row — reminders, sharing, print. No accounts, no servers. */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => downloadIcs(inputs, analysis.schedule)}
            className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
            title="daily dose reminders — imports into Google/Apple/Outlook"
          >
            📅 Add reminders to calendar
          </button>
          <button
            onClick={copyForCaregiver}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
            title="copies a plain-text list — paste into WhatsApp/SMS to family"
          >
            {copied ? "✓ copied!" : "📤 Copy for family/caregiver"}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            🖨 Print wallet card
          </button>
          <span className="ml-auto self-center text-[11px] text-zinc-400">
            🔒 no account · no server storage · works offline
          </span>
        </div>

        <div className="flex flex-col gap-10">
          <InteractionAlerts interactions={analysis.interactions} />

          <TodayChecklist meds={inputs} schedule={analysis.schedule} />

          <section>
            <h2 className="mb-3 text-lg font-bold text-zinc-900">💊 What each one is for</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {inputs.map((m) => {
                const ex = explainFor(m.id);
                const refill = refillFor(m.id);
                const speaking = speakingId === m.id;
                return (
                  <div key={m.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-teal-800">{m.generic}</span>
                      {m.strength && (
                        <span className="text-xs text-zinc-500">{m.strength}</span>
                      )}
                      <button
                        onClick={() => {
                          if (speaking) {
                            stopSpeaking();
                            setSpeakingId(null);
                          } else if (ex?.purpose && speak(`${m.generic}. ${ex.purpose}`, lang, () => setSpeakingId(null))) {
                            setSpeakingId(m.id);
                          }
                        }}
                        title="read aloud"
                        className={`ml-auto rounded-full px-2 py-0.5 text-xs transition ${
                          speaking ? "animate-pulse bg-teal-100" : "text-zinc-400 hover:bg-zinc-100"
                        }`}
                      >
                        🔊
                      </button>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-700">{ex?.purpose ?? "—"}</p>
                    {ex?.tips && (
                      <p className="mt-2 text-xs text-amber-700">💡 {ex.tips}</p>
                    )}
                    {refill?.refillBy && (
                      <p
                        className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          refill.daysSupply! <= 7
                            ? "bg-rose-50 text-rose-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        📦 ~{refill.daysSupply} days left — refill by {refill.refillBy}
                      </p>
                    )}
                    {refill?.note && (
                      <p className="mt-2 text-[11px] text-zinc-400">📦 {refill.note}</p>
                    )}
                    {m.sig && (
                      <p className="mt-2 border-t border-zinc-100 pt-2 text-[11px] italic text-zinc-400">
                        label: “{m.sig}”
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <ScheduleGrid meds={inputs} schedule={analysis.schedule} previews={previews} />

          <section>
            <h2 className="mb-3 text-lg font-bold text-zinc-900">❓ Ask your pharmacist</h2>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <ul className="flex flex-col gap-2">
                {analysis.pharmacistQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-700">
                    <span className="text-teal-600">→</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-zinc-900">🪪 Wallet card</h2>
            <WalletCard meds={inputs} schedule={analysis.schedule} />
          </section>

          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-xs leading-relaxed text-zinc-500">
            {DISCLAIMER}
          </p>

          <div className="text-center">
            <button
              onClick={reset}
              className="rounded-lg px-5 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              Scan a different pillbox →
            </button>
            <button
              onClick={() => {
                clearMeds();
                reset();
              }}
              className="ml-2 rounded-lg px-5 py-2 text-xs text-zinc-400 hover:bg-zinc-100"
            >
              clear saved list
            </button>
          </div>
        </div>
      </main>,
    );
  }

  return shell(<main className="flex-1" />);
}
