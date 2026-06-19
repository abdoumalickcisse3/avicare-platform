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
 * One line of an {@link Invoice} (Sprint B5-3), snapshot from the source sale/delivery line. {@code
 * lineTotalXof} = quantity × unitPriceXof (HT only, D25). Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "invoice_items")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "invoice")
public class InvoiceItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "invoice_id", nullable = false)
  private Invoice invoice;

  @Column(name = "article_key", nullable = false)
  private String articleKey;

  @Enumerated(EnumType.STRING)
  @Column(name = "article_source", nullable = false)
  private ArticleSource articleSource = ArticleSource.INVENTORY;

  @Column(name = "article_label_snapshot")
  private String articleLabelSnapshot;

  @Column(nullable = false)
  private String unit;

  @Column(nullable = false)
  private BigDecimal quantity;

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
