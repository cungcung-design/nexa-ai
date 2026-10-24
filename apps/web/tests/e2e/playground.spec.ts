import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Playground-Browser-Pass";

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

test("playground stores a real conversation and continues it", async ({ page }) => {
  test.setTimeout(300_000);
  const email = `playground-${Date.now()}@example.com`;
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Playground Tester",
  });
  expect(registered.ok, registered.text).toBeTruthy();

  const slug = `playground-${Date.now().toString(36)}`;
  const organization = await browserPost(page, "/api/organizations", {
    name: "Playground Workspace",
    slug,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;

  const agent = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name: "Live Playground Agent",
    description: "Answers from the published version.",
  });
  expect(agent.ok, agent.text).toBeTruthy();
  const agentId = (JSON.parse(agent.text) as { id: string }).id;

  const version = await browserPost(
    page,
    `/api/workspace/${orgId}/agents/${agentId}/versions`,
    {
      system_prompt:
        "Reply with one short sentence and no preamble. Do not explain your reasoning.",
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

  await page.goto(
    `/dashboard/organizations/${orgId}/agents/${agentId}/playground`
  );
  await expect(page.getByRole("heading", { name: "AI Playground" })).toBeVisible();
  await expect(page.getByText(/refund policy/i)).toHaveCount(0);
  await expect(page.getByText(/Published v/)).toBeVisible();

  const input = page.getByRole("textbox", { name: "Message", exact: true });
  await input.fill("Say hello in one short sentence.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Generating response...")).toBeVisible();
  await expect(page.getByText("Say hello in one short sentence.")).toBeVisible();
  const firstReply = page.locator("p.leading-relaxed");
  await expect(firstReply).toBeVisible({ timeout: 120_000 });
  const firstText = (await firstReply.innerText()).trim();
  expect(firstText.length).toBeGreaterThan(0);
  expect(firstText).not.toMatch(/refund policy/i);

  await page.reload();
  await expect(page.getByText("Say hello in one short sentence.")).toBeVisible();
  await expect(page.getByText(firstText)).toBeVisible();

  await input.fill("Say goodbye in one short sentence.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("p.leading-relaxed")).toHaveCount(2, {
    timeout: 150_000,
  });
  await expect(page.getByText("Say hello in one short sentence.")).toBeVisible();
  await expect(page.getByText("Say goodbye in one short sentence.")).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/conversations`);
  await expect(
    page.getByRole("heading", { name: "Say hello in one short sentence." })
  ).toBeVisible();
});

test("playground rejects anonymous and cross-origin requests", async ({
  page,
  request,
}) => {
  const anonymous = await request.post(
    "/api/workspace/00000000-0000-0000-0000-000000000000/agents/00000000-0000-0000-0000-000000000000/chat",
    {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { message: "hello" },
    }
  );
  expect([401, 403]).toContain(anonymous.status());

  const email = `playground-auth-${Date.now()}@example.com`;
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Playground Auth",
  });
  expect(registered.ok, registered.text).toBeTruthy();
  const organization = await browserPost(page, "/api/organizations", {
    name: "Playground Auth Workspace",
    slug: `playground-auth-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;
  const session = (await page.context().cookies()).find(
    (cookie) => cookie.name === "nexa_access"
  );
  expect(session?.value).toBeTruthy();

  const outsider = await page.evaluate(async (organizationId) => {
    const response = await fetch(
      `/api/workspace/${organizationId}/agents/00000000-0000-0000-0000-000000000000/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }
    );
    return response.status;
  }, "00000000-0000-0000-0000-000000000000");
  expect(outsider).toBe(403);

  const crossOrigin = await request.post(
    `/api/workspace/${orgId}/agents/00000000-0000-0000-0000-000000000000/chat`,
    {
      headers: {
        origin: "http://evil.example",
        cookie: `nexa_access=${session?.value}`,
      },
      data: { message: "hello" },
    }
  );
  expect(crossOrigin.status()).toBe(403);
  expect(await crossOrigin.json()).toMatchObject({
    error: "Invalid request origin",
  });
});

test("playground shows a model provider failure without a fake reply", async ({
  page,
}) => {
  const email = `playground-down-${Date.now()}@example.com`;
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Playground Failure",
  });
  expect(registered.ok, registered.text).toBeTruthy();

  const organization = await browserPost(page, "/api/organizations", {
    name: "Playground Failure Workspace",
    slug: `playground-down-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;
  const agent = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name: "Unavailable Model Agent",
    description: "Published with a model the local provider does not serve.",
  });
  expect(agent.ok, agent.text).toBeTruthy();
  const agentId = (JSON.parse(agent.text) as { id: string }).id;
  const version = await browserPost(
    page,
    `/api/workspace/${orgId}/agents/${agentId}/versions`,
    {
      system_prompt: "Reply briefly.",
      model: "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 16,
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

  await page.goto(
    `/dashboard/organizations/${orgId}/agents/${agentId}/playground`
  );
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("This should fail at the provider.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("LLM provider request failed")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("p.leading-relaxed")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
  ).toHaveValue("This should fail at the provider.");
});
