const ZONE = process.env.HOSPITAL_TIME_ZONE || "Asia/Makassar";

/** "2026-10-23" → "23 Okt 2026". */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/** A moment, in the hospital's time: "23 Okt 2026 14.05". */
export const dateTime = (at: number) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONE,
  }).format(at);

/** The hospital's calendar day of a moment, "2026-10-23", to tell what happened today. */
export const dayKey = (at: number) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(at);

/** "Kamis, 30 Oktober". */
export const dayMonth = (at: number) => new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: ZONE }).format(at);

/** Age in whole years on a day ("2026-10-23"), from a date of birth. */
export function age(dob: string, today: string) {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!y || !ty) return "";
  const years = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return `${Math.max(0, years)} th`;
}

export const LETTER_NAMES = {
  kontrol: "Surat Rencana Kontrol",
  sakit: "Surat Keterangan Sakit",
  sehat: "Surat Keterangan Sehat",
  kematian: "Surat Kematian",
} as const;
export type LetterType = keyof typeof LETTER_NAMES;

/** Each kind of letter has its own pastel, written out in full so Tailwind sees the classes. */
export const LETTER_TONES: Record<LetterType, { tile: string; deep: string; short: string }> = {
  kontrol: { tile: "bg-sky", deep: "bg-sky-deep", short: "Kontrol" },
  sakit: { tile: "bg-blush", deep: "bg-blush-deep", short: "Sakit" },
  sehat: { tile: "bg-mint", deep: "bg-mint-deep", short: "Sehat" },
  kematian: { tile: "bg-stone", deep: "bg-stone-deep", short: "Kematian" },
};
