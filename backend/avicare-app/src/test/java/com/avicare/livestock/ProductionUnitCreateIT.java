package com.avicare.livestock;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.Breed;
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
 * HTTP flow for creating a generic production unit (layer/ponte lot) on a real PostgreSQL
 * (Testcontainers, V1–V10): an OWNER creates a unit and reads it back; a FARMER is denied (creation
 * is OWNER/MANAGER only); a non-POULTRY breed is rejected (422). Also checks the breed type is now
 * exposed by the breed reference endpoint. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ProductionUnitCreateIT {

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
  @Autowired private BreedRepository breedRepository;

  @Test
  void ownerCreatesLayerUnit_andReadsItBack() throws Exception {
    signup("owner@unit.io", "password123", "Owner");
    String owner = login("owner@unit.io", "password123");
    long farmId = createFarm(owner, "Ferme Ponte");
    owner = login("owner@unit.io", "password123");

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "isa_brown", null)
            .orElseThrow()
            .getId();

    String base = "/api/v1/farms/" + farmId + "/production-units";

    mockMvc
        .perform(
            post(base)
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Bâtiment B - Lot 12\",\"breedId\":"
                        + breedId
                        + ",\"initialCount\":1250,\"startDate\":\"2026-02-10\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.name").value("Bâtiment B - Lot 12"))
        .andExpect(jsonPath("$.data.species").value("POULTRY"))
        .andExpect(jsonPath("$.data.unitKind").value("BATCH"))
        .andExpect(jsonPath("$.data.currentCount").value(1250))
        .andExpect(jsonPath("$.data.status").value("ACTIVE"));

    mockMvc
        .perform(get(base).header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].name").value("Bâtiment B - Lot 12"));
  }

  @Test
  void farmer_cannotCreateUnit() throws Exception {
    signup("o2@unit.io", "password123", "Owner2");
    String owner = login("o2@unit.io", "password123");
    long farmId = createFarm(owner, "Ferme F");
    owner = login("o2@unit.io", "password123");

    String farmerJson =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/users")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"fullName\":\"Farmer\",\"email\":\"farmer@unit.io\",\"role\":\"FARMER\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String farmerPw =
        objectMapper.readTree(farmerJson).get("data").get("temporaryPassword").asText();
    String farmer = login("farmer@unit.io", farmerPw);

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "isa_brown", null)
            .orElseThrow()
            .getId();

    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/production-units")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"breedId\":"
                        + breedId
                        + ",\"initialCount\":10,\"startDate\":\"2026-02-10\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void nonPoultryBreed_isRejected() throws Exception {
    signup("o3@unit.io", "password123", "Owner3");
    String owner = login("o3@unit.io", "password123");
    long farmId = createFarm(owner, "Ferme O");
    owner = login("o3@unit.io", "password123");

    Breed ovine = new Breed();
    ovine.setSpecies(Species.OVINE);
    ovine.setCode("test_ovine");
    ovine.setName("Test Ovine");
    ovine.setActive(true);
    long ovineId = breedRepository.save(ovine).getId();

    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/production-units")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"breedId\":"
                        + ovineId
                        + ",\"initialCount\":10,\"startDate\":\"2026-02-10\"}"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void breedEndpoint_exposesType() throws Exception {
    signup("o4@unit.io", "password123", "Owner4");
    String owner = login("o4@unit.io", "password123");

    mockMvc
        .perform(get("/api/v1/breeds?species=POULTRY").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.data[?(@.code=='isa_brown')].type")
                .value(org.hamcrest.Matchers.hasItem("layer")))
        .andExpect(
            jsonPath("$.data[?(@.code=='cobb_500')].type")
                .value(org.hamcrest.Matchers.hasItem("broiler")));
  }

  // --- helpers --------------------------------------------------------

  private long createFarm(String access, String name) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + access)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }

  private void signup(String email, String password, String name) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\""
                        + password
                        + "\",\"fullName\":\""
                        + name
                        + "\"}"))
        .andExpect(status().isCreated());
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
