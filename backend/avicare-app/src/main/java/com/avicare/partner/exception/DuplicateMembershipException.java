package com.avicare.partner.exception;

import com.avicare.common.api.exception.BusinessException;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** A non-LEFT membership already exists for this (partner, farm) pair (HTTP 409). */
public class DuplicateMembershipException extends BusinessException {

  public DuplicateMembershipException(Long partnerId, Long farmId) {
    super(
        "MEMBERSHIP_EXISTS",
        "Farm " + farmId + " already belongs to partner " + partnerId,
        HttpStatus.CONFLICT,
        Map.of("partnerId", partnerId, "farmId", farmId));
  }
}
