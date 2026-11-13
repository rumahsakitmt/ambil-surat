import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DAY, fromApp } from "./lib";
import { room } from "./schema";
import { dropShare } from "./shares";

const SESSION_DAYS = 30;
/** Ten wrong passwords lock a username for fifteen minutes. */
const MAX_FAILS = 10;
const FAIL_WINDOW = 15 * 60 * 1000;

const clean = (username: string) => username.trim().toLowerCase();

/** Whether anyone can sign in yet: the first visitor creates the admin. */
export const any = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromApp(secret);
    return (await ctx.db.query("accounts").first()) !== null;
  },
});

export const setup = mutation({
  args: { secret: v.string(), username: v.string(), name: v.string(), passwordHash: v.string() },
  handler: async (ctx, { secret, username, name, passwordHash }) => {
    fromApp(secret);
    if (await ctx.db.query("accounts").first()) return false;
    await ctx.db.insert("accounts", { username: clean(username), name, role: "admin", passwordHash, fails: 0, failsAt: 0 });
    return true;
  },
});

/** The stored hash for a username; the Next.js server checks the password against it. */
export const forLogin = query({
  args: { secret: v.string(), username: v.string() },
  handler: async (ctx, { secret, username }) => {
    fromApp(secret);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_username", (q) => q.eq("username", clean(username)))
      .unique();
    if (!account) return null;
    const locked = account.fails >= MAX_FAILS && Date.now() - account.failsAt < FAIL_WINDOW;
    return { id: account._id, passwordHash: account.passwordHash, locked };
  },
});

export const loginFailed = mutation({
  args: { secret: v.string(), id: v.id("accounts") },
  handler: async (ctx, { secret, id }) => {
    fromApp(secret);
    const account = await ctx.db.get(id);
    if (!account) return;
    const now = Date.now();
    const fresh = now - account.failsAt > FAIL_WINDOW;
    await ctx.db.patch(id, { fails: fresh ? 1 : account.fails + 1, failsAt: now });
  },
});

export const signIn = mutation({
  args: { secret: v.string(), id: v.id("accounts"), token: v.string() },
  handler: async (ctx, { secret, id, token }) => {
    fromApp(secret);
    await ctx.db.patch(id, { fails: 0 });
    await ctx.db.insert("sessions", { token, accountId: id, expiresAt: Date.now() + SESSION_DAYS * DAY });
  },
});

export const signOut = mutation({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, { secret, token }) => {
    fromApp(secret);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

/** The account behind a session cookie. */
export const current = query({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, { secret, token }) => {
    fromApp(secret);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    const account = await ctx.db.get(session.accountId);
    if (!account) return null;
    return { id: account._id, username: account.username, name: account.name, role: account.role, room: account.room ?? null };
  },
});

export const list = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    fromApp(secret);
    const accounts = await ctx.db.query("accounts").collect();
    return accounts
      .map((a) => ({ id: a._id, username: a.username, name: a.name, role: a.role, room: a.room ?? null }))
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
  },
});

export const create = mutation({
  args: { secret: v.string(), username: v.string(), passwordHash: v.string(), room },
  handler: async (ctx, { secret, username, passwordHash, room }) => {
    fromApp(secret);
    const name = clean(username);
    const taken = await ctx.db
      .query("accounts")
      .withIndex("by_username", (q) => q.eq("username", name))
      .unique();
    if (taken) return false;
    await ctx.db.insert("accounts", { username: name, name: room.name, role: "room", passwordHash, room, fails: 0, failsAt: 0 });
    return true;
  },
});

/** A new password signs the account out everywhere. */
export const setPassword = mutation({
  args: { secret: v.string(), id: v.id("accounts"), passwordHash: v.string(), keepToken: v.optional(v.string()) },
  handler: async (ctx, { secret, id, passwordHash, keepToken }) => {
    fromApp(secret);
    await ctx.db.patch(id, { passwordHash, fails: 0 });
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_account", (q) => q.eq("accountId", id))
      .collect();
    for (const session of sessions) if (session.token !== keepToken) await ctx.db.delete(session._id);
  },
});

export const remove = mutation({
  args: { secret: v.string(), id: v.id("accounts") },
  handler: async (ctx, { secret, id }) => {
    fromApp(secret);
    const account = await ctx.db.get(id);
    if (!account || account.role === "admin") return;
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_account", (q) => q.eq("accountId", id))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    // What the room shared stops working with it.
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_account", (q) => q.eq("accountId", id))
      .collect();
    for (const share of shares) await dropShare(ctx, share._id);
    await ctx.db.delete(id);
  },
});
