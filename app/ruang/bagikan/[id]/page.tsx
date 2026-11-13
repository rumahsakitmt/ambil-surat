import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { LETTER_TONES, dayMonth, shortDate } from "@/lib/format";
import { appUrl, qrSvg } from "@/lib/qr";
import { requireRoom } from "@/lib/session";
import { revokeShare } from "../../../actions";
import { LetterTag } from "../../../brand";
import { IconClock } from "../../../icons";
import { Refresher, Submit } from "../../../ui";
import { TitleBar } from "../../parts";

export const metadata: Metadata = { title: "QR untuk pasien" };

async function Share({ params }: Pick<PageProps<"/ruang/bagikan/[id]">, "params">) {
  const account = await requireRoom();
  const { id } = await params;
  const share = await convex.query(api.shares.mine, { secret, accountId: account.id, id });
  const back = (
    <Link href="/ruang" className="btn-quiet min-h-14 w-full">
      Kembali ke daftar pasien
    </Link>
  );

  if (!share || share.status === "revoked")
    return (
      <>
        <p className="tile bg-stone text-sm">QR ini sudah dicabut atau tidak ada.</p>
        {back}
      </>
    );
  if (share.status === "failed")
    return (
      <>
        <div role="alert" className="tile bg-blush">
          <p className="font-bold">Surat tidak bisa disiapkan</p>
          <p className="mt-1 text-sm text-ink/75">{share.error ?? "SIMRS tidak menjawab."} Coba bagikan lagi dari halaman pasien.</p>
        </div>
        <Link href={`/ruang/pasien/${encodeURIComponent(share.noRm)}`} className="btn w-full">
          Coba lagi
        </Link>
        {back}
      </>
    );
  if (share.status === "pending")
    return (
      <div className="tile flex flex-col items-center gap-5 bg-mint py-10 text-center" role="status">
        <Refresher />
        <div className="skeleton size-56 bg-white/70" />
        <p className="font-bold">Mengambil surat dari SIMRS…</p>
      </div>
    );
  if (share.expiresAt <= (await requestTime()))
    return (
      <>
        <p className="tile bg-stone text-sm">QR ini sudah kedaluwarsa.</p>
        {back}
      </>
    );

  const url = `${await appUrl()}/s/${share.token}`;
  return (
    <>
      {/* The QR sits on a white plate inside a mint tile, the one thing on screen for the patient to look at. */}
      <section className="tile rise flex flex-col items-center gap-4 bg-mint px-5 pt-6 pb-5 text-center">
        <div>
          <p className="eyebrow">Untuk</p>
          <h2 className="text-2xl leading-tight font-extrabold tracking-tight text-balance">{share.patientName}</h2>
        </div>
        <div
          role="img"
          aria-label="Kode QR untuk membuka surat"
          className="aspect-square w-full max-w-72 rounded-[1.5rem] bg-white p-5 shadow-[0_14px_30px_-18px_rgb(29_35_31/0.5)] [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg(url) }}
        />
        <p className="text-sm text-ink/75 text-pretty">
          Pindai dengan kamera HP, lalu isi <strong className="font-bold text-ink">tanggal lahir pasien</strong>.
        </p>
      </section>

      <div className="card rise flex flex-col gap-3 p-4" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="flex flex-wrap gap-2">
          {share.items.map((item) => (
            <LetterTag key={`${item.type}${item.noSurat}`} type={item.type}>
              {LETTER_TONES[item.type].short} · {shortDate(item.date)}
            </LetterTag>
          ))}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <IconClock className="size-4" /> Berlaku sampai {dayMonth(share.expiresAt)}
        </p>
      </div>

      {share.attempts >= 5 && <p className="note-danger">QR ini terkunci karena tanggal lahir salah 5 kali. Cabut, lalu bagikan lagi.</p>}
      <Link href="/ruang" className="btn w-full">
        Selesai
      </Link>
      <form action={revokeShare}>
        <input type="hidden" name="id" value={share.id} />
        <Submit className="btn-danger w-full" busy="Mencabut…">
          Cabut QR ini
        </Submit>
      </form>
    </>
  );
}

export default function Page({ params }: PageProps<"/ruang/bagikan/[id]">) {
  return (
    <main className="page flex flex-col gap-4">
      <TitleBar href="/ruang" title="Tunjukkan ke pasien" />
      <Suspense
        fallback={
          <div className="tile flex flex-col items-center gap-4 bg-mint py-10" aria-hidden="true">
            <div className="skeleton size-56 bg-white/70" />
          </div>
        }
      >
        <Share params={params} />
      </Suspense>
    </main>
  );
}
