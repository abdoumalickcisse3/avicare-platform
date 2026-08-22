package com.avicare.partner.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerType;
import com.avicare.tenancy.domain.Farm;
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
 * Slice test for the partner repositories on a real PostgreSQL (Testcontainers, migrations V1–V36).
 * Verifies soft-delete filtering on {@link Partner} and the partial-unique active-membership index
 * ({@code uq_partner_farm_active}). CI-only — Testcontainers can't run on this dev machine.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class PartnerRepositoryIT {

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
  @Autowired PartnerFarmMembershipRepository membershipRepository;
  @Autowired EntityManager em;

  Long userId;
  Long farmId;

  @BeforeEach
  void setUp() {
    User user = new User();
    user.setEmail("partner." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("Partner Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();
    userId = user.getId();

    Farm farm = new Farm();
    farm.setName("Partner Farm " + System.nanoTime());
    farm.setCreatedBy(userId);
    em.persist(farm);
    em.flush();
    farmId = farm.getId();
  }

  private Partner persistPartner() {
    Partner p = new Partner();
    p.setName("Provendier " + System.nanoTime());
    p.setType(PartnerType.FEED_SUPPLIER);
    p.setCreatedBy(userId);
    return partnerRepository.saveAndFlush(p);
  }

  private PartnerFarmMembership membership(Long partnerId, MembershipStatus status) {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setPartnerId(partnerId);
    m.setFarmId(farmId);
    m.setOrigin(MembershipOrigin.MANUAL_ADMIN);
    m.setStatus(status);
    return m;
  }

  @Test
  void savesAndFiltersSoftDeletedPartners() {
    Partner p = persistPartner();

    assertThat(partnerRepository.findByType(PartnerType.FEED_SUPPLIER))
        .extracting(Partner::getId)
        .contains(p.getId());

    partnerRepository.delete(p); // soft delete (@SQLDelete)
    partnerRepository.flush();

    assertThat(partnerRepository.findById(p.getId())).isEmpty();
  }

  @Test
  void uniqueActiveMembershipPerPartnerFarm() {
    Partner p = persistPartner();
    membershipRepository.saveAndFlush(membership(p.getId(), MembershipStatus.CONFIRMED));

    // A second non-LEFT membership for the same (partner, farm) violates uq_partner_farm_active.
    assertThatThrownBy(
            () ->
                membershipRepository.saveAndFlush(membership(p.getId(), MembershipStatus.DECLARED)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
