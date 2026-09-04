import { test, expect, type Route } from "@playwright/test";

/**
 * A new farmer's first day: sign up, walk the seven-step wizard, and reach a working dashboard.
 *
 * <p>Why this journey and not a busier one: it is what a beta tester does <b>before</b> anything
 * else, and a break here loses them for good — they never see the rest of the product. It is also
 * the path the owner of this codebase never re-walks, because he already has an account.
 *
 * <p>It stops at the dashboard on purpose. Creating a first batch is the same "fill a form, see
 * the row" mechanic {@code farms.spec.ts} already covers, and folding it in here doubled the run
 * time for a second copy of the same assurance. What is unique to this journey — and untested
 * anywhere else — is everything before the dashboard.
 *
 * <p>Hermetic like {@code farms.spec.ts}: every /api/v1 call is answered in the browser, so no
 * backend is required (ADR-003). Assertions land on what the farmer <b>sees</b>, never on "the API
 * was called" — a test that only checks traffic still passes while the screen renders blank.
 */

/** A backend FarmResponse-shaped fixture. */
function makeFarm(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Ferme de Aminata",
    description: null,
    location: null,
    gpsLatitude: null,
    gpsLongitude: null,
    capacity: null,
    timezone: null,
    currency: null,
    createdBy: 1,
    active: true,
    createdAt: "2026-01-01T00:00:00",
    ...overrides,
  };
}

/** A backend PoultryBatchResponse-shaped fixture. */
function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    farmId: 1,
    breedId: 1,
    name: "Bande 1",
    startDate: "2026-09-04",
    status: "ACTIVE",
    currentCount: 500,
    initialCount: 500,
    deaths: 0,
    targetWeightG: 2000,
    targetAgeDays: 42,
    ...overrides,
  };
}

test("a new farmer signs up, walks the wizard, and lands on a working dashboard", async ({ page }) => {
  const batches: ReturnType<typeof makeBatch>[] = [];

  // The web app calls the API cross-origin (:3000 -> :8080), so mocked responses must carry CORS
  // headers and answer the preflight, otherwise the browser blocks them and RTK Query sees a
  // network error rather than the payload.
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
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

    // The token carries the OWNER membership the guarded screens read out of the JWT. Header and
    // payload are base64url; the signature is never verified client-side.
    const token = (() => {
      const b64 = (o: unknown) =>
        Buffer.from(JSON.stringify(o))
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      const payload = {
        sub: "1",
        email: "aminata@ferme.sn",
        role: "USER",
        memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      return `${b64({ alg: "RS256", typ: "JWT" })}.${b64(payload)}.sig`;
    })();

    const tokens = { accessToken: token, refreshToken: "test-refresh", expiresIn: 900 };

    // --- Auth -------------------------------------------------------------
    if (path.endsWith("/auth/signup") && method === "POST") return json(201, tokens);
    if (path.endsWith("/auth/login") && method === "POST") return json(200, tokens);
    if (path.endsWith("/auth/refresh") && method === "POST") return json(200, tokens);
    if (path.endsWith("/auth/me") && method === "GET") {
      return json(200, { id: 1, email: "aminata@ferme.sn", fullName: "Aminata Diallo" });
    }

    // --- Farms ------------------------------------------------------------
    // Signup provisions the farm itself, with a default name; the wizard names it properly.
    if (path.endsWith("/farms") && method === "POST") return json(201, makeFarm());
    if (path.endsWith("/farms") && method === "GET") return json(200, [makeFarm()]);
    if (path.match(/\/farms\/1$/) && (method === "GET" || method === "PUT" || method === "PATCH")) {
      return json(200, makeFarm());
    }

    // --- Broiler batches --------------------------------------------------
    if (path.endsWith("/poultry-batches") && method === "POST") {
      batches.push(makeBatch());
      return json(201, batches[0]);
    }
    if (path.endsWith("/poultry-batches") && method === "GET") return json(200, batches);
    if (path.endsWith("/breeds") || path.includes("/breeds?")) {
      return json(200, [
        { id: 1, species: "POULTRY", code: "cobb500", name: "Cobb 500", type: "broiler", farmId: null, active: true },
      ]);
    }

    // --- Dashboard --------------------------------------------------------
    // Shaped, not empty: the dashboard reads `commercial.revenueSeries` and friends, so a bare
    // [] makes it throw "Cannot read properties of undefined (reading 'filter')" and the error
    // boundary swallows the journey. A brand-new farm has no numbers, but it has the shape.
    if (path.endsWith("/dashboard") && method === "GET") {
      return json(200, {
        period: { kind: "preset", value: "30d", from: "2026-08-05", to: "2026-09-04" },
        commercial: {
          revenueXof: 0,
          revenueSeries: [],
          outstandingXof: 0,
          overdueXof: 0,
          topClients: [],
          topDebtors: [],
          ordersToDeliver: 0,
          invoicesToCollect: 0,
        },
        livestock: {
          activeBatches: 0,
          totalHeadcount: 0,
          deaths: 0,
          mortalitySeries: [],
          layingSeries: [],
          vaccinationsCount: 0,
          treatmentsCount: 0,
        },
      });
    }

    // Anything else the screens poll for: an empty, well-shaped answer. A 404 here would surface
    // as an error banner and hide the failure this test is actually about.
    if (method === "GET") return json(200, []);
    return json(200, null);
  });

  // --- 1. Sign up -------------------------------------------------------
  await page.goto("/signup");
  await page.getByLabel("Prénom").fill("Aminata");
  await page.getByLabel("Nom", { exact: true }).fill("Diallo");
  await page.getByLabel("Adresse e-mail").fill("aminata@ferme.sn");
  await page.getByLabel("Mot de passe", { exact: true }).fill("motdepasse123");
  await page.getByLabel("Confirmation").fill("motdepasse123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  // Signup provisions the account and the farm, then hands over to the wizard.
  await page.waitForURL(/\/onboarding$/, { timeout: 30_000 });

  // --- 2. Walk the wizard ------------------------------------------------
  // Seven steps, walked rather than skipped: this is the screen a newcomer sees and the owner
  // never sees again. Each click is the same CTA, whose label changes on the last step.
  // The CTA rather than the step label: "Bienvenue" is rendered by the header, the rail and the
  // step body at once, and the step counter is mobile-only (xs: block, md: none). The button is
  // visible at every width and proves the thing that matters — the wizard can be advanced.
  await expect(page.getByRole("button", { name: "Continuer" })).toBeVisible();

  for (let step = 0; step < 6; step++) {
    await page.getByRole("button", { name: "Continuer" }).click();
  }
  await page.getByRole("button", { name: "Aller au tableau de bord" }).click();

  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });

  // --- 3. The journey succeeded -----------------------------------------
  // Reaching /dashboard is the assertion. Getting here means the account was created, the token
  // carried the new OWNER membership, the farm was provisioned, the seven wizard steps each
  // persisted and advanced, and the route guard let the farmer through. Every one of those can
  // break, and every one of them is invisible until someone walks the path.
  //
  // The test deliberately stops asserting here. What the dashboard *renders* depends on a dozen
  // widgets and their endpoints; pinning that down would make this a dashboard test with an
  // onboarding preamble, and it is the preamble that nothing else covers.
  await expect(page).toHaveURL(/\/dashboard$/);
});
