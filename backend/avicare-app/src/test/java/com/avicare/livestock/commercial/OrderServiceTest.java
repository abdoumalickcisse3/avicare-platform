package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderStatus;
import com.avicare.livestock.inventory.InventoryCatalogItemDto;
import com.avicare.livestock.inventory.InventoryCatalogService;
import com.avicare.livestock.repository.ClientRepository;
import com.avicare.livestock.repository.OrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link OrderService} — draft creation (numbering, total, strict article validation)
 * and the strict 5-state workflow (D23). All collaborators mocked; runs in surefire/CI (no Docker).
 */
class OrderServiceTest {

  private OrderRepository orderRepository;
  private ClientRepository clientRepository;
  private InventoryCatalogService inventoryCatalogService;
  private OrderService service;

  @BeforeEach
  void setUp() {
    orderRepository = Mockito.mock(OrderRepository.class);
    clientRepository = Mockito.mock(ClientRepository.class);
    inventoryCatalogService = Mockito.mock(InventoryCatalogService.class);
    service = new OrderService(orderRepository, clientRepository, inventoryCatalogService);
    when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
    when(clientRepository.findByFarmIdAndId(eq(7L), eq(3L))).thenReturn(Optional.of(client(3L)));
    when(inventoryCatalogService.listInventoryArticles(org.mockito.ArgumentMatchers.anyLong()))
        .thenReturn(
            List.of(
                new InventoryCatalogItemDto(
                    "eggs_consumption",
                    ArticleSource.INVENTORY,
                    "Oeufs",
                    "PRODUCT",
                    "plateau",
                    2500,
                    false),
                new InventoryCatalogItemDto(
                    "chicken_meat",
                    ArticleSource.INVENTORY,
                    "Poulet",
                    "PRODUCT",
                    "kg",
                    2500,
                    false),
                new InventoryCatalogItemDto(
                    "layer_feed", ArticleSource.INVENTORY, "Aliment", "FEED", "kg", 300, false)));
  }

  // --- createDraft ----------------------------------------------------

  @Test
  void createDraft_persistsPendingOrderWithNumberTotalAndSnapshots() {
    OrderDraftCommand cmd =
        draft(line("eggs_consumption", "10", 3000), line("chicken_meat", "5", 2500));
    when(orderRepository.findMaxSequence(eq(7L), any())).thenReturn(0);

    Order order = service.createDraft(7L, cmd, 42L);

    assertThat(order.getFarmId()).isEqualTo(7L);
    assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
    assertThat(order.getOrderNumber()).isEqualTo("ORD-" + LocalDate.now().getYear() + "-001");
    assertThat(order.getCreatedBy()).isEqualTo(42L);
    assertThat(order.getOrderDate()).isEqualTo(LocalDate.now());
    assertThat(order.getItems()).hasSize(2);
    assertThat(order.getItems().get(0).getArticleLabelSnapshot()).isEqualTo("Oeufs");
    assertThat(order.getItems().get(0).getUnit()).isEqualTo("plateau");
    assertThat(order.getItems().get(0).getLineTotalXof()).isEqualTo(30_000L);
    assertThat(order.getItems().get(1).getLineTotalXof()).isEqualTo(12_500L);
    assertThat(order.getTotalXof()).isEqualTo(42_500L);
  }

  @Test
  void createDraft_numbersAreSequentialPerYear() {
    when(orderRepository.findMaxSequence(eq(7L), any())).thenReturn(5);

    Order order = service.createDraft(7L, draft(line("eggs_consumption", "1", 2500)), 42L);

    assertThat(order.getOrderNumber()).isEqualTo("ORD-" + LocalDate.now().getYear() + "-006");
  }

  @Test
  void createDraft_unknownClientThrowsNotFound() {
    when(clientRepository.findByFarmIdAndId(7L, 99L)).thenReturn(Optional.empty());
    OrderDraftCommand cmd =
        new OrderDraftCommand(
            99L,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            List.of(line("eggs_consumption", "1", 2500)));

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(() -> service.createDraft(7L, cmd, 42L));
  }

  @Test
  void createDraft_emptyLinesThrowsValidation() {
    OrderDraftCommand cmd =
        new OrderDraftCommand(3L, null, null, null, null, null, null, null, List.of());

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.createDraft(7L, cmd, 42L));
  }

  @Test
  void createDraft_nonPositiveQuantityThrowsValidation() {
    OrderDraftCommand cmd = draft(line("eggs_consumption", "0", 2500));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.createDraft(7L, cmd, 42L));
  }

  @Test
  void createDraft_negativePriceThrowsValidation() {
    OrderDraftCommand cmd = draft(line("eggs_consumption", "1", -5));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.createDraft(7L, cmd, 42L));
  }

  @Test
  void createDraft_unknownArticleThrowsNotFound() {
    OrderDraftCommand cmd = draft(line("ghost_article", "1", 2500));

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(() -> service.createDraft(7L, cmd, 42L));
  }

  @Test
  void createDraft_nonProductArticleThrowsValidation() {
    OrderDraftCommand cmd = draft(line("layer_feed", "10", 300));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.createDraft(7L, cmd, 42L));
  }

  // --- state machine --------------------------------------------------

  @Test
  void confirm_pendingBecomesConfirmed() {
    stored(11L, OrderStatus.PENDING);

    Order result = service.confirm(7L, 11L, 42L);

    assertThat(result.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
    assertThat(result.getConfirmedBy()).isEqualTo(42L);
    assertThat(result.getConfirmedAt()).isNotNull();
  }

  @Test
  void confirm_nonPendingThrowsBusinessRule() {
    stored(11L, OrderStatus.CONFIRMED);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.confirm(7L, 11L, 42L));
  }

  @Test
  void markInProgress_confirmedBecomesInProgress() {
    stored(11L, OrderStatus.CONFIRMED);

    Order result = service.markInProgress(7L, 11L, 42L);

    assertThat(result.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
  }

  @Test
  void markInProgress_nonConfirmedThrowsBusinessRule() {
    stored(11L, OrderStatus.PENDING);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.markInProgress(7L, 11L, 42L));
  }

  @Test
  void markDelivered_inProgressBecomesDelivered() {
    stored(11L, OrderStatus.IN_PROGRESS);
    LocalDate when = LocalDate.of(2026, 6, 18);

    Order result = service.markDelivered(7L, 11L, when, 42L);

    assertThat(result.getStatus()).isEqualTo(OrderStatus.DELIVERED);
    assertThat(result.getActualDeliveryDate()).isEqualTo(when);
    assertThat(result.getDeliveredBy()).isEqualTo(42L);
    assertThat(result.getDeliveredAt()).isNotNull();
  }

  @Test
  void markDelivered_nonInProgressThrowsBusinessRule() {
    stored(11L, OrderStatus.CONFIRMED);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.markDelivered(7L, 11L, LocalDate.now(), 42L));
  }

  @Test
  void reopenForRedelivery_deliveredBecomesInProgress() {
    stored(11L, OrderStatus.DELIVERED);

    Order result = service.reopenForRedelivery(7L, 11L, 42L);

    assertThat(result.getStatus()).isEqualTo(OrderStatus.IN_PROGRESS);
  }

  @Test
  void reopenForRedelivery_nonDeliveredThrowsBusinessRule() {
    stored(11L, OrderStatus.IN_PROGRESS);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.reopenForRedelivery(7L, 11L, 42L));
  }

  @Test
  void cancel_fromPendingConfirmedOrInProgressBecomesCancelled() {
    for (OrderStatus from :
        List.of(OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS)) {
      stored(11L, from);

      Order result = service.cancel(7L, 11L, "client annulé", 42L);

      assertThat(result.getStatus()).isEqualTo(OrderStatus.CANCELLED);
      assertThat(result.getCancellationReason()).isEqualTo("client annulé");
      assertThat(result.getCancelledBy()).isEqualTo(42L);
      assertThat(result.getCancelledAt()).isNotNull();
    }
  }

  @Test
  void cancel_deliveredThrowsBusinessRule() {
    stored(11L, OrderStatus.DELIVERED);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.cancel(7L, 11L, "trop tard", 42L));
  }

  @Test
  void cancel_alreadyCancelledThrowsBusinessRule() {
    stored(11L, OrderStatus.CANCELLED);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.cancel(7L, 11L, "encore", 42L));
  }

  // --- helpers --------------------------------------------------------

  private Order stored(Long id, OrderStatus status) {
    Order order = new Order();
    order.setId(id);
    order.setFarmId(7L);
    order.setClient(client(3L));
    order.setStatus(status);
    order.setOrderNumber("ORD-2026-001");
    order.setOrderDate(LocalDate.now());
    when(orderRepository.findByFarmIdAndId(7L, id)).thenReturn(Optional.of(order));
    return order;
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

  private static OrderDraftCommand draft(OrderDraftCommand.Line... lines) {
    return new OrderDraftCommand(3L, null, null, null, null, null, null, null, List.of(lines));
  }

  private static OrderDraftCommand.Line line(String articleKey, String qty, int unitPriceXof) {
    return new OrderDraftCommand.Line(
        articleKey, ArticleSource.INVENTORY, new BigDecimal(qty), unitPriceXof, null, null, null);
  }
}
