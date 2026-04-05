"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const response = await fetch("/api/cognito/password-reset/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as
        | { ok: true; deliveryDestination?: string; deliveryMedium?: string }
        | { error: string };

      if (!response.ok || !("ok" in payload)) {
        setFormError("error" in payload ? payload.error : "No fue posible enviar el codigo.");
        return;
      }

      const params = new URLSearchParams({
        email,
      });

      if (payload.deliveryDestination) {
        params.set("destination", payload.deliveryDestination);
      }

      if (payload.deliveryMedium) {
        params.set("medium", payload.deliveryMedium);
      }

      router.push(`/login/reset-password?${params.toString()}`);
    });
  }

  return (
    <section className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-white/35 bg-white p-8 shadow-2xl shadow-slate-950/25">
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          Password Reset
        </p>
        <h2 className="brand-heading text-2xl text-slate-950">Solicita un codigo</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Te enviaremos un codigo de verificacion a traves del canal configurado en Cognito.
        </p>
        {formError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
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
        <Button
          className="h-11 w-full bg-gradient-to-r from-[#0a1226] via-[#13264d] to-[#1e3f6f] text-sm font-semibold text-white hover:from-[#121d38] hover:to-[#285187]"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Enviando..." : "Enviar codigo"}
        </Button>
        <Link href="/login" className="block text-center text-xs text-slate-500 underline underline-offset-4">
          Volver al login
        </Link>
      </form>
    </section>
  );
}
