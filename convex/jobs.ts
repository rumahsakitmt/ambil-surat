import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { fromApp } from "./lib";

/** A question nobody answered in this long is dropped (the bridge is away). */
const MAX_AGE = 2 * 60 * 1000;

/** The bridge beats every half minute; silent for longer than this, it is away. */
const ALIVE = 90_000;

/**
 * Asks the bridge something: `rooms`, `patients`, `search` or `letters`.
 * Null when the bridge is away, so nobody waits for an answer that can't come.
 */
export const ask = mutation({
  args: { secret: v.string(), kind: v.string(), args: v.any() },
  handler: async (ctx, { secret, kind, args }) => {
    fromApp(secret);
    const hospital = await ctx.db.query("hospital").first();
    if (!hospital || Date.now() - hospital.seenAt > ALIVE) return null;
    return await ctx.db.insert("jobs", { kind, args, status: "pending", createdAt: Date.now() });
  },
});

/** Where a question stands. The app subscribes to it, so the answer reaches it the moment the bridge sends it. */
export const status = query({
  args: { secret: v.string(), id: v.id("jobs") },
  handler: async (ctx, { secret, id }) => {
    fromApp(secret);
    const job = await ctx.db.get(id);
    if (!job) return { status: "error" as const };
    if (job.status === "pending") return { status: "pending" as const };
    return job.status === "done" ? { status: "done" as const, result: job.result } : { status: "error" as const };
  },
});

/** Removes a question once the app has its answer, or stopped waiting for one. */
export const drop = mutation({
  args: { secret: v.string(), id: v.id("jobs") },
  handler: async (ctx, { secret, id }) => {
    fromApp(secret);
    if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});

export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = Date.now() - MAX_AGE;
    for (const status of ["pending", "done", "error"] as const) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(200);
      for (const job of jobs) {
        if (job.createdAt > old) continue;
        if (job.kind === "share" && job.status === "pending") {
          const share = await ctx.db.get(job.args.shareId as import("./_generated/dataModel").Id<"shares">);
          if (share?.status === "pending") await ctx.db.patch(share._id, { status: "failed", error: "SIMRS tidak menjawab" });
        }
        await ctx.db.delete(job._id);
      }
    }
  },
});
