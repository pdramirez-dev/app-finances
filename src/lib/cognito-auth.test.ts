import { expect, test } from "vitest";

import { buildRefreshPayload } from "./cognito-auth";

test("refresh payload uses REFRESH_TOKEN_AUTH", () => {
  expect(buildRefreshPayload("client", "refresh", null)).toEqual({
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: "client",
    AuthParameters: { REFRESH_TOKEN: "refresh" },
  });
});

test("refresh payload includes a secret hash when supplied", () => {
  expect(buildRefreshPayload("client", "refresh", "hash").AuthParameters.SECRET_HASH).toBe("hash");
});
