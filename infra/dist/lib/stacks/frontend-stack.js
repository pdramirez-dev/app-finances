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
exports.AppFinancesFrontendStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const amplify = __importStar(require("aws-cdk-lib/aws-amplify"));
class AppFinancesFrontendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const isProd = props.stage === "prod";
        const amplifyApp = new amplify.CfnApp(this, "AmplifyApp", {
            name: `app-finances-${props.stage}`,
            platform: "WEB_COMPUTE",
            description: `Amplify frontend app for stage ${props.stage}`,
            enableBranchAutoDeletion: !isProd,
            environmentVariables: [
                { name: "NEXT_PUBLIC_STAGE", value: props.stage },
                { name: "AWS_REGION", value: cdk.Stack.of(this).region },
                { name: "NEXT_PUBLIC_APPSYNC_GRAPHQL_URL", value: props.backend.graphqlUrl },
                { name: "NEXT_PUBLIC_APPSYNC_REGION", value: cdk.Stack.of(this).region },
                { name: "NEXT_PUBLIC_APPSYNC_AUTH_TYPE", value: "AMAZON_COGNITO_USER_POOLS" },
                { name: "APPSYNC_GRAPHQL_URL", value: props.backend.graphqlUrl },
                { name: "AUTH_SECRET", value: props.authSecret ?? "replace-me-in-amplify" },
                { name: "AUTH_URL", value: props.appUrl },
                { name: "AUTH_COGNITO_ID", value: props.backend.userPoolClientId },
                { name: "AUTH_COGNITO_ISSUER", value: props.backend.cognitoIssuer },
                { name: "COGNITO_USER_POOL_ID", value: props.backend.userPoolId },
                { name: "COGNITO_USER_POOL_CLIENT_ID", value: props.backend.userPoolClientId },
                { name: "COGNITO_HOSTED_UI_DOMAIN", value: props.backend.cognitoHostedUiDomain },
            ],
        });
        new amplify.CfnBranch(this, "AmplifyBranch", {
            appId: amplifyApp.attrAppId,
            branchName: props.amplifyBranchName,
            stage: isProd ? "PRODUCTION" : "DEVELOPMENT",
            framework: "Next.js - SSR",
            enableAutoBuild: true,
        });
        new cdk.CfnOutput(this, "AmplifyAppId", { value: amplifyApp.attrAppId });
    }
}
exports.AppFinancesFrontendStack = AppFinancesFrontendStack;
