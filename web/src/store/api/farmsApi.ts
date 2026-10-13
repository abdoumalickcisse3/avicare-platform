import { baseApi } from "./baseApi";
import type { Farm, FarmInput } from "@/types";

/**
 * Octets → base64, sans `FileReader`.
 *
 * Par morceaux : `String.fromCharCode(...bytes)` d'un seul tenant fait sauter la
 * pile au-delà de quelques dizaines de milliers d'octets, et un logo réduit en
 * pèse facilement cent mille.
 */
function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export const farmsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyFarms: build.query<Farm[], void>({
      query: () => "/api/v1/farms",
      transformResponse: (r: ApiEnvelope<Farm[]>) => r.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((f) => ({ type: "Farm" as const, id: f.id })),
              { type: "Farm" as const, id: "LIST" },
            ]
          : [{ type: "Farm" as const, id: "LIST" }],
    }),
    getFarm: build.query<Farm, number>({
      query: (id) => `/api/v1/farms/${id}`,
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Farm", id }],
    }),
    createFarm: build.mutation<Farm, FarmInput>({
      query: (body) => ({ url: "/api/v1/farms", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: [{ type: "Farm", id: "LIST" }],
    }),
    updateFarm: build.mutation<Farm, { id: number; body: FarmInput }>({
      query: ({ id, body }) => ({
        url: `/api/v1/farms/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Farm", id },
        { type: "Farm", id: "LIST" },
      ],
    }),
    /**
     * Le logo de la ferme, en data URI.
     *
     * L'endpoint est authentifié : un `<img src>` nu partirait sans jeton et
     * récolterait un 401. On récupère donc les octets puis on les encode — ce
     * que la facture réclame de toute façon, react-pdf comme expo-print ayant
     * besoin de l'image embarquée et non d'une adresse à aller chercher.
     *
     * `version` est l'horodatage du logo : il n'entre pas dans l'URL, il entre
     * dans la clé de cache de RTK Query. Remplacer le logo change donc l'entrée
     * de cache sans que rien n'ait à être invalidé à la main.
     */
    getFarmLogo: build.query<string, { id: number; version: string }>({
      query: ({ id }) => ({
        url: `/api/v1/farms/${id}/logo`,
        responseHandler: async (response) => {
          const type = response.headers.get("Content-Type") ?? "image/png";
          return `data:${type};base64,${base64(await response.arrayBuffer())}`;
        },
      }),
      providesTags: (_r, _e, { id }) => [{ type: "Farm", id }],
    }),
    /**
     * Pose ou remplace le logo de la ferme. Multipart : c'est un fichier choisi
     * sur l'appareil, pas une adresse. Le backend le redimensionne et le
     * réencode en PNG — on envoie donc l'original tel quel.
     */
    uploadFarmLogo: build.mutation<Farm, { id: number; file: File }>({
      query: ({ id, file }) => {
        const form = new FormData();
        form.append("file", file);
        return { url: `/api/v1/farms/${id}/logo`, method: "PUT", body: form };
      },
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Farm", id },
        { type: "Farm", id: "LIST" },
      ],
    }),
    deleteFarmLogo: build.mutation<Farm, number>({
      query: (id) => ({ url: `/api/v1/farms/${id}/logo`, method: "DELETE" }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: (_r, _e, id) => [
        { type: "Farm", id },
        { type: "Farm", id: "LIST" },
      ],
    }),
    deleteFarm: build.mutation<void, number>({
      query: (id) => ({ url: `/api/v1/farms/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Farm", id: "LIST" }],
    }),
  }),
});

export const {
  useGetMyFarmsQuery,
  useGetFarmQuery,
  useCreateFarmMutation,
  useUpdateFarmMutation,
  useGetFarmLogoQuery,
  useUploadFarmLogoMutation,
  useDeleteFarmLogoMutation,
  useDeleteFarmMutation,
} = farmsApi;
