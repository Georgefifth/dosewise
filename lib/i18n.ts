/* Language support — chrome strings, semantic labels, question templates.
   The LLM path translates everything natively; this file powers the offline
   fallback and the UI chrome. */

export const LANGS = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
  { code: "hi", label: "हिन्दी", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];

export const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  zh: "Simplified Chinese",
  hi: "Hindi",
  fr: "French",
  ar: "Modern Standard Arabic",
};

/* Question templates used by the offline planner. `{label}` is replaced by a
   (possibly English) humanized field label. */
export const T = {
  en: {
    provide: "What is your {label}?",
    provideChoice: "Which option best matches your {label}?",
    confirm: "Does this apply to you: {label}?",
    intro:
      "I'll walk you through this form one question at a time. Everything you answer gets placed into the real PDF — and you can skip anything you're not sure about.",
    whyAsked: "Forms ask for this to {why}.",
    checklistTitle: "Before you start, gather:",
    fieldBadge: "field",
  },
  es: {
    provide: "¿Cuál es su {label}?",
    provideChoice: "¿Qué opción corresponde a su {label}?",
    confirm: "¿Esto aplica a usted: {label}?",
    intro:
      "Le guiaré por este formulario una pregunta a la vez. Todo lo que responda se coloca en el PDF real — y puede saltar lo que no sepa.",
    whyAsked: "El formulario pide esto para {why}.",
    checklistTitle: "Antes de empezar, reúna:",
    fieldBadge: "campo",
  },
  zh: {
    provide: "请提供您的{label}。",
    provideChoice: "哪一项最符合您的{label}？",
    confirm: "请问这项是否适用于您:{label}？",
    intro:
      "我会一次一个问题地带您完成这份表格。您的每个回答都会写入真实的 PDF —— 不确定的地方可以随时跳过。",
    whyAsked: "表格要求此项是为了{why}。",
    checklistTitle: "开始前请准备好：",
    fieldBadge: "字段",
  },
  hi: {
    provide: "कृपया अपना {label} बताएं।",
    provideChoice: "आपके {label} के लिए कौन-सा विकल्प सही है?",
    confirm: "क्या यह आप पर लागू होता है: {label}?",
    intro:
      "मैं इस फ़ॉर्म को एक बार में एक प्रश्न पूछकर पूरा करवाऊँगा। आपके सभी उत्तर असली PDF में भरे जाएँगे — और जो न आता हो उसे छोड़ सकते हैं।",
    whyAsked: "यह जानकारी {why} के लिए माँगी जाती है।",
    checklistTitle: "शुरू करने से पहले ये रखें:",
    fieldBadge: "फ़ील्ड",
  },
  fr: {
    provide: "Quel est votre {label} ?",
    provideChoice: "Quelle option correspond à votre {label} ?",
    confirm: "Cela vous concerne-t-il : {label} ?",
    intro:
      "Je vais vous guider à travers ce formulaire, une question à la fois. Chaque réponse est écrite dans le vrai PDF — vous pouvez sauter ce que vous ne savez pas.",
    whyAsked: "Ce champ est demandé pour {why}.",
    checklistTitle: "Avant de commencer, préparez :",
    fieldBadge: "champ",
  },
  ar: {
    provide: "ما هو {label} الخاص بك؟",
    provideChoice: "أي خيار ينطبق على {label} الخاص بك؟",
    confirm: "هل ينطبق هذا عليك: {label}؟",
    intro:
      "سأرشدك خلال هذا النموذج سؤالاً بسؤال. كل إجابة تُكتب في ملف PDF الحقيقي — ويمكنك تخطي ما لا تعرفه.",
    whyAsked: "يُطلب هذا الحقل من أجل {why}.",
    checklistTitle: "قبل أن تبدأ، جهّز:",
    fieldBadge: "حقل",
  },
} as const;

export function t(lang: string) {
  return (T as unknown as Record<string, (typeof T)["en"]>)[lang] ?? T.en;
}

/* ---- semantic dictionary: regex over field name → semantic key + labels ---- */

interface SemDef {
  key: string;
  match: RegExp;
  label: Record<string, string>; // lang → label ('en' required)
  hint?: string;
  why?: string;
}

const L = (en: string, rest: Partial<Record<LangCode, string>> = {}) => ({
  en,
  ...rest,
});

export const SEMANTIC: SemDef[] = [
  {
    key: "ssn",
    match: /ssn|social.?sec|tax.?id|itin/i,
    label: L("Social Security number", { es: "número de Seguro Social", zh: "社会安全号码", hi: "सोशल सिक्योरिटी नंबर", fr: "numéro de sécurité sociale", ar: "رقم الضمان الاجتماعي" }),
    hint: "9 digits — XXX-XX-XXXX",
    why: "verify your identity and check eligibility records",
  },
  {
    key: "dob",
    match: /dob|birth|born/i,
    label: L("date of birth", { es: "fecha de nacimiento", zh: "出生日期", hi: "जन्म तिथि", fr: "date de naissance", ar: "تاريخ الميلاد" }),
    hint: "MM/DD/YYYY",
    why: "confirm your age and identity",
  },
  {
    key: "email",
    match: /e-?mail/i,
    label: L("email address", { es: "correo electrónico", zh: "电子邮箱", hi: "ईमेल पता", fr: "adresse e-mail", ar: "البريد الإلكتروني" }),
    why: "send you updates about your application",
  },
  {
    key: "phone",
    match: /phone|tel|mobile|cell/i,
    label: L("phone number", { es: "número de teléfono", zh: "电话号码", hi: "फ़ोन नंबर", fr: "numéro de téléphone", ar: "رقم الهاتف" }),
    hint: "Include area code",
    why: "contact you about your application",
  },
  {
    key: "first_name",
    match: /first.*(name|nm)|f_?name|given/i,
    label: L("first name", { es: "nombre", zh: "名字", hi: "पहला नाम", fr: "prénom", ar: "الاسم الأول" }),
  },
  {
    key: "last_name",
    match: /last.*(name|nm)|l_?name|surname|family/i,
    label: L("last name", { es: "apellido", zh: "姓氏", hi: "उपनाम", fr: "nom de famille", ar: "اسم العائلة" }),
  },
  {
    key: "middle_name",
    match: /middle|mid.*(name|init)/i,
    label: L("middle name or initial", { es: "segundo nombre o inicial", zh: "中间名或首字母", hi: "मध्य नाम", fr: "deuxième prénom", ar: "الاسم الأوسط" }),
  },
  {
    key: "full_name",
    match: /full.*name|^(applicant|patient|tenant|owner|insured|appl|app)[_\.]?(name|nm)|^name$/i,
    label: L("full legal name", { es: "nombre legal completo", zh: "法定全名", hi: "पूरा कानूनी नाम", fr: "nom légal complet", ar: "الاسم القانوني الكامل" }),
    why: "match your official identity documents",
  },
  {
    key: "address",
    match: /addr|street|res.*(line|ln)|addr.*ln/i,
    label: L("street address", { es: "dirección", zh: "街道地址", hi: "पता", fr: "adresse", ar: "عنوان الشارع" }),
    hint: "Number and street",
    why: "send mail and verify where you live",
  },
  {
    key: "city",
    match: /city|town/i,
    label: L("city", { es: "ciudad", zh: "城市", hi: "शहर", fr: "ville", ar: "المدينة" }),
  },
  {
    key: "state",
    match: /state|province|region/i,
    label: L("state or province", { es: "estado o provincia", zh: "州/省", hi: "राज्य", fr: "État ou province", ar: "الولاية أو المقاطعة" }),
  },
  {
    key: "zip",
    match: /zip|postal|post.*code/i,
    label: L("ZIP or postal code", { es: "código postal", zh: "邮政编码", hi: "पिन कोड", fr: "code postal", ar: "الرمز البريدي" }),
  },
  {
    key: "country",
    match: /country|nation|citizen/i,
    label: L("country", { es: "país", zh: "国家", hi: "देश", fr: "pays", ar: "البلد" }),
  },
  {
    key: "gender",
    match: /gender|sex/i,
    label: L("gender", { es: "género", zh: "性别", hi: "लिंग", fr: "genre", ar: "الجنس" }),
  },
  {
    key: "marital",
    match: /marital|married|spouse/i,
    label: L("marital status", { es: "estado civil", zh: "婚姻状况", hi: "वैवाहिक स्थिति", fr: "situation familiale", ar: "الحالة الاجتماعية" }),
  },
  {
    key: "income",
    match: /income|salary|wage|earn|gross.*(amt|inc)|mth.*inc/i,
    label: L("monthly income before taxes", { es: "ingreso mensual antes de impuestos", zh: "税前月收入", hi: "कर-पूर्व मासिक आय", fr: "revenu mensuel brut", ar: "الدخل الشهري قبل الضرائب" }),
    hint: "In USD, before taxes",
    why: "decide whether your income qualifies for this program",
  },
  {
    key: "household_size",
    match: /household|hh.*(cnt|size|num)|family.*size|dependents|people.*home/i,
    label: L("number of people in your household", { es: "número de personas en su hogar", zh: "家庭成员人数", hi: "घर में लोगों की संख्या", fr: "nombre de personnes dans le foyer", ar: "عدد أفراد الأسرة" }),
    why: "compare your income against the limit for your household size",
  },
  {
    key: "employed",
    match: /employ|job|work.*(status|stat)|occupation/i,
    label: L("employment status", { es: "situación laboral", zh: "就业状况", hi: "रोज़गार स्थिति", fr: "situation professionnelle", ar: "الحالة الوظيفية" }),
  },
  {
    key: "employer",
    match: /employer|company.*name/i,
    label: L("current employer", { es: "empleador actual", zh: "当前雇主", hi: "वर्तमान नियोक्ता", fr: "employeur actuel", ar: "جهة العمل الحالية" }),
  },
  {
    key: "signature",
    match: /sig(nature|n)?\b|sgntr|sign/i,
    label: L("signature — type your full name to sign", { es: "firma — escriba su nombre completo", zh: "签名——输入您的全名", hi: "हस्ताक्षर — पूरा नाम टाइप करें", fr: "signature — tapez votre nom complet", ar: "التوقيع — اكتب اسمك الكامل" }),
    why: "legally confirm that everything you wrote is true",
  },
  {
    key: "date",
    match: /date|dt\b|signed/i,
    label: L("date", { es: "fecha", zh: "日期", hi: "तारीख", fr: "date", ar: "التاريخ" }),
    hint: "MM/DD/YYYY",
  },
  {
    key: "allergies",
    match: /allerg/i,
    label: L("allergies", { es: "alergias", zh: "过敏史", hi: "एलर्जी", fr: "allergies", ar: "الحساسية" }),
    hint: "Medications, foods, or 'none'",
    why: "keep you safe from harmful treatments",
  },
  {
    key: "medications",
    match: /medicat|meds|rx\b|prescri/i,
    label: L("medications you currently take", { es: "medicamentos que toma actualmente", zh: "目前服用的药物", hi: "वर्तमान दवाएं", fr: "médicaments actuels", ar: "الأدوية الحالية" }),
    hint: "Or write 'none'",
  },
  {
    key: "insurance",
    match: /insur|policy|member.*id|group.*num/i,
    label: L("insurance provider or member ID", { es: "aseguradora o número de miembro", zh: "保险公司或会员号", hi: "बीमा कंपनी या सदस्य ID", fr: "assureur ou numéro d'adhérent", ar: "شركة التأمين أو رقم العضوية" }),
  },
  {
    key: "emergency_contact",
    match: /emerg|ice\b/i,
    label: L("emergency contact name and phone", { es: "contacto de emergencia (nombre y teléfono)", zh: "紧急联系人姓名和电话", hi: "आपातकालीन संपर्क नाम और फ़ोन", fr: "contact d'urgence (nom et téléphone)", ar: "جهة اتصال الطوارئ (الاسم والهاتف)" }),
    why: "reach someone if something happens to you",
  },
  {
    key: "rent",
    match: /rent|lease|landlord/i,
    label: L("rent or lease details", { es: "detalles del alquiler", zh: "租金或租约信息", hi: "किराया विवरण", fr: "détails du loyer", ar: "تفاصيل الإيجار" }),
  },
];

export function humanize(name: string): string {
  let s = name
    .replace(/\.(pdf|PDF)$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\d+$/, "")
    .trim()
    .toLowerCase();
  if (!s) s = name;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function semanticFor(fieldName: string): SemDef | undefined {
  return SEMANTIC.find((s) => s.match.test(fieldName));
}

export function labelFor(fieldName: string, lang: string): string {
  const sem = semanticFor(fieldName);
  if (!sem) return humanize(fieldName);
  return sem.label[lang as LangCode] ?? sem.label.en;
}
