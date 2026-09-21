import { planInterview } from "@/lib/llm";
import type { ExtractedForm } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { form?: ExtractedForm; lang?: string };
    if (!body.form || !Array.isArray(body.form.fields))
      return Response.json({ error: "Expected { form, lang }" }, { status: 400 });
    const lang = typeof body.lang === "string" ? body.lang : "en";
    const plan = await planInterview(body.form, lang);
    return Response.json(plan);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "plan failed" },
      { status: 500 },
    );
  }
}
