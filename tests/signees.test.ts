import { convexTest } from "convex-test";
import { describe, expect, test, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { decrypt } from "../convex/lib/security";
beforeEach(()=>{process.env.SIGNUP_DATA_KEY_V1=btoa("a".repeat(32));process.env.SIGNUP_INDEX_KEY_V1=btoa("b".repeat(32));});
const modules = import.meta.glob("../convex/**/*.ts");
const submission = () => ({
  kind: "physician" as const,
  answers: {
    full_name: "QA Physician",
    email: "qa@example.invalid",
    specialty: "Internal medicine",
    country: "USA",
    state: "CT",
    contribution: "Teaching and mentorship",
    availability: "Monthly",
    languages: "Arabic, English",
  },
  submissionKey: crypto.randomUUID(),
  rateKey: "ip:test",
});
const page = { numItems: 50, cursor: null };
describe("Amanah submission and private stewardship", () => {
  test("saves all answers once across retries", async () => {
    const t = convexTest(schema, modules),
      data = submission();
    await t.mutation(internal.signees.submit, data);
    await t.mutation(internal.signees.submit, data);
    const rows = await t.run((ctx) => ctx.db.query("signees").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].answers).toBeUndefined();
    expect(JSON.stringify(rows)).not.toContain(data.answers.email);
    expect((await decrypt(rows[0].encrypted!,`signee:${rows[0].submissionKey}`)).answers).toEqual(data.answers);
    expect(rows[0].status).toBe("new");
  });
  test("rejects invalid and missing answers without creating records", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.signees.submit, {
        ...submission(),
        answers: { ...submission().answers, email: "invalid" },
      }),
    ).rejects.toThrow("valid email");
    await expect(
      t.mutation(internal.signees.submit, {
        ...submission(),
        answers: { ...submission().answers, specialty: "" },
      }),
    ).rejects.toThrow("required");
    expect(
      await t.run((ctx) => ctx.db.query("signees").collect()),
    ).toHaveLength(0);
  });
  test("rejects anonymous and non-admin reads and writes", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.signees.submit, submission());
    const row = await t.run((ctx) => ctx.db.query("signees").first());
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Not admin" }),
    );
    for (const client of [
      t,
      t.withIdentity({ subject: `${userId}|session` }),
    ]) {
      await expect(
        client.query(api.signees.list, {
          kind: "physician",
          paginationOpts: page,
        }),
      ).rejects.toThrow("Unauthorized");
      await expect(
        client.query(api.signees.detail, { id: row!._id }),
      ).rejects.toThrow("Unauthorized");
      await expect(
        client.mutation(api.signees.updateStatus, {
          id: row!._id,
          status: "welcomed",
        }),
      ).rejects.toThrow("Unauthorized");
      await expect(
        client.mutation(api.signees.addNote, {
          id: row!._id,
          body: "Forbidden",
        }),
      ).rejects.toThrow("Unauthorized");
    }
  });
  test("admin sees every field, updates status and records private notes", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.signees.submit, submission());
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "Admin" });
      await ctx.db.insert("admins", { userId: id });
      return id;
    });
    const sessionId=await t.run(ctx=>ctx.db.insert("authSessions",{userId,expirationTime:Date.now()+3600000}));
    const admin = t.withIdentity({ subject: `${userId}|${sessionId}` });
    const rows = await admin.query(api.signees.list, {
      kind: "physician",
      paginationOpts: page,
    });
    const id = rows.page[0]._id;
    await admin.mutation(api.signees.updateStatus, { id, status: "contacted" });
    await admin.mutation(api.signees.addNote, {
      id,
      body: "Discussed availability.",
    });
    const detail = await admin.query(api.signees.detail, { id });
    expect(detail.signee?.status).toBe("contacted");
    expect(detail.notes[0].body).toBe("Discussed availability.");
    expect(detail.signee?.answers.languages).toBe("Arabic, English");
  });
  test("rate limits repeat submissions but allows an idempotent retry", async () => {
    const t = convexTest(schema, modules);
    const data = submission();
    await t.mutation(internal.signees.submit, data);
    for (let i = 0; i < 4; i++)
      await t.mutation(internal.signees.submit, submission());
    await expect(
      t.mutation(internal.signees.submit, submission()),
    ).rejects.toThrow("Too many");
    await expect(t.mutation(internal.signees.submit, data)).resolves.toEqual({
      ok: true,
    });
  });
  test("hospital records preserve all partnership details", async () => {
    const t = convexTest(schema, modules);
    const answers = {
      contact_name: "QA Partner",
      email: "partner@example.invalid",
      organization: "QA Institution",
      role: "Coordinator",
      location: "Test City",
      interests: "Teaching",
      needs: "Mentorship",
    };
    await t.mutation(internal.signees.submit, {
      ...submission(),
      kind: "hospital",
      answers,
    });
    const row = await t.run((ctx) => ctx.db.query("signees").first());
    expect((await decrypt(row!.encrypted!,`signee:${row!.submissionKey}`)).answers).toEqual(answers);
    expect(row?.kind).toBe("hospital");
  });
});

describe("Public directory consent and privacy", () => {
  test("publishes only a consenting physician's name, never private answers", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.signees.submit, submission());
    const consented = submission();
    await t.mutation(internal.signees.submit, { ...consented, answers: { ...consented.answers, public_directory: "yes" } });
    const result = await t.query(internal.signees.publicMembers, { cursor: null });
    expect(result).toEqual({ members: [{ name: "QA Physician" }], cursor: null });
    const rows = await t.run(ctx => ctx.db.query("signees").collect());
    expect(rows[1].publicConsentAt).toBeGreaterThan(0);
    expect(rows[1].publicConsentVersion).toBe("public-name-only-2026-09-28");
    expect(rows[0].publicListing).toBe(false);
    await t.mutation(internal.signees.submit, { ...consented, answers: { ...consented.answers, public_directory: "yes" } });
    expect((await t.query(internal.signees.publicMembers, { cursor: null })).members).toHaveLength(1);
  });
  test("legacy, malformed choices and hospital inquiries are private", async () => {
    const t = convexTest(schema, modules);
    const data = submission();
    await t.run(ctx => ctx.db.insert("signees", {kind:"physician", name:"Legacy", email:"private@example.invalid", answers:data.answers, status:"new", submissionKey:crypto.randomUUID(), updatedAt:Date.now(), consentVersion:"old"}));
    await t.mutation(internal.signees.submit, {...data, answers:{...data.answers,public_directory:"true"}});
    await t.mutation(internal.signees.submit, {...submission(),kind:"hospital",answers:{contact_name:"Private hospital",email:"hospital@example.invalid",organization:"Hospital",role:"Lead",location:"City",interests:"Teaching",public_directory:"yes"}});
    expect((await t.query(internal.signees.publicMembers,{cursor:null})).members).toEqual([]);
  });
  test("only admins can remove names, and archiving also unpublishes", async () => {
    const t = convexTest(schema, modules);
    const data = submission();
    await t.mutation(internal.signees.submit, {...data,answers:{...data.answers,public_directory:"yes"}});
    const row = await t.run(ctx => ctx.db.query("signees").first());
    await expect(t.mutation(api.signees.hidePublicListing,{id:row!._id})).rejects.toThrow("Unauthorized");
    const userId = await t.run(async ctx => {const id=await ctx.db.insert("users",{name:"Admin"});await ctx.db.insert("admins",{userId:id});return id;});
    const sessionId=await t.run(ctx=>ctx.db.insert("authSessions",{userId,expirationTime:Date.now()+3600000}));
    const admin=t.withIdentity({subject:`${userId}|${sessionId}`});
    await admin.mutation(api.signees.hidePublicListing,{id:row!._id});
    expect((await t.query(internal.signees.publicMembers,{cursor:null})).members).toEqual([]);
    const second=submission();
    await t.mutation(internal.signees.submit,{...second,answers:{...second.answers,public_directory:"yes"}});
    const visible = await t.run(ctx=>ctx.db.query("signees").withIndex("by_public_listing",q=>q.eq("publicListing",true)).first());
    await admin.mutation(api.signees.updateStatus,{id:visible!._id,status:"archived"});
    expect((await t.query(internal.signees.publicMembers,{cursor:null})).members).toEqual([]);
  });
  test("HTTP directory exposes names only and rejects an oversized cursor", async () => {
    const t=convexTest(schema, modules), data=submission();
    await t.mutation(internal.signees.submit,{...data,answers:{...data.answers,public_directory:"yes"}});
    const response=await t.fetch('/members');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({members:[{name:'QA Physician'}],cursor:null});
    expect((await t.fetch('/members?cursor='+ 'x'.repeat(4097))).status).toBe(400);
  });
});
