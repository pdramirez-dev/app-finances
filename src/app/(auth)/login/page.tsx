import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/invoices");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <LoginForm />
    </main>
  );
}
