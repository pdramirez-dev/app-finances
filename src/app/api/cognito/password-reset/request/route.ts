import { NextResponse } from "next/server";
import { z } from "zod";

import { CognitoApiError, forgotPassword } from "@/lib/cognito-auth";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await forgotPassword(body.email);

    return NextResponse.json({
      ok: true,
      deliveryDestination: result.CodeDeliveryDetails?.Destination,
      deliveryMedium: result.CodeDeliveryDetails?.DeliveryMedium,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ingresa un email valido." }, { status: 400 });
    }

    if (error instanceof CognitoApiError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "No fue posible iniciar el reset de password." }, { status: 500 });
  }
}
