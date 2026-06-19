package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Unit test for {@link SaleService} — direct sale creation (numbering, total, PRODUCT validation,
 * the OUT stock cascade D21, optional client) and cancellation (compensating IN). All collaborators
 * mocked; runs in surefire/CI (no Docker).
 */
class SaleServiceTest {

  private SaleRepository saleRepository;
  private ClientRepository clientRepository;
  private InventoryCatalogService inventoryCatalogService;
  private StockItemService stockItemService;
  private StockMovementService stockMovementService;
  private SaleService service;

  @BeforeEach
  void setUp() {
    saleRepository = Mockito.mock(SaleRepository.class);
    clientRepository = Mockito.mock(ClientRepository.class);
    inventoryCatalogService = Mockito.mock(InventoryCatalogService.class);
    stockItemService = Mockito.mock(StockItemService.class);
    stockMovementService = Mockito.mock(StockMovementService.class);
    service =
        new SaleService(
            saleRepository,
            clientRepository,
            inventoryCatalogService,
            stockItemService,
            stockMovementService);

    when(saleRepository.save(any(Sale.class))).thenAnswer(inv -> inv.getArgument(0));
    when(clientRepository.findByFarmIdAndId(eq(7L), eq(3L))).thenReturn(Optional.of(client(3L)));
    when(inventoryCatalogService.listInventoryArticles())
        .thenReturn(
            List.of(
                new InventoryCatalogItemDto(
                    "eggs_consumption",
                    ArticleSource.INVENTORY,
                    "Oeufs",
                    "PRODUCT",
                    "plateau",
                    2500),
                new InventoryCatalogItemDto(
                    "chicken_meat", ArticleSource.INVENTORY, "Poulet", "PRODUCT", "kg", 2500),
                new InventoryCatalogItemDto(
                    "layer_feed", ArticleSource.INVENTORY, "Aliment", "FEED", "kg", 300)));
    StockItem stockItem = new StockItem();
    stockItem.setId(55L);
    when(stockItemService.createOrGet(any(), any(), any(), any())).thenReturn(stockItem);
    when(stockMovementService.recordMovement(any(), any(StockMovementCommand.class), any()))
        .thenReturn(new StockMovement());
  }

  // --- create ---------------------------------------------------------

  @Test
  void create_persistsCompletedSaleWithNumberTotalAndOutMovements() {
    when(saleRepository.findMaxSequence(eq(7L), any())).thenReturn(0);
    SaleCommand cmd =
        new SaleCommand(
            3L,
            LocalDate.now(),
            "CASH",
            null,
            List.of(line("eggs_consumption", "10", 3000), line("chicken_meat", "5", 2500)));

    Sale sale = service.create(7L, cmd, 42L);

    assertThat(sale.getFarmId()).isEqualTo(7L);
    assertThat(sale.getStatus()).isEqualTo(SaleStatus.COMPLETED);
    assertThat(sale.getSaleNumber()).isEqualTo("V-" + LocalDate.now().getYear() + "-001");
    assertThat(sale.getClient()).isNotNull();
    assertThat(sale.getCreatedBy()).isEqualTo(42L);
    assertThat(sale.getItems()).hasSize(2);
    assertThat(sale.getItems().get(0).getArticleLabelSnapshot()).isEqualTo("Oeufs");
    assertThat(sale.getItems().get(0).getLineTotalXof()).isEqualTo(30_000L);
    assertThat(sale.getTotalXof()).isEqualTo(42_500L);

    // D21: one OUT movement (reason SALE) per line.
    ArgumentCaptor<StockMovementCommand> captor =
        ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService, times(2)).recordMovement(eq(7L), captor.capture(), eq(42L));
    assertThat(captor.getAllValues())
        .allSatisfy(
            c -> {
              assertThat(c.movementType()).isEqualTo(MovementType.OUT);
              assertThat(c.reason()).isEqualTo(MovementReason.SALE);
            });
  }

  @Test
  void create_walkInSale_hasNoClient() {
    when(saleRepository.findMaxSequence(eq(7L), any())).thenReturn(0);
    SaleCommand cmd =
        new SaleCommand(null, null, "CASH", null, List.of(line("eggs_consumption", "2", 3000)));

    Sale sale = service.create(7L, cmd, 42L);

    assertThat(sale.getClient()).isNull();
    assertThat(sale.getSaleDate()).isEqualTo(LocalDate.now());
    assertThat(sale.getTotalXof()).isEqualTo(6_000L);
  }

  @Test
  void create_numbersAreSequentialPerYear() {
    when(saleRepository.findMaxSequence(eq(7L), any())).thenReturn(8);

    Sale sale =
        service.create(
            7L,
            new SaleCommand(null, null, null, null, List.of(line("eggs_consumption", "1", 2500))),
            42L);

    assertThat(sale.getSaleNumber()).isEqualTo("V-" + LocalDate.now().getYear() + "-009");
  }

  @Test
  void create_unknownClientThrowsNotFound() {
    when(clientRepository.findByFarmIdAndId(7L, 99L)).thenReturn(Optional.empty());
    SaleCommand cmd =
        new SaleCommand(99L, null, null, null, List.of(line("eggs_consumption", "1", 2500)));

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void create_emptyLinesThrowsValidation_andTouchesNoStock() {
    SaleCommand cmd = new SaleCommand(null, null, null, null, List.of());

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
    verify(stockMovementService, never()).recordMovement(any(), any(), any());
  }

  @Test
  void create_nonPositiveQuantityThrowsValidation() {
    SaleCommand cmd =
        new SaleCommand(null, null, null, null, List.of(line("eggs_consumption", "0", 2500)));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void create_negativePriceThrowsValidation() {
    SaleCommand cmd =
        new SaleCommand(null, null, null, null, List.of(line("eggs_consumption", "1", -5)));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void create_unknownArticleThrowsNotFound() {
    SaleCommand cmd = new SaleCommand(null, null, null, null, List.of(line("ghost", "1", 2500)));

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void create_nonProductArticleThrowsValidation() {
    SaleCommand cmd =
        new SaleCommand(null, null, null, null, List.of(line("layer_feed", "10", 300)));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  // --- cancel ---------------------------------------------------------

  @Test
  void cancel_completedSaleReversesStockWithInMovements() {
    Sale sale = stored(11L, SaleStatus.COMPLETED);
    sale.addItem(item("eggs_consumption", "10", 3000));
    sale.addItem(item("chicken_meat", "5", 2500));

    Sale result = service.cancel(7L, 11L, "erreur de saisie", 42L);

    assertThat(result.getStatus()).isEqualTo(SaleStatus.CANCELLED);
    assertThat(result.getCancelledBy()).isEqualTo(42L);
    assertThat(result.getCancellationReason()).isEqualTo("erreur de saisie");
    assertThat(result.getCancelledAt()).isNotNull();

    ArgumentCaptor<StockMovementCommand> captor =
        ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService, times(2)).recordMovement(eq(7L), captor.capture(), eq(42L));
    assertThat(captor.getAllValues())
        .allSatisfy(c -> assertThat(c.movementType()).isEqualTo(MovementType.IN));
  }

  @Test
  void cancel_alreadyCancelledThrowsBusinessRule() {
    stored(11L, SaleStatus.CANCELLED);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.cancel(7L, 11L, "encore", 42L));
  }

  // --- helpers --------------------------------------------------------

  private Sale stored(Long id, SaleStatus status) {
    Sale sale = new Sale();
    sale.setId(id);
    sale.setFarmId(7L);
    sale.setStatus(status);
    sale.setSaleNumber("V-2026-001");
    sale.setSaleDate(LocalDate.now());
    when(saleRepository.findByFarmIdAndId(7L, id)).thenReturn(Optional.of(sale));
    return sale;
  }

  private static SaleItem item(String articleKey, String qty, int unitPriceXof) {
    SaleItem i = new SaleItem();
    i.setArticleKey(articleKey);
    i.setArticleSource(ArticleSource.INVENTORY);
    i.setUnit("u");
    i.setQuantity(new BigDecimal(qty));
    i.setUnitPriceXof(unitPriceXof);
    i.setLineTotalXof((long) Integer.parseInt(qty) * unitPriceXof);
    return i;
  }

  private static Client client(Long id) {
    Client c = new Client();
    c.setId(id);
    c.setFarmId(7L);
    c.setClientType(ClientType.BUSINESS);
    c.setDisplayName("Ferme du Soleil");
    c.setCurrentBalanceXof(0L);
    c.setActive(true);
    return c;
  }

  private static SaleCommand.Line line(String articleKey, String qty, int unitPriceXof) {
    return new SaleCommand.Line(
        articleKey, ArticleSource.INVENTORY, new BigDecimal(qty), unitPriceXof, null);
  }
}
