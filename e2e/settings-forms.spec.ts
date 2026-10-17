import { expect, test } from "@playwright/test";

test("reminder settings keep what was typed when the days are out of range", async ({ page }) => {
  await page.goto("/settings/reminders");
  await page.getByLabel("Días respecto al vencimiento").fill("-3, 0, 120");
  await page.getByRole("button", { name: "Guardar recordatorios" }).click();
  await expect(page.getByText("Los días van de -30 a 90")).toBeVisible();
  await expect(page.getByLabel("Días respecto al vencimiento")).toHaveValue("-3, 0, 120");
});

test("invoice series: a repeated code is rejected without losing the form", async ({ page }) => {
  const code = `E${Date.now().toString().slice(-6)}`;
  await page.goto("/settings/invoice-series");
  await page.getByLabel("Código").fill(code);
  await page.getByPlaceholder("Facturas de servicio").fill("Serie e2e");
  await page.getByRole("button", { name: "Crear serie" }).click();
  await expect(page.getByText("Serie creada")).toBeVisible();
  await expect(page.getByLabel("Código")).toHaveValue("");

  await page.getByLabel("Código").fill(code);
  await page.getByPlaceholder("Facturas de servicio").fill("Serie duplicada");
  await page.getByLabel("Número inicial").fill("500");
  await page.getByRole("button", { name: "Crear serie" }).click();
  await expect(page.getByText("Ya existe una serie con ese código")).toBeVisible();
  await expect(page.getByLabel("Código")).toHaveValue(code);
  await expect(page.getByPlaceholder("Facturas de servicio")).toHaveValue("Serie duplicada");
  await expect(page.getByLabel("Número inicial")).toHaveValue("500");
});
