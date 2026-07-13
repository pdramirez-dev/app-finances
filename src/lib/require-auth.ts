import { redirect } from "next/navigation";

import { auth } from "@/auth";

export async function requireAuth() {
  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true") {
    return {
      user: { id: "dev-user", name: "Usuario Demo", email: "demo@app-finances.local" },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    };
  }

  const session = await auth();

  if (!session?.user || session.error === "RefreshAccessTokenError") {
    redirect("/login");
  }

  return session;
}
