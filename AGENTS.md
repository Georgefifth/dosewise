<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DoseWise — InfinityX Global Hackathon 2K26

**Tagline:** Point your camera at the pill bottles. Get the whole picture — safely.

## The Problem

~1.5 million people are harmed by medication errors every year in the US alone. Seniors on 5+ daily meds, caregivers managing a parent's pillbox, immigrants reading labels in a foreign language — the failure mode is the same: nobody sees *all* the meds at once, so dangerous interactions slip through (e.g. warfarin + ibuprofen → bleeding risk), schedules collide, and "what is this one even for?" goes unanswered.

## The Solution

Photograph your medication labels → a vision model reads each label → DoseWise builds your complete med list → a **deterministic interaction engine** (rule table, not hallucinated) flags dangerous pairs → a visual schedule lays out morning/noon/evening/bedtime with the actual bottle photos → plain-language "what is this for" per med → a printable wallet card + questions to ask your pharmacist. Multilingual explanations for non-native speakers.

**Safety positioning (important):** DoseWise is an *organization aid*, not medical advice. Interactions come from a curated rule table (explainable, auditable); the LLM only reads labels and writes explanations. Every result screen carries a confirm-with-pharmacist disclaimer.

## Judging-criteria map (InfinityX 2K26, deadline Sep 25 2026 @ 11:45pm IST)

- **Innovation:** VL grounding on real labels + deterministic clinical rules hybrid — AI where it's strong (reading messy images), rules where safety demands it.
- **Technical:** OpenAI-compatible VL endpoint, per-image scan pipeline, interaction rule engine, sig-parser → schedule grid.
- **Impact:** medication-error harm stats; senior + caregiver + immigrant audiences.
- **UX:** photo → confirm → results; editable med list (human-verifies-AI step = trust story); printable wallet card.
- **Submission needs:** live demo, ≤5min video, repo + README.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — single deployable.
- `app/api/scan` — POST images (files or sample names) → VL extraction → `ScannedMed[]`
- `app/api/analyze` — POST `{meds, lang}` → interactions + schedule + explanations + pharmacist questions
- `lib/drugs.ts` — generic→class/purpose knowledge table (~30 common meds)
- `lib/interactions.ts` — curated class-pair rule table + duplicate-therapy check
- `lib/schedule.ts` — sig text → time slots (QD/BID/TID/QHS/PRN, food rules, drug-specific timing)
- `lib/llm.ts` — provider layer: vision `chat/completions` w/ image_url, custom UA (Cloudflare), model fallback, cold-start retries, `<think>` strip, `!`-flood filter; deterministic mock when unconfigured
- `lib/schema.ts`, `lib/i18n.ts` (language list + purpose strings), `lib/samples.ts`
- `components/` — `ScanPanel` (upload/camera/thumbs), `MedListEditor`, `InteractionAlerts`, `ScheduleGrid`, `WalletCard`, `MarkdownLite`
- `scripts/make-sample-labels.py` — Pillow-rendered fictional pharmacy labels → `public/samples/*.png` (synthetic = zero PHI, clearly demo data)

## Commands

- `pnpm dev` / `pnpm build` / `pnpm lint`
- `python3 scripts/make-sample-labels.py` — regenerate sample labels

## Provider notes (Featherless)

- `.env.local`: `VL_MODEL=Qwen/Qwen3-VL-30B-A3B-Instruct` (verified working), fallback `Qwen/Qwen2.5-VL-72B-Instruct`; `LLM_MODEL=Qwen/Qwen3-32B`, fallback DeepSeek-R1-Distill-Llama-70B.
- Llama-family = HF-gated → avoid. Qwen3 needs `/no_think` on last user msg. Custom `User-Agent` required (CF 1010). Cold starts → retry+fallback already in `lib/llm.ts`.

## Conventions

- No secrets in client code/commits; `.env.local` gitignored; `.env.example` committed.
- Interactions must NEVER come from the LLM alone — rule table only; LLM may annotate but not originate warnings.
- Offline/demo path must stay feature-complete (mock scan for bundled samples).
- Demo script: load sample pillbox (4 bottles incl. warfarin+ibuprofen pair) → confirm → major interaction alert → schedule grid → wallet card.

## Status / TODO

- [x] MVP verified end-to-end: sample pillbox scan → 4 meds read (high conf) → warfarin×ibuprofen MAJOR + NSAID×ACE moderate detected → schedule + explanations + questions
- [x] Competitive pass vs Medisafe/MyTherapy/Apple Health/Drugs.com: added ingredient-level dup detection (Norco+Tylenol verified), .ics calendar reminders, today-checklist+streak, refill countdowns, caregiver copy, TTS read-aloud, privacy positioning
- [x] lint/build clean, committed
- [x] Deployed: https://georgefifth.github.io/dosewise/ (static export via Actions; BYOK popover for live VL, offline canned path otherwise)
- [x] Playwright e2e: `pnpm tsx scripts/e2e.ts` — 24 checks, runs against dev server AND static build
- [x] Demo video: `demo/demo.mp4` (75s narrated) via ~/tools/demo-recorder, scenes at `~/tools/demo-recorder/scenes/dosewise.js`
- [ ] Devpost submission (needs: video link — upload demo.mp4 to YouTube, screenshots in `demo/`)
- Stretch: barcode/NDC scan (openFDA), med image thumbnails on wallet card
