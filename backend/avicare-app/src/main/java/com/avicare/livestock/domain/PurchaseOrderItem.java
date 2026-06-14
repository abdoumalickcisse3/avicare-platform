package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * One line of a {@link PurchaseOrder} (Sprint B4-3): an article (inventory item or medication, via
 * {@link ArticleSource}) with an ordered quantity and unit price. {@code articleLabelSnapshot} and
 * {@code unit} are snapshot from the catalog at order time. {@code receivedQuantity} is filled at
 * reception (may differ from {@code orderedQuantity} — partial reception). Timestamps DB-owned
 * (trigger).
 */
@Entity
@Table(name = "purchase_order_items")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "purchaseOrder")
public class PurchaseOrderItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "purchase_order_id", nullable = false)
  private PurchaseOrder purchaseOrder;

  @Column(name = "article_key", nullable = false)
  private String articleKey;

  @Enumerated(EnumType.STRING)
  @Column(name = "article_source", nullable = false)
  private ArticleSource articleSource;

  @Column(name = "article_label_snapshot")
  private String articleLabelSnapshot;

  @Column private String unit;

  @Column(name = "ordered_quantity", nullable = false)
  private BigDecimal orderedQuantity;

  @Column(name = "received_quantity", nullable = false)
  private BigDecimal receivedQuantity = BigDecimal.ZERO;

  @Column(name = "unit_price_xof", nullable = false)
  private Integer unitPriceXof;

  @Column(name = "line_total_xof", nullable = false)
  private Long lineTotalXof;

  @Column private String notes;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
