import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRoom } from "@/lib/session";
import { signOut } from "../actions";
import { Mark } from "../brand";

export const metadata: Metadata = { title: "Ruangan" };

async function RoomName() {
  const account = await requireRoom();
  return (
    <>
      <span className="block truncate font-semibold leading-tight">{account.room.name}</span>
      <span className="block text-xs text-muted">{account.room.kind === "poli" ? "Poliklinik" : "Rawat inap"}</span>
    </>
  );
}

export default function Layout({ children }: LayoutProps<"/ruang">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-2.5">
          <Link href="/ruang" aria-label="Daftar pasien" className="shrink-0">
            <Mark />
          </Link>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<span className="skeleton block h-9 w-40" />}>
              <RoomName />
            </Suspense>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn-quiet min-h-10 px-3">
              Keluar
            </button>
          </form>
        </div>
        <nav className="mx-auto flex w-full max-w-xl gap-1 px-3 pb-2 text-sm font-medium" aria-label="Menu ruangan">
          <Link href="/ruang" className="rounded-lg px-3 py-2 hover:bg-paper">
            Pasien
          </Link>
          <Link href="/ruang/dibagikan" className="rounded-lg px-3 py-2 hover:bg-paper">
            Sudah dibagikan
          </Link>
        </nav>
      </header>
      {children}
    </>
  );
}
