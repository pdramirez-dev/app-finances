"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
function json(statusCode, payload) {
    return {
        statusCode,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    };
}
async function handler(event) {
    const payload = event.body ? JSON.parse(event.body) : null;
    const invoiceId = event.invoiceId ?? payload?.invoiceId;
    if (!invoiceId) {
        return json(400, { error: "invoiceId is required" });
    }
    return json(501, {
        error: "Not implemented",
        message: "Use Playwright + @sparticuz/chromium in this Lambda to render the invoice HTML, generate PDF, upload to S3, and persist metadata in DynamoDB.",
        selectedEngine: process.env.PDF_ENGINE ?? "playwright",
        invoiceId,
        stage: process.env.STAGE ?? "unknown",
    });
}
