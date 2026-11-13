import Link from "next/link";
import type { Patient } from "@/lib/convex";
import { age, shortDate } from "@/lib/format";

/** Shown when the bridge at the hospital didn't answer. */
export function Unreachable({ offline }: { offline: boolean }) {
  return (
    <div role="alert" className="note-warn">
      <p className="font-semibold">{offline ? "SIMRS tidak terhubung" : "SIMRS tidak bisa menjawab"}</p>
      <p className="mt-0.5">
        {offline ? "Jembatan ke SIMRS di rumah sakit tidak menjawab. Periksa internet rumah sakit, lalu coba lagi." : "Terjadi kesalahan saat membaca SIMRS. Coba lagi sebentar lagi."}
      </p>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-[4.5rem]" />
      ))}
    </div>
  );
}

export function PatientList({ patients, today }: { patients: Patient[]; today: string }) {
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {patients.map((p) => (
        <li key={p.noRm}>
          <Link href={`/ruang/pasien/${encodeURIComponent(p.noRm)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper active:bg-paper">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block truncate text-sm text-muted">
                RM {p.noRm} · {p.sex === "P" ? "Perempuan" : "Laki-laki"} · {age(p.dob, today)} ({shortDate(p.dob)})
              </span>
              {p.info && <span className="block truncate text-sm text-muted">{p.info}</span>}
            </span>
            <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-muted" aria-hidden="true">
              <path d="m7.5 4.5 5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
