import Link from "next/link";
import { Suspense } from "react";
import { api, ask, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { requireRoom } from "@/lib/session";
import { IconSearch } from "../icons";
import { ListSkeleton, PatientList, Unreachable } from "./parts";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.HOSPITAL_TIME_ZONE || "Asia/Makassar" }).format(new Date());

type Search = { searchParams: Promise<{ q?: string | string[] }> };
const queryOf = async (searchParams: Search["searchParams"]) => {
  const raw = (await searchParams).q;
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
};

/** Two tiles with big numbers: who is here today, and the QR codes still open. */
function Stats({ patients, poli, shared }: { patients: number; poli: boolean; shared: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="tile rise flex min-h-36 flex-col justify-between bg-mint">
        <p className="eyebrow">{poli ? "Pasien hari ini" : "Pasien dirawat"}</p>
        <p className="num text-5xl">{patients}</p>
      </div>
      <Link href="/ruang/dibagikan" className="tile rise flex min-h-36 flex-col justify-between bg-sky transition-transform duration-150 active:scale-[0.98]" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="eyebrow">QR masih berlaku</p>
        <p className="num text-5xl">{shared}</p>
      </Link>
    </div>
  );
}

async function Patients({ searchParams }: Search) {
  const account = await requireRoom();
  const q = await queryOf(searchParams);
  const today = todayIso();

  if (q) {
    if (q.length < 3) return <p className="note-warn">Ketik minimal 3 huruf nama, atau nomor RM atau no. rawat lengkap.</p>;
    const found = await ask("search", { q });
    if (!found.ok) return <Unreachable offline={found.offline} />;
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="font-bold">{found.data.length ? `${found.data.length}${found.data.length === 30 ? "+" : ""} pasien cocok` : "Tidak ada yang cocok"}</h2>
          <Link href="/ruang" className="text-sm font-semibold text-brand">
            Hapus pencarian
          </Link>
        </div>
        {found.data.length > 0 ? (
          <PatientList patients={found.data} today={today} />
        ) : (
          <p className="tile bg-card text-sm text-muted">Tidak ada pasien dengan nama, nomor RM atau no. rawat “{q}”.</p>
        )}
        {found.data.length === 30 && <p className="px-1 text-sm text-muted">Hanya 30 pertama yang ditampilkan. Ketik nama lebih lengkap.</p>}
      </section>
    );
  }

  const [list, now] = await Promise.all([ask("patients", { room: { kind: account.room.kind, code: account.room.code } }), requestTime()]);
  const shared = await convex.query(api.shares.active, { secret, accountId: account.id, now });
  const poli = account.room.kind === "poli";
  if (!list.ok) return <Unreachable offline={list.offline} />;
  return (
    <>
      <Stats patients={list.data.length} poli={poli} shared={shared.length} />
      <section className="flex flex-col gap-3">
        <h2 className="px-1 font-bold">{poli ? "Terdaftar hari ini" : "Di bangsal ini"}</h2>
        {list.data.length ? (
          <PatientList patients={list.data} today={today} />
        ) : (
          <p className="tile bg-card text-sm text-muted text-pretty">
            {poli ? "Belum ada pasien terdaftar di poli ini hari ini." : "Tidak ada pasien yang sedang dirawat di bangsal ini."} Cari pasien lain dengan nama, nomor RM atau no. rawat.
          </p>
        )}
      </section>
    </>
  );
}

function SearchForm({ q }: { q: string }) {
  return (
    <form action="/ruang" role="search" className="relative">
      <IconSearch className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        defaultValue={q}
        className="field pl-12"
        placeholder="Nama, no. RM atau no. rawat"
        aria-label="Cari pasien dengan nama, nomor RM atau no. rawat"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />
    </form>
  );
}

async function SearchBox({ searchParams }: Search) {
  return <SearchForm q={await queryOf(searchParams)} />;
}

export default function Page({ searchParams }: PageProps<"/ruang">) {
  return (
    <main className="page flex flex-col gap-5">
      <h1 className="mt-2 text-[1.7rem] leading-tight font-extrabold tracking-tight text-balance">Siapa yang perlu suratnya hari ini?</h1>
      <Suspense fallback={<SearchForm q="" />}>
        <SearchBox searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="skeleton h-36" />
              <div className="skeleton h-36" />
            </div>
            <ListSkeleton />
          </>
        }
      >
        <Patients searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
