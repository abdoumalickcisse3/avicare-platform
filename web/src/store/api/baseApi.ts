import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { tokenStorage } from "@/lib/storage";
import { clearAuthData } from "@/lib/auth";

// API base URL. Dev sets NEXT_PUBLIC_API_URL (e.g. http://localhost:8080).
// In the prod image it's left empty — but Next.js normalizes an empty
// NEXT_PUBLIC_* var to `undefined`, so `??` would wrongly fall back to
// localhost. Use `||` + a NODE_ENV guard: in production, an unset/empty value
// means SAME-ORIGIN (relative "" → the browser calls /api on the current host,
// which Caddy routes to the backend); in dev it keeps the localhost fallback.
const rawBaseQuery = fetchBaseQuery({
  baseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080"),
  prepareHeaders: (headers) => {
    const token = tokenStorage.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/**
 * Wraps the base query: on a 401, try a single refresh against
 * {@code POST /api/v1/auth/refresh} (refresh token from storage) and retry; on
 * failure, purge auth and redirect to /login. The backend wraps payloads in
 * {@code ApiResponse<T>}; endpoints use {@code transformResponse: r => r.data}.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = tokenStorage.getRefresh();
    if (refreshToken) {
      const refresh = await rawBaseQuery(
        {
          url: "/api/v1/auth/refresh",
          method: "POST",
          body: { refreshToken },
        },
        api,
        extraOptions,
      );
      const data = (refresh.data as { data?: { accessToken: string; refreshToken: string } })?.data;
      if (data?.accessToken) {
        tokenStorage.set(data.accessToken, data.refreshToken);
        result = await rawBaseQuery(args, api, extraOptions);
        return result;
      }
    }
    clearAuthData();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Auth",
    "User",
    "Farm",
    "Member",
    "Permission",
    "Subscription",
    "Setting",
    "Catalog",
    "ProductionUnit",
    "UnitEvent",
    "Breed",
    "PoultryBatch",
    "DailyRecord",
    "Weighing",
    "Performance",
    "EggCollection",
    "TrayStock",
    "DailyProduction",
    "LayerConfig",
    "HealthCatalog",
    "Vaccination",
    "Observation",
    "Treatment",
    "Veterinarian",
    "VetVisit",
    "HealthProgram",
    "HealthSchedule",
    "HealthAlert",
    "StockItem",
    "StockMovement",
    "InventoryCatalog",
    "InventoryAlert",
    "Supplier",
    "PurchaseOrder",
    "FeedFormula",
    "Client",
    "Sale",
    "Order",
    "Delivery",
    "Invoice",
    "Payment",
    "Expense",
    "Salary",
    "Advance",
    "Dashboard",
  ],
  endpoints: () => ({}),
});
