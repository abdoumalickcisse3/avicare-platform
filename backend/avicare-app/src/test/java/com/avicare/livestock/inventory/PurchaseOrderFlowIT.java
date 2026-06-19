package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.PurchaseOrder;
import com.avicare.livestock.domain.PurchaseOrderItem;
import com.avicare.livestock.domain.PurchaseOrderStatus;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.repository.PurchaseOrderItemRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.time.LocalDate;
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
 * Purchase order workflow on a real PostgreSQL (Testcontainers, V1–V17): draft creation with
 * generated number, state transitions (valid + invalid), and the reception cascade that creates IN
 * stock movements and updates stock_items.current_quantity. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class PurchaseOrderFlowIT {

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
  @Autowired private PurchaseOrderService purchaseOrderService;
  @Autowired private StockItemService stockItemService;
  @Autowired private SupplierService supplierService;
  @Autowired private PurchaseOrderItemRepository purchaseOrderItemRepository;

  @Test
  void fullWorkflow_draftNumbering_submit_receive_cascadesStock() throws Exception {
    long farmId = createFarm();
    long supplierId = createSupplier(farmId);
    int year = LocalDate.now().getYear();

    PurchaseOrder po =
        purchaseOrderService.createDraft(
            farmId,
            new PurchaseOrderDraftCommand(
                supplierId,
                LocalDate.now(),
                null,
                null,
                List.of(
                    line("feed_layer", new BigDecimal("50"), 440),
                    line("corn_crushed", new BigDecimal("100"), 300))),
            1L);
    assertThat(po.getStatus()).isEqualTo(PurchaseOrderStatus.DRAFT);
    assertThat(po.getOrderNumber()).isEqualTo(String.format("BC-%d-001", year));
    assertThat(po.getTotalXof()).isEqualTo(52000L); // 50*440 + 100*300
    assertThat(po.getItems()).hasSize(2);
    assertThat(po.getItems().get(0).getArticleLabelSnapshot()).isEqualTo("Ponte");

    // second order of the year → 002
    PurchaseOrder po2 =
        purchaseOrderService.createDraft(
            farmId,
            new PurchaseOrderDraftCommand(
                supplierId,
                null,
                null,
                null,
                List.of(line("feed_layer", new BigDecimal("10"), 440))),
            1L);
    assertThat(po2.getOrderNumber()).isEqualTo(String.format("BC-%d-002", year));

    // updateDraft: replace lines (1 line, 60 @440)
    purchaseOrderService.updateDraft(
        farmId,
        po.getId(),
        new PurchaseOrderDraftCommand(
            supplierId,
            null,
            null,
            "revised",
            List.of(line("feed_layer", new BigDecimal("60"), 440))),
        1L);
    PurchaseOrder reloaded = purchaseOrderService.getById(farmId, po.getId());
    // items is LAZY and the service returns a detached entity (no open session / OSIV here),
    // so assert the lines through their repository rather than the lazy collection.
    List<PurchaseOrderItem> reloadedItems =
        purchaseOrderItemRepository.findByPurchaseOrderId(po.getId());
    assertThat(reloadedItems).hasSize(1);
    assertThat(reloaded.getTotalXof()).isEqualTo(26400L);

    // submit → SENT
    purchaseOrderService.submitToSupplier(farmId, po.getId(), 1L);
    assertThat(purchaseOrderService.getById(farmId, po.getId()).getStatus())
        .isEqualTo(PurchaseOrderStatus.SENT);
    assertThat(purchaseOrderService.getById(farmId, po.getId()).getSentAt()).isNotNull();

    // receive full → RECEIVED + stock cascade
    Long itemId = reloadedItems.get(0).getId();
    PurchaseOrder received =
        purchaseOrderService.receive(
            farmId,
            po.getId(),
            new PurchaseOrderReceiveCommand(
                LocalDate.now(),
                List.of(new PurchaseOrderReceiveCommand.LineReceipt(itemId, new BigDecimal("60")))),
            1L);
    assertThat(received.getStatus()).isEqualTo(PurchaseOrderStatus.RECEIVED);
    assertThat(received.getActualDeliveryDate()).isEqualTo(LocalDate.now());
    assertThat(received.getReceivedBy()).isEqualTo(1L);

    StockItem feedStock =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);
    assertThat(feedStock.getCurrentQuantity()).isEqualByComparingTo("60");
  }

  @Test
  void partialReception_keepsReceivedState() throws Exception {
    long farmId = createFarm();
    long supplierId = createSupplier(farmId);
    PurchaseOrder po =
        purchaseOrderService.createDraft(
            farmId,
            new PurchaseOrderDraftCommand(
                supplierId,
                null,
                null,
                null,
                List.of(line("feed_layer", new BigDecimal("100"), 440))),
            1L);
    purchaseOrderService.submitToSupplier(farmId, po.getId(), 1L);
    Long itemId = po.getItems().get(0).getId();

    PurchaseOrder received =
        purchaseOrderService.receive(
            farmId,
            po.getId(),
            new PurchaseOrderReceiveCommand(
                null,
                List.of(new PurchaseOrderReceiveCommand.LineReceipt(itemId, new BigDecimal("40")))),
            1L);
    assertThat(received.getStatus()).isEqualTo(PurchaseOrderStatus.RECEIVED);
    assertThat(received.getItems().get(0).getReceivedQuantity()).isEqualByComparingTo("40");
    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("40");
  }

  @Test
  void cancellation_andInvalidTransitions() throws Exception {
    long farmId = createFarm();
    long supplierId = createSupplier(farmId);

    // cancel from DRAFT
    PurchaseOrder draft = draft(farmId, supplierId);
    purchaseOrderService.cancel(farmId, draft.getId(), "changed my mind", 1L);
    assertThat(purchaseOrderService.getById(farmId, draft.getId()).getStatus())
        .isEqualTo(PurchaseOrderStatus.CANCELLED);

    // cancel from SENT
    PurchaseOrder sent = draft(farmId, supplierId);
    purchaseOrderService.submitToSupplier(farmId, sent.getId(), 1L);
    purchaseOrderService.cancel(farmId, sent.getId(), null, 1L);
    assertThat(purchaseOrderService.getById(farmId, sent.getId()).getStatus())
        .isEqualTo(PurchaseOrderStatus.CANCELLED);

    // received order: cannot cancel or submit
    PurchaseOrder done = draft(farmId, supplierId);
    purchaseOrderService.submitToSupplier(farmId, done.getId(), 1L);
    Long itemId = done.getItems().get(0).getId();
    purchaseOrderService.receive(
        farmId,
        done.getId(),
        new PurchaseOrderReceiveCommand(
            null,
            List.of(new PurchaseOrderReceiveCommand.LineReceipt(itemId, new BigDecimal("5")))),
        1L);
    assertThatThrownBy(() -> purchaseOrderService.cancel(farmId, done.getId(), "no", 1L))
        .isInstanceOf(BusinessRuleException.class);
    assertThatThrownBy(() -> purchaseOrderService.submitToSupplier(farmId, done.getId(), 1L))
        .isInstanceOf(BusinessRuleException.class);

    // update a SENT order is rejected
    PurchaseOrder sent2 = draft(farmId, supplierId);
    purchaseOrderService.submitToSupplier(farmId, sent2.getId(), 1L);
    assertThatThrownBy(
            () ->
                purchaseOrderService.updateDraft(
                    farmId,
                    sent2.getId(),
                    new PurchaseOrderDraftCommand(
                        supplierId,
                        null,
                        null,
                        null,
                        List.of(line("feed_layer", new BigDecimal("1"), 440))),
                    1L))
        .isInstanceOf(BusinessRuleException.class);
  }

  // --- helpers --------------------------------------------------------

  private PurchaseOrder draft(long farmId, long supplierId) {
    return purchaseOrderService.createDraft(
        farmId,
        new PurchaseOrderDraftCommand(
            supplierId, null, null, null, List.of(line("feed_layer", new BigDecimal("5"), 440))),
        1L);
  }

  private static PurchaseOrderDraftCommand.Line line(String key, BigDecimal qty, int price) {
    return new PurchaseOrderDraftCommand.Line(key, ArticleSource.INVENTORY, qty, price, null);
  }

  private long createSupplier(long farmId) {
    return supplierService
        .create(
            farmId,
            new SupplierCommand(
                "SENAVICOLE", null, null, null, null, null, List.of("FEED"), null, null),
            1L)
        .getId();
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@po.io";
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
                    .content("{\"name\":\"Ferme PO\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
