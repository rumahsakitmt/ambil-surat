import Link from "next/link";
import { Suspense } from "react";
import { ask } from "@/lib/convex";
import { LETTER_NAMES, age, shortDate } from "@/lib/format";
import { requireRoom } from "@/lib/session";
import { Avatar } from "../../../brand";
import { ShareForm } from "../../../ui";
import { ListSkeleton, TitleBar, Unreachable } from "../../parts";

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
      <div className="card rise flex items-center gap-4 p-4">
        <Avatar name={patient.name} className="size-14 text-base" />
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-extrabold tracking-tight text-balance">{patient.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            RM {patient.noRm} · {patient.sex === "P" ? "Perempuan" : "Laki-laki"} · {age(patient.dob, today)}
          </p>
          <p className="text-[13px] text-muted">Lahir {shortDate(patient.dob)}</p>
        </div>
      </div>
      {letters.length === 0 ? (
        <div className="tile bg-card text-sm text-muted">
          <p className="font-bold text-ink">{all ? "Pasien ini belum punya surat di SIMRS." : "Tidak ada surat dalam 30 hari terakhir."}</p>
          <p className="mt-1 text-pretty">Surat kontrol, surat sakit, surat sehat dan surat kematian muncul di sini setelah dibuat di SIMRS.</p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="font-bold">{all ? "Semua surat" : "30 hari terakhir"}</h3>
            <p className="text-[13px] text-muted">Pilih yang dibagikan</p>
          </div>
          <ShareForm
            key={all ? "all" : "recent"}
            noRm={patient.noRm}
            letters={letters.map((l) => ({
              value: `${l.type}|${l.noSurat}|${l.date}`,
              type: l.type,
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
        <Link href={all ? here : `${here}?semua=1`} className="font-semibold text-brand underline-offset-4 hover:underline">
          {all ? "Hanya 30 hari terakhir" : "Tampilkan surat yang lebih lama"}
        </Link>
      </p>
    </>
  );
}

export default function Page({ params, searchParams }: PageProps<"/ruang/pasien/[noRm]">) {
  return (
    <main className="page flex flex-col gap-4">
      <TitleBar href="/ruang" title="Surat pasien" />
      <Suspense
        fallback={
          <>
            <div className="skeleton h-24" />
            <ListSkeleton rows={3} />
          </>
        }
      >
        <Letters params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
