package com.avicare.identity.api;

import com.avicare.identity.api.dto.ProvisionUserCommand;
import com.avicare.identity.api.dto.UserInfo;

/**
 * Public contract of the identity bounded context. Other contexts (e.g. tenancy) depend only on
 * this facade, never on identity internals. Per docs/03 §4.1.
 */
public interface IdentityFacade {

  /**
   * @throws com.avicare.common.api.exception.NotFoundException if no user has this id
   */
  UserInfo findById(Long userId);

  /**
   * @throws com.avicare.common.api.exception.NotFoundException if no user has this email
   */
  UserInfo findByEmail(String email);

  boolean isActive(Long userId);

  /**
   * Provision a new user account (e.g. created by a farm owner for a worker).
   *
   * @throws com.avicare.common.api.exception.ConflictException if the email is already used
   */
  UserInfo provisionUser(ProvisionUserCommand command);

  /** Set a new password for an existing user (BCrypt-encoded). */
  void resetPassword(Long userId, String rawPassword);

  /**
   * Enable or disable an account. There was no path to disable a user anywhere in the platform
   * before the back-office needed one — {@link #isActive} was read-only.
   */
  void setActive(Long userId, boolean active);
}
