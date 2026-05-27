package com.avicare.common.api.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.FeatureForbiddenException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.QuotaExceededException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new TestController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void businessNotFound_returns404ProblemWithCode() throws Exception {
    mockMvc
        .perform(get("/__test/not-found"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.code").value("BATCH_NOT_FOUND"))
        .andExpect(jsonPath("$.title").value("Batch Not Found"))
        .andExpect(jsonPath("$.type").value("https://avicare.com/errors/batch-not-found"))
        .andExpect(jsonPath("$.instance").value("/__test/not-found"));
  }

  @Test
  void featureForbidden_exposesFeatureKeyInProperties() throws Exception {
    mockMvc
        .perform(get("/__test/feature-forbidden"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FEATURE_FORBIDDEN"))
        .andExpect(jsonPath("$.properties.featureKey").value("module.poultry.broiler"));
  }

  @Test
  void quotaExceeded_returns429WithQuotaContext() throws Exception {
    mockMvc
        .perform(get("/__test/quota-exceeded"))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
        .andExpect(jsonPath("$.properties.quotaKey").value("farms_max"))
        .andExpect(jsonPath("$.properties.current").value(10))
        .andExpect(jsonPath("$.properties.limit").value(5));
  }

  @Test
  void conflict_returns409() throws Exception {
    mockMvc
        .perform(get("/__test/conflict"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
  }

  @Test
  void invalidBody_returns400WithFieldErrors() throws Exception {
    mockMvc
        .perform(
            post("/__test/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.properties.errors[0].field").value("name"));
  }

  @Test
  void accessDenied_returns403() throws Exception {
    mockMvc
        .perform(get("/__test/access-denied"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
        .andExpect(jsonPath("$.title").value("Access Denied"));
  }

  @Test
  void authenticationFailure_returns401() throws Exception {
    mockMvc
        .perform(get("/__test/auth-failed"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
        .andExpect(jsonPath("$.title").value("Authentication Failed"));
  }

  @Test
  void uncaughtException_returns500WithoutLeakingDetails() throws Exception {
    mockMvc
        .perform(get("/__test/boom"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
        .andExpect(jsonPath("$.detail").value("An unexpected error occurred"));
  }

  @RestController
  static class TestController {

    @GetMapping("/__test/not-found")
    public String notFound() {
      throw NotFoundException.of("Batch", 42L);
    }

    @GetMapping("/__test/feature-forbidden")
    public String featureForbidden() {
      throw new FeatureForbiddenException("module.poultry.broiler");
    }

    @GetMapping("/__test/quota-exceeded")
    public String quotaExceeded() {
      throw new QuotaExceededException("farms_max", 10L, 5L);
    }

    @GetMapping("/__test/conflict")
    public String conflict() {
      throw new ConflictException("EMAIL_TAKEN", "Email already registered");
    }

    @PostMapping("/__test/validate")
    public String validate(@Valid @RequestBody TestRequest req) {
      return req.name();
    }

    @GetMapping("/__test/access-denied")
    public String accessDenied() {
      throw new AccessDeniedException("nope");
    }

    @GetMapping("/__test/auth-failed")
    public String authFailed() {
      throw new BadCredentialsException("invalid creds");
    }

    @GetMapping("/__test/boom")
    public String boom() {
      throw new RuntimeException("kaboom");
    }
  }

  record TestRequest(@NotBlank String name) {}
}
