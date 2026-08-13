/** Shared app types ported from the web (`web/src/types`). Kept minimal on
 * mobile — extended as more web features land here. */

/** One item in a farm's recent-activity feed (mirrors backend ActivityItem). */
export interface ActivityItem {
  kind: string;
  at: string; // ISO LocalDateTime
  label: string;
  detail: string | null;
}

/** Farm membership roles (mirrors the web `FarmRole`). */
export type FarmRole = 'OWNER' | 'MANAGER' | 'FARMER' | 'VETERINARIAN' | 'BUYER';

/** A farm team member, enriched (mirrors backend MemberResponse). */
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

/** Broiler batch status (mirrors the web `BatchStatus`). */
export type BatchStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

/** A broiler batch (mirrors the web `PoultryBatch`). */
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

/** A weighing sample point (mirrors the web `WeighingSample`). */
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

/** A recorded vaccination (mirrors the web `Vaccination`). */
export interface Vaccination {
  id: number;
  unitId: number;
  vaccineKey: string;
  administeredDate: string;
  subjectsCount: number;
  route: string | null;
  notes: string | null;
}

export type ObservationSeverity = string;

/** A health observation (mirrors the web `HealthObservation`). */
export interface HealthObservation {
  id: number;
  unitId: number;
  observationDate: string;
  severity: ObservationSeverity;
  title: string;
  description: string | null;
}

/* --- Health alerts / catalog (farm-level Sanitaire overview) ------------- */

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

/** Consolidated farm health alerts (mirrors the web `HealthAlerts`). */
export interface HealthAlerts {
  vaccinationsLate: VaccinationLateItem[];
  activeWithdrawals: ActiveWithdrawalItem[];
  upcomingFollowUps: FollowUpItem[];
  criticalObservations: CriticalObservationItem[];
}

/** A catalog entry (vaccine / treatment / program) — only the count is used on
 * mobile, so the shape is kept minimal. */
export interface HealthCatalogEntry {
  key: string;
}

/** Record a vaccination (mirrors the web `VaccinationInput`, trimmed to the
 * fields the mobile form captures). */
export interface VaccinationInput {
  unitId: number;
  vaccineKey: string;
  administeredDate: string;
  route?: string;
  subjectsCount: number;
  notes?: string;
}

/** Record a health observation (mirrors the web `ObservationInput`). */
export interface ObservationInput {
  unitId: number;
  observationDate: string;
  severity?: ObservationSeverity;
  title: string;
  description?: string;
}

/** A broiler daily record (mirrors the web `PoultryDailyRecord`). */
export interface PoultryDailyRecord {
  id: number;
  productionUnitId: number;
  recordDate: string;
  mortalityCount: number;
  feedKg: number;
  waterL: number;
  observations: string | null;
}

/** Growth performance snapshot (mirrors the web `GrowthPerformance`). */
export type PerformanceScore = 'AHEAD' | 'ON_TARGET' | 'BEHIND';

export interface GrowthPerformance {
  poultryBatchId: number;
  ageDays: number;
  currentWeightG: number | null;
  gmqGPerDay: number | null;
  feedConversionRatio: number | null;
  cumulativeMortalityPercent: number | null;
  cumulativeFeedKg: number | null;
  forecastedTargetDate: string | null;
  performanceScore: PerformanceScore | null;
}

/** Egg tray stock (mirrors the web `TrayStock`). */
export interface TrayStock {
  farmId: number;
  fullTraysCount: number;
  emptyTraysCount: number;
  updatedAt: string;
}

/** An egg collection entry (mirrors the web `EggCollection`). */
export interface EggCollection {
  id: number;
  unitId: number;
  collectionDate: string;
  timeslotKey: string;
  totalEggs: number;
  brokenEggs: number;
  gradesCount?: Record<string, number> | null;
  notes: string | null;
}

/** A closed daily production aggregate (mirrors the web `DailyProduction`). */
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

/** Rolling laying-rate average (mirrors the web `RollingRate`). */
export interface RollingRate {
  unitId: number;
  days: number;
  avgLayingRatePct: number | null;
}

/* --- Inventory / stock (mirrors the web inventory slice) ----------------- */

export type ArticleSource = 'INVENTORY' | 'TREATMENT' | 'PRODUCTION';

/** Lifecycle of a purchase order (mirrors the web `PurchaseOrderStatus`). */
export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';

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

export interface PurchaseOrderLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  orderedQuantity: number;
  unitPriceXof: number;
  notes?: string;
}

export interface PurchaseOrderInput {
  supplierId: number;
  expectedDeliveryDate?: string;
  notes?: string;
  lines: PurchaseOrderLineInput[];
}

export interface PurchaseOrderReceiveInput {
  actualDeliveryDate?: string;
  lines: { itemId: number; receivedQuantity: number }[];
}

/** Direction of a stock movement (mirrors the web `MovementType`). */
export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

/** Why a movement happened (mirrors the web `MovementReason`). */
export type MovementReason =
  | 'RECEPTION_PURCHASE'
  | 'GIFT'
  | 'RETURN_SUPPLIER'
  | 'CONSUMPTION_LOT'
  | 'CONSUMPTION_VACCINATION'
  | 'CONSUMPTION_TREATMENT'
  | 'LOSS'
  | 'SALE'
  | 'THEFT'
  | 'INVENTORY_PHYSICAL'
  | 'ERROR_CORRECTION';

export interface StockMovementInput {
  stockItemId: number;
  movementType: MovementType;
  quantity: number;
  reason: MovementReason;
  movementDate?: string;
  unitPriceXof?: number | null;
  notes?: string;
}

/** A stock item (mirrors the web `StockItem`). */
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

/** Farm-wide stock valuation total (mirrors the web `StockValuation`). */
export interface StockValuation {
  totalValueXof: number;
}

/* --- Feed source coupling (D18 / D20) for the daily entry ---------------- */

/** Draw a single stock article as feed (D18) — becomes an OUT movement. */
export interface StockConsumption {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  notes?: string;
}

/** Draw a feed formula (D20 révisée) — decomposed into per-ingredient OUT movements. */
export interface FeedFormulaRef {
  formulaKey?: string;
  formulaId?: number;
  totalKg: number;
  notes?: string;
}

/** Feed phase a formula targets (mirrors the web `FeedPhase`). */
export type FeedPhase =
  | 'STARTER'
  | 'GROWER'
  | 'FINISHER'
  | 'PRE_LAYER'
  | 'LAYER'
  | 'BREEDER'
  | 'OTHER';

/** One ingredient line of a feed formula (mirrors the web `FormulaIngredient`). */
export interface FormulaIngredient {
  articleKey: string;
  articleSource: ArticleSource;
  percentage: number;
}

/** A platform feed-formula template (clone source; mirrors web `PlatformFormula`). */
export interface PlatformFeedFormula {
  key: string;
  label: string;
  targetBreedKeys: string[];
  targetPhase: string;
  targetAgeDaysMin: number | null;
  targetAgeDaysMax: number | null;
  ingredients: FormulaIngredient[];
  estimatedCostPer100kgXof: number | null;
}

/** A farm's own feed formula (mirrors the web `FeedFormula`). */
export interface FarmFeedFormula {
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
export interface AvailableFeedFormulas {
  platformFormulas: PlatformFeedFormula[];
  farmFormulas: FarmFeedFormula[];
}

/** A stockable article from the inventory catalog (mirrors web `InventoryCatalogItem`). */
export interface InventoryCatalogItem {
  articleKey: string;
  articleSource: ArticleSource;
  label: string;
  subcategory: string | null;
  unit: string | null;
  typicalUnitPriceXof: number | null;
  custom: boolean;
}

/* --- Commercial / clients (mirrors the web commercial slice) ------------- */

export type ClientType = 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALER';

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

/* --- Commercial write: sales, invoices, payments (mirrors the web) -------- */

/** How a payment was tendered (mirrors backend PaymentMethod). */
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER';

/** Sellable production kind (mirrors the web `ProductType`). */
export type ProductType = 'BROILER' | 'EGGS';

/** Lifecycle of a direct sale (mirrors backend SaleStatus). */
export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  unitPriceXof: number;
  productType?: ProductType;
  productionUnitId?: number;
  notes?: string;
}

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

export interface SaleInput {
  clientId?: number | null;
  saleDate?: string;
  paymentMethod?: string;
  salesChannelKey?: string;
  notes?: string;
  lines: SaleLineInput[];
}

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

/* --- Finance (mirrors the web finance module) --------------------------- */

export type ExpenseSource = 'MANUAL' | 'PURCHASE' | 'STOCK_ENTRY' | 'SALARY';

export interface Expense {
  id: number;
  categoryKey: string;
  amountXof: number;
  expenseDate: string;
  label: string;
  notes: string | null;
  productionUnitId: number | null;
  source: ExpenseSource;
}

export interface ExpenseInput {
  categoryKey: string;
  amountXof: number;
  expenseDate: string;
  label: string;
  notes?: string;
  productionUnitId?: number;
}

/** Farm P&L analytics (mirrors the web `FarmAnalytics`). Totals are cumulative. */
export interface FarmAnalytics {
  totalRevenueXof: number;
  directSalesXof: number;
  paidOrdersXof: number;
  totalExpenseXof: number;
  marginXof: number;
  expensesByCategory: { categoryKey: string; label: string; amountXof: number }[];
  revenueByUnit: { unitId: number; unitName: string; revenueXof: number }[];
}

export type SalaryStatus = 'DUE' | 'PAID';

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

/** Lifecycle of a client order (mirrors backend OrderStatus). */
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

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

export interface OrderLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  unitPriceXof: number;
  productType?: ProductType;
  productionUnitId?: number;
  notes?: string;
}

export interface OrderInput {
  clientId: number;
  orderDate?: string;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  expectedPaymentMethod?: string;
  salesChannelKey?: string;
  notes?: string;
  lines: OrderLineInput[];
}

export interface Order {
  id: number;
  farmId: number;
  orderNumber: string;
  clientId: number | null;
  status: OrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  expectedPaymentMethod: string | null;
  totalXof: number;
  notes: string | null;
  items: OrderItem[];
}

/** Lifecycle of an invoice (mirrors backend InvoiceStatus). */
export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface InvoiceItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
}

/** An invoice; `outstandingXof` is the remaining balance to collect. */
export interface Invoice {
  id: number;
  farmId: number;
  invoiceNumber: string;
  clientId: number | null;
  status: InvoiceStatus;
  saleId?: number | null;
  deliveryId?: number | null;
  issueDate: string;
  dueDate: string | null;
  totalXof: number;
  amountPaidXof: number;
  outstandingXof: number;
  items?: InvoiceItem[];
}

/** Lifecycle of a delivery (mirrors backend DeliveryStatus). */
export type DeliveryStatus = 'DELIVERED' | 'CANCELLED';

export interface Delivery {
  id: number;
  farmId: number;
  deliveryNumber: string;
  orderId: number | null;
  clientId: number | null;
  status: DeliveryStatus;
  deliveryDate: string;
  totalXof: number;
}

export interface DeliveryFromOrderInput {
  orderId: number;
  deliveryDate?: string;
  carrier?: string;
  notes?: string;
}

export interface Payment {
  id: number;
  farmId: number;
  paymentNumber: string;
  invoiceId: number;
  clientId: number | null;
  amountXof: number;
  method: PaymentMethod;
  paymentDate: string;
  reference: string | null;
}

export interface PaymentInput {
  invoiceId: number;
  amountXof: number;
  method: PaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}
