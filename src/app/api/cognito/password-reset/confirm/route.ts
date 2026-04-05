import { NextResponse } from "next/server";
import { z } from "zod";

import { CognitoApiError, confirmForgotPassword } from "@/lib/cognito-auth";

const schema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    await confirmForgotPassword({
      email: body.email,
      code: body.code,
      newPassword: body.newPassword,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Completa email, codigo y nuevo password." }, { status: 400 });
    }

    if (error instanceof CognitoApiError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "No fue posible actualizar el password." }, { status: 500 });
  }
}
