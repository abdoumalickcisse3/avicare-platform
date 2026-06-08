package com.avicare.livestock;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end broiler flow over HTTP on a real PostgreSQL (Testcontainers): enable the {@code
 * module.poultry.broiler} feature, create a batch, record a daily entry and a weighing, then read
 * the computed performance. Also proves the feature gate (403 before the module is enabled) and the
 * write-role gate. CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class PoultryFlowIT {

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
    // Force gating ON so the feature gate is exercised even if a dev exported
    // avicare.features.gating-enabled=false in their environment (ADR-004).
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private BreedRepository breedRepository;

  @Test
  void fullBroilerFlow_overHttp() throws Exception {
    signupAndAccess("owner@poultry.io", "password123", "Owner");
    String owner = login("owner@poultry.io", "password123"); // no membership yet
    long farmId = createFarm(owner, "Ferme Broiler");
    owner = login("owner@poultry.io", "password123"); // now carries OWNER membership

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    String batchBody =
        "{\"breedId\":"
            + breedId
            + ",\"name\":\"Lot A\",\"startDate\":\"2026-05-01\",\"targetWeightG\":2200,"
            + "\"targetAgeDays\":42,\"initialCount\":1000}";

    // Feature gate: poultry endpoints are 403 until the module is enabled.
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/poultry-batches")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(batchBody))
        .andExpect(status().isForbidden());

    enableBroilerModule(owner, farmId);

    long batchId =
        dataId(
            mockMvc
                .perform(
                    post("/api/v1/farms/" + farmId + "/poultry-batches")
                        .header("Authorization", "Bearer " + owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(batchBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.currentCount").value(1000))
                .andReturn()
                .getResponse()
                .getContentAsString());

    String base = "/api/v1/farms/" + farmId + "/poultry-batches/" + batchId;

    mockMvc
        .perform(
            post(base + "/daily-records")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"recordDate\":\"2026-06-01\",\"mortalityCount\":5,\"feedKg\":1500,"
                        + "\"waterL\":3000,\"observations\":\"RAS\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.mortalityCount").value(5));

    mockMvc
        .perform(
            post(base + "/weighings")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"sampleDate\":\"2026-06-05\",\"individualWeights\":[1800,1900,2000,2100,2200]}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.avgWeightG").value(2000.0))
        .andExpect(jsonPath("$.data.uniformityPercent").value(100.0));

    mockMvc
        .perform(get(base + "/performance").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentWeightG").value(2000.0))
        .andExpect(jsonPath("$.data.performanceScore").isNotEmpty());
  }

  @Test
  void veterinarian_cannotCreateBatch_butCanRead() throws Exception {
    signupAndAccess("o2@poultry.io", "password123", "Owner2");
    String owner = login("o2@poultry.io", "password123");
    long farmId = createFarm(owner, "Ferme V");
    owner = login("o2@poultry.io", "password123");
    enableBroilerModule(owner, farmId);

    signupAndAccess("vet@poultry.io", "password123", "Vet");
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"vet@poultry.io\",\"role\":\"VETERINARIAN\"}"))
        .andExpect(status().isCreated());
    String vet = login("vet@poultry.io", "password123");

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    // VET can read the (empty) batch list...
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/poultry-batches")
                .header("Authorization", "Bearer " + vet))
        .andExpect(status().isOk());
    // ...but cannot create one.
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/poultry-batches")
                .header("Authorization", "Bearer " + vet)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"breedId\":" + breedId + ",\"initialCount\":100}"))
        .andExpect(status().isForbidden());
  }

  // --- helpers --------------------------------------------------------

  private void enableBroilerModule(String access, long farmId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/subscription/modules")
                .header("Authorization", "Bearer " + access)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"module.poultry.broiler\",\"mode\":\"HARD\"}"))
        .andExpect(status().isCreated());
  }

  private long createFarm(String access, String name) throws Exception {
    return dataId(
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + access)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private long dataId(String json) throws Exception {
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }

  private String signupAndAccess(String email, String password, String name) throws Exception {
    String body =
        "{\"email\":\""
            + email
            + "\",\"password\":\""
            + password
            + "\",\"fullName\":\""
            + name
            + "\"}";
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private String login(String email, String password) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }
}
