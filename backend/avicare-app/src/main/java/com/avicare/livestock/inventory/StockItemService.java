package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.repository.StockItemRepository;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-farm stock management (Sprint B4-1). Stocks are keyed by {@code (farmId, articleSource,
 * articleKey)} with tenant isolation: reads/mutations are always scoped by {@code farmId}. The unit
 * and indicative price are SNAPSHOT from the catalog at first creation. Stock movements (entries,
 * exits, low-stock alerts) arrive in B4-2 — this slice only stands the stock rows up and lets a
 * farmer adjust the threshold/notes/active flag. RBAC is enforced at the controller layer (B4-6);
 * these are plain services.
 */
@Service
@RequiredArgsConstructor
public class StockItemService {

  private final StockItemRepository stockItemRepository;
  private final InventoryCatalogService inventoryCatalogService;

  /**
   * Return the farm's stock row for an article, creating it (quantity 0) on first use. The unit and
   * indicative price are snapshot from the catalog matching {@code articleSource}. A 404 is raised
   * if the key is unknown to that catalog.
   */
  @Transactional
  public StockItem createOrGet(
      Long farmId, ArticleSource articleSource, String articleKey, Long userId) {
    return stockItemRepository
        .findByFarmIdAndArticleSourceAndArticleKey(farmId, articleSource, articleKey)
        .orElseGet(() -> create(farmId, articleSource, articleKey, userId));
  }

  private StockItem create(
      Long farmId, ArticleSource articleSource, String articleKey, Long userId) {
    InventoryCatalogItemDto catalog = resolveCatalog(farmId, articleSource, articleKey);
    StockItem item = new StockItem();
    item.setFarmId(farmId);
    item.setArticleSource(articleSource);
    item.setArticleKey(articleKey);
    item.setCurrentQuantity(BigDecimal.ZERO);
    item.setUnit(catalog.unit());
    item.setTypicalUnitPriceXof(catalog.typicalUnitPriceXof());
    item.setCreatedBy(userId);
    return stockItemRepository.save(item);
  }

  private InventoryCatalogItemDto resolveCatalog(
      Long farmId, ArticleSource source, String articleKey) {
    List<InventoryCatalogItemDto> catalog =
        source == ArticleSource.TREATMENT
            ? inventoryCatalogService.listMedicationArticles()
            : inventoryCatalogService.listInventoryArticles(farmId);
    return catalog.stream()
        .filter(c -> c.articleKey().equals(articleKey))
        .findFirst()
        .orElseThrow(
            () ->
                new NotFoundException(
                    "ARTICLE_NOT_FOUND",
                    "Unknown article " + articleKey + " (source " + source + ")"));
  }

  @Transactional(readOnly = true)
  public List<StockItem> listForFarm(Long farmId) {
    return stockItemRepository.findByFarmIdAndActiveTrueOrderByArticleKey(farmId);
  }

  @Transactional(readOnly = true)
  public List<StockItem> listLowStock(Long farmId) {
    return stockItemRepository.findLowStockByFarmId(farmId);
  }

  @Transactional(readOnly = true)
  public StockItem get(Long farmId, Long stockItemId) {
    return load(farmId, stockItemId);
  }

  @Transactional
  public StockItem updateThreshold(
      Long farmId, Long stockItemId, BigDecimal threshold, Long userId) {
    StockItem item = load(farmId, stockItemId);
    item.setAlertThreshold(threshold);
    return stockItemRepository.save(item);
  }

  @Transactional
  public StockItem updateNotes(Long farmId, Long stockItemId, String notes, Long userId) {
    StockItem item = load(farmId, stockItemId);
    item.setNotes(notes);
    return stockItemRepository.save(item);
  }

  /** Soft delete: hides the stock from the active list, keeps history. */
  @Transactional
  public void deactivate(Long farmId, Long stockItemId, Long userId) {
    StockItem item = load(farmId, stockItemId);
    item.setActive(false);
    stockItemRepository.save(item);
  }

  private StockItem load(Long farmId, Long stockItemId) {
    return stockItemRepository
        .findByFarmIdAndId(farmId, stockItemId)
        .orElseThrow(() -> NotFoundException.of("StockItem", stockItemId));
  }
}
