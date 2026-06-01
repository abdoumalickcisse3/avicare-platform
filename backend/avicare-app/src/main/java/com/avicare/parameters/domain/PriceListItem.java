package com.avicare.parameters.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A priced product within a {@link PriceList}. One row per (price_list, product_key). */
@Entity
@Table(
    name = "price_list_items",
    uniqueConstraints = @UniqueConstraint(columnNames = {"price_list_id", "product_key"}))
@Getter
@Setter
@NoArgsConstructor
@ToString
public class PriceListItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "price_list_id", nullable = false)
  private Long priceListId;

  @Column(name = "product_key", nullable = false)
  private String productKey;

  @Column(name = "unit_price", nullable = false)
  private BigDecimal unitPrice;

  @Column(nullable = false)
  private String currency = "XOF";

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
