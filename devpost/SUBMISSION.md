# Devpost submission copy — DoseWise

## Project name

**DoseWise**

## Elevator pitch

> Photograph your pill bottles — DoseWise reads every label, flags dangerous interactions, and builds a schedule you can actually follow.

## Thumbnail

`devpost/thumbnail.png` (1200×800)

## Try it out links

- Live demo: https://georgefifth.github.io/dosewise/
- Source code: https://github.com/Georgefifth/dosewise
- Demo video: `demo/demo.mp4` (upload to YouTube unlisted for the video field)

## Built with

`next.js` `typescript` `tailwindcss` `react` `qwen` `vision-language-model` `playwright` `github-pages` `python` `pillow`

## Image gallery

`devpost/g1-landing.png`, `g2-confirm.png`, `g3-results.png`, `g4-alerts.png`, `g5-labels.png` — all 3:2.

## About the project

### Inspiration

One and a half million people are harmed by medication errors every year in the US alone, and roughly 40% of seniors take five or more medications daily. The classic failure mode isn't exotic — nobody ever sees *all* the meds at once, so a blood thinner plus an innocent over-the-counter painkiller slips through.

We looked at the incumbents and found the space wide open: Medisafe — the market leader — capped its free tier at two medications this year and was caught sharing users' health data with pharma advertisers. MyTherapy has reminders but no interaction checking. Apple Health can scan a label, but it's iOS-only and its interaction warnings are US-only. Drugs.com's checker is comprehensive but demands you type everything in, in jargon. And CareZone — which pioneered photo-scanning pill bottles — was acquired by Walmart and shut down, taking the best idea in the category with it.

So we rebuilt photo-first medication safety: zero typing, zero accounts, zero data leaving the device.

### What it does

1. **Photograph or upload your medication labels** — bottles, boxes, blister packs.
2. A **vision-language model reads every label** — drug name, strength, directions, quantity — and shows you its work so you can fix anything it got wrong.
3. A **deterministic interaction engine** — a curated, auditable rule table, never the LLM — flags dangerous combinations in plain language: warfarin × ibuprofen (bleeding risk), ACE inhibitors × potassium (dangerous potassium buildup), opioids × sedatives (respiratory depression), and **hidden ingredient double-doses** — Norco or Tylenol PM quietly contain acetaminophen, and stacking them with plain Tylenol is a leading cause of acute liver failure.
4. A **visual schedule** lays out morning / noon / evening / bedtime / as-needed with the actual bottle photos, food flags, and drug-specific timing (statins at bedtime, thyroid meds on an empty stomach).
5. **Make it stick**: a today's-doses checklist with streaks, one-click .ics calendar export, refill countdowns, a printable wallet card, and a plain-text summary to send to family or a caregiver.
6. **Multilingual plain-language explanations** ("what is this one even for?") in six languages, with read-aloud for low-vision users.

DoseWise is an organization aid, not medical advice — every screen says so, and every warning carries a confirm-with-your-pharmacist path.

### How we built it

- **Next.js 16 + TypeScript + Tailwind v4** — single codebase, deployed two ways.
- **Vision reading**: label photos go to `Qwen3-VL` through an OpenAI-compatible endpoint (`image_url` payloads), returning strict JSON per label, all images in parallel.
- **Deterministic safety core**: a ~40-drug knowledge table (classes, brand-name aliases, combination-product ingredients) feeds a curated class-pair interaction rule table plus an ingredient-level duplication pass. Safety warnings are auditable code — the LLM can never originate one.
- **Sig parser**: free-text directions ("every 6 hours as needed", "at bedtime") map to schedule slots with drug-specific timing overrides; label quantity ÷ daily frequency yields refill countdowns.
- **Provider resilience**: custom user-agent (the endpoint fronts Cloudflare), cold-start retries, model fallback chains, `<think>`-block stripping, `!`-flood filtering — and when no key exists at all, a fully working offline path with canned scans.
- **Two deployment modes**: server API routes in development, and a static export for GitHub Pages where the entire engine runs in the browser — plus a BYOK settings panel that calls the model endpoint directly (it's CORS-open) for judges who want to try live reading with their own key.
- **Everything else is free-tier friendly**: synthetic pharmacy labels rendered with Pillow (zero PHI), an `.ics` generator for calendar reminders, Web Speech API for read-aloud, localStorage for the med list and adherence streaks, and a Playwright suite (`scripts/e2e.ts`, 24 checks) that drives the real browser end-to-end against both builds.
- The narrated demo video was produced with a local headless pipeline: Playwright capture → edge-tts voiceover → ffmpeg assembly.

### Challenges we ran into

- **Vision models are nondeterministic.** The same label occasionally came back with an empty drug name on one run and perfect on the next. We added a nudge-retry in the scan path — and leaned into the design: the confirm screen always shows low-confidence reads for a human to fix. The human-in-the-loop step turned out to be the trust story, not a workaround.
- **Cold starts.** Free-tier GPU endpoints sleep; first calls took 75s. Retries plus model fallbacks plus a canned-offline path keep the demo alive even when upstream isn't.
- **Static hosting constraint.** GitHub Pages runs no server code, so the whole pipeline had to run client-side — which accidentally gave us our best feature: a deployment where no health data ever touches a server.
- **Hidden ingredients.** Name-matching misses the real killer — combination products. Modeling `contains` (Percocet → oxycodone + acetaminophen) caught a major double-dose in our test pillbox that class-level rules alone would have missed.

### Accomplishments that we're proud of

- **Ingredient-level interaction detection** that catches what name-match checkers miss — Norco + Tylenol = a quiet 4g acetaminophen overdose risk.
- **The hybrid architecture itself**: AI reads messy pixels, deterministic code makes safety claims. Every warning traces to an auditable rule.
- **Genuinely zero-friction**: no account, no install, no server — the live demo works offline-mode out of the box, and the whole flow was verified with 24 automated browser checks.
- **It respects people**: free for unlimited meds, no ads, nothing to harvest — the opposite of the market leader's playbook.

### What we learned

- In safety-critical products, "the model said so" is not an answer — a rule table that a pharmacist could audit beats a bigger model.
- Human-in-the-loop UI isn't a patch for AI fallibility; done well, it *is* the product.
- The best features came from constraints: no budget → BYOK + offline mode → a stronger privacy story than every incumbent.

### What's next for DoseWise

- **Barcode/NDC lookup** via openFDA for exact identification when labels are worn
- **Caregiver links** — read-only med-list sharing without accounts
- **Pill identification** for loose/unlabeled pills (imprint + shape + color)
- **Validated rule coverage** — scale the interaction table against RxNorm/openFDA label data, with pharmacist review
- **PWA install** for proper background dose reminders
