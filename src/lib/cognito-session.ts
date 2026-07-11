import "server-only";

import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

import { resolveAuthSecret } from "@/lib/auth-secret";
import { refreshCognitoTokens } from "@/lib/cognito-auth";
import { isExpiringSoon } from "@/lib/token-refresh";

export async function getServerIdToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const request = {
    headers: new Headers({ cookie: cookieStore.toString() }),
  } as Request;
  const token = await getToken({ req: request, secret: resolveAuthSecret() });
  if (!token || typeof token.idToken !== "string") {
    return null;
  }
  const idToken = token.idToken;

  if (!isExpiringSoon(token.idTokenExpiresAt, Date.now(), 5 * 60 * 1000)) {
    return idToken;
  }

  if (typeof token.refreshToken !== "string" || token.refreshToken.length === 0) {
    return null;
  }

  try {
    return (await refreshCognitoTokens(token.refreshToken)).idToken;
  } catch {
    return null;
  }
}
