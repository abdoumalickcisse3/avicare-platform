import { baseApi } from "./baseApi";
import type { AccountSetting } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

/** Key of the user setting that records onboarding completion. */
export const ONBOARDING_SETTING_KEY = "onboarding_completed";

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

/** Whether the onboarding-completed flag is set in a settings list. */
export function isOnboardingCompleted(settings: AccountSetting[]): boolean {
  const setting = settings.find((s) => s.key === ONBOARDING_SETTING_KEY);
  return setting?.value?.completed === true;
}
