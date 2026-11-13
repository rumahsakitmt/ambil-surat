import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { fromApp } from "./lib";

/** A question nobody answered in this long is dropped (the bridge is away). */
const MAX_AGE = 2 * 60 * 1000;

/** Asks the bridge something: `rooms`, `patients`, `search` or `letters`. */
export const ask = mutation({
  args: { secret: v.string(), kind: v.string(), args: v.any() },
  handler: async (ctx, { secret, kind, args }) => {
    fromApp(secret);
    return await ctx.db.insert("jobs", { kind, args, status: "pending", createdAt: Date.now() });
  },
});

/** The bridge's answer, once there is one. Reading it removes it. */
export const take = mutation({
  args: { secret: v.string(), id: v.id("jobs") },
  handler: async (ctx, { secret, id }) => {
    fromApp(secret);
    const job = await ctx.db.get(id);
    if (!job) return { status: "error" as const, error: "gone" };
    if (job.status === "pending") return { status: "pending" as const };
    await ctx.db.delete(id);
    return job.status === "done"
      ? { status: "done" as const, result: job.result }
      : { status: "error" as const, error: job.error ?? "error" };
  },
});

/** Gives up on a question the app stopped waiting for. */
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
