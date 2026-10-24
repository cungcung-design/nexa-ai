import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Analytics-Browser-Pass";

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

test("a playground request appears in analytics and traces", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const hydration: string[] = [];
  page.on("console", (message) => {
    if (/hydrat/i.test(message.text())) hydration.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/hydrat/i.test(error.message)) hydration.push(error.message);
  });

  const email = `analytics-${Date.now()}@example.com`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Analytics Tester",
  });
  expect(registered.ok, registered.text).toBeTruthy();

  const organization = await browserPost(page, "/api/organizations", {
    name: "Analytics Workspace",
    slug: `analytics-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  const agent = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name: "Trace Browser Agent",
    description: "Records a playground request.",
  });
  expect(agent.ok, agent.text).toBeTruthy();
  const agentId = (JSON.parse(agent.text) as { id: string }).id;
  const version = await browserPost(
    page,
    `/api/workspace/${orgId}/agents/${agentId}/versions`,
    {
      system_prompt: "Reply with one short sentence and no preamble.",
      model: "qwen3:4b",
      temperature: 0.2,
      max_tokens: 512,
      tools_config: {},
    }
  );
  expect(version.ok, version.text).toBeTruthy();
  const versionId = (JSON.parse(version.text) as { id: string }).id;
  const published = await browserPost(
    page,
    `/api/workspace/${orgId}/agents/${agentId}/publish/${versionId}`,
    {}
  );
  expect(published.ok, published.text).toBeTruthy();

  await page.goto(`/dashboard/organizations/${orgId}/agents/${agentId}/playground`);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(
    "Say hello in one short sentence."
  );
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("p.leading-relaxed")).toBeVisible({ timeout: 120_000 });

  await page.goto(`/dashboard/organizations/${orgId}/analytics`);
  await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Total requests 1 / })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Success rate 100%/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Total cost Unavailable/ })).toBeVisible();
  await expect(page.getByRole("table").getByText("Trace Browser Agent")).toBeVisible();
  await expect(page.getByText(/Token usage \d+/)).toBeVisible();
  await expect(page.getByText(/Illustrative/)).toHaveCount(0);
  await expectNoOverflow(page);

  await page.goto(`/dashboard/organizations/${orgId}/analytics/traces`);
  await expect(page.getByRole("heading", { name: "Execution Traces" })).toBeVisible();
  await expect(page.getByText("qwen3:4b")).toBeVisible();
  await page.getByRole("link", { name: /Trace Browser Agent/ }).click();
  await expect(page).toHaveURL(/\/analytics\/traces\/[0-9a-f-]+$/);
  const traceId = page.url().split("/").pop() ?? "";
  await expect(page.getByText("qwen3:4b").first()).toBeVisible();
  await expect(page.getByText("Prompt tokens")).toBeVisible();
  await expect(page.getByText("Completion tokens")).toBeVisible();
  await expect(page.getByText("Total tokens")).toBeVisible();
  await expect(page.getByText("llm_call")).toBeVisible();
  await page.reload();
  await expect(page.getByText("llm_call")).toBeVisible();
  await expect(page.getByText("qwen3:4b").first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/organizations/${orgId}/analytics/traces`);
  await expect(page.getByText("qwen3:4b")).toBeVisible();
  await expectNoOverflow(page);
  await page.goto(`/dashboard/organizations/${orgId}/analytics/traces/${traceId}`);
  await expectNoOverflow(page);

  await page.goto(`/dashboard/organizations/${orgId}/audit-logs`);
  await expect(page.getByRole("heading", { name: "Audit Logs", level: 1 })).toBeVisible();
  await page.goto(`/dashboard/organizations/${orgId}/team`);
  await expect(page.getByRole("heading", { name: "Members", level: 2 })).toBeVisible();
  expect(hydration).toEqual([]);

  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await outsiderPage.goto("/login");
  const other = await browserPost(outsiderPage, "/api/auth/register", {
    email: `analytics-outsider-${Date.now()}@example.com`,
    password: PASSWORD,
    name: "Outsider",
  });
  expect(other.ok, other.text).toBeTruthy();
  const denied = await outsiderPage.evaluate(async (path) => {
    const response = await fetch(path);
    return { status: response.status, text: await response.text() };
  }, `/api/workspace/${orgId}/analytics/traces/${traceId}`);
  expect(denied.status).toBe(403);
  expect(denied.text).not.toContain("qwen3:4b");
  expect(denied.text).not.toContain(traceId);
  await outsider.close();
});
