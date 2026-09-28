import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { encrypt, decrypt, privateIndex } from "./lib/security";
export const encryptRecords=internalMutation({args:{table:v.union(v.literal("signees"),v.literal("notes"),v.literal("rateLimits")),cursor:v.union(v.string(),v.null())},handler:async(ctx,{table,cursor})=>{
 const result=await ctx.db.query(table).paginate({numItems:50,cursor});
 for(const row of result.page) {
  if(table==="signees" && "submissionKey" in row && !row.encrypted) await ctx.db.patch(row._id,{encrypted:await encrypt({name:row.name,email:row.email,answers:row.answers},`signee:${row.submissionKey}`),name:undefined,email:undefined,answers:undefined});
  if(table==="notes" && "signeeId" in row && !row.encrypted) await ctx.db.patch(row._id,{encrypted:await encrypt(row.body,`note:${row.signeeId}`),body:undefined});
  if(table==="rateLimits" && "key" in row && row.key.startsWith("email:") && row.key.includes("@")) await ctx.db.patch(row._id,{key:`email:${await privateIndex(row.key.slice(6))}`});
 }
 return {count:result.page.length,cursor:result.isDone?null:result.continueCursor};
}});

export const verifyEncryption = internalMutation({args:{},handler:async()=>{const probe={value:"non-personal encryption check"};const ciphertext=await encrypt(probe,"probe");const result=await decrypt(ciphertext,"probe");return {encrypted:ciphertext.startsWith("v1."),roundTrip:result.value===probe.value};}});
