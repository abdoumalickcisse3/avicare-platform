package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Delivery;
import com.avicare.livestock.domain.DeliveryStatus;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderItem;
import com.avicare.livestock.domain.OrderStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.inventory.StockItemService;
import com.avicare.livestock.inventory.StockMovementCommand;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.repository.DeliveryRepository;
import com.avicare.livestock.repository.OrderRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Unit test for {@link DeliveryService} — converting a confirmed (IN_PROGRESS) order into a
 * delivery (numbering, line snapshot, OUT stock cascade D21, marking the order delivered) and
 * cancellation (compensating IN + reopening the order). All collaborators mocked.
 */
class DeliveryServiceTest {

  private DeliveryRepository deliveryRepository;
  private OrderRepository orderRepository;
  private OrderService orderService;
  private StockItemService stockItemService;
  private StockMovementService stockMovementService;
  private LivestockFacade livestockFacade;
  private DeliveryService service;

  @BeforeEach
  void setUp() {
    deliveryRepository = Mockito.mock(DeliveryRepository.class);
    orderRepository = Mockito.mock(OrderRepository.class);
    orderService = Mockito.mock(OrderService.class);
    stockItemService = Mockito.mock(StockItemService.class);
    stockMovementService = Mockito.mock(StockMovementService.class);
    livestockFacade = Mockito.mock(LivestockFacade.class);
    service =
        new DeliveryService(
            deliveryRepository,
            orderRepository,
            orderService,
            stockItemService,
            stockMovementService,
            livestockFacade);

    when(deliveryRepository.save(any(Delivery.class))).thenAnswer(inv -> inv.getArgument(0));
    StockItem stockItem = new StockItem();
    stockItem.setId(55L);
    when(stockItemService.createOrGet(any(), any(), any(), any())).thenReturn(stockItem);
    when(stockMovementService.recordMovement(any(), any(StockMovementCommand.class), any()))
        .thenReturn(new StockMovement());
  }

  // --- createFromOrder ------------------------------------------------

  @Test
  void createFromOrder_inProgressOrder_createsDeliveredDeliveryWithOutMovements() {
    Order order = order(11L, OrderStatus.IN_PROGRESS);
    order.addItem(orderItem("eggs_consumption", "10", 3000));
    order.addItem(orderItem("chicken_meat", "5", 2500));
    when(orderRepository.findByFarmIdAndId(7L, 11L)).thenReturn(Optional.of(order));
    when(deliveryRepository.findMaxSequence(eq(7L), any())).thenReturn(0);

    Delivery delivery =
        service.createFromOrder(
            7L, 11L, new DeliveryFromOrderCommand(LocalDate.now(), "Moussa Transport", null), 42L);

    assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.DELIVERED);
    assertThat(delivery.getDeliveryNumber()).isEqualTo("LIV-" + LocalDate.now().getYear() + "-001");
    assertThat(delivery.getOrder()).isSameAs(order);
    assertThat(delivery.getCarrier()).isEqualTo("Moussa Transport");
    assertThat(delivery.getItems()).hasSize(2);
    assertThat(delivery.getItems().get(0).getArticleLabelSnapshot()).isEqualTo("Oeufs");
    assertThat(delivery.getTotalXof()).isEqualTo(42_500L);

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
    // the order is marked delivered through the order state machine
    verify(orderService).markDelivered(eq(7L), eq(11L), any(), eq(42L));
  }

  @Test
  void createFromOrder_numbersAreSequentialPerYear() {
    Order order = order(11L, OrderStatus.IN_PROGRESS);
    order.addItem(orderItem("eggs_consumption", "1", 3000));
    when(orderRepository.findByFarmIdAndId(7L, 11L)).thenReturn(Optional.of(order));
    when(deliveryRepository.findMaxSequence(eq(7L), any())).thenReturn(4);

    Delivery delivery =
        service.createFromOrder(7L, 11L, new DeliveryFromOrderCommand(null, null, null), 42L);

    assertThat(delivery.getDeliveryNumber()).isEqualTo("LIV-" + LocalDate.now().getYear() + "-005");
  }

  @Test
  void createFromOrder_nonInProgressOrderThrowsBusinessRule() {
    Order order = order(11L, OrderStatus.CONFIRMED);
    when(orderRepository.findByFarmIdAndId(7L, 11L)).thenReturn(Optional.of(order));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(
            () ->
                service.createFromOrder(
                    7L, 11L, new DeliveryFromOrderCommand(null, null, null), 42L));
  }

  @Test
  void createFromOrder_unknownOrderThrowsNotFound() {
    when(orderRepository.findByFarmIdAndId(7L, 99L)).thenReturn(Optional.empty());

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(
            () ->
                service.createFromOrder(
                    7L, 99L, new DeliveryFromOrderCommand(null, null, null), 42L));
  }

  // --- cancel ---------------------------------------------------------

  @Test
  void cancel_deliveredReversesStockAndReopensOrder() {
    Order order = order(11L, OrderStatus.DELIVERED);
    Delivery delivery = stored(33L, DeliveryStatus.DELIVERED, order);
    delivery.addItem(deliveryItem("eggs_consumption", "10", 3000));
    delivery.addItem(deliveryItem("chicken_meat", "5", 2500));

    Delivery result = service.cancel(7L, 33L, "erreur livraison", 42L);

    assertThat(result.getStatus()).isEqualTo(DeliveryStatus.CANCELLED);
    assertThat(result.getCancelledBy()).isEqualTo(42L);
    assertThat(result.getCancellationReason()).isEqualTo("erreur livraison");

    ArgumentCaptor<StockMovementCommand> captor =
        ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService, times(2)).recordMovement(eq(7L), captor.capture(), eq(42L));
    assertThat(captor.getAllValues())
        .allSatisfy(c -> assertThat(c.movementType()).isEqualTo(MovementType.IN));
    verify(orderService).reopenForRedelivery(eq(7L), eq(11L), eq(42L));
  }

  @Test
  void cancel_alreadyCancelledThrowsBusinessRule() {
    stored(33L, DeliveryStatus.CANCELLED, order(11L, OrderStatus.DELIVERED));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.cancel(7L, 33L, "encore", 42L));
  }

  // --- helpers --------------------------------------------------------

  private Delivery stored(Long id, DeliveryStatus status, Order order) {
    Delivery delivery = new Delivery();
    delivery.setId(id);
    delivery.setFarmId(7L);
    delivery.setStatus(status);
    delivery.setDeliveryNumber("LIV-2026-001");
    delivery.setDeliveryDate(LocalDate.now());
    delivery.setOrder(order);
    when(deliveryRepository.findByFarmIdAndId(7L, id)).thenReturn(Optional.of(delivery));
    return delivery;
  }

  private static Order order(Long id, OrderStatus status) {
    Order order = new Order();
    order.setId(id);
    order.setFarmId(7L);
    order.setStatus(status);
    order.setOrderNumber("ORD-2026-001");
    order.setOrderDate(LocalDate.now());
    return order;
  }

  private static OrderItem orderItem(String articleKey, String qty, int unitPriceXof) {
    OrderItem i = new OrderItem();
    i.setArticleKey(articleKey);
    i.setArticleSource(ArticleSource.INVENTORY);
    i.setArticleLabelSnapshot("eggs_consumption".equals(articleKey) ? "Oeufs" : "Poulet");
    i.setUnit("u");
    i.setQuantity(new BigDecimal(qty));
    i.setUnitPriceXof(unitPriceXof);
    i.setLineTotalXof((long) Integer.parseInt(qty) * unitPriceXof);
    return i;
  }

  private static com.avicare.livestock.domain.DeliveryItem deliveryItem(
      String articleKey, String qty, int unitPriceXof) {
    com.avicare.livestock.domain.DeliveryItem i = new com.avicare.livestock.domain.DeliveryItem();
    i.setArticleKey(articleKey);
    i.setArticleSource(ArticleSource.INVENTORY);
    i.setUnit("u");
    i.setQuantity(new BigDecimal(qty));
    i.setUnitPriceXof(unitPriceXof);
    i.setLineTotalXof((long) Integer.parseInt(qty) * unitPriceXof);
    return i;
  }
}
