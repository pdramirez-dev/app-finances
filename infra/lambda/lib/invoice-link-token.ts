import { createHmac, timingSafeEqual } from "node:crypto";

// Stable, emailable download links: the token names one PDF snapshot in S3 and
// expires on its own. The download Lambda checks it and only then signs a
// short-lived S3 URL, so links outlive the signer's temporary credentials.
export type InvoiceLinkClaims = {
  key: string;
  accountId: string;
  invoiceId: string;
  filename: string;
  /** Unix epoch milliseconds. */
  expiresAt: number;
};

const MIN_SECRET_LENGTH = 32;

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}

function assertSecret(secret: string) {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("Invoice link secret is missing or too short");
  }
}

export function signInvoiceLinkToken(claims: InvoiceLinkClaims, secret: string): string {
  assertSecret(secret);
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifyInvoiceLinkToken(token: string, secret: string, now = Date.now()): InvoiceLinkClaims | null {
  assertSecret(secret);
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payload, providedSignature] = parts;
  const expected = signature(payload, secret);
  const provided = Buffer.from(providedSignature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let claims: InvoiceLinkClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof claims?.key !== "string"
    || typeof claims.accountId !== "string"
    || typeof claims.invoiceId !== "string"
    || typeof claims.filename !== "string"
    || typeof claims.expiresAt !== "number"
  ) {
    return null;
  }
  if (now >= claims.expiresAt) return null;
  if (!claims.key.startsWith(`accounts/${claims.accountId}/`)) return null;

  return claims;
}
