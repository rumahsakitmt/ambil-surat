import "server-only";
import { connection } from "next/server";

/**
 * The time of this request. Waiting for the request first keeps pages that
 * depend on the time (a QR's expiry, whether the bridge is alive) out of the
 * prerendered shell, which would freeze the time it was built.
 */
export async function requestTime() {
  await connection();
  return Date.now();
}
