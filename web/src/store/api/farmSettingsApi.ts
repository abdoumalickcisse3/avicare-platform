import { baseApi } from "./baseApi";
import type { FarmSetting } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

/**
 * Farm settings — layer 2 of the three-layer parameter model (doc 00 §"paramétrage 3 couches"),
 * plain key/value strings owned by one farm.
 *
 * Only the write lives here. Reads go through the typed endpoints that expose the same values in
 * the shape a screen needs: `tray_size` and `tray_price_xof` are read back as a `TraySettings`
 * record from `/egg-production/config/tray-settings`, which is why saving invalidates that tag
 * and not this slice's own.
 *
 * The backend restricts the write to OWNER/MANAGER by role, not by permission — a member allowed
 * to record a collection is not thereby allowed to change what a tray is worth.
 */
export const farmSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    upsertFarmSetting: build.mutation<
      FarmSetting,
      { farmId: number; key: string; value: string }
    >({
      query: ({ farmId, key, value }) => ({
        url: `/api/v1/farms/${farmId}/settings/${key}`,
        method: "PUT",
        body: { value },
      }),
      transformResponse: (r: ApiEnvelope<FarmSetting>) => r.data,
      invalidatesTags: [
        { type: "Setting", id: "LIST" },
        { type: "LayerConfig", id: "TRAY_SETTINGS" },
      ],
    }),
  }),
});

export const { useUpsertFarmSettingMutation } = farmSettingsApi;
