package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleItem;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.inventory.InventoryCatalogItemDto;
import com.avicare.livestock.inventory.InventoryCatalogService;
import com.avicare.livestock.inventory.StockItemService;
import com.avicare.livestock.inventory.StockMovementCommand;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.repository.ClientRepository;
import com.avicare.livestock.repository.SaleRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Direct (cash) sales (Sprint B5-2, Décision D22). A sale is immediate: it is created {@code
 * COMPLETED} and decrements PRODUCT stock right away — either via {@link LivestockFacade}
 * (PRODUCTION lines, D27 blocking) or via {@link StockMovementService} (INVENTORY/TREATMENT lines,
 * D18/D19 non-blocking) — atomically per line. The client is optional (null = walk-in cash sale).
 * Sale numbers are minted {@code V-YYYY-NNN} per farm per year (D24); amounts are HT only (D25).
 * The client balance is NOT touched here (only by payments, B5-4, D26). Cancelling a sale reverses
 * the stock symmetrically. RBAC is enforced at the controller layer (B5-5).
 */
@Service
@RequiredArgsConstructor
public class SaleService {

  private static final String PRODUCT_SUBCATEGORY = "PRODUCT";

  private final SaleRepository saleRepository;
  private final ClientRepository clientRepository;
  private final InventoryCatalogService inventoryCatalogService;
  private final StockItemService stockItemService;
  private final StockMovementService stockMovementService;
  private final LivestockFacade livestockFacade;

  @Transactional
  public Sale create(Long farmId, SaleCommand cmd, Long userId) {
    Client client = cmd.clientId() != null ? loadClient(farmId, cmd.clientId()) : null;
    requireLines(cmd.lines());

    Sale sale = new Sale();
    sale.setFarmId(farmId);
    sale.setClient(client);
    sale.setStatus(SaleStatus.COMPLETED);
    sale.setSaleDate(cmd.saleDate() != null ? cmd.saleDate() : LocalDate.now());
    sale.setPaymentMethod(cmd.paymentMethod());
    sale.setNotes(cmd.notes());
    sale.setCreatedBy(userId);
    sale.setSaleNumber(generateSaleNumber(farmId, sale.getSaleDate().getYear()));
    applyLines(farmId, sale, cmd.lines());
    Sale saved = saleRepository.save(sale);

    // D21 / D27: decrement stock per line — PRODUCTION via facade (blocking), others via inventory.
    for (SaleItem item : saved.getItems()) {
      if (item.getArticleSource() == ArticleSource.PRODUCTION) {
        livestockFacade.consumeProduction(
            farmId,
            item.getProductType(),
            item.getProductionUnitId(),
            item.getQuantity().longValueExact());
      } else {
        recordStockMovement(
            farmId,
            item.getArticleSource(),
            item.getArticleKey(),
            MovementType.OUT,
            MovementReason.SALE,
            item.getQuantity(),
            item.getUnitPriceXof(),
            saved.getSaleDate(),
            "Sale " + saved.getSaleNumber(),
            saved.getId(),
            userId);
      }
    }
    return saved;
  }

  /** COMPLETED → CANCELLED, reversing the stock with compensating IN movements / restocks. */
  @Transactional
  public Sale cancel(Long farmId, Long saleId, String reason, Long userId) {
    Sale sale = load(farmId, saleId);
    if (sale.getStatus() != SaleStatus.COMPLETED) {
      throw new BusinessRuleException(
          "INVALID_SALE_TRANSITION", "Cannot cancel a sale in status " + sale.getStatus());
    }
    for (SaleItem item : sale.getItems()) {
      if (item.getArticleSource() == ArticleSource.PRODUCTION) {
        livestockFacade.restockProduction(
            farmId,
            item.getProductType(),
            item.getProductionUnitId(),
            item.getQuantity().longValueExact());
      } else {
        recordStockMovement(
            farmId,
            item.getArticleSource(),
            item.getArticleKey(),
            MovementType.IN,
            MovementReason.ERROR_CORRECTION,
            item.getQuantity(),
            item.getUnitPriceXof(),
            LocalDate.now(),
            "Cancel sale " + sale.getSaleNumber(),
            sale.getId(),
            userId);
      }
    }
    sale.setStatus(SaleStatus.CANCELLED);
    sale.setCancelledBy(userId);
    sale.setCancelledAt(LocalDateTime.now());
    sale.setCancellationReason(reason);
    return sale;
  }

  @Transactional(readOnly = true)
  public Sale getById(Long farmId, Long saleId) {
    return load(farmId, saleId);
  }

  @Transactional(readOnly = true)
  public List<Sale> listForFarm(Long farmId, SaleStatus statusFilter) {
    return statusFilter != null
        ? saleRepository.findByFarmIdAndStatusOrderBySaleDateDescIdDesc(farmId, statusFilter)
        : saleRepository.findByFarmIdOrderBySaleDateDescIdDesc(farmId);
  }

  // --- internals ------------------------------------------------------

  private Sale load(Long farmId, Long saleId) {
    return saleRepository
        .findByFarmIdAndId(farmId, saleId)
        .orElseThrow(() -> NotFoundException.of("Sale", saleId));
  }

  private Client loadClient(Long farmId, Long clientId) {
    return clientRepository
        .findByFarmIdAndId(farmId, clientId)
        .orElseThrow(() -> NotFoundException.of("Client", clientId));
  }

  private static void requireLines(List<SaleCommand.Line> lines) {
    if (lines == null || lines.isEmpty()) {
      throw new ValidationException("SALE_NO_LINES", "A sale needs at least one line");
    }
  }

  private void applyLines(Long farmId, Sale sale, List<SaleCommand.Line> lines) {
    Map<String, InventoryCatalogItemDto> catalog =
        inventoryCatalogService.listInventoryArticles(farmId).stream()
            .collect(
                Collectors.toMap(
                    InventoryCatalogItemDto::articleKey, Function.identity(), (a, b) -> a));
    long total = 0;
    for (SaleCommand.Line line : lines) {
      if (line.quantity() == null || line.quantity().signum() <= 0) {
        throw new ValidationException("SALE_LINE_QUANTITY", "Quantity must be greater than 0");
      }
      if (line.unitPriceXof() == null || line.unitPriceXof() < 0) {
        throw new ValidationException("SALE_LINE_PRICE", "Unit price must be 0 or more");
      }
      SaleItem item = new SaleItem();
      if (line.articleSource() == ArticleSource.PRODUCTION) {
        validateProductionLine(line);
        item.setArticleKey(line.articleKey());
        item.setArticleSource(ArticleSource.PRODUCTION);
        item.setArticleLabelSnapshot(productionLabelFor(line.productType()));
        item.setUnit(productionUnitFor(line.productType()));
        item.setProductionUnitId(line.productionUnitId());
        item.setProductType(line.productType());
      } else {
        InventoryCatalogItemDto article = catalog.get(line.articleKey());
        if (article == null) {
          throw new NotFoundException("ARTICLE_NOT_FOUND", "Unknown article " + line.articleKey());
        }
        if (!PRODUCT_SUBCATEGORY.equals(article.subcategory())) {
          throw new ValidationException(
              "ARTICLE_NOT_SELLABLE",
              "Article " + line.articleKey() + " is not a product and cannot be sold");
        }
        item.setArticleKey(line.articleKey());
        item.setArticleSource(line.articleSource());
        item.setArticleLabelSnapshot(article.label());
        item.setUnit(article.unit());
      }
      item.setQuantity(line.quantity());
      item.setUnitPriceXof(line.unitPriceXof());
      long lineTotal = lineTotal(line.quantity(), line.unitPriceXof());
      item.setLineTotalXof(lineTotal);
      item.setNotes(line.notes());
      sale.addItem(item);
      total += lineTotal;
    }
    sale.setTotalXof(total);
  }

  private static void validateProductionLine(SaleCommand.Line line) {
    if (line.productType() == null) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_TYPE_REQUIRED", "productType is required for PRODUCTION lines");
    }
    if (line.productType() == ProductType.BROILER && line.productionUnitId() == null) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_UNIT_REQUIRED", "productionUnitId is required for BROILER lines");
    }
    if (line.productType() == ProductType.EGGS && line.productionUnitId() != null) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_UNIT_FORBIDDEN", "productionUnitId must be null for EGGS lines");
    }
    if (line.quantity().stripTrailingZeros().scale() > 0) {
      throw new BusinessRuleException(
          "PRODUCTION_LINE_QUANTITY_INTEGER",
          "Quantity must be a whole number for PRODUCTION lines");
    }
  }

  private static String productionUnitFor(ProductType type) {
    return type == ProductType.BROILER ? "tête" : "plateau";
  }

  private static String productionLabelFor(ProductType type) {
    return type == ProductType.BROILER ? "Poulet de chair" : "Œufs";
  }

  private void recordStockMovement(
      Long farmId,
      com.avicare.livestock.domain.ArticleSource source,
      String articleKey,
      MovementType type,
      MovementReason reason,
      BigDecimal quantity,
      Integer unitPriceXof,
      LocalDate date,
      String note,
      Long saleId,
      Long userId) {
    StockItem stockItem = stockItemService.createOrGet(farmId, source, articleKey, userId);
    StockMovement movement =
        stockMovementService.recordMovement(
            farmId,
            new StockMovementCommand(
                stockItem.getId(),
                type,
                quantity,
                reason,
                date,
                null,
                null,
                null,
                null,
                unitPriceXof,
                note,
                null),
            userId);
    movement.setSaleId(saleId);
  }

  private String generateSaleNumber(Long farmId, int year) {
    int next = saleRepository.findMaxSequence(farmId, "V-" + year + "-%") + 1;
    return String.format("V-%d-%03d", year, next);
  }

  private static long lineTotal(BigDecimal quantity, Integer unitPriceXof) {
    return quantity
        .multiply(BigDecimal.valueOf(unitPriceXof))
        .setScale(0, RoundingMode.HALF_UP)
        .longValueExact();
  }
}
