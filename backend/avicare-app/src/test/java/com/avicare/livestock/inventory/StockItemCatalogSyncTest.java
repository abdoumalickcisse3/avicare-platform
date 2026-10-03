package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.repository.StockItemRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Unit test: the farm's configured articles must show up in the stock overview. An article
 * configured at onboarding only lands in the catalog ({@code inventory_items}); until it is
 * received or consumed it has no {@code stock_items} row, so the overview was empty right after
 * signup. The sync materializes those rows at quantity 0 — without ever touching a row that already
 * exists.
 */
class StockItemCatalogSyncTest {

  private static final Long FARM = 7L;
  private static final Long USER = 3L;

  private StockItemRepository stockItemRepository;
  private InventoryCatalogService inventoryCatalogService;
  private StockItemService service;

  @BeforeEach
  void setUp() {
    stockItemRepository = Mockito.mock(StockItemRepository.class);
    inventoryCatalogService = Mockito.mock(InventoryCatalogService.class);
    service = new StockItemService(stockItemRepository, inventoryCatalogService);
  }

  private static InventoryCatalogItemDto article(
      String key, String label, String unit, Integer price) {
    return new InventoryCatalogItemDto(
        key, ArticleSource.INVENTORY, label, "FEED", unit, price, false);
  }

  private static StockItem row(String key, ArticleSource source, boolean active) {
    StockItem s = new StockItem();
    s.setFarmId(FARM);
    s.setArticleSource(source);
    s.setArticleKey(key);
    s.setCurrentQuantity(new BigDecimal("12.000"));
    s.setActive(active);
    return s;
  }

  @Test
  void syncCatalogArticles_materializesEachConfiguredArticle_atZero() {
    when(stockItemRepository.findByFarmIdOrderById(FARM)).thenReturn(List.of());
    when(inventoryCatalogService.listInventoryArticles(FARM))
        .thenReturn(
            List.of(
                article("feed_starter_broiler", "Démarrage poulet chair", "kg", 500),
                article("mais_concasse", "Maïs concassé", "sac", null)));

    service.syncCatalogArticles(FARM, USER);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Iterable<StockItem>> saved = ArgumentCaptor.forClass(Iterable.class);
    verify(stockItemRepository).saveAll(saved.capture());
    assertThat(saved.getValue())
        .extracting(
            StockItem::getArticleKey,
            StockItem::getArticleSource,
            StockItem::getCurrentQuantity,
            StockItem::getUnit,
            StockItem::getTypicalUnitPriceXof,
            StockItem::getCreatedBy)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(
                "feed_starter_broiler", ArticleSource.INVENTORY, BigDecimal.ZERO, "kg", 500, USER),
            org.assertj.core.groups.Tuple.tuple(
                "mais_concasse", ArticleSource.INVENTORY, BigDecimal.ZERO, "sac", null, USER));
  }

  @Test
  void syncCatalogArticles_leavesAnExistingStockUntouched() {
    when(stockItemRepository.findByFarmIdOrderById(FARM))
        .thenReturn(List.of(row("feed_starter_broiler", ArticleSource.INVENTORY, true)));
    when(inventoryCatalogService.listInventoryArticles(FARM))
        .thenReturn(List.of(article("feed_starter_broiler", "Démarrage poulet chair", "kg", 500)));

    service.syncCatalogArticles(FARM, USER);

    verify(stockItemRepository, never()).saveAll(anyIterable());
  }

  /**
   * A farmer who hides an article from the overview ({@code POST /deactivate}) must not see it come
   * back on the next read: the row still exists, inactive, and the sync only fills in what is
   * missing.
   */
  @Test
  void syncCatalogArticles_doesNotResurrectADeactivatedArticle() {
    when(stockItemRepository.findByFarmIdOrderById(FARM))
        .thenReturn(List.of(row("mais_concasse", ArticleSource.INVENTORY, false)));
    when(inventoryCatalogService.listInventoryArticles(FARM))
        .thenReturn(List.of(article("mais_concasse", "Maïs concassé", "sac", null)));

    service.syncCatalogArticles(FARM, USER);

    verify(stockItemRepository, never()).saveAll(anyIterable());
  }

  /**
   * Medications live in the health catalog and are managed in Sanitaire; materializing them here
   * would bury the feed under a list of products the farmer never stocks.
   */
  @Test
  void syncCatalogArticles_ignoresMedications() {
    when(stockItemRepository.findByFarmIdOrderById(FARM)).thenReturn(List.of());
    when(inventoryCatalogService.listInventoryArticles(FARM)).thenReturn(List.of());
    when(inventoryCatalogService.listMedicationArticles(FARM))
        .thenReturn(
            List.of(
                new InventoryCatalogItemDto(
                    "amoxicilline",
                    ArticleSource.TREATMENT,
                    "Amoxicilline",
                    "MEDICATION",
                    null,
                    null,
                    false)));

    service.syncCatalogArticles(FARM, USER);

    verify(stockItemRepository, never()).saveAll(anyIterable());
  }
}
