package com.avicare.identity.spi;

/**
 * Inversion-of-control seam so the identity context can trace a staff sign-in <b>without</b>
 * depending on the admin context.
 *
 * <p>Same reasoning as {@link MembershipProvider}: identity must not import another business
 * context, so it declares the interface and {@code admin} implements it. {@code AuthService}
 * depends only on this identity-owned type.
 *
 * <p>A no-op default keeps identity bootable on its own (slice tests, contexts without admin).
 */
public interface StaffLoginAuditor {

  /** Called after a successful sign-in by a platform staff account. Must never throw. */
  void recordStaffLogin(Long userId, String email);
}
