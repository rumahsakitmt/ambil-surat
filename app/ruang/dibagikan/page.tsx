import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { LETTER_NAMES, dateTime, dayMonth } from "@/lib/format";
import { requireRoom } from "@/lib/session";
import { revokeShare } from "../../actions";
import { Submit } from "../../ui";
import { ListSkeleton } from "../parts";
import { requestTime } from "@/lib/clock";

export const metadata: Metadata = { title: "Sudah dibagikan" };

async function Shares() {
  const account = await requireRoom();
  const shares = await convex.query(api.shares.active, { secret, accountId: account.id, now: await requestTime() });
  if (shares.length === 0) return <p className="card p-4 text-sm text-muted">Belum ada surat yang dibagikan dari ruangan ini, atau semuanya sudah kedaluwarsa.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {shares.map((share) => (
        <li key={share.id} className="card p-4">
          <p className="font-semibold">{share.patientName}</p>
          <p className="text-sm text-muted">
            RM {share.noRm} · dibagikan {dateTime(share.createdAt)}
          </p>
          <p className="mt-1 text-sm">{share.items.map((item) => LETTER_NAMES[item.type]).join(", ")}</p>
          <p className="text-sm text-muted">Berlaku sampai {dayMonth(share.expiresAt)}</p>
          {share.locked && <p className="note-danger mt-2">Terkunci: tanggal lahir salah 5 kali.</p>}
          <div className="mt-3 flex gap-2">
            <Link href={`/ruang/bagikan/${share.id}`} className="btn-quiet flex-1">
              Tampilkan QR
            </Link>
            <form action={revokeShare} className="flex-1">
              <input type="hidden" name="id" value={share.id} />
              <Submit className="btn-danger w-full" busy="Mencabut…">
                Cabut
              </Submit>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <main className="page flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sudah dibagikan</h1>
        <p className="mt-0.5 text-sm text-muted">QR yang masih berlaku dari ruangan ini. Surat terhapus otomatis setelah 7 hari.</p>
      </div>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Shares />
      </Suspense>
    </main>
  );
}
