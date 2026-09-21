/* Curated drug knowledge: canonical generic → classes, aliases, plain purpose.
   The interaction engine matches on classes; aliases let the VL's raw output
   (brand names, misspellings) resolve to a canonical generic. */

export interface DrugInfo {
  generic: string;
  classes: string[];
  aliases: string[];
  purpose: string;
  /** preferred slot when frequency is "once daily" */
  timing?: "morning" | "evening" | "bedtime";
  food?: "with" | "empty";
  foodNote?: string;
}

export const DRUGS: DrugInfo[] = [
  { generic: "warfarin", classes: ["anticoagulant"], aliases: ["coumadin", "jantoven", "warfarin sodium"], purpose: "a blood thinner that prevents dangerous clots (stroke, DVT).", timing: "evening" },
  { generic: "apixaban", classes: ["anticoagulant"], aliases: ["eliquis"], purpose: "a blood thinner that prevents clots and stroke." },
  { generic: "rivaroxaban", classes: ["anticoagulant"], aliases: ["xarelto"], purpose: "a blood thinner that prevents clots and stroke.", food: "with" },
  { generic: "clopidogrel", classes: ["antiplatelet"], aliases: ["plavix"], purpose: "keeps platelets from clumping — prevents clots after stents or heart events." },
  { generic: "aspirin", classes: ["antiplatelet", "nsaid"], aliases: ["acetylsalicylic acid", "asa", "bayer"], purpose: "low dose: prevents clots. Higher dose: pain/fever relief." },
  { generic: "ibuprofen", classes: ["nsaid"], aliases: ["advil", "motrin", "nurofen"], purpose: "an NSAID for pain, fever, and inflammation.", food: "with" },
  { generic: "naproxen", classes: ["nsaid"], aliases: ["aleve", "naprosyn"], purpose: "an NSAID for pain and inflammation, longer-acting than ibuprofen.", food: "with" },
  { generic: "acetaminophen", classes: ["analgesic"], aliases: ["paracetamol", "tylenol", "apap"], purpose: "pain and fever relief; gentler on the stomach than NSAIDs." },
  { generic: "lisinopril", classes: ["ace"], aliases: ["zestril", "prinivil"], purpose: "an ACE inhibitor that lowers blood pressure and protects the kidneys." },
  { generic: "enalapril", classes: ["ace"], aliases: ["vasotec"], purpose: "an ACE inhibitor for blood pressure and heart failure." },
  { generic: "losartan", classes: ["arb"], aliases: ["cozaar"], purpose: "an ARB that lowers blood pressure." },
  { generic: "valsartan", classes: ["arb"], aliases: ["diovan"], purpose: "an ARB for blood pressure and heart failure." },
  { generic: "potassium chloride", classes: ["potassium"], aliases: ["k-dur", "klor-con", "potassium", "k+ supplement"], purpose: "a potassium supplement for low blood potassium." },
  { generic: "spironolactone", classes: ["potassium-sparing", "diuretic"], aliases: ["aldactone"], purpose: "a potassium-sparing diuretic used for heart failure, blood pressure, and hormonal conditions." },
  { generic: "simvastatin", classes: ["statin"], aliases: ["zocor"], purpose: "a statin that lowers LDL cholesterol.", timing: "bedtime", foodNote: "Avoid grapefruit — it raises simvastatin levels sharply." },
  { generic: "atorvastatin", classes: ["statin"], aliases: ["lipitor"], purpose: "a statin that lowers LDL cholesterol.", foodNote: "Limit grapefruit — it can raise statin levels." },
  { generic: "metformin", classes: ["antidiabetic"], aliases: ["glucophage", "fortamet"], purpose: "first-line diabetes medicine that lowers blood sugar.", food: "with" },
  { generic: "insulin glargine", classes: ["insulin"], aliases: ["lantus", "basaglar", "insulin"], purpose: "long-acting insulin for blood-sugar control.", timing: "bedtime" },
  { generic: "amlodipine", classes: ["ccb"], aliases: ["norvasc"], purpose: "a calcium-channel blocker for blood pressure and chest pain." },
  { generic: "metoprolol", classes: ["beta-blocker"], aliases: ["lopressor", "toprol", "metoprolol tartrate", "metoprolol succinate"], purpose: "a beta blocker for blood pressure, heart rate, and heart protection.", food: "with" },
  { generic: "sertraline", classes: ["ssri"], aliases: ["zoloft"], purpose: "an SSRI for depression, anxiety, and related conditions." },
  { generic: "escitalopram", classes: ["ssri"], aliases: ["lexapro"], purpose: "an SSRI for depression and anxiety." },
  { generic: "fluoxetine", classes: ["ssri"], aliases: ["prozac"], purpose: "an SSRI for depression and related conditions." },
  { generic: "citalopram", classes: ["ssri", "qt"], aliases: ["celexa"], purpose: "an SSRI for depression; can affect heart rhythm at higher doses." },
  { generic: "tramadol", classes: ["opioid", "serotonergic"], aliases: ["ultram"], purpose: "a pain reliever with opioid and serotonin effects." },
  { generic: "oxycodone", classes: ["opioid"], aliases: ["oxycontin", "percocet", "roxicodone"], purpose: "an opioid for moderate-to-severe pain." },
  { generic: "hydrocodone", classes: ["opioid"], aliases: ["vicodin", "norco"], purpose: "an opioid for pain, usually combined with acetaminophen." },
  { generic: "alprazolam", classes: ["benzodiazepine"], aliases: ["xanax"], purpose: "a benzodiazepine for anxiety — fast but habit-forming." },
  { generic: "lorazepam", classes: ["benzodiazepine"], aliases: ["ativan"], purpose: "a benzodiazepine for anxiety and sleep." },
  { generic: "diazepam", classes: ["benzodiazepine"], aliases: ["valium"], purpose: "a benzodiazepine for anxiety, muscle spasm, and seizures." },
  { generic: "zolpidem", classes: ["sedative"], aliases: ["ambien"], purpose: "a sleep aid — take only right before bed.", timing: "bedtime" },
  { generic: "diphenhydramine", classes: ["sedative", "antihistamine"], aliases: ["benadryl"], purpose: "a sedating antihistamine for allergies and sleep." },
  { generic: "omeprazole", classes: ["ppi"], aliases: ["prilosec"], purpose: "a proton-pump inhibitor that reduces stomach acid.", timing: "morning", food: "empty" },
  { generic: "levothyroxine", classes: ["thyroid"], aliases: ["synthroid", "levoxyl", "t4"], purpose: "replaces thyroid hormone for hypothyroidism.", timing: "morning", food: "empty", foodNote: "Take on an empty stomach, 30–60 min before breakfast; keep away from calcium and iron." },
  { generic: "prednisone", classes: ["corticosteroid"], aliases: ["deltasone", "prednisolone"], purpose: "a steroid for inflammation and immune conditions.", timing: "morning", food: "with" },
  { generic: "clarithromycin", classes: ["macrolide", "qt"], aliases: ["biaxin"], purpose: "a macrolide antibiotic." },
  { generic: "azithromycin", classes: ["macrolide", "qt"], aliases: ["zithromax", "z-pak", "zpak"], purpose: "a macrolide antibiotic." },
  { generic: "ondansetron", classes: ["qt", "antiemetic"], aliases: ["zofran"], purpose: "an anti-nausea medicine." },
  { generic: "sildenafil", classes: ["pde5"], aliases: ["viagra", "revatio"], purpose: "a PDE5 inhibitor (erectile dysfunction / pulmonary hypertension)." },
  { generic: "nitroglycerin", classes: ["nitrate"], aliases: ["nitrostat", "nitroglycerine"], purpose: "a nitrate for chest pain (angina) — relieves heart workload fast." },
  { generic: "furosemide", classes: ["loop-diuretic"], aliases: ["lasix"], purpose: "a strong water pill for fluid overload and heart failure.", timing: "morning" },
  { generic: "hydrochlorothiazide", classes: ["thiazide", "diuretic"], aliases: ["hctz", "microzide"], purpose: "a water pill for blood pressure.", timing: "morning" },
  { generic: "gabapentin", classes: ["anticonvulsant"], aliases: ["neurontin"], purpose: "for nerve pain and seizures." },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();

const ALIAS_INDEX = new Map<string, DrugInfo>();
for (const d of DRUGS) {
  ALIAS_INDEX.set(norm(d.generic), d);
  for (const a of d.aliases) ALIAS_INDEX.set(norm(a), d);
}

/** Resolve free-text (VL output or user typing) to a DrugInfo, tolerating
   brand names, dosage tails ("50mg"), salt suffixes, and typos. */
export function resolveDrug(raw: string): DrugInfo | undefined {
  const s = norm(raw)
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|unit|units|%)\b/g, "")
    .replace(/\b(tablet|tablets|capsule|capsules|cap|tab|oral|er|xr|xl|sr|dr|hcl|hydrochloride|sodium|potassium(?!\s+chloride))\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (ALIAS_INDEX.has(s)) return ALIAS_INDEX.get(s);
  // substring fallback both directions
  for (const [alias, info] of ALIAS_INDEX) {
    if (alias.length >= 5 && (s.includes(alias) || alias.includes(s))) return info;
  }
  // prefix match (misspellings)
  for (const [alias, info] of ALIAS_INDEX) {
    if (s.length >= 5 && alias.startsWith(s.slice(0, 6))) return info;
  }
  return undefined;
}

export function drugLabel(raw: string): string {
  const d = resolveDrug(raw);
  return d ? d.generic : raw.trim();
}
