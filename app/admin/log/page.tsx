import type { Metadata } from "next";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { LETTER_TONES, dateTime, type LetterType } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { LogTable } from "../parts";

export const metadata: Metadata = { title: "Riwayat berbagi" };

/** "sakit SKS2026…" as stored in the log → its type and number. */
const parse = (entry: string) => {
  const [type, ...rest] = entry.split(" ");
  const known = type in LETTER_TONES;
  return { type: (known ? type : "kontrol") as LetterType, label: known ? LETTER_TONES[type as LetterType].short : type, noSurat: rest.join(" ") };
};

async function Log() {
  await requireAdmin();
  const rows = await convex.query(api.hospital.log, { secret });
  return (
    <LogTable
      rows={rows.map((row) => ({
        id: row.id,
        when: dateTime(row.at),
        roomName: row.roomName,
        action: row.action,
        noRm: row.noRm,
        patientName: row.patientName,
        letters: row.letters.map(parse),
      }))}
    />
  );
}

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight">Riwayat berbagi</h1>
        <p className="mt-1 text-sm text-muted text-pretty">Ruangan mana membagikan surat siapa, 300 terakhir. Riwayat tetap ada setelah suratnya terhapus.</p>
      </div>
      <Suspense fallback={<div aria-hidden="true" className="skeleton h-96 rounded-2xl" />}>
        <Log />
      </Suspense>
    </main>
  );
}
