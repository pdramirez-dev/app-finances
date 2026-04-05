"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const destination = searchParams.get("destination");
  const medium = searchParams.get("medium");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setFormError("Los passwords no coinciden.");
      return;
    }

    setFormError(null);

    startTransition(async () => {
      const response = await fetch("/api/cognito/password-reset/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      const payload = (await response.json()) as { ok?: true; error?: string };

      if (!response.ok || !payload.ok) {
        setFormError(payload.error ?? "No fue posible actualizar el password.");
        return;
      }

      router.push("/login?reset=success");
    });
  }

  return (
    <section className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-white/35 bg-white p-8 shadow-2xl shadow-slate-950/25">
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          New Password
        </p>
        <h2 className="brand-heading text-2xl text-slate-950">Confirma el reset</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Ingresa el codigo recibido y define un nuevo password para tu cuenta.
        </p>
        {destination || medium ? (
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {medium ? `${medium}: ` : ""}{destination ?? "Codigo enviado"}
          </p>
        ) : null}
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
        <div className="space-y-2">
          <Label htmlFor="code">Codigo</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Nuevo password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>
        <Button
          className="h-11 w-full bg-gradient-to-r from-[#0a1226] via-[#13264d] to-[#1e3f6f] text-sm font-semibold text-white hover:from-[#121d38] hover:to-[#285187]"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Actualizando..." : "Guardar nuevo password"}
        </Button>
        <Link href="/login" className="block text-center text-xs text-slate-500 underline underline-offset-4">
          Volver al login
        </Link>
      </form>
    </section>
  );
}
