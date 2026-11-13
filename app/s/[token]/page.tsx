import type { Metadata } from "next";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { LETTER_TONES, dayMonth } from "@/lib/format";
import { TITLES, letterSvg, type Letter } from "@/lib/letters";
import { hasOpened } from "@/lib/session";
import { Brand } from "../../brand";
import { IconClock, IconDownload, IconLock } from "../../icons";
import { DobForm, Refresher } from "../../ui";

export const metadata: Metadata = { title: "Surat Anda", referrer: "no-referrer" };

function Closed({ title, children, tone = "bg-stone" }: { title: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className={`tile rise ${tone}`}>
      <span className="grid size-12 place-items-center rounded-full bg-white/80" aria-hidden="true">
        <IconLock className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-ink/75 text-pretty">{children}</p>
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
    return (
      <Closed title="QR ini terkunci" tone="bg-blush">
        Tanggal lahir yang diisi salah 5 kali. Demi keamanan data pasien, QR ini tidak bisa dipakai lagi. Minta QR baru ke perawat.
      </Closed>
    );
  if (state === "pending")
    return (
      <div className="tile flex flex-col items-center gap-4 bg-mint py-10 text-center" role="status">
        <Refresher every={1500} />
        <div className="skeleton h-24 w-full bg-white/70" />
        <p className="font-bold">Surat sedang disiapkan…</p>
      </div>
    );

  if (!(await hasOpened(token)))
    return (
      <>
        <div className="tile rise bg-mint">
          <span className="grid size-12 place-items-center rounded-full bg-white/80" aria-hidden="true">
            <IconLock className="size-5" />
          </span>
          <h1 className="mt-4 text-2xl leading-tight font-extrabold tracking-tight text-balance">Surat dari rumah sakit sudah siap</h1>
          <p className="mt-1.5 text-sm text-ink/75 text-pretty">Untuk menjaga kerahasiaan, isi tanggal lahir pasien yang suratnya akan dibuka.</p>
        </div>
        <div className="card rise p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <DobForm token={token} />
        </div>
      </>
    );

  const [share, hospital] = await Promise.all([convex.query(api.shares.view, { secret, token, now }), convex.query(api.hospital.get, { secret })]);
  if (!share || !hospital) return <Closed title="Surat tidak tersedia">Coba pindai lagi QR dari perawat.</Closed>;
  const sheets = await Promise.all(share.letters.map((letter) => letterSvg(letter as Letter, hospital)));
  return (
    <>
      <section className="tile rise bg-mint">
        <p className="eyebrow">{hospital.name}</p>
        <h1 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight text-balance">{share.patientName}</h1>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p>
            <span className="num text-5xl">{share.letters.length}</span>
            <span className="ml-1.5 font-bold">surat</span>
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1.5 text-[13px] font-semibold">
            <IconClock className="size-4" /> sampai {dayMonth(share.expiresAt)}
          </p>
        </div>
      </section>
      <p className="px-1 text-sm text-muted text-pretty">Unduh PDF agar surat tetap tersimpan di HP setelah tautan ini berakhir.</p>
      {share.letters.map((letter, i) => (
        <article key={`${letter.type}${letter.noSurat}`} className={`tile rise p-2 ${LETTER_TONES[letter.type].tile}`} style={{ "--i": i + 1 } as React.CSSProperties}>
          <header className="flex items-center justify-between gap-3 px-3 pt-2 pb-3">
            <div className="min-w-0">
              <h2 className="font-extrabold tracking-tight">{TITLES[letter.type]}</h2>
              <p className="truncate font-mono text-xs text-ink/60">{letter.noSurat}</p>
            </div>
            <a href={`/s/${token}/pdf/${i + 1}`} download className="btn min-h-11 shrink-0 bg-white px-4 text-sm hover:bg-white/80">
              <IconDownload className="size-4" /> PDF
            </a>
          </header>
          {/* The letter as SIMRS prints it; pinch to zoom. */}
          <div className="overflow-hidden rounded-[1.35rem] bg-white" dangerouslySetInnerHTML={{ __html: sheets[i].svg }} />
        </article>
      ))}
      <p className="text-center text-xs text-muted text-pretty">Keaslian surat bisa diperiksa dengan memindai kode QR yang ada pada surat.</p>
    </>
  );
}

export default function Page({ params }: PageProps<"/s/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-12">
      <Brand />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skeleton h-40" />
            <div className="skeleton h-64" />
          </div>
        }
      >
        <Share params={params} />
      </Suspense>
    </main>
  );
}
