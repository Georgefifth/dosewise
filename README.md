# FormPilot — Paperwork, translated

**Upload any fillable PDF form. FormPilot turns every cryptic field into a plain-language question — in your language — then writes your answers into the real document.**

Built for **InfinityX Global Hackathon 2K26**.

## The problem

Every year, **$140B+** in U.S. benefits go unclaimed. Millions of applications — for food assistance, healthcare, housing, immigration — are abandoned or rejected not because people are ineligible, but because the *form itself* is the barrier: cryptic field names (`gross_mth_inc_amt`), bureaucratic jargon, and instructions written at a college reading level. The burden falls hardest on immigrants, seniors, and the ~1 in 5 adults who struggle with forms.

## What FormPilot does

| Step | What happens |
| --- | --- |
| **Upload** | Drop any fillable PDF (AcroForm) — or pick a bundled sample. |
| **Decode** | Server extracts every real form field with its exact position on the page; the AI layer rewrites each as a plain-language question *in the language you choose*. |
| **Interview** | One friendly question at a time — with the actual field highlighted live on the document. Every field carries a "why is this asked?" explanation. |
| **Fill** | Answers are written into the real PDF (text, checkboxes, radio groups, dropdowns) and downloaded, plus a plain-language summary of what you just submitted. |

### Highlights

- **Field-level grounding** — the widget being asked about lights up on the PDF as you go. Click any field to jump to its question.
- **Multilingual interview** — the form stays in its original language; the conversation happens in yours (EN/ES/ZH/HI/FR/AR, more via the LLM).
- **Answer vault** — semantic answers (name, DOB, address…) are remembered *locally* and pre-fill the next form. Nothing leaves the device.
- **Document checklist** — tells you what to gather (ID, pay stubs, insurance card) before you start.
- **Voice input** — Web Speech API dictation on text fields.
- **Offline-resilient AI** — any OpenAI-compatible endpoint; a deterministic fallback planner keeps the full experience working with zero keys, so the demo never breaks.
- **Accessibility** — large-text mode, keyboard-first flow, one-question-at-a-time cognitive load.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- **pdf-lib** — AcroForm extraction, widget rect mapping, real PDF filling (incl. Unicode font embedding for non-Latin answers)
- **pdfjs-dist** — in-browser document rendering with overlay highlights
- **LLM**: any OpenAI-compatible endpoint (`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`; developed against Featherless `Qwen/Qwen3-32B` with a DeepSeek fallback). Handles cold starts, `capacity_exhausted` retries, `<think>` stripping, and graceful degradation to the offline planner.

## Architecture

```
app/
  page.tsx            # phase orchestrator: landing → interview → review → done
  api/extract/        # POST file|sample → ExtractedForm (fields + widget rects)
  api/plan/           # POST {form, lang} → InterviewPlan (LLM or offline)
  api/fill/           # POST file|sample + answers → filled PDF bytes
  api/summary/        # POST {form, answers, lang} → markdown summary
lib/
  pdf.ts              # AcroForm walk: fields, widget rects→pages, fill w/ font fallback
  llm.ts              # provider layer: retries, model fallback, think-strip, mock
  i18n.ts             # language strings, semantic field dictionary
  samples.ts          # bundled sample loader (fs → http fallback)
  schema.ts           # shared types
components/
  PdfViewer.tsx       # pdfjs canvas + per-widget highlight overlays
  Interview.tsx       # guided Q&A, voice input, vault chips
  FieldReview.tsx     # editable answer table
  MarkdownLite.tsx    # zero-dep markdown renderer
scripts/
  make-samples.ts     # regenerates the 3 bundled AcroForm PDFs
```

## Quickstart

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

No keys needed — the offline planner handles everything. To enable a real LLM:

```bash
cp .env.example .env.local   # fill in LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
```

Regenerate sample PDFs: `pnpm tsx scripts/make-samples.ts`

## Demo script (5 min)

1. **Landing** — pick *Form SB-10 · Benefits Application* (or drop your own PDF).
2. Set language to **中文** or **Español** — watch bureaucratic field names become warm questions.
3. Answer 2–3 questions — note the **field lighting up on the PDF** each time; click "ⓘ why is this asked?" on the SSN field.
4. Click a field **on the document** — the interview jumps to it.
5. **Review** screen → *Fill the PDF & finish* → download opens with every answer inside the real form (accented characters included).
6. Start a second form → your name/address are **already remembered** from the vault.

## Privacy

PDF bytes live only in request scope; nothing is persisted server-side. The answer vault is `localStorage` — on-device only.

## Roadmap

- Flat scans → field detection via vision model (non-AcroForm PDFs)
- Signature pad + drawn-signature embedding
- Multi-form packets (the same answers across an agency's whole packet)
- DOCX/XFA support
