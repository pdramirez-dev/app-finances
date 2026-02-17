#!/usr/bin/env node
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
const cdk = __importStar(require("aws-cdk-lib"));
const stage_config_1 = require("../lib/stage-config");
const backend_stack_1 = require("../lib/stacks/backend-stack");
const frontend_stack_1 = require("../lib/stacks/frontend-stack");
const app = new cdk.App();
const requestedStagesRaw = app.node.tryGetContext("stages");
const requestedStages = requestedStagesRaw
    ? requestedStagesRaw.split(",").map((stage) => stage.trim())
    : ["dev", "prod"];
for (const stageRaw of requestedStages) {
    if (!(0, stage_config_1.isStageName)(stageRaw)) {
        throw new Error(`Invalid stage "${stageRaw}". Supported stages: dev, prod.`);
    }
    const stage = stageRaw;
    const config = stage_config_1.STAGE_CONFIG[stage];
    const cognitoDomainPrefix = app.node.tryGetContext(`${stage}CognitoDomainPrefix`);
    const authSecret = app.node.tryGetContext(`${stage}AuthSecret`);
    const env = {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
    };
    const backendStack = new backend_stack_1.AppFinancesBackendStack(app, `AppFinances-Backend-${stage}`, {
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
    const frontendStack = new frontend_stack_1.AppFinancesFrontendStack(app, `AppFinances-Frontend-${stage}`, {
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
