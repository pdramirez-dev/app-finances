import { ExecuteStatementCommand, RDSDataClient, type SqlParameter } from "@aws-sdk/client-rds-data";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { SqlRequest } from "../../graphql/resolvers/src/lib/sql-builders";
import type { DownloadInvoiceDeps } from "../download-invoice";
import type { SendInvoiceEmailDeps } from "../send-invoice-email";

// Parameters compared against uuid columns need an explicit hint over the Data API.
const UUID_PARAMS = new Set(["acc", "invoiceId", "reminderId"]);

export function toSqlParameters(params: Record<string, unknown>): SqlParameter[] {
  return Object.entries(params).map(([name, value]): SqlParameter => {
    const typeHint = UUID_PARAMS.has(name) ? "UUID" : undefined;
    if (value === null || value === undefined) return { name, value: { isNull: true }, typeHint };
    if (typeof value === "number") {
      return { name, value: Number.isInteger(value) ? { longValue: value } : { doubleValue: value }, typeHint };
    }
    if (typeof value === "boolean") return { name, value: { booleanValue: value }, typeHint };
    return { name, value: { stringValue: String(value) }, typeHint };
  });
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function cachedSecret(client: SecretsManagerClient, secretArn: string) {
  let secret: Promise<string> | undefined;
  return () => {
    secret ??= client.send(new GetSecretValueCommand({ SecretId: secretArn })).then((result) => {
      if (!result.SecretString) throw new Error("Invoice link secret is empty");
      return result.SecretString;
    });
    return secret;
  };
}

export function sendInvoiceEmailDeps(): SendInvoiceEmailDeps {
  const rds = new RDSDataClient({});
  const s3 = new S3Client({});
  const ses = new SESv2Client({});
  const bucket = requireEnv("INVOICE_PDFS_BUCKET_NAME");

  return {
    async runSql(request: SqlRequest) {
      const result = await rds.send(new ExecuteStatementCommand({
        resourceArn: requireEnv("DB_CLUSTER_ARN"),
        secretArn: requireEnv("DB_SECRET_ARN"),
        database: process.env.DB_NAME ?? "app_nexo",
        sql: request.statement,
        parameters: toSqlParameters(request.params),
        formatRecordsAs: "JSON",
      }));
      return result.formattedRecords ? JSON.parse(result.formattedRecords) : [];
    },
    async putPdf(key, body, filename) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/pdf",
        ContentDisposition: `attachment; filename="${filename}"`,
      }));
    },
    async sendEmail(email) {
      await ses.send(new SendEmailCommand({
        FromEmailAddress: email.from,
        Destination: { ToAddresses: [email.to] },
        ReplyToAddresses: email.replyTo ? [email.replyTo] : undefined,
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: email.html, Charset: "UTF-8" },
              Text: { Data: email.text, Charset: "UTF-8" },
            },
          },
        },
      }));
    },
    getLinkSecret: cachedSecret(new SecretsManagerClient({}), requireEnv("INVOICE_LINK_SECRET_ARN")),
    sender: process.env.INVOICE_EMAIL_FROM || undefined,
    downloadBaseUrl: requireEnv("INVOICE_DOWNLOAD_BASE_URL"),
    now: () => new Date(),
  };
}

export function downloadInvoiceDeps(): DownloadInvoiceDeps {
  const s3 = new S3Client({});
  const bucket = requireEnv("INVOICE_PDFS_BUCKET_NAME");
  return {
    getLinkSecret: cachedSecret(new SecretsManagerClient({}), requireEnv("INVOICE_LINK_SECRET_ARN")),
    presignDownload(key, filename, expiresInSeconds) {
      return getSignedUrl(s3, new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: "application/pdf",
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }), { expiresIn: expiresInSeconds });
    },
    now: () => Date.now(),
  };
}
