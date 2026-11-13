import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { LETTER_NAMES, dayMonth, shortDate } from "@/lib/format";
import { appUrl, qrSvg } from "@/lib/qr";
import { requireRoom } from "@/lib/session";
import { revokeShare } from "../../../actions";
import { Refresher, Submit } from "../../../ui";
import { requestTime } from "@/lib/clock";

export const metadata: Metadata = { title: "QR untuk pasien" };

async function Share({ params }: Pick<PageProps<"/ruang/bagikan/[id]">, "params">) {
  const account = await requireRoom();
  const { id } = await params;
  const share = await convex.query(api.shares.mine, { secret, accountId: account.id, id });
  const back = (
    <Link href="/ruang" className="btn-quiet w-full">
      Kembali ke daftar pasien
    </Link>
  );

  if (!share || share.status === "revoked")
    return (
      <>
        <p className="note-warn">QR ini sudah dicabut atau tidak ada.</p>
        {back}
      </>
    );
  if (share.status === "failed")
    return (
      <>
        <div role="alert" className="note-danger">
          <p className="font-semibold">Surat tidak bisa disiapkan</p>
          <p className="mt-0.5">{share.error ?? "SIMRS tidak menjawab."} Coba bagikan lagi dari halaman pasien.</p>
        </div>
        <Link href={`/ruang/pasien/${encodeURIComponent(share.noRm)}`} className="btn w-full">
          Coba lagi
        </Link>
        {back}
      </>
    );
  if (share.status === "pending")
    return (
      <div className="card flex flex-col items-center gap-4 p-8 text-center" role="status">
        <Refresher />
        <div className="skeleton size-56" />
        <p className="font-medium">Mengambil surat dari SIMRS…</p>
      </div>
    );
  if (share.expiresAt <= (await requestTime()))
    return (
      <>
        <p className="note-warn">QR ini sudah kedaluwarsa.</p>
        {back}
      </>
    );

  const url = `${await appUrl()}/s/${share.token}`;
  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{share.patientName}</h1>
        <p className="mt-0.5 text-sm text-muted">Minta pasien atau keluarga memindai QR ini dengan kamera HP.</p>
      </div>
      <div className="card flex flex-col items-center gap-4 p-5">
        <div
          role="img"
          aria-label="Kode QR untuk membuka surat"
          className="aspect-square w-full max-w-80 rounded-xl bg-white p-3 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg(url) }}
        />
        <p className="text-center text-sm text-muted">
          Setelah memindai, pasien mengisi <strong className="font-semibold text-ink">tanggal lahir pasien</strong> untuk membuka surat.
        </p>
      </div>
      <div className="card divide-y divide-line">
        {share.items.map((item) => (
          <div key={`${item.type}${item.noSurat}`} className="px-4 py-3">
            <p className="font-medium">{LETTER_NAMES[item.type]}</p>
            <p className="text-sm text-muted">
              {shortDate(item.date)} · <span className="font-mono text-xs">{item.noSurat}</span>
            </p>
          </div>
        ))}
        <p className="px-4 py-3 text-sm text-muted">Berlaku sampai {dayMonth(share.expiresAt)}.</p>
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
      <Suspense
        fallback={
          <div className="card flex flex-col items-center gap-4 p-8" aria-hidden="true">
            <div className="skeleton size-56" />
            <div className="skeleton h-5 w-48" />
          </div>
        }
      >
        <Share params={params} />
      </Suspense>
    </main>
  );
}
