package com.avicare.common.api.error;

import com.avicare.common.api.exception.BusinessException;
import com.avicare.common.api.exception.ValidationException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Centralized exception handler that converts every thrown exception to an RFC 7807 Problem Details
 * response, attaching the current correlation ID for traceability.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  private static final String ERROR_TYPE_BASE = "https://avicare.com/errors/";

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ProblemDetailResponse> handleBusiness(
      BusinessException ex, HttpServletRequest request) {
    log.warn("Business exception [{}]: {}", ex.getCode(), ex.getMessage());
    ProblemDetailResponse body = buildProblem(ex, request);
    return ResponseEntity.status(ex.getStatus()).body(body);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ProblemDetailResponse> handleValidation(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    List<ValidationException.FieldError> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(
                fe ->
                    new ValidationException.FieldError(
                        fe.getField(), fe.getCode(), fe.getDefaultMessage()))
            .toList();

    log.warn("Validation failed: {} field(s)", errors.size());

    ProblemDetailResponse body =
        ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "validation-failed"))
            .title("Validation Failed")
            .status(400)
            .detail("Request validation failed")
            .instance(URI.create(request.getRequestURI()))
            .code("VALIDATION_FAILED")
            .traceId(MDC.get("correlationId"))
            .properties(Map.of("errors", errors))
            .build();

    return ResponseEntity.badRequest().body(body);
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ProblemDetailResponse> handleAccessDenied(
      AccessDeniedException ex, HttpServletRequest request) {
    log.warn("Access denied: {}", request.getRequestURI());

    ProblemDetailResponse body =
        ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "access-denied"))
            .title("Access Denied")
            .status(403)
            .detail("You do not have permission to access this resource")
            .instance(URI.create(request.getRequestURI()))
            .code("ACCESS_DENIED")
            .traceId(MDC.get("correlationId"))
            .build();

    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<ProblemDetailResponse> handleAuthentication(
      AuthenticationException ex, HttpServletRequest request) {
    log.warn("Authentication failed: {}", ex.getMessage());

    ProblemDetailResponse body =
        ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "authentication-failed"))
            .title("Authentication Failed")
            .status(401)
            .detail(ex.getMessage())
            .instance(URI.create(request.getRequestURI()))
            .code("AUTHENTICATION_FAILED")
            .traceId(MDC.get("correlationId"))
            .build();

    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ProblemDetailResponse> handleGeneric(
      Exception ex, HttpServletRequest request) {
    log.error("Unhandled exception", ex);

    ProblemDetailResponse body =
        ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "internal-error"))
            .title("Internal Server Error")
            .status(500)
            .detail("An unexpected error occurred")
            .instance(URI.create(request.getRequestURI()))
            .code("INTERNAL_ERROR")
            .traceId(MDC.get("correlationId"))
            .build();

    return ResponseEntity.internalServerError().body(body);
  }

  private ProblemDetailResponse buildProblem(BusinessException ex, HttpServletRequest request) {
    String slug = ex.getCode().toLowerCase().replace('_', '-');

    return ProblemDetailResponse.builder()
        .type(URI.create(ERROR_TYPE_BASE + slug))
        .title(humanizeCode(ex.getCode()))
        .status(ex.getStatus().value())
        .detail(ex.getMessage())
        .instance(URI.create(request.getRequestURI()))
        .code(ex.getCode())
        .traceId(MDC.get("correlationId"))
        .properties(ex.getProperties().isEmpty() ? null : ex.getProperties())
        .build();
  }

  private String humanizeCode(String code) {
    String[] parts = code.toLowerCase().split("_");
    StringBuilder sb = new StringBuilder();
    for (String p : parts) {
      if (sb.length() > 0) sb.append(' ');
      sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
    }
    return sb.toString();
  }
}
