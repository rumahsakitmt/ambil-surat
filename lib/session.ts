import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { api, convex, secret } from "./convex";

const COOKIE = "sesi";
const MONTH = 30 * 24 * 60 * 60;
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(24).toString("base64url");

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function checkPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const given = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(given, expected);
}

/** Signs a phone in for 30 days. Only the token's hash is stored. */
export async function startSession(accountId: Id<"accounts">) {
  const token = randomToken();
  await convex.mutation(api.accounts.signIn, { secret, id: accountId, token: sha256(token) });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MONTH,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await convex.mutation(api.accounts.signOut, { secret, token: sha256(token) });
  jar.delete(COOKIE);
}

export async function sessionToken() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? sha256(token) : null;
}

/** Who is signed in on this phone, if anyone. */
export async function getAccount() {
  const token = await sessionToken();
  if (!token) return null;
  return await convex.query(api.accounts.current, { secret, token });
}

/** For the rooms' pages: a room account, or off to sign in. */
export async function requireRoom() {
  const account = await getAccount();
  if (!account) redirect("/masuk");
  if (account.role !== "room" || !account.room) redirect("/admin");
  return { ...account, room: account.room };
}

export async function requireAdmin() {
  const account = await getAccount();
  if (!account) redirect("/masuk");
  if (account.role !== "admin") redirect("/ruang");
  return account;
}

/** Proof, kept in a cookie on the patient's phone, that the date of birth was given for this QR. */
export const openedCookie = (token: string) => ({
  name: `buka_${sha256(token).slice(0, 16)}`,
  value: createHmac("sha256", secret).update(token).digest("hex"),
});

export async function hasOpened(token: string) {
  const { name, value } = openedCookie(token);
  const given = (await cookies()).get(name)?.value ?? "";
  return given.length === value.length && timingSafeEqual(Buffer.from(given), Buffer.from(value));
}
