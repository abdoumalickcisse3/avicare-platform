package com.avicare.livestock.inventory;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Focused test for the finance hook wired into {@link StockMovementService#recordMovement} (Task
 * B3): only a MANUAL (no cross-context backref), inflow (IN, or ADJUSTMENT increasing the
 * quantity), valued movement feeds {@link FinanceFacade#recordStockEntryExpense}.
 */
@ExtendWith(MockitoExtension.class)
class StockMovementServiceTest {

  @Mock StockMovementRepository stockMovementRepository;
  @Mock StockItemRepository stockItemRepository;
  @Mock FinanceFacade financeFacade;
  @Mock InventoryCatalogService inventoryCatalogService;

  StockMovementService service;

  static final Long FARM_ID = 1L;
  static final Long USER_ID = 42L;
  static final Long STOCK_ITEM_ID = 5L;
  static final Long LOT_ID = 77L;

  @BeforeEach
  void setUp() {
    service =
        new StockMovementService(
            stockMovementRepository, stockItemRepository, financeFacade, inventoryCatalogService);
    when(stockMovementRepository.save(any(StockMovement.class)))
        .thenAnswer(
            invocation -> {
              StockMovement m = invocation.getArgument(0);
              m.setId(999L);
              return m;
            });
  }

  private StockItem stockItem(ArticleSource source, String articleKey) {
    StockItem item = new StockItem();
    item.setId(STOCK_ITEM_ID);
    item.setFarmId(FARM_ID);
    item.setArticleSource(source);
    item.setArticleKey(articleKey);
    item.setCurrentQuantity(BigDecimal.ZERO);
    return item;
  }

  @Test
  void recordMovement_manualValuedIn_recordsStockEntryExpenseWithInheritedLot() {
    StockItem item = stockItem(ArticleSource.INVENTORY, "feed-starter");
    when(stockItemRepository.findByFarmIdAndId(FARM_ID, STOCK_ITEM_ID))
        .thenReturn(Optional.of(item));
    when(inventoryCatalogService.listAllAvailableArticles())
        .thenReturn(
            List.of(
                new InventoryCatalogItemDto(
                    "feed-starter",
                    ArticleSource.INVENTORY,
                    "Aliment démarrage",
                    "FEED",
                    "kg",
                    500)));

    LocalDate date = LocalDate.of(2026, 7, 4);
    StockMovementCommand cmd =
        new StockMovementCommand(
            STOCK_ITEM_ID,
            MovementType.IN,
            new BigDecimal("20"),
            MovementReason.GIFT,
            date,
            LOT_ID,
            null,
            null,
            null,
            600,
            "manual entry",
            null);

    service.recordMovement(FARM_ID, cmd, USER_ID);

    verify(financeFacade)
        .recordStockEntryExpense(
            eq(FARM_ID),
            eq(999L),
            eq("INVENTORY"),
            eq("FEED"),
            eq("Aliment démarrage"),
            eq(12_000L), // 20 x 600
            eq(date),
            eq(LOT_ID),
            eq(USER_ID));
  }

  @Test
  void recordMovement_outValued_neverRecordsExpense() {
    StockItem item = stockItem(ArticleSource.INVENTORY, "feed-starter");
    item.setCurrentQuantity(new BigDecimal("100"));
    when(stockItemRepository.findByFarmIdAndId(FARM_ID, STOCK_ITEM_ID))
        .thenReturn(Optional.of(item));

    StockMovementCommand cmd =
        new StockMovementCommand(
            STOCK_ITEM_ID,
            MovementType.OUT,
            new BigDecimal("10"),
            MovementReason.CONSUMPTION_LOT,
            LocalDate.of(2026, 7, 4),
            LOT_ID,
            null,
            null,
            null,
            600,
            null,
            null);

    service.recordMovement(FARM_ID, cmd, USER_ID);

    verify(financeFacade, never())
        .recordStockEntryExpense(
            anyLong(), anyLong(), any(), any(), any(), anyLong(), any(), any(), anyLong());
  }

  @Test
  void recordMovement_inWithPurchaseOrderBackref_neverRecordsExpense() {
    StockItem item = stockItem(ArticleSource.INVENTORY, "feed-starter");
    when(stockItemRepository.findByFarmIdAndId(FARM_ID, STOCK_ITEM_ID))
        .thenReturn(Optional.of(item));

    StockMovementCommand cmd =
        new StockMovementCommand(
            STOCK_ITEM_ID,
            MovementType.IN,
            new BigDecimal("20"),
            MovementReason.RECEPTION_PURCHASE,
            LocalDate.of(2026, 7, 4),
            LOT_ID,
            null,
            null,
            null,
            600,
            "PO BC-2026-001",
            321L); // purchaseOrderId backref -> not manual

    service.recordMovement(FARM_ID, cmd, USER_ID);

    verify(financeFacade, never())
        .recordStockEntryExpense(
            anyLong(), anyLong(), any(), any(), any(), anyLong(), any(), any(), anyLong());
  }

  @Test
  void recordMovement_manualUnvaluedIn_neverRecordsExpense() {
    StockItem item = stockItem(ArticleSource.INVENTORY, "feed-starter");
    when(stockItemRepository.findByFarmIdAndId(FARM_ID, STOCK_ITEM_ID))
        .thenReturn(Optional.of(item));

    StockMovementCommand cmd =
        new StockMovementCommand(
            STOCK_ITEM_ID,
            MovementType.IN,
            new BigDecimal("20"),
            MovementReason.GIFT,
            LocalDate.of(2026, 7, 4),
            LOT_ID,
            null,
            null,
            null,
            null, // no unit price -> not valued
            null,
            null);

    service.recordMovement(FARM_ID, cmd, USER_ID);

    verify(financeFacade, never())
        .recordStockEntryExpense(
            anyLong(), anyLong(), any(), any(), any(), anyLong(), any(), any(), anyLong());
  }
}
