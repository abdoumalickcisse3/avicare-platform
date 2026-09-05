import { baseApi } from "./baseApi";
import type { AccountSetting } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export const accountSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAccountSettings: build.query<AccountSetting[], void>({
      query: () => "/api/v1/account/settings",
      transformResponse: (r: ApiEnvelope<AccountSetting[]>) => r.data,
      providesTags: ["Setting"],
    }),
    upsertSetting: build.mutation<
      AccountSetting,
      { key: string; value: Record<string, unknown> }
    >({
      query: ({ key, value }) => ({
        url: `/api/v1/account/settings/${key}`,
        method: "PUT",
        body: { value },
      }),
      transformResponse: (r: ApiEnvelope<AccountSetting>) => r.data,
      invalidatesTags: ["Setting"],
    }),
  }),
});

export const {
  useGetAccountSettingsQuery,
  useLazyGetAccountSettingsQuery,
  useUpsertSettingMutation,
} = accountSettingsApi;
