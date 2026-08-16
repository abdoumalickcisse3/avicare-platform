package com.avicare.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationRead;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.domain.NotificationStatus;
import com.avicare.notification.repository.NotificationReadRepository;
import com.avicare.notification.repository.NotificationRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Slice test for the notification repositories on a real PostgreSQL (Testcontainers, migrations
 * V1–V34). Verifies the partial-unique dedup index (one ACTIVE notification per key, re-armed after
 * resolve) and the unread count. CI-only — Testcontainers can't run on this dev machine.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class NotificationRepositoryTest {

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

  @Autowired NotificationRepository repo;
  @Autowired NotificationReadRepository readRepo;
  @Autowired EntityManager em;

  Long farmId;
  Long userId;

  @BeforeEach
  void setUp() {
    User user = new User();
    user.setEmail("notif." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Notif Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();
    userId = user.getId();

    Farm farm = new Farm();
    farm.setName("Notif Farm " + System.nanoTime());
    farm.setCreatedBy(userId);
    em.persist(farm);
    em.flush();
    farmId = farm.getId();
  }

  private Notification active(String dedupKey) {
    Notification n = new Notification();
    n.setFarmId(farmId);
    n.setCategory(NotificationCategory.LOW_STOCK);
    n.setSeverity(NotificationSeverity.WARNING);
    n.setTitle("Stock bas");
    n.setDedupKey(dedupKey);
    n.setStatus(NotificationStatus.ACTIVE);
    return n;
  }

  @Test
  void activeDedupKeyIsUnique_andReArmsAfterResolve() {
    Notification n1 = repo.saveAndFlush(active("LOW_STOCK:item:42"));

    assertThatThrownBy(() -> repo.saveAndFlush(active("LOW_STOCK:item:42")))
        .isInstanceOf(DataIntegrityViolationException.class);

    // resolving frees the key
    n1.setStatus(NotificationStatus.RESOLVED);
    n1.setResolvedAt(LocalDateTime.now());
    repo.saveAndFlush(n1);

    assertThatCode(() -> repo.saveAndFlush(active("LOW_STOCK:item:42"))).doesNotThrowAnyException();
  }

  @Test
  void countUnread_excludesNotificationsTheUserHasRead() {
    Notification a = repo.saveAndFlush(active("LOW_STOCK:item:1"));
    repo.saveAndFlush(active("LOW_STOCK:item:2"));
    assertThat(repo.countUnread(farmId, userId)).isEqualTo(2);

    NotificationRead read = new NotificationRead();
    read.setNotificationId(a.getId());
    read.setUserId(userId);
    readRepo.saveAndFlush(read);

    assertThat(repo.countUnread(farmId, userId)).isEqualTo(1);
    assertThat(readRepo.existsByNotificationIdAndUserId(a.getId(), userId)).isTrue();
  }
}
