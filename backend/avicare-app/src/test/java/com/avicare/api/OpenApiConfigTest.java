package com.avicare.api;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Without a declared scheme the console lists the API and can exercise almost none of it: no
 * padlocks, no <i>Authorize</i> button, and every protected call answers 401 with no way to say who
 * you are. That makes the page look broken rather than locked, which is how people conclude the API
 * itself is broken.
 */
class OpenApiConfigTest {

  private final OpenAPI api = new OpenApiConfig().jawdiOpenApi();

  @Test
  @DisplayName("the contract offers a bearer JWT scheme, so the console can sign in")
  void declaresTheBearerScheme() {
    SecurityScheme scheme =
        api.getComponents().getSecuritySchemes().get(OpenApiConfig.BEARER_SCHEME);

    assertThat(scheme).isNotNull();
    assertThat(scheme.getType()).isEqualTo(SecurityScheme.Type.HTTP);
    assertThat(scheme.getScheme()).isEqualTo("bearer");
    assertThat(scheme.getBearerFormat()).isEqualTo("JWT");
  }

  @Test
  @DisplayName("the scheme is required globally, so a route is documented as protected by default")
  void requiresItEverywhere() {
    // The few open routes (login, the public survey) then carry a padlock they do not need. That
    // is the cheap error; the expensive one is a protected route documented as open.
    assertThat(api.getSecurity())
        .singleElement()
        .satisfies(req -> assertThat(req).containsKey(OpenApiConfig.BEARER_SCHEME));
  }

  @Test
  @DisplayName("the page says where its calls land")
  void warnsThatTryItOutWrites() {
    assertThat(api.getInfo().getTitle()).isEqualTo("Jawdi API");
    assertThat(api.getInfo().getDescription())
        .as("a console that writes to production must say so on its own front page")
        .contains("Authorize")
        .contains("production");
  }
}
