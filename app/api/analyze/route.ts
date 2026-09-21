import { checkInteractions } from "@/lib/interactions";
import { explainMeds } from "@/lib/llm";
import { buildSchedule, estimateSupply } from "@/lib/schedule";
import type { Analysis, MedInput } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { meds?: MedInput[]; lang?: string };
    const meds = (body.meds ?? []).filter((m) => m.generic?.trim());
    if (!meds.length)
      return Response.json({ error: "Expected non-empty meds[]" }, { status: 400 });

    const lang = typeof body.lang === "string" ? body.lang : "en";

    // deterministic safety layer — never delegated to the LLM
    const interactions = checkInteractions(meds);
    const schedule = buildSchedule(meds);

    const { explanations, pharmacistQuestions, source } = await explainMeds(meds, lang);

    const analysis: Analysis = {
      interactions,
      schedule,
      explanations,
      refills: meds.map((m) => ({ medId: m.id, ...estimateSupply(m) })),
      pharmacistQuestions,
      source,
    };
    return Response.json(analysis);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "analysis failed" },
      { status: 500 },
    );
  }
}
