import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  ["/", "Build intelligent AI agents."],
  ["/features", "What a NEXORA workspace includes"],
  ["/solutions", "Ways teams use a NEXORA workspace"],
  ["/pricing", "Plans from the billing catalog"],
  ["/security", "Controls that are part of NEXORA"],
  ["/contact", "Contact NEXORA"],
  ["/login", "Welcome back"],
  ["/register", "Create your account"],
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
] as const;

const VIEWPORTS = [
  { width: 1440, height: 900, mobile: false },
  { width: 834, height: 1112, mobile: false },
  { width: 390, height: 844, mobile: true },
] as const;

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  });
  expect(overflow).toBe(true);
}

async function openMobileMenu(page: Page) {
  const toggle = page.getByRole("button", { name: "Open menu" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
}

test.describe("public website", () => {
  for (const viewport of VIEWPORTS) {
    test(`loads the public routes at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const [path, heading] of PAGES) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBeLessThan(400);
        await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
        await expectNoOverflow(page);
      }
    });
  }

  test("uses the desktop navigation at 1440px and 834px", async ({ page }) => {
    for (const width of [1440, 834]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const header = page.getByRole("banner");
      await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
      await expect(page.getByRole("link", { name: "Features" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Log In" })).toBeVisible();
      await expect(
        header.getByRole("link", { name: "Get Started", exact: true })
      ).toBeVisible();
    }
  });

  test("navigates from the homepage to every public section", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const destinations = [
      ["Features", "/features"],
      ["Solutions", "/solutions"],
      ["Pricing", "/pricing"],
      ["Security", "/security"],
      ["Contact", "/contact"],
    ] as const;

    for (const [label, path] of destinations) {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", {
        name: label,
      }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await page.getByRole("link", { name: "NEXORA home" }).first().click();
      await expect(page).toHaveURL(/\/$/);
    }

    await page.goto("/security");
    await page.getByRole("banner").getByRole("link", { name: "Log In" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/security");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Get Started", exact: true })
      .click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("opens, escapes, and navigates the mobile menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(page.getByRole("link", { name: "Features" })).toBeHidden();
    await expect(header.getByRole("link", { name: "Log In" })).toBeVisible();
    await expect(
      header.getByRole("link", { name: "Get Started", exact: true })
    ).toBeVisible();

    await openMobileMenu(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Features" })).toBeHidden();

    await openMobileMenu(page);
    await page.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    const plans = page.getByRole("region", { name: "Subscription plans" });
    await expect(plans.getByText("$19", { exact: true })).toBeVisible();
    await expect(plans.getByText("$49", { exact: true })).toBeVisible();
    await expect(plans.getByText("Custom", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expectNoOverflow(page);

    await page.goto("/contact");
    await expect(page.getByRole("button", { name: "Send Message" })).toBeVisible();
    await expect(page.getByText("Thanks for reaching out")).toHaveCount(0);
  });
});
