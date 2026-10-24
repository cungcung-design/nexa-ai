import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Api-Key-Browser-Pass";

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

test("developer settings create, mask, and revoke an API key", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const email = `apikeys-${Date.now()}@example.com`;
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "API Key Tester",
  });
  expect(registered.ok, registered.text).toBeTruthy();

  const organization = await browserPost(page, "/api/organizations", {
    name: "API Key Workspace",
    slug: `apikeys-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;
  const agent = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name: "Key Agent",
    description: "Used to prove API key authentication.",
  });
  expect(agent.ok, agent.text).toBeTruthy();
  const agentId = (JSON.parse(agent.text) as { id: string }).id;

  await page.goto(`/dashboard/organizations/${orgId}/settings/developer`);
  await expect(page.getByRole("heading", { name: "API & Developer" })).toBeVisible();
  await expect(page.getByText("No API key yet")).toBeVisible();

  await page.getByRole("button", { name: "Create API Key" }).click();
  await page.getByLabel("Key name").fill("Browser API Key");
  await page.getByRole("button", { name: "Run agents" }).click();
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByTestId("api-key-secret")).toBeVisible();

  const created = await page.evaluate(async () => {
    const secret =
      document.querySelector("[data-testid=api-key-secret]")?.textContent?.trim() ??
      "";
    const shown = secret.startsWith("nexa_live_") && secret.length > 30;
    let copied = false;
    try {
      await navigator.clipboard.writeText(secret);
      copied = (await navigator.clipboard.readText()) === secret;
    } catch {
      copied = false;
    }
    sessionStorage.setItem("nexa-key-probe", secret);
    const node = document.querySelector("[data-testid=api-key-secret]");
    if (node) node.textContent = "";
    return { shown, copied, length: secret.length };
  });
  expect(created.shown).toBeTruthy();
  expect(created.copied).toBeTruthy();
  expect(created.length).toBeGreaterThan(30);

  const accepted = await page.evaluate(async (targetAgentId) => {
    const secret = sessionStorage.getItem("nexa-key-probe") ?? "";
    const response = await fetch("http://127.0.0.1:8000/api/v1/external/agents/" + targetAgentId + "/invoke", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "ping" }),
    });
    return response.status;
  }, agentId).catch(() => 0);
  const authStatus =
    accepted === 0
      ? await (async () => {
          const secret = await page.evaluate(
            () => sessionStorage.getItem("nexa-key-probe") ?? ""
          );
          const response = await fetch(
            `http://127.0.0.1:8000/api/v1/external/agents/${agentId}/invoke`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ message: "ping" }),
            }
          );
          return response.status;
        })()
      : accepted;
  expect(authStatus).toBe(400);

  await page.getByRole("button", { name: "Hide secret" }).click();
  await expect(page.getByTestId("api-key-secret")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("api-key-secret")).toHaveCount(0);
  await expect(page.getByText(/nexa_•+/)).toBeVisible();
  await expect(page.getByText("Browser API Key")).toBeVisible();

  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("was revoked")).toBeVisible();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();

  const revoked = await (async () => {
    const secret = await page.evaluate(
      () => sessionStorage.getItem("nexa-key-probe") ?? ""
    );
    const response = await fetch(
      `http://127.0.0.1:8000/api/v1/external/agents/${agentId}/invoke`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "ping" }),
      }
    );
    await page.evaluate(() => sessionStorage.removeItem("nexa-key-probe"));
    return response.status;
  })();
  expect(revoked).toBe(401);

  const outsider = await browser.newPage();
  await outsider.goto("/login");
  const other = await browserPost(outsider, "/api/auth/register", {
    email: `apikeys-out-${Date.now()}@example.com`,
    password: PASSWORD,
    name: "Other Workspace",
  });
  expect(other.ok, other.text).toBeTruthy();
  const denied = await outsider.evaluate(async (organizationId) => {
    const response = await fetch(`/api/workspace/${organizationId}/api-keys`);
    return response.status;
  }, orgId);
  expect(denied).toBe(403);
  const body = await outsider.evaluate(async (organizationId) => {
    const response = await fetch(`/api/workspace/${organizationId}/api-keys`);
    return response.text();
  }, orgId);
  expect(body).not.toContain("nexa_live_");
  expect(body).not.toContain("Browser API Key");
  await outsider.close();
});

async function invokeStatus(agentId: string, secret: string) {
  const response = await fetch(
    `http://127.0.0.1:8000/api/v1/external/agents/${agentId}/invoke`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "ping" }),
    }
  );
  return response.status;
}

test("developer settings rotate a key and reject the previous secret", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const email = `rotate-${Date.now()}@example.com`;
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Rotation Tester",
  });
  expect(registered.ok, registered.text).toBeTruthy();

  const organization = await browserPost(page, "/api/organizations", {
    name: "Rotation Workspace",
    slug: `rotate-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;
  const agent = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name: "Rotation Agent",
    description: "Used to prove a rotated key authenticates.",
  });
  expect(agent.ok, agent.text).toBeTruthy();
  const agentId = (JSON.parse(agent.text) as { id: string }).id;

  await page.goto(`/dashboard/organizations/${orgId}/settings/developer`);
  await expect(page.getByText("No API key yet")).toBeVisible();
  await page.getByRole("button", { name: "Create API Key" }).click();
  await page.getByLabel("Key name").fill("Browser Rotation Key");
  await page.getByRole("button", { name: "Run agents" }).click();
  await page.getByRole("button", { name: "Create key" }).click();
  const original = (
    await page.getByTestId("api-key-secret").innerText()
  ).trim();
  expect(original.startsWith("nexa_live_")).toBeTruthy();
  await page.getByRole("button", { name: "Hide secret" }).click();

  await page.getByRole("button", { name: "Rotate" }).click();
  await expect(page.getByText("was rotated")).toBeVisible();
  const rotated = (
    await page.getByTestId("api-key-secret").innerText()
  ).trim();
  expect(rotated.startsWith("nexa_live_")).toBeTruthy();
  expect(rotated).not.toBe(original);
  await page.getByRole("button", { name: "Hide secret" }).click();
  await page.reload();
  await expect(page.getByTestId("api-key-secret")).toHaveCount(0);
  await expect(page.getByText("Browser Rotation Key (rotated)")).toBeVisible();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  const pageText = await page.locator("main.settings-screen").innerText();
  expect(pageText).not.toContain(original);
  expect(pageText).not.toContain(rotated);

  expect(await invokeStatus(agentId, original)).toBe(401);
  expect(await invokeStatus(agentId, rotated)).toBe(400);
});
