export const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
] as const;

export const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  zh: "Simplified Chinese",
  hi: "Hindi",
  fr: "French",
  ar: "Modern Standard Arabic",
};
