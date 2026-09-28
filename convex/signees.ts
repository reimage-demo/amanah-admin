import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { kind, status } from "./schema";
import { requireAdmin } from "./lib/admin";
const fields = {
  physician: [
    "full_name",
    "email",
    "specialty",
    "country",
    "state",
    "contribution",
    "availability",
    "languages",
  ],
  hospital: [
    "contact_name",
    "email",
    "organization",
    "role",
    "location",
    "interests",
    "needs",
  ],
};
export const submit = internalMutation({
  args: {
    kind,
    answers: v.record(v.string(), v.string()),
    submissionKey: v.string(),
    rateKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^[a-f0-9-]{36}$/i.test(args.submissionKey))
      throw new Error("Invalid submission");
    const answers: Record<string, string> = {};
    for (const key of fields[args.kind]) {
      const value = (args.answers[key] || "").trim();
      if (value.length > (key === "needs" ? 3000 : 250))
        throw new Error("Please shorten your response.");
      if (!value && !["availability", "languages", "needs"].includes(key))
        throw new Error("Please complete the required fields.");
      answers[key] = value;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email))
      throw new Error("Please enter a valid email.");
    const previous = await ctx.db
      .query("signees")
      .withIndex("by_submission", (q) =>
        q.eq("submissionKey", args.submissionKey),
      )
      .unique();
    if (previous) return { ok: true };
    const now = Date.now();
    for (const key of [args.rateKey, `email:${answers.email.toLowerCase()}`]) {
      const limit = await ctx.db
        .query("rateLimits")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      const active = limit && now - limit.startedAt < 60 * 60 * 1000;
      if (active && limit.count >= 5)
        throw new Error("Too many submissions. Please try again later.");
      if (limit)
        await ctx.db.patch(limit._id, {
          count: active ? limit.count + 1 : 1,
          startedAt: active ? limit.startedAt : now,
        });
      else await ctx.db.insert("rateLimits", { key, count: 1, startedAt: now });
    }
    await ctx.db.insert("signees", {
      kind: args.kind,
      answers,
      name: answers.full_name || answers.contact_name,
      email: answers.email.toLowerCase(),
      status: "new",
      submissionKey: args.submissionKey,
      updatedAt: now,
      consentVersion: "privacy-2026-09-28",
      publicListing: args.kind === "physician" && args.answers.public_directory === "yes",
      ...(args.kind === "physician" && args.answers.public_directory === "yes" ? {
        publicConsentAt: now,
        publicConsentVersion: "public-name-only-2026-09-28",
      } : {}),
    });
    return { ok: true };
  },
});
export const list = query({
  args: { kind, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("signees")
      .withIndex("by_kind", (q) => q.eq("kind", args.kind))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const detail = query({
  args: { id: v.id("signees") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return {
      signee: await ctx.db.get(id),
      notes: await ctx.db
        .query("notes")
        .withIndex("by_signee", (q) => q.eq("signeeId", id))
        .order("desc")
        .collect(),
    };
  },
});
export const updateStatus = mutation({
  args: { id: v.id("signees"), status },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now(), ...(args.status === "archived" ? { publicListing: false } : {}) });
  },
});
export const addNote = mutation({
  args: { id: v.id("signees"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const author = await requireAdmin(ctx);
    if (!(await ctx.db.get(id))) throw new Error("Signee not found");
    if (!body.trim() || body.length > 3000)
      throw new Error("Notes must contain 1–3000 characters.");
    await ctx.db.insert("notes", { signeeId: id, body: body.trim(), author });
  },
});

// This projection is the only data returned by the public directory endpoint.
export const publicMembers = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db.query("signees")
      .withIndex("by_public_listing", q => q.eq("publicListing", true))
      .order("desc").paginate({ numItems: 50, cursor });
    return {
      members: result.page.filter(row => row.kind === "physician" && row.publicConsentAt && row.status !== "archived")
        .map(row => ({ name: row.name })),
      cursor: result.isDone ? null : result.continueCursor,
    };
  },
});
export const hidePublicListing = mutation({
  args: { id: v.id("signees") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { publicListing: false, updatedAt: Date.now() });
  },
});
