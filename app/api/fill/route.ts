import { fillPdf } from "@/lib/pdf";
import { isSample, sampleBytes } from "@/lib/samples";
import type { AnswerMap } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    let bytes: Uint8Array;
    let outName = "filled.pdf";

    const sample = fd.get("sample");
    const file = fd.get("file");
    const answersRaw = fd.get("answers");

    if (typeof sample === "string" && isSample(sample)) {
      bytes = await sampleBytes(sample, req);
      outName = `${sample}-filled.pdf`;
    } else if (file instanceof File) {
      if (file.size > MAX_BYTES)
        return Response.json({ error: "File too large (max 20 MB)" }, { status: 413 });
      bytes = new Uint8Array(await file.arrayBuffer());
      outName = file.name.replace(/\.pdf$/i, "") + "-filled.pdf";
    } else {
      return Response.json({ error: "Expected 'file' or 'sample'" }, { status: 400 });
    }

    let answers: AnswerMap = {};
    if (typeof answersRaw === "string") {
      try {
        answers = JSON.parse(answersRaw);
      } catch {
        return Response.json({ error: "Invalid answers JSON" }, { status: 400 });
      }
    }

    const { pdf, problems } = await fillPdf(bytes, answers);

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outName}"`,
        "X-Fill-Problems": encodeURIComponent(JSON.stringify(problems)),
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "fill failed" },
      { status: 500 },
    );
  }
}
