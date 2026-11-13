import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Convex is only ever called from this server, with a secret the browser never
 * sees: every function checks it (convex/lib.ts).
 */
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set (run `npx convex dev`).");
export const secret = process.env.APP_SECRET ?? "";
if (!secret) throw new Error("APP_SECRET is not set (see README.md).");

export const convex = new ConvexHttpClient(url);
export { api };

export type Patient = { noRm: string; name: string; dob: string; sex: string; info: string };
export type LetterRow = { type: "kontrol" | "sakit" | "sehat" | "kematian"; noSurat: string; noRawat?: string; date: string; detail: string; rencana?: string };
export type RoomOption = { code: string; name: string };
type Answers = {
  rooms: { poli: RoomOption[]; bangsal: RoomOption[] };
  patients: Patient[];
  search: Patient[];
  letters: { patient: Patient; today: string; letters: LetterRow[] } | null;
};

export type Answer<T> = { ok: true; data: T } | { ok: false; offline: boolean };

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Asks the bridge at the hospital something and waits for its answer, which
 * normally takes well under a second. No answer in ten seconds means SIMRS is
 * out of reach.
 */
export async function ask<K extends keyof Answers>(kind: K, args: Record<string, unknown>): Promise<Answer<Answers[K]>> {
  const id = await convex.mutation(api.jobs.ask, { secret, kind, args });
  const deadline = Date.now() + 10_000;
  for (let wait = 120; Date.now() < deadline; wait = Math.min(wait + 60, 400)) {
    await sleep(wait);
    const job = await convex.mutation(api.jobs.take, { secret, id });
    if (job.status === "done") return { ok: true, data: job.result as Answers[K] };
    if (job.status === "error") return { ok: false, offline: false };
  }
  await convex.mutation(api.jobs.drop, { secret, id }).catch(() => {});
  return { ok: false, offline: true };
}
