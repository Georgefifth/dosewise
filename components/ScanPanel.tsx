"use client";

import { useRef, useState } from "react";

export interface ScanImage {
  url: string; // objectURL or /samples/x.png
  file?: File;
  sample?: string;
}

export default function ScanPanel({
  images,
  onAdd,
  onRemove,
}: {
  images: ScanImage[];
  onAdd: (imgs: ScanImage[]) => void;
  onRemove: (i: number) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ url: URL.createObjectURL(f), file: f }));
    if (list.length) onAdd(list);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? "border-teal-500 bg-teal-50" : "border-teal-300 bg-white hover:border-teal-500"
        }`}
      >
        <span className="text-3xl">💊</span>
        <p className="mt-3 text-sm font-semibold text-zinc-800">
          Photograph or upload your medication labels
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          bottles, boxes, blister packs — as many as you take
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => cameraInput.current?.click()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            📷 Take a photo
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Upload images
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={i} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`label ${i + 1}`}
                className="h-24 w-36 rounded-lg border border-zinc-200 object-cover"
              />
              <button
                onClick={() => onRemove(i)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                title="remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
