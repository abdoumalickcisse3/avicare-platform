package com.avicare.partner.exception;

import com.avicare.common.api.exception.BusinessException;
import org.springframework.http.HttpStatus;

/** An invite code is unknown, inactive, expired, or exhausted (HTTP 422). */
public class InviteCodeInvalidException extends BusinessException {

  public InviteCodeInvalidException(String message) {
    super("INVITE_CODE_INVALID", message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
