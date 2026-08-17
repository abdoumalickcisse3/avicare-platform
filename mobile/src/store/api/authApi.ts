import { baseApi } from './baseApi';
import type { AuthTokens } from '@/auth/tokens';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export type LoginRequest = { email: string; password: string };
export type SignupRequest = { fullName: string; email: string; password: string; phone?: string };

/** The signed-in user's own profile (mirrors backend UserResponse). */
export type UserProfile = {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  locale: string;
  role: string;
};

export const authApi = baseApi.injectEndpoints({
  // Re-injecting the same endpoints under Fast Refresh (when this file is edited)
  // otherwise logs "override already-existing endpoint" for every endpoint. Harmless
  // in dev; production evaluates the module once so this never triggers.
  overrideExisting: __DEV__,
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
    getProfile: build.query<UserProfile, void>({
      query: () => '/api/v1/account/profile',
      transformResponse: (r: ApiEnvelope<UserProfile>) => r.data,
      providesTags: [{ type: 'Member', id: 'me' }],
    }),
    updateProfile: build.mutation<
      UserProfile,
      { fullName: string; phone?: string; locale?: string }
    >({
      query: (body) => ({ url: '/api/v1/account/profile', method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<UserProfile>) => r.data,
      invalidatesTags: [{ type: 'Member', id: 'me' }],
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useSignupMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
} = authApi;
