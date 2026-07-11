import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    error?: "RefreshAccessTokenError";
  }

  interface User {
    id: string;
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    idTokenExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    idTokenExpiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}
