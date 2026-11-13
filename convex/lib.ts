// The deployment's environment variables (`npx convex env set`).
declare const process: { env: Record<string, string | undefined> };

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function guard(name: "APP_SECRET" | "BRIDGE_SECRET", given: string) {
  const expected = process.env[name];
  if (!expected) throw new Error(`${name} is not set on this deployment`);
  if (!same(expected, given)) throw new Error("Not allowed");
}

/** Every function is called either by the Next.js server or by the bridge, never by a browser. */
export const fromApp = (secret: string) => guard("APP_SECRET", secret);
export const fromBridge = (secret: string) => guard("BRIDGE_SECRET", secret);

export const DAY = 24 * 60 * 60 * 1000;
/** How long a QR works. */
export const SHARE_DAYS = 7;
/** Wrong dates of birth before a QR locks. */
export const MAX_ATTEMPTS = 5;
/** The bridge is "connected" when it was heard from this recently. */
export const BRIDGE_ALIVE = 90_000;
