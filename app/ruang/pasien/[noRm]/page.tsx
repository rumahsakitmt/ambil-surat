import Link from "next/link";
import { Suspense } from "react";
import { ask } from "@/lib/convex";
import { LETTER_NAMES, age, shortDate } from "@/lib/format";
import { requireRoom } from "@/lib/session";
import { ShareForm } from "../../../ui";
import { ListSkeleton, Unreachable } from "../../parts";

async function Letters({ params, searchParams }: Pick<PageProps<"/ruang/pasien/[noRm]">, "params" | "searchParams">) {
  await requireRoom();
  const noRm = decodeURIComponent((await params).noRm);
  const all = (await searchParams).semua === "1";
  const found = await ask("letters", { noRm, all });
  if (!found.ok) return <Unreachable offline={found.offline} />;
  if (!found.data) return <p className="note-warn">Pasien dengan nomor RM {noRm} tidak ditemukan di SIMRS.</p>;
  const { patient, today, letters } = found.data;
  const here = `/ruang/pasien/${encodeURIComponent(noRm)}`;
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{patient.name}</h1>
        <p className="mt-0.5 text-sm text-muted">
          RM {patient.noRm} · {patient.sex === "P" ? "Perempuan" : "Laki-laki"} · {age(patient.dob, today)} · lahir {shortDate(patient.dob)}
        </p>
      </div>
      {letters.length === 0 ? (
        <div className="card p-4 text-sm text-muted">
          <p className="font-medium text-ink">{all ? "Pasien ini belum punya surat di SIMRS." : "Tidak ada surat dalam 30 hari terakhir."}</p>
          <p className="mt-1">Surat kontrol, surat sakit, surat sehat dan surat kematian muncul di sini setelah dibuat di SIMRS.</p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-medium text-muted">{all ? "Semua surat" : "Surat 30 hari terakhir"} · centang yang dibagikan</h2>
          <ShareForm
            key={all ? "all" : "recent"}
            noRm={patient.noRm}
            letters={letters.map((l) => ({
              value: `${l.type}|${l.noSurat}|${l.date}`,
              title: LETTER_NAMES[l.type],
              noSurat: l.noSurat,
              date: shortDate(l.date),
              detail: l.rencana ? `${l.detail} · kontrol ${shortDate(l.rencana)}` : l.detail,
              today: l.date === today,
            }))}
          />
        </>
      )}
      <p className="text-center text-sm">
        {all ? (
          <Link href={here} className="font-medium text-brand underline underline-offset-4">
            Hanya 30 hari terakhir
          </Link>
        ) : (
          <Link href={`${here}?semua=1`} className="font-medium text-brand underline underline-offset-4">
            Tampilkan surat yang lebih lama
          </Link>
        )}
      </p>
    </>
  );
}

export default function Page({ params, searchParams }: PageProps<"/ruang/pasien/[noRm]">) {
  return (
    <main className="page flex flex-col gap-4">
      <Link href="/ruang" className="text-sm font-medium text-brand">
        ← Daftar pasien
      </Link>
      <Suspense
        fallback={
          <>
            <div className="skeleton h-14 w-3/4" />
            <ListSkeleton rows={3} />
          </>
        }
      >
        <Letters params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
