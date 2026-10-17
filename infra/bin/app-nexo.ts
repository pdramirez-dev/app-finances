#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { STAGE_CONFIG, isStageName, type StageName } from "../lib/stage-config";
import { AppNexoBackendStack } from "../lib/stacks/backend-stack";
import { AppNexoFrontendStack } from "../lib/stacks/frontend-stack";

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
  // Real sender values stay out of the repo: pass them as context, e.g.
  // -c devInvoiceEmailFrom="Facturas <facturas@tu-dominio.com>" -c devInvoiceEmailIdentity=tu-dominio.com
  const invoiceEmailFrom = app.node.tryGetContext(`${stage}InvoiceEmailFrom`) as string | undefined;
  const invoiceEmailIdentity = app.node.tryGetContext(`${stage}InvoiceEmailIdentity`) as string | undefined;

  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  };

  const backendStack = new AppNexoBackendStack(app, `AppNexo-Backend-${stage}`, {
    stage: config.stage,
    callbackUrls: config.callbackUrls,
    logoutUrls: config.logoutUrls,
    cognitoDomainPrefix,
    localEmulator: app.node.tryGetContext("localEmulator") === "true" || app.node.tryGetContext("localEmulator") === true,
    invoiceEmail: invoiceEmailFrom && invoiceEmailIdentity
      ? { from: invoiceEmailFrom, sesIdentity: invoiceEmailIdentity }
      : undefined,
    env,
    tags: {
      Project: "app-nexo",
      Stage: stage,
      ManagedBy: "cdk",
      Layer: "backend",
    },
  });

  const frontendStack = new AppNexoFrontendStack(app, `AppNexo-Frontend-${stage}`, {
    stage: config.stage,
    appUrl: config.appUrl,
    amplifyBranchName: config.amplifyBranchName,
    backend: backendStack.exports,
    authSecret,
    env,
    tags: {
      Project: "app-nexo",
      Stage: stage,
      ManagedBy: "cdk",
      Layer: "frontend",
    },
  });

  frontendStack.addDependency(backendStack);
}
