import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
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
    expect(rows[0].answers).toEqual(data.answers);
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
    const admin = t.withIdentity({ subject: `${userId}|session` });
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
    expect(row?.answers).toEqual(answers);
    expect(row?.kind).toBe("hospital");
  });
});
