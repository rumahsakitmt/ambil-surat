import type { Metadata } from "next";
import { Suspense } from "react";
import { getHospital } from "@/lib/convex";
import { requireRoom } from "@/lib/session";
import { requestTime } from "@/lib/clock";
import { Avatar } from "../brand";
import { BottomNav } from "../nav";

export const metadata: Metadata = { title: "Ruangan" };

/** "Halo, Poliklinik Obgyn" with the room's avatar, and a dot that says whether SIMRS answers. */
async function Greeting() {
  const account = await requireRoom();
  const [hospital, now] = await Promise.all([getHospital(), requestTime()]);
  const online = !!hospital && now - hospital.seenAt < 90_000;
  return (
    <>
      <Avatar name={account.room.name} className="size-11 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">Halo,</p>
        <p className="truncate font-bold leading-tight">{account.room.name}</p>
      </div>
      <span
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${online ? "bg-mint text-brand-strong" : "bg-danger-soft text-danger"}`}
        title={online ? "SIMRS terhubung" : "SIMRS tidak terhubung"}
      >
        <span className={`size-2 rounded-full ${online ? "bg-leaf" : "bg-danger"}`} aria-hidden="true" />
        {online ? "SIMRS" : "Offline"}
      </span>
    </>
  );
}

export default function Layout({ children }: LayoutProps<"/ruang">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Suspense
          fallback={
            <>
              <span className="skeleton size-11 rounded-full" />
              <span className="skeleton h-9 flex-1" />
            </>
          }
        >
          <Greeting />
        </Suspense>
      </header>
      {children}
      <BottomNav
        label="Menu ruangan"
        items={[
          { href: "/ruang", label: "Pasien", icon: "users" },
          { href: "/ruang/dibagikan", label: "Dibagikan", icon: "qr" },
        ]}
      />
    </>
  );
}
