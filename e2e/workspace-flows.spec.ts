import { expect, type Page, test } from "@playwright/test";

// Values below pass the browser's own checks but fail the zod schemas, so each
// test proves the server-side error shows up next to its field and that what
// the user typed survives the failed submit.

async function expectFieldError(page: Page, label: string, message: string) {
  const field = page.getByLabel(label, { exact: true });
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const errorId = await field.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText(message);
}

test("onboarding: creating the account explains a short name and keeps the other fields", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Tipo de cuenta").selectOption("COMPANY");
  await page.getByLabel("Nombre visible").fill("A");
  await page.getByLabel("Email").fill("hola@pena.example");
  await page.getByLabel("Teléfono").fill("+1 407 555 0100");
  await page.getByRole("button", { name: "Crear mi espacio" }).click();

  await expectFieldError(page, "Nombre visible", "El nombre debe tener al menos 2 caracteres");
  await expect(page.getByRole("alert").filter({ hasText: "Revisa los campos marcados" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("hola@pena.example");
  await expect(page.getByLabel("Teléfono")).toHaveValue("+1 407 555 0100");
  await expect(page.getByLabel("Tipo de cuenta")).toHaveValue("COMPANY");

  await page.getByLabel("Nombre visible").fill("Peña Servicios");
  await page.getByRole("button", { name: "Crear mi espacio" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("clients: a new client needs a real name and an email in a valid format", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo cliente" });

  await dialog.getByLabel("Nombre").fill("X");
  await dialog.getByLabel("Email").fill("cuentas@");
  await dialog.getByLabel("Teléfono").fill("+1 813 555 0132");
  await dialog.getByRole("button", { name: "Añadir cliente" }).click();

  await expectFieldError(dialog.page(), "Nombre", "El nombre debe tener al menos 2 caracteres");
  await expectFieldError(dialog.page(), "Email", "Ingresa un email válido");
  await expect(dialog.getByLabel("Teléfono")).toHaveValue("+1 813 555 0132");

  await dialog.getByLabel("Nombre").fill("Greenridge Properties");
  await dialog.getByLabel("Email").fill("finance@greenridge.example");
  await dialog.getByRole("button", { name: "Añadir cliente" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Cliente guardado");
  // A created client leaves the form ready for the next one.
  await expect(dialog.getByLabel("Nombre")).toHaveValue("");
});

test("payment settings: bank data only accepts masked identifiers", async ({ page }) => {
  await page.goto("/settings/payments");
  await page.getByLabel("Beneficiario").fill("Peña Servicios LLC");
  await page.getByLabel("Banco").fill("Truist");
  await page.getByLabel("Número de cuenta").fill("123456789");
  await page.getByRole("button", { name: "Guardar datos de pago" }).click();

  await expectFieldError(page, "Número de cuenta", "Usa un valor enmascarado, por ejemplo •••• 1234");
  await expect(page.getByLabel("Beneficiario")).toHaveValue("Peña Servicios LLC");
  await expect(page.getByLabel("Número de cuenta")).toHaveValue("123456789");

  await page.getByLabel("Número de cuenta").fill("•••• 6789");
  await page.getByRole("button", { name: "Guardar datos de pago" }).click();
  await expect(page.getByRole("status")).toHaveText("Datos de pago guardados de forma segura");
  await expect(page.getByLabel("Número de cuenta")).toHaveValue("•••• 6789");
});

test("invoices: creating one validates the week number and keeps the typed header", async ({ page }) => {
  await page.goto("/invoices/new");
  await page.getByLabel("Cliente guardado").selectOption({ label: "Northline Logistics" });
  await page.getByLabel("Número de semana").fill("60");
  await page.getByLabel("Proyecto").fill("Mantenimiento regional");
  await page.getByLabel("Facturar a").fill("Northline Logistics");
  await page.getByLabel("Dirección de facturación").fill("4100 Tradeport Drive, Orlando, FL");
  await page.getByRole("button", { name: "Crear factura" }).click();

  await expectFieldError(page, "Número de semana", "El número de semana va de 1 a 53");
  await expect(page.getByLabel("Proyecto")).toHaveValue("Mantenimiento regional");
  await expect(page.getByLabel("Facturar a")).toHaveValue("Northline Logistics");
  await expect(page.getByLabel("Cliente guardado").locator("option:checked")).toHaveText("Northline Logistics");

  await page.getByLabel("Número de semana").fill("42");
  await page.getByRole("button", { name: "Crear factura" }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Factura #/ })).toBeVisible();
  await expect(page.getByText("Mantenimiento regional").first()).toBeVisible();
});
