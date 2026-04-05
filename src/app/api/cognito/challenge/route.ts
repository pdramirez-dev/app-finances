import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createAuthTicket,
  createChallengeTicket,
  readChallengeTicket,
  toSafeChallenge,
} from "@/lib/auth-flow-tickets";
import { CognitoApiError, respondToChallenge, verifySoftwareToken } from "@/lib/cognito-auth";

const schema = z.object({
  challengeTicket: z.string().min(1),
  code: z.string().trim().optional(),
  newPassword: z.string().trim().optional(),
  requiredAttributes: z.record(z.string(), z.string()).optional(),
  selectedChallenge: z.string().trim().optional(),
  deviceName: z.string().trim().optional(),
});

function toErrorResponse(error: unknown) {
  if (!(error instanceof CognitoApiError)) {
    return NextResponse.json({ error: "No fue posible completar el challenge." }, { status: 500 });
  }

  if (error.code === "CodeMismatchException") {
    return NextResponse.json({ error: "El codigo ingresado no es valido." }, { status: 400 });
  }

  if (error.code === "ExpiredCodeException") {
    return NextResponse.json({ error: "El codigo expiro. Reinicia el flujo de autenticacion." }, { status: 400 });
  }

  return NextResponse.json({ error: error.message }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const challenge = readChallengeTicket(body.challengeTicket);

    if (!challenge) {
      return NextResponse.json({ error: "La sesion de autenticacion expiro. Inicia nuevamente." }, { status: 400 });
    }

    const result =
      challenge.challengeName === "MFA_SETUP" && challenge.totpSecretCode
        ? await (async () => {
            if (!body.code) {
              throw new CognitoApiError("Debes ingresar el codigo del autenticador.", "MissingChallengeCode");
            }

            const verification = await verifySoftwareToken({
              session: challenge.session,
              code: body.code,
              deviceName: body.deviceName,
            });

            if (!verification.Session) {
              throw new CognitoApiError("No fue posible verificar el token TOTP.", "InvalidSoftwareTokenSession");
            }

            return respondToChallenge({
              email: challenge.email,
              challengeName: "MFA_SETUP",
              session: verification.Session,
              challengeParameters: challenge.challengeParameters,
            });
          })()
        : await respondToChallenge({
            email: challenge.email,
            challengeName: challenge.challengeName,
            session: challenge.session,
            challengeParameters: challenge.challengeParameters,
            code: body.code,
            newPassword: body.newPassword,
            requiredAttributes: body.requiredAttributes,
            selectedChallenge: body.selectedChallenge,
          });

    if (result.kind === "success") {
      return NextResponse.json({
        status: "authenticated",
        authTicket: createAuthTicket({
          user: result.user,
          accessToken: result.accessToken,
          idToken: result.idToken,
        }),
      });
    }

    const challengeTicket = createChallengeTicket({
      email: result.email,
      challengeName: result.challengeName,
      challengeParameters: result.challengeParameters,
      session: result.session,
    });

    return NextResponse.json({
      status: "challenge",
      challengeTicket,
      challenge: toSafeChallenge({
        type: "challenge",
        exp: Date.now() + 15 * 60 * 1000,
        email: result.email,
        challengeName: result.challengeName,
        challengeParameters: result.challengeParameters,
        session: result.session,
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload de challenge invalido." }, { status: 400 });
    }

    return toErrorResponse(error);
  }
}
