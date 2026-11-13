import { Suspense } from "react";
import { ask } from "@/lib/convex";
import { requireRoom } from "@/lib/session";
import { ListSkeleton, PatientList, Unreachable } from "./parts";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.HOSPITAL_TIME_ZONE || "Asia/Makassar" }).format(new Date());

async function Patients({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const account = await requireRoom();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const today = todayIso();

  if (q) {
    if (q.length < 3) return <p className="note-warn">Ketik minimal 3 huruf nama, atau nomor RM lengkap.</p>;
    const found = await ask("search", { q });
    if (!found.ok) return <Unreachable offline={found.offline} />;
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {found.data.length ? `${found.data.length}${found.data.length === 30 ? "+" : ""} pasien cocok dengan “${q}”` : `Tidak ada pasien yang cocok dengan “${q}”`}
        </h2>
        {found.data.length > 0 && <PatientList patients={found.data} today={today} />}
        {found.data.length === 30 && <p className="text-sm text-muted">Hanya 30 pertama yang ditampilkan. Ketik nama lebih lengkap.</p>}
      </section>
    );
  }

  const list = await ask("patients", { room: { kind: account.room.kind, code: account.room.code } });
  if (!list.ok) return <Unreachable offline={list.offline} />;
  const poli = account.room.kind === "poli";
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">
        {poli ? "Pasien hari ini" : "Pasien dirawat"} · {list.data.length}
      </h2>
      {list.data.length ? (
        <PatientList patients={list.data} today={today} />
      ) : (
        <p className="card p-4 text-sm text-muted">
          {poli ? "Belum ada pasien terdaftar di poli ini hari ini." : "Tidak ada pasien yang sedang dirawat di bangsal ini."} Cari pasien lain dengan nama atau nomor RM di atas.
        </p>
      )}
    </section>
  );
}

async function SearchBox({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return <SearchForm q={q} />;
}

function SearchForm({ q }: { q: string }) {
  return (
    <form action="/ruang" className="flex gap-2" role="search">
      <input
        type="search"
        name="q"
        defaultValue={q}
        className="field"
        placeholder="Cari nama atau nomor RM"
        aria-label="Cari pasien dengan nama atau nomor RM"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      <button type="submit" className="btn shrink-0 px-4">
        Cari
      </button>
    </form>
  );
}

export default function Page({ searchParams }: PageProps<"/ruang">) {
  return (
    <main className="page flex flex-col gap-4">
      <Suspense fallback={<SearchForm q="" />}>
        <SearchBox searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <Patients searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
