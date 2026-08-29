import { baseApi } from "./baseApi";
import type {
  AuthTokens,
  LoginRequest,
  SignupRequest,
  UserProfile,
} from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export const authApi = baseApi.injectEndpoints({
  // Silence the "override already-existing endpoint" logs when this file is edited
  // under HMR (re-injects into the persisted baseApi). Never triggers in production
  // (the module evaluates once).
  overrideExisting: process.env.NODE_ENV !== "production",
  endpoints: (build) => ({
    login: build.mutation<AuthTokens, LoginRequest>({
      query: (body) => ({ url: "/api/v1/auth/login", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
    }),
    signup: build.mutation<AuthTokens, SignupRequest>({
      query: (body) => ({ url: "/api/v1/auth/signup", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
    }),
    refresh: build.mutation<AuthTokens, { refreshToken: string }>({
      query: (body) => ({ url: "/api/v1/auth/refresh", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
    }),
    getProfile: build.query<UserProfile, void>({
      query: () => "/api/v1/account/profile",
      transformResponse: (r: ApiEnvelope<UserProfile>) => r.data,
      providesTags: ["User"],
    }),
    updateProfile: build.mutation<
      UserProfile,
      { fullName: string; phone?: string; locale?: string }
    >({
      query: (body) => ({ url: "/api/v1/account/profile", method: "PUT", body }),
      transformResponse: (r: ApiEnvelope<UserProfile>) => r.data,
      invalidatesTags: ["User"],
    }),

    /** Ask for a WhatsApp reset code. Answers the same whether the number is known or not. */
    requestPasswordReset: build.mutation<{ message: string }, { phone: string }>({
      query: (body) => ({ url: "/api/v1/auth/password-reset/request", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<{ message: string }>) => r.data,
    }),

    confirmPasswordReset: build.mutation<
      { message: string },
      { phone: string; code: string; newPassword: string }
    >({
      query: (body) => ({ url: "/api/v1/auth/password-reset/confirm", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<{ message: string }>) => r.data,
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useRefreshMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
} = authApi;
