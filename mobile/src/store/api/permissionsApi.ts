/**
 * The assignable permission vocabulary — ported from `web/src/store/api/permissionsApi.ts`.
 *
 * Read-only and identical for every farm, so it is fetched once and cached under a single tag.
 * The screens drive their UI from `resources[].verbs` rather than a hardcoded verb list: the
 * catalog already carries a verb the web forgot (`inventory:consume`, a FARMER default), and a
 * fixed list makes such a permission invisible and therefore unrevocable.
 */
import { baseApi } from './baseApi';
import type { PermissionCatalog } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPermissionCatalog: build.query<PermissionCatalog, void>({
      query: () => '/api/v1/permissions/catalog',
      transformResponse: (r: ApiEnvelope<PermissionCatalog>) => r.data,
      providesTags: [{ type: 'Permission', id: 'CATALOG' }],
    }),
  }),
});

export const { useGetPermissionCatalogQuery } = permissionsApi;
