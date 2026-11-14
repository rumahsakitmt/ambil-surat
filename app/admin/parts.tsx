"use client";

import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Select, SelectContent, SelectGroup, SelectGroupLabel, SelectItem, SelectItemIndicator, SelectSeparator, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { LETTER_TONES, type LetterType } from "@/lib/format";
import { createRoom, removeRoom, setPassword } from "../actions";
import { Avatar } from "../brand";
import { IconGrid, IconKey, IconList, IconPlus, IconSearch } from "../icons";
import { ConfirmForm, Message, Submit } from "../ui";

const NAV = [
  { href: "/admin", label: "Ringkasan", icon: IconGrid },
  { href: "/admin/log", label: "Riwayat berbagi", icon: IconList },
];

/** The dashboard's menu: a column in the sidebar, a row on a narrow screen. Which link is current streams in. */
export function AdminNav() {
  return (
    <Suspense fallback={<NavLinks current={undefined} />}>
      <CurrentNav />
    </Suspense>
  );
}

function CurrentNav() {
  const path = usePathname();
  return <NavLinks current={path.startsWith("/admin/log") ? "/admin/log" : "/admin"} />;
}

function NavLinks({ current }: { current: string | undefined }) {
  return (
    <nav aria-label="Menu admin" className="flex gap-1 lg:flex-col">
      {NAV.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center gap-2.5 rounded-[0.625rem] px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${active ? "bg-mint text-brand-strong" : "text-muted hover:bg-paper hover:text-ink"}`}
          >
            <item.icon className="size-[1.125rem]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const search = "pl-9";

function SearchInput({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label: string; placeholder: string }) {
  return (
    <div className="relative min-w-48 flex-1 sm:max-w-xs">
      <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <Input type="search" value={value} onValueChange={onChange} aria-label={label} placeholder={placeholder} className={search} autoComplete="off" spellCheck={false} />
    </div>
  );
}

function Segments<T extends string>({ value, onChange, label, items }: { value: T; onChange: (value: T) => void; label: string; items: { value: T; label: string }[] }) {
  return (
    <SegmentedControl aria-label={label} value={value} onValueChange={(next) => next && onChange(next as T)}>
      <SegmentedControlIndicator />
      {items.map((item) => (
        <SegmentedControlItem key={item.value} value={item.value}>
          {item.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

const th = "px-4 py-2.5 text-left text-xs font-bold tracking-wide text-muted uppercase whitespace-nowrap";
const td = "px-4 py-3 align-middle";

export type AccountRow = { id: string; username: string; name: string; admin: boolean; own: boolean; kind: "poli" | "bangsal" | null; lastAt: string | null; shared: number };
type Kind = "all" | "poli" | "bangsal";

/** Every account in one table, with search, a filter by kind of room, and each row's actions. */
export function AccountsTable({ accounts, add }: { accounts: AccountRow[]; add: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const words = query.trim().toLowerCase();
  const shown = accounts.filter((a) => (kind === "all" || a.kind === kind) && (!words || `${a.name} ${a.username}`.toLowerCase().includes(words)));
  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-line" aria-labelledby="accounts-title">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="mr-auto">
          <h2 id="accounts-title" className="text-base font-extrabold tracking-tight">
            Akun
          </h2>
          <p className="text-[13px] text-muted">Satu akun dipakai bersama perawat di ruangan itu.</p>
        </div>
        {add}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <SearchInput value={query} onChange={setQuery} label="Cari akun" placeholder="Cari ruangan atau nama pengguna" />
        <Segments
          label="Jenis ruangan"
          value={kind}
          onChange={setKind}
          items={[
            { value: "all", label: "Semua" },
            { value: "poli", label: "Poliklinik" },
            { value: "bangsal", label: "Rawat inap" },
          ]}
        />
        <p className="ml-auto text-[13px] text-muted tabular-nums" role="status">
          {shown.length} dari {accounts.length} akun
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead className="bg-paper/60">
            <tr>
              <th scope="col" className={th}>
                Ruangan
              </th>
              <th scope="col" className={th}>
                Nama pengguna
              </th>
              <th scope="col" className={th}>
                Jenis
              </th>
              <th scope="col" className={th}>
                Terakhir berbagi
              </th>
              <th scope="col" className={`${th} text-right`}>
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((account) => (
              <tr key={account.id} className="border-t border-line transition-colors duration-150 hover:bg-paper/50">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <Avatar name={account.name} className="size-9 text-xs" />
                    <span className="font-bold">
                      {account.name}
                      {account.own && <span className="ml-1.5 font-normal text-muted">(Anda)</span>}
                    </span>
                  </div>
                </td>
                <td className={`${td} font-mono text-[13px]`}>{account.username}</td>
                <td className={td}>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${account.admin ? "bg-butter" : account.kind === "poli" ? "bg-sky" : "bg-mint"}`}>
                    {account.admin ? "Admin" : account.kind === "poli" ? "Poliklinik" : "Rawat inap"}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>
                  {account.admin ? "–" : account.lastAt ? (
                    <>
                      {account.lastAt} <span className="text-[13px]">· {account.shared}×</span>
                    </>
                  ) : (
                    "Belum pernah"
                  )}
                </td>
                <td className={td}>
                  <div className="flex justify-end gap-2">
                    <PasswordDialog account={account} />
                    {!account.admin && (
                      <ConfirmForm
                        compact
                        action={removeRoom}
                        fields={{ id: account.id }}
                        trigger="Hapus"
                        title={`Hapus akun ${account.name}?`}
                        description={`Akun ${account.username} tidak bisa masuk lagi, dan semua QR yang dibagikannya dicabut. Ini tidak bisa dibatalkan.`}
                        confirm="Hapus akun"
                        busy="Menghapus…"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="border-t border-line p-8 text-center text-sm text-muted">Tidak ada akun yang cocok.</p>}
    </section>
  );
}

function PasswordDialog({ account }: { account: AccountRow }) {
  const [state, action] = useActionState(setPassword, undefined);
  return (
    <Dialog>
      <DialogTrigger>
        <IconKey className="size-4" /> Ganti sandi
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Ganti kata sandi {account.name}</DialogTitle>
        <DialogDescription>{account.own ? "Perangkat lain yang memakai akun admin akan keluar." : `Semua HP yang masuk dengan ${account.username} akan keluar dan perlu masuk lagi dengan sandi baru.`}</DialogDescription>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={account.id} />
          <Field>
            <FieldLabel>Kata sandi baru</FieldLabel>
            {account.own ? (
              <PasswordInput name="password" autoComplete="new-password" required>
                <PasswordInputControl minLength={8} />
                <PasswordInputToggle aria-label="Tampilkan kata sandi" />
              </PasswordInput>
            ) : (
              <Input name="password" autoComplete="off" required minLength={6} />
            )}
            <FieldDescription>Minimal {account.own ? 8 : 6} karakter.</FieldDescription>
            <FieldError match="valueMissing">Isi kata sandi baru.</FieldError>
            <FieldError match="tooShort">Kata sandi terlalu pendek.</FieldError>
          </Field>
          <Message state={state} />
          <div className="flex justify-end gap-2">
            <DialogClose type="button">Tutup</DialogClose>
            <Submit className="" data-variant="solid" busy="Menyimpan…">
              Simpan sandi
            </Submit>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Room = { code: string; name: string };

/** "Tambah akun": pick a poli or a ward from SIMRS and give it a username and password. */
export function NewRoomDialog({ rooms, offline }: { rooms: { poli: Room[]; bangsal: Room[] } | null; offline?: boolean }) {
  const [state, action] = useActionState(createRoom, undefined);
  const groups = rooms
    ? [
        { kind: "poli", label: "Poliklinik", items: rooms.poli },
        { kind: "bangsal", label: "Bangsal (rawat inap)", items: rooms.bangsal },
      ].map((group) => ({ ...group, items: group.items.map((room) => ({ value: `${group.kind}|${room.code}|${room.name}`, label: room.name })) }))
    : [];
  return (
    <Dialog>
      <DialogTrigger data-variant="solid">
        <IconPlus className="size-4" /> Tambah akun
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Tambah akun ruangan</DialogTitle>
        <DialogDescription>Perawat di ruangan itu masuk dengan akun ini dari HP mereka.</DialogDescription>
        {rooms ? (
          <form action={action} className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Ruangan</FieldLabel>
              <Select name="room" required placeholder="Pilih poli atau bangsal…" items={groups.flatMap((group) => group.items)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group, i) => (
                    <SelectGroup key={group.kind}>
                      {i > 0 && <SelectSeparator />}
                      <SelectGroupLabel>{group.label}</SelectGroupLabel>
                      {group.items.map((room) => (
                        <SelectItem key={room.value} value={room.value}>
                          {room.label}
                          <SelectItemIndicator className="ms-auto" />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>Pilih ruangan.</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="username">
                <FieldLabel>Nama pengguna</FieldLabel>
                <Input autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" required placeholder="mis. poli-anak" />
                <FieldError match="valueMissing">Isi nama pengguna.</FieldError>
              </Field>
              <Field name="password">
                <FieldLabel>Kata sandi</FieldLabel>
                <Input autoComplete="off" required minLength={6} placeholder="Minimal 6 karakter" />
                <FieldError match="valueMissing">Isi kata sandi.</FieldError>
                <FieldError match="tooShort">Minimal 6 karakter.</FieldError>
              </Field>
            </div>
            <Message state={state} />
            <div className="flex justify-end gap-2">
              <DialogClose type="button">Tutup</DialogClose>
              <Submit className="" data-variant="solid" busy="Membuat…">
                Buat akun
              </Submit>
            </div>
          </form>
        ) : (
          <>
            <p role="alert" className="note-danger">
              {offline ? "SIMRS tidak terhubung, jadi daftar poli dan bangsal tidak bisa dibaca. Jalankan lagi jembatan di rumah sakit, lalu muat ulang halaman ini." : "SIMRS tidak bisa menjawab. Coba muat ulang halaman ini sebentar lagi."}
            </p>
            <div className="flex justify-end">
              <DialogClose type="button">Tutup</DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type LogRow = { id: string; when: string; roomName: string; action: "bagikan" | "cabut"; noRm: string; patientName: string; letters: { type: LetterType; label: string; noSurat: string }[] };
type Action = "all" | "bagikan" | "cabut";

/** The sharing history as a table to search and filter. */
export function LogTable({ rows }: { rows: LogRow[] }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action>("all");
  const [room, setRoom] = useState("all");
  const rooms = [{ value: "all", label: "Semua ruangan" }, ...[...new Set(rows.map((row) => row.roomName))].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }))];
  const words = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (action === "all" || row.action === action) &&
      (room === "all" || row.roomName === room) &&
      (!words || `${row.patientName} ${row.noRm} ${row.letters.map((l) => l.noSurat).join(" ")}`.toLowerCase().includes(words)),
  );
  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-line" aria-label="Riwayat berbagi">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <SearchInput value={query} onChange={setQuery} label="Cari riwayat" placeholder="Cari pasien, no. RM atau no. surat" />
        <Select items={rooms} value={room} onValueChange={(next) => setRoom(typeof next === "string" ? next : "all")}>
          <SelectTrigger aria-label="Ruangan" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
                <SelectItemIndicator className="ms-auto" />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Segments
          label="Jenis kejadian"
          value={action}
          onChange={setAction}
          items={[
            { value: "all", label: "Semua" },
            { value: "bagikan", label: "Dibagikan" },
            { value: "cabut", label: "Dicabut" },
          ]}
        />
        <p className="ml-auto text-[13px] text-muted tabular-nums" role="status">
          {shown.length} dari {rows.length} kejadian
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead className="bg-paper/60">
            <tr>
              <th scope="col" className={th}>
                Waktu
              </th>
              <th scope="col" className={th}>
                Pasien
              </th>
              <th scope="col" className={th}>
                Ruangan
              </th>
              <th scope="col" className={th}>
                Kejadian
              </th>
              <th scope="col" className={th}>
                Surat
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-line transition-colors duration-150 hover:bg-paper/50">
                <td className={`${td} whitespace-nowrap text-muted tabular-nums`}>{row.when}</td>
                <td className={td}>
                  <p className="font-bold">{row.patientName}</p>
                  <p className="text-[13px] text-muted">RM {row.noRm}</p>
                </td>
                <td className={td}>{row.roomName}</td>
                <td className={td}>
                  <ActionTag action={row.action} />
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1.5">
                    {row.letters.map((letter) => (
                      <span key={`${letter.label}${letter.noSurat}`} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${LETTER_TONES[letter.type].tile}`}>
                        {letter.label} · <span className="ml-1 font-mono font-normal">{letter.noSurat}</span>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="border-t border-line p-8 text-center text-sm text-muted">{rows.length ? "Tidak ada kejadian yang cocok dengan saringan ini." : "Belum ada surat yang dibagikan."}</p>}
    </section>
  );
}

export function ActionTag({ action }: { action: "bagikan" | "cabut" }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${action === "cabut" ? "bg-danger-soft text-danger" : "bg-mint text-brand-strong"}`}>{action === "cabut" ? "Dicabut" : "Dibagikan"}</span>
  );
}
