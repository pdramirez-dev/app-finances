"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSqlParameters = toSqlParameters;
exports.recordsToObjects = recordsToObjects;
exports.sendInvoiceEmailDeps = sendInvoiceEmailDeps;
exports.downloadInvoiceDeps = downloadInvoiceDeps;
const client_rds_data_1 = require("@aws-sdk/client-rds-data");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client_sesv2_1 = require("@aws-sdk/client-sesv2");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const sql_params_1 = require("../../graphql/resolvers/src/lib/sql-params");
function toSqlParameters(params) {
    return Object.entries(params).map(([name, value]) => {
        // Same name -> hint map as the AppSync resolvers (uuid/date need it over the Data API).
        const typeHint = (0, sql_params_1.sqlTypeHint)(name);
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
function fieldValue(field) {
    if (field.isNull)
        return null;
    if (field.stringValue !== undefined)
        return field.stringValue;
    if (field.longValue !== undefined)
        return field.longValue;
    if (field.doubleValue !== undefined)
        return field.doubleValue;
    if (field.booleanValue !== undefined)
        return field.booleanValue;
    return null;
}
/**
 * Rows as objects keyed by column label. Built from plain records rather than
 * formatRecordsAs: "JSON", which local emulators (Floci) do not implement and
 * which AWS also answers with records + metadata.
 */
function recordsToObjects(records, columns) {
    const names = (columns ?? []).map((column, index) => column.label || column.name || `column${index}`);
    return (records ?? []).map((record) => Object.fromEntries(record.map((field, index) => [names[index], fieldValue(field)])));
}
// Local emulators (AWS_ENDPOINT_URL set) cannot resolve bucket.<host> names,
// so address buckets by path there. On AWS the variable is unset.
function s3Client() {
    return new client_s3_1.S3Client({ forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL) });
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
    const s3 = s3Client();
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
                includeResultMetadata: true,
            }));
            return recordsToObjects(result.records, result.columnMetadata);
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
    const s3 = s3Client();
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
