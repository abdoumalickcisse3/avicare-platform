package com.avicare.livestock;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.LocalDate;
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
 * End-to-end poultry layer flow over HTTP on a real PostgreSQL (Testcontainers, V1–V9): enable the
 * {@code module.poultry.layer} feature, record egg collections across time-slots, close the day,
 * read the aggregate and the tray stock. Also proves the feature gate (403 before activation) and
 * the write-role gate (a veterinarian reads but cannot record). CI-only on dev machines where
 * Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class LayerFlowIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();
  private static final LocalDate DAY = LocalDate.of(2026, 6, 7);

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
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private BreedRepository breedRepository;

  @Test
  void fullLayerFlow_overHttp() throws Exception {
    signupAndAccess("owner@layer.io", "password123", "Owner");
    String owner = login("owner@layer.io", "password123");
    long farmId = createFarm(owner, "Ferme Ponte");
    owner = login("owner@layer.io", "password123"); // now carries OWNER membership

    String base = "/api/v1/farms/" + farmId + "/egg-production";

    // Feature gate denies before the module is enabled.
    mockMvc
        .perform(get(base + "/tray-stock").header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());

    enableLayerModule(owner, farmId);

    long unitId = seedLayerUnit(farmId, 1000);

    // Record three time-slot collections.
    recordCollection(owner, farmId, unitId, "morning", 400, 5);
    recordCollection(owner, farmId, unitId, "noon", 250, 3);
    recordCollection(owner, farmId, unitId, "evening", 150, 2);

    mockMvc
        .perform(
            get(base + "/collections?unitId=" + unitId).header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(3));

    // Close the day and check the aggregate (800 / 1000 layers).
    mockMvc
        .perform(
            post(base + "/daily-production/" + unitId + "/close?date=" + DAY)
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalEggsCollected").value(800))
        .andExpect(jsonPath("$.data.totalBrokenEggs").value(10))
        .andExpect(jsonPath("$.data.activeLayersCount").value(1000))
        .andExpect(jsonPath("$.data.layingRatePct").value(80.0));

    mockMvc
        .perform(
            get(base + "/daily-production/" + unitId + "/" + DAY)
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalEggsCollected").value(800));

    // Tray stock: auto-credited on production close, then an adjustment moves it further.
    // egg tray stock auto-credited on production close: floor((collected-broken)/30) (P1.3)
    // floor((800-10)/30) = floor(790/30) = 26 full trays.
    mockMvc
        .perform(get(base + "/tray-stock").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.fullTraysCount").value(26))
        .andExpect(jsonPath("$.data.emptyTraysCount").value(0));

    mockMvc
        .perform(
            post(base + "/tray-stock/adjust")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullDelta\":50,\"emptyDelta\":20}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.fullTraysCount").value(76)) // 26 (auto-credited) + 50 delta
        .andExpect(jsonPath("$.data.emptyTraysCount").value(20));

    mockMvc
        .perform(
            put(base + "/tray-stock")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullTraysCount\":12,\"emptyTraysCount\":3}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.fullTraysCount").value(12));
  }

  @Test
  void veterinarian_cannotRecordCollection_butCanRead() throws Exception {
    signupAndAccess("o2@layer.io", "password123", "Owner2");
    String owner = login("o2@layer.io", "password123");
    long farmId = createFarm(owner, "Ferme V");
    owner = login("o2@layer.io", "password123");
    enableLayerModule(owner, farmId);
    long unitId = seedLayerUnit(farmId, 500);

    signupAndAccess("vet@layer.io", "password123", "Vet");
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"vet@layer.io\",\"role\":\"VETERINARIAN\"}"))
        .andExpect(status().isCreated());
    String vet = login("vet@layer.io", "password123");

    String base = "/api/v1/farms/" + farmId + "/egg-production";

    // VET can read collections...
    mockMvc
        .perform(
            get(base + "/collections?unitId=" + unitId).header("Authorization", "Bearer " + vet))
        .andExpect(status().isOk());
    // ...but cannot record one.
    mockMvc
        .perform(
            post(base + "/collections")
                .header("Authorization", "Bearer " + vet)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"collectionDate\":\""
                        + DAY
                        + "\",\"timeslotKey\":\"morning\",\"totalEggs\":100,\"brokenEggs\":0}"))
        .andExpect(status().isForbidden());
  }

  // --- helpers --------------------------------------------------------

  private void recordCollection(
      String access, long farmId, long unitId, String slot, int total, int broken)
      throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/egg-production/collections")
                .header("Authorization", "Bearer " + access)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"collectionDate\":\""
                        + DAY
                        + "\",\"timeslotKey\":\""
                        + slot
                        + "\",\"totalEggs\":"
                        + total
                        + ",\"brokenEggs\":"
                        + broken
                        + ",\"gradesCount\":{\"M\":"
                        + total
                        + "}}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.timeslotKey").value(slot));
  }

  private long seedLayerUnit(long farmId, int count) {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "isa_brown", null)
            .orElseThrow()
            .getId();
    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setBreedId(breedId);
    unit.setName("Pondeuses");
    unit.setStartDate(DAY);
    unit.setCurrentCount(count);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(unit).getId();
  }

  private void enableLayerModule(String access, long farmId) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/subscription/modules")
                .header("Authorization", "Bearer " + access)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"module.poultry.layer\",\"mode\":\"HARD\"}"))
        .andExpect(status().isCreated());
  }

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
