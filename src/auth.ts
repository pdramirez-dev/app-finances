import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { decode as decodeJwt } from "next-auth/jwt";
import { z } from "zod";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function cognitoRegionFromIssuer(issuer: string) {
  const match = issuer.match(/^https:\/\/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com\/.+$/);

  if (!match?.[1]) {
    throw new Error("AUTH_COGNITO_ISSUER is invalid");
  }

  return match[1];
}

function decodeTokenPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("Invalid token payload");
  }

  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as {
    sub?: string;
    email?: string;
    name?: string;
    "cognito:username"?: string;
  };
}

async function authenticateWithCognito(email: string, password: string) {
  const issuer = requiredEnv("AUTH_COGNITO_ISSUER");
  const region = cognitoRegionFromIssuer(issuer);
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    cache: "no-store",
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: requiredEnv("AUTH_COGNITO_ID"),
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    AuthenticationResult?: {
      AccessToken?: string;
      IdToken?: string;
    };
    ChallengeName?: string;
  };

  if (payload.ChallengeName) {
    return null;
  }

  const accessToken = payload.AuthenticationResult?.AccessToken;
  const idToken = payload.AuthenticationResult?.IdToken;

  if (!accessToken || !idToken) {
    return null;
  }

  const claims = decodeTokenPayload(idToken);
  const subject = claims.sub ?? claims["cognito:username"] ?? email;

  return {
    id: subject,
    email: claims.email ?? email,
    name: claims.name ?? claims.email ?? email,
    accessToken,
    idToken,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        return authenticateWithCognito(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = String(user.id);
        token.accessToken = typeof user.accessToken === "string" ? user.accessToken : undefined;
        token.idToken = typeof user.idToken === "string" ? user.idToken : undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
      }

      session.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      session.idToken = typeof token.idToken === "string" ? token.idToken : undefined;
      return session;
    },
  },
});
