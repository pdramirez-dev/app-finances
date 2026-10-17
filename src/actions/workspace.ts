"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { removeClient, saveAccount, saveBankAccount, saveClient } from "@/lib/appsync/workspace";
import { type FormState, formValues, zodFailure } from "@/lib/form-state";
import { requireAuth } from "@/lib/require-auth";
import { accountInputSchema, bankAccountInputSchema, clientInputSchema } from "@/lib/validations";
import { z } from "@/lib/zod";

export type { FormState };

function failure(error: unknown, values: Record<string, string>): FormState {
  const message = error instanceof Error ? error.message : "";
  if (/unauthorized|not authorized/i.test(message)) {
    return { error: "No tienes permiso para hacer este cambio", values };
  }
  return { error: "No se pudo guardar. Inténtalo de nuevo.", values };
}

export async function saveAccountAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAuth();
  const values = formValues(data);
  const parsed = accountInputSchema.safeParse(values);
  if (!parsed.success) return zodFailure(parsed.error, values);
  try {
    await saveAccount(parsed.data);
  } catch (error) {
    return failure(error, values);
  }
  revalidatePath("/account");
  return { success: "Perfil de cuenta actualizado", values };
}

export async function saveClientAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAuth();
  const values = formValues(data);
  const parsed = clientInputSchema.safeParse(values);
  if (!parsed.success) return zodFailure(parsed.error, values);
  try {
    await saveClient(parsed.data);
  } catch (error) {
    return failure(error, values);
  }
  revalidatePath("/clients");
  // A new client form starts empty again; an edited client keeps its values.
  return { success: "Cliente guardado", values: parsed.data.clientId ? values : undefined };
}

export async function deleteClientAction(data: FormData) {
  await requireAuth();
  const clientId = z.uuid().safeParse(data.get("clientId"));
  if (clientId.success) await removeClient(clientId.data);
  revalidatePath("/clients");
}

export async function saveBankAction(_state: FormState, data: FormData): Promise<FormState> {
  await requireAuth();
  const values = formValues(data);
  const parsed = bankAccountInputSchema.safeParse(values);
  if (!parsed.success) return zodFailure(parsed.error, values);
  try {
    await saveBankAccount(parsed.data);
  } catch (error) {
    return failure(error, values);
  }
  revalidatePath("/settings/payments");
  return { success: "Datos de pago guardados de forma segura", values };
}

export async function finishOnboardingAction(_state: FormState, data: FormData): Promise<FormState> {
  const result = await saveAccountAction(_state, data);
  if (!result.error) redirect("/account");
  return result;
}
