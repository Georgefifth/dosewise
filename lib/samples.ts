import { readFile } from "node:fs/promises";
import path from "node:path";

export const SAMPLES = ["benefits-application", "medical-intake", "rental-application"] as const;
export type SampleName = (typeof SAMPLES)[number];

export function isSample(v: string): v is SampleName {
  return (SAMPLES as readonly string[]).includes(v);
}

/** Read a bundled sample PDF — fs first, HTTP fallback for serverless. */
export async function sampleBytes(name: string, req?: Request): Promise<Uint8Array> {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("bad sample name");
  try {
    return new Uint8Array(
      await readFile(path.join(process.cwd(), "public", "samples", `${name}.pdf`)),
    );
  } catch {
    if (!req) throw new Error("sample not found");
    const res = await fetch(new URL(`/samples/${name}.pdf`, req.url));
    if (!res.ok) throw new Error("sample not found");
    return new Uint8Array(await res.arrayBuffer());
  }
}
