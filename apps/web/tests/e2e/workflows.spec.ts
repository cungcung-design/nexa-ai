import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Workflow-Browser-Pass";

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

test("workflows run demo_create_note through approval and keep history", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const email = `workflows-${Date.now()}@example.com`;
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Workflow Tester",
  });
  expect(registered.ok, registered.text).toBeTruthy();

  const organization = await browserPost(page, "/api/organizations", {
    name: "Workflow Workspace",
    slug: `workflows-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  const orgId = (JSON.parse(organization.text) as { id: string }).id;
  const agent = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name: "Workflow Agent",
    description: "Used by the workflow console.",
  });
  expect(agent.ok, agent.text).toBeTruthy();

  await page.goto(`/dashboard/organizations/${orgId}/workflows`);
  await expect(page.getByRole("heading", { name: "Workflows", exact: true })).toBeVisible();
  await expect(page.getByText("demo_create_note").first()).toBeVisible();
  await expect(page.getByText("142 req/min")).toHaveCount(0);
  await expect(page.getByText("Latency 15ms")).toHaveCount(0);
  await expect(page.getByText("Apply Normalization")).toHaveCount(0);
  await expect(page.getByText("No executions yet.")).toBeVisible();

  await page.getByLabel("Note").fill("alpha note");
  await page.getByRole("button", { name: "Start workflow" }).click();
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await expect(page.getByText("Paused before the note is written.")).toBeVisible();
  await expect(page.getByText(/Execution [0-9a-f-]{36}/i)).toBeVisible();

  await page.getByRole("link", { name: "Approval inbox" }).click();
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
  await page.getByRole("link", { name: /demo_create_note/ }).first().click();
  await expect(page.getByRole("heading", { name: "demo_create_note" })).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Decision already recorded")).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/workflows`);
  await expect(page.getByText("Demo note created: alpha note")).toBeVisible();
  await expect(page.getByText("Completed")).toBeVisible();

  await page.getByLabel("Note").fill("beta note");
  await page.getByRole("button", { name: "Start workflow" }).click();
  await expect(page.getByRole("link", { name: "Open approval" })).toBeVisible();
  await page.getByRole("link", { name: "Approval inbox" }).click();
  await page.getByRole("link", { name: /demo_create_note/ }).first().click();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Decision already recorded")).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/workflows`);
  await expect(page.getByText("Action rejected by human")).toBeVisible();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo note created: alpha note")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Demo note created: alpha note")).toBeVisible();
  await expect(page.getByText("Action rejected by human")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Workflows", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start workflow" })).toBeVisible();
  await expect(page.getByText("Demo note created: alpha note")).toBeVisible();
  await expect(page.getByText("Action rejected by human")).toBeVisible();
  await expect(page.getByRole("link", { name: "Approval inbox" })).toBeVisible();
});
