export type StageName = "dev" | "prod";

export type StageConfig = {
  stage: StageName;
  amplifyBranchName: string;
  appUrl: string;
  callbackUrls: string[];
  logoutUrls: string[];
};

export const STAGE_CONFIG: Record<StageName, StageConfig> = {
  dev: {
    stage: "dev",
    amplifyBranchName: "develop",
    appUrl: "https://dev.app-nexo.example.com",
    callbackUrls: [
      "http://localhost:3000/api/auth/callback/cognito",
      "https://dev.app-nexo.example.com/api/auth/callback/cognito",
    ],
    logoutUrls: ["http://localhost:3000", "https://dev.app-nexo.example.com"],
  },
  prod: {
    stage: "prod",
    amplifyBranchName: "main",
    appUrl: "https://app-nexo.example.com",
    callbackUrls: ["https://app-nexo.example.com/api/auth/callback/cognito"],
    logoutUrls: ["https://app-nexo.example.com"],
  },
};

export function isStageName(value: string): value is StageName {
  return value === "dev" || value === "prod";
}
