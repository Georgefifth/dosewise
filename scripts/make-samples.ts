/**
 * Generates the three bundled sample AcroForm PDFs in public/samples/.
 * Field NAMES are deliberately bureaucratic (as in real government forms);
 * the printed labels carry the jargon the AI layer has to explain.
 *
 *   pnpm tsx scripts/make-samples.ts
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const W = 612;
const H = 792;
const M = 54; // margin
const INK = rgb(0.13, 0.13, 0.16);
const MUTED = rgb(0.42, 0.44, 0.5);
const LINE = rgb(0.82, 0.83, 0.87);
const FIELD_BG = rgb(0.97, 0.98, 1);
const FIELD_BORDER = rgb(0.62, 0.65, 0.75);

type Spec =
  | { kind: "text"; name: string; label: string; hint?: string; required?: boolean; maxLength?: number }
  | { kind: "check"; name: string; label: string; required?: boolean }
  | { kind: "radio"; name: string; label: string; options: string[]; required?: boolean }
  | { kind: "dropdown"; name: string; label: string; options: string[]; required?: boolean }
  | { kind: "section"; label: string }
  | { kind: "page" };

async function build(
  docTitle: string,
  header: { formNo: string; title: string; sub: string },
  specs: Spec[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(docTitle);
  const form = doc.getForm();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page = doc.addPage([W, H]);
  let y = H - M;

  const drawHeader = () => {
    page.drawText(header.formNo, { x: M, y: y - 8, size: 9, font: reg, color: MUTED });
    page.drawText(header.title, { x: M, y: y - 30, size: 17, font: bold, color: INK });
    page.drawText(header.sub, { x: M, y: y - 46, size: 8.5, font: italic, color: MUTED });
    page.drawLine({
      start: { x: M, y: y - 56 },
      end: { x: W - M, y: y - 56 },
      thickness: 1.2,
      color: INK,
    });
    y -= 78;
  };

  const ensureSpace = (need: number) => {
    if (y - need < M + 30) {
      footer();
      page = doc.addPage([W, H]);
      y = H - M;
      page.drawText(`${header.title} (continued)`, {
        x: M,
        y: y - 10,
        size: 10,
        font: bold,
        color: MUTED,
      });
      y -= 36;
    }
  };

  const footer = () => {
    page.drawText("FormPilot sample document — fictional form generated for demonstration.", {
      x: M,
      y: 34,
      size: 7,
      font: italic,
      color: MUTED,
    });
  };

  const drawLabel = (text: string, x: number, yy: number, size = 9) =>
    page.drawText(text, { x, y: yy, size, font: reg, color: INK });

  drawHeader();

  for (const s of specs) {
    if (s.kind === "page") {
      footer();
      page = doc.addPage([W, H]);
      y = H - M;
      page.drawText(`${header.title} (continued)`, {
        x: M,
        y: y - 10,
        size: 10,
        font: bold,
        color: MUTED,
      });
      y -= 36;
      continue;
    }
    if (s.kind === "section") {
      ensureSpace(44);
      y -= 8;
      page.drawText(s.label.toUpperCase(), { x: M, y: y - 10, size: 9.5, font: bold, color: MUTED });
      page.drawLine({ start: { x: M, y: y - 16 }, end: { x: W - M, y: y - 16 }, thickness: 0.6, color: LINE });
      y -= 34;
      continue;
    }
    if (s.kind === "text") {
      ensureSpace(44);
      drawLabel(s.label + (s.required ? " *" : ""), M, y - 10);
      if (s.hint) page.drawText(s.hint, { x: M + 320, y: y - 10, size: 7.5, font: italic, color: MUTED });
      const f = form.createTextField(s.name);
      if (s.required) f.enableRequired();
      if (s.maxLength) f.setMaxLength(s.maxLength);
      f.addToPage(page, {
        x: M,
        y: y - 30,
        width: W - 2 * M,
        height: 18,
        borderWidth: 1,
        borderColor: FIELD_BORDER,
        backgroundColor: FIELD_BG,
      });
      y -= 44;
      continue;
    }
    if (s.kind === "check") {
      ensureSpace(28);
      const f = form.createCheckBox(s.name);
      if (s.required) f.enableRequired();
      f.addToPage(page, {
        x: M,
        y: y - 12,
        width: 13,
        height: 13,
        borderWidth: 1,
        borderColor: FIELD_BORDER,
        backgroundColor: FIELD_BG,
      });
      drawLabel(s.label + (s.required ? " *" : ""), M + 20, y - 10);
      y -= 26;
      continue;
    }
    if (s.kind === "radio") {
      ensureSpace(26 + s.options.length * 20);
      drawLabel(s.label + (s.required ? " *" : ""), M, y - 10);
      y -= 24;
      const f = form.createRadioGroup(s.name);
      if (s.required) f.enableRequired();
      for (const opt of s.options) {
        f.addOptionToPage(opt, page, {
          x: M + 6,
          y: y - 10,
          width: 12,
          height: 12,
          borderWidth: 1,
          borderColor: FIELD_BORDER,
          backgroundColor: FIELD_BG,
        });
        drawLabel(opt, M + 26, y - 9);
        y -= 20;
      }
      y -= 6;
      continue;
    }
    if (s.kind === "dropdown") {
      ensureSpace(44);
      drawLabel(s.label + (s.required ? " *" : ""), M, y - 10);
      const f = form.createDropdown(s.name);
      f.addOptions(s.options);
      if (s.required) f.enableRequired();
      f.addToPage(page, {
        x: M,
        y: y - 30,
        width: 260,
        height: 18,
        borderWidth: 1,
        borderColor: FIELD_BORDER,
        backgroundColor: FIELD_BG,
      });
      y -= 44;
      continue;
    }
  }

  footer();
  form.updateFieldAppearances(reg);
  return doc.save();
}

/* ------------------------------- specs ------------------------------ */

const benefits: Spec[] = [
  { kind: "section", label: "Section A — Applicant Information" },
  { kind: "text", name: "appl_first_nm", label: "Applicant first name", required: true },
  { kind: "text", name: "appl_last_nm", label: "Applicant last name", required: true },
  { kind: "text", name: "dt_of_brth", label: "Date of birth", hint: "MM/DD/YYYY", required: true },
  { kind: "text", name: "ssn_9_dgt", label: "Social Security Number (SSN)", hint: "XXX-XX-XXXX", required: true, maxLength: 11 },
  { kind: "text", name: "prim_res_addr_ln1", label: "Primary residence — street address", required: true },
  { kind: "text", name: "res_city_nm", label: "City", required: true },
  { kind: "text", name: "res_st_cd", label: "State", maxLength: 2, required: true },
  { kind: "text", name: "res_zip_cd", label: "ZIP code", maxLength: 10, required: true },
  { kind: "text", name: "cntct_tel_num", label: "Contact telephone number" },
  { kind: "text", name: "cntct_email_addr", label: "Email address (optional)" },
  { kind: "page" },
  { kind: "section", label: "Section B — Household & Eligibility" },
  { kind: "text", name: "hh_cnt_num", label: "Total number of persons in household", required: true, maxLength: 2 },
  { kind: "text", name: "gross_mth_inc_amt", label: "Gross monthly household income", hint: "USD, before deductions", required: true },
  {
    kind: "dropdown",
    name: "emp_stat_cd",
    label: "Current employment status",
    options: ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Student", "Retired"],
    required: true,
  },
  {
    kind: "radio",
    name: "res_typ",
    label: "Residence type",
    options: ["Own", "Rent", "Staying with family/friends", "Shelter or transitional housing"],
    required: true,
  },
  { kind: "check", name: "rcv_ssi_ind", label: "I currently receive SSI or SSDI benefits" },
  { kind: "check", name: "rcv_snap_ind", label: "I currently receive SNAP (food assistance)" },
  { kind: "check", name: "us_ctzn_ind", label: "I am a U.S. citizen or qualified non-citizen", required: true },
  { kind: "section", label: "Section C — Certification" },
  { kind: "check", name: "cert_true_ind", label: "I certify under penalty of perjury that the above is true and correct", required: true },
  { kind: "text", name: "sig_appl_full", label: "Signature of applicant (type full legal name)", required: true },
  { kind: "text", name: "dt_signed", label: "Date signed", hint: "MM/DD/YYYY", required: true },
];

const medical: Spec[] = [
  { kind: "section", label: "Patient Demographics" },
  { kind: "text", name: "pt_full_nm", label: "Patient full name", required: true },
  { kind: "text", name: "pt_dob", label: "Date of birth", hint: "MM/DD/YYYY", required: true },
  {
    kind: "radio",
    name: "pt_sex_at_birth",
    label: "Sex assigned at birth",
    options: ["Female", "Male", "Intersex", "Prefer not to say"],
    required: true,
  },
  { kind: "text", name: "pt_tel_prim", label: "Primary phone", required: true },
  { kind: "text", name: "pt_addr_ln1", label: "Home address" },
  { kind: "text", name: "emrg_cntct_nm_tel", label: "Emergency contact — name & phone", required: true },
  { kind: "page" },
  { kind: "section", label: "Medical History" },
  { kind: "text", name: "cur_meds_lst", label: "Current medications (list all, or 'none')" },
  { kind: "text", name: "alg_react_txt", label: "Known allergies & reactions (or 'none')" },
  {
    kind: "dropdown",
    name: "visit_rsn_cd",
    label: "Primary reason for today's visit",
    options: ["Annual physical", "New symptoms", "Follow-up visit", "Chronic condition", "Injury", "Other"],
    required: true,
  },
  { kind: "check", name: "hist_htn_ind", label: "History of hypertension (high blood pressure)" },
  { kind: "check", name: "hist_dm_ind", label: "History of diabetes" },
  { kind: "check", name: "smk_curr_ind", label: "I currently use tobacco products" },
  { kind: "section", label: "Insurance & Consent" },
  { kind: "text", name: "ins_carrier_nm", label: "Insurance carrier name" },
  { kind: "text", name: "ins_mbr_id", label: "Member / policy ID" },
  { kind: "check", name: "consent_treat_ind", label: "I consent to treatment and release of medical records as needed", required: true },
  { kind: "text", name: "sig_pt_full", label: "Patient signature (type full name)", required: true },
  { kind: "text", name: "dt_signed", label: "Date", hint: "MM/DD/YYYY", required: true },
];

const rental: Spec[] = [
  { kind: "section", label: "Applicant" },
  { kind: "text", name: "tnt_full_nm", label: "Applicant full legal name", required: true },
  { kind: "text", name: "tnt_dob", label: "Date of birth", hint: "MM/DD/YYYY", required: true },
  { kind: "text", name: "tnt_tel_num", label: "Phone", required: true },
  { kind: "text", name: "tnt_email_addr", label: "Email", required: true },
  { kind: "text", name: "cur_addr_ln1", label: "Current address", required: true },
  { kind: "text", name: "cur_mth_rent_amt", label: "Current monthly rent", hint: "USD" },
  { kind: "section", label: "Employment & Income" },
  { kind: "text", name: "emplyr_nm", label: "Current employer", required: true },
  { kind: "text", name: "gross_mth_inc_amt", label: "Gross monthly income", hint: "USD, before taxes", required: true },
  { kind: "text", name: "emp_tenure_mos", label: "Months at current job", maxLength: 3 },
  {
    kind: "radio",
    name: "pet_ind",
    label: "Do you have pets?",
    options: ["No pets", "Cat(s)", "Dog(s)", "Other"],
    required: true,
  },
  {
    kind: "dropdown",
    name: "move_in_tmeframe",
    label: "Desired move-in timeframe",
    options: ["Immediately", "Within 30 days", "Within 60 days", "60+ days"],
    required: true,
  },
  { kind: "check", name: "evict_hist_ind", label: "I have been evicted or asked to vacate in the past 5 years" },
  { kind: "check", name: "crdt_auth_ind", label: "I authorize a credit and background check", required: true },
  { kind: "text", name: "sig_tnt_full", label: "Applicant signature (type full name)", required: true },
  { kind: "text", name: "dt_signed", label: "Date", hint: "MM/DD/YYYY", required: true },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "samples");
  await mkdir(outDir, { recursive: true });

  const jobs: [string, string, Parameters<typeof build>[1], Spec[]][] = [
    [
      "benefits-application",
      "SB-10 State Benefits Application",
      {
        formNo: "Form SB-10 · Rev. 2026",
        title: "Application for State Benefits Assistance",
        sub: "Complete all items in Sections A–C. Incomplete or unsigned applications will be returned without processing.",
      },
      benefits,
    ],
    [
      "medical-intake",
      "MI-2 New Patient Intake",
      {
        formNo: "Form MI-2 · Riverside Family Clinic",
        title: "New Patient Intake & Medical History",
        sub: "Please answer every item to the best of your knowledge. All information is confidential under HIPAA.",
      },
      medical,
    ],
    [
      "rental-application",
      "RA-7 Residential Rental Application",
      {
        formNo: "Form RA-7 · Property Management",
        title: "Residential Rental Application",
        sub: "One application per adult applicant. A non-refundable screening fee may apply.",
      },
      rental,
    ],
  ];

  for (const [file, title, header, specs] of jobs) {
    const bytes = await build(title, header, specs);
    await writeFile(path.join(outDir, `${file}.pdf`), bytes);
    console.log(`✓ ${file}.pdf  (${bytes.length} bytes, ${specs.length} specs)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
