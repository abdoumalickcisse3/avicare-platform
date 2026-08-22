package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A partner network operator (feed supplier or vet) that equips a network of farms. Cross-tenant:
 * NOT scoped to a single farm. Farms are linked via {@link PartnerFarmMembership} (referenced by
 * id). Soft-deletable; timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "partners")
@Getter
@Setter
@NoArgsConstructor
@ToString
@SQLDelete(sql = "UPDATE partners SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Partner {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PartnerType type;

  @Column(name = "contact_name")
  private String contactName;

  @Column(name = "contact_phone")
  private String contactPhone;

  @Column(name = "contact_email")
  private String contactEmail;

  @Column(name = "logo_url")
  private String logoUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PartnerStatus status = PartnerStatus.ACTIVE;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;
}
