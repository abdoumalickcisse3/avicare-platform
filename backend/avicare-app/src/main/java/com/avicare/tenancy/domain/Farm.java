package com.avicare.tenancy.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A tenant (formerly "site"). Every business row in the platform is scoped to a {@code farm_id}.
 *
 * <p>Soft-deletable: {@link SQLDelete} turns {@code delete} into an {@code UPDATE ... SET deleted_at
 * = NOW()} (which also fires {@code trg_farms_updated_at}), and {@link SQLRestriction} transparently
 * filters out soft-deleted rows on every read. The owning user is referenced by id.
 */
@Entity
@Table(name = "farms")
@SQLDelete(sql = "UPDATE farms SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Farm {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String name;

  @Column private String description;

  @Column private String location;

  @Column(name = "gps_latitude")
  private BigDecimal gpsLatitude;

  @Column(name = "gps_longitude")
  private BigDecimal gpsLongitude;

  @Column private Integer capacity;

  @Column(nullable = false)
  private String timezone = "Africa/Dakar";

  @Column(nullable = false)
  private String currency = "XOF";

  @Column private String ninea;

  @Column private String rccm;

  @Column(name = "logo_url")
  private String logoUrl;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
