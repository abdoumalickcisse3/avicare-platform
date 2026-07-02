import { baseApi } from "./baseApi";
import type { PermissionCatalog } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPermissionCatalog: build.query<PermissionCatalog, void>({
      query: () => `/api/v1/permissions/catalog`,
      transformResponse: (r: ApiEnvelope<PermissionCatalog>) => r.data,
      providesTags: [{ type: "Permission", id: "CATALOG" }],
    }),
  }),
});

export const { useGetPermissionCatalogQuery } = permissionsApi;
