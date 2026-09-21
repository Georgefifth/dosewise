import { summarizeSubmission } from "@/lib/llm";
import type { AnswerMap, ExtractedForm } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      form?: ExtractedForm;
      answers?: AnswerMap;
      lang?: string;
    };
    if (!body.form || !body.answers)
      return Response.json({ error: "Expected { form, answers, lang }" }, { status: 400 });
    const markdown = await summarizeSubmission(
      body.form,
      body.answers,
      typeof body.lang === "string" ? body.lang : "en",
    );
    return Response.json({ markdown });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "summary failed" },
      { status: 500 },
    );
  }
}
