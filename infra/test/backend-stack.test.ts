import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { expect, test } from "vitest";
import { AppNexoBackendStack } from "../lib/stacks/backend-stack";

function synth(extra: Partial<ConstructorParameters<typeof AppNexoBackendStack>[2]> = {}) {
  const app = new App();
  const stack = new AppNexoBackendStack(app, "Test", {
    stage: "dev",
    callbackUrls: ["http://localhost:3000"],
    logoutUrls: ["http://localhost:3000"],
    env: { account: "111111111111", region: "us-east-1" },
    ...extra,
  });
  return Template.fromStack(stack);
}

test("provisions an Aurora Serverless v2 Postgres cluster with Data API", () => {
  const t = synth();
  t.hasResourceProperties("AWS::RDS::DBCluster", {
    Engine: "aurora-postgresql",
    EnableHttpEndpoint: true,
  });
});

test("domain DynamoDB tables are removed; only the three kept tables remain", () => {
  const t = synth();
  // After the Postgres migration, the only DynamoDB tables left are the PDF
  // metadata table, user-memberships, and audit-log. The 7 domain tables are gone.
  t.resourceCountIs("AWS::DynamoDB::Table", 3);
  const tables = t.findResources("AWS::DynamoDB::Table");
  const names = Object.values(tables).map((r: any) => r.Properties.TableName);
  for (const removed of [
    "app-nexo-dev-invoices",
    "app-nexo-dev-invoice-sections",
    "app-nexo-dev-invoice-line-items",
    "app-nexo-dev-invoice-counters",
    "app-nexo-dev-accounts",
    "app-nexo-dev-clients",
    "app-nexo-dev-bank-accounts",
  ]) {
    if (names.includes(removed)) throw new Error(`removed table still present: ${removed}`);
  }
});

test("domain GraphQL is served by an AppSync RDS (relational) data source", () => {
  const t = synth();
  t.hasResourceProperties("AWS::AppSync::DataSource", {
    Type: "RELATIONAL_DATABASE",
  });
});

test("user pool defines an immutable custom:accountId attribute", () => {
  const t = synth();
  t.hasResourceProperties("AWS::Cognito::UserPool", {
    Schema: Match.arrayWith([
      Match.objectLike({
        Name: "accountId",
        AttributeDataType: "String",
        Mutable: false,
      }),
    ]),
  });
});

test("provisions the audit-log table with byEntity GSI and TTL", () => {
  const t = synth();
  t.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: Match.arrayWith([
      Match.objectLike({ AttributeName: "accountId", KeyType: "HASH" }),
      Match.objectLike({ AttributeName: "sk", KeyType: "RANGE" }),
    ]),
    TimeToLiveSpecification: Match.objectLike({ AttributeName: "ttl", Enabled: true }),
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({ IndexName: "byEntity" }),
    ]),
  });
});

test("AppSync only accepts Cognito User Pool authorization", () => {
  const t = synth();
  const apis = Object.values(t.findResources("AWS::AppSync::GraphQLApi"));
  const api = apis[0] as { Properties: { AuthenticationType: string; AdditionalAuthenticationProviders?: unknown[] } };

  expect(api.Properties.AuthenticationType).toBe("AMAZON_COGNITO_USER_POOLS");
  expect(api.Properties.AdditionalAuthenticationProviders ?? []).toHaveLength(0);
});

test("all domain resolvers run the membership guard first", () => {
  const t = synth();
  const template = t.toJSON();
  const guardId = Object.keys(template.Resources).find((id) => id.startsWith("RequireMembershipFn"));
  expect(guardId).toBeTruthy();

  const resolvers = Object.values(t.findResources("AWS::AppSync::Resolver")) as Array<{
    Properties: {
      FieldName: string;
      Kind?: string;
      PipelineConfig?: { Functions?: Array<{ "Fn::GetAtt"?: [string, string] }> };
    };
  }>;

  const guardedResolvers = resolvers.filter((resolver) => resolver.Properties.FieldName !== "getMyMembership");
  expect(guardedResolvers.length).toBeGreaterThan(0);

  for (const resolver of guardedResolvers) {
    expect(resolver.Properties.Kind).toBe("PIPELINE");
    expect(resolver.Properties.PipelineConfig?.Functions?.[0]?.["Fn::GetAtt"]?.[0]).toBe(guardId);
  }
});

test("all CRM mutations are audited after the membership guard and RDS write", () => {
  const t = synth();
  const template = t.toJSON();
  const guardId = Object.keys(template.Resources).find((id) => id.startsWith("RequireMembershipFn"));
  const auditId = Object.keys(template.Resources).find((id) => id.startsWith("AuditWriteFn"));
  expect(guardId).toBeTruthy();
  expect(auditId).toBeTruthy();

  const crmMutationFields = [
    "putContact", "deleteContact", "setContactFavorite",
    "putOpportunity", "deleteOpportunity", "updateOpportunityStage",
    "putProject", "deleteProject", "updateProjectStatus",
    "putTask", "deleteTask", "setTaskCompleted",
    "putCalendarEvent", "deleteCalendarEvent",
    "registerPayment", "voidPayment", "putBankMovement",
    "reconcilePayment", "undoReconciliation",
  ];
  const resolvers = Object.values(t.findResources("AWS::AppSync::Resolver")) as Array<{
    Properties: {
      TypeName: string;
      FieldName: string;
      Kind?: string;
      PipelineConfig?: { Functions?: Array<{ "Fn::GetAtt"?: [string, string] }> };
    };
  }>;

  for (const fieldName of crmMutationFields) {
    const resolver = resolvers.find((item) =>
      item.Properties.TypeName === "Mutation" && item.Properties.FieldName === fieldName,
    );
    expect(resolver, `missing resolver for Mutation.${fieldName}`).toBeTruthy();
    const functions = resolver?.Properties.PipelineConfig?.Functions ?? [];
    expect(resolver?.Properties.Kind).toBe("PIPELINE");
    expect(functions).toHaveLength(3);
    expect(functions[0]?.["Fn::GetAtt"]?.[0]).toBe(guardId);
    expect(functions[2]?.["Fn::GetAtt"]?.[0]).toBe(auditId);
  }
});

test("invoice edits, status changes and series changes are audited after the membership guard and RDS write", () => {
  const t = synth();
  const template = t.toJSON();
  const guardId = Object.keys(template.Resources).find((id) => id.startsWith("RequireMembershipFn"));
  const auditId = Object.keys(template.Resources).find((id) => id.startsWith("AuditWriteFn"));
  const resolvers = Object.values(t.findResources("AWS::AppSync::Resolver")) as Array<{
    Properties: {
      TypeName: string;
      FieldName: string;
      PipelineConfig?: { Functions?: Array<{ "Fn::GetAtt"?: [string, string] }> };
    };
  }>;

  for (const fieldName of ["updateInvoiceStatus", "updateInvoiceFull", "putInvoiceSeries", "sendInvoiceEmail"]) {
    const matches = resolvers.filter((item) =>
      item.Properties.TypeName === "Mutation" && item.Properties.FieldName === fieldName,
    );
    expect(matches, `expected exactly one resolver for Mutation.${fieldName}`).toHaveLength(1);
    const functions = matches[0].Properties.PipelineConfig?.Functions ?? [];
    expect(functions).toHaveLength(3);
    expect(functions[0]?.["Fn::GetAtt"]?.[0]).toBe(guardId);
    expect(functions[2]?.["Fn::GetAtt"]?.[0]).toBe(auditId);
  }
});

test("creates AppSync and Lambda operational alarms", () => {
  const t = synth();
  t.resourceCountIs("AWS::CloudWatch::Alarm", 4);
  t.hasResourceProperties("AWS::CloudWatch::Alarm", {
    MetricName: "5XXError",
    Namespace: "AWS/AppSync",
  });
  t.hasResourceProperties("AWS::CloudWatch::Alarm", {
    MetricName: "Errors",
    Namespace: "AWS/Lambda",
  });
});

type PolicyResource = { Properties: { Roles?: Array<{ Ref: string }>; PolicyDocument: { Statement: Array<{ Action: string | string[]; Resource: unknown }> } } };

function lambdaRoleRef(t: Template, idPrefix: string) {
  const functions = t.findResources("AWS::Lambda::Function");
  const id = Object.keys(functions).find((key) => key.startsWith(idPrefix));
  expect(id, `missing ${idPrefix}`).toBeTruthy();
  return (functions[id!].Properties.Role as { "Fn::GetAtt": [string, string] })["Fn::GetAtt"][0];
}

function actionsFor(t: Template, roleId: string) {
  const policies = Object.values(t.findResources("AWS::IAM::Policy")) as PolicyResource[];
  return policies
    .filter((policy) => policy.Properties.Roles?.some((role) => role.Ref === roleId))
    .flatMap((policy) => policy.Properties.PolicyDocument.Statement)
    .flatMap((statement) => (Array.isArray(statement.Action) ? statement.Action : [statement.Action])
      .map((action) => ({ action, resource: statement.Resource })));
}

test("only the invoice download Lambda has a public function URL", () => {
  const t = synth();
  const urls = Object.values(t.findResources("AWS::Lambda::Url")) as Array<{ Properties: { AuthType: string; TargetFunctionArn: { "Fn::GetAtt": [string, string] } } }>;
  expect(urls).toHaveLength(1);
  expect(urls[0].Properties.AuthType).toBe("NONE");
  expect(urls[0].Properties.TargetFunctionArn["Fn::GetAtt"][0]).toMatch(/^DownloadInvoiceFunction/);
});

test("the download Lambda can only read PDFs and the link secret", () => {
  const t = synth();
  const actions = actionsFor(t, lambdaRoleRef(t, "DownloadInvoiceFunction")).map((entry) => entry.action);
  expect(actions.some((action) => action.startsWith("s3:GetObject"))).toBe(true);
  expect(actions.some((action) => action.startsWith("secretsmanager:GetSecretValue"))).toBe(true);
  expect(actions.filter((action) => /^s3:(Put|Delete)|^rds-data:|^ses:/.test(action))).toEqual([]);
});

test("invoice emails are only allowed from the configured SES identity", () => {
  const unconfigured = synth();
  const sendRole = lambdaRoleRef(unconfigured, "SendInvoiceEmailFunction");
  const before = actionsFor(unconfigured, sendRole);
  expect(before.some((entry) => entry.action.startsWith("ses:"))).toBe(false);
  expect(before.some((entry) => entry.action.startsWith("rds-data:"))).toBe(true);
  expect(before.some((entry) => entry.action.startsWith("s3:PutObject"))).toBe(true);
  expect(before.some((entry) => entry.action.startsWith("s3:GetObject"))).toBe(false);

  const configured = synth({ invoiceEmail: { from: "Facturas <f@pena.example>", sesIdentity: "pena.example" } });
  const ses = actionsFor(configured, lambdaRoleRef(configured, "SendInvoiceEmailFunction")).filter((entry) => entry.action.startsWith("ses:"));
  expect(ses.map((entry) => entry.action)).toEqual(["ses:SendEmail"]);
  expect(JSON.stringify(ses[0].resource)).toContain(":identity/pena.example");
  configured.hasResourceProperties("AWS::Lambda::Function", {
    Environment: { Variables: Match.objectLike({ INVOICE_EMAIL_FROM: "Facturas <f@pena.example>" }) },
  });
});
