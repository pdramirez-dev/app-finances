import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import { Construct } from "constructs";

import type { StageName } from "../stage-config";
import type { BackendExports } from "./backend-stack";

export type AppFinancesFrontendStackProps = cdk.StackProps & {
  stage: StageName;
  amplifyBranchName: string;
  appUrl: string;
  backend: BackendExports;
  authSecret?: string;
};

export class AppFinancesFrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppFinancesFrontendStackProps) {
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
        { name: "AUTH_COGNITO_USER_POOL_ID", value: props.backend.userPoolId },
        { name: "AUTH_COGNITO_USER_POOL_CLIENT_ID", value: props.backend.userPoolClientId },
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
