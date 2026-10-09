package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.support.RsaKeys;
import java.security.KeyPair;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

/**
 * A member of farm A must never reach a batch of farm B by passing B's batch id under A's farm id:
 * the {@code @PreAuthorize} only proves membership of the farm in the path, so every endpoint that
 * takes a unit/batch id has to check the unit really belongs to that farm. CI-only on dev machines.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class CrossFarmAccessIT {

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
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private BreedRepository breedRepository;

  @Test
  void aBatchOfAnotherFarmIsNotReachableUnderMyFarmId() throws Exception {
    signup("victim@farm-b.io");
    String victimToken = login("victim@farm-b.io");
    long farmB = createFarm(victimToken, "Ferme B");
    victimToken = login("victim@farm-b.io");
    long batchB = createBatch(victimToken, farmB);

    signup("attacker@farm-a.io");
    String attackerToken = login("attacker@farm-a.io");
    long farmA = createFarm(attackerToken, "Ferme A");
    attackerToken = login("attacker@farm-a.io");

    String units = "/api/v1/farms/" + farmA + "/production-units/" + batchB;
    String batches = "/api/v1/farms/" + farmA + "/poultry-batches/" + batchB;

    expectNotFound(get(units), attackerToken);
    expectNotFound(get(units + "/events"), attackerToken);
    expectNotFound(
        post(units + "/events").content("{\"eventType\":\"NOTE\",\"quantityDelta\":-1}"),
        attackerToken);
    expectNotFound(
        post(units + "/mortality").content("{\"count\":1,\"reason\":\"test\"}"), attackerToken);
    expectNotFound(get(batches), attackerToken);
    expectNotFound(get(batches + "/daily-records"), attackerToken);
    expectNotFound(
        post(batches + "/daily-records")
            .content("{\"recordDate\":\"2026-06-01\",\"mortalityCount\":5,\"feedKg\":10}"),
        attackerToken);
    expectNotFound(get(batches + "/weighings"), attackerToken);
    expectNotFound(
        post(batches + "/weighings")
            .content("{\"sampleDate\":\"2026-06-05\",\"individualWeights\":[1800]}"),
        attackerToken);
    expectNotFound(get(batches + "/performance"), attackerToken);

    // The owner of farm B still reaches its own batch through the same routes.
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmB + "/poultry-batches/" + batchB)
                .header("Authorization", "Bearer " + victimToken))
        .andExpect(status().isOk());
  }

  @Test
  void anotherFarmsCustomBreedAndUnitAreNotLeakedNorUsable() throws Exception {
    signup("victim2@farm-b.io");
    String victimToken = login("victim2@farm-b.io");
    long farmB = createFarm(victimToken, "Ferme B2");
    victimToken = login("victim2@farm-b.io");
    long batchB = createBatch(victimToken, farmB);

    Breed secret = new Breed();
    secret.setSpecies(Species.POULTRY);
    secret.setCode("secret_strain_b");
    secret.setName("Souche secrète B");
    secret.setFarmId(farmB);
    breedRepository.save(secret);

    signup("attacker2@farm-a.io");
    String attackerToken = login("attacker2@farm-a.io");
    long farmA = createFarm(attackerToken, "Ferme A2");
    attackerToken = login("attacker2@farm-a.io");

    String attackerView =
        mockMvc
            .perform(
                get("/api/v1/breeds?species=POULTRY")
                    .header("Authorization", "Bearer " + attackerToken))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(attackerView).contains("cobb_500").doesNotContain("secret_strain_b");

    String victimView =
        mockMvc
            .perform(
                get("/api/v1/breeds?species=POULTRY")
                    .header("Authorization", "Bearer " + victimToken))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(victimView).contains("secret_strain_b");

    String expense =
        "{\"categoryKey\":\"feed\",\"amountXof\":1000,\"expenseDate\":\"2026-06-01\","
            + "\"label\":\"x\",\"productionUnitId\":"
            + batchB
            + "}";
    expectNotFound(
        post("/api/v1/farms/" + farmA + "/finance/expenses").content(expense), attackerToken);
  }

  private void expectNotFound(
      org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
      String token)
      throws Exception {
    mockMvc
        .perform(
            request
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isNotFound());
  }

  private long createBatch(String token, long farmId) throws Exception {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    String body =
        "{\"breedId\":"
            + breedId
            + ",\"name\":\"Lot B\",\"startDate\":\"2026-05-01\",\"targetWeightG\":2200,"
            + "\"targetAgeDays\":42,\"initialCount\":1000}";
    return dataId(
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/poultry-batches")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private long createFarm(String token, String name) throws Exception {
    return dataId(
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
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

  private void signup(String email) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"Test\",\"phone\":\""
                        + nextTestPhone()
                        + "\"}"))
        .andExpect(status().isCreated());
  }

  private String login(String email) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  /**
   * A distinct number per CALL. Required since 2026-10-09, unique since V64 — a helper invoked
   * three times with one hard-coded number creates the first account and gets 409 on the second,
   * which is exactly what a literal did here before.
   */
  private static final java.util.concurrent.atomic.AtomicInteger PHONE_SEQ =
      new java.util.concurrent.atomic.AtomicInteger();

  private static String nextTestPhone() {
    return String.format("+2217%08d", PHONE_SEQ.incrementAndGet());
  }
}
