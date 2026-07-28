package com.avicare.livestock;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * End-to-end health module flow over HTTP on a real PostgreSQL (Testcontainers, V1–V14): the
 * basic/advanced module split (treatments 403 until advanced is enabled), the full
 * vaccination/program/observation/treatment/vet/visit flow, the in-app alerts aggregation, and the
 * write-role gate. Gating is FORCED ON so the split is actually exercised. CI-only (Docker).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class HealthFlowIT {

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
    // Force gating ON so the basic/advanced split is actually tested (ADR-004).
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private BreedRepository breedRepository;

  @Test
  void fullHealthFlow_withModuleSplitAndAlerts() throws Exception {
    signup("owner@health.io", "password123", "Owner");
    String owner = login("owner@health.io", "password123");
    long farmId = createFarm(owner, "Ferme Santé");
    owner = login("owner@health.io", "password123");
    enableModule(owner, farmId, "module.health.basic");
    disableModule(owner, farmId, "module.health.advanced");
    long unitId = seedUnit(farmId, "cobb_500", LocalDate.now().minusDays(7));
    String base = "/api/v1/farms/" + farmId + "/health";

    // Catalog: vaccines visible with basic, treatments require advanced.
    mockMvc
        .perform(get(base + "/catalog/vaccines").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(10));
    mockMvc
        .perform(get(base + "/catalog/treatments").header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());

    // Vaccination + program + observation (basic).
    mockMvc
        .perform(
            post(base + "/vaccinations")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"vaccineKey\":\"marek_hvt\",\"administeredDate\":\""
                        + LocalDate.now()
                        + "\",\"subjectsCount\":1000}"))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post(base + "/lots/" + unitId + "/program")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"programKey\":\"broiler_standard_cobb500\"}"))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            get(base + "/lots/" + unitId + "/program/schedule")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(5));
    mockMvc
        .perform(
            post(base + "/observations")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"observationDate\":\""
                        + LocalDate.now()
                        + "\",\"severity\":\"CRITICAL\",\"title\":\"Mortalité aiguë\"}"))
        .andExpect(status().isCreated());

    // Enable advanced → treatments + vet now reachable.
    enableModule(owner, farmId, "module.health.advanced");
    mockMvc
        .perform(get(base + "/catalog/treatments").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(6));

    String vetJson =
        mockMvc
            .perform(
                post(base + "/veterinarians")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"fullName\":\"Dr Ndiaye\",\"speciality\":\"Aviculture\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long vetId = objectMapper.readTree(vetJson).get("data").get("id").asLong();

    mockMvc
        .perform(
            post(base + "/treatments")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"treatmentKey\":\"amoxicillin_50\",\"startDate\":\""
                        + LocalDate.now()
                        + "\",\"durationDays\":3,\"doseAmount\":1.0,\"doseUnit\":\"mg/L\","
                        + "\"route\":\"WATER\",\"subjectsCount\":1000,\"prescribedBy\":\"VETERINARIAN\","
                        + "\"veterinarianId\":"
                        + vetId
                        + "}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.withdrawalEndDateMeat").exists());
    mockMvc
        .perform(
            post(base + "/vet-visits")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"veterinarianId\":"
                        + vetId
                        + ",\"visitDate\":\""
                        + LocalDate.now()
                        + "\",\"reason\":\"Contrôle\","
                        + "\"followUpNeeded\":true,\"followUpDate\":\""
                        + LocalDate.now().plusDays(10)
                        + "\"}"))
        .andExpect(status().isCreated());

    // Alerts aggregate: late vaccinations + active withdrawal + critical obs + follow-up.
    mockMvc
        .perform(get(base + "/alerts").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.activeWithdrawals.length()").value(1))
        .andExpect(jsonPath("$.data.criticalObservations.length()").value(1))
        .andExpect(jsonPath("$.data.upcomingFollowUps.length()").value(1));
  }

  @Test
  void veterinarian_canReadAndWriteHealth_andCrossFarmIsBlocked() throws Exception {
    signup("o2@health.io", "password123", "Owner2");
    String owner = login("o2@health.io", "password123");
    long farmId = createFarm(owner, "Ferme H");
    owner = login("o2@health.io", "password123");
    enableModule(owner, farmId, "module.health.basic");
    long unitId = seedUnit(farmId, "cobb_500", LocalDate.now().minusDays(3));
    String base = "/api/v1/farms/" + farmId + "/health";

    String vetJson =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/users")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"fullName\":\"Vet\",\"email\":\"vet@health.io\",\"role\":\"VETERINARIAN\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String vetPw = objectMapper.readTree(vetJson).get("data").get("temporaryPassword").asText();
    String vet = login("vet@health.io", vetPw);

    // VET reads vaccinations...
    mockMvc
        .perform(
            get(base + "/vaccinations?unitId=" + unitId).header("Authorization", "Bearer " + vet))
        .andExpect(status().isOk());
    // ...and CAN record one: health writes are now gated by the grantable
    // health:write permission, which a VETERINARIAN holds by default (the vet
    // owns the sanitaire work). Same payload the OWNER used above.
    mockMvc
        .perform(
            post(base + "/vaccinations")
                .header("Authorization", "Bearer " + vet)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"unitId\":"
                        + unitId
                        + ",\"vaccineKey\":\"marek_hvt\",\"administeredDate\":\""
                        + LocalDate.now()
                        + "\",\"subjectsCount\":10}"))
        .andExpect(status().isCreated());

    // Cross-farm: another farm's unit is not reachable here (404).
    signup("o3@health.io", "password123", "Owner3");
    String owner3 = login("o3@health.io", "password123");
    long otherFarm = createFarm(owner3, "Autre");
    owner3 = login("o3@health.io", "password123");
    long otherUnit = seedUnit(otherFarm, "cobb_500", LocalDate.now());
    mockMvc
        .perform(
            get(base + "/vaccinations?unitId=" + otherUnit)
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isNotFound());
  }

  /**
   * The generic {@code /catalog/{category}} route reaches the same catalog_items as the gated
   * health endpoints, so it must enforce the SAME {@code module.health.*} gate — otherwise an OWNER
   * without the health module could read/write vaccines and treatments through it, bypassing the
   * gate.
   */
  @Test
  void genericCatalogRoute_cannotBypassHealthModuleGate() throws Exception {
    signup("bypass@health.io", "password123", "Owner");
    String owner = login("bypass@health.io", "password123");
    long farmId = createFarm(owner, "Ferme Bypass");
    owner = login("bypass@health.io", "password123");
    // A fresh farm is auto-provisioned with the V1 modules; turn health OFF to test the gate.
    disableModule(owner, farmId, "module.health.basic");
    disableModule(owner, farmId, "module.health.advanced");
    String catalog = "/api/v1/farms/" + farmId + "/catalog";
    String vaccineBody = "{\"key\":\"vax_custom\",\"value\":{\"label\":\"Vaccin maison\"}}";
    String treatmentBody = "{\"key\":\"trt_custom\",\"value\":{\"label\":\"Traitement maison\"}}";

    // Health categories are gated: without the module, write AND read are forbidden.
    mockMvc
        .perform(
            post(catalog + "/vaccines")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(vaccineBody))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post(catalog + "/treatments")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(treatmentBody))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(get(catalog + "/vaccines").header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());

    // A category with no module requirement is unaffected by the health gate.
    mockMvc
        .perform(
            post(catalog + "/expense_categories")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"key\":\"exp_custom\",\"value\":{\"label\":\"Divers\"}}"))
        .andExpect(status().isCreated());

    // Re-enable the module: the generic route now allows the health category again.
    enableModule(owner, farmId, "module.health.basic");
    mockMvc
        .perform(
            post(catalog + "/vaccines")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(vaccineBody))
        .andExpect(status().isCreated());
  }

  // --- helpers --------------------------------------------------------

  private long seedUnit(long farmId, String breedCode, LocalDate startDate) {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, breedCode, null)
            .orElseThrow()
            .getId();
    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setBreedId(breedId);
    unit.setName("Lot");
    unit.setStartDate(startDate);
    unit.setCurrentCount(1000);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(unit).getId();
  }

  private void enableModule(String access, long farmId, String moduleKey) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/subscription/modules")
                .header("Authorization", "Bearer " + access)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"" + moduleKey + "\",\"mode\":\"HARD\"}"))
        .andExpect(status().isCreated());
  }

  private void disableModule(String access, long farmId, String moduleKey) throws Exception {
    mockMvc
        .perform(
            delete("/api/v1/farms/" + farmId + "/subscription/modules/" + moduleKey)
                .header("Authorization", "Bearer " + access))
        .andExpect(status().isNoContent());
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
