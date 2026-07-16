# Expense Tracker

A household expense tracker: track shared spending across a family or household, split across multiple people, in multiple currencies, with AI-assisted categorization.

Built as a full-stack TypeScript project — Express/PostgreSQL/Prisma API with a React frontend — to practice production backend engineering: auth, relational modeling, testing discipline, and a real deployment.

## Features

- **Email/password and Google OAuth login**, either one, on the same account.
- **Households**: group the people whose expenses you track together. Roles are `LEAD` (can add/manage members), `ADULT` (can add dependents), and `CHILD` (can only edit expenses they created themselves).
- **Dependents**: household members without their own login (e.g. young kids) who can still be attached to an expense.
- **Expenses**: title, category, amount + currency, date, and one or more spenders. Non-USD amounts are converted to USD automatically via a live exchange-rate lookup.
- **AI category suggestions**: given an expense title, Gemini suggests the best-matching existing category (or says none fit, rather than guessing badly).
- **Dashboard**: spending totals, a category filter (multi-select), and pie charts for spending by category and by person.
- **Soft-deleted accounts**: deleting your account anonymizes your data but keeps the row so past expenses still resolve correctly, and frees up your email/Google identity for reuse.

## Tech stack

- **Backend**: Express 5, PostgreSQL, Prisma ORM, session-based auth (`express-session` + `connect-pg-simple`), `argon2` for password hashing, hand-rolled Google OAuth (`google-auth-library` for ID-token verification only), Gemini (`@google/genai`) for category suggestions.
- **Frontend**: React + TypeScript + Vite, React Router, hand-written CSS (no UI framework).
- **Testing**: Vitest + Supertest, against a real Postgres database (not mocks) — 100% statement/branch coverage maintained throughout.
- **Deployment**: Render (single web service, Node) + Neon (serverless Postgres). The frontend is built and served as static files by the same Express app, so it's one deploy, one origin, no CORS.

## Project structure

```
src/                  Express API (routes, middleware, Prisma client)
src/test/             Vitest test suites (real-DB integration tests + forced-failure error tests)
prisma/               Schema and migrations
frontend/             React app (Vite)
```

## Data model

`Household` → has many `User`s (each with a `Role`) and `Dependent`s. Both `User` and `Dependent` have a `Spender` — a shared identity so an `Expense` can be attributed to any mix of account-holders and dependents. Every expense also records `createdByUserId` (who actually entered it), separate from who it's *for*.

## Running locally

Requires Node 20+, PostgreSQL running locally, and a Gemini API key + Google OAuth credentials if you want those features working (the app still runs without them, just with those features unavailable).

```bash
npm install
npm --prefix frontend install
cp .env.example .env        # fill in your own values
cp .env.example .env.test   # point DATABASE_URL at a *separate* test database

npx prisma migrate deploy   # apply migrations to your local DATABASE_URL

npm run dev                 # backend on :3000
npm --prefix frontend run dev   # frontend on :5173, proxies API calls to :3000
```

Visit `http://localhost:5173`.

## Testing

```bash
npm test              # run the suite once
npm run test:coverage # run with a coverage report
```

Tests run against `.env.test`'s database and refuse to run if that URL doesn't look like a test database (a safety check to avoid ever wiping real data).

## Deployment

Both `.env` values below need to exist as environment variables on whatever host runs the backend:

- `DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (must exactly match an Authorized redirect URI in Google Cloud Console, including the path)
- `FRONTEND_URL` — leave unset in production if the frontend is served by this same app (the default, same-origin); only set it if the frontend is hosted separately.

`npm run build` builds the frontend, generates the Prisma client, and compiles the backend, in that order — a single build command is enough for platforms like Render. `npm start` runs the compiled server.
