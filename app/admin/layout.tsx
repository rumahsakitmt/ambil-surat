import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "../actions";
import { Mark } from "../brand";

export const metadata: Metadata = { title: "Admin" };

export default function Layout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-2.5">
          <Mark />
          <div className="min-w-0 flex-1">
            <span className="block font-semibold leading-tight">Admin</span>
            <span className="block text-xs text-muted">Ambil Surat</span>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn-quiet min-h-10 px-3">
              Keluar
            </button>
          </form>
        </div>
        <nav className="mx-auto flex w-full max-w-xl gap-1 px-3 pb-2 text-sm font-medium" aria-label="Menu admin">
          <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-paper">
            Akun ruangan
          </Link>
          <Link href="/admin/log" className="rounded-lg px-3 py-2 hover:bg-paper">
            Riwayat berbagi
          </Link>
        </nav>
      </header>
      {children}
    </>
  );
}
