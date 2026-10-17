"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESIGNED_TTL_SECONDS = void 0;
exports.createDownloadInvoiceHandler = createDownloadInvoiceHandler;
exports.handler = handler;
const aws_deps_1 = require("./lib/aws-deps");
const invoice_link_token_1 = require("./lib/invoice-link-token");
/** The S3 URL is only minted per click and lives just long enough to start the download. */
exports.PRESIGNED_TTL_SECONDS = 300;
const SECURITY_HEADERS = {
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
};
function expiredPage() {
    return {
        statusCode: 410,
        headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
        body: `<!doctype html><html lang="es"><meta charset="utf-8"><title>Enlace no disponible</title>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:32rem;margin:4rem auto;color:#0f172a">
<h1 style="font-size:1.25rem">Este enlace ya no está disponible</h1>
<p>El enlace de la factura venció o no es válido. Pide al emisor que te la envíe de nuevo.</p></body></html>`,
    };
}
function createDownloadInvoiceHandler(deps) {
    return async function handler(event) {
        if (event.requestContext?.http?.method && !["GET", "HEAD"].includes(event.requestContext.http.method)) {
            return { statusCode: 405, headers: { ...SECURITY_HEADERS, allow: "GET, HEAD" }, body: "" };
        }
        const token = event.queryStringParameters?.t ?? "";
        const claims = (0, invoice_link_token_1.verifyInvoiceLinkToken)(token, await deps.getLinkSecret(), deps.now());
        if (!claims)
            return expiredPage();
        const url = await deps.presignDownload(claims.key, claims.filename, exports.PRESIGNED_TTL_SECONDS);
        return { statusCode: 302, headers: { ...SECURITY_HEADERS, location: url }, body: "" };
    };
}
let productionHandler;
async function handler(event) {
    productionHandler ??= createDownloadInvoiceHandler((0, aws_deps_1.downloadInvoiceDeps)());
    return productionHandler(event);
}
