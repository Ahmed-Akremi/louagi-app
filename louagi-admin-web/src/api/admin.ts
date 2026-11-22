// Typed wrappers over the CQRS operations the admin dashboard uses. These mirror
// the mobile app's src/api/{admin,drivers,payments,rides}.js operation names and
// shapes exactly (name + shape parity is the backend contract). Queries return
// their data; commands return an { ok, error, ... } envelope the caller checks.
import { gql, gqlList } from "@/lib/gql";
import type {
  AdminStats,
  AdminAlert,
  AdminUser,
  AdminTimeSeries,
  AdminPaymentsSummary,
  AdminDriverPayout,
  UserDocument,
  AdminDriver,
  AdminRide,
  Payment,
  AuditPage,
  TotpStatus,
  Envelope,
  ImpersonateResult,
  TotpSetupResult,
  AdminSystemHealth,
  AdminEvent,
  AdminSecuritySignals,
  AdminRiskSignals,
  AudienceType,
  SendNotificationResult,
  NotificationCampaign,
} from "@/types/admin";

/* ── Overview ─────────────────────────────────────────────────────────── */
export const adminStats = () => gql<AdminStats>("AdminStats");
export const adminAlerts = () => gqlList<AdminAlert>("AdminAlerts");
export const adminTimeSeries = (days: number) =>
  gql<AdminTimeSeries>("AdminTimeSeries", { days });

/* ── Control center (SIEM) ────────────────────────────────────────────── */
export const adminSystemHealth = () =>
  gql<AdminSystemHealth>("AdminSystemHealth");
export const adminEventStream = (
  args: { limit?: number; since?: string | null; categories?: string[] } = {},
) => gqlList<AdminEvent>("AdminEventStream", args);
export const adminSecuritySignals = () =>
  gql<AdminSecuritySignals>("AdminSecuritySignals");
export const adminRiskSignals = () => gql<AdminRiskSignals>("AdminRiskSignals");

/* ── Users ────────────────────────────────────────────────────────────── */
export const adminSearchUsers = (q: string) =>
  gqlList<AdminUser>("AdminSearchUsers", { q });
export const adminSetUserActive = (userId: string, active: boolean) =>
  gql<Envelope>("AdminSetUserActive", { userId, active });
export const adminImpersonate = (userId: string, mfaCode: string) =>
  gql<ImpersonateResult>("AdminImpersonate", { userId, mfaCode });

/* ── Drivers ──────────────────────────────────────────────────────────── */
export const adminListDrivers = (status: string) =>
  gqlList<AdminDriver>("AdminListDrivers", { status });
export const adminVerifyDriver = (
  driverId: string,
  approve: boolean,
  reason?: string | null,
) => gql<Envelope>("AdminVerifyDriver", { driverId, approve, reason: reason ?? null });
export const adminListUserDocuments = (userId: string) =>
  gqlList<UserDocument>("AdminListUserDocuments", { userId });

/* ── Rides ────────────────────────────────────────────────────────────── */
export const adminListRides = (filters: { status?: string } = {}) =>
  gqlList<AdminRide>("AdminListRides", { filters });
export const cancelRide = (rideId: string, reason: string) =>
  gql<Envelope & { cancelled?: number }>("CancelRide", { rideId, reason });

/* ── Payments ─────────────────────────────────────────────────────────── */
export const listPayments = () => gqlList<Payment>("ListPayments");
export const adminPaymentsSummary = () =>
  gql<AdminPaymentsSummary>("AdminPaymentsSummary");
export const adminDriverPayouts = (limit = 50) =>
  gqlList<AdminDriverPayout>("AdminDriverPayouts", { limit });
export const adminRefund = (paymentId: string, amount: number) =>
  gql<Envelope & { payment?: Payment }>("AdminRefund", { paymentId, amount });
export const adminFlagPayment = (paymentId: string, reason: string) =>
  gql<Envelope & { payment?: Payment }>("AdminFlagPayment", { paymentId, reason });
export const adminUnflagPayment = (paymentId: string, note?: string) =>
  gql<Envelope & { payment?: Payment }>("AdminUnflagPayment", { paymentId, note: note ?? null });

/* ── Audit ────────────────────────────────────────────────────────────── */
export const adminListAudit = (filters: { actionType?: string } = {}) =>
  gql<AuditPage>("AdminListAudit", { filters });
export const adminAuditCount = () => gql<number>("AdminAuditCount");

/* ── Broadcast / push notifications ───────────────────────────────────── */
export const adminSendNotification = (input: {
  audience: AudienceType;
  userId?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) => gql<SendNotificationResult>("AdminSendNotification", input);
export const adminRecipientCount = (audience: AudienceType, userId?: string | null) =>
  gql<{ count: number }>("AdminRecipientCount", { audience, userId: userId ?? null });
export const adminListCampaigns = (limit = 50) =>
  gqlList<NotificationCampaign>("AdminListCampaigns", { limit });

/* ── Profile / TOTP ───────────────────────────────────────────────────── */
export const adminTotpStatus = () => gql<TotpStatus>("AdminTotpStatus");
export const adminSetupTotp = () => gql<TotpSetupResult>("AdminSetupTotp");
export const adminActivateTotp = (code: string) =>
  gql<Envelope>("AdminActivateTotp", { code });
export const adminDisableTotp = (code: string) =>
  gql<Envelope>("AdminDisableTotp", { code });
