import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { expect, test } from "vitest";
import { AppFinancesBackendStack } from "../lib/stacks/backend-stack";

function synth() {
  const app = new App();
  const stack = new AppFinancesBackendStack(app, "Test", {
    stage: "dev",
    callbackUrls: ["http://localhost:3000"],
    logoutUrls: ["http://localhost:3000"],
    env: { account: "111111111111", region: "us-east-1" },
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
    "app-finances-dev-invoices",
    "app-finances-dev-invoice-sections",
    "app-finances-dev-invoice-line-items",
    "app-finances-dev-invoice-counters",
    "app-finances-dev-accounts",
    "app-finances-dev-clients",
    "app-finances-dev-bank-accounts",
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
