package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.PurchaseOrder;
import com.avicare.livestock.domain.PurchaseOrderItem;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.repository.PurchaseOrderRepository;
import com.avicare.livestock.repository.SupplierRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Focused test for the finance hook wired into {@link PurchaseOrderService#receive} (Task B3): a
 * received purchase order feeds {@link FinanceFacade#recordPurchaseExpenses} using
 * received-quantity × unit-price per line (not the ordered {@code lineTotalXof}), resolving the
 * expense subcategory from the inventory catalog.
 */
@ExtendWith(MockitoExtension.class)
class PurchaseOrderServiceTest {

  @Mock PurchaseOrderRepository purchaseOrderRepository;
  @Mock SupplierRepository supplierRepository;
  @Mock InventoryCatalogService inventoryCatalogService;
  @Mock StockItemService stockItemService;
  @Mock StockMovementService stockMovementService;
  @Mock FinanceFacade financeFacade;

  PurchaseOrderService service;

  static final Long FARM_ID = 1L;
  static final Long USER_ID = 42L;

  @BeforeEach
  void setUp() {
    service =
        new PurchaseOrderService(
            purchaseOrderRepository,
            supplierRepository,
            inventoryCatalogService,
            stockItemService,
            stockMovementService,
            financeFacade);
  }

  @Test
  void receive_withPartialReceipts_recordsExpensesFromReceivedQuantityTimesUnitPrice() {
    PurchaseOrder po = new PurchaseOrder();
    po.setId(100L);
    po.setFarmId(FARM_ID);
    po.setOrderNumber("BC-2026-001");
    po.setStatus(PurchaseOrderStatus.SENT);

    PurchaseOrderItem feedStarter = item(1L, ArticleSource.INVENTORY, "feed-starter", 500);
    PurchaseOrderItem feedGrower = item(2L, ArticleSource.INVENTORY, "feed-grower", 400);
    PurchaseOrderItem treatment = item(3L, ArticleSource.TREATMENT, "med-x", 1000);
    PurchaseOrderItem notReceived = item(4L, ArticleSource.INVENTORY, "feed-unused", 200);
    po.addItem(feedStarter);
    po.addItem(feedGrower);
    po.addItem(treatment);
    po.addItem(notReceived);

    when(purchaseOrderRepository.findByFarmIdAndId(FARM_ID, po.getId()))
        .thenReturn(Optional.of(po));
    when(inventoryCatalogService.listAllAvailableArticles(org.mockito.ArgumentMatchers.anyLong()))
        .thenReturn(
            List.of(
                new InventoryCatalogItemDto(
                    "feed-starter",
                    ArticleSource.INVENTORY,
                    "Aliment démarrage",
                    "FEED",
                    "kg",
                    500,
                    false),
                new InventoryCatalogItemDto(
                    "feed-grower",
                    ArticleSource.INVENTORY,
                    "Aliment croissance",
                    "FEED",
                    "kg",
                    400,
                    false),
                new InventoryCatalogItemDto(
                    "med-x",
                    ArticleSource.TREATMENT,
                    "Médicament X",
                    "MEDICATION",
                    null,
                    null,
                    false)));
    when(stockItemService.createOrGet(
            eq(FARM_ID), any(ArticleSource.class), any(String.class), eq(USER_ID)))
        .thenReturn(mock(StockItem.class));

    LocalDate deliveryDate = LocalDate.of(2026, 7, 4);
    PurchaseOrderReceiveCommand cmd =
        new PurchaseOrderReceiveCommand(
            deliveryDate,
            List.of(
                new PurchaseOrderReceiveCommand.LineReceipt(1L, new BigDecimal("60")), // partial
                new PurchaseOrderReceiveCommand.LineReceipt(2L, new BigDecimal("50")), // full
                new PurchaseOrderReceiveCommand.LineReceipt(3L, new BigDecimal("10")),
                new PurchaseOrderReceiveCommand.LineReceipt(4L, BigDecimal.ZERO) // not received
                ));

    service.receive(FARM_ID, po.getId(), cmd, USER_ID);

    ArgumentCaptor<List<FinanceFacade.PurchaseExpenseLine>> linesCaptor =
        ArgumentCaptor.forClass(List.class);
    verify(financeFacade)
        .recordPurchaseExpenses(
            eq(FARM_ID),
            eq(po.getId()),
            eq("BC-2026-001"),
            eq(deliveryDate),
            linesCaptor.capture(),
            eq(USER_ID));

    List<FinanceFacade.PurchaseExpenseLine> lines = linesCaptor.getValue();
    assertThat(lines)
        .containsExactlyInAnyOrder(
            new FinanceFacade.PurchaseExpenseLine("INVENTORY", "FEED", 30_000L), // 60 x 500
            new FinanceFacade.PurchaseExpenseLine("INVENTORY", "FEED", 20_000L), // 50 x 400
            new FinanceFacade.PurchaseExpenseLine("TREATMENT", "MEDICATION", 10_000L) // 10 x 1000
            );
  }

  @Test
  void receive_withNoReceivedLines_neverRecordsExpenses() {
    PurchaseOrder po = new PurchaseOrder();
    po.setId(200L);
    po.setFarmId(FARM_ID);
    po.setOrderNumber("BC-2026-002");
    po.setStatus(PurchaseOrderStatus.SENT);
    po.addItem(item(10L, ArticleSource.INVENTORY, "feed-starter", 500));

    when(purchaseOrderRepository.findByFarmIdAndId(FARM_ID, po.getId()))
        .thenReturn(Optional.of(po));
    when(inventoryCatalogService.listAllAvailableArticles(org.mockito.ArgumentMatchers.anyLong()))
        .thenReturn(List.of());

    PurchaseOrderReceiveCommand cmd =
        new PurchaseOrderReceiveCommand(
            LocalDate.of(2026, 7, 4),
            List.of(new PurchaseOrderReceiveCommand.LineReceipt(10L, BigDecimal.ZERO)));

    service.receive(FARM_ID, po.getId(), cmd, USER_ID);

    verify(financeFacade, never())
        .recordPurchaseExpenses(anyLong(), anyLong(), any(), any(), any(), anyLong());
  }

  private static PurchaseOrderItem item(
      Long id, ArticleSource source, String articleKey, int unitPriceXof) {
    PurchaseOrderItem item = new PurchaseOrderItem();
    item.setId(id);
    item.setArticleSource(source);
    item.setArticleKey(articleKey);
    item.setArticleLabelSnapshot(articleKey);
    item.setUnit("kg");
    item.setOrderedQuantity(new BigDecimal("100"));
    item.setUnitPriceXof(unitPriceXof);
    item.setLineTotalXof(100L * unitPriceXof);
    return item;
  }
}
