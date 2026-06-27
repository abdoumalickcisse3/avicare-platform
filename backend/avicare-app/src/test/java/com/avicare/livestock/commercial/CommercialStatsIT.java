package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.domain.Order;
import com.avicare.livestock.domain.OrderStatus;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.OrderRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the dashboard aggregation queries on a real PostgreSQL (Testcontainers, V1–V23). Inserts
 * a minimal fixture (2 clients, 3 COMPLETED sales — 2 inside and 1 outside the query window, 1
 * PARTIALLY_PAID invoice, 1 overdue ISSUED invoice, 1 PENDING order) and asserts every aggregate
 * used by {@link CommercialStats}: revenueXof, revenueSeries, outstandingXof, overdueXof,
 * topClients, topDebtors, ordersToDeliver, invoicesToCollect. The out-of-window sale (99 000 XOF,
 * today-20) ensures that period-filtered queries prove exclusion — without the BETWEEN filter, the
 * period totals would be inflated. CI-only — Testcontainers can't run on this dev machine (Docker
 * 29.x incompatibility, see project memory).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class CommercialStatsIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired SaleRepository saleRepo;
  @Autowired InvoiceRepository invoiceRepo;
  @Autowired OrderRepository orderRepo;
  @Autowired EntityManager em;

  // Fixture ids captured during @BeforeEach so that tests can assert exact clientIds.
  Long farmId;
  Long clientAId;
  Long clientBId;

  // Dates computed once per test instance; DAY1 < DAY2 < today, all within [FROM, TO].
  // DAY_OUTSIDE lies before FROM (today-20 < today-10) and must never appear in period queries.
  LocalDate day1;
  LocalDate day2;
  LocalDate dayOutside;
  LocalDate from;
  LocalDate to;

  @BeforeEach
  void setUp() {
    LocalDate today = LocalDate.now();
    day1 = today.minusDays(5);
    day2 = today.minusDays(2);
    dayOutside = today.minusDays(20); // before FROM — must be excluded by BETWEEN filter
    from = today.minusDays(10);
    to = today;
    int year = today.getYear();

    // User — required by Farm.createdBy (NOT NULL FK).
    User user = new User();
    user.setEmail("stats" + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Stats Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();

    // Farm
    Farm farm = new Farm();
    farm.setName("Stats Farm");
    farm.setCreatedBy(user.getId());
    em.persist(farm);
    em.flush();
    farmId = farm.getId();

    // Clients
    Client clientA = new Client();
    clientA.setFarmId(farmId);
    clientA.setClientType(ClientType.INDIVIDUAL);
    clientA.setDisplayName("Client A");
    em.persist(clientA);

    Client clientB = new Client();
    clientB.setFarmId(farmId);
    clientB.setClientType(ClientType.INDIVIDUAL);
    clientB.setDisplayName("Client B");
    em.persist(clientB);
    em.flush();
    clientAId = clientA.getId();
    clientBId = clientB.getId();

    // Sale 1 — clientA, day1, 10 000 XOF
    Sale s1 = new Sale();
    s1.setFarmId(farmId);
    s1.setClient(clientA);
    s1.setSaleNumber("V-" + year + "-001");
    s1.setSaleDate(day1);
    s1.setTotalXof(10_000L);
    s1.setStatus(SaleStatus.COMPLETED);
    em.persist(s1);

    // Sale 2 — clientB, day2, 6 000 XOF
    Sale s2 = new Sale();
    s2.setFarmId(farmId);
    s2.setClient(clientB);
    s2.setSaleNumber("V-" + year + "-002");
    s2.setSaleDate(day2);
    s2.setTotalXof(6_000L);
    s2.setStatus(SaleStatus.COMPLETED);
    em.persist(s2);

    // Sale 3 — clientA, dayOutside (today-20, OUTSIDE [from, to]), 99 000 XOF.
    // Its distinctive amount (99 000) means any period query that forgets the BETWEEN filter
    // would return an inflated total (e.g. sumRevenueByPeriod → 115 000, not 16 000), causing
    // the period-assertion tests to fail.  Snapshot KPIs (outstanding, overdue, etc.) are
    // period-independent and are unaffected by this sale.
    Sale sOutside = new Sale();
    sOutside.setFarmId(farmId);
    sOutside.setClient(clientA);
    sOutside.setSaleNumber("V-" + year + "-003");
    sOutside.setSaleDate(dayOutside);
    sOutside.setTotalXof(99_000L);
    sOutside.setStatus(SaleStatus.COMPLETED);
    em.persist(sOutside);

    em.flush();

    // Invoice 1 — from sale1, clientA, 10 000 total, 3 000 paid → outstanding 7 000, not overdue.
    Invoice inv1 = new Invoice();
    inv1.setFarmId(farmId);
    inv1.setClient(clientA);
    inv1.setInvoiceNumber("F-" + year + "-001");
    inv1.setSourceType(InvoiceSourceType.SALE);
    inv1.setSaleId(s1.getId());
    inv1.setIssueDate(day1);
    inv1.setTotalXof(10_000L);
    inv1.setAmountPaidXof(3_000L);
    inv1.setStatus(InvoiceStatus.PARTIALLY_PAID);
    em.persist(inv1);

    // Invoice 2 — from sale2, clientB, 6 000 total, 0 paid, due yesterday → overdue.
    Invoice inv2 = new Invoice();
    inv2.setFarmId(farmId);
    inv2.setClient(clientB);
    inv2.setInvoiceNumber("F-" + year + "-002");
    inv2.setSourceType(InvoiceSourceType.SALE);
    inv2.setSaleId(s2.getId());
    inv2.setIssueDate(day2);
    inv2.setDueDate(today.minusDays(1));
    inv2.setTotalXof(6_000L);
    inv2.setAmountPaidXof(0L);
    inv2.setStatus(InvoiceStatus.ISSUED);
    em.persist(inv2);

    // Order — clientA, PENDING → in the "to deliver" worklist.
    Order order = new Order();
    order.setFarmId(farmId);
    order.setClient(clientA);
    order.setOrderNumber("ORD-" + year + "-001");
    order.setOrderDate(today);
    order.setStatus(OrderStatus.PENDING);
    em.persist(order);

    em.flush();
    em.clear(); // detach everything so queries hit the DB, not the first-level cache
  }

  // ── Period KPI tests ──────────────────────────────────────────────────────

  @Test
  void revenue_sum_equals_sum_of_completed_sales_in_window() {
    Long revenue = saleRepo.sumRevenueByPeriod(farmId, from, to);
    assertThat(revenue).isEqualTo(16_000L); // 10 000 + 6 000
  }

  @Test
  void revenue_sum_returns_null_when_no_sales_in_window() {
    LocalDate future = LocalDate.now().plusDays(10);
    Long revenue = saleRepo.sumRevenueByPeriod(farmId, future, future.plusDays(5));
    assertThat(revenue).isNull();
  }

  @Test
  void revenue_series_grouped_by_day_ordered_asc() {
    List<Object[]> series = saleRepo.sumRevenueByDay(farmId, from, to);
    assertThat(series).hasSize(2);
    // row[0] = LocalDate (saleDate), row[1] = Long (SUM)
    assertThat((LocalDate) series.get(0)[0]).isEqualTo(day1);
    assertThat(((Number) series.get(0)[1]).longValue()).isEqualTo(10_000L);
    assertThat((LocalDate) series.get(1)[0]).isEqualTo(day2);
    assertThat(((Number) series.get(1)[1]).longValue()).isEqualTo(6_000L);
  }

  @Test
  void top_clients_by_revenue_sorted_desc() {
    List<Object[]> top = saleRepo.topClientsByRevenue(farmId, from, to, PageRequest.of(0, 5));
    assertThat(top).hasSize(2);
    // row[0]=clientId, row[1]=displayName, row[2]=SUM
    assertThat(((Number) top.get(0)[0]).longValue()).isEqualTo(clientAId); // 10 000 first
    assertThat(top.get(0)[1]).isEqualTo("Client A");
    assertThat(((Number) top.get(0)[2]).longValue()).isEqualTo(10_000L);
    assertThat(((Number) top.get(1)[0]).longValue()).isEqualTo(clientBId); // 6 000 second
    assertThat(((Number) top.get(1)[2]).longValue()).isEqualTo(6_000L);
  }

  @Test
  void top_clients_pageable_limits_results() {
    // Requesting top 1 should return only clientA (10 000 > 6 000).
    List<Object[]> top1 = saleRepo.topClientsByRevenue(farmId, from, to, PageRequest.of(0, 1));
    assertThat(top1).hasSize(1);
    assertThat(((Number) top1.get(0)[0]).longValue()).isEqualTo(clientAId);
  }

  @Test
  void period_filter_excludes_out_of_window_sale() {
    // The fixture contains a COMPLETED sale of 99 000 XOF on dayOutside (today-20), which lies
    // before the query window [today-10 .. today].  Without the BETWEEN :from AND :to filter:
    //   sumRevenueByPeriod  would return 115 000 (10 000 + 6 000 + 99 000) instead of 16 000
    //   sumRevenueByDay     would return 3 rows (dayOutside, day1, day2) instead of 2
    //   topClientsByRevenue would show clientA at 109 000 (10 000 + 99 000) instead of 10 000
    // All three assertions below would therefore fail if the filter were accidentally dropped.

    Long revenue = saleRepo.sumRevenueByPeriod(farmId, from, to);
    assertThat(revenue)
        .as(
            "out-of-window sale (99 000 XOF, today-20) must be excluded; "
                + "total must be 10 000 + 6 000 = 16 000, not 115 000")
        .isEqualTo(16_000L);

    List<Object[]> series = saleRepo.sumRevenueByDay(farmId, from, to);
    assertThat(series)
        .as("series must contain only the 2 in-window sale dates, not dayOutside")
        .hasSize(2);

    List<Object[]> top = saleRepo.topClientsByRevenue(farmId, from, to, PageRequest.of(0, 5));
    assertThat(((Number) top.get(0)[2]).longValue())
        .as("clientA in-window revenue must be 10 000, not 109 000 (out-of-window 99 000 excluded)")
        .isEqualTo(10_000L);
  }

  // ── Snapshot KPI tests ───────────────────────────────────────────────────

  @Test
  void outstanding_xof_is_total_minus_paid_across_open_invoices() {
    long outstanding = invoiceRepo.sumOutstanding(farmId);
    // inv1: 10 000 − 3 000 = 7 000; inv2: 6 000 − 0 = 6 000 → total 13 000
    assertThat(outstanding).isEqualTo(13_000L);
  }

  @Test
  void overdue_xof_covers_only_past_due_invoices() {
    long overdue = invoiceRepo.sumOverdue(farmId, LocalDate.now());
    // Only inv2 has a due_date in the past (yesterday); inv1 has no due_date.
    assertThat(overdue).isEqualTo(6_000L);
  }

  @Test
  void invoices_to_collect_count_equals_open_invoice_count() {
    long count = invoiceRepo.countToCollect(farmId);
    assertThat(count).isEqualTo(2); // inv1 (PARTIALLY_PAID) + inv2 (ISSUED)
  }

  @Test
  void top_debtors_sorted_desc_by_outstanding() {
    List<Object[]> debtors = invoiceRepo.topDebtors(farmId);
    assertThat(debtors).hasSize(2);
    // clientA outstanding=7 000 > clientB outstanding=6 000 → A first
    assertThat(((Number) debtors.get(0)[0]).longValue()).isEqualTo(clientAId);
    assertThat(debtors.get(0)[1]).isEqualTo("Client A");
    assertThat(((Number) debtors.get(0)[2]).longValue()).isEqualTo(7_000L);
    assertThat(((Number) debtors.get(1)[0]).longValue()).isEqualTo(clientBId);
    assertThat(((Number) debtors.get(1)[2]).longValue()).isEqualTo(6_000L);
  }

  @Test
  void orders_to_deliver_count_includes_pending_confirmed_in_progress() {
    long count = orderRepo.countToDeliver(farmId);
    assertThat(count).isEqualTo(1); // the single PENDING order
  }
}
