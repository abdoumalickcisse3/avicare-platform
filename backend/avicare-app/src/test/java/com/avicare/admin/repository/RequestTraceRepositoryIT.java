package com.avicare.admin.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.admin.domain.RequestTrace;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
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
 * The console search and the retention window, against a real PostgreSQL (V48). Both are what makes
 * the table usable: a filter that silently drops rows would send support down the wrong path, and a
 * purge that misses would let a debugging aid grow into a liability. CI-only: Testcontainers cannot
 * run on the dev machine.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class RequestTraceRepositoryIT {

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

  @Autowired RequestTraceRepository repository;
  @Autowired EntityManager em;

  private static final LocalDateTime NOW = LocalDateTime.now();

  private Long farmA;
  private Long farmB;

  @BeforeEach
  void seed() {
    repository.deleteAll();
    // farm_id carries a real foreign key, so the fixture needs real farms behind it.
    Long userId = insertUser();
    farmA = insertFarm(userId, "Ferme A");
    farmB = insertFarm(userId, "Ferme B");
    repository.saveAll(
        java.util.List.of(
            trace("corr-ok", "POST", "/api/v1/farms", 201, "owner@farm.sn", farmA, NOW),
            trace(
                "corr-ko",
                "GET",
                "/api/v1/farms/" + farmA + "/orders",
                500,
                "owner@farm.sn",
                farmA,
                NOW.minusHours(2)),
            trace(
                "corr-old",
                "POST",
                "/api/v1/sales",
                201,
                "other@farm.sn",
                farmB,
                NOW.minusDays(45))));
  }

  private Long insertUser() {
    return ((Number)
            em.createNativeQuery(
                    """
                    INSERT INTO users(email, password_hash, full_name)
                    VALUES ('trace-fixture@it.io', 'x', 'Trace Fixture') RETURNING id
                    """)
                .getSingleResult())
        .longValue();
  }

  private Long insertFarm(Long userId, String name) {
    return ((Number)
            em.createNativeQuery(
                    "INSERT INTO farms(name, created_by) VALUES (:name, :userId) RETURNING id")
                .setParameter("name", name)
                .setParameter("userId", userId)
                .getSingleResult())
        .longValue();
  }

  @Test
  void findsATraceByTheIdentifierTheCallerReadsOut() {
    assertThat(repository.findByRequestIdOrderByStartedAtAsc("corr-ko"))
        .singleElement()
        .satisfies(t -> assertThat(t.getStatusCode()).isEqualTo(500));
  }

  @Test
  void filtersOnEachCriterionSeparately() {
    assertThat(search("corr-ok", null, null, null, null, false, null)).hasSize(1);
    assertThat(search(null, "OWNER@farm", null, null, null, false, null)).hasSize(2);
    assertThat(search(null, null, farmB, null, null, false, null)).hasSize(1);
    assertThat(search(null, null, null, "/orders", null, false, null)).hasSize(1);
    assertThat(search(null, null, null, null, 500, false, null)).hasSize(1);
    assertThat(search(null, null, null, null, null, true, null)).hasSize(1);
    assertThat(search(null, null, null, null, null, false, NOW.minusDays(1))).hasSize(2);
  }

  @Test
  void returnsTheMostRecentFirst() {
    assertThat(search(null, null, null, null, null, false, null))
        .extracting(RequestTrace::getRequestId)
        .containsExactly("corr-ok", "corr-ko", "corr-old");
  }

  @Test
  void purgeRemovesOnlyWhatFellOutOfTheRetentionWindow() {
    int removed = repository.deleteOlderThan(NOW.minusDays(30));

    assertThat(removed).isEqualTo(1);
    assertThat(repository.findAll())
        .extracting(RequestTrace::getRequestId)
        .containsExactlyInAnyOrder("corr-ok", "corr-ko");
  }

  private java.util.List<RequestTrace> search(
      String requestId,
      String email,
      Long farmId,
      String path,
      Integer status,
      boolean errorsOnly,
      LocalDateTime from) {
    return repository
        .search(
            requestId, email, farmId, path, status, errorsOnly, from, null, PageRequest.of(0, 20))
        .getContent();
  }

  private static RequestTrace trace(
      String requestId,
      String method,
      String path,
      int status,
      String email,
      Long farmId,
      LocalDateTime startedAt) {
    return RequestTrace.builder()
        .requestId(requestId)
        .method(method)
        .path(path)
        .routePattern(path)
        .userEmail(email)
        .farmId(farmId)
        .statusCode(status)
        .durationMs(12)
        .startedAt(startedAt)
        .endedAt(startedAt.plusNanos(12_000_000))
        .build();
  }
}
