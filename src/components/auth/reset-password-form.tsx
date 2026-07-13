"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

import { PasswordField } from "@/components/auth/password-field";
import { getAuthRequestMessage, postAuthJson } from "@/lib/auth-api-client";
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
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setFormError(null);

    startTransition(async () => {
      try {
        const { ok, payload } = await postAuthJson<{ ok?: true; error?: string }>(
          "/api/cognito/password-reset/confirm",
          {
          email,
          code,
          newPassword,
          },
        );

        if (!ok || !payload.ok) {
          setFormError(payload.error ?? "No fue posible actualizar la contraseña.");
          return;
        }

        router.push("/login?reset=success");
      } catch (error) {
        setFormError(getAuthRequestMessage(error, "No fue posible actualizar la contraseña. Inténtalo de nuevo."));
      }
    });
  }

  return (
    <section
      className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-white/35 bg-white p-6 shadow-2xl shadow-slate-950/25 sm:p-8"
      aria-labelledby="reset-password-title"
    >
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          Nueva contraseña
        </p>
        <h2 id="reset-password-title" className="brand-heading text-2xl text-slate-950">Confirma el cambio</h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Ingresa el código recibido y define una nueva contraseña para tu cuenta.
        </p>
        {destination || medium ? (
          <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Código enviado{destination ? ` a ${destination}` : ""}{medium ? ` mediante ${medium}` : ""}.
          </p>
        ) : null}
        {formError ? (
          <p id="reset-password-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>
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
            aria-invalid={Boolean(formError)}
            aria-describedby={formError ? "reset-password-error" : undefined}
            disabled={isPending}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Código de verificación</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setFormError(null);
            }}
            className="h-11 tracking-[0.2em]"
            aria-invalid={Boolean(formError)}
            aria-describedby={formError ? "reset-password-error" : undefined}
            disabled={isPending}
            autoFocus={Boolean(email)}
            required
          />
        </div>
        <PasswordField
          id="new-password"
          label="Nueva contraseña"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setFormError(null);
          }}
          minLength={8}
          aria-invalid={Boolean(formError)}
          aria-describedby={formError ? "reset-password-error" : "password-requirements"}
          disabled={isPending}
          required
        />
        <p id="password-requirements" className="-mt-3 text-xs leading-relaxed text-slate-500">
          Usa al menos 8 caracteres y cumple la política de seguridad de tu organización.
        </p>
        <PasswordField
          id="confirm-password"
          label="Confirmar contraseña"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFormError(null);
          }}
          minLength={8}
          aria-invalid={Boolean(formError)}
          aria-describedby={formError ? "reset-password-error" : undefined}
          disabled={isPending}
          required
        />
        <Button
          className="h-11 w-full bg-gradient-to-r from-[#0a1226] via-[#13264d] to-[#1e3f6f] text-sm font-semibold text-white hover:from-[#121d38] hover:to-[#285187]"
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? "Actualizando..." : "Guardar nueva contraseña"}
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <Link href="/login" className="underline underline-offset-4">Volver al inicio de sesión</Link>
          <Link href="/login/forgot-password" className="underline underline-offset-4">Solicitar otro código</Link>
        </div>
      </form>
    </section>
  );
}
