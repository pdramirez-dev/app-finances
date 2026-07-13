"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { removeClient, saveAccount, saveBankAccount, saveClient } from "@/lib/appsync/workspace";
import { requireAuth } from "@/lib/require-auth";

export type FormState = { error?: string; success?: string };

const optional = z.string().trim().transform((value) => value || undefined);
const contactFields = {
  email: z.union([z.literal(""), z.string().email("Ingresa un email válido")]).transform((v) => v || undefined),
  phone: optional,
  address: optional,
  taxId: optional,
};

function message(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Revisa los datos";
  return error instanceof Error ? error.message : "No se pudo guardar";
}

export async function saveAccountAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAuth();
  try {
    const input = z.object({
      type: z.enum(["SELF_EMPLOYED", "COMPANY"]),
      displayName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
      legalName: optional,
      ...contactFields,
    }).parse(Object.fromEntries(data));
    await saveAccount(input);
    revalidatePath("/account");
    return { success: "Perfil de cuenta actualizado" };
  } catch (error) { return { error: message(error) }; }
}

export async function saveClientAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAuth();
  try {
    const input = z.object({
      clientId: optional,
      name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
      ...contactFields,
    }).parse(Object.fromEntries(data));
    await saveClient(input);
    revalidatePath("/clients");
    return { success: "Cliente guardado" };
  } catch (error) { return { error: message(error) }; }
}

export async function deleteClientAction(data: FormData) {
  await requireAuth();
  const clientId = z.string().uuid().safeParse(data.get("clientId"));
  if (clientId.success) await removeClient(clientId.data);
  revalidatePath("/clients");
}

const masked = z.union([
  z.literal(""),
  z.string().regex(/^[*xX•\s.-]+[A-Za-z0-9]{1,6}$/, "Usa un valor enmascarado, por ejemplo •••• 1234"),
]).transform((v) => v || undefined);

export async function saveBankAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAuth();
  try {
    const input = z.object({
      beneficiaryName: z.string().trim().min(2, "Indica el beneficiario"),
      bankName: z.string().trim().min(2, "Indica el banco"),
      accountNumberMasked: masked,
      routingNumberMasked: masked,
      ibanMasked: masked,
      swiftCode: optional,
      currency: z.string().length(3, "Usa un código de moneda de 3 letras"),
      country: optional,
    }).parse(Object.fromEntries(data));
    await saveBankAccount(input);
    revalidatePath("/settings/payments");
    return { success: "Datos de pago guardados de forma segura" };
  } catch (error) { return { error: message(error) }; }
}

export async function finishOnboardingAction(_state: FormState, data: FormData): Promise<FormState> {
  const result = await saveAccountAction(_state, data);
  if (!result.error) redirect("/account");
  return result;
}
