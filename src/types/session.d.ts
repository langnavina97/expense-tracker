import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    // Random value set right before redirecting to Google, checked again on
    // the callback - prevents CSRF attacks against the OAuth flow.
    oauthState: string;
  }
}
