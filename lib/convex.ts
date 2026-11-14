import "server-only";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { cache } from "react";
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

/** One socket per server, kept open, so answers from the bridge are pushed instead of polled for. */
let live: ConvexClient | undefined;
const socket = () => (live ??= new ConvexClient(url!));

/** The letterhead and when the bridge was last heard from, read once per request however many parts need it. */
export const getHospital = cache(() => convex.query(api.hospital.get, { secret }));

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

/**
 * Asks the bridge at the hospital something and waits for its answer, which
 * normally takes well under a second. A bridge that hasn't been heard from
 * lately is answered for at once; no answer in ten seconds means SIMRS is out
 * of reach.
 */
export async function ask<K extends keyof Answers>(kind: K, args: Record<string, unknown>): Promise<Answer<Answers[K]>> {
  const id = await convex.mutation(api.jobs.ask, { secret, kind, args });
  if (!id) return { ok: false, offline: true };
  const answer = await new Promise<Answer<Answers[K]>>((resolve) => {
    let settled = false;
    const watch: { stop?: () => void } = {};
    const done = (value: Answer<Answers[K]>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      watch.stop?.();
      resolve(value);
    };
    const timer = setTimeout(() => done({ ok: false, offline: true }), 10_000);
    watch.stop = socket().onUpdate(
      api.jobs.status,
      { secret, id },
      (job) => {
        if (job.status === "done") done({ ok: true, data: job.result as Answers[K] });
        else if (job.status === "error") done({ ok: false, offline: false });
      },
      () => done({ ok: false, offline: false }),
    );
    // The answer may have arrived before onUpdate returned.
    if (settled) watch.stop();
  });
  // Answered or given up on, the question is done with.
  convex.mutation(api.jobs.drop, { secret, id }).catch(() => {});
  return answer;
}
