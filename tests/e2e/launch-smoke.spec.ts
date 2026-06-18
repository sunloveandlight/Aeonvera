import { expect, test, type Page } from "@playwright/test";

const publicRoutes = ["/", "/about", "/demo", "/pricing", "/privacy", "/terms", "/login"];
const protectedRoutes = [
  "/dashboard",
  "/assessment",
  "/companion",
  "/data-sources",
  "/digital-twin",
  "/life-os",
  "/life-autopilot",
  "/memory",
  "/network",
  "/onboarding",
  "/optimization",
  "/physician-export",
  "/plan",
  "/report",
  "/settings",
  "/success",
];

async function collectConsoleProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      const text = message.text();
      if (text.includes("/_next/webpack-hmr")) return;
      problems.push(`${message.type()}: ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });
  return problems;
}

test.describe("launch shell", () => {
  for (const route of publicRoutes) {
    test(`renders public route ${route}`, async ({ page }) => {
      const problems = await collectConsoleProblems(page);

      await page.goto(route, { waitUntil: "domcontentloaded" });

      await expect(page.locator("body")).toContainText(/Aeonvera|Privacy|Terms|Choose|Demo/i);
      await expect(page.locator("body")).not.toContainText(/Hydration failed|Runtime Error|Application error/i);
      expect(problems).toEqual([]);
    });
  }

  for (const route of protectedRoutes) {
    test(`redirects protected route ${route} to login`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: /welcome back|create your account/i })).toBeVisible();
    });
  }

  test("desktop header menus open on hover", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-only hover behavior");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const overview = page.getByRole("link", { name: "Overview" });
    await expect(overview).toBeVisible();

    await overview.hover();
    await expect(page.locator(".premium-mega-menu")).toContainText("Demo workspace");

    await page.mouse.click(20, 900);
    await expect(page.locator(".premium-mega-menu")).toHaveCount(0);
  });

  test("mobile navigation exposes public product paths", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only menu behavior");

    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.locator(".premium-mobile-menu")).toContainText("Demo workspace");
    await expect(page.locator(".premium-mobile-menu")).toContainText("Connect your data");
    await expect(page.locator(".premium-mobile-menu")).toContainText("Life Autopilot");
    await expect(page.locator(".premium-mobile-menu")).toContainText("Physician export");
  });
});

test.describe("unauthenticated safety boundaries", () => {
  test("pricing CTA routes unauthenticated users to signup", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /Choose Core/i }).click();

    await expect(page).toHaveURL(/\/login\?mode=signup/);
  });

  test("agent chat requires authentication", async ({ request }) => {
    const response = await request.post("/api/agent/chat", {
      data: { question: "What should I do today?" },
    });

    expect(response.status()).toBe(401);
  });

  test("cron routes require CRON_SECRET", async ({ request }) => {
    const daily = await request.get("/api/cron/daily-coach");
    const wearables = await request.get("/api/cron/wearable-sync");

    expect(daily.status()).toBe(401);
    expect(wearables.status()).toBe(401);
  });
});
