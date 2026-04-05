import { NextResponse } from "next/server";
import { z } from "zod";

import { createChallengeTicket, readChallengeTicket, toSafeChallenge } from "@/lib/auth-flow-tickets";
import { associateSoftwareToken, CognitoApiError } from "@/lib/cognito-auth";

const schema = z.object({
  challengeTicket: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const challenge = readChallengeTicket(body.challengeTicket);

    if (!challenge || challenge.challengeName !== "MFA_SETUP") {
      return NextResponse.json({ error: "No hay un setup MFA pendiente." }, { status: 400 });
    }

    const response = await associateSoftwareToken(challenge.session);

    if (!response.SecretCode || !response.Session) {
      return NextResponse.json({ error: "No fue posible iniciar la configuracion TOTP." }, { status: 400 });
    }

    const challengeTicket = createChallengeTicket({
      email: challenge.email,
      challengeName: "MFA_SETUP",
      challengeParameters: challenge.challengeParameters,
      session: response.Session,
      totpIssuer: "App Finances",
      totpSecretCode: response.SecretCode,
    });

    return NextResponse.json({
      status: "challenge",
      challengeTicket,
      challenge: toSafeChallenge({
        type: "challenge",
        exp: Date.now() + 15 * 60 * 1000,
        email: challenge.email,
        challengeName: "MFA_SETUP",
        challengeParameters: challenge.challengeParameters,
        session: response.Session,
        totpIssuer: "App Finances",
        totpSecretCode: response.SecretCode,
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload de setup MFA invalido." }, { status: 400 });
    }

    if (error instanceof CognitoApiError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "No fue posible iniciar la configuracion MFA." }, { status: 500 });
  }
}
