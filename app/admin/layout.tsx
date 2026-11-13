import type { Metadata } from "next";
import { Mark } from "../brand";
import { BottomNav } from "../nav";

export const metadata: Metadata = { title: "Admin" };

export default function Layout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Mark className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">Halo,</p>
          <p className="font-bold leading-tight">Admin</p>
        </div>
      </header>
      {children}
      <BottomNav
        label="Menu admin"
        items={[
          { href: "/admin", label: "Akun", icon: "users" },
          { href: "/admin/log", label: "Riwayat", icon: "list" },
        ]}
      />
    </>
  );
}
