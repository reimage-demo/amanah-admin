import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { hashSecret, verifySecret } from "./lib/security";
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      crypto: { hashSecret, verifySecret },
      profile(params) {
        if (params.flow !== "signIn")
          throw new Error("Public registration is disabled.");
        const email = String(params.email || "")
          .trim()
          .toLowerCase();
        if (!email || email.length > 100)
          throw new Error("Invalid credentials");
        return { email };
      },
    }),
  ],
  jwt: { durationMs: 5 * 60 * 1000 },
  session: {
    totalDurationMs: 12 * 60 * 60 * 1000,
    inactiveDurationMs: 30 * 60 * 1000,
  },
  signIn: { maxFailedAttempsPerHour: 5 },
});
