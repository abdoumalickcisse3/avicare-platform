/** Shared frontend types mirroring the backend identity contracts. */

export type UserRole = "ADMIN" | "USER";

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  locale: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

/** Mirrors backend FarmResponse. */
export interface Farm {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  capacity: number | null;
  timezone: string | null;
  currency: string | null;
  createdBy: number;
  active: boolean;
  createdAt: string;
}

/** Payload for farm create/update (subset of backend fields exposed in V1 UI). */
export interface FarmInput {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
}

/** Tenant-level role inside a farm (mirrors backend FarmRole enum). */
export type FarmRole = "OWNER" | "MANAGER" | "FARMER" | "VETERINARIAN" | "BUYER";

/** Mirrors backend MemberResponse — note: no user name/email/avatar is returned. */
export interface Member {
  id: number;
  userId: number;
  farmId: number;
  role: FarmRole;
  permissions: string[];
  active: boolean;
}

/** Invite payload (mirrors backend AddMemberRequest). */
export interface InviteMemberInput {
  email: string;
  role: FarmRole;
}

/** Subscription lifecycle status (mirrors backend SubscriptionStatus). */
export type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "CANCELLED"
  | "EXPIRED";

/** Feature activation mode (mirrors backend FeatureMode). */
export type FeatureMode = "OFF" | "HARD";

/** A single activated module (mirrors backend ModuleResponse). */
export interface SubscriptionModule {
  moduleKey: string;
  mode: FeatureMode;
  expiresAt: string | null;
}

/** A farm's subscription (mirrors backend SubscriptionResponse). */
export interface Subscription {
  id: number;
  farmId: number;
  status: SubscriptionStatus;
  planKey: string | null;
  expiresAt: string | null;
  modules: SubscriptionModule[];
}

/** Change-request lifecycle status (mirrors backend RequestStatus). */
export type RequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** A subscription change request (mirrors backend ChangeRequestResponse). */
export interface ChangeRequest {
  id: number;
  subscriptionId: number;
  requestedPlan: string | null;
  requestedModules: string[];
  status: RequestStatus;
  requestedBy: number;
  reviewerId: number | null;
  reviewedAt: string | null;
  reason: string | null;
}

/** A user account setting (mirrors backend SettingResponse — value is JSONB). */
export interface AccountSetting {
  key: string;
  value: Record<string, unknown>;
}
