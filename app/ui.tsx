"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { LETTER_TONES, type LetterType } from "@/lib/format";
import { createRoom, openShare, setPassword, setupAdmin, shareLetters, signIn, type FormState } from "./actions";
import { IconCheck } from "./icons";

/** A submit button that shows it is working, so nobody taps twice. */
export function Submit({ children, busy, className = "btn w-full" }: { children: React.ReactNode; busy?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (busy ?? "Sebentar…") : children}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="note-danger">
        {state.error}
      </p>
    );
  if (state?.done)
    return (
      <p role="status" className="note-ok">
        {state.done}
      </p>
    );
  return null;
}

/** Reloads the page's data every second or so while something is being prepared. */
export function Refresher({ every = 1200 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}

export function LoginForm({ first }: { first: boolean }) {
  const [state, action] = useActionState(first ? setupAdmin : signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="username">
          Nama pengguna
        </label>
        <input
          id="username"
          name="username"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder={first ? "admin" : "mis. poli-anak"}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete={first ? "new-password" : "current-password"}
          required
          minLength={first ? 8 : undefined}
        />
      </div>
      <Message state={state} />
      <Submit busy="Memeriksa…">{first ? "Buat akun admin" : "Masuk"}</Submit>
    </form>
  );
}

type LetterOption = { value: string; type: LetterType; title: string; noSurat: string; date: string; detail: string; today: boolean };

/** The letters of one patient as pastel tiles to tick and share. Today's are ticked already. */
export function ShareForm({ noRm, letters }: { noRm: string; letters: LetterOption[] }) {
  const [state, action] = useActionState(shareLetters, undefined);
  const [picked, setPicked] = useState(() => new Set(letters.filter((l) => l.today).map((l) => l.value)));
  const toggle = (value: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (!next.delete(value)) next.add(value);
      return next;
    });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="noRm" value={noRm} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {letters.map((letter, i) => {
          const on = picked.has(letter.value);
          return (
            <li key={letter.value} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              <label
                className={`tile relative flex h-full min-h-36 cursor-pointer flex-col justify-between gap-4 transition-transform duration-150 select-none active:scale-[0.985] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink ${LETTER_TONES[letter.type].tile} ${on ? "outline-[2.5px] -outline-offset-[2.5px] outline-ink outline-solid" : ""}`}
              >
                <input type="checkbox" name="item" value={letter.value} checked={on} onChange={() => toggle(letter.value)} className="peer sr-only" />
                <span
                  className={`absolute top-4 right-4 grid size-8 place-items-center rounded-full transition-colors duration-150 ${on ? "bg-ink text-white" : "bg-white/80 text-transparent ring-1 ring-ink/15"}`}
                  aria-hidden="true"
                >
                  <IconCheck className="size-4" />
                </span>
                <span className="pr-10">
                  <span className="block text-[13px] font-semibold text-ink/65">
                    {letter.date}
                    {letter.today && " · hari ini"}
                  </span>
                  <span className="mt-0.5 block text-lg leading-snug font-extrabold tracking-tight">{letter.title}</span>
                </span>
                <span className="min-w-0">
                  {letter.detail && <span className="block truncate text-sm text-ink/80">{letter.detail}</span>}
                  <span className="mt-0.5 block truncate font-mono text-xs text-ink/60">{letter.noSurat}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <Message state={state} />
      {/* Floats above the bottom bar so it is always in reach of a thumb. */}
      <div className="sticky bottom-24 z-20 pt-2">
        <SubmitShare count={picked.size} />
      </div>
    </form>
  );
}

function SubmitShare({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn w-full justify-between pr-3 pl-6" disabled={pending || count === 0}>
      <span>{pending ? "Menyiapkan QR…" : count === 0 ? "Pilih surat dulu" : `Buat QR · ${count} surat`}</span>
      <span className="grid size-10 place-items-center rounded-full bg-white/70 text-base leading-none" aria-hidden="true">
        ›››
      </span>
    </button>
  );
}

export function RoomForm({ poli, bangsal }: { poli: { code: string; name: string }[]; bangsal: { code: string; name: string }[] }) {
  const [state, action] = useActionState(createRoom, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="room">
          Ruangan
        </label>
        <select id="room" name="room" className="field" required defaultValue="">
          <option value="" disabled>
            Pilih poli atau bangsal…
          </option>
          <optgroup label="Poliklinik">
            {poli.map((room) => (
              <option key={room.code} value={`poli|${room.code}|${room.name}`}>
                {room.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Bangsal (rawat inap)">
            {bangsal.map((room) => (
              <option key={room.code} value={`bangsal|${room.code}|${room.name}`}>
                {room.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new-username">
            Nama pengguna
          </label>
          <input id="new-username" name="username" className="field" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" required placeholder="mis. poli-anak" />
        </div>
        <div>
          <label className="label" htmlFor="new-password">
            Kata sandi
          </label>
          <input id="new-password" name="password" className="field" autoComplete="off" required minLength={6} placeholder="Minimal 6 karakter" />
        </div>
      </div>
      <Message state={state} />
      <Submit busy="Membuat…">Buat akun ruangan</Submit>
    </form>
  );
}

export function PasswordForm({ id, own }: { id: string; own: boolean }) {
  const [state, action] = useActionState(setPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <input
          name="password"
          className="field min-h-11 rounded-full bg-paper ring-0"
          type={own ? "password" : "text"}
          autoComplete={own ? "new-password" : "off"}
          required
          minLength={own ? 8 : 6}
          aria-label="Kata sandi baru"
          placeholder="Kata sandi baru"
        />
        <Submit className="btn-quiet shrink-0" busy="…">
          Ganti
        </Submit>
      </div>
      <Message state={state} />
    </form>
  );
}

/**
 * Saves one letter's PDF on the phone. A plain link only opens the PDF in the
 * browser on many phones, so the file is fetched here and then handed over:
 * on iPhone through the share sheet ("Simpan ke File", WhatsApp…), elsewhere
 * as a real download. Without JavaScript the link still works.
 */
export function DownloadPdf({ href, filename, children }: { href: string; filename: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(await response.text());
      const file = new File([await response.blob()], filename, { type: "application/pdf" });
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (ios && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
        } catch (error) {
          if ((error as Error).name !== "AbortError") throw error;
        }
        return;
      }
      const url = URL.createObjectURL(file);
      const link = Object.assign(document.createElement("a"), { href: url, download: filename });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFailed(true);
      // Fall back to opening the PDF, which phones can still save from their viewer.
      window.location.href = href;
    } finally {
      setBusy(false);
    }
  }

  return (
    <a href={href} download={filename} onClick={save} aria-busy={busy} className="btn min-h-11 shrink-0 bg-white px-4 text-sm hover:bg-white/80">
      {busy ? "Menyiapkan…" : failed ? "Coba lagi" : children}
    </a>
  );
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** What the patient or their family fills in after scanning: the patient's date of birth. */
export function DobForm({ token }: { token: string }) {
  const [state, action] = useActionState(openShare, undefined);
  const typed = state?.values;
  return (
    // The key re-creates the fields with what was typed after each answer, since React empties a submitted form.
    <form key={JSON.stringify(typed ?? {})} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend className="label">Tanggal lahir pasien</legend>
        <div className="grid grid-cols-[4.5rem_1fr_6rem] gap-2">
          <input name="day" defaultValue={typed?.day} className="field px-3 text-center" inputMode="numeric" pattern="[0-9]*" maxLength={2} required aria-label="Tanggal" placeholder="Tgl" autoComplete="off" />
          <select name="month" className="field px-3" required aria-label="Bulan" defaultValue={typed?.month ?? ""}>
            <option value="" disabled>
              Bulan
            </option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <input name="year" defaultValue={typed?.year} className="field px-3 text-center" inputMode="numeric" pattern="[0-9]*" maxLength={4} required aria-label="Tahun" placeholder="Tahun" autoComplete="off" />
        </div>
      </fieldset>
      {state?.error && (
        <p role="alert" className="note-danger">
          {state.error}
        </p>
      )}
      <Submit busy="Memeriksa…">Buka surat</Submit>
    </form>
  );
}
