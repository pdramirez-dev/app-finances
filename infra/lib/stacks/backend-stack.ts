import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
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

    const auditLogTable = new dynamodb.Table(this, "AuditLogTable", {
      tableName: `app-finances-${props.stage}-audit-log`,
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: isProd,
      removalPolicy,
    });

    auditLogTable.addGlobalSecondaryIndex({
      indexName: "byEntity",
      partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "entityKey", type: dynamodb.AttributeType.STRING },
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
      backup: { retention: cdk.Duration.days(7) },
      storageEncrypted: true,
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
        INVOICE_PDF_METADATA_TABLE_NAME: invoicePdfMetadataTable.tableName,
        INVOICE_PDFS_BUCKET_NAME: invoicePdfsBucket.bucketName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

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
      },
    });

    const pdfLambdaDs = graphqlApi.addLambdaDataSource("PdfLambdaDs", generateInvoicePdfFn);
    const rdsDs = graphqlApi.addRdsDataSource("DomainRdsDs", dbCluster, dbCluster.secret!);
    const membershipsDs = graphqlApi.addDynamoDbDataSource("UserMembershipsDs", userMembershipsTable);

    const membershipGuardFn = new appsync.AppsyncFunction(this, "RequireMembershipFn", {
      api: graphqlApi,
      dataSource: membershipsDs,
      name: "RequireMembershipFn",
      runtime: jsRuntime,
      code: resolverFromFile("dist/fn-require-membership.js"),
    });

    membershipsDs.createResolver("QueryGetMyMembershipResolver", {
      typeName: "Query",
      fieldName: "getMyMembership",
      runtime: jsRuntime,
      code: resolverFromFile("dist/query-get-my-membership.js"),
    });

    const securedRdsResolver = (
      id: string,
      typeName: string,
      fieldName: string,
      resolverFile: string,
    ) => {
      const dataFn = new appsync.AppsyncFunction(this, `${id}RdsFn`, {
        api: graphqlApi,
        dataSource: rdsDs,
        name: `${id}RdsFn`,
        runtime: jsRuntime,
        code: resolverFromFile(`dist/${resolverFile}.js`),
      });

      graphqlApi.createResolver(`${id}Resolver`, {
        typeName,
        fieldName,
        runtime: jsRuntime,
        code: resolverFromFile("dist/pipeline-forward.js"),
        pipelineConfig: [membershipGuardFn, dataFn],
      });
    };

    securedRdsResolver("QueryGetInvoice", "Query", "getInvoice", "query-get-invoice");
    securedRdsResolver("QueryGetInvoiceByNumber", "Query", "getInvoiceByNumber", "query-get-invoice-by-number");
    securedRdsResolver("QueryListInvoices", "Query", "listInvoices", "query-list-invoices");
    securedRdsResolver("QueryGetAccount", "Query", "getAccount", "query-get-account");
    securedRdsResolver("QueryListClients", "Query", "listClients", "query-list-clients");
    securedRdsResolver("QueryGetClient", "Query", "getClient", "query-get-client");
    securedRdsResolver("QueryGetBankAccount", "Query", "getBankAccount", "query-get-bank-account");
    securedRdsResolver("MutationPutInvoice", "Mutation", "putInvoice", "mutation-put-invoice");
    securedRdsResolver("MutationPutClient", "Mutation", "putClient", "mutation-put-client");
    securedRdsResolver("MutationPutInvoiceSection", "Mutation", "putInvoiceSection", "mutation-put-invoice-section");
    securedRdsResolver("MutationPutInvoiceLineItem", "Mutation", "putInvoiceLineItem", "mutation-put-invoice-line-item");
    securedRdsResolver("MutationDeleteInvoiceSection", "Mutation", "deleteInvoiceSection", "mutation-delete-invoice-section");
    securedRdsResolver("MutationDeleteInvoiceLineItem", "Mutation", "deleteInvoiceLineItem", "mutation-delete-invoice-line-item");
    securedRdsResolver("MutationDeleteInvoice", "Mutation", "deleteInvoice", "mutation-delete-invoice");
    securedRdsResolver("InvoiceSections", "Invoice", "sections", "invoice-sections");
    securedRdsResolver("InvoiceSectionLineItems", "InvoiceSection", "lineItems", "invoice-section-line-items");

    // Audit log pipeline resolvers for sensitive mutations
    const auditDs = graphqlApi.addDynamoDbDataSource("AuditLogDs", auditLogTable);

    const auditWriteFn = new appsync.AppsyncFunction(this, "AuditWriteFn", {
      api: graphqlApi,
      dataSource: auditDs,
      name: "AuditWriteFn",
      runtime: jsRuntime,
      code: resolverFromFile("dist/fn-audit-write.js"),
    });

    const putAccountRdsFn = new appsync.AppsyncFunction(this, "PutAccountRdsFn", {
      api: graphqlApi,
      dataSource: rdsDs,
      name: "PutAccountRdsFn",
      runtime: jsRuntime,
      code: resolverFromFile("dist/mutation-put-account.js"),
    });

    graphqlApi.createResolver("MutationPutAccountResolver", {
      typeName: "Mutation",
      fieldName: "putAccount",
      runtime: jsRuntime,
      code: resolverFromFile("dist/pipeline-put-account.js"),
      pipelineConfig: [membershipGuardFn, putAccountRdsFn, auditWriteFn],
    });

    const putBankAccountRdsFn = new appsync.AppsyncFunction(this, "PutBankAccountRdsFn", {
      api: graphqlApi,
      dataSource: rdsDs,
      name: "PutBankAccountRdsFn",
      runtime: jsRuntime,
      code: resolverFromFile("dist/mutation-put-bank-account.js"),
    });

    graphqlApi.createResolver("MutationPutBankAccountResolver", {
      typeName: "Mutation",
      fieldName: "putBankAccount",
      runtime: jsRuntime,
      code: resolverFromFile("dist/pipeline-put-bank-account.js"),
      pipelineConfig: [membershipGuardFn, putBankAccountRdsFn, auditWriteFn],
    });

    const deleteClientRdsFn = new appsync.AppsyncFunction(this, "DeleteClientRdsFn", {
      api: graphqlApi,
      dataSource: rdsDs,
      name: "DeleteClientRdsFn",
      runtime: jsRuntime,
      code: resolverFromFile("dist/mutation-delete-client.js"),
    });

    graphqlApi.createResolver("MutationDeleteClientResolver", {
      typeName: "Mutation",
      fieldName: "deleteClient",
      runtime: jsRuntime,
      code: resolverFromFile("dist/pipeline-delete-client.js"),
      pipelineConfig: [membershipGuardFn, deleteClientRdsFn, auditWriteFn],
    });

    const updateInvoiceStatusRdsFn = new appsync.AppsyncFunction(this, "UpdateInvoiceStatusRdsFn", {
      api: graphqlApi,
      dataSource: rdsDs,
      name: "UpdateInvoiceStatusRdsFn",
      runtime: jsRuntime,
      code: resolverFromFile("dist/mutation-update-invoice-status.js"),
    });

    graphqlApi.createResolver("MutationUpdateInvoiceStatusResolver", {
      typeName: "Mutation",
      fieldName: "updateInvoiceStatus",
      runtime: jsRuntime,
      code: resolverFromFile("dist/pipeline-update-invoice-status.js"),
      pipelineConfig: [membershipGuardFn, updateInvoiceStatusRdsFn, auditWriteFn],
    });

    const requestInvoicePdfFn = new appsync.AppsyncFunction(this, "RequestInvoicePdfFn", {
      api: graphqlApi,
      dataSource: pdfLambdaDs,
      name: "RequestInvoicePdfFn",
      runtime: jsRuntime,
      code: resolverFromFile("mutation-request-invoice-pdf.js"),
    });

    graphqlApi.createResolver("MutationRequestInvoicePdfResolver", {
      typeName: "Mutation",
      fieldName: "requestInvoicePdf",
      runtime: jsRuntime,
      code: resolverFromFile("dist/pipeline-forward.js"),
      pipelineConfig: [membershipGuardFn, requestInvoicePdfFn],
    });

    const alarmDefaults = {
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    } as const;

    new cloudwatch.Alarm(this, "AppSyncServerErrorsAlarm", {
      ...alarmDefaults,
      alarmDescription: `AppSync ${props.stage} is returning server errors`,
      metric: new cloudwatch.Metric({
        namespace: "AWS/AppSync",
        metricName: "5XXError",
        dimensionsMap: { GraphQLAPIId: graphqlApi.apiId },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
    });

    new cloudwatch.Alarm(this, "AppSyncLatencyAlarm", {
      ...alarmDefaults,
      alarmDescription: `AppSync ${props.stage} average latency exceeds five seconds`,
      metric: new cloudwatch.Metric({
        namespace: "AWS/AppSync",
        metricName: "Latency",
        dimensionsMap: { GraphQLAPIId: graphqlApi.apiId },
        statistic: "Average",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5_000,
    });

    new cloudwatch.Alarm(this, "InvoicePdfErrorsAlarm", {
      ...alarmDefaults,
      alarmDescription: `Invoice PDF Lambda ${props.stage} is failing`,
      metric: generateInvoicePdfFn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
    });

    new cloudwatch.Alarm(this, "InvoicePdfThrottlesAlarm", {
      ...alarmDefaults,
      alarmDescription: `Invoice PDF Lambda ${props.stage} is being throttled`,
      metric: generateInvoicePdfFn.metricThrottles({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
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
    new cdk.CfnOutput(this, "InvoicePdfMetadataTableName", { value: invoicePdfMetadataTable.tableName });
    new cdk.CfnOutput(this, "UserMembershipsTableName", { value: userMembershipsTable.tableName });
    new cdk.CfnOutput(this, "AuditLogTableName", { value: auditLogTable.tableName });
    new cdk.CfnOutput(this, "InvoicePdfsBucketName", { value: invoicePdfsBucket.bucketName });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "CognitoIssuer", { value: cognitoIssuer });
    new cdk.CfnOutput(this, "CognitoHostedUiDomain", { value: cognitoHostedUiDomain });
  }
}
