package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Une écriture du compte-courant d'un fournisseur : une dette contractée, ou un versement.
 *
 * <p>Cette entité vit dans le contexte livestock et n'a délibérément aucun lien vers le contexte
 * finance. La charge d'un achat est enregistrée ailleurs — à la réception du bon d'achat, ou à
 * l'entrée du stock. Compter une écriture d'ici comme une dépense doublerait le coût de l'aliment
 * et fausserait le coût de revient au kilo du rapport de clôture.
 */
@Entity
@Table(name = "supplier_ledger_entries")
@Getter
@Setter
@NoArgsConstructor
@ToString
@SQLDelete(sql = "UPDATE supplier_ledger_entries SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class SupplierLedgerEntry {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "supplier_id", nullable = false)
  private Long supplierId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private LedgerDirection direction;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private LedgerSource source;

  @Column(name = "amount_xof", nullable = false)
  private Long amountXof;

  @Column(name = "entry_date", nullable = false)
  private LocalDate entryDate;

  @Column private String label;

  /** Renseignés pour un CREDIT seulement ; le service est le seul écrivain et le garantit. */
  @Column private String method;

  @Column private String reference;

  @Column private String notes;

  @Column(name = "purchase_order_id")
  private Long purchaseOrderId;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;
}
