package com.avicare.common.api.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ExceptionHierarchyTest {

  @Test
  void notFoundException_of_buildsCodeAndStatus() {
    NotFoundException ex = NotFoundException.of("Batch", 42L);

    assertThat(ex).isInstanceOf(BusinessException.class);
    assertThat(ex.getCode()).isEqualTo("BATCH_NOT_FOUND");
    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(ex.getMessage()).contains("Batch").contains("42");
    assertThat(ex.getProperties()).isEmpty();
  }

  @Test
  void validationException_withFieldErrors_carriesErrorsInProperties() {
    List<ValidationException.FieldError> fieldErrors =
        List.of(
            new ValidationException.FieldError("name", "NotBlank", "must not be blank"),
            new ValidationException.FieldError("size", "Min", "must be greater than 0"));

    ValidationException ex =
        new ValidationException("VALIDATION_FAILED", "Request validation failed", fieldErrors);

    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(ex.getCode()).isEqualTo("VALIDATION_FAILED");
    assertThat(ex.getProperties()).containsKey("errors");
    assertThat(ex.getProperties().get("errors")).isEqualTo(fieldErrors);
  }

  @Test
  void forbiddenException_accessDenied_buildsCodeAndStatus() {
    ForbiddenException ex = ForbiddenException.accessDenied("batches");

    assertThat(ex.getCode()).isEqualTo("ACCESS_DENIED");
    assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(ex.getMessage()).contains("batches");
  }

  @Test
  void featureForbiddenException_exposesFeatureKey() {
    FeatureForbiddenException ex = new FeatureForbiddenException("module.poultry.broiler");

    assertThat(ex.getCode()).isEqualTo("FEATURE_FORBIDDEN");
    assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(ex.getProperties()).containsEntry("featureKey", "module.poultry.broiler");
  }

  @Test
  void quotaExceededException_exposesQuotaContext() {
    QuotaExceededException ex = new QuotaExceededException("farms_max", 10L, 5L);

    assertThat(ex.getCode()).isEqualTo("QUOTA_EXCEEDED");
    assertThat(ex.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    assertThat(ex.getProperties())
        .containsEntry("quotaKey", "farms_max")
        .containsEntry("current", 10L)
        .containsEntry("limit", 5L);
  }
}
