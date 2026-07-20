import { baseApi } from './baseApi';
import type { AuthTokens } from '@/auth/tokens';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export type LoginRequest = { email: string; password: string };

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthTokens, LoginRequest>({
      query: (body) => ({ url: '/api/v1/auth/login', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
    }),
    refresh: build.mutation<AuthTokens, { refreshToken: string }>({
      query: (body) => ({ url: '/api/v1/auth/refresh', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
    }),
  }),
});

export const { useLoginMutation, useRefreshMutation } = authApi;
