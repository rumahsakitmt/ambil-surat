import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const room = v.object({
  kind: v.union(v.literal("poli"), v.literal("bangsal")),
  code: v.string(),
  name: v.string(),
});

export const letterType = v.union(v.literal("kontrol"), v.literal("sakit"), v.literal("sehat"), v.literal("kematian"));

export const shareItem = v.object({
  type: letterType,
  noSurat: v.string(),
  date: v.string(),
});

export default defineSchema({
  /** One admin, and one shared account per room (poli or ward). */
  accounts: defineTable({
    username: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("room")),
    passwordHash: v.string(),
    room: v.optional(room),
    fails: v.number(),
    failsAt: v.number(),
  }).index("by_username", ["username"]),

  /** Signed-in phones. `token` is the SHA-256 of the cookie's value. */
  sessions: defineTable({
    token: v.string(),
    accountId: v.id("accounts"),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_account", ["accountId"]),

  /**
   * Questions for the bridge at the hospital (a patient search, a patient's
   * letters, a share to fill). The answer passes through here: it is deleted
   * as soon as the app has read it, or after two minutes.
   */
  jobs: defineTable({
    kind: v.string(),
    args: v.any(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("error")),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  /** What a room shared with a patient: the QR opens it by `token`. */
  shares: defineTable({
    token: v.string(),
    accountId: v.id("accounts"),
    roomName: v.string(),
    noRm: v.string(),
    patientName: v.string(),
    dob: v.string(),
    items: v.array(shareItem),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed"), v.literal("revoked")),
    error: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_account", ["accountId", "createdAt"])
    .index("by_expiry", ["expiresAt"]),

  /** The shared letters' contents, deleted with their share. */
  letters: defineTable({
    shareId: v.id("shares"),
    type: letterType,
    noSurat: v.string(),
    data: v.any(),
  }).index("by_share", ["shareId"]),

  /** Who shared what, kept after the letters themselves are gone. */
  log: defineTable({
    at: v.number(),
    accountId: v.id("accounts"),
    roomName: v.string(),
    action: v.union(v.literal("bagikan"), v.literal("cabut")),
    noRm: v.string(),
    patientName: v.string(),
    letters: v.array(v.string()),
  }).index("by_at", ["at"]),

  /** The hospital's letterhead, sent by the bridge, and when it was last heard from. */
  hospital: defineTable({
    name: v.string(),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    contact: v.string(),
    email: v.string(),
    logoId: v.optional(v.id("_storage")),
    bpjsLogoId: v.optional(v.id("_storage")),
    assetsHash: v.string(),
    seenAt: v.number(),
  }),
});
