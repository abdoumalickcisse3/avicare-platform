/**
 * Health (sanitaire) — ported from `web/src/store/api/healthApi.ts` (same
 * backend). Only the unit-scoped reads the mobile lot-detail "Sanitaire" tab
 * needs: vaccinations and observations. Entry mutations go through the offline
 * sync queue / dedicated screens, not this slice.
 */
import { baseApi } from './baseApi';
import type {
  HealthAlerts,
  HealthCatalogEntry,
  HealthObservation,
  ObservationInput,
  Vaccination,
  VaccinationInput,
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
  }),
});

export const {
  useGetVaccinationsQuery,
  useGetObservationsQuery,
  useGetHealthAlertsQuery,
  useGetVaccinesQuery,
  useGetProgramsQuery,
  useGetTreatmentCatalogQuery,
  useRecordVaccinationMutation,
  useRecordObservationMutation,
} = healthApi;
