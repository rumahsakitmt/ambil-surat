import type { NextRequest } from "next/server";
import { api, convex, secret } from "@/lib/convex";
import { TITLES, letterPdf, type Letter } from "@/lib/letters";
import { hasOpened } from "@/lib/session";

/** One of a share's letters as a PDF, for the phone that gave the date of birth. */
export async function GET(_request: NextRequest, context: RouteContext<"/s/[token]/pdf/[n]">) {
  const { token, n } = await context.params;
  if (!(await hasOpened(token))) return new Response("Buka surat dengan memindai QR terlebih dahulu.", { status: 403 });
  const [share, hospital] = await Promise.all([convex.query(api.shares.view, { secret, token, now: Date.now() }), convex.query(api.hospital.get, { secret })]);
  const letter = share?.letters[Number(n) - 1];
  if (!letter || !hospital) return new Response("Surat tidak ditemukan atau QR sudah tidak berlaku.", { status: 404 });
  const pdf = await letterPdf(letter as Letter, hospital);
  const name = `${TITLES[letter.type]} ${letter.noSurat}`.replace(/[^A-Za-z0-9 ._-]/g, "-");
  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
