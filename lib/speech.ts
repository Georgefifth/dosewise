"use client";

/* Read text aloud via Web Speech API — big accessibility win for seniors and
   low-vision users. No key, no server. */

const LANG_TAG: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
  hi: "hi-IN",
  fr: "fr-FR",
  ar: "ar-SA",
};

export function speak(text: string, lang: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_TAG[lang] ?? "en-US";
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
