import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { decode as decodeJwt } from "next-auth/jwt";
import { z } from "zod";

import { readAuthTicket } from "@/lib/auth-flow-tickets";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { refreshCognitoTokens } from "@/lib/cognito-auth";
import { applyRefreshedTokens, isExpiringSoon } from "@/lib/token-refresh";

const credentialsSchema = z.object({
  mode: z.literal("ticket"),
  ticket: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveAuthSecret(),
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  jwt: {
    async decode(params) {
      try {
        return await decodeJwt(params);
      } catch {
        // Old/invalid cookies should be treated as unauthenticated, not as a hard auth error.
        return null;
      }
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        mode: { label: "Mode", type: "text" },
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const ticket = readAuthTicket(parsed.data.ticket);

        if (!ticket) {
          return null;
        }

        return {
          id: ticket.user.id,
          email: ticket.user.email,
          name: ticket.user.name,
          accessToken: ticket.accessToken,
          idToken: ticket.idToken,
          refreshToken: ticket.refreshToken,
          idTokenExpiresAt: Date.now() + ticket.expiresIn * 1000,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = String(user.id);
        token.accessToken = typeof user.accessToken === "string" ? user.accessToken : undefined;
        token.idToken = typeof user.idToken === "string" ? user.idToken : undefined;
        token.refreshToken = typeof user.refreshToken === "string" ? user.refreshToken : undefined;
        token.idTokenExpiresAt =
          typeof user.idTokenExpiresAt === "number"
            ? user.idTokenExpiresAt
            : Date.now() + 60 * 60 * 1000;
        return token;
      }

      if (!isExpiringSoon(token.idTokenExpiresAt, Date.now(), 5 * 60 * 1000)) {
        return token;
      }

      try {
        const refreshed = await refreshCognitoTokens(token.refreshToken ?? "");
        return applyRefreshedTokens(token, refreshed, Date.now());
      } catch {
        return { ...token, error: "RefreshAccessTokenError" as const };
      }
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
      }

      session.error = token.error;
      return session;
    },
  },
});
