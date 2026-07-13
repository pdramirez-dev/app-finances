import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function HomePage() {
  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true") {
    redirect("/invoices");
  }

  const session = await auth();

  if (session?.user) {
    redirect("/invoices");
  }

  redirect("/login");
}
