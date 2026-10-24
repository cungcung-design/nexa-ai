import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Account-Browser-Pass-2026";

async function browserPost(page: Page, requestPath: string, data: unknown) {
  return page.evaluate(
    async ({ path: target, data: body }) => {
      const response = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, text };
    },
    { path: requestPath, data }
  );
}

async function register(page: Page, email: string, name: string) {
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name,
  });
  expect(registered.ok, registered.text).toBeTruthy();
}

async function verifyEmail(page: Page) {
  await page.goto("/verify-email");
  await page.getByRole("link", { name: "Verify your email" }).click();
  await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();
}

function expiredAccessToken(): string {
  const envPath = path.resolve(__dirname, "../../../api/.env");
  const env = readFileSync(envPath, "utf8");
  const match = env.match(/^JWT_SECRET=(.*)$/m);
  if (!match) throw new Error("JWT secret is not configured");
  const secret = match[1].trim().replace(/^["']|["']$/g, "");
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: "00000000-0000-4000-8000-000000000009",
      ver: 0,
      iat: now - 3600,
      exp: now - 60,
    })
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

test("password reset uses the development link and the new password signs in", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `reset-${Date.now()}@example.com`;
  await register(page, email, "Reset Tester");

  await page.goto("/password-recovery");
  await expect(
    page.getByRole("heading", { name: "Forgot your password?" })
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  const href = await page
    .getByRole("link", { name: "open the reset link" })
    .getAttribute("href");
  expect(href).toBeTruthy();
  const target = new URL(href!);
  await page.goto(`/password-recovery${target.search}`);
  await expect(
    page.getByRole("heading", { name: "Choose a new password" })
  ).toBeVisible({ timeout: 30_000 });

  const replacement = "Reset-Browser-Pass-2026";
  await page.getByLabel("New password", { exact: true }).fill(replacement);
  await page.getByLabel("Confirm new password").fill(replacement);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(email);
  await page.locator("#auth-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("Email Address").fill(email);
  await page.locator("#auth-password").fill(replacement);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByText(email)).toBeVisible();
});

test("onboarding walks from welcome through workspace setup to the plan step", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `onboard-${Date.now()}@example.com`;
  await register(page, email, "Onboarding Tester");
  await verifyEmail(page);

  await page.goto("/onboarding/welcome");
  await expect(
    page.getByRole("heading", { name: "Welcome to NEXORA" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your workspace" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace information" })
  ).toBeVisible();

  const slug = `onboard-${Date.now().toString(36)}`;
  await page.getByLabel("Workspace Name").fill("Onboarding Workspace");
  await page.getByLabel("Workspace Slug").fill(slug);
  await page.locator("button.nx-ob-details-continue").click();
  await expect(
    page.getByRole("heading", { name: "Choose your plan" })
  ).toBeVisible();
});

test("the account menu signs out and returns to login", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `logout-${Date.now()}@example.com`;
  await register(page, email, "Logout Tester");
  const organization = await browserPost(page, "/api/organizations", {
    name: "Logout Workspace",
    slug: `logout-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  await page.goto(`/dashboard/organizations/${orgId}`);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/dashboard/organizations/${orgId}`);
  await expect(page).toHaveURL(/\/login/);
});

test("an expired access cookie is sent back to login", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `expired-${Date.now()}@example.com`;
  await register(page, email, "Expired Session");
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "nexa_access",
      value: expiredAccessToken(),
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?error=session/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("personal settings save and workspace settings can sign out", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `settings-${Date.now()}@example.com`;
  await register(page, email, "Settings Tester");
  const organization = await browserPost(page, "/api/organizations", {
    name: "Settings Workspace",
    slug: `settings-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  await page.goto("/dashboard/settings/profile");
  await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  await page.getByLabel("Full name").fill("Settings Person");
  await page.getByLabel("Job title").fill("Verification Lead");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Your profile was saved.")).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/settings/security`);
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Require approval for every tool call" })).toBeVisible();
  await page.getByRole("button", { name: "Settings Tester" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("creating an API key appears in the workspace audit log", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `audit-${Date.now()}@example.com`;
  await register(page, email, "Audit Tester");
  const organization = await browserPost(page, "/api/organizations", {
    name: "Audit Workspace",
    slug: `audit-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  await page.goto(`/dashboard/organizations/${orgId}/settings/developer`);
  await page.getByRole("button", { name: "Create API Key" }).click();
  await page.getByLabel("Key name").fill("Audit Browser Key");
  await page.getByRole("button", { name: "Run agents" }).click();
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByTestId("api-key-secret")).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/audit-logs`);
  await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible();
  await expect(page.getByText("Api Key Created").first()).toBeVisible();
  await expect(page.getByText("Audit Browser Key").first()).toBeVisible();
});

test("knowledge upload is indexed by the worker and can be retrieved", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const email = `knowledge-${Date.now()}@example.com`;
  const token = `ZEPHYR-BROWSER-${Date.now().toString(36)}`;
  await register(page, email, "Knowledge Tester");
  const organization = await browserPost(page, "/api/organizations", {
    name: "Knowledge Workspace",
    slug: `knowledge-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  await page.goto(`/dashboard/organizations/${orgId}/knowledge`);
  await page.getByPlaceholder("e.g. Support docs").fill("Browser Sources");
  await page.getByRole("button", { name: "Create knowledge base" }).click();
  await expect(page.getByText("Knowledge base created.")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "browser-source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      `Browser knowledge upload.\nThe retrieval phrase is ${token}.\n`
    ),
  });
  await page.getByRole("button", { name: "Upload Files" }).click();
  await expect(page.getByText("browser-source.txt").first()).toBeVisible();
  await expect(page.getByText("READY", { exact: true }).first()).toBeVisible({
    timeout: 180_000,
  });

  await page.getByPlaceholder("e.g. What is our refund policy?").fill(token);
  await page.getByRole("button", { name: "Run Search" }).click();
  await expect(page.getByText(token).first()).toBeVisible({ timeout: 30_000 });
});
