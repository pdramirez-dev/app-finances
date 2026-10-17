"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSqlParameters = toSqlParameters;
exports.sendInvoiceEmailDeps = sendInvoiceEmailDeps;
exports.downloadInvoiceDeps = downloadInvoiceDeps;
const client_rds_data_1 = require("@aws-sdk/client-rds-data");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client_sesv2_1 = require("@aws-sdk/client-sesv2");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
// Parameters compared against uuid columns need an explicit hint over the Data API.
const UUID_PARAMS = new Set(["acc", "invoiceId", "reminderId"]);
function toSqlParameters(params) {
    return Object.entries(params).map(([name, value]) => {
        const typeHint = UUID_PARAMS.has(name) ? "UUID" : undefined;
        if (value === null || value === undefined)
            return { name, value: { isNull: true }, typeHint };
        if (typeof value === "number") {
            return { name, value: Number.isInteger(value) ? { longValue: value } : { doubleValue: value }, typeHint };
        }
        if (typeof value === "boolean")
            return { name, value: { booleanValue: value }, typeHint };
        return { name, value: { stringValue: String(value) }, typeHint };
    });
}
function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name} is not configured`);
    return value;
}
function cachedSecret(client, secretArn) {
    let secret;
    return () => {
        secret ??= client.send(new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretArn })).then((result) => {
            if (!result.SecretString)
                throw new Error("Invoice link secret is empty");
            return result.SecretString;
        });
        return secret;
    };
}
function sendInvoiceEmailDeps() {
    const rds = new client_rds_data_1.RDSDataClient({});
    const s3 = new client_s3_1.S3Client({});
    const ses = new client_sesv2_1.SESv2Client({});
    const bucket = requireEnv("INVOICE_PDFS_BUCKET_NAME");
    return {
        async runSql(request) {
            const result = await rds.send(new client_rds_data_1.ExecuteStatementCommand({
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
            await s3.send(new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: "application/pdf",
                ContentDisposition: `attachment; filename="${filename}"`,
            }));
        },
        async sendEmail(email) {
            await ses.send(new client_sesv2_1.SendEmailCommand({
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
        getLinkSecret: cachedSecret(new client_secrets_manager_1.SecretsManagerClient({}), requireEnv("INVOICE_LINK_SECRET_ARN")),
        sender: process.env.INVOICE_EMAIL_FROM || undefined,
        downloadBaseUrl: requireEnv("INVOICE_DOWNLOAD_BASE_URL"),
        now: () => new Date(),
    };
}
function downloadInvoiceDeps() {
    const s3 = new client_s3_1.S3Client({});
    const bucket = requireEnv("INVOICE_PDFS_BUCKET_NAME");
    return {
        getLinkSecret: cachedSecret(new client_secrets_manager_1.SecretsManagerClient({}), requireEnv("INVOICE_LINK_SECRET_ARN")),
        presignDownload(key, filename, expiresInSeconds) {
            return (0, s3_request_presigner_1.getSignedUrl)(s3, new client_s3_1.GetObjectCommand({
                Bucket: bucket,
                Key: key,
                ResponseContentType: "application/pdf",
                ResponseContentDisposition: `attachment; filename="${filename}"`,
            }), { expiresIn: expiresInSeconds });
        },
        now: () => Date.now(),
    };
}
