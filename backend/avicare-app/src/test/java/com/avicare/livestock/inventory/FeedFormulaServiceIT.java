package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.FeedFormula;
import com.avicare.livestock.domain.FeedPhase;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.util.List;
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
 * Feed formulas on a real PostgreSQL (Testcontainers, V1–V18): platform templates with live cost,
 * create-from-scratch validation + cost, cloning with source traceability, cost re-computation, and
 * soft delete. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class FeedFormulaServiceIT {

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
  @Autowired private FeedFormulaService feedFormulaService;

  @Test
  void platformFormulas_listedWithComputedCost() {
    List<PlatformFormulaDto> platform = feedFormulaService.listPlatformFormulas();
    assertThat(platform).hasSize(6);
    // Cobb 500 starter: corn 55*300 + protein 30*700 + starter 15*500 = 45000
    assertThat(platform)
        .anySatisfy(
            p -> {
              assertThat(p.key()).isEqualTo("formula_broiler_starter_cobb500");
              assertThat(p.targetPhase()).isEqualTo("STARTER");
              assertThat(p.ingredients()).hasSize(3);
              assertThat(p.estimatedCostPer100kgXof()).isEqualTo(45000);
            });
  }

  @Test
  void createFromScratch_computesTotalAndCost_andValidates() throws Exception {
    long farmId = createFarm();

    FeedFormula formula =
        feedFormulaService.createFromScratch(
            farmId,
            command(
                "Ma démarrage",
                FeedPhase.STARTER,
                List.of(
                    ingredient("corn_crushed", "55"),
                    ingredient("protein_concentrate", "30"),
                    ingredient("feed_starter_broiler", "15"))),
            1L);
    assertThat(formula.getTotalPercentage()).isEqualByComparingTo("100");
    assertThat(formula.getEstimatedCostPer100kgXof()).isEqualTo(45000);
    assertThat(formula.getEstimatedCostCalculatedAt()).isNotNull();

    // unknown article → 404
    assertThatThrownBy(
            () ->
                feedFormulaService.createFromScratch(
                    farmId,
                    command("Bad", FeedPhase.STARTER, List.of(ingredient("nope", "100"))),
                    1L))
        .isInstanceOf(NotFoundException.class);

    // percentage > 100 on a line → 400
    assertThatThrownBy(
            () ->
                feedFormulaService.createFromScratch(
                    farmId,
                    command("Bad", FeedPhase.STARTER, List.of(ingredient("corn_crushed", "150"))),
                    1L))
        .isInstanceOf(ValidationException.class);

    // TREATMENT ingredient rejected in V1
    assertThatThrownBy(
            () ->
                feedFormulaService.createFromScratch(
                    farmId,
                    command(
                        "Bad",
                        FeedPhase.STARTER,
                        List.of(
                            new FormulaIngredient(
                                "amoxicillin_50", ArticleSource.TREATMENT, new BigDecimal("100")))),
                    1L))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void createFromScratch_totalNot100_savesWithWarning() throws Exception {
    long farmId = createFarm();
    FeedFormula formula =
        feedFormulaService.createFromScratch(
            farmId,
            command(
                "Partielle",
                FeedPhase.GROWER,
                List.of(ingredient("corn_crushed", "55"), ingredient("protein_concentrate", "40"))),
            1L);
    assertThat(formula.getTotalPercentage()).isEqualByComparingTo("95");
    assertThat(formula.getId()).isNotNull(); // saved despite != 100
  }

  @Test
  void cloneFromPlatform_copiesAndTracesSource() throws Exception {
    long farmId = createFarm();
    FeedFormula clone =
        feedFormulaService.cloneFromPlatform(farmId, "formula_broiler_starter_cobb500", null, 1L);
    assertThat(clone.getSourceFormulaKey()).isEqualTo("formula_broiler_starter_cobb500");
    assertThat(clone.getName()).startsWith("Clone de");
    assertThat(clone.getIngredients()).hasSize(3);
    assertThat(clone.getTargetPhase()).isEqualTo(FeedPhase.STARTER);
    assertThat(clone.getTargetBreedKeys()).containsExactly("cobb_500");
    assertThat(clone.getEstimatedCostPer100kgXof()).isEqualTo(45000);

    assertThatThrownBy(() -> feedFormulaService.cloneFromPlatform(farmId, "nope", null, 1L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void update_recompute_deactivate_andListAvailable() throws Exception {
    long farmId = createFarm();
    FeedFormula formula =
        feedFormulaService.createFromScratch(
            farmId,
            command("V1", FeedPhase.FINISHER, List.of(ingredient("corn_crushed", "100"))),
            1L);
    assertThat(formula.getEstimatedCostPer100kgXof()).isEqualTo(30000); // 100 * 300

    feedFormulaService.update(
        farmId,
        formula.getId(),
        command(
            "V2",
            FeedPhase.FINISHER,
            List.of(ingredient("corn_crushed", "50"), ingredient("protein_concentrate", "50"))),
        1L);
    FeedFormula updated = feedFormulaService.get(farmId, formula.getId());
    assertThat(updated.getName()).isEqualTo("V2");
    assertThat(updated.getEstimatedCostPer100kgXof()).isEqualTo(50000); // 50*300 + 50*700

    feedFormulaService.recomputeCost(farmId, formula.getId(), 1L);

    // listAllAvailable union
    AvailableFormulasResponse available = feedFormulaService.listAllAvailable(farmId);
    assertThat(available.platformFormulas()).hasSize(6);
    assertThat(available.farmFormulas()).hasSize(1);

    feedFormulaService.deactivate(farmId, formula.getId(), 1L);
    assertThat(feedFormulaService.listFarmFormulas(farmId)).isEmpty();
  }

  // --- helpers --------------------------------------------------------

  private static FormulaIngredient ingredient(String key, String pct) {
    return new FormulaIngredient(key, ArticleSource.INVENTORY, new BigDecimal(pct));
  }

  private static FeedFormulaCommand command(
      String name, FeedPhase phase, List<FormulaIngredient> ingredients) {
    return new FeedFormulaCommand(name, null, List.of("cobb_500"), phase, 1, 14, ingredients, null);
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@ff.io";
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
                    .content("{\"name\":\"Ferme FF\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
