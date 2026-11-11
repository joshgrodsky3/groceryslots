/**
 * Shared contract for sign-in and kitchens. Server actions, UI and tests all
 * import from here so they can be built in parallel.
 */

/** Email one-time-code limits. Supabase sends 6 to 10 digits depending on project settings. */
export const CODE_MIN_LENGTH = 6;
export const CODE_MAX_LENGTH = 10;
export const DISPLAY_NAME_MAX = 30;
export const KITCHEN_NAME_MAX = 40;
export const INVITE_CODE_MAX = 32;

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  kitchen: "/kitchen",
} as const;

/** Every action returns one of these and never throws. */
export type ActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** verifyCode: signed in. needsName is true until the user has saved a display name once. */
export type VerifyData = { needsName: boolean; suggestedName: string };

export type KitchenMember = {
  userId: string;
  displayName: string;
};

export type Kitchen = {
  id: string;
  name: string;
  inviteCode: string;
  role: "owner" | "member";
  members: KitchenMember[];
};

export type KitchenList = { kitchens: Kitchen[] };

/** data-testid values the UI must expose (used by e2e tests). */
export const AUTH_TEST_IDS = {
  emailStep: "signin-email-step",
  codeStep: "signin-code-step",
  nameStep: "signin-name-step",
  error: "auth-error", // role="alert" error text on the sign-in form
  accountBar: "account-bar",
  kitchenList: "kitchen-list",
  kitchenCard: "kitchen-card",
  inviteCode: "invite-code",
  kitchenError: "kitchen-error", // role="alert"
} as const;

/** Accessible names (labels and buttons) the UI must expose. */
export const AUTH_LABELS = {
  email: "Email",
  code: "Code",
  displayName: "Your name",
  sendCode: "Send code",
  verify: "Sign in",
  useDifferentEmail: "Use a different email",
  saveName: "Continue",
  signIn: "Sign in", // link in the account bar
  signOut: "Sign out",
  kitchenLink: "Kitchen",
  kitchenName: "Kitchen name",
  createKitchen: "Create kitchen",
  inviteCode: "Invite code",
  joinKitchen: "Join kitchen",
  copyInvite: "Copy invite code",
} as const;

/** Friendly messages shared by actions and tests. */
export const MESSAGES = {
  notConnected: "Sign-in isn't connected yet.",
  invalidEmail: "Enter a valid email address.",
  invalidCode: "Enter the code from your email.",
  badCode: "That code didn't work. Check it or request a new one.",
  invalidName: "Enter a name up to 30 characters.",
  notSignedIn: "Sign in first.",
  invalidKitchenName: "Enter a kitchen name up to 40 characters.",
  invalidInvite: "Enter a valid invite code.",
  badInvite: "That invite code didn't match a kitchen.",
  generic: "Something went wrong. Try again.",
} as const;
