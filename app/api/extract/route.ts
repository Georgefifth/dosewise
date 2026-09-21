import { extractFields } from "@/lib/pdf";
import { isSample, sampleBytes } from "@/lib/samples";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    let bytes: Uint8Array;
    let filename = "form.pdf";

    const sample = fd.get("sample");
    const file = fd.get("file");

    if (typeof sample === "string" && isSample(sample)) {
      bytes = await sampleBytes(sample, req);
      filename = `${sample}.pdf`;
    } else if (file instanceof File) {
      if (file.size > MAX_BYTES)
        return Response.json({ error: "File too large (max 20 MB)" }, { status: 413 });
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf")
        return Response.json({ error: "Please upload a PDF" }, { status: 415 });
      bytes = new Uint8Array(await file.arrayBuffer());
      filename = file.name;
    } else {
      return Response.json({ error: "Expected 'file' or 'sample'" }, { status: 400 });
    }

    const form = await extractFields(bytes);
    form.title = form.title === "Untitled form" ? filename : form.title;

    if (form.fieldCount === 0)
      return Response.json(
        {
          error:
            "This PDF has no fillable fields (AcroForm). Try one of the sample forms, or a PDF with interactive form fields.",
          ...form,
        },
        { status: 422 },
      );

    return Response.json(form);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read this PDF" },
      { status: 422 },
    );
  }
}
