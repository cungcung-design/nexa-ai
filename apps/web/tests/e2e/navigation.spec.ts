import { test, expect } from "@playwright/test";

test("application loads", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();
});

test("login page loads", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.locator("body")
  ).toBeVisible();

  await expect(page).toHaveURL(/\/login/);
});
