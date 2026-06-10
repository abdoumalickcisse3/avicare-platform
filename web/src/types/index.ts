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

/* ------------------------------------------------------------------ */
/* Poultry chair (Sprint B1) — mirrors the backend livestock contracts */
/* ------------------------------------------------------------------ */

export type BatchStatus = "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED";

/** A breed reference (mirrors backend BreedResponse). */
export interface Breed {
  id: number;
  species: string;
  code: string;
  name: string;
  /** broiler | layer for poultry (may be null for typeless breeds). */
  type: string | null;
  farmId: number | null;
  active: boolean;
}

/** A broiler batch (mirrors backend PoultryBatchResponse). */
export interface PoultryBatch {
  id: number;
  farmId: number;
  breedId: number;
  name: string | null;
  startDate: string;
  status: BatchStatus;
  currentCount: number;
  initialCount: number;
  targetWeightG: number | null;
  targetAgeDays: number | null;
}

export interface CreateBatchInput {
  breedId: number;
  name?: string;
  startDate?: string;
  targetWeightG?: number;
  targetAgeDays?: number;
  initialCount: number;
}

/** A daily record (mirrors backend DailyRecordResponse). */
export interface PoultryDailyRecord {
  id: number;
  productionUnitId: number;
  recordDate: string;
  mortalityCount: number;
  feedKg: number;
  waterL: number;
  observations: string | null;
}

export interface DailyRecordInput {
  recordDate: string;
  mortalityCount: number;
  feedKg?: number;
  waterL?: number;
  observations?: string;
}

/** A weighing sample (mirrors backend WeighingSampleResponse). */
export interface WeighingSample {
  id: number;
  poultryBatchId: number;
  sampleDate: string;
  ageDays: number;
  sampleSize: number;
  avgWeightG: number;
  minWeightG: number | null;
  maxWeightG: number | null;
  stdDeviation: number | null;
  uniformityPercent: number | null;
  notes: string | null;
}

export interface WeighingInput {
  sampleDate: string;
  individualWeights: number[];
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Poultry layer (ponte, Sprint B2) — mirrors the egg-production API   */
/* ------------------------------------------------------------------ */

export type UnitStatus = "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED";

/** Create a generic production unit (mirrors backend CreateProductionUnitRequest). */
export interface ProductionUnitInput {
  name?: string;
  breedId: number;
  unitKind?: "BATCH" | "INDIVIDUAL";
  initialCount: number;
  startDate: string;
  notes?: string;
}

/** A generic production unit (mirrors backend ProductionUnitResponse). */
export interface ProductionUnit {
  id: number;
  farmId: number;
  species: string;
  unitKind: string;
  breedId: number | null;
  name: string | null;
  startDate: string;
  endDate: string | null;
  currentCount: number;
  status: UnitStatus;
}

/** An egg collection (mirrors backend EggCollectionResponse). */
export interface EggCollection {
  id: number;
  unitId: number;
  collectionDate: string;
  timeslotKey: string;
  totalEggs: number;
  brokenEggs: number;
  gradesCount: Record<string, number>;
  collectorUserId: number | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EggCollectionInput {
  unitId: number;
  collectionDate: string;
  timeslotKey: string;
  totalEggs: number;
  brokenEggs: number;
  gradesCount?: Record<string, number>;
  collectorUserId?: number;
  notes?: string;
}

/** Farm-scoped tray stock (mirrors backend TrayStockResponse). */
export interface TrayStock {
  farmId: number;
  fullTraysCount: number;
  emptyTraysCount: number;
  updatedAt: string;
}

export interface TrayStockUpdateInput {
  fullTraysCount: number;
  emptyTraysCount: number;
}

export interface TrayStockAdjustInput {
  fullDelta: number;
  emptyDelta: number;
}

/** A closed-day aggregate (mirrors backend DailyProductionResponse). */
export interface DailyProduction {
  unitId: number;
  productionDate: string;
  totalEggsCollected: number;
  totalBrokenEggs: number;
  gradesAggregate: Record<string, number>;
  layingRatePct: number | null;
  breakRatePct: number | null;
  activeLayersCount: number;
  closedAt: string | null;
  closedById: number | null;
}

/** Rolling laying-rate average (mirrors backend RollingRateResponse). */
export interface RollingRate {
  unitId: number;
  days: number;
  avgLayingRatePct: number | null;
}

/** A resolved config entry (mirrors backend LayerConfigEntryResponse). */
export interface LayerConfigEntry {
  key: string;
  value: Record<string, unknown>;
}

/** Tray settings (mirrors backend TraySettingsResponse). */
export interface TraySettings {
  traySize: number;
  trayPriceXof: number;
}

export type PerformanceScore = "AHEAD" | "ON_TARGET" | "BEHIND";

/** A computed performance snapshot (mirrors backend GrowthPerformanceResponse). */
export interface GrowthPerformance {
  poultryBatchId: number;
  snapshotDate: string;
  ageDays: number;
  currentWeightG: number | null;
  gmqGPerDay: number | null;
  feedConversionRatio: number | null;
  cumulativeMortalityPercent: number | null;
  cumulativeFeedKg: number | null;
  cumulativeWaterL: number | null;
  forecastedTargetDate: string | null;
  performanceScore: PerformanceScore | null;
}
