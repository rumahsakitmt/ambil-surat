import { Suspense } from "react";
import { api, ask, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { removeRoom } from "../actions";
import { Avatar } from "../brand";
import { IconPlus } from "../icons";
import { PasswordForm, RoomForm, Submit } from "../ui";
import { ListSkeleton, Unreachable } from "../ruang/parts";

/** Two tiles: whether the bridge answers, and how many rooms can sign in. */
async function Overview() {
  await requireAdmin();
  const [hospital, accounts, now] = await Promise.all([convex.query(api.hospital.get, { secret }), convex.query(api.accounts.list, { secret }), requestTime()]);
  const alive = !!hospital && now - hospital.seenAt < 90_000;
  const rooms = accounts.filter((a) => a.role === "room").length;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={`tile rise flex min-h-36 flex-col justify-between ${alive ? "bg-mint" : "bg-blush"}`} role={alive ? undefined : "alert"}>
        <p className="eyebrow flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${alive ? "bg-leaf" : "bg-danger"}`} aria-hidden="true" /> SIMRS
        </p>
        <div>
          <p className="text-2xl font-extrabold tracking-tight">{alive ? "Terhubung" : "Terputus"}</p>
          <p className="mt-0.5 text-[13px] text-ink/70 text-pretty">
            {alive ? hospital.name : hospital ? `Terakhir ${dateTime(hospital.seenAt)}` : "Jembatan belum pernah tersambung"}
          </p>
        </div>
      </div>
      <div className="tile rise flex min-h-36 flex-col justify-between bg-sky" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="eyebrow">Akun ruangan</p>
        <p className="num text-5xl">{rooms}</p>
      </div>
      {!alive && <p className="col-span-2 px-1 text-sm text-muted text-pretty">Ruangan tidak bisa mencari pasien sampai jembatan di rumah sakit berjalan lagi (lihat bridge/README.md).</p>}
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
    <ul className="flex flex-col gap-3">
      {accounts.map((account, i) => (
        <li key={account.id} className="card rise flex flex-col gap-3 p-4" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <Avatar name={account.role === "admin" ? "Admin" : account.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{account.role === "admin" ? "Admin" : account.name}</p>
              <p className="truncate text-[13px] text-muted">
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
    <main className="page flex flex-col gap-5">
      <h1 className="mt-2 text-[1.7rem] leading-tight font-extrabold tracking-tight text-balance">Akun dan ruangan</h1>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-36" />
            <div className="skeleton h-36" />
          </div>
        }
      >
        <Overview />
      </Suspense>
      <section className="flex flex-col gap-3">
        <div className="px-1">
          <h2 className="font-bold">Akun</h2>
          <p className="text-[13px] text-muted text-pretty">Satu akun dipakai bersama perawat di ruangan itu. Menghapus akun juga mencabut semua QR yang dibagikannya.</p>
        </div>
        <Suspense fallback={<ListSkeleton rows={2} />}>
          <Accounts />
        </Suspense>
      </section>
      <section className="tile flex flex-col gap-4 bg-butter">
        <h2 className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
          <span className="grid size-10 place-items-center rounded-full bg-white/80" aria-hidden="true">
            <IconPlus className="size-5" />
          </span>
          Tambah akun ruangan
        </h2>
        <div className="card p-4">
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <NewRoom />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
