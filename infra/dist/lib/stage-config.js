"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGE_CONFIG = void 0;
exports.isStageName = isStageName;
exports.STAGE_CONFIG = {
    dev: {
        stage: "dev",
        amplifyBranchName: "develop",
        appUrl: "https://dev.app-finances.example.com",
        callbackUrls: [
            "http://localhost:3000/api/auth/callback/cognito",
            "https://dev.app-finances.example.com/api/auth/callback/cognito",
        ],
        logoutUrls: ["http://localhost:3000", "https://dev.app-finances.example.com"],
    },
    prod: {
        stage: "prod",
        amplifyBranchName: "main",
        appUrl: "https://app-finances.example.com",
        callbackUrls: ["https://app-finances.example.com/api/auth/callback/cognito"],
        logoutUrls: ["https://app-finances.example.com"],
    },
};
function isStageName(value) {
    return value === "dev" || value === "prod";
}
