"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signInvoiceLinkToken = signInvoiceLinkToken;
exports.verifyInvoiceLinkToken = verifyInvoiceLinkToken;
const node_crypto_1 = require("node:crypto");
const MIN_SECRET_LENGTH = 32;
function signature(payload, secret) {
    return (0, node_crypto_1.createHmac)("sha256", secret).update(payload).digest();
}
function assertSecret(secret) {
    if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
        throw new Error("Invoice link secret is missing or too short");
    }
}
function signInvoiceLinkToken(claims, secret) {
    assertSecret(secret);
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `${payload}.${signature(payload, secret).toString("base64url")}`;
}
function verifyInvoiceLinkToken(token, secret, now = Date.now()) {
    assertSecret(secret);
    const parts = typeof token === "string" ? token.split(".") : [];
    if (parts.length !== 2 || !parts[0] || !parts[1])
        return null;
    const [payload, providedSignature] = parts;
    const expected = signature(payload, secret);
    const provided = Buffer.from(providedSignature, "base64url");
    if (provided.length !== expected.length || !(0, node_crypto_1.timingSafeEqual)(provided, expected))
        return null;
    let claims;
    try {
        claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    }
    catch {
        return null;
    }
    if (typeof claims?.key !== "string"
        || typeof claims.accountId !== "string"
        || typeof claims.invoiceId !== "string"
        || typeof claims.filename !== "string"
        || typeof claims.expiresAt !== "number") {
        return null;
    }
    if (now >= claims.expiresAt)
        return null;
    if (!claims.key.startsWith(`accounts/${claims.accountId}/`))
        return null;
    return claims;
}
