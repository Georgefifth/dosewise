"use client";

/* Answer vault — remembers semantic answers (name, dob, …) in localStorage so
   the next form is mostly pre-filled. Never leaves the device. */

const KEY = "formpilot.vault.v1";

export type Vault = Record<string, string>;

export function loadVault(): Vault {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Vault) : {};
  } catch {
    return {};
  }
}

export function saveVault(entries: Record<string, string>) {
  try {
    const current = loadVault();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...entries }));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

export function clearVault() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
