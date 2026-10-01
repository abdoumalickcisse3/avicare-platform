package com.avicare.finance.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.identity.domain.User;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The optional filters of {@link ExpenseRepository} are written {@code (:p IS NULL OR col >= :p)}.
 * On PostgreSQL a null parameter of unknown type makes that fail with "could not determine data
 * type of parameter", which only a real database shows — the mocked service tests never do. Each
 * test passes null for every optional filter, as the endpoints do when the caller omits them.
 * CI-only where Docker is unavailable.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class ExpenseRepositoryIT {

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

  @Autowired ExpenseRepository repo;
  @Autowired EntityManager em;

  Long farmId;
  Long userId;

  @BeforeEach
  void setUp() {
    User user = new User();
    user.setEmail("expense." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Expense Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();
    userId = user.getId();

    Farm farm = new Farm();
    farm.setName("Expense Farm " + System.nanoTime());
    farm.setCreatedBy(userId);
    em.persist(farm);
    em.flush();
    farmId = farm.getId();

    expense("FEED", 1000L, LocalDate.of(2026, 9, 1));
    expense("FEED", 500L, LocalDate.of(2026, 9, 20));
    expense("VET", 300L, LocalDate.of(2026, 8, 15));
    em.flush();
    em.clear();
  }

  private void expense(String category, long amount, LocalDate date) {
    Expense e = new Expense();
    e.setFarmId(farmId);
    e.setCategoryKey(category);
    e.setAmountXof(amount);
    e.setExpenseDate(date);
    e.setLabel(category + " " + date);
    e.setSource(ExpenseSource.MANUAL);
    e.setCreatedBy(userId);
    em.persist(e);
  }

  @Test
  void searchWithNoFilterReturnsEveryExpenseNewestFirst() {
    List<Expense> found = repo.search(farmId, null, null, null, null);

    assertThat(found).extracting(Expense::getAmountXof).containsExactly(500L, 1000L, 300L);
  }

  @Test
  void searchStillAppliesTheFiltersThatAreGiven() {
    List<Expense> found =
        repo.search(farmId, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), "FEED", null);

    assertThat(found).extracting(Expense::getAmountXof).containsExactly(500L, 1000L);
  }

  @Test
  void sumByCategoryWithNoBoundsCoversTheWholeHistory() {
    List<Object[]> rows = repo.sumByCategory(farmId, null, null);

    assertThat(rows)
        .extracting(r -> r[0] + "=" + r[1])
        .containsExactlyInAnyOrder("FEED=1500", "VET=300");
  }

  @Test
  void sumByCategoryStillAppliesTheBoundsThatAreGiven() {
    List<Object[]> rows =
        repo.sumByCategory(farmId, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));

    assertThat(rows).extracting(r -> r[0] + "=" + r[1]).containsExactly("FEED=1500");
  }
}
