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
  /** Métier focus tokens (broiler/layer), Décision 17. */
  productionFocus: string[];
}

/** Payload for farm create/update (subset of backend fields exposed in V1 UI). */
export interface FarmInput {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
  productionFocus?: string[];
}

/** Tenant-level role inside a farm (mirrors backend FarmRole enum). */
export type FarmRole = "OWNER" | "MANAGER" | "FARMER" | "VETERINARIAN" | "BUYER";

/** Member enrichi (mirrors backend MemberResponse). */
export interface Member {
  id: number;
  userId: number;
  farmId: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: FarmRole;
  permissions: string[];
  active: boolean;
}

export interface PermissionResourceDef {
  resource: string;
  label: string;
  verbs: string[];
}

export interface PermissionCatalog {
  resources: PermissionResourceDef[];
  roleDefaults: Record<string, string[]>;
}

export interface CreateMemberInput {
  fullName: string;
  email: string;
  phone?: string;
  role: FarmRole;
  permissions?: string[];
}

export interface CreateMemberResult {
  member: Member;
  temporaryPassword: string;
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

/** A subscription plan / pré-bundle (mirrors backend PlanResponse). */
export interface Plan {
  key: string;
  label: string;
  priceXof: number | null;
  modules: string[];
  quotas: Record<string, unknown> | null;
  recommended: boolean;
  custom: boolean;
  wave: string;
}

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
  /** Optional D18 stock coupling — draws feed from stock as an OUT movement. */
  feedConsumption?: StockConsumption;
  /** Optional D20-révisée coupling — decomposes a formula into per-ingredient OUT movements. */
  feedFormula?: FeedFormulaRef;
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

/* ------------------------------------------------------------------ */
/* Health module (santé, Sprint B3) — mirrors /health/* endpoints.     */
/* Gated by module.health.basic (vaccinations, observations, programs) */
/* and module.health.advanced (treatments, vets, vet-visits).          */
/* ------------------------------------------------------------------ */

export type ObservationSeverity = "NORMAL" | "WARNING" | "CRITICAL";
export type ScheduleStatus = "DONE" | "LATE" | "UPCOMING";

/** Platform vaccine catalog entry (mirrors backend VaccineDto). */
export interface Vaccine {
  key: string;
  label: string;
  disease: string;
  route: string;
  activeStrain: boolean;
  usage: string;
  wave: string;
  custom: boolean;
}

/** Platform treatment catalog entry (mirrors backend TreatmentDto). */
export interface Treatment {
  key: string;
  label: string;
  molecule: string;
  drugClass: string;
  withdrawalDaysMeat: number | null;
  withdrawalDaysEggs: number | null;
  routes: string[];
  wave: string;
  custom: boolean;
}

/** Platform vaccination program (mirrors backend VaccinationProgramDto). */
export interface VaccinationProgram {
  key: string;
  label: string;
  species: string;
  breedKeys: string[];
  schedule: VaccinationScheduleEntry[];
}

export interface VaccinationScheduleEntry {
  ageValue: number;
  ageUnit: string;
  vaccineKey: string;
  route: string;
  mandatory: boolean;
}

/** A recorded vaccination (mirrors backend VaccinationResponse). */
export interface Vaccination {
  id: number;
  unitId: number;
  vaccineKey: string;
  administeredDate: string;
  route: string | null;
  dosePerSubject: number | null;
  doseUnit: string | null;
  subjectsCount: number;
  vaccineBatchNumber: string | null;
  vaccineExpiryDate: string | null;
  administeredByUserId: number | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface VaccinationInput {
  unitId: number;
  vaccineKey: string;
  administeredDate: string;
  route?: string;
  dosePerSubject?: number;
  doseUnit?: string;
  subjectsCount: number;
  vaccineBatchNumber?: string;
  vaccineExpiryDate?: string;
  administeredByUserId?: number;
  notes?: string;
  /** Optional D18 stock coupling — draws the vaccine from stock as an OUT movement. */
  stockConsumption?: StockConsumption;
}

/** A computed schedule entry status (mirrors backend ScheduleStatusDto). */
export interface VaccinationScheduleStatus {
  vaccineKey: string;
  ageValue: number;
  ageUnit: string;
  dueDate: string;
  status: ScheduleStatus;
  mandatory: boolean;
}

/** Program assignment for a lot (mirrors backend ProgramAssignmentResponse). */
export interface ProgramAssignment {
  unitId: number;
  programKey: string;
  assignedBy: number | null;
  assignedAt: string;
}

/** A health observation (mirrors backend ObservationResponse). */
export interface HealthObservation {
  id: number;
  unitId: number;
  observationDate: string;
  severity: ObservationSeverity;
  title: string;
  description: string | null;
  suspectedDisease: string | null;
  observedByUserId: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface ObservationInput {
  unitId: number;
  observationDate: string;
  severity?: ObservationSeverity;
  title: string;
  description?: string;
  suspectedDisease?: string;
  observedByUserId?: number;
}

/** An executed treatment with computed withdrawal end dates (mirrors backend TreatmentResponse). */
export interface ExecutedTreatment {
  id: number;
  unitId: number;
  treatmentKey: string;
  startDate: string;
  durationDays: number;
  endDate: string;
  doseAmount: number;
  doseUnit: string;
  route: string;
  subjectsCount: number;
  reason: string | null;
  prescribedBy: string | null;
  veterinarianId: number | null;
  withdrawalDaysMeat: number | null;
  withdrawalDaysEggs: number | null;
  withdrawalEndDateMeat: string | null;
  withdrawalEndDateEggs: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface TreatmentInput {
  unitId: number;
  treatmentKey: string;
  startDate: string;
  durationDays: number;
  doseAmount: number;
  doseUnit: string;
  route: string;
  subjectsCount: number;
  reason?: string;
  prescribedBy?: string;
  veterinarianId?: number;
  notes?: string;
  administeredByUserId?: number;
  /** Optional D18 stock coupling — draws the medication from stock as an OUT movement. */
  stockConsumption?: StockConsumption;
}

/** A per-farm veterinarian directory entry (mirrors backend VeterinarianResponse). */
export interface Veterinarian {
  id: number;
  farmId: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  speciality: string | null;
  licenseNumber: string | null;
  location: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface VeterinarianInput {
  fullName: string;
  phone?: string;
  email?: string;
  speciality?: string;
  licenseNumber?: string;
  location?: string;
  notes?: string;
}

/** A vet visit (mirrors backend VetVisitResponse). */
export interface VetVisit {
  id: number;
  unitId: number;
  veterinarianId: number | null;
  visitDate: string;
  reason: string;
  diagnosis: string | null;
  recommendations: string | null;
  costXof: number | null;
  followUpNeeded: boolean;
  followUpDate: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface VetVisitInput {
  unitId: number;
  veterinarianId?: number;
  visitDate: string;
  reason: string;
  diagnosis?: string;
  recommendations?: string;
  costXof?: number;
  followUpNeeded: boolean;
  followUpDate?: string;
  notes?: string;
}

/** Consolidated farm health alerts (mirrors backend AlertsResponse). */
export interface HealthAlerts {
  vaccinationsLate: VaccinationLateItem[];
  activeWithdrawals: ActiveWithdrawalItem[];
  upcomingFollowUps: FollowUpItem[];
  criticalObservations: CriticalObservationItem[];
}

export interface VaccinationLateItem {
  unitId: number;
  unitName: string | null;
  vaccineKey: string;
  dueDate: string;
  daysLate: number;
}

export interface ActiveWithdrawalItem {
  unitId: number;
  treatmentId: number;
  treatmentKey: string;
  withdrawalEndDateMeat: string | null;
  withdrawalEndDateEggs: string | null;
  daysRemainingMeat: number | null;
  daysRemainingEggs: number | null;
}

export interface FollowUpItem {
  unitId: number;
  vetVisitId: number;
  followUpDate: string;
  daysUntil: number;
}

export interface CriticalObservationItem {
  unitId: number;
  observationId: number;
  severity: ObservationSeverity;
  title: string;
  observationDate: string;
}

/* ===================== Inventory (Sprint B4) ===================== */

export type MovementType = "IN" | "OUT" | "ADJUSTMENT";
export type ArticleSource = "INVENTORY" | "TREATMENT" | "PRODUCTION";
export type ProductType = "BROILER" | "EGGS";
export type PurchaseOrderStatus = "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";
export type FeedPhase =
  | "STARTER"
  | "GROWER"
  | "FINISHER"
  | "PRE_LAYER"
  | "LAYER"
  | "BREEDER"
  | "OTHER";
export type MovementReason =
  | "RECEPTION_PURCHASE"
  | "GIFT"
  | "RETURN_SUPPLIER"
  | "CONSUMPTION_LOT"
  | "CONSUMPTION_VACCINATION"
  | "CONSUMPTION_TREATMENT"
  | "LOSS"
  | "SALE"
  | "THEFT"
  | "INVENTORY_PHYSICAL"
  | "ERROR_CORRECTION";

export interface StockItem {
  id: number;
  farmId: number;
  articleKey: string;
  articleSource: ArticleSource;
  currentQuantity: number;
  unit: string | null;
  alertThreshold: number | null;
  typicalUnitPriceXof: number | null;
  lastMovementAt: string | null;
  active: boolean;
  notes: string | null;
}

export interface StockMovement {
  id: number;
  stockItemId: number;
  articleKey: string;
  movementType: MovementType;
  movementDate: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: MovementReason;
  productionUnitId: number | null;
  purchaseOrderId: number | null;
  dailyRecordId: number | null;
  vaccinationId: number | null;
  treatmentExecutedId: number | null;
  unitPriceXof: number | null;
  totalValueXof: number | null;
  notes: string | null;
}

export interface StockMovementInput {
  stockItemId: number;
  movementType: MovementType;
  quantity: number;
  reason: MovementReason;
  movementDate?: string;
  productionUnitId?: number | null;
  unitPriceXof?: number | null;
  notes?: string;
}

export interface InventoryCatalogItem {
  articleKey: string;
  articleSource: ArticleSource;
  label: string;
  subcategory: string | null;
  unit: string | null;
  typicalUnitPriceXof: number | null;
  custom: boolean;
}

export interface StockValuationItem {
  stockItemId: number;
  articleKey: string;
  articleSource: ArticleSource;
  currentQuantity: number;
  unitPriceXof: number | null;
  valueXof: number;
}
export interface StockValuation {
  items: StockValuationItem[];
  totalValueXof: number;
}

export interface Supplier {
  id: number;
  farmId: number;
  commercialName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  types: string[];
  paymentTerms: string | null;
  notes: string | null;
  active: boolean;
}
export interface SupplierInput {
  commercialName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  types?: string[];
  paymentTerms?: string;
  notes?: string;
}

export interface PurchaseOrderLine {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
}
export interface PurchaseOrder {
  id: number;
  farmId: number;
  orderNumber: string;
  supplierId: number;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  totalXof: number | null;
  notes: string | null;
  items: PurchaseOrderLine[];
}
export interface PurchaseOrderDraftLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  orderedQuantity: number;
  unitPriceXof: number;
  notes?: string;
}
export interface PurchaseOrderDraftInput {
  supplierId: number;
  orderDate?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  lines: PurchaseOrderDraftLineInput[];
}
export interface PurchaseOrderReceiveInput {
  actualDeliveryDate?: string;
  lines: { itemId: number; receivedQuantity: number }[];
}

export interface FormulaIngredient {
  articleKey: string;
  articleSource: ArticleSource;
  percentage: number;
}
export interface FeedFormula {
  id: number;
  farmId: number;
  name: string;
  description: string | null;
  sourceFormulaKey: string | null;
  targetBreedKeys: string[];
  targetPhase: FeedPhase;
  targetAgeDaysMin: number | null;
  targetAgeDaysMax: number | null;
  ingredients: FormulaIngredient[];
  totalPercentage: number | null;
  estimatedCostPer100kgXof: number | null;
  estimatedCostCalculatedAt: string | null;
  active: boolean;
  notes: string | null;
}
export interface PlatformFormula {
  key: string;
  label: string;
  targetBreedKeys: string[];
  targetPhase: string;
  targetAgeDaysMin: number | null;
  targetAgeDaysMax: number | null;
  ingredients: FormulaIngredient[];
  estimatedCostPer100kgXof: number | null;
}
export interface AvailableFeedFormulas {
  platformFormulas: PlatformFormula[];
  farmFormulas: FeedFormula[];
}
export interface FeedFormulaInput {
  name: string;
  description?: string;
  targetBreedKeys?: string[];
  targetPhase: FeedPhase;
  targetAgeDaysMin?: number | null;
  targetAgeDaysMax?: number | null;
  ingredients: FormulaIngredient[];
  notes?: string;
}
export interface CloneFormulaInput {
  sourceFormulaKey: string;
  newName?: string;
}

/** Optional D18 stock coupling attached to a daily-record/vaccination/treatment. */
export interface StockConsumption {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  notes?: string;
}

/** Reference to a feed formula at daily entry — exactly one of key (platform) / id (farm). */
export interface FeedFormulaRef {
  formulaKey?: string;
  formulaId?: number;
  totalKg: number;
  notes?: string;
}

export interface LowStockAlertItem {
  stockItemId: number;
  articleKey: string;
  label: string | null;
  currentQuantity: number;
  alertThreshold: number | null;
  unit: string | null;
  percentBelowThreshold: number | null;
}
export interface NegativeStockAlertItem {
  stockItemId: number;
  articleKey: string;
  label: string | null;
  currentQuantity: number;
  unit: string | null;
}
export interface PendingPurchaseOrderAlertItem {
  purchaseOrderId: number;
  orderNumber: string;
  supplierId: number;
  supplierName: string;
  expectedDeliveryDate: string;
  daysOverdue: number;
  totalXof: number | null;
}
export interface RecentMovementAlertItem {
  movementId: number;
  stockItemId: number;
  articleKey: string;
  movementType: MovementType;
  quantity: number;
  quantityAfter: number;
  movementDate: string;
}
export interface InventoryAlerts {
  lowStockItems: LowStockAlertItem[];
  negativeStockItems: NegativeStockAlertItem[];
  pendingPurchaseOrders: PendingPurchaseOrderAlertItem[];
  recentMovements: RecentMovementAlertItem[];
}

// ── Commercial — Clients (Sprint B5-6) ──────────────────────────────────────

/** Kind of commercial client (mirrors backend ClientType). */
export type ClientType = "INDIVIDUAL" | "BUSINESS" | "WHOLESALER";

/** A commercial client in a farm's directory (mirrors backend ClientResponse). */
export interface Client {
  id: number;
  farmId: number;
  clientType: ClientType;
  displayName: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  creditLimitXof: number | null;
  currentBalanceXof: number;
  defaultPaymentTerms: string | null;
  active: boolean;
  notes: string | null;
}

/** Create/update payload (mirrors backend ClientRequest). */
export interface ClientInput {
  clientType: ClientType;
  displayName: string;
  legalName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  creditLimitXof?: number | null;
  defaultPaymentTerms?: string;
  notes?: string;
}

/** Indicative credit standing (mirrors backend ClientCreditInfo, Décision D26). */
export interface ClientCreditInfo {
  clientId: number;
  displayName: string;
  creditLimitXof: number | null;
  currentBalanceXof: number;
  overLimit: boolean;
  overLimitPercent: number | null;
}

// ── Commercial — Sales (Sprint B5-6b) ───────────────────────────────────────

/** Lifecycle of a direct sale (mirrors backend SaleStatus). */
export type SaleStatus = "COMPLETED" | "CANCELLED";

/** How a payment was tendered (mirrors backend PaymentMethod). */
export type PaymentMethod = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";

export interface SaleItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
}

/** A direct (cash) sale (mirrors backend SaleResponse). */
export interface Sale {
  id: number;
  farmId: number;
  saleNumber: string;
  clientId: number | null;
  status: SaleStatus;
  saleDate: string;
  paymentMethod: string | null;
  salesChannelKey: string | null;
  totalXof: number;
  notes: string | null;
  items: SaleItem[];
}

export interface SaleLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  unitPriceXof: number;
  productType?: ProductType;
  productionUnitId?: number;
  notes?: string;
}

/** Create payload (mirrors backend SaleRequest). clientId optional (walk-in). */
export interface SaleInput {
  clientId?: number | null;
  saleDate?: string;
  paymentMethod?: string;
  notes?: string;
  /** Optional distribution channel tag (Sprint sales-channels, D-sales-channels). */
  salesChannelKey?: string;
  lines: SaleLineInput[];
}

// ── Commercial — Orders & Deliveries (Sprint B5-6c) ─────────────────────────

/** Lifecycle of a sales order (mirrors backend OrderStatus, D23). */
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
}

/** A sales order (mirrors backend OrderResponse). */
export interface Order {
  id: number;
  farmId: number;
  orderNumber: string;
  clientId: number | null;
  status: OrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  expectedPaymentMethod: string | null;
  salesChannelKey: string | null;
  expectedPaymentDueDate: string | null;
  totalXof: number;
  notes: string | null;
  items: OrderItem[];
}

export interface OrderLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  unitPriceXof: number;
  productType?: ProductType;
  productionUnitId?: number;
  notes?: string;
}

/** Create payload (mirrors backend OrderDraftRequest). */
export interface OrderInput {
  clientId: number;
  orderDate?: string;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  expectedPaymentMethod?: string;
  expectedPaymentDueDate?: string;
  notes?: string;
  /** Optional distribution channel tag (Sprint sales-channels, D-sales-channels). */
  salesChannelKey?: string;
  lines: OrderLineInput[];
}

/** Lifecycle of a delivery (mirrors backend DeliveryStatus). */
export type DeliveryStatus = "DELIVERED" | "CANCELLED";

export interface DeliveryItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
}

/** A delivery (mirrors backend DeliveryResponse). */
export interface Delivery {
  id: number;
  farmId: number;
  deliveryNumber: string;
  orderId: number | null;
  clientId: number | null;
  status: DeliveryStatus;
  deliveryDate: string;
  carrier: string | null;
  totalXof: number;
  notes: string | null;
  items: DeliveryItem[];
}

/** Convert an order into a delivery (mirrors backend DeliveryFromOrderRequest). */
export interface DeliveryFromOrderInput {
  orderId: number;
  deliveryDate?: string;
  carrier?: string;
  notes?: string;
}

// ── Commercial — Invoices & Payments (Sprint B5-6d) ─────────────────────────

/** Lifecycle of an invoice (mirrors backend InvoiceStatus). */
export type InvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

/** What an invoice was generated from (mirrors backend InvoiceSourceType). */
export type InvoiceSourceType = "SALE" | "DELIVERY";

export interface InvoiceItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
}

/** An invoice (mirrors backend InvoiceResponse). */
export interface Invoice {
  id: number;
  farmId: number;
  invoiceNumber: string;
  clientId: number | null;
  sourceType: InvoiceSourceType;
  saleId: number | null;
  deliveryId: number | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  totalXof: number;
  amountPaidXof: number;
  outstandingXof: number;
  notes: string | null;
  items: InvoiceItem[];
}

/** A payment received against an invoice (mirrors backend PaymentResponse). */
export interface Payment {
  id: number;
  farmId: number;
  paymentNumber: string;
  invoiceId: number;
  clientId: number | null;
  amountXof: number;
  method: PaymentMethod;
  status: "COMPLETED" | "CANCELLED";
  paymentDate: string;
  reference: string | null;
  notes: string | null;
}

export interface PaymentInput {
  invoiceId: number;
  amountXof: number;
  method: PaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

/** A production-unit lifecycle event (mirrors backend LifecycleEventResponse). */
export interface LifecycleEvent {
  id: number;
  productionUnitId: number;
  /** CREATED | MORTALITY | REFORM | COUNT_ADJUSTMENT | SALE | SALE_CANCEL */
  eventType: string;
  quantityDelta: number;
  reason: string | null;
  details: Record<string, unknown>;
  occurredAt: string;
}

/** Record mortality on a production unit (mirrors backend RecordMortalityRequest). */
export interface MortalityInput {
  count: number;
  reason?: string;
}

/** Record a generic lifecycle event (mirrors backend LifecycleEventRequest). */
export interface UnitEventInput {
  eventType: string;
  quantityDelta: number;
  reason?: string;
}

/** Where an expense line came from; only MANUAL rows are editable (mirrors backend ExpenseSource). */
export type ExpenseSource = "MANUAL" | "PURCHASE" | "STOCK_ENTRY" | "SALARY";

/** A finance expense line (mirrors backend ExpenseResponse). */
export interface Expense {
  id: number;
  categoryKey: string;
  amountXof: number;
  expenseDate: string;
  label: string;
  notes: string | null;
  productionUnitId: number | null;
  source: ExpenseSource;
  purchaseOrderId: number | null;
  stockMovementId: number | null;
}

/** Create/update payload for a manual expense (mirrors backend ExpenseRequest). */
export interface ExpenseInput {
  categoryKey: string;
  amountXof: number;
  expenseDate: string;
  label: string;
  notes?: string;
  productionUnitId?: number;
}

/** Expense totals by category over a period (mirrors backend ExpenseSummaryResponse). */
export interface ExpenseSummary {
  categories: { categoryKey: string; amountXof: number }[];
  totalXof: number;
}

/** Compte de résultat ferme (mirrors backend FarmAnalyticsResponse). */
export interface FarmAnalytics {
  totalRevenueXof: number;
  directSalesXof: number;
  paidOrdersXof: number;
  totalExpenseXof: number;
  marginXof: number;
  expensesByCategory: { categoryKey: string; label: string; amountXof: number }[];
  revenueByUnit: { unitId: number; unitName: string; revenueXof: number }[];
}

/* ===================== Salaries & advances (Sprint B6 P2) ===================== */

/** Monthly salary setting for a member (mirrors backend SalarySettingResponse). */
export interface SalarySetting {
  id: number;
  userId: number;
  monthlySalaryXof: number;
  active: boolean;
}

/** Lifecycle of a generated salary line (mirrors backend SalaryStatus). */
export type SalaryStatus = "DUE" | "PAID";

/** A generated monthly salary line (mirrors backend SalaryResponse). */
export interface Salary {
  id: number;
  userId: number;
  period: string;
  grossXof: number;
  advanceDeductedXof: number;
  netXof: number;
  status: SalaryStatus;
  paidAt: string | null;
}

/** Lifecycle of an advance request (mirrors backend AdvanceStatus). */
export type AdvanceStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A salary advance request (mirrors backend AdvanceResponse). */
export interface Advance {
  id: number;
  userId: number;
  amountXof: number;
  reason: string | null;
  status: AdvanceStatus;
  requestedAt: string;
  remainingXof: number;
}

/** Self-service advance request payload (mirrors backend AdvanceRequest). */
export interface AdvanceInput {
  farmId: number;
  amountXof: number;
  reason?: string;
}

/* ===================== Farm overview activity feed (Sprint C reporting) ===================== */

/** One item in a farm's recent-activity feed (mirrors backend ActivityItem). */
export interface ActivityItem {
  kind: string;
  at: string; // ISO LocalDateTime
  label: string;
  detail: string | null;
}

/* ===================== Notifications (Sprint C1) ===================== */

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";
export type NotificationChannelKey = "IN_APP" | "WHATSAPP";
export type NotificationStatus = "ACTIVE" | "RESOLVED";

/** One materialized notification (mirrors backend NotificationResponse). */
export interface AppNotification {
  id: number;
  category: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  sourceRef: Record<string, unknown> | null;
  status: NotificationStatus;
  read: boolean;
  createdAt: string; // ISO LocalDateTime
}

/** Paged notification feed (mirrors backend PageResponse<NotificationResponse>). */
export interface NotificationFeed {
  items: AppNotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** One resolved (category, channel) preference cell (mirrors backend PreferenceResponse). */
export interface NotificationPreference {
  category: string;
  channel: NotificationChannelKey;
  enabled: boolean;
  minSeverity: NotificationSeverity;
}

// --- Partner network (farmer-facing) ---

export type PartnerType = "FEED_SUPPLIER" | "VET";

/** A selectable partner in the directory (mirrors backend AvailablePartnerResponse). */
export interface AvailablePartner {
  id: number;
  name: string;
  type: PartnerType;
  contactName: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
}

/** A farm's membership in a partner network (mirrors backend FarmPartnerResponse). */
export interface FarmPartner {
  membershipId: number;
  partnerId: number;
  partnerName: string | null;
  partnerType: PartnerType | null;
  status: "DECLARED" | "CONFIRMED" | "LEFT";
  origin: "MANUAL_ADMIN" | "INVITE_CODE" | "FARMER_DECLARED";
  shareActivity: boolean;
  shareFlockHealth: boolean;
  shareFeedConsumption: boolean;
  shareSalesVolume: boolean;
  shareFinances: boolean;
}

/** The five farmer-controlled sharing sliders (mirrors backend SharingScopes/UpdateSharingRequest). */
export interface SharingScopes {
  activity: boolean;
  flockHealth: boolean;
  feedConsumption: boolean;
  salesVolume: boolean;
  finances: boolean;
}
