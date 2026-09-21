import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFWidgetAnnotation,
  StandardFonts,
  PDFFont,
  PDFField,
} from "pdf-lib";
import * as fontkit from "fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnswerMap,
  ExtractedForm,
  FieldType,
  FillProblem,
  FormField,
  WidgetRect,
} from "./schema";

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

function fieldType(field: unknown): FieldType | null {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "optionlist";
  return null; // PDFButton etc. — skipped
}

/** Export (on) value of a checkbox/radio kid widget, e.g. "Yes" for /Yes. */
function widgetOnValue(widget: PDFWidgetAnnotation): string | undefined {
  const normal = widget.getAppearances()?.normal;
  if (normal instanceof PDFDict) {
    for (const key of normal.keys()) {
      const name =
        typeof (key as { decodeText?: () => string }).decodeText === "function"
          ? (key as { decodeText: () => string }).decodeText()
          : String(key).replace(/^\//, "");
      if (name !== "Off") return name;
    }
  }
  return undefined;
}

export async function extractFields(pdfBytes: Uint8Array): Promise<ExtractedForm> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  const pages = doc.getPages();

  // Map every widget annotation dict -> 1-based page index by walking Annots.
  const widgetPage = new Map<PDFDict, number>();
  pages.forEach((page, i) => {
    const annots = page.node.lookup(PDFName.of("Annots"), PDFArray);
    if (!annots) return;
    for (let k = 0; k < annots.size(); k++) {
      const obj = doc.context.lookup(annots.get(k));
      if (obj instanceof PDFDict) widgetPage.set(obj, i + 1);
    }
  });

  const fields: FormField[] = [];
  const seen = new Map<string, number>();

  for (const field of form.getFields()) {
    const type = fieldType(field);
    if (!type) continue;

    const name = field.getName();
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    const id = n === 1 ? name : `${name}#${n}`;

    const rects: WidgetRect[] = [];
    for (const widget of field.acroField.getWidgets()) {
      const r = widget.getRectangle();
      const pageIdx = widgetPage.get(widget.dict);
      rects.push({
        page: pageIdx ?? 1,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        option: type === "radio" || type === "checkbox" ? widgetOnValue(widget) : undefined,
      });
    }

    const base: FormField = {
      id,
      name,
      type,
      required: field.isRequired(),
      rects,
    };

    try {
      if (type === "radio") {
        base.options = (field as PDFRadioGroup).getOptions();
        base.value = (field as PDFRadioGroup).getSelected() ?? undefined;
      } else if (type === "dropdown" || type === "optionlist") {
        base.options = (field as PDFDropdown | PDFOptionList).getOptions();
        const sel = (field as PDFDropdown | PDFOptionList).getSelected();
        base.value = sel?.[0];
      } else if (type === "text") {
        const tf = field as PDFTextField;
        base.maxLength = tf.getMaxLength() || undefined;
        base.value = tf.getText() || undefined;
      } else if (type === "checkbox") {
        base.value = (field as PDFCheckBox).isChecked() ? "true" : undefined;
      }
    } catch {
      /* unreadable options/values are non-fatal */
    }

    fields.push(base);
  }

  // Stable reading order: page asc, then top→bottom, then left→right.
  fields.sort((a, b) => {
    const ra = a.rects[0];
    const rb = b.rects[0];
    if (!ra || !rb) return 0;
    return ra.page - rb.page || rb.y - ra.y || ra.x - rb.x;
  });

  const title =
    doc.getTitle() ||
    path.basename("form") ||
    "Untitled form";

  return {
    title,
    fieldCount: fields.length,
    fields,
    pageSizes: pages.map((p) => p.getSize()),
  };
}

/* ------------------------------------------------------------------ */
/* Filling                                                             */
/* ------------------------------------------------------------------ */

async function loadUnicodeFont(doc: PDFDocument): Promise<PDFFont | undefined> {
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.registerFontkit(fontkit as any);
    return await doc.embedFont(bytes);
  } catch {
    return undefined;
  }
}

export async function fillPdf(
  pdfBytes: Uint8Array,
  answers: AnswerMap,
): Promise<{ pdf: Uint8Array; problems: FillProblem[] }> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  const unicodeFont = await loadUnicodeFont(doc);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const problems: FillProblem[] = [];

  // id -> field (same dedupe scheme as extractFields)
  const byId = new Map<string, PDFField>();
  const seen = new Map<string, number>();
  for (const f of form.getFields()) {
    const name = f.getName();
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    byId.set(n === 1 ? name : `${name}#${n}`, f);
  }

  for (const [id, value] of Object.entries(answers)) {
    const field = byId.get(id);
    if (!field || value === undefined || value === null || value === "") continue;
    try {
      if (field instanceof PDFTextField) {
        const text = String(value);
        if (field.getMaxLength() && text.length > (field.getMaxLength() ?? 0)) {
          problems.push({ fieldId: id, reason: "answer truncated to max length" });
        }
        field.setText(text);
        try {
          field.updateAppearances(unicodeFont ?? helv);
        } catch {
          try {
            field.updateAppearances(helv);
          } catch {
            problems.push({ fieldId: id, reason: "characters not encodable by form font" });
          }
        }
      } else if (field instanceof PDFCheckBox) {
        if (value === true || value === "true" || value === "yes") field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        field.select(String(value));
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        field.select(String(value));
        try {
          field.updateAppearances(unicodeFont ?? helv);
        } catch {
          try {
            field.updateAppearances(helv);
          } catch {
            problems.push({ fieldId: id, reason: "characters not encodable" });
          }
        }
      }
    } catch (err) {
      problems.push({
        fieldId: id,
        reason: err instanceof Error ? err.message : "fill failed",
      });
    }
  }

  return { pdf: await doc.save(), problems };
}
