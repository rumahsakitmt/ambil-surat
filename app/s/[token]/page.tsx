import type { Metadata } from "next";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { dayMonth } from "@/lib/format";
import { TITLES, letterSvg, type Letter } from "@/lib/letters";
import { hasOpened } from "@/lib/session";
import { Brand } from "../../brand";
import { DobForm, Refresher } from "../../ui";
import { requestTime } from "@/lib/clock";

export const metadata: Metadata = { title: "Surat Anda", referrer: "no-referrer" };

function Closed({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted text-pretty">{children}</p>
    </div>
  );
}

async function Share({ params }: Pick<PageProps<"/s/[token]">, "params">) {
  const { token } = await params;
  // Whether a QR still works depends on the moment it is opened.
  const now = await requestTime();
  const { state } = await convex.query(api.shares.peek, { secret, token, now });

  if (state === "gone")
    return <Closed title="QR ini sudah tidak berlaku">Surat hanya bisa dibuka selama 7 hari, atau QR ini sudah dicabut. Minta QR baru ke perawat di ruangan Anda berobat.</Closed>;
  if (state === "locked")
    return <Closed title="QR ini terkunci">Tanggal lahir yang diisi salah 5 kali. Demi keamanan data pasien, QR ini tidak bisa dipakai lagi. Minta QR baru ke perawat.</Closed>;
  if (state === "pending")
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center" role="status">
        <Refresher every={1500} />
        <div className="skeleton h-24 w-full" />
        <p className="font-medium">Surat sedang disiapkan…</p>
      </div>
    );

  if (!(await hasOpened(token)))
    return (
      <>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Buka surat dari rumah sakit</h1>
          <p className="mt-1.5 text-sm text-muted text-pretty">Untuk menjaga kerahasiaan, isi tanggal lahir pasien yang suratnya akan dibuka.</p>
        </div>
        <div className="card p-5">
          <DobForm token={token} />
        </div>
      </>
    );

  const [share, hospital] = await Promise.all([convex.query(api.shares.view, { secret, token, now }), convex.query(api.hospital.get, { secret })]);
  if (!share || !hospital) return <Closed title="Surat tidak tersedia">Coba pindai lagi QR dari perawat.</Closed>;
  const sheets = await Promise.all(share.letters.map((letter) => letterSvg(letter as Letter, hospital)));
  return (
    <>
      <div>
        <p className="text-sm text-muted">{hospital.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{share.patientName}</h1>
        <p className="mt-1 text-sm text-muted">
          {share.letters.length} surat · bisa dibuka sampai {dayMonth(share.expiresAt)}. Unduh agar tersimpan di HP.
        </p>
      </div>
      {share.letters.map((letter, i) => (
        <article key={`${letter.type}${letter.noSurat}`} className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-semibold">{TITLES[letter.type]}</h2>
              <p className="truncate font-mono text-xs text-muted">{letter.noSurat}</p>
            </div>
            <a href={`/s/${token}/pdf/${i + 1}`} download className="btn min-h-11 shrink-0 px-4 text-sm">
              Unduh PDF
            </a>
          </header>
          {/* The letter as SIMRS prints it; pinch to zoom. */}
          <div className="border-t border-line bg-white" dangerouslySetInnerHTML={{ __html: sheets[i].svg }} />
        </article>
      ))}
      <p className="text-center text-xs text-muted text-pretty">Keaslian surat bisa diperiksa dengan memindai kode QR yang ada pada surat.</p>
    </>
  );
}

export default function Page({ params }: PageProps<"/s/[token]">) {
  return (
    <main className="page flex flex-1 flex-col gap-4">
      <Brand />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skeleton h-16 w-3/4" />
            <div className="skeleton h-64" />
          </div>
        }
      >
        <Share params={params} />
      </Suspense>
    </main>
  );
}
