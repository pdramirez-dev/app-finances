import { redirect } from "next/navigation";

import { auth } from "@/auth";

export async function requireAuth() {
  const session = await auth();

  if (!session?.user || !session.idToken) {
    redirect("/login");
  }

  return session;
}
