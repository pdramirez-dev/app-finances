import { NextResponse } from "next/server";
import { z } from "zod";

import { createAuthTicket, createChallengeTicket, toSafeChallenge } from "@/lib/auth-flow-tickets";
import { authenticateWithPassword, CognitoApiError } from "@/lib/cognito-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function toErrorResponse(error: unknown) {
  if (!(error instanceof CognitoApiError)) {
    return NextResponse.json({ error: "No fue posible iniciar sesion." }, { status: 500 });
  }

  if (error.code === "PasswordResetRequiredException") {
    return NextResponse.json(
      {
        error: "Tu password debe actualizarse antes de continuar.",
        nextStep: "reset_password",
      },
      { status: 409 },
    );
  }

  if (error.code === "NotAuthorizedException" || error.code === "UserNotFoundException") {
    return NextResponse.json({ error: "Credenciales invalidas. Verifica email y password." }, { status: 401 });
  }

  if (error.code === "UserNotConfirmedException") {
    return NextResponse.json({ error: "La cuenta aun no esta confirmada en Cognito." }, { status: 403 });
  }

  return NextResponse.json({ error: error.message }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await authenticateWithPassword(body.email, body.password);

    if (result.kind === "success") {
      return NextResponse.json({
        status: "authenticated",
        authTicket: createAuthTicket({
          user: result.user,
          accessToken: result.accessToken,
          idToken: result.idToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
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
      return NextResponse.json({ error: "Email y password son requeridos." }, { status: 400 });
    }

    return toErrorResponse(error);
  }
}
