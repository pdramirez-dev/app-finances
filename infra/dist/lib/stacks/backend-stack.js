"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppFinancesBackendStack = void 0;
const path = __importStar(require("node:path"));
const cdk = __importStar(require("aws-cdk-lib"));
const appsync = __importStar(require("aws-cdk-lib/aws-appsync"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const jsRuntime = appsync.FunctionRuntime.JS_1_0_0;
const hostedUiCss = `
.banner-customizable {
  background: linear-gradient(135deg, #0a1226 0%, #13264d 100%);
  border-bottom: 0;
  padding: 20px 24px;
}

.logo-customizable {
  max-width: 140px;
  max-height: 40px;
}

.background-customizable {
  background: radial-gradient(circle at 10% 12%, rgba(35, 201, 245, 0.18), transparent 34%),
    radial-gradient(circle at 92% 8%, rgba(255, 139, 61, 0.16), transparent 34%), #f8fbff;
}

.label-customizable {
  color: #0f1c33;
  font-weight: 600;
}

.textDescription-customizable,
.idpDescription-customizable,
.legalText-customizable {
  color: #4a5b78;
}

.inputField-customizable {
  border: 1px solid #d8e2f0;
  border-radius: 8px;
  color: #0f1c33;
}

.inputField-customizable:focus {
  border: 1px solid #23c9f5;
  box-shadow: 0 0 0 3px rgba(35, 201, 245, 0.25);
}

.submitButton-customizable {
  background-color: #0a1226;
  border: 0;
  border-radius: 8px;
  color: #f8fbff;
  font-weight: 600;
}

.submitButton-customizable:hover {
  background-color: #162448;
}

.errorMessage-customizable {
  color: #b42318;
}
`;
function resolverFromFile(fileName) {
    return appsync.Code.fromAsset(path.join(process.cwd(), "graphql", "resolvers", fileName));
}
class AppFinancesBackendStack extends cdk.Stack {
    exports;
    constructor(scope, id, props) {
        super(scope, id, props);
        const isProd = props.stage === "prod";
        const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
        const invoicesTable = new dynamodb.Table(this, "InvoicesTable", {
            tableName: `app-finances-${props.stage}-invoices`,
            partitionKey: { name: "invoiceId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            deletionProtection: isProd,
            removalPolicy,
        });
        invoicesTable.addGlobalSecondaryIndex({
            indexName: "byInvoiceNumber",
            partitionKey: { name: "invoiceNumber", type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        invoicesTable.addGlobalSecondaryIndex({
            indexName: "byStatusCreatedAt",
            partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        const invoiceSectionsTable = new dynamodb.Table(this, "InvoiceSectionsTable", {
            tableName: `app-finances-${props.stage}-invoice-sections`,
            partitionKey: { name: "invoiceId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sectionId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            deletionProtection: isProd,
            removalPolicy,
        });
        invoiceSectionsTable.addGlobalSecondaryIndex({
            indexName: "bySectionOrder",
            partitionKey: { name: "invoiceId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "position", type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        const invoiceLineItemsTable = new dynamodb.Table(this, "InvoiceLineItemsTable", {
            tableName: `app-finances-${props.stage}-invoice-line-items`,
            partitionKey: { name: "sectionId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "lineItemId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            deletionProtection: isProd,
            removalPolicy,
        });
        invoiceLineItemsTable.addGlobalSecondaryIndex({
            indexName: "byLineItemOrder",
            partitionKey: { name: "sectionId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "position", type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        const invoiceCountersTable = new dynamodb.Table(this, "InvoiceCountersTable", {
            tableName: `app-finances-${props.stage}-invoice-counters`,
            partitionKey: { name: "counterName", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            deletionProtection: isProd,
            removalPolicy,
        });
        const invoicePdfMetadataTable = new dynamodb.Table(this, "InvoicePdfMetadataTable", {
            tableName: `app-finances-${props.stage}-invoice-pdf-metadata`,
            partitionKey: { name: "invoiceId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "version", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            deletionProtection: isProd,
            removalPolicy,
        });
        invoicePdfMetadataTable.addGlobalSecondaryIndex({
            indexName: "byGeneratedAt",
            partitionKey: { name: "stage", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "generatedAt", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        const invoicePdfsBucket = new s3.Bucket(this, "InvoicePdfsBucket", {
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            enforceSSL: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy,
            autoDeleteObjects: !isProd,
            lifecycleRules: [
                {
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                    noncurrentVersionExpiration: cdk.Duration.days(90),
                },
            ],
        });
        const userPool = new cognito.UserPool(this, "UserPool", {
            userPoolName: `app-finances-${props.stage}-users`,
            selfSignUpEnabled: false,
            signInAliases: { email: true },
            standardAttributes: {
                email: { required: true, mutable: false },
                fullname: { required: false, mutable: true },
            },
            passwordPolicy: {
                minLength: 12,
                requireDigits: true,
                requireLowercase: true,
                requireUppercase: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy,
            deletionProtection: isProd,
        });
        const userPoolClient = userPool.addClient("WebClient", {
            userPoolClientName: `app-finances-${props.stage}-web-client`,
            authFlows: {
                userSrp: true,
                userPassword: true,
            },
            preventUserExistenceErrors: true,
            generateSecret: false,
            supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                    implicitCodeGrant: false,
                },
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
                callbackUrls: props.callbackUrls,
                logoutUrls: props.logoutUrls,
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            idTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(30),
        });
        const domainPrefix = props.cognitoDomainPrefix ?? `app-finances-${props.stage}`;
        const userPoolDomain = userPool.addDomain("CognitoDomain", {
            cognitoDomain: { domainPrefix },
            managedLoginVersion: cognito.ManagedLoginVersion.CLASSIC_HOSTED_UI,
        });
        new cognito.CfnUserPoolUICustomizationAttachment(this, "HostedUiCustomization", {
            userPoolId: userPool.userPoolId,
            clientId: userPoolClient.userPoolClientId,
            css: hostedUiCss,
        });
        const generateInvoicePdfFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GenerateInvoicePdfFunction", {
            runtime: lambda.Runtime.NODEJS_22_X,
            memorySize: 2048,
            timeout: cdk.Duration.seconds(60),
            entry: path.join(process.cwd(), "lambda", "generate-invoice-pdf.ts"),
            handler: "handler",
            environment: {
                STAGE: props.stage,
                PDF_ENGINE: "playwright",
                INVOICES_TABLE_NAME: invoicesTable.tableName,
                INVOICE_SECTIONS_TABLE_NAME: invoiceSectionsTable.tableName,
                INVOICE_LINE_ITEMS_TABLE_NAME: invoiceLineItemsTable.tableName,
                INVOICE_COUNTERS_TABLE_NAME: invoiceCountersTable.tableName,
                INVOICE_PDF_METADATA_TABLE_NAME: invoicePdfMetadataTable.tableName,
                INVOICE_PDFS_BUCKET_NAME: invoicePdfsBucket.bucketName,
            },
            bundling: {
                minify: true,
                sourceMap: true,
            },
        });
        invoicesTable.grantReadWriteData(generateInvoicePdfFn);
        invoiceSectionsTable.grantReadWriteData(generateInvoicePdfFn);
        invoiceLineItemsTable.grantReadWriteData(generateInvoicePdfFn);
        invoiceCountersTable.grantReadWriteData(generateInvoicePdfFn);
        invoicePdfMetadataTable.grantReadWriteData(generateInvoicePdfFn);
        invoicePdfsBucket.grantReadWrite(generateInvoicePdfFn);
        const graphqlApi = new appsync.GraphqlApi(this, "AppSyncApi", {
            name: `app-finances-${props.stage}-graphql`,
            definition: appsync.Definition.fromFile(path.join(process.cwd(), "graphql", "schema.graphql")),
            xrayEnabled: true,
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.USER_POOL,
                    userPoolConfig: { userPool },
                },
                additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
            },
        });
        const invoicesDs = graphqlApi.addDynamoDbDataSource("InvoicesDs", invoicesTable);
        const sectionsDs = graphqlApi.addDynamoDbDataSource("SectionsDs", invoiceSectionsTable);
        const lineItemsDs = graphqlApi.addDynamoDbDataSource("LineItemsDs", invoiceLineItemsTable);
        const pdfLambdaDs = graphqlApi.addLambdaDataSource("PdfLambdaDs", generateInvoicePdfFn);
        invoicesDs.createResolver("QueryGetInvoiceResolver", {
            typeName: "Query",
            fieldName: "getInvoice",
            runtime: jsRuntime,
            code: resolverFromFile("query-get-invoice.js"),
        });
        invoicesDs.createResolver("QueryGetInvoiceByNumberResolver", {
            typeName: "Query",
            fieldName: "getInvoiceByNumber",
            runtime: jsRuntime,
            code: resolverFromFile("query-get-invoice-by-number.js"),
        });
        invoicesDs.createResolver("QueryListInvoicesResolver", {
            typeName: "Query",
            fieldName: "listInvoices",
            runtime: jsRuntime,
            code: resolverFromFile("query-list-invoices.js"),
        });
        invoicesDs.createResolver("MutationPutInvoiceResolver", {
            typeName: "Mutation",
            fieldName: "putInvoice",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-put-invoice.js"),
        });
        sectionsDs.createResolver("MutationPutInvoiceSectionResolver", {
            typeName: "Mutation",
            fieldName: "putInvoiceSection",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-put-invoice-section.js"),
        });
        lineItemsDs.createResolver("MutationPutInvoiceLineItemResolver", {
            typeName: "Mutation",
            fieldName: "putInvoiceLineItem",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-put-invoice-line-item.js"),
        });
        sectionsDs.createResolver("MutationDeleteInvoiceSectionResolver", {
            typeName: "Mutation",
            fieldName: "deleteInvoiceSection",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-delete-invoice-section.js"),
        });
        lineItemsDs.createResolver("MutationDeleteInvoiceLineItemResolver", {
            typeName: "Mutation",
            fieldName: "deleteInvoiceLineItem",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-delete-invoice-line-item.js"),
        });
        invoicesDs.createResolver("MutationUpdateInvoiceStatusResolver", {
            typeName: "Mutation",
            fieldName: "updateInvoiceStatus",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-update-invoice-status.js"),
        });
        invoicesDs.createResolver("MutationDeleteInvoiceResolver", {
            typeName: "Mutation",
            fieldName: "deleteInvoice",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-delete-invoice.js"),
        });
        sectionsDs.createResolver("InvoiceSectionsResolver", {
            typeName: "Invoice",
            fieldName: "sections",
            runtime: jsRuntime,
            code: resolverFromFile("invoice-sections.js"),
        });
        lineItemsDs.createResolver("InvoiceSectionLineItemsResolver", {
            typeName: "InvoiceSection",
            fieldName: "lineItems",
            runtime: jsRuntime,
            code: resolverFromFile("invoice-section-line-items.js"),
        });
        pdfLambdaDs.createResolver("MutationRequestInvoicePdfResolver", {
            typeName: "Mutation",
            fieldName: "requestInvoicePdf",
            runtime: jsRuntime,
            code: resolverFromFile("mutation-request-invoice-pdf.js"),
        });
        const cognitoIssuer = `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`;
        const cognitoHostedUiDomain = `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`;
        this.exports = {
            stage: props.stage,
            graphqlUrl: graphqlApi.graphqlUrl,
            userPoolId: userPool.userPoolId,
            userPoolClientId: userPoolClient.userPoolClientId,
            cognitoIssuer,
            cognitoHostedUiDomain,
        };
        new cdk.CfnOutput(this, "AppSyncApiId", { value: graphqlApi.apiId });
        new cdk.CfnOutput(this, "AppSyncGraphqlUrl", { value: graphqlApi.graphqlUrl });
        new cdk.CfnOutput(this, "InvoicesTableName", { value: invoicesTable.tableName });
        new cdk.CfnOutput(this, "InvoiceSectionsTableName", { value: invoiceSectionsTable.tableName });
        new cdk.CfnOutput(this, "InvoiceLineItemsTableName", { value: invoiceLineItemsTable.tableName });
        new cdk.CfnOutput(this, "InvoiceCountersTableName", { value: invoiceCountersTable.tableName });
        new cdk.CfnOutput(this, "InvoicePdfMetadataTableName", { value: invoicePdfMetadataTable.tableName });
        new cdk.CfnOutput(this, "InvoicePdfsBucketName", { value: invoicePdfsBucket.bucketName });
        new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
        new cdk.CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
        new cdk.CfnOutput(this, "CognitoIssuer", { value: cognitoIssuer });
        new cdk.CfnOutput(this, "CognitoHostedUiDomain", { value: cognitoHostedUiDomain });
    }
}
exports.AppFinancesBackendStack = AppFinancesBackendStack;
