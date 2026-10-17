import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

import { downloadInvoiceDeps } from "./lib/aws-deps";
import { verifyInvoiceLinkToken } from "./lib/invoice-link-token";

export type DownloadInvoiceDeps = {
  getLinkSecret(): Promise<string>;
  presignDownload(key: string, filename: string, expiresInSeconds: number): Promise<string>;
  now(): number;
};

/** The S3 URL is only minted per click and lives just long enough to start the download. */
export const PRESIGNED_TTL_SECONDS = 300;

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

function expiredPage(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 410,
    headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
    body: `<!doctype html><html lang="es"><meta charset="utf-8"><title>Enlace no disponible</title>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:32rem;margin:4rem auto;color:#0f172a">
<h1 style="font-size:1.25rem">Este enlace ya no está disponible</h1>
<p>El enlace de la factura venció o no es válido. Pide al emisor que te la envíe de nuevo.</p></body></html>`,
  };
}

export function createDownloadInvoiceHandler(deps: DownloadInvoiceDeps) {
  return async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    if (event.requestContext?.http?.method && !["GET", "HEAD"].includes(event.requestContext.http.method)) {
      return { statusCode: 405, headers: { ...SECURITY_HEADERS, allow: "GET, HEAD" }, body: "" };
    }
    const token = event.queryStringParameters?.t ?? "";
    const claims = verifyInvoiceLinkToken(token, await deps.getLinkSecret(), deps.now());
    if (!claims) return expiredPage();

    const url = await deps.presignDownload(claims.key, claims.filename, PRESIGNED_TTL_SECONDS);
    return { statusCode: 302, headers: { ...SECURITY_HEADERS, location: url }, body: "" };
  };
}

let productionHandler: ((event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>) | undefined;

export async function handler(event: APIGatewayProxyEventV2) {
  productionHandler ??= createDownloadInvoiceHandler(downloadInvoiceDeps());
  return productionHandler(event);
}
