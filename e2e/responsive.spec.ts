import { expect, test } from "@playwright/test";

// At phone width the page itself must never scroll sideways. Containers that
// are meant to scroll horizontally (wide tables, the pipeline board) are fine
// because they scroll inside their own overflow box, not the document.
const ROUTES = [
  "/dashboard",
  "/clients",
  "/invoices",
  "/invoices/new",
  "/invoices/20000000-0000-4000-8000-000000000048",
  "/invoices/20000000-0000-4000-8000-000000000045/edit",
  "/payments",
  "/pipeline",
  "/contacts",
  "/projects",
  "/tasks",
  "/calendar",
  "/reports",
  "/account",
  "/settings/payments",
  "/settings/invoice-series",
  "/settings/reminders",
];

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const route of ROUTES) {
  test(`no horizontal page scroll at 390px: ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    await page.locator("main").waitFor();
    await page.waitForLoadState("networkidle");
    const { scrollWidth, clientWidth, offenders } = await page.evaluate(() => {
      const root = document.documentElement;
      const offenders = Array.from(document.querySelectorAll<HTMLElement>("main *"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.right <= root.clientWidth + 1 || rect.width === 0) return false;
          // Ignore content clipped by a scrolling or hidden-overflow ancestor.
          for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (overflowX !== "visible") return false;
          }
          return true;
        })
        .slice(0, 5)
        .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).split(" ").slice(0, 3).join(".")} → ${Math.round(element.getBoundingClientRect().right)}px`);
      return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, offenders };
    });
    await testInfo.attach(`mobile${route.replaceAll("/", "_")}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    expect(offenders, `elements wider than the viewport on ${route}`).toEqual([]);
    expect(scrollWidth, `document scrolls sideways on ${route}`).toBeLessThanOrEqual(clientWidth + 1);
  });
}
