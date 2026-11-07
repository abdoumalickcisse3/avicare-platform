package com.avicare.livestock.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.avicare.support.RsaKeys;
import java.security.KeyPair;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * End-to-end HTTP coverage of {@code POST /api/v1/farms/{farmId}/breeds}: a farmer declaring a
 * breed the catalogue does not have (Goliath, Kuroiler, "locale améliorée"), and the profile's
 * default targets (V69 {@code breed_profiles}) riding on {@code BreedResponse}. Real PostgreSQL
 * (Testcontainers, migrations V1–V69). CI-only — Testcontainers can't run on this dev machine
 * (Docker 29.x incompatibility, see project memory).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class BreedDeclarationIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private JwtService jwtService;

  @Test
  void un_owner_declare_une_souche_et_la_retrouve_dans_la_liste() throws Exception {
    String owner = onboardOwner("decl-owner");
    long farmId = createFarm(owner, "Ferme Déclaration");
    owner = relogin("decl-owner");
    String name = "Goliath Local " + System.nanoTime();

    JsonNode created =
        data(
            postOk(
                "/api/v1/farms/" + farmId + "/breeds",
                owner,
                String.format("{\"name\":\"%s\",\"profile\":\"BROILER_RUSTIC\"}", name)));
    assertThat(created.get("name").asText()).isEqualTo(name);
    assertThat(created.get("species").asText()).isEqualTo("POULTRY");
    assertThat(created.get("type").asText()).isEqualTo("broiler");
    assertThat(created.get("profile").asText()).isEqualTo("BROILER_RUSTIC");
    assertThat(created.get("farmId").asLong()).isEqualTo(farmId);
    assertThat(created.get("active").asBoolean()).isTrue();
    String code = created.get("code").asText();

    JsonNode list = data(getOk("/api/v1/breeds?species=POULTRY", owner));
    assertThat(stream(list))
        .anyMatch(b -> b.get("code").asText().equals(code) && b.get("name").asText().equals(name));
  }

  @Test
  void un_farmer_ne_peut_pas_declarer() throws Exception {
    String owner = onboardOwner("decl-farmer");
    long farmId = createFarm(owner, "Ferme Farmer");

    String farmer =
        jwtService.generateAccessToken(
            new AvicarePrincipal(
                999L,
                "farmer@decl.io",
                UserRole.USER,
                List.of(
                    new Membership(
                        farmId, FarmRole.FARMER, FarmRole.FARMER.defaultPermissions()))));

    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/breeds")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    String.format(
                        "{\"name\":\"%s\",\"profile\":\"BROILER_RUSTIC\"}",
                        "Kuroiler " + System.nanoTime())))
        .andExpect(status().isForbidden());
  }

  @Test
  void la_reponse_porte_les_cibles_du_profil() throws Exception {
    String owner = onboardOwner("decl-targets");
    long farmId = createFarm(owner, "Ferme Cibles");
    owner = relogin("decl-targets");

    JsonNode created =
        data(
            postOk(
                "/api/v1/farms/" + farmId + "/breeds",
                owner,
                String.format(
                    "{\"name\":\"%s\",\"profile\":\"BROILER_RUSTIC\"}",
                    "Sasso Test " + System.nanoTime())));
    assertThat(created.get("defaultTargetWeightG").asInt()).isEqualTo(2000);
    assertThat(created.get("defaultTargetAgeDays").asInt()).isEqualTo(90);
  }

  @Test
  void un_profil_de_ponte_ne_porte_aucune_cible() throws Exception {
    String owner = onboardOwner("decl-layer");
    long farmId = createFarm(owner, "Ferme Ponte");
    owner = relogin("decl-layer");

    JsonNode created =
        data(
            postOk(
                "/api/v1/farms/" + farmId + "/breeds",
                owner,
                String.format(
                    "{\"name\":\"%s\",\"profile\":\"LAYER_RUSTIC\"}",
                    "Locale Ponte Test " + System.nanoTime())));
    assertThat(created.get("defaultTargetWeightG").isNull()).isTrue();
    assertThat(created.get("defaultTargetAgeDays").isNull()).isTrue();
  }

  /**
   * {@code BreedWriteService.declare} throws {@code ValidationException("BREED_NAME_EMPTY", ...)}
   * when the name slugifies to an empty code (e.g. punctuation only). {@code ValidationException}
   * is mapped to HTTP 400 (bad request), not 422 — {@link
   * com.avicare.common.api.exception.ValidationException} is fixed to {@code
   * HttpStatus.BAD_REQUEST} in its own constructor; see the class javadoc for the 400 vs 422 split
   * it documents.
   */
  @Test
  void un_nom_vide_apres_slug_repond_400() throws Exception {
    String owner = onboardOwner("decl-empty");
    long farmId = createFarm(owner, "Ferme Nom Vide");
    owner = relogin("decl-empty");

    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/breeds")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"!!!\",\"profile\":\"BROILER_RUSTIC\"}"))
        .andExpect(status().isBadRequest());
  }

  // --- helpers --------------------------------------------------------

  private JsonNode data(JsonNode response) {
    return response.get("data");
  }

  private static Stream<JsonNode> stream(JsonNode array) {
    return StreamSupport.stream(array.spliterator(), false);
  }

  private JsonNode getOk(String url, String token) throws Exception {
    return read(
        mockMvc
            .perform(get(url).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()));
  }

  private JsonNode postOk(String url, String token, String body) throws Exception {
    return read(
        mockMvc
            .perform(
                post(url)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().is2xxSuccessful()));
  }

  private JsonNode read(ResultActions actions) throws Exception {
    return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  private String onboardOwner(String slug) throws Exception {
    String email = slug + "@decl.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"Owner\",\"phone\":\""
                        + nextTestPhone()
                        + "\"}"))
        .andExpect(status().isCreated());
    return relogin(slug);
  }

  private String relogin(String slug) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + slug + "@decl.io\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private long createFarm(String token, String name) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }

  /**
   * A distinct number per CALL. Required since 2026-10-09, unique since V64 — a helper invoked more
   * than once with one hard-coded number creates the first account and gets 409 on the second.
   */
  private static final AtomicInteger PHONE_SEQ = new AtomicInteger();

  private static String nextTestPhone() {
    return String.format("+2217%08d", PHONE_SEQ.incrementAndGet());
  }
}
