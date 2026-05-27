package com.avicare.common.api.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProblemDetailResponseTest {

  @Test
  void builder_buildsAllFields() {
    Instant ts = Instant.parse("2026-05-27T00:00:00Z");

    ProblemDetailResponse problem =
        ProblemDetailResponse.builder()
            .type(URI.create("https://avicare.com/errors/batch-not-found"))
            .title("Batch Not Found")
            .status(404)
            .detail("Batch with id 42 not found")
            .instance(URI.create("/api/v1/batches/42"))
            .code("BATCH_NOT_FOUND")
            .traceId("trace-123")
            .timestamp(ts)
            .properties(Map.of("entityId", 42))
            .build();

    assertThat(problem.type().toString()).isEqualTo("https://avicare.com/errors/batch-not-found");
    assertThat(problem.title()).isEqualTo("Batch Not Found");
    assertThat(problem.status()).isEqualTo(404);
    assertThat(problem.detail()).isEqualTo("Batch with id 42 not found");
    assertThat(problem.instance().toString()).isEqualTo("/api/v1/batches/42");
    assertThat(problem.code()).isEqualTo("BATCH_NOT_FOUND");
    assertThat(problem.traceId()).isEqualTo("trace-123");
    assertThat(problem.timestamp()).isEqualTo(ts);
    assertThat(problem.properties()).containsEntry("entityId", 42);
  }

  @Test
  void builder_defaultsTimestampToNow() {
    Instant before = Instant.now();
    ProblemDetailResponse problem =
        ProblemDetailResponse.builder().title("Test").status(500).build();
    Instant after = Instant.now();

    assertThat(problem.timestamp()).isBetween(before, after);
    assertThat(problem.properties()).isNull();
  }
}
