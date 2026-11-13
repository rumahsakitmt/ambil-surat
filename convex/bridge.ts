import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { fromBridge } from "./lib";
import { letterType } from "./schema";

/** The questions waiting for the bridge. It subscribes to this, so a new one reaches it at once. */
export const pending = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromBridge(secret);
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(20);
    return jobs.map((job) => ({ id: job._id, kind: job.kind, args: job.args }));
  },
});

export const complete = mutation({
  args: { secret: v.string(), id: v.id("jobs"), result: v.any() },
  handler: async (ctx, { secret, id, result }) => {
    fromBridge(secret);
    const job = await ctx.db.get(id);
    if (job?.status === "pending") await ctx.db.patch(id, { status: "done", result });
  },
});

export const fail = mutation({
  args: { secret: v.string(), id: v.id("jobs"), error: v.string() },
  handler: async (ctx, { secret, id, error }) => {
    fromBridge(secret);
    const job = await ctx.db.get(id);
    if (job?.status !== "pending") return;
    if (job.kind === "share") {
      const share = await ctx.db.get(job.args.shareId as Id<"shares">);
      if (share?.status === "pending") await ctx.db.patch(share._id, { status: "failed", error });
      await ctx.db.delete(id);
    } else await ctx.db.patch(id, { status: "error", error });
  },
});

/** The letters a room chose to share, read from SIMRS: from here on the patient can open them. */
export const fulfilShare = mutation({
  args: {
    secret: v.string(),
    id: v.id("jobs"),
    patient: v.object({ name: v.string(), dob: v.string() }),
    letters: v.array(v.object({ type: letterType, noSurat: v.string(), data: v.any() })),
  },
  handler: async (ctx, { secret, id, patient, letters }) => {
    fromBridge(secret);
    const job = await ctx.db.get(id);
    if (!job || job.kind !== "share") return;
    await ctx.db.delete(id);
    const share = await ctx.db.get(job.args.shareId as Id<"shares">);
    if (!share || share.status !== "pending") return;
    for (const letter of letters) await ctx.db.insert("letters", { shareId: share._id, ...letter });
    await ctx.db.patch(share._id, { status: "ready", patientName: patient.name, dob: patient.dob });
    await ctx.db.insert("log", {
      at: Date.now(),
      accountId: share.accountId,
      roomName: share.roomName,
      action: "bagikan",
      noRm: share.noRm,
      patientName: patient.name,
      letters: letters.map((l) => `${l.type} ${l.noSurat}`),
    });
  },
});

/** The letterhead the bridge last sent, so it only uploads the logos again when they changed. */
export const hospital = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromBridge(secret);
    const row = await ctx.db.query("hospital").first();
    return row ? { assetsHash: row.assetsHash } : null;
  },
});

export const uploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromBridge(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

export const hello = mutation({
  args: {
    secret: v.string(),
    name: v.string(),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    contact: v.string(),
    email: v.string(),
    assetsHash: v.string(),
    logoId: v.optional(v.id("_storage")),
    bpjsLogoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { secret, logoId, bpjsLogoId, ...info }) => {
    fromBridge(secret);
    const row = await ctx.db.query("hospital").first();
    const seenAt = Date.now();
    if (!row) {
      await ctx.db.insert("hospital", { ...info, logoId, bpjsLogoId, seenAt });
      return;
    }
    // New logos replace the old files; without new ones the old stay.
    const uploaded = logoId !== undefined || bpjsLogoId !== undefined;
    if (uploaded) {
      if (row.logoId && row.logoId !== logoId) await ctx.storage.delete(row.logoId);
      if (row.bpjsLogoId && row.bpjsLogoId !== bpjsLogoId) await ctx.storage.delete(row.bpjsLogoId);
    }
    await ctx.db.replace(row._id, {
      ...info,
      logoId: uploaded ? logoId : row.logoId,
      bpjsLogoId: uploaded ? bpjsLogoId : row.bpjsLogoId,
      seenAt,
    });
  },
});

/** "Still here", every half minute. */
export const beat = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromBridge(secret);
    const row = await ctx.db.query("hospital").first();
    if (row) await ctx.db.patch(row._id, { seenAt: Date.now() });
  },
});
