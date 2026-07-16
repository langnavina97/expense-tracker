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
const SESSION_SECRET = process.env.SESSION_SECRET!;

// The callback below is hit by a real browser navigation (Google redirects
// here directly), not a frontend fetch call - so every outcome, success or
// failure, has to end in an HTTP redirect back into the frontend rather than
// a JSON response. Defaults to "/" for production, where Express serves the
// built frontend from the same origin as the API.
const FRONTEND_URL = process.env.FRONTEND_URL || "/";

function redirectToFrontend(res: import("express").Response, path: string) {
  res.redirect(`${FRONTEND_URL.replace(/\/$/, "")}${path}`);
}

// The CSRF `state` value used to be a random nonce stashed in the session
// and compared on the callback - but that requires the session cookie to
// survive a full round trip through Google's own redirect chain, which
// browsers are increasingly aggressive about restricting for cross-site
// navigations (even with SameSite=Lax). Signing the state itself instead
// means the callback can verify it without any session/cookie lookup at
// all - it just checks the signature and that it isn't stale.
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes - plenty of time to complete Google's consent screen

function signState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now().toString();
  const payload = `${nonce}.${issuedAt}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

// Returns a reason string when the state fails validation, or null when
// it's valid - the reason exists purely so the callback can log exactly
// where verification failed while this bug is being tracked down.
function invalidStateReason(state: unknown): string | null {
  if (typeof state !== "string") return "not_a_string";

  const [nonce, issuedAt, signature] = state.split(".");
  if (!nonce || !issuedAt || !signature) return "malformed";

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${nonce}.${issuedAt}`)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return "signature_length_mismatch";
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return "signature_mismatch";

  const age = Date.now() - Number(issuedAt);
  if (age < 0) return "issued_in_the_future";
  if (age > STATE_MAX_AGE_MS) return "expired";

  return null;
}

const router = Router();

// Step 1: send the browser to Google's consent screen, with a signed,
// self-verifying state value - see invalidStateReason above for why this isn't
// session-based.
router.get("/google", (req, res) => {
  const state = signState();

  const url = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
  });

  // Temporary diagnostic logging while tracking down the state-mismatch
  // reports - remove once resolved. Logs the state itself (a short-lived,
  // single-use CSRF token, not a secret) so it can be correlated with what
  // the callback receives.
  console.log("[oauth] /google generated state:", state);

  res.redirect(url);
});

// Step 2: Google redirects the browser back here with a one-time code (and
// the same state we sent). Exchange the code for tokens, verify the identity
// token's signature, then find-or-create the User and log them in.
router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;

  const reason = invalidStateReason(state);
  // Temporary diagnostic logging while tracking down the state-mismatch
  // reports - remove once resolved.
  console.log("[oauth] /google/callback received state:", state, "reason:", reason ?? "valid");

  if (reason) {
    return redirectToFrontend(res, "/login?error=oauth_state");
  }

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
