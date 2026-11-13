import { v } from "convex/values";
import { query } from "./_generated/server";
import { fromApp } from "./lib";

/** The letterhead and when the bridge was last heard from. */
export const get = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromApp(secret);
    const row = await ctx.db.query("hospital").first();
    if (!row) return null;
    return {
      name: row.name,
      address: row.address,
      city: row.city,
      province: row.province,
      contact: row.contact,
      email: row.email,
      logoUrl: row.logoId ? await ctx.storage.getUrl(row.logoId) : null,
      bpjsLogoUrl: row.bpjsLogoId ? await ctx.storage.getUrl(row.bpjsLogoId) : null,
      seenAt: row.seenAt,
    };
  },
});

export const log = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromApp(secret);
    const rows = await ctx.db.query("log").withIndex("by_at").order("desc").take(300);
    return rows.map((r) => ({ id: r._id, at: r.at, roomName: r.roomName, action: r.action, noRm: r.noRm, patientName: r.patientName, letters: r.letters }));
  },
});
