import Link from "next/link";
import { Suspense } from "react";
import { api, ask, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { dateTime, dayKey } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { Avatar } from "../brand";
import { AccountsTable, ActionTag, NewRoomDialog } from "./parts";

function Stat({ label, value, note, tone, alert }: { label: string; value: React.ReactNode; note: string; tone: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-line" role={alert ? "alert" : undefined}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <span className={`size-2.5 rounded-full ${tone}`} aria-hidden="true" />
        {label}
      </p>
      <p className="num text-3xl leading-none">{value}</p>
      <p className="text-[13px] text-muted text-pretty">{note}</p>
    </div>
  );
}

async function NewRoom() {
  await requireAdmin();
  const rooms = await ask("rooms", {});
  return rooms.ok ? <NewRoomDialog rooms={rooms.data} /> : <NewRoomDialog rooms={null} offline={rooms.offline} />;
}

async function Dashboard() {
  const admin = await requireAdmin();
  const [hospital, accounts, log, now] = await Promise.all([
    convex.query(api.hospital.get, { secret }),
    convex.query(api.accounts.list, { secret }),
    convex.query(api.hospital.log, { secret }),
    requestTime(),
  ]);
  const alive = !!hospital && now - hospital.seenAt < 90_000;
  const rooms = accounts.filter((a) => a.role === "room");
  const poli = rooms.filter((a) => a.room?.kind === "poli").length;
  const today = log.filter((row) => dayKey(row.at) === dayKey(now));
  const shared = today.filter((row) => row.action === "bagikan");
  const revoked = today.length - shared.length;
  const letters = shared.reduce((sum, row) => sum + row.letters.length, 0);
  // The log names the room, not the account; a room has one account.
  const sharedBy = (name: string) => log.filter((row) => row.roomName === name && row.action === "bagikan");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          alert={!alive}
          tone={alive ? "bg-leaf" : "bg-danger"}
          label="SIMRS"
          value={<span className={`text-2xl ${alive ? "" : "text-danger"}`}>{alive ? "Terhubung" : "Terputus"}</span>}
          note={alive ? hospital.name : hospital ? `Terakhir ${dateTime(hospital.seenAt)}` : "Jembatan belum pernah tersambung"}
        />
        <Stat tone="bg-sky-deep" label="Akun ruangan" value={rooms.length} note={`${poli} poliklinik · ${rooms.length - poli} rawat inap`} />
        <Stat tone="bg-mint-deep" label="Dibagikan hari ini" value={shared.length} note={shared.length ? `${letters} surat ke ${shared.length} pasien` : "Belum ada QR dibuat hari ini"} />
        <Stat tone="bg-blush-deep" label="Dicabut hari ini" value={revoked} note={revoked ? "QR yang ditarik kembali oleh ruangan" : "Tidak ada QR yang dicabut"} />
      </div>
      {!alive && (
        <p className="note-danger" role="status">
          Ruangan tidak bisa mencari pasien sampai jembatan di rumah sakit berjalan lagi (lihat bridge/README.md).
        </p>
      )}
      <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AccountsTable
          accounts={accounts.map((account) => {
            const mine = account.role === "room" ? sharedBy(account.name) : [];
            return {
              id: account.id,
              username: account.username,
              name: account.role === "admin" ? "Admin" : account.name,
              admin: account.role === "admin",
              own: account.id === admin.id,
              kind: account.room?.kind ?? null,
              lastAt: mine[0] ? dateTime(mine[0].at) : null,
              shared: mine.length,
            };
          })}
          add={
            <Suspense fallback={<div className="skeleton h-9 w-36 rounded-[0.625rem]" />}>
              <NewRoom />
            </Suspense>
          }
        />
        <section className="rounded-2xl bg-card ring-1 ring-line" aria-labelledby="recent-title">
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <h2 id="recent-title" className="text-base font-extrabold tracking-tight">
              Aktivitas terbaru
            </h2>
            <Link href="/admin/log" className="text-[13px] font-semibold text-brand underline-offset-4 hover:underline">
              Lihat semua
            </Link>
          </div>
          {log.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">Belum ada surat yang dibagikan.</p>
          ) : (
            <ul>
              {log.slice(0, 7).map((row) => (
                <li key={row.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <Avatar name={row.patientName} className="size-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{row.patientName}</p>
                    <p className="truncate text-[13px] text-muted">
                      {row.roomName} · {dateTime(row.at)}
                    </p>
                  </div>
                  <ActionTag action={row.action} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight">Ringkasan</h1>
        <p className="mt-1 text-sm text-muted">Keadaan SIMRS, akun tiap ruangan, dan apa yang dibagikan hari ini.</p>
      </div>
      <Suspense
        fallback={
          <div aria-hidden="true" className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
            <div className="skeleton h-96 rounded-2xl" />
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}
