import Link from "next/link";
import type { Patient } from "@/lib/convex";
import { age, shortDate } from "@/lib/format";
import { Avatar } from "../brand";
import { IconBack, IconChevron } from "../icons";

/** Shown when the bridge at the hospital didn't answer. */
export function Unreachable({ offline }: { offline: boolean }) {
  return (
    <div role="alert" className="tile bg-blush">
      <p className="font-bold">{offline ? "SIMRS tidak terhubung" : "SIMRS tidak bisa menjawab"}</p>
      <p className="mt-1 text-sm text-ink/75 text-pretty">
        {offline ? "Jembatan ke SIMRS di rumah sakit tidak menjawab. Periksa internet rumah sakit, lalu coba lagi." : "Terjadi kesalahan saat membaca SIMRS. Coba lagi sebentar lagi."}
      </p>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-[4.75rem]" />
      ))}
    </div>
  );
}

/** A round back button and a page title, as the reference's inner screens have. */
export function TitleBar({ href, title }: { href: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={href} className="icon-btn" aria-label="Kembali">
        <IconBack />
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
    </div>
  );
}

export function PatientList({ patients, today }: { patients: Patient[]; today: string }) {
  return (
    <ul className="card flex flex-col p-1.5">
      {patients.map((p, i) => (
        <li key={p.noRm} className="rise" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
          <Link
            href={`/ruang/pasien/${encodeURIComponent(p.noRm)}`}
            className="flex items-center gap-3 rounded-[1.4rem] px-3 py-3 transition-colors duration-150 hover:bg-paper active:bg-paper"
          >
            <Avatar name={p.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{p.name}</span>
              <span className="block truncate text-[13px] text-muted">
                RM {p.noRm} · {p.sex === "P" ? "Perempuan" : "Laki-laki"} · {age(p.dob, today)} · {shortDate(p.dob)}
              </span>
              {p.info && <span className="block truncate text-[13px] text-muted">{p.info}</span>}
            </span>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-muted" aria-hidden="true">
              <IconChevron className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
