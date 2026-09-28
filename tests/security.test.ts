import {test,expect,beforeEach,vi,afterEach} from "vitest";
import {convexTest} from "convex-test";
import schema from "../convex/schema";
import {api,internal} from "../convex/_generated/api";
import {hashSecret,verifySecret,encrypt,decrypt} from "../convex/lib/security";
const modules=import.meta.glob("../convex/**/*.ts");
beforeEach(()=>{process.env.ADMIN_PASSWORD_PEPPER=btoa("p".repeat(32));process.env.SIGNUP_DATA_KEY_V1=btoa("k".repeat(32));});
afterEach(()=>vi.useRealTimers());
test("salted and peppered hashes verify only the correct password and pepper",async()=>{
 const first=await hashSecret("test-only-password"),second=await hashSecret("test-only-password");
 expect(first).not.toBe(second);expect(await verifySecret("test-only-password",first)).toBe(true);expect(await verifySecret("wrong",first)).toBe(false);
 process.env.ADMIN_PASSWORD_PEPPER=btoa("q".repeat(32));expect(await verifySecret("test-only-password",first)).toBe(false);
});
test("encryption randomizes, binds records, rejects tampering and missing keys",async()=>{
 const a=await encrypt({email:"private@test.invalid"},"record:a"),b=await encrypt({email:"private@test.invalid"},"record:a");
 expect(a).not.toBe(b);expect(await decrypt(a,"record:a")).toEqual({email:"private@test.invalid"});
 await expect(decrypt(a,"record:b")).rejects.toThrow();
 await expect(decrypt(a.slice(0,-5)+"AAAAA","record:a")).rejects.toThrow();
 delete process.env.SIGNUP_DATA_KEY_V1;await expect(encrypt({},"x")).rejects.toThrow();
});
test("30 minute inactivity blocks reads and cannot be revived by activity",async()=>{
 vi.useFakeTimers();const t=convexTest(schema,modules);
 const {userId,sessionId}=await t.run(async ctx=>{const userId=await ctx.db.insert("users",{});await ctx.db.insert("admins",{userId});const sessionId=await ctx.db.insert("authSessions",{userId,expirationTime:Date.now()+43200000});return {userId,sessionId};});
 const admin=t.withIdentity({subject:`${userId}|${sessionId}`});
 const first=await admin.mutation(api.sessions.touch,{});
 vi.setSystemTime(Date.now()+29*60000);const extended=await admin.mutation(api.sessions.touch,{});expect(extended).toBeGreaterThan(first);
 vi.setSystemTime(extended);expect(await admin.query(api.sessions.current,{})).toBeNull();
 await expect(admin.mutation(api.sessions.touch,{})).rejects.toThrow("expired");
 await expect(admin.query(api.signees.list,{kind:"physician",paginationOpts:{numItems:10,cursor:null}})).rejects.toThrow("expired");
 await t.mutation(internal.sessions.expire,{sessionId});expect(await t.run(ctx=>ctx.db.get(sessionId))).toBeNull();
 await t.finishAllScheduledFunctions(()=>vi.runAllTimers());
});
