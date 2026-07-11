import "server-only";

import { createHmac } from "node:crypto";

import type { ChallengeName } from "@/lib/auth-flow-tickets";

type CognitoChallengeResult = {
  kind: "challenge";
  email: string;
  challengeName: ChallengeName;
  challengeParameters: Record<string, string>;
  session: string;
};

type CognitoSuccessResult = {
  kind: "success";
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export type CognitoAuthResult = CognitoChallengeResult | CognitoSuccessResult;

export class CognitoApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CognitoApiError";
  }
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

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

function buildAuthParameters(email: string, password?: string) {
  const clientId = resolveCognitoClientId();
  const clientSecret = resolveCognitoClientSecret();
  const authParameters: Record<string, string> = {
    USERNAME: email,
  };

  if (password) {
    authParameters.PASSWORD = password;
  }

  if (clientSecret) {
    authParameters.SECRET_HASH = buildCognitoSecretHash({
      username: email,
      clientId,
      clientSecret,
    });
  }

  return {
    clientId,
    authParameters,
  };
}

async function callCognito<T>(target: string, body: Record<string, unknown>): Promise<T> {
  const endpoint = `https://cognito-idp.${resolveCognitoRegion()}.amazonaws.com/`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const cognitoError = (await response.json().catch(() => null)) as
      | { __type?: string; message?: string }
      | null;

    throw new CognitoApiError(
      cognitoError?.message ?? `Cognito ${target} failed`,
      cognitoError?.__type?.split("#").at(-1) ?? "UnknownCognitoError",
    );
  }

  return (await response.json().catch(() => ({}))) as T;
}

function normalizeAuthResult(email: string, payload: {
  AuthenticationResult?: {
    AccessToken?: string;
    IdToken?: string;
    RefreshToken?: string;
    ExpiresIn?: number;
  };
  ChallengeName?: string;
  ChallengeParameters?: Record<string, string>;
  Session?: string;
}) {
  if (payload.ChallengeName && payload.Session) {
    return {
      kind: "challenge",
      email,
      challengeName: payload.ChallengeName as ChallengeName,
      challengeParameters: payload.ChallengeParameters ?? {},
      session: payload.Session,
    } satisfies CognitoChallengeResult;
  }

  const accessToken = payload.AuthenticationResult?.AccessToken;
  const idToken = payload.AuthenticationResult?.IdToken;

  if (!accessToken || !idToken) {
    throw new CognitoApiError("Cognito returned an incomplete authentication result.", "IncompleteAuthResult");
  }

  const claims = decodeTokenPayload(idToken);
  const subject = claims.sub ?? claims["cognito:username"] ?? email;

  return {
    kind: "success",
    accessToken,
    idToken,
    refreshToken: payload.AuthenticationResult?.RefreshToken ?? "",
    expiresIn: payload.AuthenticationResult?.ExpiresIn ?? 3600,
    user: {
      id: subject,
      email: claims.email ?? email,
      name: claims.name ?? claims.email ?? email,
    },
  } satisfies CognitoSuccessResult;
}

export async function authenticateWithPassword(email: string, password: string): Promise<CognitoAuthResult> {
  const { clientId, authParameters } = buildAuthParameters(email, password);
  const payload = await callCognito<{
    AuthenticationResult?: {
      AccessToken?: string;
      IdToken?: string;
      RefreshToken?: string;
      ExpiresIn?: number;
    };
    ChallengeName?: string;
    ChallengeParameters?: Record<string, string>;
    Session?: string;
  }>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: authParameters,
  });

  return normalizeAuthResult(email, payload);
}

function buildChallengeResponses({
  email,
  challengeName,
  challengeParameters,
  code,
  newPassword,
  requiredAttributes,
  selectedChallenge,
}: {
  email: string;
  challengeName: ChallengeName;
  challengeParameters: Record<string, string>;
  code?: string;
  newPassword?: string;
  requiredAttributes?: Record<string, string>;
  selectedChallenge?: string;
}) {
  const { clientId, authParameters } = buildAuthParameters(email);
  const responses: Record<string, string> = {
    USERNAME: email,
    ...authParameters,
  };

  switch (challengeName) {
    case "NEW_PASSWORD_REQUIRED": {
      if (!newPassword) {
        throw new CognitoApiError("New password is required.", "MissingNewPassword");
      }

      responses.NEW_PASSWORD = newPassword;

      for (const [attribute, value] of Object.entries(requiredAttributes ?? {})) {
        if (value.trim().length > 0) {
          responses[`userAttributes.${attribute}`] = value;
        }
      }

      break;
    }
    case "SMS_MFA":
      responses.SMS_MFA_CODE = code ?? "";
      break;
    case "SOFTWARE_TOKEN_MFA":
      responses.SOFTWARE_TOKEN_MFA_CODE = code ?? "";
      break;
    case "EMAIL_OTP":
      responses.EMAIL_OTP_CODE = code ?? "";
      break;
    case "SMS_OTP":
      responses.SMS_OTP_CODE = code ?? "";
      break;
    case "CUSTOM_CHALLENGE":
      responses.ANSWER = code ?? "";
      break;
    case "SELECT_CHALLENGE":
    case "SELECT_MFA_TYPE":
      responses.ANSWER = selectedChallenge ?? "";
      break;
    case "MFA_SETUP":
      break;
    default:
      throw new CognitoApiError(`Unsupported challenge: ${challengeName}`, "UnsupportedChallenge");
  }

  if (
    challengeName !== "MFA_SETUP" &&
    challengeName !== "SELECT_CHALLENGE" &&
    challengeName !== "SELECT_MFA_TYPE" &&
    !code &&
    challengeName !== "NEW_PASSWORD_REQUIRED"
  ) {
    throw new CognitoApiError("Challenge code is required.", "MissingChallengeCode");
  }

  if (
    (challengeName === "SELECT_CHALLENGE" || challengeName === "SELECT_MFA_TYPE") &&
    !selectedChallenge
  ) {
    throw new CognitoApiError("Challenge selection is required.", "MissingChallengeSelection");
  }

  return { clientId, responses, challengeParameters };
}

export async function respondToChallenge({
  email,
  challengeName,
  session,
  challengeParameters,
  code,
  newPassword,
  requiredAttributes,
  selectedChallenge,
}: {
  email: string;
  challengeName: ChallengeName;
  session: string;
  challengeParameters: Record<string, string>;
  code?: string;
  newPassword?: string;
  requiredAttributes?: Record<string, string>;
  selectedChallenge?: string;
}): Promise<CognitoAuthResult> {
  const { clientId, responses } = buildChallengeResponses({
    email,
    challengeName,
    challengeParameters,
    code,
    newPassword,
    requiredAttributes,
    selectedChallenge,
  });

  const payload = await callCognito<{
    AuthenticationResult?: {
      AccessToken?: string;
      IdToken?: string;
      RefreshToken?: string;
      ExpiresIn?: number;
    };
    ChallengeName?: string;
    ChallengeParameters?: Record<string, string>;
    Session?: string;
  }>("RespondToAuthChallenge", {
    ClientId: clientId,
    ChallengeName: challengeName,
    ChallengeResponses: responses,
    Session: session,
  });

  return normalizeAuthResult(email, payload);
}

export async function associateSoftwareToken(session: string) {
  return callCognito<{
    SecretCode?: string;
    Session?: string;
  }>("AssociateSoftwareToken", {
    Session: session,
  });
}

export async function verifySoftwareToken({
  session,
  code,
  deviceName,
}: {
  session: string;
  code: string;
  deviceName?: string;
}) {
  return callCognito<{
    Session?: string;
    Status?: string;
  }>("VerifySoftwareToken", {
    Session: session,
    UserCode: code,
    FriendlyDeviceName: deviceName,
  });
}

export async function forgotPassword(email: string) {
  const { clientId, authParameters } = buildAuthParameters(email);
  return callCognito<{
    CodeDeliveryDetails?: {
      AttributeName?: string;
      DeliveryMedium?: string;
      Destination?: string;
    };
  }>("ForgotPassword", {
    ClientId: clientId,
    Username: email,
    SecretHash: authParameters.SECRET_HASH,
  });
}

export async function confirmForgotPassword({
  email,
  code,
  newPassword,
}: {
  email: string;
  code: string;
  newPassword: string;
}) {
  const { clientId, authParameters } = buildAuthParameters(email);
  await callCognito("ConfirmForgotPassword", {
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
    SecretHash: authParameters.SECRET_HASH,
  });
}

export function buildRefreshPayload(
  clientId: string,
  refreshToken: string,
  secretHash: string | null,
) {
  const authParameters: Record<string, string> = { REFRESH_TOKEN: refreshToken };

  if (secretHash) {
    authParameters.SECRET_HASH = secretHash;
  }

  return {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: clientId,
    AuthParameters: authParameters,
  };
}

export async function refreshCognitoTokens(refreshToken: string) {
  if (!refreshToken) {
    throw new CognitoApiError("Refresh token is missing.", "MissingRefreshToken");
  }

  const clientId = resolveCognitoClientId();
  const payload = await callCognito<{
    AuthenticationResult?: {
      AccessToken?: string;
      IdToken?: string;
      ExpiresIn?: number;
    };
  }>("InitiateAuth", buildRefreshPayload(clientId, refreshToken, null));
  const idToken = payload.AuthenticationResult?.IdToken;
  const accessToken = payload.AuthenticationResult?.AccessToken;

  if (!idToken || !accessToken) {
    throw new CognitoApiError("Refresh returned an incomplete result.", "IncompleteRefresh");
  }

  return {
    idToken,
    accessToken,
    expiresIn: payload.AuthenticationResult?.ExpiresIn ?? 3600,
  };
}
