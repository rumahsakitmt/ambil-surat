import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAccount } from "@/lib/session";
import { Brand } from "./brand";

/** Someone already signed in goes straight to their pages. */
async function Forward() {
  const account = await getAccount();
  if (account) redirect(account.role === "admin" ? "/admin" : "/ruang");
  return null;
}

export default function Home() {
  return (
    <main className="page flex flex-1 flex-col justify-center gap-8">
      <Suspense>
        <Forward />
      </Suspense>
      <Brand />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Surat dari rumah sakit, langsung di HP Anda.</h1>
        <p className="mt-3 text-muted text-pretty">
          Minta perawat menampilkan kode QR, lalu pindai dengan kamera HP. Surat kontrol, surat keterangan sakit dan surat keterangan sehat bisa dilihat dan diunduh.
        </p>
      </div>
      <ol className="card divide-y divide-line">
        {[
          ["Pindai QR", "Arahkan kamera HP ke kode QR di HP perawat."],
          ["Isi tanggal lahir pasien", "Agar surat hanya dibuka oleh pasien atau keluarganya."],
          ["Lihat atau unduh", "Surat bisa dibuka selama 7 hari."],
        ].map(([title, text], i) => (
          <li key={title} className="flex gap-3 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{i + 1}</span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        Petugas rumah sakit?{" "}
        <Link href="/masuk" className="font-medium text-brand underline underline-offset-4">
          Masuk di sini
        </Link>
      </p>
    </main>
  );
}
