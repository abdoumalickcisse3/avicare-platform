package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.Supplier;
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
 * Inventory first slice on a real PostgreSQL (Testcontainers, V1–V15): unified cross-context
 * catalog (inventory_items ∪ treatments), per-farm stock with catalog snapshot + low-stock filter +
 * soft delete, and per-farm supplier directory with tenant isolation. CI-only where Docker is
 * unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class InventoryFlowIT {

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
  @Autowired private InventoryCatalogService inventoryCatalogService;
  @Autowired private StockItemService stockItemService;
  @Autowired private SupplierService supplierService;

  @Test
  void catalog_unifiesInventoryItemsAndMedications() {
    List<InventoryCatalogItemDto> inventory = inventoryCatalogService.listInventoryArticles(1L);
    List<InventoryCatalogItemDto> medications = inventoryCatalogService.listMedicationArticles(1L);

    assertThat(inventory).hasSize(17);
    assertThat(inventory).allMatch(a -> a.articleSource() == ArticleSource.INVENTORY);
    assertThat(inventory)
        .anySatisfy(
            a -> {
              assertThat(a.articleKey()).isEqualTo("feed_layer");
              assertThat(a.subcategory()).isEqualTo("FEED");
              assertThat(a.unit()).isEqualTo("kg");
              assertThat(a.typicalUnitPriceXof()).isEqualTo(440);
            });

    assertThat(medications).hasSize(6);
    assertThat(medications)
        .allMatch(
            m ->
                m.articleSource() == ArticleSource.TREATMENT
                    && "MEDICATION".equals(m.subcategory())
                    && m.unit() == null
                    && m.typicalUnitPriceXof() == null);

    assertThat(inventoryCatalogService.listAllAvailableArticles(1L)).hasSize(23);
  }

  @Test
  void stock_createOrGetSnapshot_idempotent_andTreatmentSource() throws Exception {
    long farmId = createFarm();

    StockItem feed =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);
    assertThat(feed.getCurrentQuantity()).isEqualByComparingTo(BigDecimal.ZERO);
    assertThat(feed.getUnit()).isEqualTo("kg");
    assertThat(feed.getTypicalUnitPriceXof()).isEqualTo(440);

    // idempotent: second call returns the same row, not a duplicate.
    StockItem again =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);
    assertThat(again.getId()).isEqualTo(feed.getId());
    assertThat(stockItemService.listForFarm(farmId)).hasSize(1);

    // TREATMENT source resolves the health catalog; no unit/price there.
    StockItem med =
        stockItemService.createOrGet(farmId, ArticleSource.TREATMENT, "amoxicillin_50", 1L);
    assertThat(med.getArticleSource()).isEqualTo(ArticleSource.TREATMENT);
    assertThat(med.getUnit()).isNull();
    assertThat(med.getTypicalUnitPriceXof()).isNull();

    // unknown article -> 404
    assertThatThrownBy(
            () -> stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "nope", 1L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void stock_lowStockFilter_andSoftDelete() throws Exception {
    long farmId = createFarm();
    StockItem feed =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);
    StockItem corn =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "corn_crushed", 1L);

    // feed: threshold 10, quantity stays 0 -> low. corn: no threshold -> never low.
    stockItemService.updateThreshold(farmId, feed.getId(), BigDecimal.valueOf(10), 1L);
    assertThat(stockItemService.listLowStock(farmId)).hasSize(1);
    assertThat(stockItemService.listLowStock(farmId).get(0).getArticleKey())
        .isEqualTo("feed_layer");

    // soft delete removes from the active list.
    stockItemService.deactivate(farmId, corn.getId(), 1L);
    assertThat(stockItemService.listForFarm(farmId)).hasSize(1);
  }

  @Test
  void supplier_crud_jsonbTypes_andTenantIsolation() throws Exception {
    long farmA = createFarm();
    Supplier s =
        supplierService.create(
            farmA,
            new SupplierCommand(
                "SENAVICOLE",
                "M. Diop",
                "770000000",
                "contact@senavicole.sn",
                "Km 5",
                "Dakar",
                List.of("FEED", "MIXED"),
                "CREDIT_30D",
                null),
            1L);
    assertThat(s.getTypes()).containsExactly("FEED", "MIXED");
    assertThat(supplierService.listForFarm(farmA)).hasSize(1);
    // JSONB round-trips through a reload.
    assertThat(supplierService.get(farmA, s.getId()).getTypes()).containsExactly("FEED", "MIXED");

    supplierService.update(
        farmA,
        s.getId(),
        new SupplierCommand(
            "SENAVICOLE SARL",
            "M. Diop",
            "771111111",
            null,
            null,
            "Dakar",
            List.of("FEED"),
            "CASH",
            "updated"),
        1L);
    assertThat(supplierService.get(farmA, s.getId()).getCommercialName())
        .isEqualTo("SENAVICOLE SARL");
    assertThat(supplierService.get(farmA, s.getId()).getTypes()).containsExactly("FEED");

    // tenant isolation: farm B cannot reach farm A's supplier.
    long farmB = createFarm();
    assertThatThrownBy(() -> supplierService.get(farmB, s.getId()))
        .isInstanceOf(NotFoundException.class);

    // soft delete hides it from the active directory.
    supplierService.deactivate(farmA, s.getId(), 1L);
    assertThat(supplierService.listForFarm(farmA)).isEmpty();
  }

  // --- helpers --------------------------------------------------------

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@inv.io";
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
                    .content("{\"name\":\"Ferme Inv\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
