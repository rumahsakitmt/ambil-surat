import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./layers.css";
import "@ui-sdk/core/web.css";
import "./globals.css";

// A rounded geometric sans designed in Jakarta.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ambil Surat", template: "%s · Ambil Surat" },
  description: "Ambil surat keterangan dari rumah sakit dengan memindai QR dari perawat.",
  // Nothing here belongs in a search engine.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f3f4f0", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/* Without a nonce, this makes ui-sdk add its runtime styles as constructed sheets, after the page's own: as <style> tags they would come first and put its layer under Tailwind's reset (see layers.css). */}
        <meta property="csp-nonce" />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
