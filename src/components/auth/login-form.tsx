"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { clearStoredChallenge, writeStoredChallenge } from "@/lib/auth-flow-client";
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
      const response = await fetch("/api/cognito/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json()) as
        | { error: string; nextStep?: string }
        | {
            status: "authenticated";
            authTicket: string;
          }
        | {
            status: "challenge";
            challengeTicket: string;
            challenge: import("@/lib/auth-flow-tickets").SafeChallenge;
          };

      if (!response.ok) {
        if ("nextStep" in payload && payload.nextStep === "reset_password") {
          router.push(`/login/reset-password?email=${encodeURIComponent(email)}`);
          return;
        }

        setFormError("error" in payload ? payload.error : "No fue posible iniciar sesion.");
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
        setFormError("No fue posible crear la sesion de acceso.");
        return;
      }

      const result = await signIn("credentials", {
        mode: "ticket",
        ticket: payload.authTicket,
        redirect: false,
      });

      if (result?.error) {
        setFormError("Cognito valido las credenciales, pero no se pudo crear la sesion.");
        return;
      }

      clearStoredChallenge();
      router.push("/invoices");
      router.refresh();
    });
  }

  return (
    <section className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-white/35 bg-white p-8 shadow-2xl shadow-slate-950/25">
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          Secure Login
        </p>
        <h2 className="brand-heading text-2xl text-slate-950">
          Portal App Finances
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Inicia con tu cuenta de Cognito desde esta misma pantalla para administrar invoices y generar PDFs.
        </p>
        {resetSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Password actualizado. Ya puedes iniciar sesion con el nuevo acceso.
          </p>
        ) : null}
        {formError || externalError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError ?? "No fue posible iniciar sesion. Reintenta nuevamente."}
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
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <Button
          className="h-11 w-full bg-gradient-to-r from-[#0a1226] via-[#13264d] to-[#1e3f6f] text-sm font-semibold text-white hover:from-[#121d38] hover:to-[#285187]"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Ingresando..." : "Entrar"}
        </Button>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium text-slate-700">Seguridad activa</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Autenticacion gestionada por Amazon Cognito con politicas de password empresariales.
          </p>
        </div>
        <Link
          href="/login/forgot-password"
          prefetch={false}
          className="block text-center text-xs text-slate-500 underline underline-offset-4"
        >
          Olvide mi password
        </Link>
      </form>
    </section>
  );
}
