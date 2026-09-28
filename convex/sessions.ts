import { getAuthSessionId } from "@convex-dev/auth/server";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdmin, sessionDeadline } from "./lib/admin";
export const current = query({args:{},handler:async(ctx)=>{
 try { await requireAdmin(ctx); return await sessionDeadline(ctx); } catch { return null; }
}});
export const touch = mutation({args:{},handler:async(ctx)=>{
 await requireAdmin(ctx);
 const sessionId=(await getAuthSessionId(ctx))!;
 const row=await ctx.db.query("adminActivity").withIndex("by_session",q=>q.eq("sessionId",sessionId)).unique();
 const now=Date.now();
 if(row) await ctx.db.patch(row._id,{lastActiveAt:now});
 else { await ctx.db.insert("adminActivity",{sessionId,lastActiveAt:now}); await ctx.scheduler.runAfter(30*60*1000,internal.sessions.expire,{sessionId}); }
 return now+30*60*1000;
}});
export const expire = internalMutation({args:{sessionId:v.id("authSessions")},handler:async(ctx,{sessionId})=>{
 const session=await ctx.db.get(sessionId);
 const row=await ctx.db.query("adminActivity").withIndex("by_session",q=>q.eq("sessionId",sessionId)).unique();
 if(!session) { if(row) await ctx.db.delete(row._id); return; }
 const deadline=Math.min(session.expirationTime,(row?.lastActiveAt ?? session._creationTime)+30*60*1000);
 if(deadline>Date.now()) {await ctx.scheduler.runAfter(deadline-Date.now(),internal.sessions.expire,{sessionId});return;}
 for(const token of await ctx.db.query("authRefreshTokens").withIndex("sessionId",q=>q.eq("sessionId",sessionId)).collect()) await ctx.db.delete(token._id);
 await ctx.db.delete(sessionId);
 if(row) await ctx.db.delete(row._id);
}});
