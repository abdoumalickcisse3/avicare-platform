package com.avicare.common.api.error;

import com.avicare.common.api.exception.BusinessException;
import com.avicare.common.api.exception.ValidationException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Centralized exception handler that converts every thrown exception to an RFC 7807 Problem Details
 * response, attaching the current correlation ID for traceability.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  private static final String ERROR_TYPE_BASE = "https://avicare.com/errors/";

  /**
   * Request attribute carrying the exception that produced a 500, for whoever wants it after the
   * response is written. The request-tracing filter reads it to store a real stack trace: once an
   * exception is turned into a Problem response here, it never reaches the filter chain again, and
   * "Internal Server Error" alone is not something anyone can debug from.
   */
  public static final String TRACE_ERROR_ATTRIBUTE = "avicare.trace.error";

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

  /**
   * A request the caller built wrong: a missing parameter, a value of the wrong type, a body
   * Jackson cannot read. Without this the generic handler below catches them and answers 500 —
   * which turns a client mistake into a server alert, wakes the on-call for a forgotten query
   * parameter, and hides the one thing the caller needed to know: which field to fix.
   */
  @ExceptionHandler({
    MissingServletRequestParameterException.class,
    MissingRequestHeaderException.class,
    MissingServletRequestPartException.class,
    MethodArgumentTypeMismatchException.class,
    HttpMessageNotReadableException.class
  })
  public ResponseEntity<ProblemDetailResponse> handleMalformedRequest(
      Exception ex, HttpServletRequest request) {
    String detail = describeMalformed(ex);
    log.warn("Malformed request on {}: {}", request.getRequestURI(), detail);

    return ResponseEntity.badRequest()
        .body(
            problem(
                "malformed-request",
                "Malformed Request",
                400,
                detail,
                "MALFORMED_REQUEST",
                request));
  }

  /**
   * An address that maps to no handler. Spring raises this from the resource-resolution chain, so
   * without an explicit handler it lands in the generic catch and a typo answers 500 — making "the
   * caller has the wrong URL" indistinguishable from "the platform is down" in the traces.
   */
  @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
  public ResponseEntity<ProblemDetailResponse> handleNoResource(
      Exception ex, HttpServletRequest request) {
    log.warn("No handler for {} {}", request.getMethod(), request.getRequestURI());

    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(
            problem(
                "resource-not-found",
                "Resource Not Found",
                404,
                "No endpoint matches this address",
                "RESOURCE_NOT_FOUND",
                request));
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ProblemDetailResponse> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
    log.warn("Method {} not allowed on {}", ex.getMethod(), request.getRequestURI());

    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
        .body(
            problem(
                "method-not-allowed",
                "Method Not Allowed",
                405,
                "Method " + ex.getMethod() + " is not supported by this endpoint",
                "METHOD_NOT_ALLOWED",
                request));
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ProblemDetailResponse> handleMediaTypeNotSupported(
      HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
    log.warn("Unsupported media type on {}: {}", request.getRequestURI(), ex.getContentType());

    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
        .body(
            problem(
                "unsupported-media-type",
                "Unsupported Media Type",
                415,
                "This endpoint expects application/json",
                "UNSUPPORTED_MEDIA_TYPE",
                request));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ProblemDetailResponse> handleGeneric(
      Exception ex, HttpServletRequest request) {
    log.error("Unhandled exception", ex);
    request.setAttribute(TRACE_ERROR_ATTRIBUTE, ex);

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

  private ProblemDetailResponse problem(
      String slug,
      String title,
      int status,
      String detail,
      String code,
      HttpServletRequest request) {
    return ProblemDetailResponse.builder()
        .type(URI.create(ERROR_TYPE_BASE + slug))
        .title(title)
        .status(status)
        .detail(detail)
        .instance(URI.create(request.getRequestURI()))
        .code(code)
        .traceId(MDC.get("correlationId"))
        .build();
  }

  /**
   * Say which field to fix. The exception messages themselves carry framework and Jackson
   * internals, so each case is re-worded: enough for the caller to correct the request, nothing
   * echoed back from a body we just refused to parse.
   */
  private String describeMalformed(Exception ex) {
    if (ex instanceof MissingServletRequestParameterException e) {
      return "Required query parameter '" + e.getParameterName() + "' is missing";
    }
    if (ex instanceof MissingRequestHeaderException e) {
      return "Required header '" + e.getHeaderName() + "' is missing";
    }
    if (ex instanceof MissingServletRequestPartException e) {
      return "Required part '" + e.getRequestPartName() + "' is missing";
    }
    if (ex instanceof MethodArgumentTypeMismatchException e) {
      Class<?> expected = e.getRequiredType();
      return "Parameter '"
          + e.getName()
          + "' expects "
          + (expected == null ? "a different type" : "a value of type " + expected.getSimpleName());
    }
    if (ex instanceof HttpMessageNotReadableException
        && ex.getCause() instanceof InvalidFormatException ife) {
      String field =
          ife.getPath().stream()
              .map(r -> r.getFieldName() == null ? "[" + r.getIndex() + "]" : r.getFieldName())
              .reduce((a, b) -> a + "." + b)
              .orElse("body");
      Class<?> target = ife.getTargetType();
      if (target != null && target.isEnum()) {
        String accepted =
            String.join(
                ", ",
                java.util.Arrays.stream(target.getEnumConstants()).map(Object::toString).toList());
        return "Field '" + field + "' accepts only: " + accepted;
      }
      return "Field '" + field + "' has a value of the wrong type";
    }
    return "Request body is missing or is not valid JSON";
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
