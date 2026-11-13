import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { api, convex, secret } from "@/lib/convex";
import { getAccount } from "@/lib/session";
import { Brand } from "../brand";
import { LoginForm } from "../ui";

export const metadata: Metadata = { title: "Masuk petugas" };

async function Form() {
  const account = await getAccount();
  if (account) redirect(account.role === "admin" ? "/admin" : "/ruang");
  // On a new deployment nobody can sign in yet: the first visitor makes the admin account.
  const first = !(await convex.query(api.accounts.any, { secret }));
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{first ? "Buat akun admin" : "Masuk petugas"}</h1>
        <p className="mt-1 text-sm text-muted">
          {first ? "Belum ada akun. Akun pertama menjadi admin yang membuat akun tiap ruangan." : "Pakai akun ruangan Anda. HP ini tetap masuk selama 30 hari."}
        </p>
      </div>
      <LoginForm first={first} />
    </>
  );
}

export default function Page() {
  return (
    <main className="page flex flex-1 flex-col justify-center gap-6">
      <Brand />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-hidden="true">
            <div className="skeleton h-14 w-2/3" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        }
      >
        <Form />
      </Suspense>
    </main>
  );
}
