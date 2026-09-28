import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
export const status = v.union(
  ...[
    "new",
    "contacted",
    "follow_up",
    "onboarding",
    "welcomed",
    "archived",
  ].map((x) => v.literal(x)),
);
export const kind = v.union(v.literal("physician"), v.literal("hospital"));
export default defineSchema({
  ...authTables,
  admins: defineTable({ userId: v.id("users") }).index("by_user", ["userId"]),
  adminActivity: defineTable({ sessionId: v.id("authSessions"), lastActiveAt: v.number() }).index("by_session", ["sessionId"]),
  signees: defineTable({
    kind,
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    answers: v.optional(v.record(v.string(), v.string())),
    encrypted: v.optional(v.string()),
    status,
    submissionKey: v.string(),
    updatedAt: v.number(),
    consentVersion: v.string(),
    publicListing: v.optional(v.boolean()),
    publicConsentAt: v.optional(v.number()),
    publicConsentVersion: v.optional(v.string()),
  })
    .index("by_public_listing", ["publicListing"])
    .index("by_submission", ["submissionKey"])
    .index("by_kind", ["kind"])
    .index("by_email", ["email"]),
  notes: defineTable({
    signeeId: v.id("signees"),
    body: v.optional(v.string()),
    encrypted: v.optional(v.string()),
    author: v.id("users"),
  }).index("by_signee", ["signeeId"]),
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    startedAt: v.number(),
  }).index("by_key", ["key"]),
});
