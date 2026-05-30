package com.avicare.common.api.filter;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

class CorrelationIdFilterTest {

  private static final String UUID_REGEX =
      "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new PingController())
            .addFilters(new CorrelationIdFilter())
            .build();
  }

  @Test
  void generatesIdWhenHeaderMissing() throws Exception {
    mockMvc
        .perform(get("/__test/ping"))
        .andExpect(status().isOk())
        .andExpect(header().exists(CorrelationIdFilter.HEADER_NAME))
        .andExpect(
            header().string(CorrelationIdFilter.HEADER_NAME, Matchers.matchesPattern(UUID_REGEX)));
  }

  @Test
  void echoesIncomingId() throws Exception {
    mockMvc
        .perform(get("/__test/ping").header(CorrelationIdFilter.HEADER_NAME, "trace-abc-123"))
        .andExpect(status().isOk())
        .andExpect(header().string(CorrelationIdFilter.HEADER_NAME, "trace-abc-123"));
  }

  @Test
  void generatesIdWhenHeaderIsBlank() throws Exception {
    mockMvc
        .perform(get("/__test/ping").header(CorrelationIdFilter.HEADER_NAME, "   "))
        .andExpect(status().isOk())
        .andExpect(
            header().string(CorrelationIdFilter.HEADER_NAME, Matchers.matchesPattern(UUID_REGEX)));
  }

  @RestController
  static class PingController {
    @GetMapping("/__test/ping")
    public String ping() {
      return "pong";
    }
  }
}
