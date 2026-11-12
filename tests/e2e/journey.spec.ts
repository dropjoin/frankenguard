import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// The full demo journey, in order, on one shared sandbox: first
// visit, scenarios, the freeze round trip, edits that govern the
// next decision, the manual form, reset, and chain verification
// including the tampered state. Serial on purpose (see the config
// note about the sandbox-creation budget). The over_daily scenario
// is not run here: it submits up to 50 proposals, and its sizing
// logic is covered by unit tests.

let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterAll(async () => {
  await context.close();
});

const cards = () => page.locator(".decision-card");

test("first visit creates a sandbox and shows the banner and all four panels", async () => {
  await page.goto("/");
  await expect(page.getByText("SIMULATED MONEY ONLY")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audit trail" })).toBeVisible();
  await expect(page.locator("header").getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(page.getByText("The monster is sleeping.")).toBeVisible();
});

test("scenarios land their verdicts", async () => {
  await page.getByRole("button", { name: /Happy path/ }).click();
  await expect(cards()).toHaveCount(1);
  await expect(cards().first()).toContainText("APPROVED");
  await expect(page.locator(".meter-amounts")).toContainText("$100.00");

  await page.getByRole("button", { name: /Over per-transaction cap/ }).click();
  await expect(cards()).toHaveCount(2);
  await expect(cards().first()).toContainText("BLOCKED");
  await expect(cards().first()).toContainText("PER_TX_CAP_EXCEEDED");

  await page.getByRole("button", { name: /Unknown recipient/ }).click();
  await expect(cards()).toHaveCount(3);
  await expect(cards().first()).toContainText("RECIPIENT_NOT_ALLOWED");

  await page.getByRole("button", { name: /Prompt injection/ }).click();
  await expect(cards()).toHaveCount(4);
  await expect(cards().first()).toContainText("Caught by FrankenGuard!");
  await expect(cards().first()).toContainText("PER_TX_CAP_EXCEEDED");
  // The injection memo changed nothing: the daily spend is still
  // just the one approved happy-path payment.
  await expect(page.locator(".meter-amounts")).toContainText("$100.00");
});

test("freeze round trip: toggle, frozen scenario, toggle back", async () => {
  const frozenButton = page.getByRole("button", { name: /Frozen system/ });
  await expect(frozenButton).toBeDisabled();

  await page.getByRole("switch", { name: "Freeze all payments" }).click();
  await expect(page.locator("header").getByText("FROZEN", { exact: true })).toBeVisible();
  await expect(page.locator(".frozen-banner-wrap").getByText("All payments are blocked.")).toBeVisible();
  await expect(frozenButton).toBeEnabled();

  await frozenButton.click();
  await expect(cards()).toHaveCount(5);
  await expect(cards().first()).toContainText("SYSTEM_FROZEN");

  await page.getByRole("switch", { name: "Freeze all payments" }).click();
  await expect(page.locator("header").getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(page.locator(".frozen-banner-wrap")).toBeHidden();
});

test("edits govern the next decision", async () => {
  await page.getByLabel("Per-transaction cap (USD)").fill("50.00");
  await page.getByRole("button", { name: "Save caps" }).click();
  await expect(page.getByText(/Caps saved/)).toBeVisible();

  await page.getByRole("button", { name: /Happy path/ }).click();
  await expect(cards()).toHaveCount(6);
  await expect(cards().first()).toContainText("PER_TX_CAP_EXCEEDED");

  await page.getByLabel("Per-transaction cap (USD)").fill("500.00");
  await page.getByRole("button", { name: "Save caps" }).click();
  await expect(page.getByText(/Caps saved/)).toBeVisible();

  await page.getByLabel("Recipient key").fill("new-partner");
  await page.getByLabel("Label (optional)").fill("New Partner");
  await page.getByRole("button", { name: "Add recipient" }).click();
  await expect(page.getByText("New Partner")).toBeVisible();

  const manualForm = page.locator(".manual-form");
  await manualForm.getByLabel("Recipient").fill("new-partner");
  await manualForm.getByLabel("Amount (USD)").fill("10.00");
  await manualForm.getByRole("button", { name: "Propose payment" }).click();
  await expect(cards()).toHaveCount(7);
  await expect(cards().first()).toContainText("APPROVED");

  await page.getByRole("button", { name: "Remove New Partner" }).click();
  await expect(page.getByText("New Partner")).toBeHidden();
});

test("manual form converts dollars to cents, then reset wipes the sandbox", async () => {
  const manualForm = page.locator(".manual-form");
  await manualForm.getByLabel("Recipient").fill("acme-corp");
  await manualForm.getByLabel("Amount (USD)").fill("19.99");
  await manualForm.getByRole("button", { name: "Propose payment" }).click();
  await expect(cards()).toHaveCount(8);
  await expect(cards().first()).toContainText("APPROVED");
  await expect(page.locator(".meter-amounts")).toContainText("$129.99");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("The monster is sleeping.")).toBeVisible();
  await expect(page.locator(".meter-amounts")).toContainText("$0.00");
});

test("verify chain: intact, then broken after tampering", async () => {
  await page.getByRole("button", { name: /Happy path/ }).click();
  await expect(cards()).toHaveCount(1);

  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByText("Chain intact")).toBeVisible();

  // Tamper with the second entry (the first proposal receipt)
  // through the flag-gated demo endpoint, using the page's own
  // sandbox cookie. Seqs are global across sandboxes, so the target
  // comes from the audit listing, never a hardcoded number.
  const audit = await page.request.get("/api/audit?limit=50");
  const entries = (await audit.json()) as { entries: { seq: number }[] };
  const targetSeq = entries.entries[1]?.seq;
  expect(targetSeq).toBeDefined();
  const tampered = await page.request.post("/api/_demo/tamper", { data: { seq: targetSeq } });
  expect(tampered.ok()).toBe(true);

  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByText("Chain broken")).toBeVisible();
  await expect(page.getByText(`broke at entry #${targetSeq}`)).toBeVisible();
});
