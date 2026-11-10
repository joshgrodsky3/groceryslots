import { expect, type Page, test } from "@playwright/test";
import {
  BUTTON_NAMES,
  REEL_KEYS,
  REEL_LABELS,
  TEST_IDS,
} from "../src/lib/spin/types";

/** Reels land within ~2.5 s; allow generous time for the server action and CI runners. */
const LAND_TIMEOUT = 15_000;

async function pull(page: Page) {
  await page.getByRole("button", { name: BUTTON_NAMES.pull }).click();
  await expectLanded(page);
}

/** Waits until all three reels have landed and the status line names them. */
async function expectLanded(page: Page) {
  await expect(page.getByTestId(TEST_IDS.status)).toContainText("Cook with", {
    timeout: LAND_TIMEOUT,
  });
  for (const reel of REEL_KEYS) {
    await expect(page.getByTestId(TEST_IDS.reelName(reel))).toHaveText(/\S/, {
      timeout: LAND_TIMEOUT,
    });
  }
}

async function respin(page: Page) {
  await page.getByRole("button", { name: BUTTON_NAMES.respin }).click();
  // The status flips to "Spinning…" as soon as the re-spin starts.
  await expect(page.getByTestId(TEST_IDS.status)).toHaveText("Spinning…");
  await expectLanded(page);
}

async function reelName(page: Page, reel: (typeof REEL_KEYS)[number]) {
  return page.getByTestId(TEST_IDS.reelName(reel)).innerText();
}

test("pull lands three ingredients and offers two re-spins", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: BUTTON_NAMES.pull }),
  ).toBeEnabled();

  await page.getByRole("button", { name: BUTTON_NAMES.pull }).click();

  await expectLanded(page);
  await expect(page.getByTestId(TEST_IDS.respinsLeft)).toHaveText(
    "2 re-spins left",
  );
});

test("locked reel keeps its ingredient through re-spins", async ({ page }) => {
  await page.goto("/");
  await pull(page);

  const produceBefore = await reelName(page, "produce");

  await page
    .getByRole("button", { name: BUTTON_NAMES.lock("produce") })
    .click();
  await expect(
    page.getByRole("button", { name: BUTTON_NAMES.unlock("produce") }),
  ).toHaveAttribute("aria-pressed", "true");

  await respin(page);
  await expect(page.getByTestId(TEST_IDS.respinsLeft)).toHaveText(
    "1 re-spin left",
  );
  expect(await reelName(page, "produce")).toBe(produceBefore);

  await respin(page);
  await expect(page.getByTestId(TEST_IDS.respinsLeft)).toHaveText(
    "0 re-spins left",
  );
  expect(await reelName(page, "produce")).toBe(produceBefore);

  // No re-spins left: only New round remains as an action.
  await expect(
    page.getByRole("button", { name: BUTTON_NAMES.respin }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: BUTTON_NAMES.pull }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: BUTTON_NAMES.newRound }),
  ).toBeVisible();
});

test("new round returns the reels to placeholders", async ({ page }) => {
  await page.goto("/");
  await pull(page);

  await page.getByRole("button", { name: BUTTON_NAMES.newRound }).click();

  for (const reel of REEL_KEYS) {
    await expect(page.getByTestId(TEST_IDS.reelName(reel))).toHaveCount(0);
    await expect(
      page.getByTestId(TEST_IDS.reel(reel)).getByText("?", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.reel(reel))).toHaveAttribute(
      "aria-label",
      REEL_LABELS[reel],
    );
  }
  await expect(page.getByTestId(TEST_IDS.status)).toHaveText("");
  await expect(
    page.getByRole("button", { name: BUTTON_NAMES.pull }),
  ).toBeEnabled();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("pull still lands with reduced motion", async ({ page }) => {
    await page.goto("/");
    await pull(page);
    await expect(page.getByTestId(TEST_IDS.respinsLeft)).toHaveText(
      "2 re-spins left",
    );
  });
});

test.describe("phone viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("pull lands and the page does not scroll horizontally", async ({
    page,
  }) => {
    await page.goto("/");
    await pull(page);

    const fitsWidth = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(fitsWidth).toBe(true);
  });
});
