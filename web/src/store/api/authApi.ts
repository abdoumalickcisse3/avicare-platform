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
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useRefreshMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
} = authApi;
