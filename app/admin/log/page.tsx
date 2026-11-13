import type { Metadata } from "next";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { LETTER_TONES, dateTime, type LetterType } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { Avatar, LetterTag } from "../../brand";
import { ListSkeleton } from "../../ruang/parts";

export const metadata: Metadata = { title: "Riwayat berbagi" };

/** "sakit SKS2026…" as stored in the log → its type and number. */
const parse = (entry: string) => {
  const [type, ...rest] = entry.split(" ");
  return { type: (type in LETTER_TONES ? type : "kontrol") as LetterType, known: type in LETTER_TONES, label: type, noSurat: rest.join(" ") };
};

async function Log() {
  await requireAdmin();
  const rows = await convex.query(api.hospital.log, { secret });
  if (rows.length === 0) return <p className="tile bg-card text-sm text-muted">Belum ada surat yang dibagikan.</p>;
  return (
    <ul className="card flex flex-col p-1.5">
      {rows.map((row, i) => (
        <li key={row.id} className="rise flex gap-3 rounded-[1.4rem] px-3 py-3" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
          <Avatar name={row.patientName} />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline justify-between gap-3">
              <span className="truncate font-bold">{row.patientName}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${row.action === "cabut" ? "bg-danger-soft text-danger" : "bg-mint text-brand-strong"}`}>
                {row.action === "cabut" ? "Dicabut" : "Dibagikan"}
              </span>
            </p>
            <p className="truncate text-[13px] text-muted">
              RM {row.noRm} · {row.roomName} · {dateTime(row.at)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.letters.map((entry) => {
                const letter = parse(entry);
                return (
                  <LetterTag key={entry} type={letter.type}>
                    {letter.known ? LETTER_TONES[letter.type].short : letter.label} · <span className="ml-1 font-mono font-normal">{letter.noSurat}</span>
                  </LetterTag>
                );
              })}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <main className="page flex flex-col gap-4">
      <div className="mt-2">
        <h1 className="text-[1.7rem] leading-tight font-extrabold tracking-tight">Riwayat berbagi</h1>
        <p className="mt-1 text-sm text-muted text-pretty">Ruangan mana membagikan surat siapa, 300 terakhir. Riwayat tetap ada setelah suratnya terhapus.</p>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <Log />
      </Suspense>
    </main>
  );
}
