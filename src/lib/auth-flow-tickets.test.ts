import { beforeAll, expect, test } from "vitest";

import { createAuthTicket, readAuthTicket } from "./auth-flow-tickets";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-please-change";
});

test("auth ticket carries refresh metadata", () => {
  const ticket = createAuthTicket({
    user: { id: "u1", email: "u@example.com", name: "User" },
    accessToken: "access",
    idToken: "id",
    refreshToken: "refresh",
    expiresIn: 1800,
  });

  expect(readAuthTicket(ticket)).toMatchObject({
    refreshToken: "refresh",
    expiresIn: 1800,
  });
});
