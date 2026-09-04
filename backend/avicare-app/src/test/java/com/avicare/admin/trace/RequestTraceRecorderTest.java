package com.avicare.admin.trace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import com.avicare.admin.domain.RequestTrace;
import com.avicare.admin.repository.RequestTraceRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * The recorder is the only thing standing between a support tool and a leak, so its rules are
 * tested one by one: credentials never land, unparsable bodies are dropped whole, payloads are
 * bounded, and a failure to record never escapes.
 */
@ExtendWith(MockitoExtension.class)
class RequestTraceRecorderTest {

  @Mock private RequestTraceRepository repository;

  private RequestTraceRecorder recorder;

  @BeforeEach
  void setUp() {
    recorder =
        new RequestTraceRecorder(
            repository,
            new ObjectMapper(),
            new TracingProperties(
                true,
                TracingProperties.Capture.ERRORS_AND_MUTATIONS,
                1000,
                200,
                200,
                30,
                "0 0 3 * * *"));
  }

  @Test
  void masksCredentialsAtAnyDepth() {
    String body =
        """
        {"email":"a@b.com","password":"hunter2",
         "nested":{"refreshToken":"rt-1","keep":"visible"},
         "list":[{"apiSecret":"s3cr3t"}]}
        """;

    String sanitized = recorder.sanitizeBody(body, "application/json", 500);

    assertThat(sanitized).doesNotContain("hunter2", "rt-1", "s3cr3t");
    assertThat(sanitized).contains("a@b.com", "visible");
    assertThat(sanitized).contains(RequestTraceRecorder.MASK);
  }

  @Test
  void dropsBodiesItCannotParseOrMask() {
    assertThat(
            recorder.sanitizeBody(
                "id=1&password=hunter2", "application/x-www-form-urlencoded", 500))
        .doesNotContain("hunter2");
    assertThat(recorder.sanitizeBody("<binary>", "multipart/form-data; boundary=x", 500))
        .doesNotContain("binary");
    assertThat(recorder.sanitizeBody("{not json", "application/json", 500))
        .doesNotContain("not json");
  }

  @Test
  void truncatesLongPayloads() {
    String longValue = "x".repeat(5_000);

    String sanitized =
        recorder.sanitizeBody("{\"note\":\"" + longValue + "\"}", "application/json", 120);

    assertThat(sanitized).hasSizeLessThanOrEqualTo(120);
    assertThat(sanitized).endsWith("[tronqué]");
  }

  @Test
  void keepsNullBodiesNull() {
    assertThat(recorder.sanitizeBody(null, "application/json", 500)).isNull();
    assertThat(recorder.sanitizeBody("   ", "application/json", 500)).isNull();
  }

  @Test
  void mapsTheDraftAndFlattensTheError() {
    RequestTrace trace = recorder.toEntity(draft(new IllegalStateException("boom")));

    assertThat(trace.getRequestId()).isEqualTo("corr-1");
    assertThat(trace.getStatusCode()).isEqualTo(500);
    assertThat(trace.getErrorMessage()).isEqualTo("IllegalStateException: boom");
    assertThat(trace.getStackTrace()).contains("IllegalStateException");
    assertThat(trace.getRequestBody()).contains(RequestTraceRecorder.MASK);
  }

  @Test
  void leavesErrorFieldsEmptyWhenNothingFailed() {
    RequestTrace trace = recorder.toEntity(draft(null));

    assertThat(trace.getErrorMessage()).isNull();
    assertThat(trace.getStackTrace()).isNull();
  }

  @Test
  void neverThrowsWhenTheTraceCannotBeSaved() {
    doThrow(new RuntimeException("db down")).when(repository).save(any());

    recorder.record(draft(null));

    verify(repository).save(any());
  }

  @Test
  void keepsTheOtelTraceId_soTheConsoleCanLinkToJaeger() {
    RequestTrace trace = recorder.toEntity(draft(null));

    assertThat(trace.getOtelTraceId()).isEqualTo("4bf92f3577b34da6a3ce929d0e0e4736");
  }

  /** The agent can be switched off without a rebuild, so an absent id is a normal state. */
  @Test
  void toleratesAMissingOtelTraceId_whenTheAgentIsOff() {
    RequestTrace trace = recorder.toEntity(draft(null, null));

    assertThat(trace.getOtelTraceId()).isNull();
  }

  private static RequestTraceDraft draft(Throwable error) {
    return draft(error, "4bf92f3577b34da6a3ce929d0e0e4736");
  }

  private static RequestTraceDraft draft(Throwable error, String otelTraceId) {
    return new RequestTraceDraft(
        "corr-1",
        "POST",
        "/api/v1/auth/login",
        "/api/v1/auth/login",
        7L,
        "user@farm.sn",
        3L,
        500,
        42,
        "10.0.0.1",
        "{\"email\":\"user@farm.sn\",\"password\":\"hunter2\"}",
        "application/json",
        "{\"title\":\"Internal Server Error\"}",
        error,
        LocalDateTime.now().minusSeconds(1),
        LocalDateTime.now(),
        otelTraceId);
  }
}
