# Louagi Admin Web

The Louagi platform admin dashboard, extracted from the mobile app into a
standalone **Next.js 16 (App Router) + React 19 + TypeScript 6 + Tailwind CSS 4**
web application. It talks to
the same Louagi **CQRS backend** (`POST /graphql`) the mobile app uses — name +
shape parity is the contract, so no backend code changes are required.

## What it does

Feature parity with the old in-app admin dashboard:

| Screen | What it does |
| --- | --- |
| **Overview** | Live KPIs (active rides, bookings, revenue, new users), alerts, and a revenue/bookings/rides/new-users trend chart (7/14/30 days). Polls every 30s. |
| **Drivers** | Review pending/verified/rejected driver applications; inspect documents + PII; approve/reject (with reason); bulk-approve. |
| **Users** | Search users; suspend/reactivate; impersonate (step-up MFA code). |
| **Rides** | Browse rides by status; admin-override cancel (refunds confirmed passengers). |
| **Payments** | Reconciliation KPIs; refund (full/partial); flag/resolve; driver payouts. |
| **Audit** | Searchable, immutable audit trail. |
| **Profile** | TOTP (2FA) setup/activate/disable; theme + language preferences. |

Internationalised in **English / Français / العربية** (Arabic is RTL), reusing
the exact locale files from the mobile app. Light/dark theme with the Louagi
brand palette (red `#DC2626`, navy `#07214b`).

## Architecture

```
Browser ──(Bearer access token, in memory)──▶  Backend /graphql      (data ops)
   │
   └──(httpOnly refresh cookie)──▶  Next.js BFF /api/auth/*  ──▶  Backend /graphql  (auth only)
```

- **Access token** lives only in browser memory (`src/lib/gql.ts`).
- **Refresh token** lives in a `Secure`, `httpOnly` cookie set by the Next.js
  BFF route handlers (`src/app/api/auth/*`). It is never exposed to JavaScript,
  so it is not readable by XSS.
- On a `401`, the browser calls `POST /api/auth/refresh`; the BFF reads the
  cookie, refreshes against the backend, rotates the cookie, and returns a new
  access token. The request is then retried once.
- Login is the same **phone + password → OTP** flow as the mobile app. The BFF
  rejects any non-admin at verify time (the backend still enforces `admin:*` on
  every operation regardless).

## Prerequisites

- Node.js 22+ (required by i18next 27 / react-i18next 18; Next 16 itself needs 20.9+)
- The Louagi backend running and reachable (default `http://localhost:3000`)

## Setup

```bash
cp .env.example .env.local      # then edit if your backend isn't on :3000
npm install
npm run dev                     # http://localhost:3001
```

### Required backend change (one env var)

The browser makes data calls **directly** to the backend, cross-origin, so the
backend must allow this app's origin. In the **backend's** environment:

```bash
# server/.env  (the Louagi backend)
CORS_ORIGINS=http://localhost:3001        # add your deployed admin URL in prod
```

In production the backend sits behind Cloudflare (`louagi-app/infra/`). The
browser must call the **admin API hostname** (for example
`https://admin-api.louagi.com`), which goes through the API gateway Worker. Once
the backend's `GATEWAY_SECRET` is set, admin tokens sent to the mobile API
hostname are rejected.

That is the only backend change needed — `credentials: true` is already set and
all admin operations + RBAC already work for any HTTP client.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | client | Backend base URL the **browser** calls (`/graphql`). Production: the admin API hostname. |
| `API_URL` | server | Backend base URL the **BFF** calls (defaults to `NEXT_PUBLIC_API_URL`). Production can use the mobile API hostname: the BFF calls (StartLogin, Verify, Resend, Refresh, Logout) carry no admin token, and Vercel's dynamic egress IPs would otherwise need allowlisting. |
| `REFRESH_COOKIE_NAME` | server | Name of the httpOnly refresh cookie. |
| `COOKIE_SECURE` | server | `true` to mark the cookie Secure (auto-on in production). |

## Project structure

```
src/
  app/
    layout.tsx              Root layout + providers + no-flash theme/RTL init
    page.tsx               → redirects to /overview
    login/page.tsx         Phone+password → OTP login
    (dashboard)/
      layout.tsx           Auth guard + sidebar/topbar shell
      overview|drivers|users|rides|payments|audit|profile/page.tsx
    api/auth/*             BFF: login, verify, refresh, logout, resend
  api/admin.ts             Typed CQRS operation wrappers
  lib/                     gql client, server BFF helpers, jwt, rbac, format
  components/ui/           Themed component kit (Button, Card, Table, Modal, …)
  context/                 Auth, Theme, i18n, Query, Toast providers
  i18n/                    i18next setup + en/fr/ar locale JSON
  types/admin.ts           Operation result types
```

- **Styling:** Tailwind CSS 4 is configured in CSS, not a `tailwind.config.ts`.
  Brand colors, radii, shadows and font stacks are the `@theme` block in
  `src/app/globals.css`; the light/dark RGB tokens (`--bg`, `--brand`, …) sit
  below it. Fonts come from `next/font` as `--font-jakarta` / `--font-cairo`
  (`src/app/layout.tsx`).
- **Linting:** ESLint 9 flat config in `eslint.config.mjs`
  (`eslint-config-next` core-web-vitals + typescript). `next lint` no longer
  exists in Next 16; `npm run lint` runs `eslint .`.

## Scripts

```bash
npm run dev         # dev server on :3001
npm run build       # production build
npm run start       # serve the production build on :3001
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
```

## Notes

- **Admin-only.** Non-admins cannot establish a session here.
- **Impersonation** issues the backend's short-lived impersonation token
  (audited); the dashboard surfaces success but does not itself browse as the
  impersonated user.
- This app shares no code with the mobile repo — the API operation names and the
  locale JSON are duplicated here and must be kept in sync by hand if the
  backend contract changes.
