import type { APIGatewayProxyResultV2 } from "aws-lambda";

type GenerateInvoicePdfEvent = {
  invoiceId?: string;
  body?: string | null;
};

type GenerateInvoicePdfRequest = {
  invoiceId: string;
};

function json(statusCode: number, payload: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export async function handler(event: GenerateInvoicePdfEvent): Promise<APIGatewayProxyResultV2> {
  const payload = event.body ? (JSON.parse(event.body) as GenerateInvoicePdfRequest) : null;
  const invoiceId = event.invoiceId ?? payload?.invoiceId;

  if (!invoiceId) {
    return json(400, { error: "invoiceId is required" });
  }

  return json(501, {
    error: "Not implemented",
    message:
      "Use Playwright + @sparticuz/chromium in this Lambda to render the invoice HTML, generate PDF, upload to S3, and persist metadata in DynamoDB.",
    selectedEngine: process.env.PDF_ENGINE ?? "playwright",
    invoiceId,
    stage: process.env.STAGE ?? "unknown",
  });
}
