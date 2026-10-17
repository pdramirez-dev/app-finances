import { expect, test } from "vitest";
import { signInvoiceLinkToken, verifyInvoiceLinkToken } from "./invoice-link-token";

const SECRET = "test-secret-with-enough-entropy-0123456789";
const claims = { key: "accounts/ACC/invoices/INV/1.pdf", accountId: "ACC", invoiceId: "INV", filename: "Factura-A-0050.pdf" };

test("a signed token verifies and returns its claims until it expires", () => {
  const token = signInvoiceLinkToken({ ...claims, expiresAt: 2_000 }, SECRET);
  expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(verifyInvoiceLinkToken(token, SECRET, 1_999)).toEqual({ ...claims, expiresAt: 2_000 });
  expect(verifyInvoiceLinkToken(token, SECRET, 2_000)).toBeNull();
});

test("tampered payloads, foreign secrets and garbage are rejected", () => {
  const token = signInvoiceLinkToken({ ...claims, expiresAt: 2_000 }, SECRET);
  const [, signature] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ ...claims, key: "accounts/OTHER/x.pdf", expiresAt: 2_000 })).toString("base64url");

  expect(verifyInvoiceLinkToken(`${forgedPayload}.${signature}`, SECRET, 1_000)).toBeNull();
  expect(verifyInvoiceLinkToken(token, "another-secret-another-secret-0000", 1_000)).toBeNull();
  expect(verifyInvoiceLinkToken("not-a-token", SECRET, 1_000)).toBeNull();
  expect(verifyInvoiceLinkToken(`${token}x`, SECRET, 1_000)).toBeNull();
  expect(verifyInvoiceLinkToken("", SECRET, 1_000)).toBeNull();
});

test("a token only grants keys inside its own account prefix", () => {
  const token = signInvoiceLinkToken({ ...claims, key: "accounts/OTHER/invoices/INV/1.pdf", expiresAt: 2_000 }, SECRET);
  expect(verifyInvoiceLinkToken(token, SECRET, 1_000)).toBeNull();
});

test("refuses to sign with a weak secret", () => {
  expect(() => signInvoiceLinkToken({ ...claims, expiresAt: 2_000 }, "short")).toThrow(/secret/i);
});
