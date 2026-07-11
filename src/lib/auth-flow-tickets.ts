import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveAuthSecret } from "@/lib/auth-secret";

type TicketKind = "auth" | "challenge";

type BaseTicket<TKind extends TicketKind> = {
  type: TKind;
  exp: number;
};

export type AuthTicketPayload = BaseTicket<"auth"> & {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type ChallengeName =
  | "CUSTOM_CHALLENGE"
  | "EMAIL_OTP"
  | "MFA_SETUP"
  | "NEW_PASSWORD_REQUIRED"
  | "SELECT_CHALLENGE"
  | "SELECT_MFA_TYPE"
  | "SMS_MFA"
  | "SMS_OTP"
  | "SOFTWARE_TOKEN_MFA";

export type ChallengeTicketPayload = BaseTicket<"challenge"> & {
  email: string;
  challengeName: ChallengeName;
  session: string;
  challengeParameters: Record<string, string>;
  totpSecretCode?: string;
  totpIssuer?: string;
};

export type SafeChallenge = {
  challengeName: ChallengeName;
  availableChallenges: string[];
  deliveryDestination?: string;
  deliveryMedium?: string;
  requiredAttributes: string[];
  totpIssuer?: string;
  totpSecretCode?: string;
};

function sign(data: string) {
  return createHmac("sha256", resolveAuthSecret()).update(data).digest("base64url");
}

function encode<T extends AuthTicketPayload | ChallengeTicketPayload>(payload: T) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode<T extends AuthTicketPayload | ChallengeTicketPayload>(ticket: string, expectedType: T["type"]) {
  const [body, signature] = ticket.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = sign(body);

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;

    if (payload.type !== expectedType || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createAuthTicket(payload: Omit<AuthTicketPayload, "exp" | "type">) {
  return encode<AuthTicketPayload>({
    ...payload,
    type: "auth",
    exp: Date.now() + 5 * 60 * 1000,
  });
}

export function readAuthTicket(ticket: string) {
  return decode<AuthTicketPayload>(ticket, "auth");
}

export function createChallengeTicket(payload: Omit<ChallengeTicketPayload, "exp" | "type">) {
  return encode<ChallengeTicketPayload>({
    ...payload,
    type: "challenge",
    exp: Date.now() + 15 * 60 * 1000,
  });
}

export function readChallengeTicket(ticket: string) {
  return decode<ChallengeTicketPayload>(ticket, "challenge");
}

function parseStringList(value?: string) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fallback to CSV-like parsing below.
  }

  return value
    .split(",")
    .map((item) => item.replace(/[[\]"]/g, "").trim())
    .filter(Boolean);
}

export function toSafeChallenge(payload: ChallengeTicketPayload): SafeChallenge {
  const availableChallenges = parseStringList(payload.challengeParameters.AVAILABLE_CHALLENGES);
  const selectableMfa = parseStringList(payload.challengeParameters.MFAS_CAN_CHOOSE);
  const mfasCanSetup = parseStringList(payload.challengeParameters.MFAS_CAN_SETUP);

  return {
    challengeName: payload.challengeName,
    availableChallenges: availableChallenges.length > 0 ? availableChallenges : selectableMfa.length > 0 ? selectableMfa : mfasCanSetup,
    deliveryDestination:
      payload.challengeParameters.CODE_DELIVERY_DESTINATION ?? payload.challengeParameters.DESTINATION,
    deliveryMedium:
      payload.challengeParameters.CODE_DELIVERY_DELIVERY_MEDIUM ?? payload.challengeParameters.DELIVERY_MEDIUM,
    requiredAttributes: parseStringList(payload.challengeParameters.requiredAttributes),
    totpIssuer: payload.totpIssuer,
    totpSecretCode: payload.totpSecretCode,
  };
}
