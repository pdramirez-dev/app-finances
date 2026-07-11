import { expect, test } from "vitest";

import { applyRefreshedTokens, isExpiringSoon } from "./token-refresh";

test("isExpiringSoon honors the skew window", () => {
  const now = 1_000_000;
  expect(isExpiringSoon(now + 30_000, now, 60_000)).toBe(true);
  expect(isExpiringSoon(now + 120_000, now, 60_000)).toBe(false);
  expect(isExpiringSoon(undefined, now, 60_000)).toBe(true);
});

test("applyRefreshedTokens replaces tokens and expiration", () => {
  expect(
    applyRefreshedTokens(
      { idToken: "old", accessToken: "old-access", error: "RefreshAccessTokenError" },
      { idToken: "new", accessToken: "new-access", expiresIn: 3600 },
      1_000_000,
    ),
  ).toMatchObject({
    idToken: "new",
    accessToken: "new-access",
    idTokenExpiresAt: 4_600_000,
    error: undefined,
  });
});
