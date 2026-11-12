import { expect, test } from "@playwright/test";

// Layout acceptance (tasks 7.1/8.3): at 375, 768, and 1280 px the
// page never scrolls horizontally and all four panels stay visible.
// One test, one sandbox; the viewport is resized in place.

test("no horizontal scroll and all panels present at 375, 768, and 1280px", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Agent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Audit trail" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});
