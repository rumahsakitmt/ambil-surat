import { Suspense } from "react";
import { api, ask, convex, secret } from "@/lib/convex";
import { dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { removeRoom } from "../actions";
import { PasswordForm, RoomForm, Submit } from "../ui";
import { ListSkeleton, Unreachable } from "../ruang/parts";
import { requestTime } from "@/lib/clock";

async function Bridge() {
  await requireAdmin();
  const hospital = await convex.query(api.hospital.get, { secret });
  const now = await requestTime();
  const alive = hospital && now - hospital.seenAt < 90_000;
  if (alive)
    return (
      <p className="note-ok">
        <span className="font-semibold">SIMRS terhubung.</span> {hospital.name}
      </p>
    );
  return (
    <div role="alert" className="note-warn">
      <p className="font-semibold">SIMRS tidak terhubung</p>
      <p className="mt-0.5">
        {hospital ? `Jembatan terakhir terdengar ${dateTime(hospital.seenAt)}.` : "Jembatan di rumah sakit belum pernah tersambung."} Ruangan tidak bisa mencari pasien sampai jembatan berjalan lagi (lihat bridge/README.md).
      </p>
    </div>
  );
}

async function NewRoom() {
  await requireAdmin();
  const rooms = await ask("rooms", {});
  if (!rooms.ok) return <Unreachable offline={rooms.offline} />;
  return <RoomForm poli={rooms.data.poli} bangsal={rooms.data.bangsal} />;
}

async function Accounts() {
  const admin = await requireAdmin();
  const accounts = await convex.query(api.accounts.list, { secret });
  return (
    <ul className="flex flex-col gap-2">
      {accounts.map((account) => (
        <li key={account.id} className="card flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{account.role === "admin" ? "Admin" : account.name}</p>
              <p className="text-sm text-muted">
                <span className="font-mono">{account.username}</span>
                {account.room && ` · ${account.room.kind === "poli" ? "Poliklinik" : "Rawat inap"}`}
              </p>
            </div>
            {account.role === "room" && (
              <form action={removeRoom}>
                <input type="hidden" name="id" value={account.id} />
                <Submit className="btn-danger min-h-10 px-3" busy="…">
                  Hapus
                </Submit>
              </form>
            )}
          </div>
          <PasswordForm id={account.id} own={account.id === admin.id} />
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <main className="page flex flex-col gap-6">
      <Suspense fallback={<div className="skeleton h-12" />}>
        <Bridge />
      </Suspense>
      <section className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Akun ruangan</h1>
          <p className="mt-0.5 text-sm text-muted">Satu akun dipakai bersama oleh perawat di ruangan itu. Menghapus akun juga mencabut semua QR yang dibagikannya.</p>
        </div>
        <Suspense fallback={<ListSkeleton rows={2} />}>
          <Accounts />
        </Suspense>
      </section>
      <section className="card flex flex-col gap-4 p-4">
        <h2 className="text-lg font-semibold">Tambah akun ruangan</h2>
        <Suspense fallback={<ListSkeleton rows={3} />}>
          <NewRoom />
        </Suspense>
      </section>
    </main>
  );
}
