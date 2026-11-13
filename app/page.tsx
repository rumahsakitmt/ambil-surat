import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAccount } from "@/lib/session";
import { Brand } from "./brand";
import { IconQr } from "./icons";

/** Someone already signed in goes straight to their pages. */
async function Forward() {
  const account = await getAccount();
  if (account) redirect(account.role === "admin" ? "/admin" : "/ruang");
  return null;
}

const STEPS = [
  { tone: "bg-sky", title: "Pindai QR", text: "Arahkan kamera HP ke kode QR di HP perawat." },
  { tone: "bg-butter", title: "Isi tanggal lahir", text: "Tanggal lahir pasien, agar surat hanya dibuka pasien atau keluarganya." },
  { tone: "bg-blush", title: "Lihat & unduh", text: "Simpan suratnya sebagai PDF. Tautan berlaku 7 hari." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <Suspense>
        <Forward />
      </Suspense>
      <Brand />
      <section className="tile rise mt-2 bg-mint pt-6">
        <span className="grid size-14 place-items-center rounded-full bg-white/75" aria-hidden="true">
          <IconQr className="size-7 text-brand" />
        </span>
        <h1 className="mt-6 max-w-[15ch] text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance">Surat rumah sakit, langsung di HP Anda.</h1>
        <p className="mt-3 max-w-[34ch] text-sm text-ink/75 text-pretty">Surat kontrol, surat keterangan sakit, surat keterangan sehat dan surat kematian, tanpa antre di loket.</p>
      </section>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className={`tile rise flex gap-4 sm:flex-col ${step.tone}`} style={{ "--i": i + 1 } as React.CSSProperties}>
            <span className="num text-4xl leading-none">{i + 1}</span>
            <span>
              <span className="block font-extrabold">{step.title}</span>
              <span className="mt-0.5 block text-sm text-ink/75 text-pretty">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-sm text-muted">
        Petugas rumah sakit?{" "}
        <Link href="/masuk" className="font-bold text-brand underline-offset-4 hover:underline">
          Masuk di sini
        </Link>
      </p>
    </main>
  );
}
