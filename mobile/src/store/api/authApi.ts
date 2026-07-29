import { baseApi } from './baseApi';
import type { AuthTokens } from '@/auth/tokens';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export type LoginRequest = { email: string; password: string };
export type SignupRequest = { fullName: string; email: string; password: string; phone?: string };

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
    signup: build.mutation<AuthTokens, SignupRequest>({
      query: (body) => ({ url: '/api/v1/auth/signup', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
    }),
  }),
});

export const { useLoginMutation, useRefreshMutation, useSignupMutation } = authApi;
