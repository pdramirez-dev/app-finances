import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChallengeForm } from "@/components/auth/challenge-form";

export default async function LoginChallengePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell topActionHref="/login" topActionLabel="Iniciar sesión">
      <ChallengeForm />
    </AuthShell>
  );
}
