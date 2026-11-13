import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ambil Surat", template: "%s · Ambil Surat" },
  description: "Ambil surat keterangan dari rumah sakit dengan memindai QR dari perawat.",
  // Nothing here belongs in a search engine.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0e6b5e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
