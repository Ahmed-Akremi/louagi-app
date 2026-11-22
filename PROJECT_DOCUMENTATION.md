# Louagi — Detailed Technical Documentation

---

## 1. Project Structure

### 1.1 Top-Level Layout

```
app structure/
├── DESIGN (1).md                    # Brand identity: colors, typography, spacing, shapes
├── PROJECT_DOCUMENTATION.md         # This file — detailed technical documentation
├── package-lock.json
├── louagi-admin-web/                # Admin dashboard (Next.js 16 + Tailwind 4, separate git repo)
└── louagi-app/                      # Main application
    ├── App.js                       # Root component (providers, font loading, splash)
    ├── app.json                     # Expo SDK 58 configuration
    ├── index.js                     # Entry point (registerRootComponent)
    ├── package.json                 # Dependencies (Expo SDK 58, React Native 0.88.1)
    ├── babel.config.js              # Babel preset (babel-preset-expo)
    ├── .env                         # Client env vars (auto-detected API URL, Supabase keys)
    ├── .env.example                 # Environment variable documentation
    ├── README.md                    # Project overview and setup guide
    ├── DOCKER.md                    # Docker Compose usage
    ├── Dockerfile                   # Expo dev server container
    ├── docker-compose.yml           # 3 services: api, app, redis
    ├── src/                         # Client source code
    ├── server/                      # Node.js GraphQL backend
    ├── supabase/                    # Database migrations, seed, config
    ├── docs/                        # Backend contract, security audit
    ├── scripts/                     # Build utilities (assets, theming, RTL fixes)
    ├── infra/                       # Terraform Cloudflare infrastructure + production compose
    ├── testing/                     # Compliance, integration, load tests
    ├── assets/                      # Icons, splash, adaptive-icon
    ├── android/                     # Android native project
    └── .expo/                       # Expo local state
```

---

## 2. Client-Side Architecture (`src/`)

### 2.1 API Layer (`src/api/`)

The API layer is a dispatcher pattern that routes between an in-memory mock backend and the real HTTP GraphQL backend, selected at module-load time via `EXPO_PUBLIC_USE_MOCKS` env var.

**Core files:**

| File | Purpose |
|------|---------|
| `index.js` | Re-exports all API modules as namespaced objects |
| `auth.js` | Dispatcher → `auth.mock.js` or `auth.real.js` |
| `auth.mock.js` | In-memory mock auth: register, login, OTP, biometric, refresh |
| `auth.real.js` | Real backend auth via GraphQL operations |
| `rides.js` | ListRoutes, ListCities, SearchRides, GetRideDetail, CreateRide, UpdateRideStatus, CancelRide, DriverRides, RidePassengers, DriverEarnings, AdminListRides |
| `reservations.js` | CreateReservation (idempotency-protected, seat lock, payment gateway stub), ListReservations, GetReservation, CancelReservation |
| `payments.js` | ListPayments, AdminRefund, AdminFlagPayment |
| `drivers.js` | RegisterDriverApplication, GetDriverStatus, GetDriverProfile, UpdateDriverVehicle, UpdateDriverPayout, AdminListDrivers, AdminVerifyDriver |
| `admin.js` | AdminStats, AdminAlerts, AdminSearchUsers, AdminSetUserActive, AdminImpersonate, AdminListAudit, AdminAuditCount |
| `deliveries.js` | ListAvailableDeliveryRides, ListMyDeliveries, ListRideDeliveries, CreateDelivery, UpdateDeliveryStatus, CancelDelivery |
| `messages.js` | ListChats, GetMessages, SendMessage (E2E encrypted in mock) |
| `reviews.js` | SubmitReview, GetReviewForRide |
| `users.js` | GetProfile, UpdateProfile, UpdateNotificationPrefs, UpdateTravelPrefs, UpdatePaymentMethod, CreateSupportTicket, RequestDataExport, DeleteAccount |
| `graphql.js` | Generic GraphQL client: `gql()` and `gqlList()` with 15s timeout, 401 auto-refresh with retry, concurrent refresh coalescing |
| `http.js` | Legacy REST HTTP client with same refresh/retry pattern |
| `mockDb.js` | In-memory data store with helper finders |

### 2.2 GraphQL Client (`src/api/graphql.js`)

The `gql(operationName, variables)` function:
- Sends `POST /graphql` with `{ operationName, variables, query }`
- Injects `Authorization: Bearer <token>` from `tokenStore`
- 15-second timeout via `AbortController`
- On 401: triggers `refreshOnce()` (coalesces concurrent 401s into a single refresh), retries once
- Returns `payload.data[operationName]` on success, `{ ok: false, error }` on failure

The `gqlList()` wrapper casts results to an array (returns `[]` on null).

### 2.3 Navigation (`src/navigation/`)

**RootNavigator.js** — `@react-navigation/native-stack` with role-based routing:

```
RootNavigator
├── !user → PublicStack
│   ├── Landing, Login, Register, DriverRegister
│   ├── PendingApproval, Search, RideDetail, Settings
│   └── (unauthenticated — Search/RideDetail accessible pre-auth)
├── user.role === 'passenger' → PassengerStack
│   ├── Tabs → PassengerTabs (bottom tabs)
│   │   ├── Home (LandingScreen)
│   │   ├── Search (SearchScreen)
│   │   ├── Delivery (DeliveryScreen)
│   │   ├── Bookings (DashboardScreen)
│   │   └── Profile (ProfileScreen)
│   ├── RideDetail, BookingConfirm, ChatList, Chat
│   └── Settings, Support
├── user.role === 'driver' → DriverStack
│   ├── (pending) → DriverRegister, PendingApproval, Settings
│   └── (verified) → DriverTabs
│       ├── Dashboard (DashboardScreen)
│       ├── Rides (RidesListScreen)
│       └── Profile (ProfileScreen)
│   ├── CreateRide, RideManagement, DriverDelivery
│   └── RideDetail, ChatList, Chat, Settings, Support
└── user.role === 'admin' → AdminStack
    ├── Tabs → AdminTabs
    │   ├── Overview, Drivers, Users
    │   ├── Rides, Payments, Audit
    └── Settings, Support
```

**FloatingTabBar.js** — Custom floating bottom tab bar:
- Rounded pill-shaped container (matches brand rounded geometry)
- Active tab: larger icon (52px), inactive: smaller (40px)
- Width adapts: 72% for ≤4 tabs, 84% for 5, 94% for 6
- Positioned above safe area bottom inset
- Route icons mapped from MaterialIcons

### 2.4 Context Providers (`src/context/`)

**AuthContext.js** (`useAuth()`):
- Provides `{ user, accessToken, refreshToken, ready, isAuthed, applySession, signOut, setUser }`
- On boot: loads tokens from `expo-secure-store`, verifies access token, refreshes if expired
- Subscribes to `tokenStore` for reactive updates from the API layer
- Soft-refresh timer: auto-refreshes access token 60s before expiry

**ThemeContext.js** (`useTheme()`):
- Provides `{ mode, setMode, colors, isDark, ready }`
- Modes: 'light', 'dark', 'system' (follows OS)
- Persists choice via `expo-secure-store`
- Writes active palette into `src/theme/colors.js` via Proxy for legacy imports

**LocaleContext.js** (`useLocale()`):
- Provides `{ locale, setLocale, t, isRTL, ready }`
- Locales: 'en', 'fr', 'ar' (mirrors device default on first launch)
- Arabic triggers full RTL layout flip with `I18nManager.forceRTL()`
- Wraps `i18next` with `useTranslation` hook

**NotificationContext.js** (`usePush()`):
- Provides `{ expoPushToken, unreadCount, notification }`
- Handles push notification permissions, token registration, foreground handling
- Uses `navigationRef` to navigate on notification tap

### 2.5 Screens (`src/screens/`)

**Public (unauthenticated):**
- `LandingScreen.js` (399 lines): Hero with logo, city search widget (auto-suggest with Unicode-normalized ranking), popular routes grid, auth CTA buttons
- `LoginScreen.js`: Phone + password login flow with OTP verification step
- `RegisterScreen.js`: Registration form with field validation and OTP verification
- `DriverRegisterScreen.js`: Driver-specific registration with vehicle details, document upload
- `PendingApprovalScreen.js`: Post-driver-registration waiting state

**Passenger:**
- `SearchScreen.js` (224 lines): Route search with origin/destination autocomplete, date picker, seat stepper, filter/sort options, RideCard list
- `RideDetailScreen.js`: Full ride details, driver info, seat selection, booking CTA
- `BookingConfirmScreen.js`: Post-booking confirmation with receipt
- `DashboardScreen.js` (400 lines): Tabbed view (Upcoming, Past, Payments, Deliveries) with pull-to-refresh, countdown timers, rate-driver modal
- `ProfileScreen.js`: User profile management, preferences, settings links
- `DeliveryScreen.js` (99 lines): Package delivery — list available rides, select severity tier, book

**Driver:**
- `DashboardScreen.js`: Earnings analytics (chart, summary cards, top route, cancellation rate), quick actions
- `RidesListScreen.js`: Filterable list of driver's rides
- `CreateRideScreen.js`: New ride form (route, time, seats, price)
- `RideManagementScreen.js`: Ride detail with passenger manifest, delivery management, status transitions
- `ProfileScreen.js`: Driver profile with vehicle info, payout account, ratings
- `DriverDeliveryScreen.js`: Deliveries on driver's rides with status management

**Admin:**
- `OverviewScreen.js`: Key metrics (active rides, bookings today, revenue, new users, alerts)
- `DriversScreen.js`: Driver list with verification approval/rejection
- `UsersScreen.js`: User search, suspend/reactivate
- `RidesScreen.js`: All rides with filters
- `PaymentsScreen.js`: Payment list with refund/flag actions
- `AuditScreen.js`: Immutable audit log viewer with filters

**Common:**
- `SettingsScreen.js`: Language, theme, version, account actions
- `SupportScreen.js`: Support ticket creation
- `ChatListScreen.js`: Inbox with message threads
- `ChatScreen.js`: Real-time chat with E2E encryption display

### 2.6 Components (`src/components/`) — 25 Reusable Components

| Component | Purpose |
|-----------|---------|
| `Avatar.js` | User avatar circle with initials fallback |
| `Badge.js` | Status/count badge pill |
| `Banner.js` | Informational banner with dismiss |
| `Button.js` | Themed button (primary/secondary/outline/text variants) |
| `Card.js` | Container card with elevation shadow |
| `EmptyState.js` | Empty list placeholder with icon + message |
| `ErrorBoundary.js` | React error boundary with stack trace display |
| `FloatingTabBar.js` | Custom floating bottom navigation bar |
| `Header.js` | Screen header with back button, title, optional actions |
| `HeaderQuickToggles.js` | Quick-access toggles (settings, notifications) |
| `Input.js` | Themed text input with validation styling |
| `Logo.js` | SVG-based Louagi brand logo (112px splash, 48px inline) |
| `LogoMorph.js` | Animated logo transition |
| `PasswordStrength.js` | Visual password strength indicator |
| `RateDriverModal.js` | Post-ride driver rating modal (1-5 stars) |
| `RideCard.js` | Ride listing card (route, time, driver, price, seats) |
| `RoutePair.js` | Origin → destination display (RTL-aware arrow flip) |
| `RouteTimeline.js` | Vertical timeline of route stops |
| `Screen.js` | Safe-area-aware screen container with optional scroll |
| `Section.js` | Section/Row/Stack layout primitives |
| `StepIndicator.js` | Multi-step progress indicator |
| `Stepper.js` | Number increment/decrement control |
| `Tabs.js` | Horizontal tab bar |
| `Text.js` | Themed text component with typography presets |
| `Toast.js` | Toast notification system (ToastProvider + useToast) |

### 2.7 Security Modules (`src/security/`)

| Module | File | Purpose |
|--------|------|---------|
| JWT | `jwt.js` | Lightweight HS256 JWT sign/verify. 15-min access tokens, 14-day refresh tokens. Client-side verification for cache validation; server-issued tokens (iss='louagi-server') skip client HMAC check |
| Token Store | `tokenStore.js` | In-memory token cache with subscribe/notify pattern for cross-module reactivity |
| Secure Storage | `secureStorage.js` | `expo-secure-store` wrapper with get/set/clear |
| Crypto | `crypto.js` | SHA-256 (via expo-crypto), random bytes/digits, salted iterative password hashing (1024 rounds), field-level XOR encryption for PII, phone/ID masking |
| OTP | `otp.js` | 6-digit OTP generation, verification, expiration, rate limiting (5 attempts) |
| Rate Limit | `rateLimit.js` | Per-key sliding window rate limiter (configurable max/window) |
| RBAC | `rbac.js` | Role-permission matrix: rides:search/book/create/manage, admin:read/verify-driver/suspend-user/refund/impersonate, driver:earnings, profile:self |
| Seat Lock | `seatLock.js` | Map-based atomic seat locks with 10-min TTL, acquire/release/peek |
| Audit | `audit.js` | Immutable in-memory audit log: append-only with list/totalCount queries |
| Biometric | `biometric.js` | `expo-local-authentication` wrapper for Face ID / fingerprint |
| Encryption | `encryption.js` | XOR-based message encryption for in-app chat (client-side mock) |

### 2.8 Internationalisation (`src/i18n/`)

- **Framework**: `i18next` + `react-i18next`
- **Locales**: `en.json`, `fr.json`, `ar.json`
- **Namespaces**: `common`, `auth`, `landing`, `search`, `ride`, `booking`, `passenger`, `driver`, `admin`, `settings`, `errors`, `toast`
- **Date/Time Formatting**: `format.js` wraps `Intl.DateTimeFormat` with locale-aware formatting
- **RTL Support**: Arabic locale triggers `I18nManager.forceRTL(true)` with app reload via `DevSettings.reload()`

### 2.9 Validation (`src/validation/schemas.js`)

| Validator | Rule |
|-----------|------|
| `validateTunisianPhone` | `+216` + 8 digits or bare 8 digits |
| `normalizeTunisianPhone` | Normalises to `+216XXXXXXXX` |
| `validatePassword` | Min 8 chars, 1 uppercase, 1 digit |
| `passwordStrength` | Score 0-5 with label |
| `validateEmail` | Standard email regex |
| `validateName` | 2-60 characters |
| `validateOtp` | Exactly 6 digits |
| `validatePlate` | 4-12 alphanumeric characters |
| `validateSeatCount` | 1-8 integer |
| `sanitize` | Strip HTML tags (loop until clean) + control characters, max 500 chars |
| `validateFileSize` | Max MB check |

### 2.10 Theme (`src/theme/`)

| File | Exports |
|------|---------|
| `colors.js` | `colorsLight`: full palette from DESIGN.md (surface, primary #031634, secondary #feae2c, etc.), `withAlpha()`, `setActivePalette()`, `getActivePalette()` |
| `colors-dark.js` | `colorsDark`: dark mode equivalents |
| `typography.js` | `typography`: font families (PlusJakartaSans + Cairo), presets (display-lg, headline-md, headline-sm, body-lg, body-md, label-md, label-sm) |
| `spacing.js` | `spacing` (4px unit: xs 4, sm 8, md 16, lg 24, xl 32), `radius` (sm 4, DEFAULT 8, md 12, lg 16, xl 24, full 9999), `shadows` (level1/2 with navy-tinted diffuse shadows), `floatingTabBar` |

---

## 3. Server-Side Architecture (`server/`)

### 3.1 Overview

The Node.js backend is an Express 4.21 server that implements a custom GraphQL endpoint (no Apollo — lightweight custom resolver dispatch). It connects to Supabase Postgres via `postgres-js` (SSL required) and optionally caches sessions in Redis.

### 3.2 Server Config (`server/src/config.js`)

Reads from `server/.env`:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | Environment mode |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional `sb_secret_…` key — not read by the current code |
| `SUPABASE_JWT_SECRET` | Legacy fallback for `APP_JWT_SECRET` |
| `APP_JWT_SECRET` | App-level JWT signing secret |
| `DATABASE_URL` | Session-pooler URI (port 5432, not the 6543 transaction pooler) for the least-privilege `louagi_backend` role |
| `PII_ENCRYPTION_KEY` | 32-byte key (64 hex) for AES-256-GCM field encryption + HMAC blind indexes. **Back it up** — losing it makes encrypted data unrecoverable |
| `DEV_OTP_CODE` | Development OTP override |
| `ADMIN_IMPERSONATION_CODE` | MFA code for admin impersonation |
| `CORS_ORIGINS` | Allowed origins. Production: the admin dashboard origin plus the app's web-export origin |
| `GATEWAY_SECRET` | Shared with the admin API gateway Worker (`gateway_secret` in `infra/terraform.tfvars`). When set, admin tokens are honored only on requests the gateway stamped. Empty in local dev |
| `REDIS_URL` | Redis connection string (the production compose stack overrides it with `redis://redis:6379`) |
| `REDIS_SESSION_TTL` | Session TTL (default 900s) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (default 15 min) |
| `RATE_LIMIT_MAX` | Overall requests per client IP per window, all routes except `/health` (default 600) |
| `GRAPHQL_RATE_LIMIT_MAX` | `/graphql` requests per client IP per window (default 120) |

### 3.3 Database Connection (`server/src/db.js`)

- Uses `postgres-js` (tagged template literals — SQL injection safe)
- SSL required
- Connection pool: max 10, idle timeout 20s
- Refuses to start in production with privileged database users (`postgres`, `supabase_admin`, etc.)

### 3.4 Auth System (`server/src/auth/tokens.js`)

- `signAccessToken()`: 15-min TTL, HS256, `typ: 'JWT'`
- `signRefreshToken()`: 14-day TTL, `typ: 'JWT-R'`, stored in `refresh_tokens` table
- `signBiometricTicket()`: 30-day TTL, `typ: 'JWT-B'`
- `verifyToken()`: Verifies HS256 signature, issuer, expiry
- `rotateRefreshToken()`: Atomic transaction — verifies existing token, issues new pair, marks old as revoked
- `revokeRefreshToken()`: Revokes a refresh token

### 3.5 GraphQL Resolvers (`server/src/graphql/resolvers.js` — 2308 lines)

~40 resolvers organised by domain:

**Auth (8):**
- `StartLogin`: Phone + password → OTP issuance (rate-limited, 5 attempts/15min)
- `VerifyOtp`: OTP verification → JWT pair (supports login/register/reset purposes)
- `Register`: Create user → OTP issuance (validates all fields, checks uniqueness)
- `ResendOtp`: Issue fresh OTP
- `Refresh`: Token rotation (atomic DB transaction)
- `Logout`: Revoke refresh token
- `EnrollBiometric`: Generate 30-day biometric ticket
- `BiometricLogin`: Verify biometric ticket → JWT pair

**Routes (2):**
- `ListRoutes`: Returns all routes from DB
- `ListCities`: Returns distinct origin + destination cities

**Rides (8):**
- `SearchRides`: Filter by origin, destination, date, seats, price max, rating min, departure time; sort by departure/price/rating
- `GetRideDetail`: Single ride including route and driver info
- `CreateRide`: Driver creates scheduled ride (validates verified status, departure ≥30min, seat count, price range)
- `UpdateRideStatus`: Status transitions (scheduled → in_progress → completed)
- `CancelRide`: Cancel ride + auto-refund all reservations
- `DriverRides`: List driver's rides with optional status filter
- `RidePassengers`: Passenger manifest for a ride
- `DriverEarnings`: Analytics (weekly/monthly buckets, occupancy, top routes, cancellation rate)

**Admin (7):**
- `AdminListRides`: All rides with filters
- `AdminStats`: Dashboard metrics (active rides, bookings today, revenue, new users)
- `AdminAlerts`: Payment flags, pending driver verifications
- `AdminSearchUsers`: Search by name/email/phone
- `AdminSetUserActive`: Suspend/reactivate (prevents suspending last admin)
- `AdminImpersonate`: MFA-verified impersonation token
- `AdminListAudit` / `AdminAuditCount`: Audit log queries

**Reservations (4):**
- `CreateReservation`: Seat lock → payment gateway → confirm/rollback (idempotency key protected)
- `ListReservations`: User's reservations with status filter
- `GetReservation`: Single reservation detail
- `CancelReservation`: ≥2h cancellation policy, auto-refund (minus reservation fees)

**Payments (3):**
- `ListPayments`: User's or all (admin) payments
- `AdminRefund`: Full or partial refund with audit
- `AdminFlagPayment`: Flag suspicious payments

**Drivers (7):**
- `RegisterDriverApplication`: Submit application with documents, vehicle details (validates plate uniqueness)
- `GetDriverStatus`: Check verification status
- `GetDriverProfile`: Full driver profile
- `UpdateDriverVehicle`: Update vehicle details
- `UpdateDriverPayout`: Set payout account
- `AdminListDrivers`: All drivers with status filter
- `AdminVerifyDriver`: Approve/reject driver application

**Users (4):**
- `GetProfile`: User profile (phone_masked, preferences, notifications)
- `UpdateProfile`: Update name, email, password (validates current password)
- `UpdateNotificationPrefs`: SMS/push/marketing toggles
- `DeleteAccount`: Soft-delete with password confirmation

**Delivery (6):**
- `AvailableDeliveryRides`: Rides accepting deliveries
- `MyDeliveries`: User's delivery history
- `RideDeliveries`: Driver's deliveries for a ride
- `CreateDelivery`: New delivery booking
- `UpdateDeliveryStatus`: Status transitions (pending → confirmed → picked_up → delivered)
- `CancelDelivery`: Cancel delivery

**Chat (3):**
- `ListChats`: User's conversations with last message
- `GetMessages`: Message thread with read receipts
- `SendMessage`: Send message (validates non-empty)

**Reviews (2):**
- `SubmitReview`: Rate completed ride (validates ride completed, not already reviewed, user had confirmed reservation)
- `GetReviewForRide`: Get user's review for a ride

### 3.6 Middleware (`server/src/middleware/`)

- `auth.js`: `actorFromRequest()` — extracts Bearer token, verifies JWT, loads user profile/role from DB with Redis caching. `requireAuth()` — 401 if unauthenticated. `requireRole(...roles)` — 403 if wrong role
- `error.js`: `notFound()` — 404 for unknown routes. `errorHandler()` — global error handler with `publicMessage` support
- `rateLimit.js`: `rate-limiter-flexible` (Redis-backed, with an in-memory fallback). It has two independent per-client-IP limiters, both skipping `/health`: `apiRateLimit` on every route (`RATE_LIMIT_MAX`, 600 per `RATE_LIMIT_WINDOW_MS`) and `graphqlRateLimit` on `/graphql` (`GRAPHQL_RATE_LIMIT_MAX`, 120). A `/graphql` request spends one point from each, so the effective `/graphql` limit is 120 per 15 min per IP

### 3.7 Cache (`server/src/cache/redis.js`)

- ioredis client with retry strategy (max 10 retries, exponential backoff)
- Honours `USE_REDIS=false` to disable
- Session cache with prefix `session:{userId}`, configurable TTL
- `getSession()`, `setSession()`, `delSession()` — JSON serialised actor data

### 3.8 Validation (`server/src/utils/validation.js`)

Identical validators to client-side but use `sanitize-html` instead of regex-based sanitisation. Server version uses the `sanitize-html` npm package with strict config (no tags allowed, discard mode).

---

## 4. Database Schema (`supabase/migrations/`)

### 4.1 Migration Files

| Migration | Purpose |
|-----------|---------|
| `20260609000000_init.sql` | Consolidated, destructive-by-design init (fresh DBs only): enums, all core tables (users, drivers, driver_sessions, admins, routes, rides, reservations, payments, reviews, notifications, documents, delivery, messages, seat_locks, audit_log, refresh_tokens, user_sessions), `updated_at` + audit-immutability triggers, indexes, views, RPCs (`create_reservation`, `cancel_reservation`, `cancel_ride`, `delete_message`, `book_delivery`, `cleanup_expired_seat_locks`), RLS policies, Realtime publication |
| `20260610000000_user_preferences_and_support.sql` | `users.preferences`, `users.payment_account`, `support_tickets` table + RLS |
| `20260611000000_government_pricing.sql` | Government flat fare per route; fee split platform 1.000 / driver 2.000 TND |
| `20260612120000_admin_totp.sql` | Per-admin TOTP secret (encrypted) + enabled flag |
| `20260617000000_driver_locations.sql` | Latest GPS fix per driver + RLS |
| `20260617010000_seeded_reference_data.sql` | `routes.is_popular`, `app_config`, `achievements` |
| `20260618000000_loyalty_tier_discount.sql` | `tiers` catalogue, `reservations.discount_pct`, tier-aware `create_reservation` |
| `20260626000000_push_notifications.sql` | `push_tokens`, notification `data`/`category`/`sent_by`, `notification_campaigns` |
| `20261122000000_encrypt_pii_blind_index.sql` | `users.phone_hash`/`email_hash` blind indexes (unique), `user_sessions.ip_address` → text (holds ciphertext), Data API hardening: revoke RPC `EXECUTE` from `anon`/`authenticated`, `security_invoker` views, RLS on the five later tables |

The live project is `yhlsvmutepagghyfdjzw` (org "Louagi", eu-west-1). Its remote migration history uses the same versions as these filenames, so `supabase db push` only applies new files. Link the CLI first: `supabase link --project-ref yhlsvmutepagghyfdjzw`.

### 4.2 Key Tables

Columns marked *(enc)* are AES-256-GCM ciphertext (`enc:v1:…`) at rest — see §6.3.

**users** — Backend-owned profiles (no `auth.users` link):
- `id` (UUID PK), `full_name` *(enc)*, `phone_number` *(enc)*, `email` *(enc)*, `phone_hash` / `email_hash` (HMAC-SHA256 blind indexes, unique — used for login, duplicate and reset lookups), `role` (enum: passenger/driver/admin), `is_active`, `password_hash` (bcrypt), `payment_account` *(enc, JSONB string)*, `admin_totp_secret` *(enc)*, `notifications`/`preferences` (JSONB), `created_at`, `updated_at`

**drivers** — Driver verification and vehicle records:
- `id` (UUID PK), `user_id` (FK unique), `plate_number` (unique, plaintext — SQL uniqueness check, street-visible), `id_card_number` *(enc)*, `license_number` *(enc)*, `payout_account` *(enc)*, `rejection_reason` *(enc)*, `vehicle_brand`, `vehicle_model`, `seat_count` (1-8), `status` (pending/verified/rejected), `rating` (0-5), `trips_completed`, expiry dates

**routes** — City-to-city routes:
- `id` (UUID PK), `origin_city`, `destination_city` (unique pair), `distance_km`, `estimated_duration_min`, `base_price`

**rides** — Scheduled trips:
- `id` (UUID PK), `driver_id` (FK), `route_id` (FK), `departure_time`, `total_seats`, `available_seats`, `price_per_seat`, `status` (scheduled/in_progress/completed/cancelled), `created_at`, `accepts_delivery`, `max_delivery_slots`, `delivery_slots_taken`

**reservations** — Passenger bookings:
- `id` (UUID PK), `user_id` (FK), `ride_id` (FK), `seats_booked`, `total_price`, `status` (pending/confirmed/cancelled), `idempotency_key` (unique per user), `booked_at`, `cancelled_at`

**payments** — Payment records:
- `id` (UUID PK), `reservation_id` (FK), `delivery_id` (FK, mutually exclusive), `method`, `amount`, `platform_fee`, `driver_fee`, `status` (succeeded/failed/refunded/flagged), `gateway_reference`, `refunded_amount`, `refund_type`, `flagged_reason`, timestamps

**delivery** — Package delivery records:
- `id` (UUID PK), `user_id` (FK), `ride_id` (FK), `severity_tier` (1-3), `severity_label`, `item_description` *(enc)*, `driver_notes` *(enc)*, `price` (7/9/12 TND), `status` (pending/confirmed/picked_up/delivered/cancelled), timestamps

**audit_log** — Immutable append-only audit:
- `id` (UUID PK), `actor_id`, `actor_role`, `action`, `target_entity`, `target_id`, `metadata` *(enc, JSONB string)*, `ip_address` *(enc)*, `created_at`. Blocked from UPDATE/DELETE via triggers, so only rows written by the current code are encrypted; older rows keep what they were written with

**messages** — In-app chat:
- `id` (UUID PK), `sender_id` (FK), `receiver_id` (FK), `content` *(enc)*, `is_read`, `created_at`. Realtime-enabled

Also encrypted: `support_tickets.message`, `reviews.comment`, `notifications.title`/`body`, `notification_campaigns.title`/`body`, `user_sessions.device_info`/`ip_address`, `driver_sessions.device_name`/`ip_address`.

---

## 5. Data Flow

### 5.1 Booking Flow

1. **Search**: Passenger searches rides → `SearchRides` query → filtered by origin/destination/date/seats
2. **Select**: Tap ride → `GetRideDetail` query → driver info, route, pricing
3. **Book**: `CreateReservation` mutation with idempotencyKey
   - Server validates ride exists, status is 'scheduled', seats available
   - Acquires atomic seat lock (10-min TTL)
   - Creates pending reservation
   - Calls simulated payment gateway (~5% failure rate)
   - On success: confirms reservation, decrements available_seats, records payment with fee split, queues driver notification, writes audit, releases seat lock
   - On failure: cancels reservation, releases lock, no charge
4. **Confirm**: `{ ok: true, reservation, payment }` → BookingConfirmScreen with receipt
5. **Cancel**: `CancelReservation` validates ≥2h before departure (admin bypass), refunds seat cost minus reservation fees, releases seats, audit

### 5.2 Authentication Flow

1. **Login**: `startLogin(phone, password)` → validates credentials, generates OTP → returns `{ ok: true, userId, devOtp }`
2. **Verify**: `completeLogin(userId, otp)` → verifies OTP → returns `{ accessToken, refreshToken, user }`
3. **Persist**: Tokens stored in `expo-secure-store`, in-memory `tokenStore`, React state
4. **Refresh**: Access token expires in 15min → auto-refresh 60s before expiry via timer; on 401 response the API layer attempts a single refresh with rotation
5. **Biometric**: Optional enrollment generates a 30-day biometric ticket; on login, biometric ticket is exchanged for a fresh access/refresh pair and a rotated ticket

### 5.3 Fee Structure

- Reservation fee: **3 TND** total
  - Platform fee: 1.5 TND (app revenue)
  - Driver fee: 1.5 TND (driver earnings)
- Non-refundable on cancellation (only seat cost refunded)
- Displayed in PriceSummary component before confirmation

### 5.4 Delivery Flow

1. Passenger browses `AvailableDeliveryRides` (rides that `accepts_delivery = true`)
2. Selects severity tier (Standard 7 TND / Sensitive 9 TND / Critical 12 TND)
3. `CreateDelivery` mutation → price validated server-side via Edge Function
4. `book_delivery` RPC atomically inserts delivery + increments `delivery_slots_taken`
5. Driver sees delivery in RideManagementScreen, updates status: pending → confirmed → picked_up → delivered
6. Sender receives push/SMS notifications on status changes

---

## 6. Security Architecture

### 6.1 Authentication
- **JWT**: Custom HS256 signing with 15-min access tokens, 14-day refresh tokens
- **Refresh Rotation**: Every refresh invalidates the previous token (DB-backed)
- **OTP**: 6-digit codes with 5-attempt rate limit, configurable expiry
- **Biometric**: Optional Face ID / fingerprint with 30-day rotating tickets
- **Password Storage**: bcrypt in Postgres (`extensions.crypt(password, gen_salt('bf'))`), verified in SQL; OTPs and password-reset tokens are stored only as SHA-256 hashes (Redis / in-memory), refresh tokens are signed JWTs tracked by `jti`. The client `src/security/crypto.js` SHA-256 scheme is used by the offline mock only

### 6.2 Authorization (RBAC)
- **Client-side**: Permission matrix in `src/security/rbac.js`
- **Server-side**: Role verification in middleware + resolver-level `assertCan()` checks
- **Database**: Row-Level Security policies on every table (Supabase RLS)

### 6.3 Data Protection
- **Field-level encryption** (`server/src/lib/fieldCrypto.js`): every personal or user-authored value is AES-256-GCM encrypted by the backend before it is written (`encryptField` for text, `encryptJson` for JSONB) and stored as `enc:v1:<base64(iv|tag|ciphertext)>`. Decryption is central: `server/src/db.js` installs a postgres-js `transform.value.from` hook, so query code always sees plaintext and ciphertext never reaches clients
  - **Lookups**: ciphertext is randomised, so phone/email login, duplicate checks and reset use `phone_hash`/`email_hash` — HMAC-SHA256 over the trimmed, lower-cased value with a subkey derived from the encryption key. Admin user search filters decrypted rows in memory (fine to ~50k users)
  - **Key**: `PII_ENCRYPTION_KEY` in `server/.env` only. Losing it loses the data; rotating it requires re-encrypting. Without a key (local dev) values are stored plaintext and hashes are unkeyed
  - **Backfill**: `node server/scripts/encrypt-pii.js` encrypts existing rows and fills the blind indexes. It is idempotent; run it after every seed/reset (the seed inserts plaintext with no hashes, so nobody can log in until it runs). It skips `audit_log`, whose rows are immutable
  - **Not encrypted (needed by SQL)**: ids, foreign keys, enums, timestamps, prices, seat counts, ratings, routes/cities, `plate_number`, driver GPS coordinates, `push_tokens.token`, `notifications.data`
  - **New write paths** must wrap values in `encryptField`/`encryptJson`. Bind JSONB as raw values: postgres-js already JSON-serializes `::jsonb` parameters, so `JSON.stringify` first double-encodes
- **Database access**: the backend connects as `louagi_backend` (login, `BYPASSRLS`, member of `service_role`, not a table owner, no DDL). Migrations run as `postgres` via the Supabase CLI/MCP
- **Data API hardening**: the `anon`/`authenticated` keys cannot execute the `SECURITY DEFINER` RPCs, all views use `security_invoker`, and every public table has RLS (server-only tables have no policies)
- **Input sanitisation**: HTML stripping (loop until clean), control character removal, max length enforcement
- **SQL injection prevention**: `postgres-js` tagged template literals

### 6.4 Audit Trail
- Every security-sensitive operation writes to the immutable `audit_log`
- **Client-side**: In-memory `audit.js` module (append-only)
- **Server-side**: `audit_log` DB table with triggers blocking UPDATE/DELETE
- Audited actions: login success/failure, registration, profile changes, booking confirmations/cancellations, payment refunds/flags, driver verification, admin impersonation, account deletion

### 6.5 Rate Limiting
- **Login**: 5 attempts per 15 minutes per phone (client + server)
- **Edge**: 50 `/graphql` requests per 10 s per IP and Cloudflare data center (Cloudflare rate-limit rule, `infra/modules/ngfw`)
- **API / GraphQL (Express)**: 600 requests per 15 min per client IP overall and 120 per 15 min on `/graphql`, as separate budgets (`RATE_LIMIT_MAX`, `GRAPHQL_RATE_LIMIT_MAX`)
- **OTP**: 5 verification attempts per code

### 6.6 Seat Locking
- 10-minute TTL atomic locks prevent double-booking during checkout
- Released on successful booking or payment failure
- Expired locks automatically cleaned up

### 6.7 Admin Controls
- **IP Allowlist**: Simulated in `src/security/rbac.js`; in production a WAF rule on the admin API hostname (`admin_allowed_ips`, see §7)
- **Gateway-only admin tokens**: With `GATEWAY_SECRET` set, the API ignores admin tokens on requests not stamped by the admin API gateway Worker, so they only work on the admin API hostname. That only narrows replay of a leaked token once `admin_allowed_ips` locks that hostname to admin IPs; with an empty list it is as open as the mobile hostname
- **Impersonation**: Step-up MFA code required, scoped tokens marked with `impersonatedBy` claim, audit-logged

---

## 7. Infrastructure (`infra/`)

Cloudflare in front, origin on any Docker host. There is no CDN: API responses are never cached.

```
mobile app      ─► NGFW (WAF + rate limit) ─► Cloudflare edge ──────────────────────► Tunnel ─► Express API
admin dashboard ─► NGFW (WAF + rate limit) ─► Cloudflare edge ─► API gateway Worker ─► Tunnel ─► Express API
```

Cloudflare runs the WAF phases before Workers, so this order is the real request pipeline.

| Module / file | Purpose |
|--------|---------|
| `modules/ngfw/` | The NGFW layer, built from WAF phases (Cloudflare's network-level Magic Firewall needs Enterprise Magic Transit/WAN). Custom rules allow only `POST`/`OPTIONS /graphql` and `GET`/`HEAD /health` on the API hostnames, plus an optional admin IP allowlist (`admin_allowed_ips`). A per-IP rate limit on `/graphql` (50 req / 10 s). The Cloudflare Managed Ruleset (`managed_waf`, Pro plan or higher) |
| `modules/edge/` | Cloudflare Tunnel (outbound-only, so the origin has no public IP or open port). Proxied DNS for the mobile API hostname and the admin API hostname. A cache-bypass rule. Always-HTTPS and a TLS 1.2 minimum |
| `modules/api_gateway/` | Worker on the admin API hostname. Passes only `POST`/`OPTIONS /graphql` and stamps `x-louagi-gateway` with `GATEWAY_SECRET`; the API honors admin tokens only with that stamp. Test: `node --test infra/modules/api_gateway/worker.test.mjs` |
| `docker-compose.yml` | Production origin: `api` (server image), `redis` (compose network only) and `cloudflared`. No published ports |

Deploy: export `CLOUDFLARE_API_TOKEN`, copy `terraform.tfvars.example` to `terraform.tfvars`, then run `terraform apply`, then `TUNNEL_TOKEN=$(terraform output -raw tunnel_token) docker compose up -d --build` in `infra/`. Point the app's `EXPO_PUBLIC_API_URL` at the API hostname and the admin dashboard's `NEXT_PUBLIC_API_URL` at the admin API hostname. The dashboard's server-side `API_URL` can stay on the mobile API hostname: its BFF calls (StartLogin, Verify, Resend, Refresh, Logout) carry no admin bearer token, and Vercel's dynamic egress IPs can't be allowlisted. Set the server's `CORS_ORIGINS` to the dashboard origin plus the app's web-export origin, comma-separated. Each ruleset owns its whole phase for the zone, so import existing dashboard rules first.

---

## 8. Testing (`testing/`)

| Suite | File | What it Tests |
|-------|------|---------------|
| Compliance | `compliance.js` | Scans src/ for hardcoded colors (should use theme), scans server/ for raw SQL concatenation |
| Integration | `integration.js` | 11 tests: passenger registration, OTP verification, driver application, ride creation, route search, profile fetch, messaging (send/read/reply) |
| Load | `load-test.js` | 1000 concurrent ListCities queries (concurrency 50), fails if error rate > 10% |
| Orchestrator | `run-all-tests.js` | Starts server if needed, runs compliance → integration → load, cleans up |

---

## 9. Docker Setup

Three services defined in `docker-compose.yml`:

- **api**: Express backend (port 3000) with health check, hot-reload via volume mount
- **app**: Expo dev server (ports 8081, 19000-19006) with file polling for Docker compatibility
- **redis**: Redis 7 with password (`louagi-dev`), port 6379

---

## 10. Demo Accounts (from `supabase/seed.sql`)

| Role | Phone | Password |
|------|-------|----------|
| Passenger | +21698765432 | Passenger1 |
| Driver | +21622334455 | Driver1234 |
| Admin | +21655000000 | AdminLou2026 |

Dev OTP: `123456` (hardcoded in backend until SMTP/SMS is wired)

After loading or reloading the seed, run `node server/scripts/encrypt-pii.js`. Until it runs, the seeded accounts cannot log in because their blind indexes are empty.

---

## 11. Design System Summary

From `DESIGN (1).md`:

- **Brand**: Modern Fintech × Warm North African personality
- **Primary**: Deep Navy `#031634` — stability, institutional trust
- **Secondary**: Amber Gold `#feae2c` — Mediterranean sun, primary actions
- **Surface**: Light Gray `#fbf8fc` — clean, spacious
- **Typography**: Plus Jakarta Sans (Latin) + Cairo (Arabic) via Google Fonts
- **Geometry**: Rounded cards (16px), pill buttons (9999px), navy-tinted diffuse shadows
- **Elevation**: 3 levels (floor 0, cards level 1, floating level 2)
- **Spacing**: 4px unit base, 8px grid increments
- **Shapes**: `sm 4px`, `DEFAULT 8px`, `md 12px`, `lg 16px`, `xl 24px`, `full 9999px`
