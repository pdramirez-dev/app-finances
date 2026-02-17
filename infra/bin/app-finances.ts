#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { STAGE_CONFIG, isStageName, type StageName } from "../lib/stage-config";
import { AppFinancesBackendStack } from "../lib/stacks/backend-stack";
import { AppFinancesFrontendStack } from "../lib/stacks/frontend-stack";

const app = new cdk.App();

const requestedStagesRaw = app.node.tryGetContext("stages") as string | undefined;
const requestedStages = requestedStagesRaw
  ? requestedStagesRaw.split(",").map((stage) => stage.trim())
  : ["dev", "prod"];

for (const stageRaw of requestedStages) {
  if (!isStageName(stageRaw)) {
    throw new Error(`Invalid stage "${stageRaw}". Supported stages: dev, prod.`);
  }

  const stage = stageRaw as StageName;
  const config = STAGE_CONFIG[stage];
  const cognitoDomainPrefix = app.node.tryGetContext(
    `${stage}CognitoDomainPrefix`,
  ) as string | undefined;
  const authSecret = app.node.tryGetContext(`${stage}AuthSecret`) as string | undefined;

  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  };

  const backendStack = new AppFinancesBackendStack(app, `AppFinances-Backend-${stage}`, {
    stage: config.stage,
    callbackUrls: config.callbackUrls,
    logoutUrls: config.logoutUrls,
    cognitoDomainPrefix,
    env,
    tags: {
      Project: "app-finances",
      Stage: stage,
      ManagedBy: "cdk",
      Layer: "backend",
    },
  });

  const frontendStack = new AppFinancesFrontendStack(app, `AppFinances-Frontend-${stage}`, {
    stage: config.stage,
    appUrl: config.appUrl,
    amplifyBranchName: config.amplifyBranchName,
    backend: backendStack.exports,
    authSecret,
    env,
    tags: {
      Project: "app-finances",
      Stage: stage,
      ManagedBy: "cdk",
      Layer: "frontend",
    },
  });

  frontendStack.addDependency(backendStack);
}
