package com.avicare.common.api.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * 422 — the request is well formed and every value exists, but a rule of the domain refuses it:
 * selling more birds than the lot holds, paying more than an invoice is worth, closing a period
 * twice.
 *
 * <p>Which of the two: this one when <b>no payload</b> would have been accepted in the current
 * state, {@link ValidationException} (400) when the caller simply sent something wrong.
 */
public class BusinessRuleException extends BusinessException {

  public BusinessRuleException(String code, String message) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  /**
   * Même refus, accompagné de quoi le réparer. Les propriétés partent telles quelles dans le
   * corps RFC 7807 : un écran peut s'en servir pour proposer le geste qui débloque plutôt que de
   * renvoyer l'utilisateur à un message et à son impasse.
   */
  public BusinessRuleException(String code, String message, Map<String, Object> properties) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, properties);
  }
}
