"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { PasswordField } from "@/components/auth/password-field";
import { clearStoredChallenge, useStoredChallenge, writeStoredChallenge } from "@/lib/auth-flow-client";
import { getAuthRequestMessage, postAuthJson } from "@/lib/auth-api-client";
import type { SafeChallenge } from "@/lib/auth-flow-tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChallengeResponse =
  | {
      status: "authenticated";
      authTicket: string;
    }
  | {
      status: "challenge";
      challengeTicket: string;
      challenge: SafeChallenge;
    }
  | {
      error: string;
    };

function getChallengeTitle(challengeName: SafeChallenge["challengeName"]) {
  switch (challengeName) {
    case "NEW_PASSWORD_REQUIRED":
      return "Actualiza tu contraseña";
    case "MFA_SETUP":
      return "Configura tu MFA";
    case "SELECT_CHALLENGE":
    case "SELECT_MFA_TYPE":
      return "Selecciona un método";
    default:
      return "Verifica tu acceso";
  }
}

function getChallengeDescription(challenge: SafeChallenge) {
  switch (challenge.challengeName) {
    case "NEW_PASSWORD_REQUIRED":
      return "Tu organización requiere una nueva contraseña antes de habilitar el acceso.";
    case "MFA_SETUP":
      return challenge.totpSecretCode
        ? "Escanea o copia la clave secreta en tu aplicación autenticadora y luego ingresa el código generado."
        : "Tu cuenta requiere configurar MFA antes de continuar.";
    case "SELECT_CHALLENGE":
    case "SELECT_MFA_TYPE":
      return "Elige el método que quieres usar para completar la autenticación.";
    case "EMAIL_OTP":
    case "SMS_OTP":
    case "SMS_MFA":
    case "SOFTWARE_TOKEN_MFA":
    case "CUSTOM_CHALLENGE":
      return challenge.deliveryDestination
        ? `Ingresa el código enviado a ${challenge.deliveryDestination}.`
        : "Ingresa el código de verificación para continuar.";
    default:
      return "Completa el paso adicional requerido para proteger tu cuenta.";
  }
}

function codeLabel(challengeName: SafeChallenge["challengeName"]) {
  switch (challengeName) {
    case "SOFTWARE_TOKEN_MFA":
    case "MFA_SETUP":
      return "Código del autenticador";
    default:
      return "Código";
  }
}

function challengeOptionLabel(challengeName: string) {
  const labels: Record<string, string> = {
    EMAIL_OTP: "Código por correo electrónico",
    SMS_MFA: "Código por mensaje de texto",
    SMS_OTP: "Código por mensaje de texto",
    SOFTWARE_TOKEN_MFA: "Aplicación autenticadora",
    PASSWORD: "Contraseña",
    PASSWORD_SRP: "Contraseña segura",
  };

  return labels[challengeName] ?? challengeName.replaceAll("_", " ").toLocaleLowerCase("es");
}

export function ChallengeForm() {
  const router = useRouter();
  const stored = useStoredChallenge();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState("");
  const [requiredAttributes, setRequiredAttributes] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSettingUpTotp, startTotpTransition] = useTransition();

  useEffect(() => {
    if (!stored) {
      router.replace("/login");
    }
  }, [router, stored]);

  const challenge = stored?.challenge;
  const effectiveSelectedChallenge = selectedChallenge || challenge?.availableChallenges[0] || "";

  const otpauthUri = useMemo(() => {
    if (!challenge?.totpSecretCode || !stored?.email) {
      return null;
    }

    const issuer = challenge.totpIssuer ?? "Nexo";
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(stored.email)}?secret=${challenge.totpSecretCode}&issuer=${encodeURIComponent(issuer)}`;
  }, [challenge?.totpIssuer, challenge?.totpSecretCode, stored?.email]);

  async function completeSession(authTicket: string) {
    const result = await signIn("credentials", {
      mode: "ticket",
      ticket: authTicket,
      redirect: false,
    });

    if (!result || result.error) {
      setFormError("La verificación fue correcta, pero no pudimos crear la sesión. Inténtalo de nuevo.");
      return;
    }

    clearStoredChallenge();
    router.push("/dashboard");
    router.refresh();
  }

  function handleRequiredAttributeChange(attribute: string, value: string) {
    setRequiredAttributes((current) => ({
      ...current,
      [attribute]: value,
    }));
  }

  function handleSetupTotp() {
    if (!stored) {
      return;
    }

    setFormError(null);

    startTotpTransition(async () => {
      try {
        const { ok, payload } = await postAuthJson<ChallengeResponse>("/api/cognito/challenge/setup-totp", {
          challengeTicket: stored.challengeTicket,
        });

        if (!ok || !("status" in payload) || payload.status !== "challenge") {
          setFormError("error" in payload ? payload.error : "No fue posible iniciar la configuración MFA.");
          return;
        }

        writeStoredChallenge({
          challenge: payload.challenge,
          challengeTicket: payload.challengeTicket,
          email: stored.email,
        });
      } catch (error) {
        setFormError(getAuthRequestMessage(error, "No fue posible iniciar la configuración MFA."));
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stored) {
      return;
    }

    if (challenge?.challengeName === "NEW_PASSWORD_REQUIRED" && newPassword !== confirmPassword) {
      setFormError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setFormError(null);

    startTransition(async () => {
      try {
        const { ok, payload } = await postAuthJson<ChallengeResponse>("/api/cognito/challenge", {
          challengeTicket: stored.challengeTicket,
          code,
          newPassword,
          selectedChallenge: effectiveSelectedChallenge,
          requiredAttributes,
          deviceName,
        });

        if (!ok) {
          setFormError("error" in payload ? payload.error : "No fue posible completar la verificación.");
          return;
        }

        if ("status" in payload && payload.status === "authenticated") {
          await completeSession(payload.authTicket);
          return;
        }

        if (!("status" in payload) || payload.status !== "challenge") {
          setFormError("No fue posible avanzar al siguiente paso.");
          return;
        }

        writeStoredChallenge({
          challenge: payload.challenge,
          challengeTicket: payload.challengeTicket,
          email: stored.email,
        });
        setCode("");
        setSelectedChallenge("");
      } catch (error) {
        setFormError(getAuthRequestMessage(error, "No fue posible completar la verificación."));
      }
    });
  }

  if (!challenge || !stored) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-3xl border border-white/35 bg-white p-6 shadow-2xl shadow-slate-950/25 sm:p-8" aria-live="polite">
        <p className="text-sm text-slate-600">Cargando verificación de acceso...</p>
      </section>
    );
  }

  const requiresCode = [
    "CUSTOM_CHALLENGE",
    "EMAIL_OTP",
    "MFA_SETUP",
    "SMS_MFA",
    "SMS_OTP",
    "SOFTWARE_TOKEN_MFA",
  ].includes(challenge.challengeName);

  const isSelection = challenge.challengeName === "SELECT_CHALLENGE" || challenge.challengeName === "SELECT_MFA_TYPE";
  const isNewPassword = challenge.challengeName === "NEW_PASSWORD_REQUIRED";
  const isMfaSetup = challenge.challengeName === "MFA_SETUP";
  const canSetupSoftwareToken =
    challenge.availableChallenges.length === 0 || challenge.availableChallenges.includes("SOFTWARE_TOKEN_MFA");

  return (
    <section
      className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-white/35 bg-white p-6 shadow-2xl shadow-slate-950/25 sm:p-8"
      aria-labelledby="challenge-title"
    >
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          Verificación de acceso
        </p>
        <h2 id="challenge-title" className="brand-heading text-2xl text-slate-950">{getChallengeTitle(challenge.challengeName)}</h2>
        <p className="text-sm leading-relaxed text-slate-600">{getChallengeDescription(challenge)}</p>
        <p className="break-all text-xs text-slate-500">Cuenta: {stored.email}</p>
        {formError ? (
          <p id="challenge-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>
        ) : null}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {isSelection ? (
          <div className="space-y-3">
            <Label>Método disponible</Label>
            {challenge.availableChallenges.length > 0 ? (
              challenge.availableChallenges.map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="challenge"
                    value={item}
                    checked={effectiveSelectedChallenge === item}
                    onChange={(event) => setSelectedChallenge(event.target.value)}
                  />
                  <span className="first-letter:uppercase">{challengeOptionLabel(item)}</span>
                </label>
              ))
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Tu cuenta solicita elegir un método, pero no hay opciones disponibles. Reinicia el acceso o contacta a un administrador.
              </p>
            )}
          </div>
        ) : null}

        {isNewPassword ? (
          <>
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
              aria-describedby={formError ? "challenge-error" : undefined}
              disabled={isPending}
              required
            />
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
              aria-describedby={formError ? "challenge-error" : undefined}
              disabled={isPending}
              required
            />
            {challenge.requiredAttributes.map((attribute) => (
              <div key={attribute} className="space-y-2">
                <Label htmlFor={attribute}>{attribute}</Label>
                <Input
                  id={attribute}
                  value={requiredAttributes[attribute] ?? ""}
                  onChange={(event) => handleRequiredAttributeChange(attribute, event.target.value)}
                  className="h-11"
                  disabled={isPending}
                  required
                />
              </div>
            ))}
          </>
        ) : null}

        {isMfaSetup && !challenge.totpSecretCode ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-700">
              Para completar el acceso debes registrar un autenticador TOTP. La configuración se hace dentro de esta
              misma app.
            </p>
            {canSetupSoftwareToken ? (
              <Button type="button" variant="outline" onClick={handleSetupTotp} disabled={isSettingUpTotp}>
                {isSettingUpTotp ? "Preparando..." : "Configurar autenticador"}
              </Button>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Tu organización requiere un método MFA que no está disponible en este flujo. Contacta a un administrador
                o reinicia el acceso con otro método.
              </p>
            )}
          </div>
        ) : null}

        {isMfaSetup && challenge.totpSecretCode ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clave secreta</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-800">{challenge.totpSecretCode}</p>
            </div>
            {otpauthUri ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">URI otpauth</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-600">{otpauthUri}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="device-name">Nombre del dispositivo</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="Por ejemplo: teléfono de trabajo"
                className="h-11"
                disabled={isPending}
              />
            </div>
          </div>
        ) : null}

        {requiresCode ? (
          <div className="space-y-2">
            <Label htmlFor="challenge-code">{codeLabel(challenge.challengeName)}</Label>
            <Input
              id="challenge-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setFormError(null);
              }}
              className="h-11 tracking-[0.2em]"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? "challenge-error" : undefined}
              disabled={isPending}
              autoFocus
              required
            />
          </div>
        ) : null}

        <Button
          className="h-11 w-full bg-gradient-to-r from-[#0a1226] via-[#13264d] to-[#1e3f6f] text-sm font-semibold text-white hover:from-[#121d38] hover:to-[#285187]"
          type="submit"
          disabled={
            isPending ||
            isSettingUpTotp ||
            (isMfaSetup && !challenge.totpSecretCode) ||
            (isSelection && !effectiveSelectedChallenge)
          }
          aria-busy={isPending || isSettingUpTotp}
        >
          {isPending ? "Validando..." : "Continuar"}
        </Button>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <Link href="/login" onClick={() => clearStoredChallenge()} className="underline underline-offset-4">
            Reiniciar acceso
          </Link>
          <Link href="/login/forgot-password" prefetch={false} className="underline underline-offset-4">
            Cambiar contraseña
          </Link>
        </div>
      </form>
    </section>
  );
}
