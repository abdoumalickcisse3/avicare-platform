package com.avicare.api;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The published API contract, and the one thing that makes it usable: a way to sign in.
 *
 * <p>Without a declared security scheme springdoc renders every route without a padlock and offers
 * no <i>Authorize</i> button, so the page lists the API but can only exercise the handful of
 * endpoints that need no token — which is the part nobody needs a console for.
 *
 * <p>The scheme is declared once and required globally. A few routes are in fact open ({@code
 * /auth/login}, {@code /public/survey}, the health probes), so their padlock overstates the rule;
 * that is the cheap error. The expensive one is the opposite — a reader who concludes an endpoint
 * is public because the contract forgot to say otherwise.
 *
 * <p><b>Where this is reachable is decided outside this class.</b> In production the contract and
 * the console are served only on the back-office host and only behind the reverse proxy's own
 * password (see {@code infra/Caddyfile}); {@code SwaggerIsLockedInProductionTest} is what keeps
 * those two facts from drifting apart.
 */
@Configuration
public class OpenApiConfig {

  /** The name the UI shows in its Authorize dialog; referenced by the global requirement below. */
  static final String BEARER_SCHEME = "bearer-jwt";

  @Bean
  public OpenAPI jawdiOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("Jawdi API")
                .version("v1")
                .description(
                    """
                    API de la plateforme Jawdi (gestion d'élevage avicole).

                    Pour essayer un endpoint protégé : appelez d'abord POST /api/v1/auth/login, \
                    copiez le champ `accessToken` de la réponse, puis cliquez sur Authorize \
                    et collez-le — sans écrire « Bearer », le préfixe est ajouté pour vous.

                    Les appels partent sur la base de données de l'environnement affiché \
                    dans l'URL : en production, « Try it out » écrit pour de vrai."""))
        .components(
            new Components()
                .addSecuritySchemes(
                    BEARER_SCHEME,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Le jeton d'accès rendu par /api/v1/auth/login, collé seul.")))
        .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
  }
}
