package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Severity;
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
 * Health executions on a real PostgreSQL (Testcontainers, V1–V13): recording vaccinations
 * (validation, UNIQUE, listing), assigning/removing a program with its schedule status, and health
 * observations. CI-only where Docker is unavailable (no failsafe wiring yet — see project memory).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class HealthExecutionsIT {

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
  @Autowired private VaccinationService vaccinationService;
  @Autowired private VaccinationProgramAssignmentService programService;
  @Autowired private HealthObservationService observationService;

  @Test
  void vaccination_record_validate_unique_list() throws Exception {
    long unitId = seedUnit("cobb_500", LocalDate.now().minusDays(5), 1000);

    vaccinationService.record(unitId, cmd("marek_hvt", LocalDate.now().minusDays(4), 1000), null);
    vaccinationService.record(unitId, cmd("newcastle_la_sota", LocalDate.now(), 1000), null);
    assertThat(vaccinationService.listForUnit(unitId)).hasSize(2);

    // unknown vaccine -> validation
    assertThatThrownBy(
            () -> vaccinationService.record(unitId, cmd("nope", LocalDate.now(), 10), null))
        .isInstanceOf(ValidationException.class);
    // subjects far over current count -> validation
    assertThatThrownBy(
            () -> vaccinationService.record(unitId, cmd("coryza", LocalDate.now(), 5000), null))
        .isInstanceOf(ValidationException.class);
    // duplicate (unit, vaccine, date) -> business rule
    assertThatThrownBy(
            () ->
                vaccinationService.record(
                    unitId, cmd("newcastle_la_sota", LocalDate.now(), 1000), null))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void program_assign_reassign_remove_andScheduleStatus() throws Exception {
    long unitId = seedUnit("cobb_500", LocalDate.now().minusDays(28), 1000);

    programService.assignProgram(unitId, "broiler_standard_cobb500", null);
    programService.assignProgram(unitId, "broiler_standard_cobb500", null); // upsert, still 1
    assertThat(programService.getAssignedProgram(unitId)).isPresent();

    vaccinationService.record(
        unitId, cmd("newcastle_la_sota", LocalDate.now().minusDays(21), 1000), null);
    vaccinationService.record(
        unitId, cmd("gumboro_d78", LocalDate.now().minusDays(14), 1000), null);

    var status = programService.computeScheduleStatus(unitId);
    assertThat(status).hasSize(5);
    assertThat(status)
        .extracting(s -> s.vaccineKey() + ":" + s.status())
        .containsExactly(
            "marek_hvt:LATE",
            "newcastle_la_sota:DONE",
            "gumboro_d78:DONE",
            "newcastle_clone30:LATE",
            "gumboro_228e:UPCOMING");

    programService.removeProgram(unitId, null);
    assertThat(programService.getAssignedProgram(unitId)).isEmpty();
    assertThat(programService.computeScheduleStatus(unitId)).isEmpty();
  }

  @Test
  void observations_record_and_listCritical() throws Exception {
    long unitId = seedUnit("isa_brown", LocalDate.now().minusDays(10), 800);

    observationService.record(unitId, obs(Severity.NORMAL, "RAS"), null);
    observationService.record(unitId, obs(Severity.WARNING, "Plumage anormal"), null);
    observationService.record(unitId, obs(Severity.CRITICAL, "Mortalité aiguë"), null);

    assertThat(observationService.listForUnit(unitId)).hasSize(3);
    assertThat(observationService.listCriticalObservations(unitId))
        .hasSize(2)
        .allMatch(o -> o.getSeverity() != Severity.NORMAL);
  }

  // --- helpers --------------------------------------------------------

  private static VaccinationCommand cmd(String vaccineKey, LocalDate date, int subjects) {
    return new VaccinationCommand(
        vaccineKey, date, "WATER", null, null, subjects, null, null, null, null, null);
  }

  private static HealthObservationCommand obs(Severity severity, String title) {
    return new HealthObservationCommand(LocalDate.now(), severity, title, null, null, null);
  }

  private long seedUnit(String breedCode, LocalDate startDate, int count) throws Exception {
    long farmId = createFarm();
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
    unit.setCurrentCount(count);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(unit).getId();
  }

  private long createFarm() throws Exception {
    String email = "h" + System.nanoTime() + "@health.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"H\"}"))
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
                    .content("{\"name\":\"Ferme Santé\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
