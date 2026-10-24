import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "Invitation-Browser-Pass";

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

async function registerAccount(page: Page, email: string, name: string) {
  await page.goto("/login");
  const registered = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name,
  });
  expect(registered.ok, registered.text).toBeTruthy();
}

async function createWorkspace(page: Page, name: string) {
  const organization = await browserPost(page, "/api/organizations", {
    name,
    slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
  });
  expect(organization.ok, organization.text).toBeTruthy();
  return JSON.parse(organization.text) as { id: string; name: string };
}

async function inviteViewer(page: Page, orgId: string, email: string) {
  await page.goto(`/dashboard/organizations/${orgId}/team/invitations`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Workspace role").selectOption("VIEWER");
  await page.getByRole("button", { name: "Send Invitation" }).click();
  const link = await page.getByLabel("Invitation link").inputValue();
  await page.evaluate(() => {
    const field = document.querySelector(
      "[aria-label='Invitation link']"
    ) as HTMLInputElement | null;
    if (field) field.value = "";
  });
  expect(link).toContain("/invitations/");
  return link;
}

async function openContext(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

test("a new viewer registers, confirms email, and joins the invited workspace", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ownerEmail = `invite-owner-${Date.now()}@example.com`;
  const viewerEmail = `invite-viewer-${Date.now()}@example.com`;
  await registerAccount(page, ownerEmail, "Invitation Owner");
  const workspace = await createWorkspace(page, "Invited Workspace");
  const link = await inviteViewer(page, workspace.id, viewerEmail);

  const viewer = await openContext(browser);
  await viewer.page.goto(link);
  await viewer.page.getByRole("link", { name: /Create an account/ }).click();
  await viewer.page.getByLabel("Full Name").fill("Invited Viewer");
  await viewer.page.getByLabel("Work Email").fill(viewerEmail);
  await viewer.page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await viewer.page.getByRole("checkbox").check();
  await viewer.page.getByRole("button", { name: "Create Account" }).click();

  await viewer.page.getByRole("link", { name: "Verify your email" }).click();
  await viewer.page.getByRole("link", { name: "Continue" }).click();
  await expect(
    viewer.page.getByRole("heading", { name: "Invited Workspace" })
  ).toBeVisible();
  await viewer.page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(viewer.page).toHaveURL(
    new RegExp(`/dashboard/organizations/${workspace.id}/team`)
  );
  await expect(viewer.page.getByRole("heading", { name: "Team" })).toBeVisible();
  await expect(viewer.page.getByRole("link", { name: viewerEmail })).toBeVisible();
  await expect(viewer.page.getByText("Viewer").first()).toBeVisible();

  await viewer.page.goto(
    `/dashboard/organizations/${workspace.id}/team/invitations`
  );
  await expect(
    viewer.page.getByRole("heading", { name: "Invite a teammate" })
  ).toHaveCount(0);
  const denied = await viewer.page.evaluate(async (organizationId) => {
    const response = await fetch(
      `/api/workspace/${organizationId}/team/invitations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "someone-else@example.com",
          role: "VIEWER",
        }),
      }
    );
    return response.status;
  }, workspace.id);
  expect(denied).toBe(403);

  const stranger = await openContext(browser);
  await registerAccount(
    stranger.page,
    `invite-stranger-${Date.now()}@example.com`,
    "Stranger"
  );
  await stranger.page.goto(link);
  await expect(
    stranger.page.getByText("This invitation was already accepted")
  ).toBeVisible();
  await expect(
    stranger.page.getByRole("button", { name: "Accept invitation" })
  ).toHaveCount(0);
  const hiddenWorkspace = await stranger.page.evaluate(async (organizationId) => {
    const response = await fetch(`/api/workspace/${organizationId}/settings`);
    return response.status;
  }, workspace.id);
  expect(hiddenWorkspace).toBe(403);

  await viewer.context.close();
  await stranger.context.close();
});

test("an existing member accepts an invitation and can switch workspaces", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const ownerEmail = `invite-existing-owner-${Date.now()}@example.com`;
  const memberEmail = `invite-existing-member-${Date.now()}@example.com`;
  await registerAccount(page, ownerEmail, "Existing Owner");
  const invited = await createWorkspace(page, "Shared Workspace");

  const member = await openContext(browser);
  await registerAccount(member.page, memberEmail, "Existing Member");
  const personal = await createWorkspace(member.page, "Personal Workspace");
  const link = await inviteViewer(page, invited.id, memberEmail);

  await member.page.goto(link);
  await member.page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member.page).toHaveURL(
    new RegExp(`/dashboard/organizations/${invited.id}/team`)
  );
  await expect(member.page.getByRole("link", { name: memberEmail })).toBeVisible();
  await expect(member.page.getByText("Viewer").first()).toBeVisible();

  const selector = member.page.getByLabel("Select workspace");
  await expect(selector).toBeVisible();
  await expect(selector).toContainText("Shared Workspace");
  await expect(selector).toContainText("Personal Workspace");
  await selector.selectOption(personal.id);
  await expect(member.page).toHaveURL(
    new RegExp(`/dashboard/organizations/${personal.id}/`)
  );
  await member.page.goto(`/dashboard/organizations/${invited.id}/team`);
  await expect(member.page.getByRole("heading", { name: "Team" })).toBeVisible();

  const hidden = await member.page.evaluate(async () => {
    const response = await fetch(
      "/api/workspace/00000000-0000-0000-0000-000000000000/settings"
    );
    return response.status;
  });
  expect(hidden).toBe(403);

  await member.context.close();
});
