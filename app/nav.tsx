"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "./actions";
import { IconList, IconLogout, IconQr, IconUsers } from "./icons";

const ICONS = { users: IconUsers, qr: IconQr, list: IconList } as const;
type Item = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };
type Props = { items: Item[]; label: string };

/**
 * The floating pill at the bottom of staff pages; the current page sits on a
 * yellow circle. The bar itself is part of the page's shell; which item is
 * current depends on the URL, so that part streams in.
 */
export function BottomNav(props: Props) {
  return (
    <Suspense fallback={<Bar {...props} current={undefined} />}>
      <CurrentBar {...props} />
    </Suspense>
  );
}

function CurrentBar(props: Props) {
  const path = usePathname();
  // The longest link that contains this page is the current one (/ruang/dibagikan, not /ruang).
  const current = props.items
    .filter((item) => (item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return <Bar {...props} current={current} />;
}

function Bar({ items, label, current }: Props & { current: string | undefined }) {
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-1 rounded-full bg-card/95 p-1.5 ring-1 ring-line backdrop-blur">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === current;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${active ? "bg-butter text-ink" : "text-muted hover:text-ink"}`}
            >
              <Icon className="size-5" />
              <span className={active ? "" : "sr-only sm:not-sr-only"}>{item.label}</span>
            </Link>
          );
        })}
        <form action={signOut}>
          <button type="submit" className="flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted transition-colors duration-150 hover:text-danger" aria-label="Keluar">
            <IconLogout className="size-5" />
          </button>
        </form>
      </div>
    </nav>
  );
}
