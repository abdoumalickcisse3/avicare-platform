package com.avicare.partner.exception;

import com.avicare.common.api.exception.BusinessException;
import org.springframework.http.HttpStatus;

/** Bad partner credentials, inactive account, or invalid/expired refresh (HTTP 401). */
public class PartnerAuthException extends BusinessException {

  public PartnerAuthException(String message) {
    super("PARTNER_AUTH_FAILED", message, HttpStatus.UNAUTHORIZED);
  }
}
