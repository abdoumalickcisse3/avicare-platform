package com.avicare.identity.api;

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
}
