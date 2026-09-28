import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
const http = httpRouter();
auth.addHttpRoutes(http);
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
http.route({
  path: "/join",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers })),
});
http.route({
  path: "/join",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const text = await request.text();
      if (text.length > 12000)
        return new Response(JSON.stringify({ error: "Submission too large" }), {
          status: 413,
          headers,
        });
      const data = JSON.parse(text);
      if (
        !["physician", "hospital"].includes(data.kind) ||
        !data.answers ||
        data.answers._gotcha
      )
        throw new Error("Invalid submission");
      const rawIp =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        "unknown";
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(rawIp),
      );
      const rateKey = `ip:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
      await ctx.runMutation(internal.signees.submit, {
        kind: data.kind,
        answers: data.answers,
        submissionKey: data.submissionKey,
        rateKey,
      });
      return new Response(JSON.stringify({ ok: true }), { headers });
    } catch {
      return new Response(
        JSON.stringify({
          error:
            "We could not receive your details. Check your answers, or try again later.",
        }),
        { status: 400, headers },
      );
    }
  }),
});
export default http;
