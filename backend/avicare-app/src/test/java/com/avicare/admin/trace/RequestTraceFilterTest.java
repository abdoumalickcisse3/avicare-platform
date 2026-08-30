package com.avicare.admin.trace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.filter.CorrelationIdFilter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The capture policy is the difference between a useful table and one nobody can afford to keep, so
 * it is pinned here: what earns a row, what does not, and which bodies are buffered.
 */
@ExtendWith(MockitoExtension.class)
class RequestTraceFilterTest {

  @Mock private RequestTraceRecorder recorder;

  private MockMvc mockMvcWith(TracingProperties properties) {
    return MockMvcBuilders.standaloneSetup(new ProbeController())
        .addFilters(new CorrelationIdFilter(), new RequestTraceFilter(recorder, properties))
        .build();
  }

  private static TracingProperties props(
      boolean enabled, TracingProperties.Capture capture, int slowMs) {
    return new TracingProperties(enabled, capture, slowMs, 4_000, 10_000, 30, "0 0 3 * * *");
  }

  @Test
  void doesNotRecordASuccessfulFastRead() throws Exception {
    mockMvcWith(props(true, TracingProperties.Capture.ERRORS_AND_MUTATIONS, 60_000))
        .perform(get("/__probe/read"))
        .andExpect(status().isOk());

    verify(recorder, never()).record(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void recordsASlowRead() throws Exception {
    // slow-ms 0: every read counts as slow, which is what a debugging window looks like.
    mockMvcWith(props(true, TracingProperties.Capture.ERRORS_AND_MUTATIONS, 0))
        .perform(get("/__probe/read"))
        .andExpect(status().isOk());

    assertThat(captured().method()).isEqualTo("GET");
  }

  @Test
  void recordsAFailedRead() throws Exception {
    mockMvcWith(props(true, TracingProperties.Capture.ERRORS_AND_MUTATIONS, 60_000))
        .perform(get("/__probe/missing"))
        .andExpect(status().isNotFound());

    assertThat(captured().statusCode()).isEqualTo(404);
  }

  @Test
  void recordsAWriteWithItsRequestBodyAndCorrelationId() throws Exception {
    mockMvcWith(props(true, TracingProperties.Capture.ERRORS_AND_MUTATIONS, 60_000))
        .perform(
            post("/__probe/write")
                .header(CorrelationIdFilter.HEADER_NAME, "corr-42")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"note\":\"hello\"}"))
        .andExpect(status().isOk());

    RequestTraceDraft draft = captured();
    assertThat(draft.requestId()).isEqualTo("corr-42");
    assertThat(draft.requestBody()).contains("hello");
    assertThat(draft.requestContentType()).contains(MediaType.APPLICATION_JSON_VALUE);
    // A successful write keeps no response body: only errors are worth the storage.
    assertThat(draft.responseBody()).isNull();
    assertThat(draft.durationMs()).isNotNegative();
  }

  @Test
  void keepsTheResponseBodyOfAFailedWrite() throws Exception {
    mockMvcWith(props(true, TracingProperties.Capture.ERRORS_AND_MUTATIONS, 60_000))
        .perform(post("/__probe/refuse").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest());

    assertThat(captured().responseBody()).contains("refused");
  }

  @Test
  void recordsEverythingUnderCaptureAll() throws Exception {
    mockMvcWith(props(true, TracingProperties.Capture.ALL, 60_000))
        .perform(get("/__probe/read"))
        .andExpect(status().isOk());

    assertThat(captured().path()).isEqualTo("/__probe/read");
  }

  @Test
  void recordsNothingWhenDisabled() throws Exception {
    mockMvcWith(props(false, TracingProperties.Capture.ALL, 0))
        .perform(post("/__probe/write").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());

    verify(recorder, never()).record(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void ignoresInfrastructureEndpoints() throws Exception {
    mockMvcWith(props(true, TracingProperties.Capture.ALL, 0))
        .perform(get("/actuator/health"))
        .andExpect(status().isNotFound());

    verify(recorder, never()).record(org.mockito.ArgumentMatchers.any());
  }

  private RequestTraceDraft captured() {
    ArgumentCaptor<RequestTraceDraft> captor = ArgumentCaptor.forClass(RequestTraceDraft.class);
    verify(recorder).record(captor.capture());
    return captor.getValue();
  }

  @RestController
  static class ProbeController {

    @GetMapping("/__probe/read")
    String read() {
      return "ok";
    }

    @PostMapping("/__probe/write")
    String write(@RequestBody String body) {
      return "written";
    }

    @PostMapping("/__probe/refuse")
    org.springframework.http.ResponseEntity<String> refuse(@RequestBody String body) {
      return org.springframework.http.ResponseEntity.badRequest().body("{\"detail\":\"refused\"}");
    }
  }
}
