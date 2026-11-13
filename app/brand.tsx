import { LETTER_TONES, type LetterType } from "@/lib/format";

/** The app's mark: a letter with a QR corner, on a leaf-green tile. */
export function Mark({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="14" fill="#82bd5e" />
      <path d="M12 10.5h11.5l5.5 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 12 29Z" fill="#fff" />
      <path d="M23.5 10.5v5.5H29" fill="#dcefc9" />
      <path d="M15.5 19.5h4.5V24h-4.5zm6.5 0h3.5v1.8H22zm0 3.2h1.8v3H22zm3 1.1h1.2v1.8H25zm-9.5 2.4h4.5v1.4h-4.5z" fill="#3c7424" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark />
      <span className="text-lg font-extrabold tracking-tight">Ambil Surat</span>
    </span>
  );
}

const PREFIX = /^(?:TN|NY|NN|AN|BY|SDR|SDRI|IBU|BPK|DR|MR|MRS|MS)\.?\s+|^(?:TN|NY|NN|AN|BY|SDR|SDRI)\./i;
/** "NY.REZKI SAPUTRI" → "RS"; titles like Tn./Ny./An. don't count. */
export function initials(name: string) {
  const words = name.replace(PREFIX, "").split(/[\s.]+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

const AVATAR_TONES = ["bg-mint", "bg-sky", "bg-butter", "bg-blush"] as const;
/** The same name always gets the same pastel. */
export function toneOf(text: string) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function Avatar({ name, className = "size-11 text-sm" }: { name: string; className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-ink ${toneOf(name)} ${className}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** A small rounded tag in a letter type's colour. */
export function LetterTag({ type, children }: { type: LetterType; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-ink ${LETTER_TONES[type].tile}`}>{children}</span>;
}
