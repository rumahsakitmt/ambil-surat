import "server-only";
import bwipjs from "bwip-js/node";
import { headers } from "next/headers";

/** A QR code as an inline SVG, sharp at any size. */
export function qrSvg(text: string) {
  // `eclevel` is a QR option bwip-js accepts but doesn't list in its types.
  const options = { bcid: "qrcode", text, eclevel: "M", scale: 4, paddingwidth: 0, paddingheight: 0 };
  return bwipjs.toSVG(options as Parameters<typeof bwipjs.toSVG>[0]);
}

/** The address patients reach the app at: APP_URL when set, else the one this request came to. */
export async function appUrl() {
  const fixed = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
