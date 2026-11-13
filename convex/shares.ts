import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { DAY, MAX_ATTEMPTS, SHARE_DAYS, fromApp } from "./lib";
import { shareItem } from "./schema";

export async function dropShare(ctx: MutationCtx, id: Id<"shares">, keepRow = false) {
  const letters = await ctx.db
    .query("letters")
    .withIndex("by_share", (q) => q.eq("shareId", id))
    .collect();
  for (const letter of letters) await ctx.db.delete(letter._id);
  if (!keepRow) await ctx.db.delete(id);
}

/** A room picks a patient's letters: the bridge is asked to read them from SIMRS. */
export const create = mutation({
  args: { secret: v.string(), accountId: v.id("accounts"), token: v.string(), noRm: v.string(), items: v.array(shareItem) },
  handler: async (ctx, { secret, accountId, token, noRm, items }) => {
    fromApp(secret);
    const account = await ctx.db.get(accountId);
    if (!account || items.length === 0 || items.length > 20) return null;
    const now = Date.now();
    const shareId = await ctx.db.insert("shares", {
      token,
      accountId,
      roomName: account.name,
      noRm,
      patientName: "",
      dob: "",
      items,
      status: "pending",
      attempts: 0,
      createdAt: now,
      expiresAt: now + SHARE_DAYS * DAY,
    });
    await ctx.db.insert("jobs", { kind: "share", args: { shareId, noRm, items }, status: "pending", createdAt: now });
    return shareId;
  },
});

/** A room's own share, with the token its QR carries. */
export const mine = query({
  args: { secret: v.string(), accountId: v.id("accounts"), id: v.string() },
  handler: async (ctx, { secret, accountId, id }) => {
    fromApp(secret);
    const shareId = ctx.db.normalizeId("shares", id);
    const share = shareId && (await ctx.db.get(shareId));
    if (!share || share.accountId !== accountId) return null;
    return {
      id: share._id,
      token: share.token,
      status: share.status,
      error: share.error ?? null,
      noRm: share.noRm,
      patientName: share.patientName,
      items: share.items,
      attempts: share.attempts,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    };
  },
});

/** What a room has shared that still works, newest first. */
export const active = query({
  args: { secret: v.string(), accountId: v.id("accounts"), now: v.number() },
  handler: async (ctx, { secret, accountId, now }) => {
    fromApp(secret);
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .order("desc")
      .take(100);
    return shares
      .filter((s) => s.status === "ready" && s.expiresAt > now)
      .map((s) => ({
        id: s._id,
        noRm: s.noRm,
        patientName: s.patientName,
        items: s.items,
        locked: s.attempts >= MAX_ATTEMPTS,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));
  },
});

export const revoke = mutation({
  args: { secret: v.string(), accountId: v.id("accounts"), id: v.string() },
  handler: async (ctx, { secret, accountId, id }) => {
    fromApp(secret);
    const shareId = ctx.db.normalizeId("shares", id);
    const share = shareId && (await ctx.db.get(shareId));
    if (!share || share.accountId !== accountId || share.status === "revoked") return;
    await dropShare(ctx, share._id, true);
    await ctx.db.patch(share._id, { status: "revoked" });
    if (share.status === "ready")
      await ctx.db.insert("log", {
        at: Date.now(),
        accountId,
        roomName: share.roomName,
        action: "cabut",
        noRm: share.noRm,
        patientName: share.patientName,
        letters: share.items.map((i) => `${i.type} ${i.noSurat}`),
      });
  },
});

async function byToken(ctx: { db: MutationCtx["db"] | import("./_generated/server").QueryCtx["db"] }, token: string) {
  return await ctx.db
    .query("shares")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

type State = "gone" | "pending" | "locked" | "ready";
function stateOf(share: { status: string; expiresAt: number; attempts: number } | null, now: number): State {
  if (!share || share.expiresAt <= now) return "gone";
  if (share.status === "pending") return "pending";
  if (share.status !== "ready") return "gone";
  return share.attempts >= MAX_ATTEMPTS ? "locked" : "ready";
}

/** What someone who scanned a QR may know before giving the date of birth: only whether it still works. */
export const peek = query({
  args: { secret: v.string(), token: v.string(), now: v.number() },
  handler: async (ctx, { secret, token, now }) => {
    fromApp(secret);
    const share = await byToken(ctx, token);
    const state = stateOf(share, now);
    return { state, left: share && state === "ready" ? MAX_ATTEMPTS - share.attempts : 0 };
  },
});

/** Checks the date of birth (YYYY-MM-DD). Five wrong ones lock the QR for good. */
export const open = mutation({
  args: { secret: v.string(), token: v.string(), dob: v.string() },
  handler: async (ctx, { secret, token, dob }) => {
    fromApp(secret);
    const share = await byToken(ctx, token);
    const state = stateOf(share, Date.now());
    if (!share || state !== "ready") return { ok: false, state, left: 0 };
    if (share.dob && share.dob === dob) {
      if (share.attempts) await ctx.db.patch(share._id, { attempts: 0 });
      return { ok: true, state, left: MAX_ATTEMPTS };
    }
    const attempts = share.attempts + 1;
    await ctx.db.patch(share._id, { attempts });
    return { ok: false, state: attempts >= MAX_ATTEMPTS ? ("locked" as State) : state, left: MAX_ATTEMPTS - attempts };
  },
});

/** The shared letters. The Next.js server calls this only for a visitor who passed `open`. */
export const view = query({
  args: { secret: v.string(), token: v.string(), now: v.number() },
  handler: async (ctx, { secret, token, now }) => {
    fromApp(secret);
    const share = await byToken(ctx, token);
    if (!share || stateOf(share, now) !== "ready") return null;
    const letters = await ctx.db
      .query("letters")
      .withIndex("by_share", (q) => q.eq("shareId", share._id))
      .collect();
    // In the order the room ticked them.
    const order = new Map(share.items.map((item, i) => [`${item.type} ${item.noSurat}`, i]));
    letters.sort((a, b) => (order.get(`${a.type} ${a.noSurat}`) ?? 0) - (order.get(`${b.type} ${b.noSurat}`) ?? 0));
    return {
      patientName: share.patientName,
      roomName: share.roomName,
      expiresAt: share.expiresAt,
      letters: letters.map((l) => ({ type: l.type, noSurat: l.noSurat, data: l.data })),
    };
  },
});

/** Expired shares go, letters and all; so do old sessions. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("shares")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(100);
    for (const share of expired) await dropShare(ctx, share._id);
    const sessions = await ctx.db.query("sessions").take(1000);
    for (const session of sessions) if (session.expiresAt < now) await ctx.db.delete(session._id);
  },
});
