import type { Metadata } from "next";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { LETTER_NAMES, dateTime, type LetterType } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { ListSkeleton } from "../../ruang/parts";

export const metadata: Metadata = { title: "Riwayat berbagi" };

const letterName = (entry: string) => {
  const [type, ...rest] = entry.split(" ");
  return `${LETTER_NAMES[type as LetterType] ?? type} ${rest.join(" ")}`;
};

async function Log() {
  await requireAdmin();
  const rows = await convex.query(api.hospital.log, { secret });
  if (rows.length === 0) return <p className="card p-4 text-sm text-muted">Belum ada surat yang dibagikan.</p>;
  return (
    <ul className="card divide-y divide-line">
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-3">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold">{row.patientName}</span>
            <span className={`text-xs font-medium ${row.action === "cabut" ? "text-danger" : "text-brand-strong"}`}>{row.action === "cabut" ? "Dicabut" : "Dibagikan"}</span>
          </p>
          <p className="text-sm text-muted">
            RM {row.noRm} · {row.roomName} · {dateTime(row.at)}
          </p>
          <ul className="mt-1 text-sm">
            {row.letters.map((letter) => (
              <li key={letter}>{letterName(letter)}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <main className="page flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Riwayat berbagi</h1>
        <p className="mt-0.5 text-sm text-muted">Ruangan mana membagikan surat siapa, 300 terakhir. Riwayat tetap ada setelah suratnya terhapus.</p>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <Log />
      </Suspense>
    </main>
  );
}
