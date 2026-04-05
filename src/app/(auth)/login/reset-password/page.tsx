import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/invoices");
  }

  return (
    <AuthShell topActionHref="/login" topActionLabel="Login">
      <ResetPasswordForm />
    </AuthShell>
  );
}
