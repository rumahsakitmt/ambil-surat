import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { getAccount } from "@/lib/session";
import { Mark } from "../brand";
import { LoginForm } from "../ui";

export const metadata: Metadata = { title: "Masuk petugas" };

async function Form() {
  const account = await getAccount();
  if (account) redirect(account.role === "admin" ? "/admin" : "/ruang");
  // On a new deployment nobody can sign in yet: the first visitor makes the admin account.
  const first = !(await convex.query(api.accounts.any, { secret }));
  return (
    <>
      <div className="tile rise bg-mint pt-6">
        <Mark className="size-12" />
        <h1 className="mt-6 text-[1.7rem] leading-tight font-extrabold tracking-tight">{first ? "Buat akun admin" : "Masuk petugas"}</h1>
        <p className="mt-1.5 text-sm text-ink/75 text-pretty">
          {first ? "Belum ada akun. Akun pertama menjadi admin yang membuat akun tiap ruangan." : "Pakai akun ruangan Anda. HP ini tetap masuk selama 30 hari."}
        </p>
      </div>
      <div className="card rise p-5" style={{ "--i": 1 } as React.CSSProperties}>
        <LoginForm first={first} />
      </div>
    </>
  );
}

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="skeleton h-48" />
            <div className="skeleton h-64" />
          </div>
        }
      >
        <Form />
      </Suspense>
    </main>
  );
}
