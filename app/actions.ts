"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { api, convex, secret } from "@/lib/convex";
import { LETTER_NAMES, type LetterType } from "@/lib/format";
import {
  checkPassword,
  endSession,
  hashPassword,
  openedCookie,
  randomToken,
  requireAdmin,
  requireRoom,
  sessionToken,
  startSession,
} from "@/lib/session";

export type FormState = { error?: string; done?: string } | undefined;

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** The very first visitor to the sign-in page creates the admin account. */
export async function setupAdmin(_: FormState, form: FormData): Promise<FormState> {
  const username = field(form, "username").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!USERNAME.test(username)) return { error: "Nama pengguna 3–30 karakter: huruf kecil, angka, titik atau strip." };
  if (password.length < 8) return { error: "Kata sandi admin minimal 8 karakter." };
  const created = await convex.mutation(api.accounts.setup, { secret, username, name: "Admin", passwordHash: await hashPassword(password) });
  if (!created) return { error: "Akun admin sudah ada. Silakan masuk." };
  const account = await convex.query(api.accounts.forLogin, { secret, username });
  if (account) await startSession(account.id);
  redirect("/admin");
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const username = field(form, "username").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Isi nama pengguna dan kata sandi." };
  const account = await convex.query(api.accounts.forLogin, { secret, username });
  if (account?.locked) return { error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." };
  // The same answer for an unknown name and a wrong password.
  if (!account || !(await checkPassword(password, account.passwordHash))) {
    if (account) await convex.mutation(api.accounts.loginFailed, { secret, id: account.id });
    return { error: "Nama pengguna atau kata sandi salah." };
  }
  await startSession(account.id);
  redirect("/");
}

export async function signOut() {
  await endSession();
  redirect("/masuk");
}

/** A room shares the ticked letters of one patient; the page it lands on shows the QR. */
export async function shareLetters(_: FormState, form: FormData): Promise<FormState> {
  const account = await requireRoom();
  const noRm = field(form, "noRm");
  const items = form
    .getAll("item")
    .map((value) => String(value).split("|"))
    .filter((parts): parts is [LetterType, string, string] => parts.length === 3 && parts[0] in LETTER_NAMES)
    .map(([type, noSurat, date]) => ({ type, noSurat, date }));
  if (!noRm || items.length === 0) return { error: "Centang minimal satu surat." };
  const id = await convex.mutation(api.shares.create, { secret, accountId: account.id, token: randomToken(), noRm, items });
  if (!id) return { error: "Tidak bisa membagikan. Coba lagi." };
  redirect(`/ruang/bagikan/${id}`);
}

export async function revokeShare(form: FormData) {
  const account = await requireRoom();
  await convex.mutation(api.shares.revoke, { secret, accountId: account.id, id: field(form, "id") });
  redirect("/ruang/dibagikan");
}

export async function createRoom(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const username = field(form, "username").toLowerCase();
  const password = String(form.get("password") ?? "");
  const [kind, code, ...rest] = field(form, "room").split("|");
  const name = rest.join("|");
  if ((kind !== "poli" && kind !== "bangsal") || !code || !name) return { error: "Pilih ruangan." };
  if (!USERNAME.test(username)) return { error: "Nama pengguna 3–30 karakter: huruf kecil, angka, titik atau strip." };
  if (password.length < 6) return { error: "Kata sandi minimal 6 karakter." };
  const created = await convex.mutation(api.accounts.create, {
    secret,
    username,
    passwordHash: await hashPassword(password),
    room: { kind, code, name },
  });
  if (!created) return { error: `Nama pengguna "${username}" sudah dipakai.` };
  refresh();
  return { done: `Akun ${username} untuk ${name} dibuat.` };
}

/** A new password for a room (or the admin's own), which signs its other phones out. */
export async function setPassword(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = field(form, "id") as Id<"accounts">;
  const password = String(form.get("password") ?? "");
  const own = id === admin.id;
  if (password.length < (own ? 8 : 6)) return { error: `Kata sandi minimal ${own ? 8 : 6} karakter.` };
  await convex.mutation(api.accounts.setPassword, {
    secret,
    id,
    passwordHash: await hashPassword(password),
    ...(own && { keepToken: (await sessionToken()) ?? undefined }),
  });
  refresh();
  return { done: "Kata sandi diganti." };
}

export async function removeRoom(form: FormData) {
  await requireAdmin();
  await convex.mutation(api.accounts.remove, { secret, id: field(form, "id") as Id<"accounts"> });
  refresh();
}

/** `values` gives the form back what was typed, so a mistake needn't be typed again. */
export type OpenState = { error?: string; values?: { day: string; month: string; year: string } } | undefined;

/** The patient's side: the date of birth that opens a scanned QR. */
export async function openShare(_: OpenState, form: FormData): Promise<OpenState> {
  const token = field(form, "token");
  const day = Number(field(form, "day")),
    month = Number(field(form, "month")),
    year = Number(field(form, "year"));
  const valid = Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year) && day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100;
  const values = { day: field(form, "day"), month: field(form, "month"), year: field(form, "year") };
  if (!token || !valid) return { error: "Isi tanggal, bulan dan tahun lahir pasien.", values };
  const dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const result = await convex.mutation(api.shares.open, { secret, token, dob });
  if (!result.ok) {
    if (result.state === "ready") return { error: `Tanggal lahir tidak cocok. Sisa ${result.left} kali percobaan.`, values };
    // Locked or gone: the page itself says so.
    refresh();
    return undefined;
  }
  const { name, value } = openedCookie(token);
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/s/${token}`,
    maxAge: 7 * 24 * 60 * 60,
  });
  redirect(`/s/${token}`);
}
