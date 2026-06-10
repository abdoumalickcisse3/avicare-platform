package com.avicare.livestock.layer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.EggTrayStock;
import com.avicare.livestock.repository.EggTrayStockRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
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
 * Integration test for {@link EggTrayStockService} on a real PostgreSQL (Testcontainers, V1–V8):
 * auto-create, signed adjustments and the non-negative invariant. CI-only on dev machines where
 * Docker is unavailable.
 */
@SpringBootTest
@Testcontainers
@Transactional
class EggTrayStockServiceIT {

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

  @Autowired private EggTrayStockService eggTrayStockService;
  @Autowired private EggTrayStockRepository eggTrayStockRepository;
  @Autowired private EntityManager em;

  private long createFarm() {
    User u = new User();
    u.setEmail("ts" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("TS");
    u.setRole(UserRole.USER);
    em.persist(u);
    Farm f = new Farm();
    f.setName("Ferme TS");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    return f.getId();
  }

  @Test
  void getOrCreate_createsRowWhenAbsent() {
    long farmId = createFarm();
    assertThat(eggTrayStockRepository.findByFarmId(farmId)).isEmpty();

    EggTrayStock stock = eggTrayStockService.getOrCreateForFarm(farmId);

    assertThat(stock.getId()).isNotNull();
    assertThat(stock.getFullTraysCount()).isZero();
    assertThat(stock.getEmptyTraysCount()).isZero();
    assertThat(eggTrayStockRepository.findByFarmId(farmId)).isPresent();
  }

  @Test
  void adjustStock_appliesPositiveDeltas() {
    long farmId = createFarm();

    EggTrayStock stock = eggTrayStockService.adjustStock(farmId, 10, 5);

    assertThat(stock.getFullTraysCount()).isEqualTo(10);
    assertThat(stock.getEmptyTraysCount()).isEqualTo(5);
  }

  @Test
  void adjustStock_appliesNegativeDeltaWithoutGoingBelowZero() {
    long farmId = createFarm();
    eggTrayStockService.record(farmId, new EggTrayStockUpdate(20, 20));

    EggTrayStock stock = eggTrayStockService.adjustStock(farmId, -8, -20);

    assertThat(stock.getFullTraysCount()).isEqualTo(12);
    assertThat(stock.getEmptyTraysCount()).isZero();
  }

  @Test
  void adjustStock_rejectsNegativeResult() {
    long farmId = createFarm();
    eggTrayStockService.record(farmId, new EggTrayStockUpdate(5, 5));

    assertThatThrownBy(() -> eggTrayStockService.adjustStock(farmId, -6, 0))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("below 0");
  }
}
