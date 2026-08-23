package com.avicare.common.tenancy.context;

import java.util.Objects;
import java.util.Optional;

/**
 * ThreadLocal store for the current request's partner id (partner-portal auth). Mirror of {@link
 * TenancyContext}; MUST be cleared in a finally block (Tomcat reuses worker threads).
 */
public final class PartnerContext {

  private static final ThreadLocal<Long> CONTEXT = new ThreadLocal<>();

  private PartnerContext() {}

  public static void set(Long partnerId) {
    CONTEXT.set(Objects.requireNonNull(partnerId, "partnerId must not be null"));
  }

  /** The current thread's partner id, or throws if none is bound. */
  public static Long currentPartnerId() {
    Long id = CONTEXT.get();
    if (id == null) {
      throw new IllegalStateException("No partner context bound to the current thread.");
    }
    return id;
  }

  public static Optional<Long> tryCurrentPartnerId() {
    return Optional.ofNullable(CONTEXT.get());
  }

  public static void clear() {
    CONTEXT.remove();
  }
}
