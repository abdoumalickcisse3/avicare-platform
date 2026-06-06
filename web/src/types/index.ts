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
