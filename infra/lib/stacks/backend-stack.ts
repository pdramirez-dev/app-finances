import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

import type { StageName } from "../stage-config";

export type AppFinancesBackendStackProps = cdk.StackProps & {
  stage: StageName;
  callbackUrls: string[];
  logoutUrls: string[];
  cognitoDomainPrefix?: string;
};

export type BackendExports = {
  stage: StageName;
  graphqlUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  cognitoIssuer: string;
  cognitoHostedUiDomain: string;
};

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

function resolverFromFile(fileName: string) {
  return appsync.Code.fromAsset(path.join(process.cwd(), "graphql", "resolvers", fileName));
}

export class AppFinancesBackendStack extends cdk.Stack {
  public readonly exports: BackendExports;

  constructor(scope: Construct, id: string, props: AppFinancesBackendStackProps) {
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

    const accountsTable = new dynamodb.Table(this, "AccountsTable", {
      tableName: `app-finances-${props.stage}-accounts`,
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: isProd,
      removalPolicy,
    });

    accountsTable.addGlobalSecondaryIndex({
      indexName: "byTypeCreatedAt",
      partitionKey: { name: "type", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const userMembershipsTable = new dynamodb.Table(this, "UserMembershipsTable", {
      tableName: `app-finances-${props.stage}-user-memberships`,
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: isProd,
      removalPolicy,
    });

    userMembershipsTable.addGlobalSecondaryIndex({
      indexName: "byUserId",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const clientsTable = new dynamodb.Table(this, "ClientsTable", {
      tableName: `app-finances-${props.stage}-clients`,
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "clientId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: isProd,
      removalPolicy,
    });

    clientsTable.addGlobalSecondaryIndex({
      indexName: "byClientName",
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "clientName", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const bankAccountsTable = new dynamodb.Table(this, "BankAccountsTable", {
      tableName: `app-finances-${props.stage}-bank-accounts`,
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "bankAccountId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: isProd,
      removalPolicy,
    });

    bankAccountsTable.addGlobalSecondaryIndex({
      indexName: "byUpdatedAt",
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "updatedAt", type: dynamodb.AttributeType.STRING },
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

    const dbVpc = new ec2.Vpc(this, "DbVpc", { maxAzs: 2, natGateways: 0 });

    const dbCluster = new rds.DatabaseCluster(this, "DomainDb", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      vpc: dbVpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 2,
      enableDataApi: true,
      defaultDatabaseName: "app_finances",
      writer: rds.ClusterInstance.serverlessV2("Writer"),
      removalPolicy,
    });

    new cdk.CfnOutput(this, "DomainDbClusterArn", { value: dbCluster.clusterArn });
    new cdk.CfnOutput(this, "DomainDbSecretArn", { value: dbCluster.secret!.secretArn });

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `app-finances-${props.stage}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        accountId: new cognito.StringAttribute({ mutable: false }),
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

    const generateInvoicePdfFn = new NodejsFunction(this, "GenerateInvoicePdfFunction", {
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
    const accountsDs = graphqlApi.addDynamoDbDataSource("AccountsDs", accountsTable);
    const clientsDs = graphqlApi.addDynamoDbDataSource("ClientsDs", clientsTable);
    const bankAccountsDs = graphqlApi.addDynamoDbDataSource("BankAccountsDs", bankAccountsTable);
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

    accountsDs.createResolver("QueryGetAccountResolver", {
      typeName: "Query",
      fieldName: "getAccount",
      runtime: jsRuntime,
      code: resolverFromFile("query-get-account.js"),
    });

    clientsDs.createResolver("QueryListClientsResolver", {
      typeName: "Query",
      fieldName: "listClients",
      runtime: jsRuntime,
      code: resolverFromFile("query-list-clients.js"),
    });

    clientsDs.createResolver("QueryGetClientResolver", {
      typeName: "Query",
      fieldName: "getClient",
      runtime: jsRuntime,
      code: resolverFromFile("query-get-client.js"),
    });

    bankAccountsDs.createResolver("QueryGetBankAccountResolver", {
      typeName: "Query",
      fieldName: "getBankAccount",
      runtime: jsRuntime,
      code: resolverFromFile("query-get-bank-account.js"),
    });

    invoicesDs.createResolver("MutationPutInvoiceResolver", {
      typeName: "Mutation",
      fieldName: "putInvoice",
      runtime: jsRuntime,
      code: resolverFromFile("mutation-put-invoice.js"),
    });

    accountsDs.createResolver("MutationPutAccountResolver", {
      typeName: "Mutation",
      fieldName: "putAccount",
      runtime: jsRuntime,
      code: resolverFromFile("mutation-put-account.js"),
    });

    clientsDs.createResolver("MutationPutClientResolver", {
      typeName: "Mutation",
      fieldName: "putClient",
      runtime: jsRuntime,
      code: resolverFromFile("mutation-put-client.js"),
    });

    clientsDs.createResolver("MutationDeleteClientResolver", {
      typeName: "Mutation",
      fieldName: "deleteClient",
      runtime: jsRuntime,
      code: resolverFromFile("mutation-delete-client.js"),
    });

    bankAccountsDs.createResolver("MutationPutBankAccountResolver", {
      typeName: "Mutation",
      fieldName: "putBankAccount",
      runtime: jsRuntime,
      code: resolverFromFile("mutation-put-bank-account.js"),
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
    new cdk.CfnOutput(this, "AccountsTableName", { value: accountsTable.tableName });
    new cdk.CfnOutput(this, "UserMembershipsTableName", { value: userMembershipsTable.tableName });
    new cdk.CfnOutput(this, "ClientsTableName", { value: clientsTable.tableName });
    new cdk.CfnOutput(this, "BankAccountsTableName", { value: bankAccountsTable.tableName });
    new cdk.CfnOutput(this, "InvoicePdfsBucketName", { value: invoicePdfsBucket.bucketName });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "CognitoIssuer", { value: cognitoIssuer });
    new cdk.CfnOutput(this, "CognitoHostedUiDomain", { value: cognitoHostedUiDomain });
  }
}
