import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Accessibility pass (task 7.9): axe reports no serious or critical
// violations on the default, blocked-decision, and frozen states.
// One shared page, serial, for the same sandbox-budget reason as
// the journey spec.

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

async function expectNoSeriousViolations(state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious,
    `${state}: ${serious.map((v) => `${v.id} (${v.impact}): ${v.description}`).join("; ")}`,
  ).toEqual([]);
}

test("default state has no serious or critical axe violations", async () => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agent" })).toBeVisible();
  await expectNoSeriousViolations("default");
});

test("blocked decision state has no serious or critical axe violations", async () => {
  await page.getByRole("button", { name: /Prompt injection/ }).click();
  await expect(page.locator(".decision-card").first()).toContainText("BLOCKED");
  await expectNoSeriousViolations("blocked");
});

test("frozen state has no serious or critical axe violations", async () => {
  await page.getByRole("switch", { name: "Freeze all payments" }).click();
  await expect(page.getByText("All payments are blocked.")).toBeVisible();
  await expectNoSeriousViolations("frozen");
});
