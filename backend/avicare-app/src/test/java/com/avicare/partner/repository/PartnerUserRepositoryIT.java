package com.avicare.partner.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.domain.PartnerUser;
import jakarta.persistence.EntityManager;
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
 * Slice test for {@link PartnerUserRepository} on a real PostgreSQL (Testcontainers, migrations
 * V1–V37). Verifies {@code findByEmail} round-trip and the {@code email} UNIQUE constraint.
 * CI-only.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class PartnerUserRepositoryIT {

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

  @Autowired PartnerRepository partnerRepository;
  @Autowired PartnerUserRepository partnerUserRepository;
  @Autowired EntityManager em;

  Long partnerId;

  @BeforeEach
  void setUp() {
    User user = new User();
    user.setEmail("owner." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Owner Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();

    Partner p = new Partner();
    p.setName("Provendier " + System.nanoTime());
    p.setType(PartnerType.FEED_SUPPLIER);
    p.setCreatedBy(user.getId());
    partnerId = partnerRepository.saveAndFlush(p).getId();
  }

  private PartnerUser partnerUser(String email) {
    PartnerUser u = new PartnerUser();
    u.setPartnerId(partnerId);
    u.setEmail(email);
    u.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    u.setFullName("Portal User");
    return u;
  }

  @Test
  void savesAndFindsByEmail() {
    PartnerUser saved = partnerUserRepository.saveAndFlush(partnerUser("p@x.io"));

    assertThat(partnerUserRepository.findByEmail("p@x.io"))
        .isPresent()
        .get()
        .extracting(PartnerUser::getId)
        .isEqualTo(saved.getId());
  }

  @Test
  void emailIsUnique() {
    partnerUserRepository.saveAndFlush(partnerUser("dup@x.io"));

    assertThatThrownBy(() -> partnerUserRepository.saveAndFlush(partnerUser("dup@x.io")))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
