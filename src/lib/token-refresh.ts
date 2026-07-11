export type AuthToken = {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  idTokenExpiresAt?: number;
  error?: "RefreshAccessTokenError";
};

export function isExpiringSoon(
  expiresAt: number | undefined,
  now: number,
  skewMs: number,
): boolean {
  if (!expiresAt) {
    return true;
  }

  return expiresAt - now <= skewMs;
}

export function applyRefreshedTokens(
  token: AuthToken,
  refreshed: { idToken: string; accessToken: string; expiresIn: number },
  now: number,
): AuthToken {
  return {
    ...token,
    idToken: refreshed.idToken,
    accessToken: refreshed.accessToken,
    idTokenExpiresAt: now + refreshed.expiresIn * 1000,
    error: undefined,
  };
}
