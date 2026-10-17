import { afterEach, expect, test, vi } from "vitest";

import { buildRefreshPayload, resolveCognitoEndpoint } from "./cognito-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

test("Cognito endpoint can target LocalStack", () => {
  vi.stubEnv("AUTH_COGNITO_ENDPOINT_URL", "http://localhost:4566/");

  expect(resolveCognitoEndpoint()).toBe("http://localhost:4566/");
});
