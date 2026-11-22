// Operation result shapes. The backend is dynamically typed (JS), so these are
// the client-side contract — kept permissive (optional fields) to avoid runtime
// surprises while still giving the screens useful typing.

export interface Envelope {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string>;
}

export interface AdminStats {
  activeRides: number;
  bookingsToday: number;
  revenueToday: number;
  newUsers: number;
  onlineDrivers: number;
  pendingVerifications: number;
  flaggedPayments: number;
  openAlerts: number;
}

/* ── Control center (SIEM) ────────────────────────────────────────────── */
export interface AdminSystemHealth {
  db: boolean;
  redis: boolean;
  uptimeSec: number;
  version: string;
  avgLatencyMs: number;
  totalQueries: number;
  counts: {
    users: number;
    verifiedDrivers: number;
    onlineDrivers: number;
    activeRides: number;
    driversPending: number;
    openAlerts: number;
  };
}

export type EventSeverity = "info" | "warning" | "danger";
export type EventCategory =
  | "auth"
  | "payment"
  | "admin"
  | "ride"
  | "driver"
  | "delivery"
  | "system";

export interface AdminEvent {
  id: string;
  ts: string;
  severity: EventSeverity;
  category: EventCategory;
  action: string;
  actor: { id: string; role: string } | null;
  target: { type: string; id: string | null } | null;
  ip: string | null;
  meta: Record<string, unknown>;
}

export interface AdminSecuritySignals {
  failedLogins24h: number;
  activeLockouts: number;
  impersonationsToday: number;
  adminActionsToday: number;
  series: { failedLogins: number[] };
}

export interface AdminRiskSignals {
  flaggedCount: number;
  refund7dSum: number;
  refundSpike: boolean;
  topRefundedUsers: Array<{
    userId: string;
    fullName: string;
    refundedSum: number;
  }>;
}

/* ── Broadcast / push notifications ───────────────────────────────────── */
export type AudienceType =
  | "all"
  | "drivers"
  | "passengers"
  | "verified_drivers"
  | "single";

export interface SendNotificationResult extends Envelope {
  recipientCount?: number;
  pushed?: number;
  failed?: number;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  audience: { type?: string; userId?: string | null };
  recipient_count: number;
  pushed_count: number;
  failed_count: number;
  created_at: string;
  sent_by_name?: string | null;
}

export type AlertKind = "flag" | "fail" | "verification" | string;

export interface AdminAlert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  created_at: string;
}

export interface AdminTimeSeries {
  days: number;
  start: string;
  rides: number[];
  bookings: number[];
  revenue: number[];
  newUsers: number[];
}

export interface DriverRecordRef {
  id: string;
  status?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  role: "passenger" | "driver" | "admin" | string;
  is_active: boolean;
  created_at?: string;
  driver?: DriverRecordRef | null;
}

export interface AdminPaymentsSummary {
  succeededCount: number;
  succeededSum: number;
  revenue7d: number;
  failedCount: number;
  flaggedCount: number;
  refundedCount: number;
  refundedSum: number;
  driverFees: number;
  platformFees: number;
}

export interface AdminDriverPayout {
  driver_id: string;
  full_name: string;
  payout_account: string | null;
  payments_count: number;
  driver_fees: number;
  platform_fees: number;
  last_payment_at: string | null;
}

export interface UserDocument {
  id: string;
  user_id?: string;
  kind: string;
  name: string;
  mime?: string;
  size_bytes?: number;
  storage_path?: string;
  uploaded_at: string;
}

export interface AdminDriver {
  id: string;
  user_id: string;
  status: "pending" | "verified" | "rejected" | string;
  plate_number?: string;
  id_card_number?: string;
  license_number?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  seat_count?: number;
  rejection_reason?: string | null;
  verified_at?: string | null;
  rating?: number;
  trips_completed?: number;
  user?: {
    id: string;
    full_name: string;
    email?: string;
    phone_number?: string;
  } | null;
}

export interface RouteRef {
  id?: string;
  origin_city: string;
  destination_city: string;
}

export interface AdminRide {
  id: string;
  status: string;
  departure_time: string;
  price_per_seat: number;
  available_seats: number;
  total_seats: number;
  created_at?: string;
  route?: RouteRef | null;
  driver?: {
    id: string;
    user_id?: string;
    vehicle_brand?: string;
    vehicle_model?: string;
  } | null;
}

export interface Payment {
  id: string;
  amount: number;
  status: string;
  flagged?: boolean;
  flag_reason?: string | null;
  paid_at?: string;
  refunded_at?: string | null;
  refunded_amount?: number;
  refund_type?: "partial" | "full" | null;
  reservation_id?: string | null;
  gateway_reference?: string | null;
  driver_fee?: number;
  platform_fee?: number;
}

export interface AuditEntry {
  id?: string | number;
  created_at: string;
  actor_id?: string;
  actor_role?: string;
  action: string;
  target_entity?: string;
  target_id?: string;
  ip?: string;
  metadata?: Record<string, unknown> | null;
}

export interface AuditPage {
  total: number;
  rows: AuditEntry[];
}

export interface TotpStatus {
  enabled: boolean;
  pending: boolean;
}

export interface ImpersonateResult extends Envelope {
  accessToken?: string;
  target?: { id: string; full_name: string; role: string };
}

export interface TotpSetupResult extends Envelope {
  secret?: string;
  uri?: string;
}
