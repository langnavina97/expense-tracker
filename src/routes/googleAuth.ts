import { Router } from "express";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../prisma.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  throw new Error("Google OAuth environment variables are not set");
}

const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// The callback below is hit by a real browser navigation (Google redirects
// here directly), not a frontend fetch call - so every outcome, success or
// failure, has to end in an HTTP redirect back into the frontend rather than
// a JSON response. Defaults to "/" for production, where Express serves the
// built frontend from the same origin as the API.
const FRONTEND_URL = process.env.FRONTEND_URL || "/";

function redirectToFrontend(res: import("express").Response, path: string) {
  res.redirect(`${FRONTEND_URL.replace(/\/$/, "")}${path}`);
}

const router = Router();

// Step 1: send the browser to Google's consent screen. A random `state`
// value is stashed in the session and checked again on the callback - this
// is what stops an attacker from tricking someone into completing an OAuth
// flow that isn't actually theirs (CSRF against the login flow itself).
router.get("/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const url = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
  });

  // Temporary diagnostic logging for the state-mismatch reports - remove
  // once the cause is confirmed.
  console.log("[oauth] /google", { sessionId: req.sessionID, cookieHeader: Boolean(req.headers.cookie) });

  res.redirect(url);
});

// Step 2: Google redirects the browser back here with a one-time code (and
// the same state we sent). Exchange the code for tokens, verify the identity
// token's signature, then find-or-create the User and log them in.
router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;

  // Temporary diagnostic logging for the state-mismatch reports - remove
  // once the cause is confirmed.
  console.log("[oauth] /google/callback", {
    sessionId: req.sessionID,
    cookieHeader: Boolean(req.headers.cookie),
    hasSessionState: Boolean(req.session.oauthState),
    stateMatches: state === req.session.oauthState,
    userAgent: req.headers["user-agent"],
  });

  if (!state || state !== req.session.oauthState) {
    return redirectToFrontend(res, "/login?error=oauth_state");
  }
  delete req.session.oauthState;

  if (typeof code !== "string") {
    return redirectToFrontend(res, "/login?error=oauth_code");
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      return redirectToFrontend(res, "/login?error=oauth_token");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return redirectToFrontend(res, "/login?error=oauth_email");
    }

    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? payload.email,
          googleId: payload.sub,
          spender: { create: {} },
        },
      });
    } else if (!user.googleId) {
      // Same email as an existing password-based account - link them rather
      // than erroring, since it's genuinely the same person.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub },
      });
    }

    if (user.deletedAt) {
      return redirectToFrontend(res, "/login?error=account_unavailable");
    }

    req.session.userId = user.id;

    redirectToFrontend(res, "/");
  } catch (error) {
    console.error(error);
    redirectToFrontend(res, "/login?error=server_error");
  }
});

export default router;
