import { baseApi } from "./baseApi";
import type {
  ExecutedTreatment,
  HealthAlerts,
  HealthObservation,
  ObservationInput,
  ObservationSeverity,
  ProgramAssignment,
  Treatment,
  TreatmentInput,
  Vaccination,
  VaccinationInput,
  VaccinationProgram,
  VaccinationScheduleStatus,
  Vaccine,
  Veterinarian,
  VeterinarianInput,
  VetVisit,
  VetVisitInput,
} from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/health`;

/**
 * Health module (Sprint B3) — catalog, vaccinations, observations, vaccination
 * programs, treatments, vet directory, vet visits and consolidated alerts.
 *
 * Gating mirrors the backend split: catalog vaccines/programs, vaccinations,
 * observations and program assignment are {@code module.health.basic};
 * treatments, vet directory and vet visits are {@code module.health.advanced}.
 * The frontend hides advanced sections when inactive but the backend 403 stays
 * the real guarantee (no hard client guard).
 */
export const healthApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* --- Catalog ------------------------------------------------------- */
    getVaccines: build.query<Vaccine[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/vaccines`,
      transformResponse: (r: ApiEnvelope<Vaccine[]>) => r.data,
      providesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    getTreatmentCatalog: build.query<Treatment[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/treatments`,
      transformResponse: (r: ApiEnvelope<Treatment[]>) => r.data,
      providesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),
    getPrograms: build.query<VaccinationProgram[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/programs`,
      transformResponse: (r: ApiEnvelope<VaccinationProgram[]>) => r.data,
      providesTags: [{ type: "HealthCatalog", id: "programs" }],
    }),
    getProgramsByBreed: build.query<
      VaccinationProgram[],
      { farmId: number; breedKey: string }
    >({
      query: ({ farmId, breedKey }) =>
        `${base(farmId)}/catalog/programs/by-breed/${breedKey}`,
      transformResponse: (r: ApiEnvelope<VaccinationProgram[]>) => r.data,
      providesTags: [{ type: "HealthCatalog", id: "programs" }],
    }),
    createVaccine: build.mutation<
      Vaccine,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/vaccines`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Vaccine>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    updateVaccine: build.mutation<
      Vaccine,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/vaccines`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Vaccine>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    deleteVaccine: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `${base(farmId)}/catalog/vaccines/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "HealthCatalog", id: "vaccines" }],
    }),
    createTreatmentCatalog: build.mutation<
      Treatment,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/treatments`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Treatment>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),
    updateTreatmentCatalog: build.mutation<
      Treatment,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `${base(farmId)}/catalog/treatments`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<Treatment>) => r.data,
      invalidatesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),
    deleteTreatmentCatalog: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `${base(farmId)}/catalog/treatments/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "HealthCatalog", id: "treatments" }],
    }),

    /* --- Vaccinations -------------------------------------------------- */
    getVaccinations: build.query<
      Vaccination[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `${base(farmId)}/vaccinations?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<Vaccination[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "Vaccination", id: unitId }],
    }),
    recordVaccination: build.mutation<
      Vaccination,
      { farmId: number; body: VaccinationInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/vaccinations`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Vaccination>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "Vaccination", id: body.unitId },
        { type: "HealthSchedule", id: body.unitId },
        { type: "HealthAlert", id: "farm" },
      ],
    }),
    deleteVaccination: build.mutation<
      void,
      { farmId: number; id: number; unitId: number }
    >({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/vaccinations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "Vaccination", id: unitId },
        { type: "HealthSchedule", id: unitId },
        { type: "HealthAlert", id: "farm" },
      ],
    }),

    /* --- Observations -------------------------------------------------- */
    getObservations: build.query<
      HealthObservation[],
      { farmId: number; unitId: number; severity?: ObservationSeverity }
    >({
      query: ({ farmId, unitId, severity }) => {
        const params = new URLSearchParams({ unitId: String(unitId) });
        if (severity) params.set("severity", severity);
        return `${base(farmId)}/observations?${params.toString()}`;
      },
      transformResponse: (r: ApiEnvelope<HealthObservation[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "Observation", id: unitId }],
    }),
    recordObservation: build.mutation<
      HealthObservation,
      { farmId: number; body: ObservationInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/observations`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<HealthObservation>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "Observation", id: body.unitId },
        { type: "HealthAlert", id: "farm" },
      ],
    }),
    deleteObservation: build.mutation<
      void,
      { farmId: number; id: number; unitId: number }
    >({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/observations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "Observation", id: unitId },
        { type: "HealthAlert", id: "farm" },
      ],
    }),

    /* --- Vaccination program (per lot) --------------------------------- */
    getProgramAssignment: build.query<
      ProgramAssignment | null,
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) => `${base(farmId)}/lots/${unitId}/program`,
      transformResponse: (r: ApiEnvelope<ProgramAssignment | null>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "HealthProgram", id: unitId }],
    }),
    assignProgram: build.mutation<
      ProgramAssignment,
      { farmId: number; unitId: number; programKey: string }
    >({
      query: ({ farmId, unitId, programKey }) => ({
        url: `${base(farmId)}/lots/${unitId}/program`,
        method: "POST",
        body: { programKey },
      }),
      transformResponse: (r: ApiEnvelope<ProgramAssignment>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "HealthProgram", id: unitId },
        { type: "HealthSchedule", id: unitId },
      ],
    }),
    getSchedule: build.query<
      VaccinationScheduleStatus[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `${base(farmId)}/lots/${unitId}/program/schedule`,
      transformResponse: (r: ApiEnvelope<VaccinationScheduleStatus[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "HealthSchedule", id: unitId }],
    }),
    removeProgram: build.mutation<void, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => ({
        url: `${base(farmId)}/lots/${unitId}/program`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "HealthProgram", id: unitId },
        { type: "HealthSchedule", id: unitId },
      ],
    }),

    /* --- Treatments (advanced) ----------------------------------------- */
    getTreatments: build.query<
      ExecutedTreatment[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `${base(farmId)}/treatments?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<ExecutedTreatment[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "Treatment", id: unitId }],
    }),
    getActiveWithdrawals: build.query<
      ExecutedTreatment[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `${base(farmId)}/treatments/active-withdrawals?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<ExecutedTreatment[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [
        { type: "Treatment", id: `withdrawals-${unitId}` },
      ],
    }),
    recordTreatment: build.mutation<
      ExecutedTreatment,
      { farmId: number; body: TreatmentInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/treatments`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<ExecutedTreatment>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "Treatment", id: body.unitId },
        { type: "Treatment", id: `withdrawals-${body.unitId}` },
        { type: "HealthAlert", id: "farm" },
      ],
    }),
    deleteTreatment: build.mutation<
      void,
      { farmId: number; id: number; unitId: number }
    >({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/treatments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "Treatment", id: unitId },
        { type: "Treatment", id: `withdrawals-${unitId}` },
        { type: "HealthAlert", id: "farm" },
      ],
    }),

    /* --- Veterinarians (advanced) -------------------------------------- */
    getVeterinarians: build.query<Veterinarian[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/veterinarians`,
      transformResponse: (r: ApiEnvelope<Veterinarian[]>) => r.data,
      providesTags: [{ type: "Veterinarian", id: "list" }],
    }),
    createVeterinarian: build.mutation<
      Veterinarian,
      { farmId: number; body: VeterinarianInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/veterinarians`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Veterinarian>) => r.data,
      invalidatesTags: [{ type: "Veterinarian", id: "list" }],
    }),
    updateVeterinarian: build.mutation<
      Veterinarian,
      { farmId: number; id: number; body: VeterinarianInput }
    >({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/veterinarians/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Veterinarian>) => r.data,
      invalidatesTags: [{ type: "Veterinarian", id: "list" }],
    }),
    deactivateVeterinarian: build.mutation<
      void,
      { farmId: number; id: number }
    >({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/veterinarians/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Veterinarian", id: "list" }],
    }),

    /* --- Vet visits (advanced) ----------------------------------------- */
    getVetVisits: build.query<VetVisit[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/vet-visits?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<VetVisit[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "VetVisit", id: unitId }],
    }),
    getUpcomingFollowUps: build.query<
      VetVisit[],
      { farmId: number; days?: number }
    >({
      query: ({ farmId, days = 30 }) =>
        `${base(farmId)}/vet-visits/upcoming-follow-ups?days=${days}`,
      transformResponse: (r: ApiEnvelope<VetVisit[]>) => r.data,
      providesTags: [{ type: "VetVisit", id: "follow-ups" }],
    }),
    recordVetVisit: build.mutation<
      VetVisit,
      { farmId: number; body: VetVisitInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/vet-visits`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<VetVisit>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "VetVisit", id: body.unitId },
        { type: "VetVisit", id: "follow-ups" },
        { type: "HealthAlert", id: "farm" },
      ],
    }),

    /* --- Alerts (consolidated, basic) ---------------------------------- */
    getHealthAlerts: build.query<HealthAlerts, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/alerts`,
      transformResponse: (r: ApiEnvelope<HealthAlerts>) => r.data,
      providesTags: [{ type: "HealthAlert", id: "farm" }],
    }),
  }),
});

export const {
  useGetVaccinesQuery,
  useGetTreatmentCatalogQuery,
  useGetProgramsQuery,
  useGetProgramsByBreedQuery,
  useCreateVaccineMutation,
  useUpdateVaccineMutation,
  useDeleteVaccineMutation,
  useCreateTreatmentCatalogMutation,
  useUpdateTreatmentCatalogMutation,
  useDeleteTreatmentCatalogMutation,
  useGetVaccinationsQuery,
  useRecordVaccinationMutation,
  useDeleteVaccinationMutation,
  useGetObservationsQuery,
  useRecordObservationMutation,
  useDeleteObservationMutation,
  useGetProgramAssignmentQuery,
  useAssignProgramMutation,
  useGetScheduleQuery,
  useRemoveProgramMutation,
  useGetTreatmentsQuery,
  useGetActiveWithdrawalsQuery,
  useRecordTreatmentMutation,
  useDeleteTreatmentMutation,
  useGetVeterinariansQuery,
  useCreateVeterinarianMutation,
  useUpdateVeterinarianMutation,
  useDeactivateVeterinarianMutation,
  useGetVetVisitsQuery,
  useGetUpcomingFollowUpsQuery,
  useRecordVetVisitMutation,
  useGetHealthAlertsQuery,
} = healthApi;
