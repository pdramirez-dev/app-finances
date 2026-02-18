import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { decode as decodeJwt } from "next-auth/jwt";
import { createHmac } from "node:crypto";
import { z } from "zod";

function resolveAuthSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-auth-secret-change-me";
  }

  throw new Error("Missing required environment variable: AUTH_SECRET (or NEXTAUTH_SECRET)");
}

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

function cognitoRegionFromUserPoolId(userPoolId: string) {
  const match = userPoolId.match(/^([a-z0-9-]+)_[A-Za-z0-9-]+$/);

  if (!match?.[1]) {
    throw new Error("AUTH_COGNITO_USER_POOL_ID is invalid");
  }

  return match[1];
}

function resolveCognitoRegion() {
  return cognitoRegionFromUserPoolId(requiredEnv("AUTH_COGNITO_USER_POOL_ID"));
}

function resolveCognitoClientId() {
  return requiredEnv("AUTH_COGNITO_USER_POOL_CLIENT_ID");
}

function resolveCognitoClientSecret() {
  const secret = process.env.AUTH_COGNITO_SECRET;

  if (!secret) {
    return null;
  }

  return secret;
}

function buildCognitoSecretHash({
  username,
  clientId,
  clientSecret,
}: {
  username: string;
  clientId: string;
  clientSecret: string;
}) {
  return createHmac("sha256", clientSecret).update(`${username}${clientId}`).digest("base64");
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
  const region = resolveCognitoRegion();
  const clientId = resolveCognitoClientId();
  const clientSecret = resolveCognitoClientSecret();
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  const authParameters: Record<string, string> = {
    USERNAME: email,
    PASSWORD: password,
  };

  if (clientSecret) {
    authParameters.SECRET_HASH = buildCognitoSecretHash({
      username: email,
      clientId,
      clientSecret,
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    cache: "no-store",
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: authParameters,
    }),
  });

  if (!response.ok) {
    const cognitoError = (await response.json().catch(() => null)) as
      | { message?: string; __type?: string }
      | null;

    if (cognitoError?.message?.toLowerCase().includes("secret hash")) {
      throw new Error(
        "Cognito rejected the request due to SECRET_HASH. Configure AUTH_COGNITO_SECRET with the app client secret from AWS Cognito.",
      );
    }

    const type = cognitoError?.__type ? `${cognitoError.__type}: ` : "";
    const message = cognitoError?.message ?? "Unknown Cognito error";
    throw new Error(`Cognito InitiateAuth failed (${response.status}): ${type}${message}`);
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
