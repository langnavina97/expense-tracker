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

  res.redirect(url);
});

// Step 2: Google redirects the browser back here with a one-time code (and
// the same state we sent). Exchange the code for tokens, verify the identity
// token's signature, then find-or-create the User and log them in.
router.get("/google/callback", async (req, res, next) => {
  const { code, state } = req.query;

  if (!state || state !== req.session.oauthState) {
    return res.status(400).json({ error: "Invalid OAuth state." });
  }
  delete req.session.oauthState;

  if (typeof code !== "string") {
    return res.status(400).json({ error: "Missing authorization code." });
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      return res.status(400).json({ error: "Google did not return an identity token." });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: "Google account has no email." });
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
      return res.status(401).json({ error: "Account not available." });
    }

    req.session.userId = user.id;

    // passwordHash is already excluded here - the global Prisma omit applies
    // by default, and we never overrode it for these queries.
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
