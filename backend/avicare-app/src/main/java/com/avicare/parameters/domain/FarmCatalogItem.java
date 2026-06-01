package com.avicare.parameters.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A farm-level catalog override, addition or disable. {@code catalogItemId == null} means a pure
 * farm-custom item (no platform parent); {@code disabled} hides a platform item for the farm.
 */
@Entity
@Table(
    name = "farm_catalog_items",
    uniqueConstraints = @UniqueConstraint(columnNames = {"farm_id", "category", "key"}))
@Getter
@Setter
@NoArgsConstructor
@ToString
public class FarmCatalogItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "catalog_item_id")
  private Long catalogItemId;

  @Column(nullable = false)
  private String category;

  @Column(name = "key", nullable = false)
  private String key;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private Map<String, Object> value;

  @Column(name = "is_disabled", nullable = false)
  private boolean disabled = false;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
