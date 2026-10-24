import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Studio-Approval-Pass";
const API_CWD = path.resolve(__dirname, "../../../api");
const venvPython =
  process.platform === "win32"
    ? path.join(API_CWD, ".venv", "Scripts", "python.exe")
    : path.join(API_CWD, ".venv", "bin", "python");
const API_PYTHON =
  process.env.NEXA_API_PYTHON ||
  (existsSync(venvPython) ? venvPython : "python");

test.describe.configure({ mode: "serial" });

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

async function register(page: Page, email: string) {
  await page.goto("/login");
  const response = await browserPost(page, "/api/auth/register", {
    email,
    password: PASSWORD,
    name: "Studio Tester",
  });
  expect(response.ok, response.text).toBeTruthy();
}

async function createWorkspace(page: Page, name: string) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const response = await browserPost(page, "/api/organizations", { name, slug });
  expect(response.ok, response.text).toBeTruthy();
  return (JSON.parse(response.text) as { id: string }).id;
}

async function createAgent(page: Page, orgId: string, name: string) {
  const response = await browserPost(page, `/api/workspace/${orgId}/agents`, {
    name,
    description: "Initial studio description.",
  });
  expect(response.ok, response.text).toBeTruthy();
  return (JSON.parse(response.text) as { id: string }).id;
}

async function startWorkflow(page: Page, orgId: string, agentId: string, note: string) {
  const response = await browserPost(page, `/api/workspace/${orgId}/workflows/demo-action`, {
    agent_id: agentId,
    note,
  });
  expect(response.ok, response.text).toBeTruthy();
  return JSON.parse(response.text) as { id: string; status: string; thread_id: string };
}

test("agent studio edits and publishes a version", async ({ page }) => {
  const email = `studio-${Date.now()}@example.com`;
  await register(page, email);
  const orgId = await createWorkspace(page, "Studio Workspace");
  const agentId = await createAgent(page, orgId, "Studio Agent");

  await page.goto(
    `/dashboard/organizations/${orgId}/agents/${agentId}/studio/instructions`
  );
  await expectNoStudioCrash(page);
  await expect(page.getByRole("heading", { name: "Studio Agent" })).toBeVisible();
  const instructions = page.getByPlaceholder(
    "Define the agent's behavior, persona, and instructions..."
  );
  await instructions.fill("Published instructions for the studio agent.");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Version published.")).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/agents/${agentId}`);
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/agents/${agentId}/versions`);
  await expect(page.getByRole("heading", { name: "v1" })).toBeVisible();

  await page.goto(
    `/dashboard/organizations/${orgId}/agents/${agentId}/studio/versions`
  );
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
});

test("dashboard approve and reject resume the workflow", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `approval-${Date.now()}@example.com`;
  await register(page, email);
  const orgId = await createWorkspace(page, "Approval Workspace");
  const agentId = await createAgent(page, orgId, "Approval Agent");

  const pending = await startWorkflow(page, orgId, agentId, "browser approve");
  expect(pending.status).toBe("PENDING");

  await page.goto(`/dashboard/organizations/${orgId}/approvals/inbox`);
  await expect(page.getByRole("link", { name: /demo_create_note/ }).first()).toBeVisible();

  await page.goto(`/dashboard/organizations/${orgId}/approvals/${pending.id}`);
  await expect(page.getByText("Pending review")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Decision already recorded")).toBeVisible();

  const repeat = await browserPost(
    page,
    `/api/workspace/${orgId}/workflows/approvals/${pending.id}/decision`,
    { approved: true }
  );
  expect(repeat.status).toBe(409);
  const conflict = JSON.parse(repeat.text) as { detail?: string; error?: string };
  expect(conflict.detail ?? conflict.error).toContain("Approval already decided");

  const rejected = await startWorkflow(page, orgId, agentId, "browser reject");
  await page.goto(`/dashboard/organizations/${orgId}/approvals/${rejected.id}`);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Decision already recorded")).toBeVisible();
  await page.reload();
  await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
  await expect(page.getByText("Rejected — blocked")).toBeVisible();
  expect(workflowOutcome(rejected.thread_id)).toBe("Action rejected by human");
});

test("dashboard approval resumes after the API process restarts", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `restart-${Date.now()}@example.com`;
  await register(page, email);
  const orgId = await createWorkspace(page, "Restart Workspace");
  const agentId = await createAgent(page, orgId, "Restart Agent");
  const pending = await startWorkflow(page, orgId, agentId, "after api restart");

  await page.goto(`/dashboard/organizations/${orgId}/approvals/${pending.id}`);
  await expect(page.getByText("Pending review")).toBeVisible();

  await restartApi();

  await page.getByRole("button", { name: "Approve" }).click();
  const recorded = page.getByText("Decision already recorded");
  const alert = page.getByRole("alert");
  const decisionDeadline = Date.now() + 30_000;
  let alertText = "";
  while (Date.now() < decisionDeadline) {
    if (await recorded.isVisible()) break;
    if (await alert.isVisible()) alertText = (await alert.innerText()).trim();
    await delay(250);
  }
  if (!(await recorded.isVisible())) {
    throw new Error(alertText || "Decision was not recorded after the API restart");
  }
  await page.reload();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  expect(workflowOutcome(pending.thread_id)).toBe("Demo note created: after api restart");
});

function apiEnv() {
  const env = { ...process.env };
  delete env.TEST_DATABASE_URL;
  delete env.CHECKPOINT_DATABASE_URL;
  return env;
}

function workflowOutcome(threadId: string) {
  return execFileSync(
    API_PYTHON,
    [
      "-c",
      [
        "import sys",
        "from app.ai.workflows.approval import build_approval_graph",
        "from app.ai.workflows.checkpointer import open_checkpoint_runtime",
        "runtime = open_checkpoint_runtime()",
        "try:",
        "    graph = build_approval_graph(runtime.saver)",
        "    state = graph.get_state({'configurable': {'thread_id': sys.argv[1]}})",
        "    result = (state.values or {}).get('result') or {}",
        "    print(result.get('note') or result.get('error') or '')",
        "finally:",
        "    runtime.close()",
      ].join("\n"),
      threadId,
    ],
    { cwd: API_CWD, env: apiEnv(), encoding: "utf8" }
  ).trim();
}

async function restartApi() {
  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$line = netstat -ano | Select-String ':8000\\s+.*LISTENING' | Select-Object -First 1; if (-not $line) { throw 'API listener not found' }; $listener = ($line.ToString().Trim() -split '\\s+')[-1]; Stop-Process -Id ([int]$listener) -Force",
      ],
      { stdio: "pipe" }
    );
  } else {
    execFileSync(
      "bash",
      [
        "-lc",
        "pid=$(ss -ltnp 'sport = :8000' | sed -nE 's/.*pid=([0-9]+).*/\\1/p' | head -n 1); test -n \"$pid\" || { echo 'API listener not found' >&2; exit 1; }; kill \"$pid\" || true; for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do ss -ltn 'sport = :8000' | grep -q ':8000' || exit 0; sleep 0.5; done; kill -9 \"$pid\" || true; sleep 0.5",
      ],
      { stdio: "pipe" }
    );
  }
  const child = spawn(
    API_PYTHON,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    { cwd: API_CWD, env: apiEnv(), detached: true, stdio: "ignore" }
  );
  child.unref();
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:8000/ready");
      if (response.ok) return;
    } catch {
      // The listener is still coming back.
    }
    await delay(500);
  }
  throw new Error("API did not come back after restart");
}

async function expectNoStudioCrash(page: Page) {
  await expect(page.getByText("Cannot access 'isActive' before initialization")).toHaveCount(0);
}
