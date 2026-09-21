import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read a bundled sample label PNG — fs first, HTTP fallback for serverless. */
export async function sampleImage(name: string, req?: Request): Promise<Uint8Array> {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("bad sample name");
  try {
    return new Uint8Array(
      await readFile(path.join(process.cwd(), "public", "samples", `${name}.png`)),
    );
  } catch {
    if (!req) throw new Error("sample not found");
    const res = await fetch(new URL(`/samples/${name}.png`, req.url));
    if (!res.ok) throw new Error("sample not found");
    return new Uint8Array(await res.arrayBuffer());
  }
}
