package com.avicare.common.tenancy.context;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * ThreadLocal store for the current request's tenancy data.
 *
 * <p>Populated by the authentication layer (the {@code JwtFilter} in {@code common-security},
 * Sprint A2 Session 4+) and read by services that need to scope work to the user's accessible
 * farms.
 *
 * <p><b>Mandatory usage pattern</b> — every producer MUST clear the context in a {@code finally}
 * block to avoid leaking tenancy data between requests served by recycled threads (Tomcat reuses
 * threads from a pool):
 *
 * <pre>{@code
 * try {
 *   TenancyContext.set(tenantData);
 *   chain.doFilter(request, response);
 * } finally {
 *   TenancyContext.clear();
 * }
 * }</pre>
 *
 * <p>Forgetting the {@code clear()} call is a multi-tenant security bug: the next request handled
 * by the same thread sees the previous user's farms. {@link #clear()} delegates to {@link
 * ThreadLocal#remove()} (never {@code set(null)} which keeps the entry alive in the thread-locals
 * map).
 */
public final class TenancyContext {

  private static final ThreadLocal<TenantData> CONTEXT = new ThreadLocal<>();

  private TenancyContext() {}

  /**
   * Bind the given tenancy data to the current thread. Replaces any value already set on this
   * thread.
   *
   * @throws NullPointerException if {@code data} is {@code null}
   */
  public static void set(TenantData data) {
    Objects.requireNonNull(data, "TenantData must not be null");
    CONTEXT.set(data);
  }

  /**
   * Return the current thread's tenancy data.
   *
   * @throws IllegalStateException if no tenancy data is bound to the current thread (typically:
   *     filter chain was misconfigured, or this call happens outside a request context)
   */
  public static TenantData get() {
    TenantData data = CONTEXT.get();
    if (data == null) {
      throw new IllegalStateException(
          "No tenancy context bound to the current thread. "
              + "Did the authentication filter run, and did it call TenancyContext.set(...)?");
    }
    return data;
  }

  /**
   * Non-throwing variant of {@link #get()}. Use when the caller can legitimately operate outside a
   * tenancy context (e.g. a background job, a public unauthenticated endpoint).
   */
  public static Optional<TenantData> tryGet() {
    return Optional.ofNullable(CONTEXT.get());
  }

  /** Whether tenancy data is currently bound to this thread. */
  public static boolean isSet() {
    return CONTEXT.get() != null;
  }

  /**
   * Unbind the tenancy data from the current thread. Always call this in a {@code finally} block
   * paired with {@link #set(TenantData)} — see class-level javadoc.
   */
  public static void clear() {
    CONTEXT.remove();
  }

  /** Convenience: returns {@code get().userId()}. Throws if no context is set. */
  public static Long currentUserId() {
    return get().userId();
  }

  /** Convenience: returns {@code get().accessibleFarmIds()}. Throws if no context is set. */
  public static List<Long> accessibleFarmIds() {
    return get().accessibleFarmIds();
  }

  /** Convenience: returns {@code get().isSuperAdmin()}. Throws if no context is set. */
  public static boolean isSuperAdmin() {
    return get().isSuperAdmin();
  }
}
