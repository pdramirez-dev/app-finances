import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { test } from "vitest";
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
