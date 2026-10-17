import { describe, expect, it } from "vitest";

import { formValues, zodFailure } from "@/lib/form-state";
import { accountInputSchema, bankAccountInputSchema, clientInputSchema, createInvoiceInputSchema } from "@/lib/validations";

describe("workspace schemas", () => {
  it("explains account and client problems in Spanish per field", () => {
    const account = accountInputSchema.safeParse({ type: "OTHER", displayName: "A", email: "nope" });
    expect(account.success).toBe(false);
    expect(zodFailure(account.error!).fieldErrors).toEqual({
      type: "Elige el tipo de cuenta",
      displayName: "El nombre debe tener al menos 2 caracteres",
      email: "Ingresa un email válido",
    });

    const client = clientInputSchema.parse({ clientId: "", name: "  Acme  ", email: "", phone: "" });
    expect(client).toEqual({ clientId: undefined, name: "Acme", email: undefined, phone: undefined, address: undefined, taxId: undefined });
  });

  it("only accepts masked bank identifiers, a valid SWIFT and a 3-letter currency", () => {
    const ok = bankAccountInputSchema.parse({ beneficiaryName: "Nexo LLC", bankName: "Truist", accountNumberMasked: "•••• 1234", currency: "usd", swiftCode: "" });
    expect(ok).toMatchObject({ accountNumberMasked: "•••• 1234", currency: "USD", swiftCode: undefined });

    const bad = bankAccountInputSchema.safeParse({ beneficiaryName: "Nexo", bankName: "Truist", accountNumberMasked: "123456789", swiftCode: "ABC", currency: "dollars" });
    expect(zodFailure(bad.error!).fieldErrors).toEqual({
      accountNumberMasked: "Usa un valor enmascarado, por ejemplo •••• 1234",
      swiftCode: "El SWIFT tiene 8 u 11 letras o números",
      currency: "Usa un código de moneda de 3 letras, por ejemplo USD",
    });
  });
});

describe("invoice schema", () => {
  const base = {
    date: "2026-10-16", dueDate: "2026-11-15", weekNumber: "42", billToName: "Cliente", billToAddress: "Calle 1",
    project: "P", sections: [{ title: "S", items: [{ description: "d", quantity: 1, amount: 10 }] }],
  };

  it("uses Spanish messages, including for the week number range", () => {
    const result = createInvoiceInputSchema.safeParse({ ...base, weekNumber: "60", dueDate: "2026-10-01", project: " " });
    expect(zodFailure(result.error!).fieldErrors).toEqual({
      weekNumber: "El número de semana va de 1 a 53",
      project: "Indica el proyecto",
      dueDate: "El vencimiento no puede ser anterior a la fecha de la factura",
    });
    const order = createInvoiceInputSchema.safeParse({ ...base, dueDate: "2026-10-01" });
    expect(zodFailure(order.error!).fieldErrors).toEqual({ dueDate: "El vencimiento no puede ser anterior a la fecha de la factura" });
  });
});

describe("form state helpers", () => {
  it("echoes submitted text fields and drops React's internal action fields", () => {
    const data = new FormData();
    data.set("name", "Acme");
    data.set("$ACTION_ID_abc", "");
    data.set("file", new Blob(["x"]));
    expect(formValues(data)).toEqual({ name: "Acme" });
  });
});
