import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/invoices");
  }

  return (
    <AuthShell topActionHref="/login" topActionLabel="Login">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
