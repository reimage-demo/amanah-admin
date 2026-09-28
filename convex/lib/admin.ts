import { getAuthUserId, getAuthSessionId } from "@convex-dev/auth/server";
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
  if (await sessionDeadline(ctx) <= Date.now()) throw new Error("Unauthorized: session expired");
  return userId;
}

export async function sessionDeadline(ctx: QueryCtx) {
 const sessionId = await getAuthSessionId(ctx);
 const session = sessionId ? await ctx.db.get(sessionId) : null;
 if(!session || session.userId !== await getAuthUserId(ctx)) throw new Error("Unauthorized");
 const activity=await ctx.db.query("adminActivity").withIndex("by_session",q=>q.eq("sessionId",sessionId!)).unique();
 return Math.min(session.expirationTime,(activity?.lastActiveAt ?? session._creationTime)+30*60*1000);
}
