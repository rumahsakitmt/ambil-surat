import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { LETTER_TONES, dateTime, dayMonth } from "@/lib/format";
import { requireRoom } from "@/lib/session";
import { revokeShare } from "../../actions";
import { Avatar, LetterTag } from "../../brand";
import { IconQr } from "../../icons";
import { Submit } from "../../ui";
import { ListSkeleton } from "../parts";

export const metadata: Metadata = { title: "Sudah dibagikan" };

async function Shares() {
  const account = await requireRoom();
  const shares = await convex.query(api.shares.active, { secret, accountId: account.id, now: await requestTime() });
  return (
    <>
      <div className="tile rise flex items-end justify-between bg-sky">
        <div>
          <p className="eyebrow">QR masih berlaku</p>
          <p className="num mt-2 text-5xl">{shares.length}</p>
        </div>
        <p className="max-w-40 text-right text-[13px] text-ink/70 text-pretty">Surat terhapus otomatis setelah 7 hari.</p>
      </div>
      {shares.length === 0 ? (
        <p className="tile bg-card text-sm text-muted">Belum ada surat yang dibagikan dari ruangan ini, atau semuanya sudah kedaluwarsa.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shares.map((share, i) => (
            <li key={share.id} className="card rise flex flex-col gap-3 p-4" style={{ "--i": Math.min(i + 1, 8) } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <Avatar name={share.patientName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{share.patientName}</p>
                  <p className="truncate text-[13px] text-muted">
                    RM {share.noRm} · {dateTime(share.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {share.items.map((item) => (
                  <LetterTag key={`${item.type}${item.noSurat}`} type={item.type}>
                    {LETTER_TONES[item.type].short}
                  </LetterTag>
                ))}
              </div>
              <p className="text-[13px] text-muted">Berlaku sampai {dayMonth(share.expiresAt)}</p>
              {share.locked && <p className="note-danger">Terkunci: tanggal lahir salah 5 kali.</p>}
              <div className="flex gap-2">
                <Link href={`/ruang/bagikan/${share.id}`} className="btn min-h-11 flex-1 text-sm">
                  <IconQr className="size-4" /> Tampilkan QR
                </Link>
                <form action={revokeShare}>
                  <input type="hidden" name="id" value={share.id} />
                  <Submit className="btn-danger" busy="…">
                    Cabut
                  </Submit>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return (
    <main className="page flex flex-col gap-4">
      <h1 className="mt-2 text-[1.7rem] leading-tight font-extrabold tracking-tight">Sudah dibagikan</h1>
      <Suspense
        fallback={
          <>
            <div className="skeleton h-32" />
            <ListSkeleton rows={3} />
          </>
        }
      >
        <Shares />
      </Suspense>
    </main>
  );
}
