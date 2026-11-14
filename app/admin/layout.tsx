import { Button } from "@ui-sdk/react/button";
import type { Metadata } from "next";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { requestTime } from "@/lib/clock";
import { requireAdmin } from "@/lib/session";
import { signOut } from "../actions";
import { Mark } from "../brand";
import { IconLogout } from "../icons";
import { AdminNav } from "./parts";

export const metadata: Metadata = { title: "Admin" };

/** Whether the bridge at the hospital answers, always in view at the foot of the sidebar. */
async function Bridge() {
  await requireAdmin();
  const [hospital, now] = await Promise.all([convex.query(api.hospital.get, { secret }), requestTime()]);
  const alive = !!hospital && now - hospital.seenAt < 90_000;
  return (
    <p className={`flex items-center gap-2 rounded-[0.625rem] px-3 py-2 text-[13px] font-semibold ${alive ? "bg-mint text-brand-strong" : "bg-danger-soft text-danger"}`}>
      <span className={`size-2 shrink-0 rounded-full ${alive ? "bg-brand" : "bg-danger"}`} aria-hidden="true" />
      {alive ? "SIMRS terhubung" : "SIMRS terputus"}
    </p>
  );
}

/** The admin works at a desk: a sidebar and wide tables, not the nurses' phone screens. */
export default function Layout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="admin flex flex-1 flex-col lg:flex-row">
      <aside className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-card px-4 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-6 lg:border-r lg:border-b-0 lg:p-4">
        <div className="mr-auto flex items-center gap-2.5 lg:mr-0 lg:px-1 lg:pt-1">
          <Mark className="size-9" />
          <div className="leading-tight">
            <p className="font-extrabold tracking-tight">Ambil Surat</p>
            <p className="text-xs font-semibold text-muted">Admin</p>
          </div>
        </div>
        <div className="order-last w-full lg:order-none">
          <AdminNav />
        </div>
        <div className="flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch">
          <div className="hidden lg:block">
            <Suspense fallback={<div className="skeleton h-9 rounded-[0.625rem]" />}>
              <Bridge />
            </Suspense>
          </div>
          <form action={signOut}>
            <Button type="submit" className="w-full">
              <IconLogout className="size-4" /> Keluar
            </Button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
