"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { PasswordField } from "@/components/auth/password-field";
import { clearStoredChallenge, writeStoredChallenge } from "@/lib/auth-flow-client";
import { getAuthRequestMessage, postAuthJson } from "@/lib/auth-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const externalError = searchParams.get("error");
  const resetSuccess = searchParams.get("reset") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    startTransition(async () => {
      try {
        const { ok, payload } = await postAuthJson<
          | { error: string; nextStep?: string }
          | { status: "authenticated"; authTicket: string }
          | {
              status: "challenge";
              challengeTicket: string;
              challenge: import("@/lib/auth-flow-tickets").SafeChallenge;
            }
        >("/api/cognito/login", {
          email,
          password,
        });

        if (!ok) {
          if ("nextStep" in payload && payload.nextStep === "reset_password") {
            router.push(`/login/reset-password?email=${encodeURIComponent(email)}`);
            return;
          }

          setFormError("error" in payload ? payload.error : "No fue posible iniciar sesión.");
          return;
        }

        if ("status" in payload && payload.status === "challenge") {
          writeStoredChallenge({
            challenge: payload.challenge,
            challengeTicket: payload.challengeTicket,
            email,
          });
          router.push("/login/challenge");
          return;
        }

        if (!("status" in payload) || payload.status !== "authenticated") {
          setFormError("No fue posible crear la sesión de acceso.");
          return;
        }

        const result = await signIn("credentials", {
          mode: "ticket",
          ticket: payload.authTicket,
          redirect: false,
        });

        if (!result || result.error) {
          setFormError("Las credenciales son correctas, pero no pudimos crear la sesión. Inténtalo de nuevo.");
          return;
        }

        clearStoredChallenge();
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        setFormError(getAuthRequestMessage(error, "No fue posible iniciar sesión. Inténtalo de nuevo."));
      }
    });
  }

  return (
    <section
      className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-white/35 bg-white p-6 shadow-2xl shadow-slate-950/25 sm:p-8"
      aria-labelledby="login-title"
    >
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          Inicio seguro
        </p>
        <h2 id="login-title" className="brand-heading text-2xl text-slate-950">
          Portal Nexo
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Ingresa con el correo y la contraseña de tu cuenta para acceder al espacio de trabajo.
        </p>
        {resetSuccess ? (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
        ) : null}
        {formError || externalError ? (
          <p id="login-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError ?? "La sesión no pudo iniciarse. Verifica tus datos e inténtalo de nuevo."}
          </p>
        ) : null}
      </div>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFormError(null);
            }}
            className="h-11"
            aria-invalid={Boolean(formError || externalError)}
            aria-describedby={formError || externalError ? "login-error" : undefined}
            disabled={isPending}
            autoFocus
            required
          />
        </div>
        <PasswordField
          id="password"
          label="Contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFormError(null);
          }}
          aria-invalid={Boolean(formError || externalError)}
          aria-describedby={formError || externalError ? "login-error" : undefined}
          disabled={isPending}
          required
        />
        <Button
          className="h-11 w-full bg-gradient-to-r from-[#0a1226] via-[#13264d] to-[#1e3f6f] text-sm font-semibold text-white hover:from-[#121d38] hover:to-[#285187]"
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? "Ingresando..." : "Entrar"}
        </Button>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium text-slate-700">Acceso protegido</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Tu sesión se gestiona de forma segura y puede requerir una verificación adicional.
          </p>
        </div>
        <Link
          href="/login/forgot-password"
          prefetch={false}
          className="block text-center text-xs text-slate-500 underline underline-offset-4"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </section>
  );
}
