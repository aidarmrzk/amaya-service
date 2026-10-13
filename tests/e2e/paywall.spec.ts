import { test, expect } from "@playwright/test";
const offers = [
  {
    id: "monthly",
    title: "На один месяц",
    amount: 29900,
    currency: "RUB",
    period: "month",
    recommended: false,
  },
  {
    id: "yearly",
    title: "На целый год",
    amount: 199000,
    currency: "RUB",
    period: "year",
    recommended: true,
  },
];
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/offers", (route) =>
    route.fulfill({ json: { offers } }),
  );
});
test("selects a plan, blocks CTA during purchase and confirms success", async ({
  page,
}) => {
  await page.route("**/api/purchase", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.offerId).toBe("monthly");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      json: {
        id: "purchase",
        offerId: body.offerId,
        createdAt: "2026-10-13T15:00:00Z",
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("radio", { name: /На целый год/ })).toBeChecked();
  await page.getByRole("radio", { name: /На один месяц/ }).check();
  await page.getByRole("button", { name: /Открыть полный доступ/ }).click();
  await expect(
    page.getByRole("button", { name: /Открываем доступ/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Все приключения открыты!" }),
  ).toBeVisible();
});
test("shows purchase error, retries and reports missing restored purchase", async ({
  page,
}) => {
  await page.route("**/api/purchase", (route) =>
    route.fulfill({ status: 503, json: { statusMessage: "Unavailable" } }),
  );
  await page.route("**/api/restore", (route) =>
    route.fulfill({ json: { purchased: false, purchase: null } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Открыть полный доступ/ }).click();
  await expect(page.getByRole("alert")).toContainText("Не удалось");
  await expect(
    page.getByRole("button", { name: /Открыть полный доступ/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Восстановить покупки" }).click();
  await expect(page.getByRole("status")).toContainText("нет покупок");
});
test("offers loading failure has an accessible retry", async ({ page }) => {
  await page.route("**/api/offers", (route) =>
    route.fulfill({ status: 503, json: { statusMessage: "Unavailable" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("загрузить");
  await page.route("**/api/offers", (route) =>
    route.fulfill({ json: { offers } }),
  );
  await page.getByRole("button", { name: "Попробовать снова" }).click();
  await expect(page.getByRole("radio", { name: /На целый год/ })).toBeChecked();
});
for (const width of [360, 390, 430])
  test("mobile layout " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto("/");
    await expect(
      page.getByRole("radio", { name: /На целый год/ }),
    ).toBeChecked();
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    for (const control of [
      page.getByRole("button", { name: /Открыть полный доступ/ }),
      page.getByRole("button", { name: "Восстановить покупки" }),
    ]) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    if (width === 390) {
      await page.setViewportSize({ width, height: 780 });
      await page.screenshot({
        path: "docs/screenshots/web-390.png",
        fullPage: true,
      });
    }
  });
test("real server validates input and repairs invalid device cookies", async ({
  request,
}) => {
  const response = await request.post("/api/purchase", {
    headers: { Cookie: "amaya_device=broken" },
    data: { offerId: "unknown", requestId: "bad" },
  });
  expect(response.status()).toBe(400);
  expect(response.headers()["set-cookie"]).toContain("HttpOnly");
  expect(response.headers()["set-cookie"]).toContain("SameSite=Lax");
});

test("first visit establishes device identity before a purchase response can be lost", async ({
  request,
}) => {
  const offers = await request.get("/api/offers");
  expect(offers.status()).toBe(200);
  expect(offers.headers()["set-cookie"]).toMatch(/amaya_device=[0-9a-f-]{36}/);
  expect(offers.headers()["set-cookie"]).toContain("HttpOnly");
  expect(offers.headers()["cache-control"]).toBe("no-store");
});
