package com.avicare.partner.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertSeverity;
import com.avicare.partner.domain.AlertStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerAlert;
import com.avicare.partner.domain.PartnerType;
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
 * Slice test for {@link PartnerAlertRepository} on a real PostgreSQL (Testcontainers, migrations
 * V1–V38). What matters here is the partial unique index {@code uq_partner_alerts_active_key}: it
 * is what makes the daily scan idempotent, and it must stop constraining once the alert is RESOLVED
 * so a later episode of the same condition can be raised again. CI-only — Testcontainers can't run
 * on this dev machine.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class PartnerAlertRepositoryIT {

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

  @Autowired PartnerAlertRepository alertRepository;
  @Autowired PartnerRepository partnerRepository;
  @Autowired EntityManager em;

  Long partnerId;
  Long farmId;

  @BeforeEach
  void setUp() {
    User user = new User();
    user.setEmail("alert." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Alert Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();

    Farm farm = new Farm();
    farm.setName("Alert Farm " + System.nanoTime());
    farm.setCreatedBy(user.getId());
    em.persist(farm);
    em.flush();
    farmId = farm.getId();

    Partner p = new Partner();
    p.setName("Provendier " + System.nanoTime());
    p.setType(PartnerType.FEED_SUPPLIER);
    p.setCreatedBy(user.getId());
    partnerId = partnerRepository.saveAndFlush(p).getId();
  }

  private PartnerAlert alert(String dedupKey) {
    PartnerAlert a = new PartnerAlert();
    a.setPartnerId(partnerId);
    a.setFarmId(farmId);
    a.setCategory(AlertCategory.FARM_SILENT);
    a.setSeverity(AlertSeverity.WARNING);
    a.setTitle("Ferme silencieuse");
    a.setBody("Aucune saisie depuis 20 jours.");
    a.setDedupKey(dedupKey);
    return a;
  }

  @Test
  void rejectsASecondActiveAlertOnTheSameKey() {
    alertRepository.saveAndFlush(alert("FARM_SILENT:farm:" + farmId + ":WARNING"));

    assertThatThrownBy(
            () -> alertRepository.saveAndFlush(alert("FARM_SILENT:farm:" + farmId + ":WARNING")))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void allowsTheSameKeyAgainOnceResolved() {
    String key = "FARM_SILENT:farm:" + farmId + ":WARNING";
    PartnerAlert first = alertRepository.saveAndFlush(alert(key));

    first.setStatus(AlertStatus.RESOLVED);
    first.setResolvedAt(LocalDateTime.now());
    alertRepository.saveAndFlush(first);

    // The farm went silent again: the dedup key is re-armed.
    PartnerAlert second = alertRepository.saveAndFlush(alert(key));

    assertThat(second.getId()).isNotEqualTo(first.getId());
    assertThat(
            alertRepository.findByPartnerIdAndDedupKeyAndStatus(partnerId, key, AlertStatus.ACTIVE))
        .map(PartnerAlert::getId)
        .contains(second.getId());
  }

  @Test
  void listsActiveAlertsOfThePartnerNewestFirst() {
    alertRepository.saveAndFlush(alert("FARM_SILENT:farm:" + farmId + ":WARNING"));
    PartnerAlert resolved = alertRepository.saveAndFlush(alert("FARM_LEFT:farm:" + farmId));
    resolved.setStatus(AlertStatus.RESOLVED);
    alertRepository.saveAndFlush(resolved);

    assertThat(
            alertRepository.findByPartnerIdAndStatusOrderByCreatedAtDesc(
                partnerId, AlertStatus.ACTIVE))
        .extracting(PartnerAlert::getDedupKey)
        .containsExactly("FARM_SILENT:farm:" + farmId + ":WARNING");
  }
}
