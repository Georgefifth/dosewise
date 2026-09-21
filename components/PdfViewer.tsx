"use client";

import { useEffect, useRef, useState } from "react";
import type { FormField } from "@/lib/schema";

interface RenderedPage {
  /** viewport-space size in CSS px */
  width: number;
  height: number;
}

const SCALE = 1.45;

export default function PdfViewer({
  pdfBytes,
  fields,
  activeFieldId,
  answeredIds,
  onFieldClick,
}: {
  pdfBytes: ArrayBuffer;
  fields: FormField[];
  activeFieldId?: string;
  answeredIds: Set<string>;
  onFieldClick?: (fieldId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [rectMap, setRectMap] = useState<Map<FormField, { left: number; top: number; width: number; height: number; pageIdx: number }[]>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let task: any;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // copy: getDocument detaches the buffer
        task = pdfjs.getDocument({ data: pdfBytes.slice(0) });
        const pdf = await task.promise;
        if (cancelled) return;

        const rendered: RenderedPage[] = [];
        const rects = new Map<FormField, { left: number; top: number; width: number; height: number; pageIdx: number }[]>();

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: SCALE });
          const canvas = canvasRefs.current[i - 1];
          if (!canvas) continue;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = viewport.width * dpr;
          canvas.height = viewport.height * dpr;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const ctx = canvas.getContext("2d")!;
          ctx.scale(dpr, dpr);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          rendered.push({ width: viewport.width, height: viewport.height });

          for (const field of fields) {
            for (const r of field.rects) {
              if (r.page !== i) continue;
              const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
                r.x,
                r.y,
                r.x + r.width,
                r.y + r.height,
              ]);
              const entry = {
                left: Math.min(x1, x2),
                top: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
                pageIdx: i - 1,
              };
              const list = rects.get(field) ?? [];
              list.push(entry);
              rects.set(field, list);
            }
          }
        }
        if (!cancelled) {
          setPages(rendered);
          setRectMap(rects);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "render failed");
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy?.();
    };
  }, [pdfBytes, fields]);

  // scroll the active field into view
  useEffect(() => {
    if (!activeFieldId) return;
    containerRef.current
      ?.querySelector(`[data-field="${CSS.escape(activeFieldId)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeFieldId, rectMap]);

  if (error)
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-red-600">
        Couldn&apos;t render the PDF preview: {error}
      </div>
    );

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-zinc-200/70 p-4">
      {pages.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          Rendering document…
        </div>
      )}
      {pages.map((pg, i) => (
        <div
          key={i}
          className="relative mx-auto mb-4 bg-white shadow-md"
          style={{ width: pg.width, height: pg.height }}
        >
          <canvas
            ref={(el) => {
              canvasRefs.current[i] = el;
            }}
            className="absolute inset-0"
          />
          {fields.map((field) =>
            (rectMap.get(field) ?? [])
              .filter((r) => r.pageIdx === i)
              .map((r, k) => {
                const isActive = field.id === activeFieldId;
                const answered = answeredIds.has(field.id);
                return (
                  <button
                    key={`${field.id}-${k}`}
                    data-field={field.id}
                    onClick={() => onFieldClick?.(field.id)}
                    title={field.name}
                    className={`absolute rounded-sm transition-all ${
                      isActive
                        ? "z-10 bg-indigo-500/25 ring-2 ring-indigo-600 animate-pulse"
                        : answered
                          ? "bg-emerald-400/15 ring-1 ring-emerald-500/50 hover:bg-emerald-400/30"
                          : "bg-amber-300/15 ring-1 ring-amber-500/60 hover:bg-amber-300/30"
                    }`}
                    style={{
                      left: r.left - 2,
                      top: r.top - 2,
                      width: r.width + 4,
                      height: r.height + 4,
                    }}
                  />
                );
              }),
          )}
        </div>
      ))}
    </div>
  );
}
