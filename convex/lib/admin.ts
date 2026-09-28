import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx } from "../_generated/server";
export async function requireAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (
    !userId ||
    !(await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique())
  )
    throw new Error("Unauthorized");
  return userId;
}
