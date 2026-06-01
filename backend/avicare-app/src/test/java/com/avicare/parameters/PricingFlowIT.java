package com.avicare.parameters;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.parameters.domain.AlertSeverity;
import com.avicare.parameters.domain.PriceList;
import com.avicare.parameters.service.PriceListService;
import com.avicare.parameters.service.ThresholdService;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end pricing/threshold flow on a real PostgreSQL (Testcontainers): default-list switching,
 * item upsert, and threshold upsert by type. CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest
@Testcontainers
@Transactional
class PricingFlowIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired private PriceListService priceListService;
  @Autowired private ThresholdService thresholdService;
  @Autowired private EntityManager em;

  private long seedFarm() {
    User u = new User();
    u.setEmail("pr@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("Pr");
    u.setRole(UserRole.USER);
    em.persist(u);
    Farm f = new Farm();
    f.setName("Ferme Pr");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    return f.getId();
  }

  @Test
  void defaultSwitch_andItems_roundTrip() {
    long farmId = seedFarm();

    PriceList first = priceListService.create(farmId, "Tarifs A", true, LocalDate.now(), null);
    priceListService.upsertItem(first.getId(), "poulet_vif_kg", new BigDecimal("2500.00"), "XOF");
    em.flush();

    assertThat(priceListService.getDefault(farmId)).isPresent();
    assertThat(priceListService.listItems(first.getId())).hasSize(1);

    // A second default list flips the first one off.
    PriceList second = priceListService.create(farmId, "Tarifs B", true, LocalDate.now(), null);
    em.flush();
    em.clear();

    assertThat(priceListService.getDefault(farmId).orElseThrow().getId()).isEqualTo(second.getId());
    assertThat(priceListService.listForFarm(farmId)).hasSize(2);
  }

  @Test
  void threshold_upsertByTypeIsIdempotent() {
    long farmId = seedFarm();

    thresholdService.upsert(farmId, "mortality_rate", new BigDecimal("3.0"), AlertSeverity.WARNING);
    thresholdService.upsert(
        farmId, "mortality_rate", new BigDecimal("5.0"), AlertSeverity.CRITICAL);
    em.flush();
    em.clear();

    assertThat(thresholdService.list(farmId)).hasSize(1);
    assertThat(thresholdService.get(farmId, "mortality_rate").getSeverity())
        .isEqualTo(AlertSeverity.CRITICAL);
  }
}
