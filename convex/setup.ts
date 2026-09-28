import { internalAction, internalMutation } from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
export const grantAdmin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (
      !(await ctx.db
        .query("admins")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique())
    )
      await ctx.db.insert("admins", { userId });
  },
});
export const createAdmin = internalAction({
  args: {},
  handler: async (ctx) => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!username || !password)
      throw new Error("Set bootstrap environment variables first.");
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: username, secret: password },
      profile: { name: "Amanah Administrator", email: username },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });
    await ctx.runMutation(internal.setup.grantAdmin, { userId: user._id });
    return { created: true };
  },
});
