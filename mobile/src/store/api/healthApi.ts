/**
 * Health (sanitaire) — ported from `web/src/store/api/healthApi.ts`, same backend.
 *
 * The module splits in two, and the split is enforced server-side:
 * `module.health.basic` covers vaccinations, observations, the vaccine catalog and program
 * assignment; `module.health.advanced` adds treatments, the vet directory and vet visits. The
 * screens hide what a farm cannot use, but the backend 403 remains the real guarantee.
 *
 * Permissions are not uniform either: recording a vaccination or an observation needs the
 * grantable `health:write`, while every delete needs OWNER or MANAGER — and deleting a
 * treatment needs OWNER, because a treatment record is traceability.
 */
import { baseApi } from './baseApi';
import type {
  ExecutedTreatment,
  HealthAlerts,
  HealthCatalogEntry,
  HealthObservation,
  ObservationInput,
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
} from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/health`;

export const healthApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVaccinations: build.query<Vaccination[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/vaccinations?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<Vaccination[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'Vaccination', id: unitId }],
    }),
    getObservations: build.query<HealthObservation[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/observations?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<HealthObservation[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'Observation', id: unitId }],
    }),

    /* --- Record events (basic module) --------------------------------- */
    recordVaccination: build.mutation<Vaccination, { farmId: number; body: VaccinationInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/vaccinations`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Vaccination>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: 'Vaccination', id: body.unitId },
        { type: 'HealthAlert', id: 'farm' },
      ],
    }),
    recordObservation: build.mutation<HealthObservation, { farmId: number; body: ObservationInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/observations`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<HealthObservation>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: 'Observation', id: body.unitId },
        { type: 'HealthAlert', id: 'farm' },
      ],
    }),

    /* --- Farm-level overview (Suivi sanitaire) ------------------------- */
    getHealthAlerts: build.query<HealthAlerts, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/alerts`,
      transformResponse: (r: ApiEnvelope<HealthAlerts>) => r.data,
      providesTags: [{ type: 'HealthAlert', id: 'farm' }],
    }),
    getVaccines: build.query<HealthCatalogEntry[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/vaccines`,
      transformResponse: (r: ApiEnvelope<HealthCatalogEntry[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'vaccines' }],
    }),
    getPrograms: build.query<HealthCatalogEntry[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/programs`,
      transformResponse: (r: ApiEnvelope<HealthCatalogEntry[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'programs' }],
    }),
    getTreatmentCatalog: build.query<HealthCatalogEntry[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/treatments`,
      transformResponse: (r: ApiEnvelope<HealthCatalogEntry[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'treatments' }],
    }),

    /* --- Catalog, fully typed (lot 2) --------------------------------- */
    // The three reads above answer `HealthCatalogEntry[]`, which carries only the key: enough
    // to count entries, not enough to show a disease or a withdrawal delay. These return what
    // the backend actually sends.
    getVaccineCatalog: build.query<Vaccine[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/vaccines`,
      transformResponse: (r: ApiEnvelope<Vaccine[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'vaccines' }],
    }),
    getTreatmentLibrary: build.query<Treatment[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/treatments`,
      transformResponse: (r: ApiEnvelope<Treatment[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'treatments' }],
    }),
    getProgramCatalog: build.query<VaccinationProgram[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/catalog/programs`,
      transformResponse: (r: ApiEnvelope<VaccinationProgram[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'programs' }],
    }),
    getProgramsByBreed: build.query<VaccinationProgram[], { farmId: number; breedKey: string }>({
      query: ({ farmId, breedKey }) => `${base(farmId)}/catalog/programs/by-breed/${breedKey}`,
      transformResponse: (r: ApiEnvelope<VaccinationProgram[]>) => r.data,
      providesTags: [{ type: 'HealthCatalog', id: 'programs' }],
    }),

    /* --- Vaccination program assigned to a lot ------------------------ */
    getProgramAssignment: build.query<
      ProgramAssignment | null,
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) => `${base(farmId)}/lots/${unitId}/program`,
      transformResponse: (r: ApiEnvelope<ProgramAssignment | null>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'HealthProgram', id: unitId }],
    }),
    assignProgram: build.mutation<
      ProgramAssignment,
      { farmId: number; unitId: number; programKey: string }
    >({
      query: ({ farmId, unitId, programKey }) => ({
        url: `${base(farmId)}/lots/${unitId}/program`,
        method: 'POST',
        body: { programKey },
      }),
      transformResponse: (r: ApiEnvelope<ProgramAssignment>) => r.data,
      // One program per lot: assigning replaces, so the schedule is stale either way.
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'HealthProgram', id: unitId },
        { type: 'HealthSchedule', id: unitId },
      ],
    }),
    removeProgram: build.mutation<void, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => ({
        url: `${base(farmId)}/lots/${unitId}/program`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'HealthProgram', id: unitId },
        { type: 'HealthSchedule', id: unitId },
      ],
    }),
    getSchedule: build.query<VaccinationScheduleStatus[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/lots/${unitId}/program/schedule`,
      transformResponse: (r: ApiEnvelope<VaccinationScheduleStatus[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'HealthSchedule', id: unitId }],
    }),

    /* --- Deletes (OWNER / MANAGER) ------------------------------------ */
    deleteVaccination: build.mutation<void, { farmId: number; id: number; unitId: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/vaccinations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'Vaccination', id: unitId },
        // The schedule reads the recorded vaccinations to mark a step DONE, so removing one
        // can send a step back to LATE.
        { type: 'HealthSchedule', id: unitId },
        { type: 'HealthAlert', id: 'farm' },
      ],
    }),
    deleteObservation: build.mutation<void, { farmId: number; id: number; unitId: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/observations/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'Observation', id: unitId },
        { type: 'HealthAlert', id: 'farm' },
      ],
    }),

    /* --- Treatments (advanced module) --------------------------------- */
    getTreatments: build.query<ExecutedTreatment[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/treatments?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<ExecutedTreatment[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'Treatment', id: unitId }],
    }),
    getActiveWithdrawals: build.query<ExecutedTreatment[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) =>
        `${base(farmId)}/treatments/active-withdrawals?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<ExecutedTreatment[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'Treatment', id: `withdrawals-${unitId}` }],
    }),
    recordTreatment: build.mutation<ExecutedTreatment, { farmId: number; body: TreatmentInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/treatments`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<ExecutedTreatment>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: 'Treatment', id: body.unitId },
        { type: 'Treatment', id: `withdrawals-${body.unitId}` },
        { type: 'HealthAlert', id: 'farm' },
      ],
    }),
    deleteTreatment: build.mutation<void, { farmId: number; id: number; unitId: number }>({
      // OWNER only, server-side: a treatment record is traceability, not a note.
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/treatments/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'Treatment', id: unitId },
        { type: 'Treatment', id: `withdrawals-${unitId}` },
        { type: 'HealthAlert', id: 'farm' },
      ],
    }),

    /* --- Veterinarians (advanced module) ------------------------------ */
    getVeterinarians: build.query<Veterinarian[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/veterinarians`,
      transformResponse: (r: ApiEnvelope<Veterinarian[]>) => r.data,
      providesTags: [{ type: 'Veterinarian', id: 'list' }],
    }),
    createVeterinarian: build.mutation<
      Veterinarian,
      { farmId: number; body: VeterinarianInput }
    >({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/veterinarians`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Veterinarian>) => r.data,
      invalidatesTags: [{ type: 'Veterinarian', id: 'list' }],
    }),
    updateVeterinarian: build.mutation<
      Veterinarian,
      { farmId: number; id: number; body: VeterinarianInput }
    >({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/veterinarians/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (r: ApiEnvelope<Veterinarian>) => r.data,
      invalidatesTags: [{ type: 'Veterinarian', id: 'list' }],
    }),
    deactivateVeterinarian: build.mutation<void, { farmId: number; id: number }>({
      // Soft: the visits that reference this vet keep a name to show.
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/veterinarians/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Veterinarian', id: 'list' }],
    }),

    /* --- Vet visits (advanced module) --------------------------------- */
    getVetVisits: build.query<VetVisit[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/vet-visits?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<VetVisit[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'VetVisit', id: unitId }],
    }),
    getUpcomingFollowUps: build.query<VetVisit[], { farmId: number; days?: number }>({
      query: ({ farmId, days = 30 }) =>
        `${base(farmId)}/vet-visits/upcoming-follow-ups?days=${days}`,
      transformResponse: (r: ApiEnvelope<VetVisit[]>) => r.data,
      providesTags: [{ type: 'VetVisit', id: 'follow-ups' }],
    }),
    recordVetVisit: build.mutation<VetVisit, { farmId: number; body: VetVisitInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/vet-visits`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<VetVisit>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: 'VetVisit', id: body.unitId },
        { type: 'VetVisit', id: 'follow-ups' },
        { type: 'HealthAlert', id: 'farm' },
        // A cost above zero books a farm expense server-side, so the finance screens are stale.
        { type: 'Expense', id: 'list' },
      ],
    }),
    deleteVetVisit: build.mutation<void, { farmId: number; id: number; unitId: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/vet-visits/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'VetVisit', id: unitId },
        { type: 'VetVisit', id: 'follow-ups' },
        { type: 'HealthAlert', id: 'farm' },
        // Deleting a visit reverses the expense it booked.
        { type: 'Expense', id: 'list' },
      ],
    }),
  }),
});

export const {
  useGetVaccineCatalogQuery,
  useGetTreatmentLibraryQuery,
  useGetProgramCatalogQuery,
  useGetProgramsByBreedQuery,
  useGetProgramAssignmentQuery,
  useAssignProgramMutation,
  useRemoveProgramMutation,
  useGetScheduleQuery,
  useDeleteVaccinationMutation,
  useDeleteObservationMutation,
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
  useDeleteVetVisitMutation,
  useGetVaccinationsQuery,
  useGetObservationsQuery,
  useGetHealthAlertsQuery,
  useGetVaccinesQuery,
  useGetProgramsQuery,
  useGetTreatmentCatalogQuery,
  useRecordVaccinationMutation,
  useRecordObservationMutation,
} = healthApi;
