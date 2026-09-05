package com.avicare.common.api.exception;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * 400 — the request itself is wrong: a required field is missing, a value is out of range, a key
 * names something that does not exist in the catalog. The caller has to change what they sent.
 *
 * <p>Which of the two: this one when a <b>different payload</b> would be accepted, {@link
 * BusinessRuleException} (422) when the payload is fine and the <b>domain</b> refuses — selling
 * more than the stock holds, paying an invoice twice. Both were being used interchangeably, so the
 * same endpoint could answer 422 for overselling and 400 for an article that is not a product,
 * leaving clients unable to tell "fix the form" from "explain the rule to the farmer".
 */
public class ValidationException extends BusinessException {

  public ValidationException(String code, String message) {
    super(code, message, HttpStatus.BAD_REQUEST);
  }

  public ValidationException(String code, String message, List<FieldError> errors) {
    super(code, message, HttpStatus.BAD_REQUEST, Map.of("errors", errors));
  }

  /** Per-field validation failure. */
  public record FieldError(String field, String code, String message) {}
}
