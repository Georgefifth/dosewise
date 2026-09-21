# DoseWise — see all your meds, safely

**Photograph your pill bottles. DoseWise reads every label, checks the combinations against an interaction rule table, and builds a visual schedule you can actually follow.**

Built for **InfinityX Global Hackathon 2K26**.

## The problem

- **~1.5M** people are harmed by medication errors every year in the US alone
- **~40%** of seniors take **5+** medications daily
- The classic failure: nobody sees *all* the meds at once — so a blood thinner plus an innocent OTC painkiller slips through, schedules collide, and "what is this one even for?" goes unanswered

## What it does

```
📷 photo labels → 👁 vision model reads them → ✅ you confirm the list
        → ⚠️ interaction alerts (rule-table, not hallucinated)
        → 🕐 daily schedule grid with the actual bottle photos
        → 💊 plain-language "what is this for" per med (6+ languages)
        → 🪪 printable wallet card + questions to ask your pharmacist
```

### Why the hybrid architecture matters

The LLM is used where it's strong — **reading messy label photos** and **writing plain-language explanations**. The safety layer is **deterministic**: drug-class interaction rules (`lib/interactions.ts`) and sig parsing (`lib/schedule.ts`) are auditable code, never hallucinated. If a warning appears, a human can point at the exact rule that produced it.

The **confirm screen is a feature**: the user verifies what the camera read before anything is analyzed — human-in-the-loop by design.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind v4
- **Vision LLM**: OpenAI-compatible `chat/completions` with `image_url` (developed on Featherless `Qwen/Qwen3-VL-30B-A3B-Instruct`, fallback `Qwen2.5-VL-72B`)
- **Text LLM**: `Qwen/Qwen3-32B` for explanations + pharmacist questions (fallback DeepSeek-R1-70B)
- **Provider resilience**: custom UA (Cloudflare), cold-start retries, model fallback chain, `<think>` stripping, `!`-flood filtering — and a fully working offline path with canned scans when no key is set
- **Deterministic core**: ~40-drug knowledge table (`lib/drugs.ts`), 20-rule interaction engine, sig→schedule parser
- **Sample labels**: Pillow-rendered fictional pharmacy labels (`scripts/make-sample-labels.py`) — zero PHI, obviously demo data

## Quickstart

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Works with **no keys** (demo mode: canned scans + full rule engine). For live vision:

```bash
cp .env.example .env.local   # set LLM_BASE_URL / LLM_API_KEY / VL_MODEL / LLM_MODEL
```

Regenerate labels: `python3 scripts/make-sample-labels.py`

## Demo script

1. Landing → **⚡ Scan all 4 at once** (sample pillbox: warfarin, ibuprofen, lisinopril, simvastatin)
2. Confirm screen — watch the VL-extracted fields; edit a strength to show human-in-the-loop
3. **Analyze** → 🔴 MAJOR alert: warfarin × ibuprofen (bleeding risk) + moderate NSAID × ACE note
4. Schedule grid — warfarin lands in evening, simvastatin at bedtime, ibuprofen PRN; grapefruit warning on simvastatin
5. Plain-language purposes (switch the language picker → re-analyze for Spanish/Chinese)
6. **Print the wallet card** → PDF for Grandma's purse

## Safety & privacy

Not medical advice — every screen says so. Images live only in request scope; the saved med list is `localStorage`. Interaction warnings come only from the curated rule table.

## Roadmap

- Barcode/NDC scanning for exact identification
- Caregiver sharing (read-only link / QR)
- Refill & interaction-aware reminders
- Larger validated rule set (e.g. openFDA/FDB data)
