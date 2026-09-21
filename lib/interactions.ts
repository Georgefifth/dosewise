import { resolveDrug } from "./drugs";
import type { Interaction, MedInput, Severity } from "./schema";

/* Curated interaction rule table. Deliberately deterministic — these warnings
   come from auditable rules, never from the LLM. `a`/`b` are class names or
   `drug:<generic>` for a specific drug. */

interface Rule {
  a: string;
  b: string;
  severity: Severity;
  title: string;
  mechanism: string;
  advice: string;
}

const RULES: Rule[] = [
  {
    a: "anticoagulant", b: "nsaid", severity: "major",
    title: "Bleeding risk",
    mechanism: "Blood thinners slow clotting; NSAIDs also thin the blood and irritate the stomach lining. Together they sharply raise the risk of serious stomach or internal bleeding.",
    advice: "Do not combine without the prescriber's explicit OK. Ask about acetaminophen for pain instead.",
  },
  {
    a: "anticoagulant", b: "antiplatelet", severity: "major",
    title: "Bleeding risk",
    mechanism: "Two clot-blocking effects stack — bleeding risk roughly doubles, including bleeding in the brain.",
    advice: "Only take both if the prescriber intentionally combined them (e.g. after a stent). Confirm it was deliberate.",
  },
  {
    a: "antiplatelet", b: "nsaid", severity: "moderate",
    title: "Stomach bleeding risk",
    mechanism: "Both irritate the stomach and thin the blood; together they raise the chance of an ulcer bleeding.",
    advice: "Ask about acetaminophen, or whether a stomach-protecting PPI should be added.",
  },
  {
    a: "ssri", b: "nsaid", severity: "moderate",
    title: "Stomach bleeding risk",
    mechanism: "SSRIs reduce platelet clotting ability; adding an NSAID multiplies stomach-bleed risk — worse again if a blood thinner is also present.",
    advice: "Use the lowest NSAID dose, shortest time — or ask about acetaminophen.",
  },
  {
    a: "ace", b: "potassium", severity: "major",
    title: "Potassium can climb too high",
    mechanism: "ACE inhibitors already raise potassium; adding a supplement can push it to heart-rhythm-dangerous levels.",
    advice: "Don't combine unless the prescriber is monitoring potassium levels.",
  },
  {
    a: "arb", b: "potassium", severity: "major",
    title: "Potassium can climb too high",
    mechanism: "ARBs raise potassium; a supplement on top risks dangerous hyperkalemia.",
    advice: "Don't combine unless the prescriber is monitoring potassium levels.",
  },
  {
    a: "ace", b: "potassium-sparing", severity: "major",
    title: "Potassium can climb too high",
    mechanism: "Both raise potassium — together they can push it to dangerous levels.",
    advice: "Needs prescriber supervision and lab monitoring.",
  },
  {
    a: "ace", b: "nsaid", severity: "moderate",
    title: "Kidneys + weaker blood-pressure control",
    mechanism: "NSAIDs can blunt the blood-pressure effect and strain kidneys — risk is highest in older adults and anyone dehydrated.",
    advice: "Occasional use is usually fine; daily use should be cleared with the prescriber.",
  },
  {
    a: "arb", b: "nsaid", severity: "moderate",
    title: "Kidneys + weaker blood-pressure control",
    mechanism: "NSAIDs can blunt the ARB's effect and strain the kidneys.",
    advice: "Occasional use is usually fine; daily use should be cleared with the prescriber.",
  },
  {
    a: "drug:simvastatin", b: "macrolide", severity: "major",
    title: "Muscle damage risk (rhabdomyolysis)",
    mechanism: "Macrolide antibiotics block the enzyme that clears simvastatin — levels spike and can break down muscle tissue, injuring the kidneys.",
    advice: "The statin is usually paused for the antibiotic course. Confirm with the prescriber before taking both.",
  },
  {
    a: "drug:atorvastatin", b: "macrolide", severity: "moderate",
    title: "Statin levels can rise",
    mechanism: "Macrolides slow statin breakdown, raising the chance of muscle pain and damage.",
    advice: "Tell the prescriber you're on a statin — they may pause it or pick another antibiotic.",
  },
  {
    a: "ssri", b: "drug:tramadol", severity: "major",
    title: "Serotonin syndrome + seizures",
    mechanism: "Tramadol adds serotonin on top of the SSRI. Too much serotonin causes agitation, sweating, tremor — and in severe cases seizures.",
    advice: "Flag this pair to the prescriber; alternative pain control is usually preferred.",
  },
  {
    a: "ssri", b: "serotonergic", severity: "major",
    title: "Serotonin syndrome",
    mechanism: "Two serotonergic drugs together can push serotonin too high — agitation, fast heartbeat, sweating, tremor.",
    advice: "Confirm this combination is intentional and know the warning signs.",
  },
  {
    a: "opioid", b: "benzodiazepine", severity: "major",
    title: "Dangerous breathing suppression",
    mechanism: "Opioids and benzodiazepines both slow breathing. Together they can stop it — this pair carries an FDA boxed warning.",
    advice: "This combination is avoided whenever possible. If both are prescribed, use the lowest doses and make sure someone at home knows.",
  },
  {
    a: "opioid", b: "sedative", severity: "major",
    title: "Dangerous sedation",
    mechanism: "Sleeping pills and sedating antihistamines stack with opioids' breathing suppression.",
    advice: "Avoid combining; if both are prescribed, ask the prescriber to confirm.",
  },
  {
    a: "benzodiazepine", b: "sedative", severity: "moderate",
    title: "Oversedation & falls",
    mechanism: "Two sedatives together cause heavy drowsiness, confusion, and falls — a leading cause of hip fractures in seniors.",
    advice: "Ask whether the sleep aid is still needed alongside the benzodiazepine.",
  },
  {
    a: "pde5", b: "nitrate", severity: "major",
    title: "Blood pressure can crash",
    mechanism: "Both dilate blood vessels. Together they can drop blood pressure to dangerous, even fatal, levels.",
    advice: "This pair must never be combined. If on a nitrate, PDE5 inhibitors are off the table.",
  },
  {
    a: "qt", b: "qt", severity: "moderate",
    title: "Heart-rhythm risk (QT prolongation)",
    mechanism: "Each of these can stretch the heart's electrical cycle; stacking them raises the chance of a dangerous rhythm.",
    advice: "Mention both meds to the prescriber — they may want an ECG or an alternative.",
  },
  {
    a: "antidiabetic", b: "corticosteroid", severity: "moderate",
    title: "Blood sugar spikes",
    mechanism: "Steroids push blood sugar up, working directly against diabetes medicines.",
    advice: "Expect higher readings while on the steroid; the diabetes dose may need temporary adjusting.",
  },
  {
    a: "beta-blocker", b: "opioid", severity: "minor",
    title: "Additive blood-pressure drop",
    mechanism: "Both can lower blood pressure and heart rate — dizziness on standing is the usual result.",
    advice: "Stand up slowly; report dizziness or fainting.",
  },
  {
    a: "diuretic", b: "nsaid", severity: "moderate",
    title: "Kidney strain + weaker diuretic",
    mechanism: "NSAIDs reduce kidney blood flow, blunting water pills — the 'triple whammy' with an ACE/ARB is a known kidney-injury pattern.",
    advice: "Stay hydrated; daily NSAID use should be cleared with the prescriber.",
  },
];

/* classes that shouldn't appear twice in one list */
const DUPLICATE_WATCH = new Set([
  "nsaid", "ssri", "ace", "arb", "statin", "opioid", "benzodiazepine",
  "anticoagulant", "sedative", "loop-diuretic",
]);

function matches(ruleSide: string, classes: Set<string>, generic: string): boolean {
  if (ruleSide.startsWith("drug:")) return generic === ruleSide.slice(5);
  return classes.has(ruleSide);
}

export function checkInteractions(meds: MedInput[]): Interaction[] {
  const resolved = meds.map((m) => {
    const info = resolveDrug(m.generic);
    return {
      med: m,
      info,
      classes: new Set(info?.classes ?? []),
      generic: info?.generic ?? m.generic.trim().toLowerCase(),
    };
  });

  const out: Interaction[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const A = resolved[i];
      const B = resolved[j];
      const pairKey = [A.med.id, B.med.id].sort().join("|");

      for (const rule of RULES) {
        const hit =
          (matches(rule.a, A.classes, A.generic) && matches(rule.b, B.classes, B.generic)) ||
          (matches(rule.a, B.classes, B.generic) && matches(rule.b, A.classes, A.generic));
        if (hit && !seenPairs.has(pairKey + rule.title)) {
          seenPairs.add(pairKey + rule.title);
          out.push({ severity: rule.severity, a: A.generic, b: B.generic, title: rule.title, mechanism: rule.mechanism, advice: rule.advice });
        }
      }

      // ingredient-level duplication — hidden double-doses like
      // Norco (hydrocodone+acetaminophen) taken alongside plain Tylenol
      const ingA = new Set(A.info?.contains ?? [A.generic]);
      const ingB = new Set(B.info?.contains ?? [B.generic]);
      for (const ing of ingA) {
        if (!ingB.has(ing)) continue;
        const k = pairKey + "ing:" + ing;
        if (seenPairs.has(k)) continue;
        seenPairs.add(k);
        const identical = ing === A.generic && ing === B.generic;
        const danger: Record<string, { severity: Severity; mechanism: string; advice: string }> = {
          acetaminophen: {
            severity: "major",
            mechanism:
              "Both products contain acetaminophen (Tylenol). Taking them together can quietly push the daily dose past the 4 g limit — the leading cause of acute liver failure in the US.",
            advice: "Do not take both. Check every label for 'acetaminophen' or 'APAP' before adding a pain reliever.",
          },
          aspirin: {
            severity: "major",
            mechanism: "Both products contain aspirin — doubling up raises bleeding and ulcer risk.",
            advice: "Pick one source of aspirin; confirm with the prescriber.",
          },
          ibuprofen: {
            severity: "major",
            mechanism: "Both products contain ibuprofen — doubling up raises bleeding, ulcer, and kidney risk.",
            advice: "Pick one source of ibuprofen.",
          },
        };
        const d = danger[ing] ?? {
          severity: "moderate" as Severity,
          mechanism: identical
            ? "The same medication appears twice on the list."
            : `Both products contain ${ing} — the same ingredient twice usually adds side effects, not benefit.`,
          advice: "Confirm with the prescriber that both are intentional.",
        };
        out.push({
          severity: d.severity,
          a: A.generic, b: B.generic,
          title: identical
            ? "Same medication listed twice"
            : `Hidden double dose: both contain ${ing}`,
          mechanism: d.mechanism,
          advice: d.advice,
        });
      }

      // duplicate therapy
      for (const cls of A.classes) {
        if (DUPLICATE_WATCH.has(cls) && B.classes.has(cls) && A.generic !== B.generic) {
          const k = pairKey + "dup:" + cls;
          if (!seenPairs.has(k)) {
            seenPairs.add(k);
            out.push({
              severity: "moderate",
              a: A.generic, b: B.generic,
              title: `Duplicate ${cls.replace(/-/g, " ")} therapy`,
              mechanism: `Both are ${cls.replace(/-/g, " ")} medicines — two drugs from the same family usually add side effects, not benefit.`,
              advice: "Confirm with the prescriber that both are intentional.",
            });
          }
        }
      }
    }
  }

  const order: Record<Severity, number> = { major: 0, moderate: 1, minor: 2, info: 3 };
  out.sort((x, y) => order[x.severity] - order[y.severity]);
  return out;
}
