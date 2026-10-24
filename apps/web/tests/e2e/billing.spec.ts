import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Billing-Browser-Pass";

async function browserPost(page: Page, path: string, data: unknown) {
  return page.evaluate(
    async ({ path: requestPath, data: body }) => {
      const response = await fetch(requestPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, text };
    },
    { path, data }
  );
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  );
  expect(overflow).toBe(true);
}

test("billing shows the catalog and blocks unpaid checkout", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const hydration: string[] = [];
  page.on("console", (message) => {
    if (/hydrat/i.test(message.text())) hydration.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/hydrat/i.test(error.message)) hydration.push(error.message);
  });

  const email = `billing-${Date.now()}@example.com`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Billing Owner",
  });
  expect(registered.ok, registered.text).toBeTruthy();
  const organization = await browserPost(page, "/api/organizations", {
    name: "Billing Browser Workspace",
    slug: `billing-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  const catalogResponse = await page.evaluate(async (id) => {
    const response = await fetch(`/api/workspace/${id}/billing/catalog`);
    return { status: response.status, text: await response.text() };
  }, orgId);
  expect(catalogResponse.status).toBe(200);
  const catalog = JSON.parse(catalogResponse.text) as {
    provider_configured: boolean;
    plans: { key: string; label: string; monthly: { amount: number } | null; contact_sales: boolean }[];
  };
  expect(catalog.provider_configured).toBe(false);
  const amount = (key: string) =>
    catalog.plans.find((plan) => plan.key === key)?.monthly?.amount;
  expect(amount("FREE")).toBe(0);
  expect(amount("STARTER")).toBe(1900);
  expect(amount("PRO")).toBe(4900);
  expect(catalog.plans.find((plan) => plan.key === "BUSINESS")?.contact_sales).toBe(true);

  await page.goto(`/dashboard/organizations/${orgId}/billing`);
  await expect(page.getByRole("heading", { name: "Billing & Subscription" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Current Plan" })).toBeVisible();
  await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("ACTIVE")).toBeVisible();
  await expect(page.getByText("$0.00").first()).toBeVisible();
  await expectNoOverflow(page);

  await page.getByRole("link", { name: "Plans", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose Your Plan" })).toBeVisible();
  await expect(page.getByText("$19")).toBeVisible();
  await expect(page.getByText("$49")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout unavailable" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Contact Sales" })).toBeVisible();
  await expect(page.getByText(/\$29/)).toHaveCount(0);
  await expect(page.getByText(/\$99/)).toHaveCount(0);

  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await page.getByRole("link", { name: "Payment Methods", exact: true }).click();
  await expect(page.getByText("No payment methods")).toBeVisible();

  await page.goto(
    `/dashboard/organizations/${orgId}/billing/subscription?checkout=canceled`
  );
  await expect(page.getByText("The checkout was canceled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage in portal" })).toBeDisabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/organizations/${orgId}/billing`);
  await expect(page.getByRole("heading", { name: "Billing & Subscription" })).toBeVisible();
  await expectNoOverflow(page);
  await page.goto(`/dashboard/organizations/${orgId}/billing/plans`);
  await expect(page.getByText("$49")).toBeVisible();
  await expectNoOverflow(page);

  const viewerEmail = `billing-viewer-${Date.now()}@example.com`;
  const viewer = await browser.newContext();
  const viewerPage = await viewer.newPage();
  await viewerPage.goto("/login");
  const viewerRegistered = await browserPost(viewerPage, "/api/auth/register", {
    email: viewerEmail,
    password: PASSWORD,
    name: "Billing Viewer",
  });
  expect(viewerRegistered.ok, viewerRegistered.text).toBeTruthy();
  const invitation = await browserPost(page, `/api/workspace/${orgId}/team/invitations`, {
    email: viewerEmail,
    role: "VIEWER",
  });
  expect(invitation.ok, invitation.text).toBeTruthy();
  const inviteToken = (JSON.parse(invitation.text) as { invite_token?: string }).invite_token;
  expect(inviteToken).toBeTruthy();
  const accepted = await browserPost(
    viewerPage,
    `/api/invitations/${inviteToken}/accept`,
    {}
  );
  expect(accepted.ok, accepted.text).toBeTruthy();
  await viewerPage.goto(`/dashboard/organizations/${orgId}/billing/plans`);
  await expect(viewerPage.getByText("Only workspace owners can change the plan.")).toBeVisible();
  await expect(viewerPage.getByRole("button", { name: "Checkout unavailable" }).first()).toBeDisabled();

  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await outsiderPage.goto("/login");
  const outsiderRegistered = await browserPost(outsiderPage, "/api/auth/register", {
    email: `billing-outsider-${Date.now()}@example.com`,
    password: PASSWORD,
    name: "Billing Outsider",
  });
  expect(outsiderRegistered.ok, outsiderRegistered.text).toBeTruthy();
  const denied = await outsiderPage.evaluate(async (id) => {
    const response = await fetch(`/api/workspace/${id}/billing/subscription`);
    return { status: response.status, text: await response.text() };
  }, orgId);
  expect(denied.status).toBe(403);
  expect(denied.text).not.toContain("Billing Browser Workspace");
  await outsider.close();
  await viewer.close();
  expect(hydration).toEqual([]);
});
