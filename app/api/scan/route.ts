import { mockScan, scanLabelImage } from "@/lib/llm";
import { isSample } from "@/lib/samples";
import { sampleImage } from "@/lib/sample-server";
import type { ScannedMed } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES = 12;

const LLM_ON = () => !!(process.env.LLM_BASE_URL && process.env.LLM_API_KEY);

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const images: { bytes: Uint8Array; mime: string; key: string }[] = [];

    // iterate entries in submission order so med.image indexes line up
    for (const [k, v] of fd.entries()) {
      if (k === "sample" && typeof v === "string" && isSample(v)) {
        images.push({ bytes: await sampleImage(v, req), mime: "image/png", key: `sample:${v}` });
      } else if (k === "images" && v instanceof File) {
        if (v.size > MAX_BYTES)
          return Response.json({ error: `Image ${v.name} too large (max 12 MB)` }, { status: 413 });
        if (!/^image\//.test(v.type))
          return Response.json({ error: `${v.name} is not an image` }, { status: 415 });
        images.push({ bytes: new Uint8Array(await v.arrayBuffer()), mime: v.type, key: v.name });
      }
    }

    if (!images.length)
      return Response.json({ error: "Expected images[] or sample" }, { status: 400 });
    if (images.length > MAX_IMAGES)
      return Response.json({ error: `Max ${MAX_IMAGES} images` }, { status: 400 });

    const meds: ScannedMed[] = await Promise.all(
      images.map(async (img, i) => {
        const id = `m${i}`;
        if (!LLM_ON()) {
          const sample = img.key.startsWith("sample:") ? img.key.slice(7) : "";
          return mockScan(id, i, sample);
        }
        try {
          return await scanLabelImage(Buffer.from(img.bytes).toString("base64"), img.mime, id, i);
        } catch {
          return {
            id, image: i, generic: "", confidence: "low",
            notes: "scan failed — please type the details",
          } as ScannedMed;
        }
      }),
    );

    return Response.json({ meds, source: LLM_ON() ? "ai" : "offline" });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "scan failed" },
      { status: 500 },
    );
  }
}
