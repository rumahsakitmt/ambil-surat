/**
 * The bridge between SIMRS Khanza and Ambil Surat. It runs on a machine at the
 * hospital that can reach Khanza's database and the internet, and only makes
 * outgoing connections: it listens to the app for questions (a room looking
 * for a patient, a patient's letters, letters to share), answers them from
 * Khanza read-only, and sends the answer back. Nothing reaches into the
 * hospital, and the database is never exposed.
 *
 *   node --env-file=.env bridge.ts           keep running
 *   node --env-file=.env bridge.ts --check   check the database and the app once, then stop
 */
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import * as simrs from "./simrs.ts";

const env = process.env,
  checkOnly = process.argv.includes("--check");

function need(key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    console.error(`${key} is not set (see .env.example).`);
    process.exit(1);
  }
  return value;
}
const day = env.BRIDGE_DATE?.trim() || null;
if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error("BRIDGE_DATE must be YYYY-MM-DD.");
  process.exit(1);
}
const secret = need("BRIDGE_SECRET");
const link = simrs.makeVerifyLink(need("VERIFY_URL"), need("KHANZA_AES_KEY"), need("KHANZA_AES_IV"));

const pool = mysql.createPool({
  host: need("KHANZA_DB_HOST"),
  port: Number(env.KHANZA_DB_PORT) || 3306,
  database: need("KHANZA_DB_NAME"),
  user: need("KHANZA_DB_READ_USER"),
  password: env.KHANZA_DB_READ_PASS ?? "",
  connectionLimit: 4,
  connectTimeout: 10_000,
  dateStrings: true,
});
const run = async (sql: string, params: unknown[] = []) =>
  (await pool.query({ sql, timeout: 20_000 }, params))[0] as Record<string, string | null>[];

const log = (text: string) => console.log(`${new Date().toLocaleTimeString("en-GB")}  ${text}`);

/** The bridge only reads, so it runs as a user that can only read. */
async function checkReadOnly() {
  const [grants] = await pool.query({ sql: "show grants", rowsAsArray: true });
  const writes = (grants as string[][])
    .map(([line]) => /^GRANT (.+?) ON /i.exec(line)?.[1] ?? "")
    .flatMap((list) => list.split(/,\s*/))
    .map((p) => p.replace(/\s*\(.*$/, "").trim().toUpperCase())
    .filter((p) => p && !["USAGE", "SELECT", "SHOW VIEW", "SHOW DATABASES"].includes(p));
  if (writes.length) {
    console.error(
      `The database user can do more than read (${[...new Set(writes)].slice(0, 5).join(", ")}). ` +
        "Create a SELECT-only user for the bridge (see README.md).",
    );
    process.exit(1);
  }
}

async function today() {
  if (day) return day;
  const [row] = await run("select date_format(curdate(), '%Y-%m-%d') as today");
  return row.today as string;
}

const client = new ConvexClient(need("CONVEX_URL"));
const api = anyApi.bridge;

/** Sends the letterhead, and the logos when they are new to the app. */
async function hello() {
  const { info, logo, bpjsLogo } = await simrs.hospital(run as never);
  const hash = createHash("sha256");
  for (const part of [logo, bpjsLogo]) hash.update(part ?? "none").update("|");
  const assetsHash = hash.digest("hex");
  const known = (await client.query(api.hospital, { secret })) as { assetsHash: string } | null;
  const ids: { logoId?: string; bpjsLogoId?: string } = {};
  if (known?.assetsHash !== assetsHash) {
    const upload = async (bytes: Uint8Array) => {
      const url = (await client.mutation(api.uploadUrl, { secret })) as string;
      const type = bytes[0] === 0xff ? "image/jpeg" : "image/png";
      const response = await fetch(url, { method: "POST", headers: { "content-type": type }, body: new Blob([new Uint8Array(bytes)], { type }), signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw Error(`Uploading a logo failed (${response.status})`);
      return ((await response.json()) as { storageId: string }).storageId;
    };
    if (logo) ids.logoId = await upload(logo);
    if (bpjsLogo) ids.bpjsLogoId = await upload(bpjsLogo);
  }
  await client.mutation(api.hello, { secret, ...info, assetsHash, ...ids });
  return info;
}

type Job = { id: string; kind: string; args: Record<string, unknown> };

async function answer(job: Job, hospital: { name: string; city: string }) {
  const a = job.args;
  switch (job.kind) {
    case "rooms":
      return simrs.rooms(run);
    case "patients":
      return simrs.patients(run, await today(), a.room as { kind: string; code: string });
    case "search":
      return simrs.search(run, String(a.q ?? ""));
    case "letters":
      return simrs.letters(run, await today(), String(a.noRm ?? ""), a.all === true);
    default:
      throw Error(`Unknown question: ${job.kind}`);
  }
}

async function handle(job: Job, hospital: { name: string; city: string }) {
  const started = Date.now();
  try {
    if (job.kind === "share") {
      const result = await simrs.share(run, String(job.args.noRm ?? ""), job.args.items as simrs.Item[], hospital, link);
      await client.mutation(api.fulfilShare, { secret, id: job.id, ...result });
    } else await client.mutation(api.complete, { secret, id: job.id, result: await answer(job, hospital) });
    // Never a patient's name in the log: only what kind of question it was.
    log(`${job.kind}: answered in ${Date.now() - started} ms`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`${job.kind}: failed (${message})`);
    await client.mutation(api.fail, { secret, id: job.id, error: message.slice(0, 200) }).catch(() => {});
  }
}

await checkReadOnly();
const missing: string[] = [];
for (const table of simrs.TABLES) await run(`select 1 from \`${table}\` limit 1`).catch(() => missing.push(table));
if (missing.length) {
  console.error(`The database user cannot read: ${missing.join(", ")} (see README.md).`);
  process.exit(1);
}
const info = await hello();

if (checkOnly) {
  const { poli, bangsal } = await simrs.rooms(run);
  log(`Database and app reached: ${info.name}, ${poli.length} poli, ${bangsal.length} bangsal, reading day ${await today()}.`);
  await pool.end();
  await client.close();
} else {
  log(`Bridge started for ${info.name}: answering from ${env.KHANZA_DB_NAME} on ${env.KHANZA_DB_HOST}${day ? ` (day ${day})` : ""}.`);
  const taken = new Set<string>();
  client.onUpdate(api.pending, { secret }, (jobs: Job[]) => {
    const waiting = new Set(jobs.map((job) => job.id));
    for (const id of taken) if (!waiting.has(id)) taken.delete(id);
    for (const job of jobs) {
      if (taken.has(job.id)) continue;
      taken.add(job.id);
      void handle(job, info);
    }
  });
  // "Still here", so the app can tell a room when SIMRS is out of reach.
  let failing = false;
  setInterval(async () => {
    try {
      await run("select 1");
      await client.mutation(api.beat, { secret });
      if (failing) log("back: SIMRS and the app are reachable again.");
      failing = false;
    } catch (err) {
      if (!failing) log(`not reachable: ${err instanceof Error ? err.message : err}. Still trying.`);
      failing = true;
    }
  }, 30_000);
}
