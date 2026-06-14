package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.domain.Veterinarian;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
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
 * Treatments, veterinarian directory and vet visits on a real PostgreSQL (Testcontainers, V1–V14):
 * per-farm vet CRUD with tenant isolation, treatment recording with withdrawal snapshot/dates, and
 * vet visits with follow-ups. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class HealthTreatmentsVetIT {

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
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private BreedRepository breedRepository;
  @Autowired private VeterinarianService veterinarianService;
  @Autowired private TreatmentExecutedService treatmentService;
  @Autowired private VetVisitService vetVisitService;

  @Test
  void veterinarianDirectory_crudAndTenantIsolation() throws Exception {
    long farmA = createFarm();
    Veterinarian vet =
        veterinarianService.create(
            farmA,
            new VeterinarianCommand("Dr Ndiaye", "770000000", null, "Aviculture", null, null, null),
            null);
    assertThat(veterinarianService.listForFarm(farmA)).hasSize(1);

    veterinarianService.update(
        farmA,
        vet.getId(),
        new VeterinarianCommand("Dr Ndiaye", "771111111", null, "Aviculture", null, null, null),
        null);

    // A vet of farm B's unit cannot reference farm A's vet.
    long farmB = createFarm();
    long unitB = seedUnit(farmB);
    assertThatThrownBy(
            () ->
                treatmentService.record(
                    unitB,
                    new TreatmentCommand(
                        "amoxicillin_50",
                        LocalDate.now(),
                        3,
                        BigDecimal.ONE,
                        "mg/L",
                        "WATER",
                        100,
                        null,
                        "VETERINARIAN",
                        vet.getId(),
                        null,
                        null,
                        null),
                    null))
        .isInstanceOf(ValidationException.class);

    veterinarianService.deactivate(farmA, vet.getId(), null);
    assertThat(veterinarianService.listForFarm(farmA)).isEmpty();
  }

  @Test
  void treatment_recordWithdrawalSnapshot_andActiveWithdrawals() throws Exception {
    long unitId = seedUnit(createFarm());

    var t =
        treatmentService.record(
            unitId,
            new TreatmentCommand(
                "amoxicillin_50",
                LocalDate.now(),
                3,
                BigDecimal.valueOf(1.5),
                "mg/L",
                "WATER",
                1000,
                "Forte mortalité",
                "FARMER",
                null,
                null,
                null,
                null),
            null);

    assertThat(t.getEndDate()).isEqualTo(LocalDate.now().plusDays(2));
    assertThat(t.getWithdrawalDaysMeat()).isEqualTo(7);
    assertThat(t.getWithdrawalEndDateMeat()).isEqualTo(LocalDate.now().plusDays(9));
    assertThat(treatmentService.getActiveWithdrawals(unitId, LocalDate.now())).hasSize(1);

    assertThatThrownBy(
            () ->
                treatmentService.record(
                    unitId,
                    new TreatmentCommand(
                        "nope",
                        LocalDate.now(),
                        1,
                        BigDecimal.ONE,
                        "mg/L",
                        "WATER",
                        10,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null),
                    null))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void vetVisit_anonymous_followUp_andValidation() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);
    Veterinarian vet =
        veterinarianService.create(
            farmId, new VeterinarianCommand("Dr Sow", null, null, null, null, null, null), null);

    // anonymous visit
    vetVisitService.record(
        unitId,
        new VetVisitCommand(null, LocalDate.now(), "Contrôle", null, null, null, false, null, null),
        null);
    // visit with vet + follow-up in 10 days
    vetVisitService.record(
        unitId,
        new VetVisitCommand(
            vet.getId(),
            LocalDate.now(),
            "Suivi",
            "RAS",
            "Revenir",
            15000,
            true,
            LocalDate.now().plusDays(10),
            null),
        null);

    assertThat(vetVisitService.listForUnit(unitId)).hasSize(2);
    assertThat(vetVisitService.listUpcomingFollowUps(farmId, 30)).hasSize(1);

    // follow-up date before visit date -> validation
    assertThatThrownBy(
            () ->
                vetVisitService.record(
                    unitId,
                    new VetVisitCommand(
                        null,
                        LocalDate.now(),
                        "Bad",
                        null,
                        null,
                        null,
                        true,
                        LocalDate.now().minusDays(1),
                        null),
                    null))
        .isInstanceOf(ValidationException.class);
  }

  // --- helpers --------------------------------------------------------

  private long seedUnit(long farmId) {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setBreedId(breedId);
    unit.setName("Lot");
    unit.setStartDate(LocalDate.now().minusDays(10));
    unit.setCurrentCount(1000);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(unit).getId();
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@vet.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"T\"}"))
        .andExpect(status().isCreated());
    String token =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("accessToken")
            .asText();
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Vet\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
