package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceSourceType;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.support.RsaKeys;
import java.security.KeyPair;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the two lifetime revenue aggregates on a real PostgreSQL: COMPLETED sales total and
 * paid-amount total on DELIVERY-sourced invoices (SALE-sourced and CANCELLED excluded). CI-only.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
class CommercialRevenueQueriesIT {

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

  @Autowired private SaleRepository saleRepository;
  @Autowired private InvoiceRepository invoiceRepository;

  private Invoice invoice(
      long farmId, InvoiceSourceType src, InvoiceStatus st, long total, long paid) {
    Invoice i = new Invoice();
    i.setFarmId(farmId);
    i.setInvoiceNumber("INV-" + System.nanoTime());
    i.setSourceType(src);
    if (src == InvoiceSourceType.SALE) i.setSaleId(1L);
    else i.setDeliveryId(1L);
    i.setStatus(st);
    i.setIssueDate(LocalDate.now());
    i.setDueDate(LocalDate.now().plusDays(15));
    i.setTotalXof(total);
    i.setAmountPaidXof(paid);
    i.setCreatedBy(1L);
    return invoiceRepository.save(i);
  }

  @Test
  void aggregates_countExpectedRowsOnly() {
    long farmId = 999_001L;
    // DELIVERY invoices: 40000 paid + 10000 paid = 50000 counted
    invoice(farmId, InvoiceSourceType.DELIVERY, InvoiceStatus.PARTIALLY_PAID, 100000, 40000);
    invoice(farmId, InvoiceSourceType.DELIVERY, InvoiceStatus.PAID, 10000, 10000);
    // SALE invoice: NOT counted by sumPaidFromDeliveries
    invoice(farmId, InvoiceSourceType.SALE, InvoiceStatus.PAID, 70000, 70000);
    // CANCELLED delivery invoice: excluded
    invoice(farmId, InvoiceSourceType.DELIVERY, InvoiceStatus.CANCELLED, 20000, 20000);

    assertThat(invoiceRepository.sumPaidFromDeliveries(farmId)).isEqualTo(50000L);
    // No sales seeded for this farm → 0 (COALESCE)
    assertThat(saleRepository.sumAllRevenue(farmId)).isEqualTo(0L);
  }
}
