"use client";

import { AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { Select, SelectContent, SelectItem, SelectItemIndicator, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { LETTER_TONES, type LetterType } from "@/lib/format";
import { openShare, shareLetters, setupAdmin, signIn, type FormState } from "./actions";
import { IconCheck } from "./icons";

type SubmitProps = { children: React.ReactNode; busy?: string; className?: string; disabled?: boolean } & { [key: `data-${string}`]: string | undefined };

/** A submit button that shows it is working, so nobody taps twice. */
export function Submit({ children, busy, className = "btn w-full", disabled, ...rest }: SubmitProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className={className} disabled={pending || disabled} focusableWhenDisabled aria-busy={pending} {...rest}>
      {pending ? (busy ?? "Sebentar…") : children}
    </Button>
  );
}

export function Message({ state }: { state: FormState }) {
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
      <Field name="username">
        <FieldLabel>Nama pengguna</FieldLabel>
        <Input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder={first ? "admin" : "mis. poli-anak"} />
        <FieldError match="valueMissing">Isi nama pengguna.</FieldError>
      </Field>
      <Field>
        <FieldLabel>Kata sandi</FieldLabel>
        <PasswordInput name="password" autoComplete={first ? "new-password" : "current-password"} required>
          <PasswordInputControl minLength={first ? 8 : undefined} />
          <PasswordInputToggle aria-label="Tampilkan kata sandi" />
        </PasswordInput>
        <FieldError match="valueMissing">Isi kata sandi.</FieldError>
        <FieldError match="tooShort">Kata sandi admin minimal 8 karakter.</FieldError>
      </Field>
      <Message state={state} />
      <Submit busy="Memeriksa…">{first ? "Buat akun admin" : "Masuk"}</Submit>
    </form>
  );
}

type LetterOption = { value: string; type: LetterType; title: string; noSurat: string; noRawat: string; date: string; detail: string; today: boolean };

/** The letters of one patient as pastel tiles to tick and share. Today's are ticked already. */
export function ShareForm({ noRm, letters }: { noRm: string; letters: LetterOption[] }) {
  const [state, action] = useActionState(shareLetters, undefined);
  const [picked, setPicked] = useState(() => new Set(letters.filter((l) => l.today).map((l) => l.value)));
  const set = (value: string, on: boolean) =>
    setPicked((old) => {
      const next = new Set(old);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="noRm" value={noRm} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {letters.map((letter, i) => (
          <li key={letter.value} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
            <label
              className={`tile relative flex h-full min-h-36 cursor-pointer flex-col justify-between gap-4 text-base transition-transform duration-150 select-none active:scale-[0.985] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink has-data-checked:outline-[2.5px] has-data-checked:-outline-offset-[2.5px] has-data-checked:outline-ink has-data-checked:outline-solid ${LETTER_TONES[letter.type].tile}`}
            >
              <Checkbox
                name="item"
                value={letter.value}
                checked={picked.has(letter.value)}
                onCheckedChange={(checked) => set(letter.value, checked === true)}
                className="absolute top-4 right-4 mt-0 size-8 rounded-full border-0 bg-white/80 ring-1 ring-ink/15 transition-colors duration-150 outline-none data-checked:bg-ink data-checked:text-white data-checked:ring-0"
              >
                <CheckboxIndicator>
                  <IconCheck className="size-4" />
                </CheckboxIndicator>
              </Checkbox>
              <span className="pr-10">
                <span className="block text-[13px] font-semibold text-ink/65">
                  {letter.date}
                  {letter.today && " · hari ini"}
                </span>
                <span className="mt-0.5 block text-lg leading-snug font-extrabold tracking-tight">{letter.title}</span>
              </span>
              <span className="min-w-0">
                {letter.detail && <span className="block truncate text-sm text-ink/80">{letter.detail}</span>}
                {letter.noRawat && <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink/70">No. rawat {letter.noRawat}</span>}
                <span className="mt-0.5 block truncate font-mono text-xs text-ink/60">{letter.noSurat}</span>
              </span>
            </label>
          </li>
        ))}
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
    <Button type="submit" className="btn w-full justify-between pr-3 pl-6" disabled={pending || count === 0} focusableWhenDisabled>
      <span>{pending ? "Menyiapkan QR…" : count === 0 ? "Pilih surat dulu" : `Buat QR · ${count} surat`}</span>
      <span className="grid size-10 place-items-center rounded-full bg-white/70 text-base leading-none" aria-hidden="true">
        ›››
      </span>
    </Button>
  );
}

type ConfirmProps = {
  action: (form: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  description: string;
  confirm: string;
  busy?: string;
  /** The admin dashboard's compact buttons instead of the phone's pills. */
  compact?: boolean;
};

/** A button that asks first, then sends a small form: revoking a QR, deleting an account. */
export function ConfirmForm({ action, fields, trigger, triggerClassName, title, description, confirm, busy, compact }: ConfirmProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className={triggerClassName} data-variant={compact ? "destructive" : undefined}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogBackdrop />
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <form action={action} className="flex flex-wrap justify-end gap-2">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogClose type="button" className={compact ? undefined : "btn-quiet"}>
            Batal
          </AlertDialogClose>
          <Submit className={compact ? "" : "btn-danger"} busy={busy} data-variant={compact ? "destructive" : undefined} data-agent-confirm={description}>
            {confirm}
          </Submit>
        </form>
      </AlertDialogContent>
    </AlertDialog>
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

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((label, i) => ({ value: String(i + 1), label }));

/** What the patient or their family fills in after scanning: the patient's date of birth. */
export function DobForm({ token }: { token: string }) {
  const [state, action] = useActionState(openShare, undefined);
  const typed = state?.values;
  return (
    // The key re-creates the fields with what was typed after each answer, since React empties a submitted form.
    <form key={JSON.stringify(typed ?? {})} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FieldSet>
        <FieldLegend className="text-sm">Tanggal lahir pasien</FieldLegend>
        <div className="grid grid-cols-[4.5rem_1fr_6rem] gap-2">
          <Input name="day" defaultValue={typed?.day} className="px-3 text-center" inputMode="numeric" pattern="[0-9]*" maxLength={2} required aria-label="Tanggal" placeholder="Tgl" autoComplete="off" />
          <Select name="month" required items={MONTHS} defaultValue={typed?.month || undefined} placeholder="Bulan" presentation="auto">
            <SelectTrigger aria-label="Bulan" className="w-full min-w-0 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                  <SelectItemIndicator className="ms-auto" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="year" defaultValue={typed?.year} className="px-3 text-center" inputMode="numeric" pattern="[0-9]*" maxLength={4} required aria-label="Tahun" placeholder="Tahun" autoComplete="off" />
        </div>
      </FieldSet>
      {state?.error && (
        <p role="alert" className="note-danger">
          {state.error}
        </p>
      )}
      <Submit busy="Memeriksa…">Buka surat</Submit>
    </form>
  );
}
