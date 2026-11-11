import { expect, test } from "@playwright/test";
import {
  AUTH_LABELS,
  AUTH_TEST_IDS,
  MESSAGES,
  ROUTES,
} from "../src/lib/auth/types";

// These tests run without Supabase env vars (the CI default). Without them the
// actions return MESSAGES.notConnected, and the UI must show that without crashing.

test.describe("sign-in page", () => {
  test("shows the email step", async ({ page }) => {
    await page.goto(ROUTES.signIn);
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId(AUTH_TEST_IDS.emailStep)).toBeVisible();
    await expect(page.getByLabel(AUTH_LABELS.email)).toBeVisible();
    await expect(
      page.getByRole("button", { name: AUTH_LABELS.sendCode }),
    ).toBeVisible();
    await expect(page.getByTestId(AUTH_TEST_IDS.codeStep)).toHaveCount(0);
    await expect(page.getByTestId(AUTH_TEST_IDS.nameStep)).toHaveCount(0);
  });

  test("an invalid email shows the invalid-email message", async ({ page }) => {
    await page.goto(ROUTES.signIn);
    await page.getByLabel(AUTH_LABELS.email).fill("not-an-email");
    await page.getByRole("button", { name: AUTH_LABELS.sendCode }).click();

    const error = page.getByTestId(AUTH_TEST_IDS.error);
    await expect(error).toHaveText(MESSAGES.invalidEmail);
    await expect(error).toHaveAttribute("role", "alert");
    await expect(page.getByTestId(AUTH_TEST_IDS.emailStep)).toBeVisible();
  });

  test("a valid email shows the not-connected message and stays on step 1", async ({
    page,
  }) => {
    await page.goto(ROUTES.signIn);
    await page.getByLabel(AUTH_LABELS.email).fill("cook@example.com");
    await page.getByRole("button", { name: AUTH_LABELS.sendCode }).click();

    await expect(page.getByTestId(AUTH_TEST_IDS.error)).toHaveText(
      MESSAGES.notConnected,
    );
    await expect(page.getByTestId(AUTH_TEST_IDS.emailStep)).toBeVisible();
    await expect(page.getByTestId(AUTH_TEST_IDS.codeStep)).toHaveCount(0);
  });
});

test.describe("account bar", () => {
  test("shows the Sign in link on the home page", async ({ page }) => {
    await page.goto(ROUTES.home);
    const bar = page.getByTestId(AUTH_TEST_IDS.accountBar);
    await expect(
      bar.getByRole("link", { name: AUTH_LABELS.signIn }),
    ).toHaveAttribute("href", ROUTES.signIn, { timeout: 10_000 });
  });
});

test.describe("kitchen page", () => {
  test("without Supabase it shows the not-connected message and no crash", async ({
    page,
  }) => {
    await page.goto(ROUTES.kitchen);
    await expect(
      page.getByRole("heading", { name: "Your kitchen", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId(AUTH_TEST_IDS.kitchenError)).toHaveText(
      MESSAGES.notConnected,
      { timeout: 10_000 },
    );
  });
});
