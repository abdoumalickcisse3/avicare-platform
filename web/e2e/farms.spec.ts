import { test, expect, type Route } from "@playwright/test";

/** A backend FarmResponse-shaped fixture. */
function makeFarm(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Ferme Test",
    description: null,
    location: "Dakar, Sénégal",
    gpsLatitude: null,
    gpsLongitude: null,
    capacity: 5000,
    timezone: null,
    currency: null,
    createdBy: 1,
    active: true,
    createdAt: "2026-01-01T00:00:00",
    ...overrides,
  };
}

/**
 * Hermetic happy path: login → farms list → create a farm → open its detail.
 * All /api/v1/* traffic is mocked, so the test needs no running backend.
 */
test("login, list farms, create one, and view its detail", async ({ page }) => {
  const farms: ReturnType<typeof makeFarm>[] = [];

  // The web app calls the API cross-origin (:3001 -> :8080), so mocked
  // responses must carry CORS headers and answer the preflight, otherwise the
  // browser blocks them and RTK Query sees a network error.
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    }

    const json = (status: number, data: unknown) =>
      route.fulfill({
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

    if (path.endsWith("/api/v1/auth/login") && method === "POST") {
      return json(200, {
        accessToken: "test-access",
        refreshToken: "test-refresh",
        expiresIn: 900,
      });
    }
    if (path.endsWith("/api/v1/farms") && method === "GET") {
      return json(200, farms);
    }
    if (path.endsWith("/api/v1/farms") && method === "POST") {
      farms.push(makeFarm());
      return json(201, farms[0]);
    }
    if (path.endsWith("/api/v1/farms/1") && method === "GET") {
      return json(200, makeFarm());
    }
    if (path.endsWith("/api/v1/farms/1/users") && method === "GET") {
      return json(200, []);
    }
    return json(200, null);
  });

  // 1. Login
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill("owner@avicare.sn");
  await page.getByLabel("Mot de passe", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/dashboard$/);

  // 2. Navigate to the farms list via the sidebar (SPA nav keeps the session)
  await page.getByRole("link", { name: "Fermes" }).click();
  await page.waitForURL(/\/fermes$/);
  await expect(page.getByRole("heading", { name: "Mes Fermes" })).toBeVisible();
  await expect(
    page.getByText(/aucune ferme pour le moment/i),
  ).toBeVisible();

  // 3. Create a farm
  await page.getByRole("button", { name: /nouvelle ferme/i }).click();
  await page.getByLabel("Nom de la ferme").fill("Ferme Test");
  await page.getByLabel("Localisation").fill("Dakar, Sénégal");
  await page.getByRole("button", { name: "Créer la ferme" }).click();

  // 4. The new card shows up; open the detail
  await expect(page.getByText("Ferme Test")).toBeVisible();
  await page.getByRole("link", { name: /gérer l'exploitation/i }).click();
  await page.waitForURL(/\/fermes\/1$/);
  await expect(page.getByRole("heading", { name: "Ferme Test" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Vue d'ensemble" })).toBeVisible();
});
